/**
 * OpenAlex bulk OA-location adapter tests (design §5.1, §10.4) — node:test, via tsx.
 *
 * NO network: a fake SourceCtx serves the canned fixture, filtered by the DOIs
 * the adapter actually asks for (so we also prove the filter is constructed).
 * Proves:
 *  - pure mappers (status/version/license/doi-normalise) match the §8 vocab;
 *  - one batch of ≤50 DOIs → exactly one list call charged $0.0001 (§5.1);
 *  - >50 DOIs split into multiple batches (chunking);
 *  - each work maps to the right OaInfo, keyed by paperUid;
 *  - a DOI OpenAlex returns nothing for → explicit `unknown` OaInfo;
 *  - records without a DOI are skipped;
 *  - one DOI shared by two records fans out to both paperUids;
 *  - fail-closed: when the next charge would cross 95% the run stops cleanly,
 *    returning what it has and leaving the rest absent (never thrown/failed).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  resolveOa,
  mapOaStatus,
  mapVersion,
  mapLicense,
  mapWorkToOaInfo,
  mapWorkToMeta,
  extractWorkIds,
  normalizeDoi,
  chunk,
  OPENALEX_BATCH_SIZE,
  OPENALEX_LIST_COST,
} from '../src/sources/oa/openalex.js';
import type {
  Config,
  FetchOptions,
  OaInfo,
  WorkMeta,
  PaperRecord,
  Identifiers,
  SourceCtx,
  SourceName,
} from '../src/types.js';

// ─────────────────────────────────────────────────────────────────────────────
// Fixture
// ─────────────────────────────────────────────────────────────────────────────

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = JSON.parse(
  readFileSync(join(HERE, 'fixtures', 'openalex-works.json'), 'utf8'),
) as { results: Array<{ doi: string; [k: string]: unknown }> };

// ─────────────────────────────────────────────────────────────────────────────
// Test doubles
// ─────────────────────────────────────────────────────────────────────────────

function makeConfig(): Config {
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
    core: false,
  };
  return {
    contactEmail: 'test@ourobion.dev',
    keys: {
      openalex: 'test-openalex-key',
      r2Endpoint: 'https://r2.example',
      r2AccessKeyId: 'id',
      r2SecretAccessKey: 'secret',
      r2Bucket: 'bucket',
    },
    enabled,
  };
}

/** A budget guard whose hard-stop fires after `allowCalls` charges. */
function makeBudget(allowCalls: number): {
  charges: number;
  guard: SourceCtx['budget'];
} {
  const state = { charges: 0 };
  const guard: SourceCtx['budget'] = {
    wouldExceed95: (_source: SourceName, _cost: number): boolean => state.charges >= allowCalls,
    charge: (_source: SourceName, _cost: number): void => {
      if (state.charges >= allowCalls) throw new Error('95% hard stop');
      state.charges += 1;
    },
    spent: (_source: SourceName): number => state.charges * OPENALEX_LIST_COST,
  };
  return {
    get charges() {
      return state.charges;
    },
    guard,
  };
}

/**
 * A SourceCtx whose fetchJson parses the `filter=doi:` query and returns only
 * the fixture works whose DOI was actually requested. Records every URL/query
 * pair so the test can assert the request was built correctly.
 */
function makeCtx(opts: {
  budget: SourceCtx['budget'];
  config?: Config;
}): { ctx: SourceCtx; calls: Array<{ url: string; query?: FetchOptions['query'] }> } {
  const calls: Array<{ url: string; query?: FetchOptions['query'] }> = [];
  const config = opts.config ?? makeConfig();
  const fixtureByDoi = new Map<string, { doi: string }>();
  for (const w of FIXTURE.results) fixtureByDoi.set(normalizeDoi(w.doi), w as { doi: string });

  const ctx: SourceCtx = {
    config,
    limiter: {
      schedule: async <T>(_s: SourceName, fn: () => Promise<T>): Promise<T> => fn(),
    },
    budget: opts.budget,
    fetchJson: async <T>(_source: SourceName, url: string, o?: FetchOptions): Promise<T> => {
      calls.push({ url, query: o?.query });
      const filter = String(o?.query?.filter ?? '');
      const requested = filter.replace(/^doi:/, '').split('|').filter(Boolean);
      const results = requested
        .map((d) => fixtureByDoi.get(normalizeDoi(d)))
        .filter((w): w is { doi: string } => w !== undefined);
      return { results } as T;
    },
    fetchText: async (): Promise<string> => {
      throw new Error('fetchText must not be called by the OpenAlex OA adapter');
    },
    fetchBytes: async (): Promise<Uint8Array> => {
      throw new Error('fetchBytes must not be called by the OpenAlex OA adapter');
    },
  };
  return { ctx, calls };
}

