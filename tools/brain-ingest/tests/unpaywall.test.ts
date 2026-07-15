/**
 * Unpaywall OA-adapter tests (design §3 step 3, §5.1, §10.4) — node:test via tsx.
 *
 * NO network: a stub SourceCtx serves canned fixtures from tests/fixtures/.
 * Proves:
 *  - the pure mapper turns gold/green/closed responses into the right OaInfo;
 *  - resolveOa keys results by paperUid, builds the v2 URL with a normalized DOI,
 *    injects the polite-pool email, routes through the limiter, and charges $0;
 *  - records without a DOI are skipped;
 *  - a lookup that throws (404/transient) is skipped, not fatal to the batch.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { resolveOa, toOaInfo } from '../src/sources/oa/unpaywall.js';
import type {
  Config,
  FetchOptions,
  OaInfo,
  PaperRecord,
  RateLimiter,
  BudgetGuard,
  SourceCtx,
  SourceName,
} from '../src/types.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, 'fixtures');

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(join(FIXTURES, name), 'utf8'));
}

// ── stubs ────────────────────────────────────────────────────────────────────

/** Pass-through limiter: runs the fn immediately, recording which source was used. */
class RecordingLimiter implements RateLimiter {
  readonly sources: SourceName[] = [];
  async schedule<T>(source: SourceName, fn: () => Promise<T>): Promise<T> {
    this.sources.push(source);
    return fn();
  }
}

/** Budget guard that records charges; never blocks (Unpaywall is free). */
class RecordingBudget implements BudgetGuard {
  readonly charges: Array<{ source: SourceName; cost: number }> = [];
  readonly checks: Array<{ source: SourceName; cost: number }> = [];
  wouldExceed95(source: SourceName, cost: number): boolean {
    this.checks.push({ source, cost });
    return false;
  }
  charge(source: SourceName, cost: number): void {
    this.charges.push({ source, cost });
  }
  spent(): number {
    return 0;
  }
}

const CONFIG: Config = {
  contactEmail: 'jayden@airap.com.sg',
  keys: {
    openalex: 'oa-key',
    r2Endpoint: 'https://r2.example.com',
    r2AccessKeyId: 'id',
    r2SecretAccessKey: 'secret',
    r2Bucket: 'ourobion-corpus',
  },
  enabled: {
    crossref: true,
    pubmed: false,
    europepmc: true,
    arxiv: true,
    s2: false,
    doaj: true,
    biorxiv: true,
    lens: false,
    openalex: true,
    unpaywall: true,
    pmc: true,
    directOa: true,
    core: false,
  },
};

interface FetchCall {
  source: SourceName;
  url: string;
  opts?: FetchOptions;
}

/**
 * Build a stub SourceCtx whose fetchJson returns a fixture chosen by the request
 * URL (via `route`), records every call, and can be told to throw for a URL.
 */
function makeCtx(
  route: (url: string) => unknown,
): {
  ctx: SourceCtx;
  calls: FetchCall[];
  limiter: RecordingLimiter;
  budget: RecordingBudget;
} {
  const calls: FetchCall[] = [];
  const limiter = new RecordingLimiter();
  const budget = new RecordingBudget();

  const fetchJson = async <T>(
    source: SourceName,
    url: string,
    opts?: FetchOptions,
  ): Promise<T> => {
    calls.push({ source, url, opts });
    return limiter.schedule(source, async () => route(url) as T);
  };

  const ctx: SourceCtx = {
    config: CONFIG,
    limiter,
    budget,
    fetchJson,
    fetchText: async () => {
      throw new Error('fetchText not used by unpaywall adapter');
    },
    fetchBytes: async () => {
      throw new Error('fetchBytes not used by unpaywall adapter');
    },
  };
  return { ctx, calls, limiter, budget };
}

function makeRecord(uid: string, doi?: string): PaperRecord {
  return {
    paperUid: uid,
    identifiers: doi ? { doi } : {},
    title: 't',
    authors: [],
    year: null,
    venue: null,
    abstract: null,
    discoveredVia: 'test',
    topicTags: [],
    oa: { isOa: false, status: 'unknown', bestOaUrl: null, license: null, version: null },
    retrievability: 'unknown',
    storage: { kind: 'none' },
    fullText: { extracted: false, method: null, charCount: null },
    status: 'discovered',
    errors: [],
    fetchedAt: null,
  };
}

// ── pure mapper ────────────────────────────────────────────────────────────────

