/**
 * Budget guard (design §5.1, §10.2).
 *
 * Some sources are **metered with a daily cap**, not merely rate-limited. This
 * tracker keeps a per-source running total of the day's spend in a persisted
 * state file (`data/corpus/usage.json`) and **fails closed** before issuing the
 * call that would cross 95% of a source's budget. The 5% headroom absorbs
 * in-flight/concurrent calls so the cap is never actually exceeded.
 *
 * Metered sources (design §5.1) — confirmed by live verification, not just docs:
 *  - OpenAlex — unit = USD, daily budget $1.00, hard stop $0.95. Per-request
 *    costs: singleton $0 · list/filter $0.0001 · search $0.001 ·
 *    semantic/content/text $0.01. Verified live 2026-07-01: `X-RateLimit-*`
 *    response headers report `Limit-USD: 1`, resetting at UTC midnight —
 *    matches this model exactly.
 *  - Everything else (CORE, Crossref, Europe PMC, PMC, arXiv, Unpaywall, DOAJ,
 *    S2, Lens, NCBI/pubmed) — unmetered here → charge/wouldExceed95 are no-ops.
 *    CORE in particular was WRONGLY modeled as a 1000-token/day budget in an
 *    earlier version of this file; live verification (2026-07-01) showed its
 *    real `X-RateLimit-*` headers report a ~10-request bucket that fully
 *    refills ~60s after exhaustion — a short rate-limit window, not a daily
 *    quota, with no evidence of any coarser daily cap on a free personal key.
 *    That real constraint is now enforced by `limits/rateLimiter.ts`'s `'core'`
 *    profile (paced to match) plus a 429-aware retry in `retrieval/core.ts` —
 *    the wrong tool (a daily budget) has been removed rather than given a
 *    "more correct" number, since no daily-scoped constraint actually exists
 *    to model.
 *
 * Crash-safe + resumable: counters live on disk, are re-read at construction,
 * and reset at the provider's UTC-midnight window (the `windowStart` stored
 * with each counter). A multi-day ingest is the expected mode (§5.1).
 *
 * Concurrency (audit A10): `charge()` merges a fresh disk read into memory
 * BEFORE the hard-stop check, so two concurrent ingest processes see each
 * other's spend and the 95% gate fires on the COMBINED total instead of each
 * process's own view (last-write-wins under-counting). Merge = newest UTC
 * window wins; same window → max(spent), which equals the union of both
 * writers' charges because each persists after every charge (a naive sum
 * would double-count the shared base). The residual race is one charge's
 * read→rename window — exactly the in-flight overlap the 5% headroom above
 * is documented to absorb. Lifecycle (audit A11): counters from dead (past)
 * UTC windows are dropped on persist; the file is otherwise bounded by the
 * source vocabulary, so no further pruning is needed.
 *
 * ESM / NodeNext — imports use explicit `.js` extensions. No network.
 */

import { mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import type { BudgetGuard, SourceName } from '../types.js';

/** Deterministic per-request OpenAlex prices in USD (design §5.1). */
export const OPENALEX_COST = {
  singleton: 0,
  list: 0.0001,
  filter: 0.0001,
  search: 0.001,
  semantic: 0.01,
  content: 0.01,
  text: 0.01,
} as const;

/** Daily caps + hard-stop fraction, per metered source. */
export interface SourceBudget {
  /** unit tracked (USD for OpenAlex; 'tokens' kept for any future metered source) — informational */
  unit: 'usd' | 'tokens';
  /** full daily budget */
  daily: number;
}

/**
 * Metered sources only; absent ⇒ unmetered (charge/guard are no-ops). CORE is
 * deliberately NOT here — see the module docstring; it has no confirmed daily
 * cap, only a short rate-limit window handled by `limits/rateLimiter.ts`.
 */
export const BUDGETS: Partial<Record<SourceName, SourceBudget>> = {
  openalex: { unit: 'usd', daily: 1.0 },
};

/** The hard-stop line: stop BEFORE crossing 95% of the daily budget. */
export const HARD_STOP_FRACTION = 0.95;

/** One source's persisted counter. */
interface Counter {
  /** ISO timestamp of the UTC-midnight window this `spent` belongs to */
  windowStart: string;
  /** cumulative spend within the active window */
  spent: number;
}

/** On-disk shape of `usage.json`. */
interface UsageFile {
  /** schema marker for forward-compat */
  version: 1;
  counters: Partial<Record<SourceName, Counter>>;
}

export interface BudgetOptions {
  /**
   * Corpus dir whose `usage.json` we persist to. Defaults to `<repoRoot>/data/corpus`
   * resolved relative to this module (`src/limits` → up to repo root).
   */
  corpusDir?: string;
  /** Explicit usage-file path; overrides `corpusDir`. */
  usagePath?: string;
  /** Injectable clock for deterministic tests; default `Date.now`. */
  now?: () => number;
  /**
   * Per-instance overrides merged over the module-level {@link BUDGETS}
   * (e.g. the nao UI's `IngestLimits.openalexDailyUsd`, applied by `run.ts`
   * when `opts.controlFromR2` is set). A `daily` override still uses the
   * SAME `HARD_STOP_FRACTION` — only the ceiling moves, not the safety margin.
   */
  budgetOverrides?: Partial<Record<SourceName, SourceBudget>>;
}

/** Default corpus dir: `<repoRoot>/data/corpus` (design §6). */
function defaultCorpusDir(): string {
  // src/limits/budget.ts → ../../../../data/corpus is the repo root's data dir.
  // tools/brain-ingest/src/limits → up 3 = tools/brain-ingest, up 4 = tools,
  // up 5 = repo root. The design path comment uses `../../data/corpus` relative
  // to tools/brain-ingest, i.e. <repoRoot>/data/corpus.
  const here = dirname(fileURLToPath(import.meta.url)); // .../src/limits
  const toolRoot = resolve(here, '..', '..'); // .../tools/brain-ingest
  return resolve(toolRoot, '..', '..', 'data', 'corpus'); // <repoRoot>/data/corpus
}

/** UTC-midnight ISO string for the day containing `ms`. */
function utcMidnightIso(ms: number): string {
  const d = new Date(ms);
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0),
  ).toISOString();
}

/**
 * File-backed {@link BudgetGuard}. Counters are read at construction and
 * rewritten on every charge. A missing file starts clean; malformed or
 * unreadable accounting fails closed. Writes are atomic (temp file + rename)
 * so a crash mid-write cannot leave a half-written usage file.
 */
export class FileBudgetGuard implements BudgetGuard {
  private readonly usagePath: string;
  private readonly now: () => number;
  private readonly budgetOverrides: Partial<Record<SourceName, SourceBudget>>;
  private counters: Partial<Record<SourceName, Counter>>;

  constructor(opts: BudgetOptions = {}) {
    this.now = opts.now ?? Date.now;
    this.usagePath =
      opts.usagePath ?? resolve(opts.corpusDir ?? defaultCorpusDir(), 'usage.json');
    this.budgetOverrides = opts.budgetOverrides ?? {};
    this.counters = this.load();
  }

  /** The effective budget for `source`: an instance override, else the module default. */
  private budgetFor(source: SourceName): SourceBudget | undefined {
    return this.budgetOverrides[source] ?? BUDGETS[source];
  }

  /** Re-read counters from disk (crash-safe startup). */
  private load(): Partial<Record<SourceName, Counter>> {
    try {
      const raw = readFileSync(this.usagePath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<UsageFile> | null;
      if (
        parsed === null ||
        typeof parsed !== 'object' ||
        parsed.version !== 1 ||
        parsed.counters === null ||
        typeof parsed.counters !== 'object' ||
        Array.isArray(parsed.counters)
      ) {
        throw new Error('unsupported or malformed usage ledger');
      }
      for (const [source, counter] of Object.entries(parsed.counters)) {
        const c = counter as Partial<Counter> | null;
        if (
          source.length === 0 ||
          c === null ||
          typeof c !== 'object' ||
          typeof c.windowStart !== 'string' ||
          Number.isNaN(Date.parse(c.windowStart)) ||
          typeof c.spent !== 'number' ||
          !Number.isFinite(c.spent) ||
          c.spent < 0
        ) {
          throw new Error(`malformed usage counter '${source}'`);
        }
      }
      return parsed.counters;
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        return {};
      }
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(
        `budget: cannot load existing usage ledger '${this.usagePath}': ${detail}. ` +
          'Refusing to reset spend; repair or explicitly replace the ledger.',
        { cause: error },
      );
    }
  }