function makeRecord(uid: string, doi: string | undefined): PaperRecord {
  return {
    paperUid: uid,
    identifiers: doi ? { doi } : {},
    title: uid,
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

// ─────────────────────────────────────────────────────────────────────────────
// Pure mapper tests
// ─────────────────────────────────────────────────────────────────────────────

test('mapOaStatus: known vocab passes; unknown/empty → unknown', () => {
  assert.equal(mapOaStatus('gold'), 'gold');
  assert.equal(mapOaStatus('GREEN'), 'green');
  assert.equal(mapOaStatus('hybrid'), 'hybrid');
  assert.equal(mapOaStatus('bronze'), 'bronze');
  assert.equal(mapOaStatus('closed'), 'closed');
  assert.equal(mapOaStatus('diamond'), 'unknown'); // not in §8 vocab
  assert.equal(mapOaStatus(null), 'unknown');
  assert.equal(mapOaStatus(undefined), 'unknown');
});

test('mapVersion: OpenAlex *Version → §8 vocab', () => {
  assert.equal(mapVersion('publishedVersion'), 'published');
  assert.equal(mapVersion('acceptedVersion'), 'accepted');
  assert.equal(mapVersion('submittedVersion'), 'submitted');
  assert.equal(mapVersion('draft'), null);
  assert.equal(mapVersion(null), null);
});

test('mapLicense: normalises to §8 vocab', () => {
  assert.equal(mapLicense('cc-by'), 'cc-by');
  assert.equal(mapLicense('cc-by-nc-nd'), 'cc-by-nc');
  assert.equal(mapLicense('cc-by-nc'), 'cc-by-nc');
  assert.equal(mapLicense('cc0'), 'cc0');
  assert.equal(mapLicense('public-domain'), 'cc0');
  assert.equal(mapLicense('publisher-specific-oa'), 'publisher-specific');
  assert.equal(mapLicense(null), null);
});

test('normalizeDoi: strips prefixes and lowercases', () => {
  assert.equal(normalizeDoi('https://doi.org/10.1/AbC'), '10.1/abc');
  assert.equal(normalizeDoi('http://dx.doi.org/10.1/x'), '10.1/x');
  assert.equal(normalizeDoi('doi:10.2/Y'), '10.2/y');
  assert.equal(normalizeDoi('  10.3/Z  '), '10.3/z');
});

test('chunk: splits into fixed sizes; rejects size <= 0', () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(chunk([], 50), []);
  assert.throws(() => chunk([1], 0), RangeError);
});

test('mapWorkToOaInfo: closed work with no best_oa_location degrades gracefully', () => {
  const info = mapWorkToOaInfo({
    doi: 'https://doi.org/10.9999/closed.0001',
    open_access: { is_oa: false, oa_status: 'closed' },
    best_oa_location: null,
  });
  assert.deepEqual(info, {
    isOa: false,
    status: 'closed',
    bestOaUrl: null,
    license: null,
    version: null,
  });
});

test('mapWorkToOaInfo: falls back to landing_page_url when pdf_url is null', () => {
  const info = mapWorkToOaInfo({
    open_access: { is_oa: true, oa_status: 'green' },
    best_oa_location: {
      pdf_url: null,
      landing_page_url: 'https://landing',
      license: 'cc-by-nc-nd',
      version: 'acceptedVersion',
    },
  });
  assert.equal(info.bestOaUrl, 'https://landing');
  assert.equal(info.version, 'accepted');
  assert.equal(info.license, 'cc-by-nc');
});

test('mapWorkToMeta: extracts citation count, journal, type, top-5 concepts', () => {
  const meta = mapWorkToMeta({
    type: 'review',
    cited_by_count: 99,
    primary_location: {
      source: {
        display_name: 'Nature Reviews',
        issn: ['1471-0048', '1471-003X'],
        host_organization_name: 'Springer Nature',
        type: 'journal',
      },
    },
    concepts: [
      { display_name: 'A' },
      { display_name: 'B' },
      { display_name: 'C' },
      { display_name: 'D' },
      { display_name: 'E' },
      { display_name: 'F' },
    ],
  });
  assert.equal(meta.citedByCount, 99);
  assert.equal(meta.workType, 'review');
  assert.deepEqual(meta.journal, {
    issn: ['1471-0048', '1471-003X'],
    publisher: 'Springer Nature',
    type: 'journal',
  });
  assert.deepEqual(meta.concepts, ['A', 'B', 'C', 'D', 'E']);
});

test('mapWorkToMeta: missing fields degrade to null/empty; topics beat concepts', () => {
  const empty = mapWorkToMeta({});
  assert.deepEqual(empty, {
    citedByCount: null,
    journal: { issn: [], publisher: null, type: null },
    workType: null,
    concepts: [],
  });

  const withTopics = mapWorkToMeta({
    topics: [{ display_name: 'Topic One' }],
    concepts: [{ display_name: 'Concept (ignored)' }],
  });
  assert.deepEqual(withTopics.concepts, ['Topic One']);
});

test('extractWorkIds: strips URL/host prefixes from the full id set', () => {
  const ids = extractWorkIds({
    id: 'https://openalex.org/W2741809807',
    doi: 'https://doi.org/10.1371/journal.pone.0211200',
    ids: {
      openalex: 'https://openalex.org/W2741809807',
      doi: 'https://doi.org/10.1371/journal.pone.0211200',
      pmid: 'https://pubmed.ncbi.nlm.nih.gov/30682108',
      pmcid: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6347394',
    },
  });
  assert.equal(ids.doi, '10.1371/journal.pone.0211200');
  assert.equal(ids.pmid, '30682108');
  assert.equal(ids.pmcid, 'PMC6347394');
  assert.equal(ids.openalex, 'W2741809807');
});

test('extractWorkIds: falls back to top-level doi when ids.doi absent; partial ids ok', () => {
  const ids = extractWorkIds({
    doi: 'https://doi.org/10.9999/closed.0001',
    open_access: { is_oa: false, oa_status: 'closed' },
    best_oa_location: null,
  });
  assert.equal(ids.doi, '10.9999/closed.0001');
  assert.equal(ids.pmid, undefined);
  assert.equal(ids.pmcid, undefined);
});

// ─────────────────────────────────────────────────────────────────────────────
// resolveOa integration (fixture-backed, fake ctx)
// ─────────────────────────────────────────────────────────────────────────────

test('resolveOa: one batch → one list call, correctly priced & mapped', async () => {
  const budget = makeBudget(10);
  const { ctx, calls } = makeCtx({ budget: budget.guard });
  const records = [
    makeRecord('doi:10.1371/journal.pone.0211200', 'https://doi.org/10.1371/journal.pone.0211200'),
    makeRecord('doi:10.1101/2020.01.01.900000', 'https://doi.org/10.1101/2020.01.01.900000'),
    makeRecord('doi:10.9999/closed.0001', 'https://doi.org/10.9999/closed.0001'),
    makeRecord('doi:10.5555/cc0.dataset', 'https://doi.org/10.5555/cc0.dataset'),
  ];

  const out = await resolveOa(ctx, records);

  // Exactly one list call for 4 DOIs (well under the 50 batch size).
  assert.equal(calls.length, 1);
  assert.equal(budget.charges, 1);
  assert.ok(calls[0]!.url.includes('api.openalex.org/works'));
  assert.equal(calls[0]!.query?.['per-page'], OPENALEX_BATCH_SIZE);
  assert.equal(calls[0]!.query?.api_key, 'test-openalex-key');
  assert.equal(calls[0]!.query?.mailto, 'test@ourobion.dev');
  assert.ok(String(calls[0]!.query?.filter).startsWith('doi:'));

  const gold = out.get('doi:10.1371/journal.pone.0211200');
  assert.deepEqual(gold?.oa, {
    isOa: true,
    status: 'gold',
    bestOaUrl:
      'https://journals.plos.org/plosone/article/file?id=10.1371/journal.pone.0211200&type=printable',
    license: 'cc-by',
    version: 'published',
  } satisfies OaInfo);
  // Richer metadata is parsed alongside the OA info.
  assert.equal(gold?.meta.citedByCount, 142);
  assert.equal(gold?.meta.journal.publisher, 'Public Library of Science');
  assert.equal(gold?.meta.journal.type, 'journal');
  assert.deepEqual(gold?.meta.journal.issn, ['1932-6203']);
  assert.equal(gold?.meta.workType, 'article');
  // Top ~5 concepts captured (sixth dropped), in source order.
  assert.deepEqual(gold?.meta.concepts, [
    'Gut microbiome',
    'Immunology',
    'Microbiology',
    'Biology',
    'Medicine',
  ]);
  // The work's full id set is parsed alongside (drives §4 reconciliation).
  assert.equal(gold?.ids.doi, '10.1371/journal.pone.0211200');
  assert.equal(gold?.ids.pmid, '30682108');
  assert.equal(gold?.ids.pmcid, 'PMC6347394');
  assert.equal(gold?.ids.openalex, 'W2741809807');

  const green = out.get('doi:10.1101/2020.01.01.900000');
  assert.equal(green?.oa.status, 'green');
  assert.equal(green?.oa.bestOaUrl, 'https://www.biorxiv.org/content/10.1101/2020.01.01.900000v1');
  assert.equal(green?.oa.license, 'cc-by-nc');
  assert.equal(green?.oa.version, 'accepted');
  assert.equal(green?.meta.citedByCount, 7);
  assert.equal(green?.meta.workType, 'preprint');
  assert.equal(green?.meta.journal.type, 'repository');
  // `topics` takes precedence over `concepts` when present.
  assert.deepEqual(green?.meta.concepts, ['Hydration and electrolytes', 'Sports physiology']);

  const closed = out.get('doi:10.9999/closed.0001');
  assert.equal(closed?.oa.isOa, false);
  assert.equal(closed?.oa.status, 'closed');
  assert.equal(closed?.oa.bestOaUrl, null);
  // A null source degrades to empty journal metadata.
  assert.equal(closed?.meta.journal.publisher, null);
  assert.deepEqual(closed?.meta.journal.issn, []);

  const cc0 = out.get('doi:10.5555/cc0.dataset');
  assert.equal(cc0?.oa.status, 'bronze');
  assert.equal(cc0?.oa.license, 'cc0');
  assert.equal(cc0?.oa.version, 'submitted');
});

test('resolveOa: records without a DOI are skipped (not in map, no call wasted)', async () => {
  const budget = makeBudget(10);
  const { ctx, calls } = makeCtx({ budget: budget.guard });
  const out = await resolveOa(ctx, [makeRecord('corpus:01ABC', undefined)]);
  assert.equal(out.size, 0);
  assert.equal(calls.length, 0); // no DOIs → no list call
});

test('resolveOa: a DOI OpenAlex returns nothing for → explicit unknown OaInfo', async () => {
  const budget = makeBudget(10);
  const { ctx } = makeCtx({ budget: budget.guard });
  const out = await resolveOa(ctx, [
    makeRecord('doi:10.0000/not.in.fixture', 'https://doi.org/10.0000/not.in.fixture'),
  ]);
  assert.deepEqual(out.get('doi:10.0000/not.in.fixture')?.oa, {
    isOa: false,
    status: 'unknown',
    bestOaUrl: null,
    license: null,
    version: null,
  } satisfies OaInfo);
  // A work OpenAlex didn't return → empty (unknown) metadata, never undefined.
  assert.deepEqual(out.get('doi:10.0000/not.in.fixture')?.meta, {
    citedByCount: null,
    journal: { issn: [], publisher: null, type: null },
    workType: null,
    concepts: [],
  });
});

test('resolveOa: one DOI shared by two records fans out to both paperUids', async () => {
  const budget = makeBudget(10);
  const { ctx, calls } = makeCtx({ budget: budget.guard });
  const doi = 'https://doi.org/10.1371/journal.pone.0211200';
  const out = await resolveOa(ctx, [makeRecord('uidA', doi), makeRecord('uidB', doi)]);
  assert.equal(calls.length, 1); // de-duped to a single DOI in the filter
  assert.equal(out.get('uidA')?.oa.status, 'gold');
  assert.equal(out.get('uidB')?.oa.status, 'gold');
});

test('resolveOa: >50 DOIs split into multiple batched list calls', async () => {
  const budget = makeBudget(10);
  const { ctx, calls } = makeCtx({ budget: budget.guard });
  const records: PaperRecord[] = [];
  for (let i = 0; i < 120; i++) {
    records.push(makeRecord(`doi:10.test/${i}`, `https://doi.org/10.test/${i}`));
  }
  await resolveOa(ctx, records);
  // 120 DOIs / 50 per batch → 3 calls.
  assert.equal(calls.length, 3);
  assert.equal(budget.charges, 3);
});

test('resolveOa: fail-closed — stops cleanly at the 95% line, returns partial, never throws', async () => {
  // Allow only ONE charge: the first batch resolves, the second is refused.
  const budget = makeBudget(1);
  const { ctx, calls } = makeCtx({ budget: budget.guard });
  const records: PaperRecord[] = [];
  for (let i = 0; i < 80; i++) {
    records.push(makeRecord(`doi:10.test/${i}`, `https://doi.org/10.test/${i}`));
  }

  // Must not throw — the run finishes the current work and exits cleanly.
  let out: Map<string, { oa: OaInfo; meta: WorkMeta; ids: Partial<Identifiers> }> | undefined;
  await assert.doesNotReject(async () => {
    out = await resolveOa(ctx, records);
  });

  // Only the first batch (50 DOIs) was issued; the guard short-circuits the second.
  assert.equal(calls.length, 1);
  assert.equal(budget.charges, 1);
  // The first 50 resolved; the remaining 30 are simply absent (left for tomorrow).
  assert.equal(out?.size, 50);
  assert.ok(out?.has('doi:10.test/0'));
  assert.ok(!out?.has('doi:10.test/79'));
});