test('toOaInfo: gold OA → published cc-by with the PDF url', () => {
  const info = toOaInfo(loadFixture('unpaywall-gold.json') as never);
  const expected: OaInfo = {
    isOa: true,
    status: 'gold',
    bestOaUrl:
      'https://journals.plos.org/plosone/article/file?id=10.1371/journal.pone.0000000&type=printable',
    license: 'cc-by',
    version: 'published',
  };
  assert.deepEqual(info, expected);
});

test('toOaInfo: green OA → accepted, null license, repository PDF', () => {
  const info = toOaInfo(loadFixture('unpaywall-green.json') as never);
  assert.equal(info.isOa, true);
  assert.equal(info.status, 'green');
  assert.equal(info.version, 'accepted');
  assert.equal(info.license, null);
  assert.equal(info.bestOaUrl, 'https://repository.example.edu/bitstream/12345/accepted.pdf');
});

test('toOaInfo: closed → not OA, no url/license/version', () => {
  const info = toOaInfo(loadFixture('unpaywall-closed.json') as never);
  assert.deepEqual(info, {
    isOa: false,
    status: 'closed',
    bestOaUrl: null,
    license: null,
    version: null,
  });
});

test('toOaInfo: cc-by-nc variants collapse to cc-by-nc', () => {
  const info = toOaInfo({
    is_oa: true,
    oa_status: 'hybrid',
    best_oa_location: { url: 'https://x/y', license: 'cc-by-nc-nd', version: 'publishedVersion' },
  });
  assert.equal(info.license, 'cc-by-nc');
  assert.equal(info.status, 'hybrid');
});

// ── resolveOa flow ──────────────────────────────────────────────────────────────

test('resolveOa: builds v2 URL with normalized DOI + email, charges $0, keys by uid', async () => {
  const { ctx, calls, limiter, budget } = makeCtx(() => loadFixture('unpaywall-gold.json'));
  // DOI given with scheme prefix + uppercase → must normalize to bare lowercase.
  const rec = makeRecord('doi:10.1371/journal.pone.0000000', 'https://doi.org/10.1371/JOURNAL.pone.0000000');

  const result = await resolveOa(ctx, [rec]);

  assert.equal(result.size, 1);
  assert.equal(result.get('doi:10.1371/journal.pone.0000000')?.status, 'gold');

  assert.equal(calls.length, 1);
  const call = calls[0]!;
  assert.equal(call.source, 'unpaywall');
  assert.equal(
    call.url,
    'https://api.unpaywall.org/v2/10.1371%2Fjournal.pone.0000000',
  );
  assert.equal(call.opts?.query?.email, 'jayden@airap.com.sg');

  // Routed through the limiter under the 'unpaywall' bucket.
  assert.deepEqual(limiter.sources, ['unpaywall']);
  // Guard consulted, then charged $0.
  assert.equal(budget.checks.length, 1);
  assert.deepEqual(budget.charges, [{ source: 'unpaywall', cost: 0 }]);
});

test('resolveOa: records without a DOI are skipped (no call)', async () => {
  const { ctx, calls } = makeCtx(() => loadFixture('unpaywall-gold.json'));
  const result = await resolveOa(ctx, [makeRecord('corpus:01ABC', undefined)]);
  assert.equal(result.size, 0);
  assert.equal(calls.length, 0);
});

test('resolveOa: a throwing lookup is skipped, others still resolve', async () => {
  const bad = '10.9999/missing';
  const good = '10.1371/journal.pone.0000000';
  const { ctx } = makeCtx((url) => {
    if (url.includes(encodeURIComponent(bad))) throw new Error('404 not in unpaywall');
    return loadFixture('unpaywall-gold.json');
  });

  const result = await resolveOa(ctx, [
    makeRecord('doi:' + bad, bad),
    makeRecord('doi:' + good, good),
  ]);

  // Bad DOI absent; good DOI resolved.
  assert.equal(result.has('doi:' + bad), false);
  assert.equal(result.get('doi:' + good)?.isOa, true);
});

test('resolveOa: each DOI is one v2 GET (per-DOI fallback, not batched)', async () => {
  const { ctx, calls } = makeCtx(() => loadFixture('unpaywall-green.json'));
  await resolveOa(ctx, [
    makeRecord('doi:10.1/a', '10.1/a'),
    makeRecord('doi:10.2/b', '10.2/b'),
  ]);
  assert.equal(calls.length, 2);
  assert.equal(calls[0]!.url, 'https://api.unpaywall.org/v2/10.1%2Fa');
  assert.equal(calls[1]!.url, 'https://api.unpaywall.org/v2/10.2%2Fb');
});