  /**
   * A10: merge a fresh disk read into memory. Per source, the counter from
   * the NEWER UTC window wins (ISO `windowStart` strings order
   * lexicographically); within the same window, max(spent) — each process
   * persists after every charge, so the larger total supersets the smaller
   * and max sums both writers without double-counting. Counters for sources
   * this instance doesn't meter are carried through untouched (another
   * process may meter them via `budgetOverrides`).
   */
  private mergeFromDisk(): void {
    const disk = this.load();
    const sources = new Set([
      ...(Object.keys(this.counters) as SourceName[]),
      ...(Object.keys(disk) as SourceName[]),
    ]);
    for (const source of sources) {
      const mine = this.counters[source];
      const theirs = disk[source];
      if (mine === undefined || theirs === undefined) {
        this.counters[source] = mine ?? theirs;
      } else if (mine.windowStart === theirs.windowStart) {
        this.counters[source] = {
          windowStart: mine.windowStart,
          spent: Math.max(mine.spent, theirs.spent),
        };
      } else {
        this.counters[source] = mine.windowStart > theirs.windowStart ? mine : theirs;
      }
    }
  }

  /**
   * A11: drop counters whose window is not the CURRENT UTC day (in place).
   * A past-window counter is dead by definition — `currentCounter` would
   * reset it on next use — so persisting only live windows keeps usage.json
   * to exactly the sources spending today.
   */
  private pruneStaleWindows(): void {
    const today = utcMidnightIso(this.now());
    for (const source of Object.keys(this.counters) as SourceName[]) {
      if (this.counters[source]?.windowStart !== today) delete this.counters[source];
    }
  }

  /** Atomic write: temp file + rename. */
  private persist(): void {
    const dir = dirname(this.usagePath);
    mkdirSync(dir, { recursive: true });
    const payload: UsageFile = { version: 1, counters: this.counters };
    const tmp = `${this.usagePath}.tmp`;
    writeFileSync(tmp, JSON.stringify(payload, null, 2), 'utf8');
    renameSync(tmp, this.usagePath);
  }

  /**
   * Return the live counter for `source`, resetting it (in memory) when the
   * stored window is from a previous UTC day. Returns `undefined` for
   * unmetered sources.
   */
  private currentCounter(source: SourceName): Counter | undefined {
    if (this.budgetFor(source) === undefined) return undefined;
    const todayWindow = utcMidnightIso(this.now());
    const existing = this.counters[source];
    if (existing === undefined || existing.windowStart !== todayWindow) {
      const fresh: Counter = { windowStart: todayWindow, spent: 0 };
      this.counters[source] = fresh;
      return fresh;
    }
    return existing;
  }

  spent(source: SourceName): number {
    const counter = this.currentCounter(source);
    return counter?.spent ?? 0;
  }

  wouldExceed95(source: SourceName, cost: number): boolean {
    const budget = this.budgetFor(source);
    if (budget === undefined) return false; // unmetered → never blocks
    const hardStop = budget.daily * HARD_STOP_FRACTION;
    const projected = this.spent(source) + cost;
    // "Cross the 95% line" — stop BEFORE crossing, i.e. refuse when the
    // projected total would land at or beyond the hard-stop line.
    return projected >= hardStop;
  }

  charge(source: SourceName, cost: number): void {
    const budget = this.budgetFor(source);
    if (budget === undefined) return; // unmetered → no-op (NCBI etc.)
    // A10: merge the on-disk counters BEFORE the gate, so the hard stop
    // fires on the combined spend of every concurrent process.
    this.mergeFromDisk();
    if (this.wouldExceed95(source, cost)) {
      throw new Error(
        `budget: charging ${cost} to '${source}' would cross the 95% hard stop ` +
          `(${(budget.daily * HARD_STOP_FRACTION).toFixed(4)} ${budget.unit}; ` +
          `already spent ${this.spent(source)}). Call denied — leave work as 'discovered'.`,
      );
    }
    const counter = this.currentCounter(source)!; // metered ⇒ defined
    counter.spent += cost;
    this.pruneStaleWindows(); // A11: persist only live-window counters
    this.persist();
  }
}

/** Factory mirroring the rate-limiter style. */
export function createBudgetGuard(opts: BudgetOptions = {}): BudgetGuard {
  return new FileBudgetGuard(opts);
}
