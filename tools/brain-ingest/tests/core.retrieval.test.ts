/**
 * CORE v3 retrieval adapter tests (design §2, §3 step 5a, §5.1, §10.5).
 *
 * NO network: the adapter is driven through a fake SourceCtx whose fetch helpers
 * return the canned fixtures in tests/fixtures/. Proves:
 *  - pure selection prefers an exact DOI match and rejects short/empty fullText;
 *  - the preferred path returns method:'core' from pre-extracted fullText with
 *    exactly ONE token charged (no download request);
 *  - the fallback path downloads the PDF (method:'pdf') with TWO tokens charged;
 *  - a disabled source / missing key / unlookupable record returns null cleanly;
 *  - the 95% budget hard stop refuses the call before dispatch (no fetch made).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  retrieve,
  selectCoreWork,
  hasUsableFullText,
  coreDownloadPath,
  coreOutputId,
  normalizeDoi,
  buildSearchQuery,
  fulltextOutcome,
  pdfOutcome,
  CORE_TOKENS_PER_REQUEST,
  type CoreSearchResponse,
} from '../src/retrieval/core.js';
import type {
  PaperRecord,
  SourceCtx,
  SourceName,
  Config,
  FetchOptions,
  Identifiers,
} from '../src/types.js';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

function loadFixture(name: string): CoreSearchResponse {
  return JSON.parse(readFileSync(join(FIXTURES, name), 'utf8')) as CoreSearchResponse;
}

const FULLTEXT = loadFixture('core-search-fulltext.json');
const NOFULLTEXT = loadFixture('core-search-nofulltext.json');
const EMPTY = loadFixture('core-search-empty.json');

// ─────────────────────────────────────────────────────────────────────────────
// Test doubles
// ─────────────────────────────────────────────────────────────────────────────

function makeConfig(opts: { coreKey?: string; coreEnabled?: boolean } = {}): Config {
  const coreKey = opts.coreKey ?? 'CORE_TEST_KEY';
  const coreEnabled = opts.coreEnabled ?? true;
  const enabled = {
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
    core: coreEnabled,
  } satisfies Record<SourceName, boolean>;
  return {
    contactEmail: 'test@example.com',
    keys: {
      openalex: 'OA',
      r2Endpoint: 'https://r2',
      r2AccessKeyId: 'id',
      r2SecretAccessKey: 'secret',
      r2Bucket: 'bucket',
      core: opts.coreKey === '' ? undefined : coreKey,
    },
    enabled,
  };
}

interface FetchLog {
  jsonUrls: string[];
  byteUrls: string[];
  lastJsonOpts?: FetchOptions;
}

/** A fake ctx that serves a canned search response and a canned PDF, logging calls. */
function makeCtx(opts: {
  config?: Config;
  searchResponse?: CoreSearchResponse;
  pdfBytes?: Uint8Array;
  budgetSpent?: number; // pre-existing CORE token spend (out of 1000)
  searchThrows?: boolean;
  bytesThrows?: boolean;
}): { ctx: SourceCtx; log: FetchLog; spentRef: () => number } {
  const config = opts.config ?? makeConfig();
  const log: FetchLog = { jsonUrls: [], byteUrls: [] };
  let spent = opts.budgetSpent ?? 0;
  const HARD_STOP = 950;

  const budget = {
    wouldExceed95(_source: SourceName, cost: number): boolean {
      return spent + cost >= HARD_STOP;
    },
    charge(_source: SourceName, cost: number): void {
      if (spent + cost >= HARD_STOP) throw new Error('95% hard stop');
      spent += cost;
    },
    spent(_source: SourceName): number {
      return spent;
    },
  };

  const ctx: SourceCtx = {
    config,
    limiter: { schedule: <T,>(_s: SourceName, fn: () => Promise<T>) => fn() },
    budget,
    async fetchJson<T>(_s: SourceName, url: string, o?: FetchOptions): Promise<T> {
      log.jsonUrls.push(url);
      log.lastJsonOpts = o;
      if (opts.searchThrows) throw new Error('network');
      return (opts.searchResponse ?? EMPTY) as T;
    },
    async fetchText(): Promise<string> {
      throw new Error('fetchText not expected');
    },
    async fetchBytes(_s: SourceName, url: string): Promise<Uint8Array> {
      log.byteUrls.push(url);
      if (opts.bytesThrows) throw new Error('network');
      return opts.pdfBytes ?? new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF
    },
  };
  return { ctx, log, spentRef: () => spent };
}

