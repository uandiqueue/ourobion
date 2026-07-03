/**
 * NCBI ID Converter crosswalk enrichment tests (design §3, §4) — node:test, via tsx.
 *
 * NO network: globalThis.fetch is stubbed (the adapter does its own status-aware
 * GET through the limiter so it can read 429/5xx and back off). The stub serves the
 * canned fixture, filtered by the ids the adapter actually asks for. Only PMIDs and
 * PMCIDs are ever queried — DOIs are excluded (a preprint DOI 400s the whole batch).
 * Proves:
 *  - a doi+pmid record gets its PMCID gap-filled (the PMID is the query id);
 *  - a pmcid-only record (same paper) gets its DOI/PMID filled — both now share ids;
 *  - per-record errors (status:"error"/errmsg) are skipped;
 *  - existing non-null ids are never overwritten;
 *  - a record with no crosswalk hit is left untouched;
 *  - a 429 then a 200 retries with backoff (base 0 → instant) and still enriches;
 *  - a batch that 429s every attempt is swallowed (best-effort, never throws).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  enrichWithIdConverter,
  collectQueryIds,
  recordToIdentifiers,
  IDCONV_BATCH_SIZE,
  IDCONV_MAX_ATTEMPTS,
} from '../src/sources/idconv.js';
import type { Config, PaperRecord, SourceCtx, SourceName } from '../src/types.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = JSON.parse(readFileSync(join(HERE, 'fixtures', 'idconv.json'), 'utf8')) as {
  records: Array<Record<string, unknown>>;
};

function makeConfig(ncbi?: string): Config {
  return {
    contactEmail: 'test@ourobion.dev',
    keys: {
      openalex: 'oa',
      r2Endpoint: 'https://r2.example',
      r2AccessKeyId: 'id',
      r2SecretAccessKey: 'secret',
      r2Bucket: 'bucket',
      ncbi,
    },
    enabled: {
      crossref: true,
      pubmed: true,
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
}

const noopBudget: SourceCtx['budget'] = {
  wouldExceed95: () => false,
  charge: () => {},
  spent: () => 0,
};

/** A SourceCtx whose limiter is a pass-through; fetch helpers must not be hit. */
function makeCtx(config?: Config): SourceCtx {
  return {
    config: config ?? makeConfig(),
    limiter: { schedule: async <T>(_s: SourceName, fn: () => Promise<T>): Promise<T> => fn() },
    budget: noopBudget,
    fetchJson: async (): Promise<never> => {
      throw new Error('idconv must use its own status-aware fetch, not ctx.fetchJson');
    },
    fetchText: async (): Promise<string> => {
      throw new Error('fetchText must not be called by idconv');
    },
    fetchBytes: async (): Promise<Uint8Array> => {
      throw new Error('fetchBytes must not be called by idconv');
    },
  };
}

/** The fixture records whose own id (doi/pmid/pmcid) was requested in this `ids=`. */
function fixtureFor(idsParam: string): Array<Record<string, unknown>> {
  const want = new Set(idsParam.split(',').filter(Boolean).map((s) => s.toLowerCase()));
  return FIXTURE.records.filter((r) =>
    ['doi', 'pmid', 'pmcid'].some(
      (k) => typeof r[k] === 'string' && want.has(String(r[k]).toLowerCase()),
    ),
  );
}

interface FetchStub {
  calls: string[];
  restore: () => void;
}

/**
 * Install a globalThis.fetch stub. `statuses` is a per-call status queue (defaults
 * to 200 once empty); a 200 returns the matching fixture crosswalk, a non-200
 * returns a body-less error Response (with optional `retryAfter` seconds header).
 * `throwNetwork` makes the first call reject at the network level.
 */
