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
  idConvBatches,
  idConvTypeOf,
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

// ── #307 · homogeneous idconv batches ────────────────────────────────────────

test('idConvTypeOf classifies the three converter id shapes and rejects junk', () => {
  assert.equal(idConvTypeOf('PMC5334499'), 'pmcid');
  assert.equal(idConvTypeOf('pmc5334499'), 'pmcid');
  assert.equal(idConvTypeOf('29083192'), 'pmid');
  assert.equal(idConvTypeOf('10.1371/journal.pone.0341245'), 'doi');
  // Unsendable values must be rejected rather than allowed to poison a batch.
  for (const junk of ['', '   ', 'not-an-id', 'doi:garbage', '10.no-slash']) {
    assert.equal(idConvTypeOf(junk), null, `${JSON.stringify(junk)} must not be sent`);
  }
});

test('#307: every idconv batch is HOMOGENEOUS by id type — a mixed batch is a hard 400', () => {
  // Measured against the live endpoint before writing this:
  //   ids=<pmid>,<pmid>   -> 200 ok, idtype=pmid
  //   ids=<pmcid>,<pmcid> -> 200 ok, idtype=pmcid
  //   ids=<pmid>,<pmcid>  -> 400 Bad Request   <- the mix actually being sent
  // collectQueryIds already excludes DOIs, so DOIs were never the cause; it collects PMIDs AND
  // PMCIDs into one list, and chunking that produced two-type batches. 400 is not transient, so
  // retries cannot save one — 138 of 138 batches failed and 0 papers were fetched.
  const ids = [
    '10.1371/journal.pone.0341245',
    'PMC5334499',
    '29083192',
    '10.3390/nu18091412',
    'PMC1234567',
    'not-an-id',
  ];
  const batches = idConvBatches(ids);
  assert.ok(batches.length > 0);
  for (const batch of batches) {
    const types = new Set(batch.map((id) => idConvTypeOf(id)));
    assert.equal(types.size, 1, `batch mixes id types: ${JSON.stringify(batch)}`);
    assert.ok(!types.has(null), 'no unsendable id may reach a batch');
  }
  // Nothing sendable is lost, and the junk id is dropped.
  const flat = batches.flat();
  assert.equal(flat.length, 5);
  assert.ok(!flat.includes('not-an-id'));
});

test('#307: idconv batches respect IDCONV_BATCH_SIZE within each id type', () => {
  // 120 dois + 60 pmids: chunked per type, never merged across types to fill a batch.
  const dois = Array.from({ length: 120 }, (_, i) => `10.1234/test.${i}`);
  const pmids = Array.from({ length: 60 }, (_, i) => `${1000000 + i}`);
  const batches = idConvBatches([...dois, ...pmids]);
  for (const b of batches) {
    assert.ok(b.length <= IDCONV_BATCH_SIZE, `batch of ${b.length} exceeds ${IDCONV_BATCH_SIZE}`);
    assert.equal(new Set(b.map((id) => idConvTypeOf(id))).size, 1);
  }
  assert.equal(batches.flat().length, 180, 'every id is still sent exactly once');
  // pmid partition emitted before doi partition, deterministically.
  assert.equal(idConvTypeOf(batches[0]![0]!), 'pmid');
});

// ── #307 · the converter emits `pmid` as a JSON number ───────────────────────

test('#307: recordToIdentifiers survives the unquoted numeric pmid the converter really sends', () => {
  // This is the VERBATIM live payload for ids=29083192,31142281 (idtype=pmid), captured
  // 2026-08-01. Note `"pmid":31142281` has no quotes while `doi`/`pmcid` do:
  //   {"doi":"10.1186/s12864-019-5764-4","pmcid":"PMC6542083","pmid":31142281,
  //    "requested-id":"31142281"}
  // identity.ts's normalizers guard only `== null` and then call .trim(), so a number
  // slipped through and threw `raw.trim is not a function` — which killed the whole
  // ingest run at the crosswalk stage, AFTER discovery had already succeeded.
  const ids = recordToIdentifiers({
    doi: '10.1186/s12864-019-5764-4',
    pmcid: 'PMC6542083',
    pmid: 31142281,
  });
  assert.deepEqual(ids, {
    doi: '10.1186/s12864-019-5764-4',
    pmid: '31142281',
    pmcid: 'PMC6542083',
  });
});

test('#307: a numeric pmid is COERCED, not dropped — the crosswalk still gap-fills', () => {
  // Regressing to a silent drop would be worse than the crash: the run would finish
  // "successfully" having linked nothing. Assert the id is actually carried through.
  const ids = recordToIdentifiers({ pmid: 29083192 });
  assert.equal(ids?.pmid, '29083192', 'a number-typed pmid must survive as its digits');

  // A per-record error still short-circuits ahead of any coercion.
  assert.equal(
    recordToIdentifiers({ pmid: 29083192, status: 'error', errmsg: 'Identifier not found in PMC' }),
    null,
  );
  // Non-finite / empty values yield nothing rather than the string "NaN".
  assert.equal(recordToIdentifiers({ pmid: Number.NaN }), null);
  assert.equal(recordToIdentifiers({ pmid: '   ' }), null);
});
