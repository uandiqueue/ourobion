/**
 * Per-source rate limiter (design §5, §5.1, §10.2).
 *
 * Two layers of restraint per source, both enforced before a network call runs:
 *  1. **Concurrency** — `p-limit` caps how many calls to a source are in flight.
 *  2. **Pacing** — a token bucket spaces calls so we honour each source's RPS:
 *       arXiv  1 req / 3 s          (~0.33/s)
 *       NCBI   3/s anonymous, 10/s with a key
 *       CORE   ~1/s (conservative)
 *       S2     ~1/s (conservative)
 *       Crossref / OpenAlex / Europe PMC — polite ~5/s
 *       everything else — a sane default
 *
 * The bucket refills continuously at `ratePerSec`; `schedule` waits (without
 * busy-looping) until at least one token is available, consumes it, then runs
 * `fn` inside the concurrency limiter. No network is touched here — adapters
 * pass their own `fn`. Pure timing + queueing, so it is unit-testable offline.
 *
 * ESM / NodeNext — imports use explicit `.js` extensions.
 */

import pLimit from 'p-limit';
import type { LimitFunction } from 'p-limit';
import type { RateLimiter, SourceName } from '../types.js';

/** Pacing + concurrency profile for one source. */
export interface SourceRate {
  /** sustained requests per second (token refill rate) */
  ratePerSec: number;
  /** max requests in flight at once */
  concurrency: number;
  /** bucket capacity — max burst; defaults to `max(1, ceil(ratePerSec))` */
  burst?: number;
}

/** Tunables the factory accepts (mostly for tests + key-aware NCBI rate). */
export interface RateLimiterOptions {
  /** when true, NCBI/pubmed gets the keyed 10/s rate instead of the 3/s anon rate */
  ncbiKeyed?: boolean;
  /** injectable clock (ms since epoch) for deterministic tests; default Date.now */
  now?: () => number;
  /** injectable sleep for deterministic tests; default setTimeout-based */
  sleep?: (ms: number) => Promise<void>;
  /** per-source overrides merged over the defaults (tests / tuning) */
  overrides?: Partial<Record<SourceName, Partial<SourceRate>>>;
}

/** Conservative default profiles (design §5 rate table). */
function defaultRates(ncbiKeyed: boolean): Record<SourceName, SourceRate> {
  // NCBI E-utils: 3 req/s anonymous, 10 req/s with a key (design §2).
  const ncbiRate = ncbiKeyed ? 10 : 3;
  return {
    // arXiv asks for ~1 request every 3 seconds.
    arxiv: { ratePerSec: 1 / 3, concurrency: 1, burst: 1 },
    // PubMed / NCBI E-utils — rate-only cap, key lifts it.
    pubmed: { ratePerSec: ncbiRate, concurrency: ncbiKeyed ? 4 : 2, burst: ncbiRate },
    // PMC is also NCBI infrastructure → share the NCBI rate.
    pmc: { ratePerSec: ncbiRate, concurrency: ncbiKeyed ? 4 : 2, burst: ncbiRate },
    // CORE + S2 — conservative ~1/s.
    core: { ratePerSec: 1, concurrency: 1, burst: 1 },
    s2: { ratePerSec: 1, concurrency: 1, burst: 1 },
    // Polite pool: Crossref / OpenAlex / Europe PMC — keep it gentle (~5/s).
    crossref: { ratePerSec: 5, concurrency: 2, burst: 5 },
    openalex: { ratePerSec: 5, concurrency: 2, burst: 5 },
    europepmc: { ratePerSec: 5, concurrency: 2, burst: 5 },
    unpaywall: { ratePerSec: 5, concurrency: 2, burst: 5 },
    // Lower-volume metadata sources — modest defaults.
    doaj: { ratePerSec: 2, concurrency: 1, burst: 2 },
    biorxiv: { ratePerSec: 2, concurrency: 1, burst: 2 },
    lens: { ratePerSec: 1, concurrency: 1, burst: 1 },
  };
}

/** Default async sleep (real timers). */
function realSleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

/**
 * A continuously-refilling token bucket. Not exported — owned by the limiter.
 * `tokens` is fractional; it accrues at `ratePerSec` and is capped at `burst`.
 */
class TokenBucket {
  private tokens: number;
  private lastRefillMs: number;
  /** serialises concurrent `acquire` calls so two waiters can't take one token */
  private chain: Promise<void> = Promise.resolve();

  constructor(
    private readonly ratePerSec: number,
    private readonly burst: number,
    private readonly now: () => number,
    private readonly sleep: (ms: number) => Promise<void>,
  ) {
    this.tokens = burst;
    this.lastRefillMs = now();
  }

  private refill(): void {
    const t = this.now();
    const elapsedSec = (t - this.lastRefillMs) / 1000;
    if (elapsedSec > 0) {
      this.tokens = Math.min(this.burst, this.tokens + elapsedSec * this.ratePerSec);
      this.lastRefillMs = t;
    }
  }

  /** Resolves once exactly one token has been consumed for this caller. */
  acquire(): Promise<void> {
    // Serialise: each acquire waits for the prior one to finish consuming,
    // so the refill/consume read-modify-write is never interleaved.
    const result = this.chain.then(() => this.consumeOne());
    // Keep the chain alive even if a consume rejects (it shouldn't).
    this.chain = result.catch(() => undefined);
    return result;
  }

  private async consumeOne(): Promise<void> {
    // Loop because a single sleep may under-shoot due to timer granularity.
    for (;;) {
      this.refill();
      if (this.tokens >= 1) {
        this.tokens -= 1;
        return;
      }
      const deficit = 1 - this.tokens;
      const waitMs = Math.ceil((deficit / this.ratePerSec) * 1000);
      await this.sleep(Math.max(waitMs, 1));
    }
  }
}

/**
 * Build a {@link RateLimiter} keyed by {@link SourceName}. Each source gets its
 * own concurrency limiter (`p-limit`) and token bucket. `schedule` waits for a
 * token, then runs `fn` under the concurrency cap.
 */
export function createRateLimiter(opts: RateLimiterOptions = {}): RateLimiter {
  const now = opts.now ?? Date.now;
  const sleep = opts.sleep ?? realSleep;
  const base = defaultRates(opts.ncbiKeyed ?? false);

  const buckets = new Map<SourceName, TokenBucket>();
  const limiters = new Map<SourceName, LimitFunction>();

  for (const key of Object.keys(base) as SourceName[]) {
    const def = base[key];
    const override = opts.overrides?.[key];
    const ratePerSec = override?.ratePerSec ?? def.ratePerSec;
    const concurrency = Math.max(1, override?.concurrency ?? def.concurrency);
    const burst = Math.max(1, override?.burst ?? def.burst ?? Math.max(1, Math.ceil(ratePerSec)));
    buckets.set(key, new TokenBucket(ratePerSec, burst, now, sleep));
    limiters.set(key, pLimit(concurrency));
  }

  return {
    async schedule<T>(source: SourceName, fn: () => Promise<T>): Promise<T> {
      const bucket = buckets.get(source);
      const limit = limiters.get(source);
      if (bucket === undefined || limit === undefined) {
        throw new Error(`rateLimiter: unknown source '${source}'`);
      }
      // Pace first (token bucket), then bound concurrency (p-limit).
      await bucket.acquire();
      return limit(fn);
    },
  };
}