function makeRecord(identifiers: Identifiers, title = 'A paper'): PaperRecord {
  return {
    paperUid: identifiers.doi ? `doi:${normalizeDoi(identifiers.doi)}` : 'corpus:01TEST',
    identifiers,
    title,
    authors: ['Doe J'],
    year: 2022,
    venue: null,
    abstract: null,
    discoveredVia: 'crossref',
    topicTags: ['gut_microbiome'],
    oa: { isOa: true, status: 'gold', bestOaUrl: null, license: 'cc-by', version: 'published' },
    retrievability: 'pdf',
    storage: { kind: 'none' },
    fullText: { extracted: false, method: null, charCount: null },
    status: 'discovered',
    errors: [],
    fetchedAt: null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure logic
// ─────────────────────────────────────────────────────────────────────────────

test('normalizeDoi strips prefixes and lowercases', () => {
  assert.equal(normalizeDoi('https://doi.org/10.1/AbC'), '10.1/abc');
  assert.equal(normalizeDoi('doi:10.1/x'), '10.1/x');
  assert.equal(normalizeDoi('  10.1/Y  '), '10.1/y');
  assert.equal(normalizeDoi(undefined), null);
  assert.equal(normalizeDoi(''), null);
});

test('selectCoreWork prefers exact DOI match', () => {
  const rec = makeRecord({ doi: '10.1371/journal.pone.0123456' });
  const w = selectCoreWork(FULLTEXT, rec);
  assert.ok(w);
  assert.equal(normalizeDoi(w.doi), '10.1371/journal.pone.0123456');
  assert.equal(hasUsableFullText(w), true);
});

test('selectCoreWork falls back to first usable result when no DOI match', () => {
  // Record DOI is absent → no exact match; first result has a downloadable id.
  const rec = makeRecord({ pmid: '99' }, 'Oral rehydration');
  const w = selectCoreWork(NOFULLTEXT, rec);
  assert.ok(w);
  assert.equal(coreOutputId(w), '987654321');
});

test('selectCoreWork returns null on empty results', () => {
  assert.equal(selectCoreWork(EMPTY, makeRecord({ doi: '10.1/x' })), null);
});

test('hasUsableFullText rejects short / null / whitespace fullText', () => {
  assert.equal(hasUsableFullText({ fullText: 'short stub' }), false);
  assert.equal(hasUsableFullText({ fullText: null }), false);
  assert.equal(hasUsableFullText({ fullText: '   ' }), false);
  assert.equal(hasUsableFullText({ fullText: 'x'.repeat(200) }), true);
});

test('coreDownloadPath builds the /outputs/{id}/download route', () => {
  assert.equal(
    coreDownloadPath({ id: 42 }),
    'https://api.core.ac.uk/v3/outputs/42/download',
  );
  assert.equal(coreDownloadPath({ id: '' }), null);
  assert.equal(coreDownloadPath({}), null);
});

test('buildSearchQuery prefers DOI, else title, else empty', () => {
  assert.equal(buildSearchQuery(makeRecord({ doi: '10.1/x' })), 'doi:"10.1/x"');
  assert.equal(buildSearchQuery(makeRecord({}, 'My Title')), 'title:"My Title"');
  assert.equal(buildSearchQuery(makeRecord({}, '   ')), '');
});

test('fulltextOutcome maps to method:core under text/<uid>.txt', () => {
  const out = fulltextOutcome('doi:10.1/x', 'hello world');
  assert.equal(out.fullText.method, 'core');
  assert.equal(out.fullText.extracted, true);
  assert.equal(out.fullText.charCount, 11);
  assert.equal(out.storage.kind, 'object');
  assert.equal(out.storage.key, 'text/doi:10.1/x.txt');
});

test('pdfOutcome maps to method:pdf under pdf/<uid>.pdf, text not yet extracted', () => {
  const out = pdfOutcome('doi:10.1/x', new Uint8Array([1, 2, 3]));
  assert.equal(out.fullText.method, 'pdf');
  assert.equal(out.fullText.extracted, false);
  assert.equal(out.fullText.charCount, null);
  assert.equal(out.storage.key, 'pdf/doi:10.1/x.pdf');
  assert.equal(out.storage.sizeBytes, 3);
  assert.equal(out.storage.contentType, 'application/pdf');
});

// ─────────────────────────────────────────────────────────────────────────────
// Full adapter (fake ctx, no network)
// ─────────────────────────────────────────────────────────────────────────────

test('preferred path: returns fullText (method:core) charging exactly one token', async () => {
  const rec = makeRecord({ doi: '10.1371/journal.pone.0123456' });
  const { ctx, log, spentRef } = makeCtx({ searchResponse: FULLTEXT });

  const result = await retrieve(ctx, rec);
  assert.ok(result);
  assert.equal(result.fullText.method, 'core');
  assert.equal(result.fullText.extracted, true);
  assert.ok((result.fullText.charCount ?? 0) > 200);
  assert.equal(result.storage.kind, 'object');
  assert.equal(result.storage.key, `text/${rec.paperUid}.txt`);

  // Exactly one search request, NO download, one token charged.
  assert.equal(log.jsonUrls.length, 1);
  assert.match(log.jsonUrls[0]!, /\/v3\/search\/works$/);
  assert.equal(log.byteUrls.length, 0);
  assert.equal(spentRef(), CORE_TOKENS_PER_REQUEST);

  // Auth + query were passed through.
  assert.equal(log.lastJsonOpts?.headers?.['Authorization'], 'Bearer CORE_TEST_KEY');
  assert.equal(log.lastJsonOpts?.query?.['q'], 'doi:"10.1371/journal.pone.0123456"');
});

test('fallback path: no usable fullText → downloads PDF (method:pdf), two tokens', async () => {
  const rec = makeRecord({ doi: '10.1016/j.example.2022.07.014' }, 'Oral rehydration');
  const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
  const { ctx, log, spentRef } = makeCtx({ searchResponse: NOFULLTEXT, pdfBytes: pdf });

  const result = await retrieve(ctx, rec);
  assert.ok(result);
  assert.equal(result.fullText.method, 'pdf');
  assert.equal(result.fullText.extracted, false);
  assert.equal(result.storage.key, `pdf/${rec.paperUid}.pdf`);
  assert.equal(result.storage.sizeBytes, pdf.byteLength);

  // One search + one download = two tokens.
  assert.equal(log.jsonUrls.length, 1);
  assert.equal(log.byteUrls.length, 1);
  assert.match(log.byteUrls[0]!, /\/v3\/outputs\/987654321\/download$/);
  assert.equal(spentRef(), 2 * CORE_TOKENS_PER_REQUEST);
});

test('disabled source returns null without any call or charge', async () => {
  const rec = makeRecord({ doi: '10.1/x' });
  const { ctx, log, spentRef } = makeCtx({
    config: makeConfig({ coreEnabled: false }),
    searchResponse: FULLTEXT,
  });
  assert.equal(await retrieve(ctx, rec), null);
  assert.equal(log.jsonUrls.length, 0);
  assert.equal(spentRef(), 0);
});

test('missing CORE key returns null without any call', async () => {
  const rec = makeRecord({ doi: '10.1/x' });
  const { ctx, log } = makeCtx({
    config: makeConfig({ coreKey: '' }),
    searchResponse: FULLTEXT,
  });
  assert.equal(await retrieve(ctx, rec), null);
  assert.equal(log.jsonUrls.length, 0);
});

test('record with nothing to look up by returns null without a call', async () => {
  const rec = makeRecord({}, '   '); // no DOI, blank title
  const { ctx, log } = makeCtx({ searchResponse: FULLTEXT });
  assert.equal(await retrieve(ctx, rec), null);
  assert.equal(log.jsonUrls.length, 0);
});

test('empty search results returns null (one token already charged for the search)', async () => {
  const rec = makeRecord({ doi: '10.1/none' });
  const { ctx, log, spentRef } = makeCtx({ searchResponse: EMPTY });
  assert.equal(await retrieve(ctx, rec), null);
  assert.equal(log.jsonUrls.length, 1);
  assert.equal(log.byteUrls.length, 0);
  assert.equal(spentRef(), CORE_TOKENS_PER_REQUEST);
});

test('budget hard stop refuses the search before dispatch (no fetch)', async () => {
  const rec = makeRecord({ doi: '10.1371/journal.pone.0123456' });
  // Pre-spend 950 → at the hard stop; the next 1-token charge would cross it.
  const { ctx, log, spentRef } = makeCtx({ searchResponse: FULLTEXT, budgetSpent: 950 });
  assert.equal(await retrieve(ctx, rec), null);
  assert.equal(log.jsonUrls.length, 0); // never dispatched
  assert.equal(spentRef(), 950); // unchanged
});

test('budget allows the search but blocks the download fallback', async () => {
  const rec = makeRecord({ doi: '10.1016/j.example.2022.07.014' }, 'Oral rehydration');
  // 948 spent: search (→949) ok; download (→950) would cross → refused.
  const { ctx, log, spentRef } = makeCtx({ searchResponse: NOFULLTEXT, budgetSpent: 948 });
  const result = await retrieve(ctx, rec);
  assert.equal(result, null); // could not complete the PDF fallback
  assert.equal(log.jsonUrls.length, 1); // search happened
  assert.equal(log.byteUrls.length, 0); // download refused before dispatch
  assert.equal(spentRef(), 949); // only the search token charged
});

test('a thrown search is swallowed → null', async () => {
  const rec = makeRecord({ doi: '10.1/x' });
  const { ctx } = makeCtx({ searchThrows: true });
  assert.equal(await retrieve(ctx, rec), null);
});