function stubFetch(
  opts: { statuses?: number[]; retryAfter?: number; throwNetwork?: boolean } = {},
): FetchStub {
  const calls: string[] = [];
  const queue = [...(opts.statuses ?? [])];
  const real = globalThis.fetch;
  let first = true;
  globalThis.fetch = (async (input: unknown): Promise<Response> => {
    const url = String(input);
    calls.push(url);
    if (opts.throwNetwork && first) {
      first = false;
      throw new TypeError('network down');
    }
    const status = queue.shift() ?? 200;
    const headers = new Headers();
    if (status === 429 && opts.retryAfter !== undefined) {
      headers.set('retry-after', String(opts.retryAfter));
    }
    if (status !== 200) {
      return new Response(null, { status, statusText: `status ${status}`, headers });
    }
    const ids = new URL(url).searchParams.get('ids') ?? '';
    return new Response(JSON.stringify({ status: 'ok', records: fixtureFor(ids) }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof globalThis.fetch;
  return { calls, restore: () => { globalThis.fetch = real; } };
}

/** Parse the `ids`/query params back out of a recorded request URL. */
function queryOf(url: string): URLSearchParams {
  return new URL(url).searchParams;
}

function makeRecord(uid: string, identifiers: PaperRecord['identifiers']): PaperRecord {
  return {
    paperUid: uid,
    identifiers,
    title: uid,
    authors: [],
    year: 2026,
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

// ── pure helpers ──────────────────────────────────────────────────────────────

test('collectQueryIds: distinct, normalized pmid+pmcid only (DOIs excluded — they 400 the batch)', () => {
  const ids = collectQueryIds([
    makeRecord('a', { doi: 'https://doi.org/10.3390/S26041325', pmid: '41755264' }),
    makeRecord('b', { pmcid: 'pmc12944331' }),
    makeRecord('c', { doi: '10.3390/s26041325' }), // doi-only → contributes NOTHING
  ]);
  // No DOI is ever sent to the converter; the doi-only record yields no query id.
  assert.deepEqual(ids.sort(), ['41755264', 'PMC12944331'].sort());
});

test('recordToIdentifiers: maps a good record, drops error records', () => {
  assert.deepEqual(
    recordToIdentifiers({ pmcid: 'PMC12944331', pmid: '41755264', doi: '10.3390/s26041325' }),
    { doi: '10.3390/s26041325', pmid: '41755264', pmcid: 'PMC12944331' },
  );
  assert.equal(recordToIdentifiers({ doi: '10.0/x', status: 'error', errmsg: 'bad' }), null);
  assert.equal(recordToIdentifiers({}), null);
});

// ── enrichWithIdConverter ───────────────────────────────────────────────────────

test('enrichWithIdConverter: a doi+pmid record gets its pmcid filled (pmid is the query id)', async () => {
  const fetchStub = stubFetch();
  // Real shape post-OA-location: OpenAlex supplied the DOI + PMID; idconv resolves
  // the PMID → PMCID. (The DOI itself is never sent — preprint DOIs 400 the batch.)
  const rec = makeRecord('doi:10.3390/s26041325', { doi: '10.3390/s26041325', pmid: '41755264' });
  try {
    await enrichWithIdConverter(makeCtx(), [rec], () => {}, 0);

    assert.equal(fetchStub.calls.length, 1);
    const u = new URL(fetchStub.calls[0]!);
    assert.equal(u.origin + u.pathname, 'https://www.ncbi.nlm.nih.gov/pmc/utils/idconv/v1.0/');
    assert.equal(u.searchParams.get('format'), 'json');
    assert.equal(u.searchParams.get('tool'), 'ourobion-brain-ingest');
    assert.equal(u.searchParams.get('email'), 'test@ourobion.dev');
    // The query carries the PMID, never the DOI.
    assert.equal(u.searchParams.get('ids'), '41755264');

    // The crosswalk filled the missing pmcid (existing doi + pmid unchanged).
    assert.equal(rec.identifiers.doi, '10.3390/s26041325');
    assert.equal(rec.identifiers.pmid, '41755264');
    assert.equal(rec.identifiers.pmcid, 'PMC12944331');
  } finally {
    fetchStub.restore();
  }
});

test('enrichWithIdConverter: a pmcid-only record (same paper) gets its doi/pmid filled', async () => {
  const fetchStub = stubFetch();
  const rec = makeRecord('pmcid:PMC12944331', { pmcid: 'PMC12944331' });
  try {
    await enrichWithIdConverter(makeCtx(), [rec], () => {}, 0);
    assert.equal(rec.identifiers.doi, '10.3390/s26041325');
    assert.equal(rec.identifiers.pmid, '41755264');
    assert.equal(rec.identifiers.pmcid, 'PMC12944331');
  } finally {
    fetchStub.restore();
  }
});

test('enrichWithIdConverter: passes api_key only when an NCBI key is configured', async () => {
  const fetchStub = stubFetch();
  try {
    await enrichWithIdConverter(
      makeCtx(makeConfig('ncbi-key-123')),
      [makeRecord('doi:10.3390/s26041325', { doi: '10.3390/s26041325', pmid: '41755264' })],
      () => {},
      0,
    );
    assert.equal(queryOf(fetchStub.calls[0]!).get('api_key'), 'ncbi-key-123');
  } finally {
    fetchStub.restore();
  }
});

test('enrichWithIdConverter: never overwrites an existing non-null id', async () => {
  const fetchStub = stubFetch();
  // Query by the real PMID. The crosswalk record carries doi 10.3390/s26041325, but
  // this record already has a (different) doi that must NOT be clobbered; the missing
  // pmcid IS gap-filled.
  const rec = makeRecord('doi:10.0000/stale', { doi: '10.0000/stale', pmid: '41755264' });
  try {
    await enrichWithIdConverter(makeCtx(), [rec], () => {}, 0);
    assert.equal(rec.identifiers.doi, '10.0000/stale', 'existing id wins on conflict');
    assert.equal(rec.identifiers.pmcid, 'PMC12944331', 'missing id still gap-filled');
  } finally {
    fetchStub.restore();
  }
});

test('enrichWithIdConverter: a record with no crosswalk hit is left untouched', async () => {
  const fetchStub = stubFetch();
  // A pmid not in the fixture → a call IS made, but the converter returns no match.
  const rec = makeRecord('doi:10.9/none', { doi: '10.9/none', pmid: '88888888' });
  try {
    await enrichWithIdConverter(makeCtx(), [rec], () => {}, 0);
    assert.equal(fetchStub.calls.length, 1, 'pmid was queried');
    assert.deepEqual(rec.identifiers, { doi: '10.9/none', pmid: '88888888' }, 'untouched — no hit');
  } finally {
    fetchStub.restore();
  }
});

test('enrichWithIdConverter: no ids → no call', async () => {
  const fetchStub = stubFetch();
  try {
    await enrichWithIdConverter(makeCtx(), [makeRecord('corpus:01X', {})], () => {}, 0);
    assert.equal(fetchStub.calls.length, 0);
  } finally {
    fetchStub.restore();
  }
});

test('enrichWithIdConverter: a 429 then a 200 retries with backoff and still enriches', async () => {
  // First attempt 429, second 200. Backoff base 0 → the retry is instant.
  const fetchStub = stubFetch({ statuses: [429], retryAfter: 0 });
  const rec = makeRecord('doi:10.3390/s26041325', { doi: '10.3390/s26041325', pmid: '41755264' });
  const logs: string[] = [];
  try {
    await enrichWithIdConverter(makeCtx(), [rec], (l) => logs.push(l), 0);
    // Two fetch attempts: the 429, then the successful retry.
    assert.equal(fetchStub.calls.length, 2);
    // The record was enriched from the retried response.
    assert.equal(rec.identifiers.pmid, '41755264');
    assert.equal(rec.identifiers.pmcid, 'PMC12944331');
    // No "batch failed" line — the batch ultimately succeeded.
    assert.ok(!logs.some((l) => l.includes('batch failed after retries')));
  } finally {
    fetchStub.restore();
  }
});

test('enrichWithIdConverter: a batch that 429s every attempt is swallowed (best-effort)', async () => {
  // 429 on every one of the IDCONV_MAX_ATTEMPTS attempts → batch skipped.
  const fetchStub = stubFetch({ statuses: Array(IDCONV_MAX_ATTEMPTS).fill(429) });
  const rec = makeRecord('doi:10.3390/s26041325', { doi: '10.3390/s26041325', pmid: '41755264' });
  const logs: string[] = [];
  try {
    await assert.doesNotReject(() => enrichWithIdConverter(makeCtx(), [rec], (l) => logs.push(l), 0));
    // Exactly IDCONV_MAX_ATTEMPTS attempts were made, all 429.
    assert.equal(fetchStub.calls.length, IDCONV_MAX_ATTEMPTS);
    // Identifiers unchanged; the give-up was logged with status 429.
    assert.deepEqual(rec.identifiers, { doi: '10.3390/s26041325', pmid: '41755264' });
    assert.ok(logs.some((l) => l.includes('batch failed after retries') && l.includes('429')));
  } finally {
    fetchStub.restore();
  }
});

test('enrichWithIdConverter: a network-level error is retried then (if persistent) skipped', async () => {
  // First call throws at network level, then a 200 succeeds → enriched after retry.
  const fetchStub = stubFetch({ throwNetwork: true });
  const rec = makeRecord('doi:10.3390/s26041325', { doi: '10.3390/s26041325', pmid: '41755264' });
  try {
    await enrichWithIdConverter(makeCtx(), [rec], () => {}, 0);
    assert.equal(fetchStub.calls.length, 2);
    assert.equal(rec.identifiers.pmcid, 'PMC12944331');
  } finally {
    fetchStub.restore();
  }
});

test('IDCONV_BATCH_SIZE is capped at 50 (rate-strict converter)', () => {
  assert.equal(IDCONV_BATCH_SIZE, 50);
});
