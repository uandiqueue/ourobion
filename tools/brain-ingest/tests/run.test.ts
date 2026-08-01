/**
 * Orchestrator tests (design Â§3, Â§5.1, Â§10.6) â€” node:test, via tsx. NO network.
 *
 * The run is exercised with EVERY discovery source disabled, so `discoverSeed`
 * makes zero network calls â€” the pipeline runs end-to-end (discover â†’ resolve â†’
 * classify â†’ manifest) entirely offline. Proves:
 *  - `classifyRetrievability` maps OaInfo â†’ the Â§8 vocabulary;
 *  - a dry run plans + persists `discovered` records but issues no R2 calls;
 *  - resume skips already-`fetched` records (no re-store);
 *  - the manifest is written + re-read across a simulated restart.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

import { run, classifyRetrievability, statusReport } from '../src/run.js';
import { Manifest } from '../src/manifest.js';
import { R2Store } from '../src/storage/r2.js';
import { CONTROL_KEY } from '../src/control.js';
import type { Config, OaInfo, PaperRecord, SourceEnablement, IngestControlConfig } from '../src/types.js';
import { SEEDS } from '../src/seeds.js';

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Doubles
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** All sources OFF â†’ no discovery adapter runs â†’ no network is touched. */
function allDisabled(): SourceEnablement {
  return {
    crossref: false,
    pubmed: false,
    europepmc: false,
    arxiv: false,
    s2: false,
    doaj: false,
    biorxiv: false,
    lens: false,
    openalex: false,
    unpaywall: false,
    pmc: false,
    directOa: false,
    core: false,
  };
}

function makeConfig(enabled = allDisabled()): Config {
  return {
    contactEmail: 'test@example.com',
    keys: {
      openalex: 'k',
      r2Endpoint: 'https://r2.example.com',
      r2AccessKeyId: 'id',
      r2SecretAccessKey: 'secret',
      r2Bucket: 'corpus',
    },
    enabled,
  };
}

/** An R2 store backed by an in-memory map (no network). */
function memStore(): { store: R2Store; puts: string[]; objects: Map<string, Uint8Array> } {
  const objects = new Map<string, Uint8Array>();
  const puts: string[] = [];
  const client = {
    async send(command: unknown): Promise<unknown> {
      const c = command as { constructor: { name: string }; input: Record<string, unknown> };
      const name = c.constructor.name;
      const key = c.input['Key'] as string;
      if (name === 'HeadObjectCommand') {
        if (!objects.has(key)) {
          const err = new Error('NotFound') as Error & { name: string };
          err.name = 'NotFound';
          throw err;
        }
        return { Metadata: {} };
      }
      if (name === 'PutObjectCommand') {
        objects.set(key, c.input['Body'] as Uint8Array);
        puts.push(key);
        return {};
      }
      if (name === 'GetObjectCommand') {
        return { Body: { transformToString: async () => '' } };
      }
      return {};
    },
  };
  return { store: new R2Store(makeConfig(), { client }), puts, objects };
}

function tmpCorpus(): string {
  return mkdtempSync(join(tmpdir(), 'brain-ingest-run-'));
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// classifyRetrievability (pure)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

test('classifyRetrievability maps OaInfo to the Â§8 vocabulary', () => {
  const oa = (over: Partial<OaInfo>): OaInfo => ({
    isOa: false,
    status: 'unknown',
    bestOaUrl: null,
    license: null,
    version: null,
    ...over,
  });
  assert.equal(classifyRetrievability(oa({ isOa: true, bestOaUrl: 'http://x/p.pdf' })), 'pdf');
  assert.equal(classifyRetrievability(oa({ isOa: true, bestOaUrl: null })), 'html');
  assert.equal(classifyRetrievability(oa({ isOa: false, status: 'closed' })), 'paywalled');
  assert.equal(classifyRetrievability(oa({ isOa: false, status: 'unknown' })), 'unknown');
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// run() â€” offline, all sources disabled
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

test('run with all sources disabled discovers nothing and touches no network', async () => {
  const dir = tmpCorpus();
  const { store, puts } = memStore();
  const logs: string[] = [];
  try {
    const result = await run({
      config: makeConfig(),
      corpusDir: dir,
      store,
      log: (l) => logs.push(l),
    });
    assert.equal(result.discovered, 0);
    assert.equal(result.fetched, 0);
    // A non-dry run syncs the (here empty) manifest index to R2 â€” once after the
    // upsert and again at end-of-run. With no records there are no per-paper
    // meta/ objects, so the manifest index is the only key ever written. (The
    // mock store carries no sha metadata, so each sync re-puts rather than skips.)
    assert.deepEqual(
      [...new Set(puts)],
      ['manifest/papers.jsonl'],
      'only the manifest index synced',
    );
    // Derived from the pool, not hardcoded: #307 D5 rebalanced the seeds across metric families, so
    // a fixed count here would fail on every legitimate pool change.
    assert.equal(result.seedsRun.length, SEEDS.length, 'every seed in the pool attempted');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('dry-run persists discovered records but issues no R2 calls', async () => {
  const dir = tmpCorpus();
  const { store, puts } = memStore();
  try {
    // Seed the manifest with a pre-existing discovered paper so the dry-run has
    // something to plan over (discovery is off â†’ no new candidates).
    const m = Manifest.open(dir);
    const seeded: PaperRecord = {
      paperUid: 'doi:10.1/seed',
      identifiers: { doi: '10.1/seed' },
      title: 'Seed',
      authors: [],
      year: 2024,
      venue: null,
      abstract: null,
      discoveredVia: 'crossref',
      topicTags: ['hydration'],
      oa: { isOa: false, status: 'unknown', bestOaUrl: null, license: null, version: null },
      retrievability: 'unknown',
      storage: { kind: 'none' },
      fullText: { extracted: false, method: null, charCount: null },
      status: 'discovered',
      errors: [],
      fetchedAt: null,
    };
    m.append(seeded);

    const result = await run({
      config: makeConfig(),
      corpusDir: dir,
      store,
      dryRun: true,
      log: () => {},
    });
    assert.equal(result.fetched, 0);
    assert.equal(puts.length, 0, 'dry-run makes no R2 writes');

    // The seeded record is still present and still discovered after a dry-run.
    const reopened = Manifest.open(dir);
    assert.equal(reopened.get('doi:10.1/seed')?.status, 'discovered');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('non-dry run does not re-sync untouched per-paper metadata', async () => {
  const dir = tmpCorpus();
  const { store, puts } = memStore();
  try {
    // Seed a discovered paper; with discovery off, the run resolves/classifies
    // (no-op, sources disabled) then syncs metadata. No retrieval (also disabled).
    const m = Manifest.open(dir);
    const seeded: PaperRecord = {
      paperUid: 'doi:10.1/meta',
      identifiers: { doi: '10.1/meta' },
      title: 'Meta sync paper',
      authors: [],
      year: 2025,
      venue: null,
      abstract: null,
      discoveredVia: 'crossref',
      topicTags: ['sleep'],
      oa: { isOa: false, status: 'unknown', bestOaUrl: null, license: null, version: null },
      retrievability: 'unknown',
      storage: { kind: 'none' },
      fullText: { extracted: false, method: null, charCount: null },
      status: 'discovered',
      errors: [],
      fetchedAt: null,
    };
    m.append(seeded);

    await run({ config: makeConfig(), corpusDir: dir, store, log: () => {} });

    // The combined index remains complete, but this pre-existing record was not
    // rediscovered or changed, so its per-paper object must not be re-HEADed.
    assert.ok(puts.includes('manifest/papers.jsonl'), 'manifest index synced');
    assert.equal(puts.some((key) => key.startsWith('meta/')), false, 'untouched meta excluded');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('metadata sync writes only changed topic records while keeping the complete index', async () => {
  const dir = tmpCorpus();
  const { store, puts, objects } = memStore();
  const untouched: PaperRecord = {
    paperUid: 'doi:10.1/untouched',
    identifiers: { doi: '10.1/untouched' },
    title: 'Untouched corpus member',
    authors: [],
    year: 2020,
    venue: null,
    abstract: null,
    discoveredVia: 'crossref',
    topicTags: ['legacy'],
    oa: { isOa: false, status: 'unknown', bestOaUrl: null, license: null, version: null },
    retrievability: 'unknown',
    storage: { kind: 'none' },
    fullText: { extracted: false, method: null, charCount: null },
    status: 'discovered',
    errors: [],
    fetchedAt: null,
  };
  Manifest.open(dir).append(untouched);

  const enabled = { ...allDisabled(), crossref: true };
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: unknown): Promise<Response> => {
    const url = String(input);
    if (!url.includes('api.crossref.org')) throw new Error(`unexpected fetch in test: ${url}`);
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        message: {
          items: [{
            DOI: '10.9999/incremental-sync',
            title: ['Incremental metadata paper'],
            author: [{ family: 'Tan', given: 'A' }],
            'container-title': ['Test Journal'],
            issued: { 'date-parts': [[2026]] },
          }],
        },
      }),
    } as Response;
  }) as typeof globalThis.fetch;

  const logs: string[] = [];
  try {
    const options = {
      config: makeConfig(enabled),
      corpusDir: dir,
      seed: 'gut_microbiome',
      limit: 1,
      store,
      log: (line: string) => logs.push(line),
    };
    await run(options);

    const metaPutsAfterFirst = puts.filter((key) => key.startsWith('meta/'));
    assert.deepEqual(metaPutsAfterFirst, ['meta/doi%3A10.9999%2Fincremental-sync.json']);
    assert.ok(logs.some((line) => line.includes('1 changed meta/')));

    const indexBytes = objects.get('manifest/papers.jsonl');
    assert.ok(indexBytes, 'complete manifest index was written');
    const indexedUids = new TextDecoder().decode(indexBytes)
      .trim().split(/\r?\n/).map((line) => (JSON.parse(line) as PaperRecord).paperUid).sort();
    assert.deepEqual(indexedUids, ['doi:10.1/untouched', 'doi:10.9999/incremental-sync']);

    logs.length = 0;
    await run(options);
    assert.equal(
      puts.filter((key) => key.startsWith('meta/')).length,
      1,
      'an identical repeat performs no additional per-paper metadata sync',
    );
    assert.ok(logs.some((line) => line.includes('0 changed meta/')));
  } finally {
    globalThis.fetch = realFetch;
    rmSync(dir, { recursive: true, force: true });
  }
});

test('non-dry run reconciles records sharing an OpenAlex-enriched id â†’ merged set + meta/ delete', async () => {
  const dir = tmpCorpus();
  const { store, puts } = memStore();
  const deletes: string[] = [];
  // Track deleteObject calls on the mock store.
  const origDelete = store.deleteObject.bind(store);
  store.deleteObject = async (key: string): Promise<void> => {
    deletes.push(key);
    return origDelete(key);
  };

  // Enable crossref + europepmc (discovery) and openalex (enrichment). All HTTP is
  // served by a stubbed globalThis.fetch routed by URL â€” NO real network.
  const enabled = {
    ...allDisabled(),
    crossref: true,
    europepmc: true,
    openalex: true,
  };

  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: unknown): Promise<Response> => {
    const url = String(input);
    const json = (body: unknown): Response =>
      ({ ok: true, status: 200, statusText: 'OK', json: async () => body }) as unknown as Response;

    if (url.includes('api.crossref.org')) {
      // A DOI-only work (no PMCID yet).
      return json({
        message: {
          items: [
            {
              DOI: '10.3390/s24010001',
              title: ['MDPI Sensors paper'],
              author: [{ family: 'Lee', given: 'A' }],
              'container-title': ['Sensors'],
              issued: { 'date-parts': [[2024]] },
            },
          ],
        },
      });
    }
    if (url.includes('ebi.ac.uk/europepmc')) {
      // The SAME paper surfaced PMCID-only (disjoint id â†’ distinct uid pre-reconcile).
      return json({
        hitCount: 1,
        resultList: {
          result: [
            {
              id: 'PMC8123456',
              source: 'PMC',
              pmcid: 'PMC8123456',
              title: 'MDPI Sensors paper',
              authorString: 'Lee A',
              journalTitle: 'Sensors',
              pubYear: '2024',
            },
          ],
        },
      });
    }
    if (url.includes('api.openalex.org')) {
      // OpenAlex returns the DOI work's FULL id set â€” including the shared PMCID,
      // which is what makes the two records reconcilable.
      return json({
        results: [
          {
            id: 'https://openalex.org/W42',
            doi: 'https://doi.org/10.3390/s24010001',
            ids: {
              openalex: 'https://openalex.org/W42',
              doi: 'https://doi.org/10.3390/s24010001',
              pmcid: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8123456',
            },
            type: 'article',
            cited_by_count: 5,
            open_access: { is_oa: true, oa_status: 'gold' },
            best_oa_location: { pdf_url: 'https://x/p.pdf', license: 'cc-by', version: 'publishedVersion' },
            primary_location: { source: { issn: [], host_organization_name: 'MDPI', type: 'journal' } },
          },
        ],
      });
    }
    if (url.includes('/pmc/utils/idconv/')) {
      // This run's records already share the PMCID via OpenAlex â€” the crosswalk adds
      // nothing new here. Return an empty (no-hit) result so it is a clean no-op.
      return json({ status: 'ok', records: [] });
    }
    throw new Error(`unexpected fetch in test: ${url}`);
  }) as typeof globalThis.fetch;

  const logs: string[] = [];
  try {
    const result = await run({
      config: makeConfig(enabled),
      corpusDir: dir,
      seed: 'gut_microbiome', // a single seed keeps the stub call count small
      store,
      log: (l) => logs.push(l),
    });

    // Two discovered candidates (doi-only + pmcid-only) reconcile to ONE record.
    assert.equal(result.discovered, 1, 'reconciled to a single canonical record');

    const m = Manifest.open(dir);
    assert.equal(m.all().length, 1);
    assert.equal(m.get('doi:10.3390/s24010001')?.identifiers.pmcid, 'PMC8123456');
    // The pmcid-only orphan uid is gone from the local index â€¦
    assert.equal(m.has('pmcid:PMC8123456'), false);
    // â€¦ and its meta/ object was deleted from R2.
    assert.ok(
      deletes.includes('meta/pmcid%3APMC8123456.json'),
      `expected a deleteObject for the orphan meta/ object; got ${JSON.stringify(deletes)}`,
    );
    assert.ok(logs.some((l) => l.startsWith('reconciled:')), 'logged the reconcile summary');
    // We never delete the canonical paper's meta object.
    assert.ok(!deletes.includes('meta/doi%3A10.3390%2Fs24010001.json'));
    void puts;
  } finally {
    globalThis.fetch = realFetch;
    rmSync(dir, { recursive: true, force: true });
  }
});

test('non-dry run reconciles a PRIOR-RUN orphan corpus-wide (cross-run) â†’ manifest collapses + meta/ delete', async () => {
  const dir = tmpCorpus();
  const { store } = memStore();
  const deletes: string[] = [];
  const origDelete = store.deleteObject.bind(store);
  store.deleteObject = async (key: string): Promise<void> => {
    deletes.push(key);
    return origDelete(key);
  };

  // Seed a PRE-EXISTING `pmcid:`-only orphan left in the manifest by a prior run.
  // This run never re-discovers it (discovery returns only the `doi:` variant), so
  // the WITHIN-RUN reconcile can't see it â€” only the CORPUS-WIDE pass catches it.
  const m0 = Manifest.open(dir);
  m0.append({
    paperUid: 'pmcid:PMC12944331',
    identifiers: { pmcid: 'PMC12944331' },
    title: 'Sleep HRV paper (prior-run pmcid-only orphan)',
    authors: ['Tan B'],
    year: 2026,
    venue: 'Sensors',
    abstract: null,
    discoveredVia: 'europepmc',
    topicTags: ['sleep_hrv'],
    oa: { isOa: false, status: 'unknown', bestOaUrl: null, license: null, version: null },
    retrievability: 'unknown',
    storage: { kind: 'none' },
    fullText: { extracted: false, method: null, charCount: null },
    status: 'discovered',
    errors: [],
    fetchedAt: null,
  });

  // Discovery (crossref) surfaces the SAME paper as a `doi:`-only record. OpenAlex
  // gives it a PMID but NO PMCID (the real-data gap for a brand-new 2026 paper), so
  // it still does NOT share an id with the seeded `pmcid:`-only orphan. The NCBI ID
  // Converter crosswalk then fills the PMCID onto the doi-record â€” only THEN does
  // manifest.all() hold two records sharing `PMC12944331`, which the corpus-wide
  // reconcile collapses, absorbing + deleting the orphan.
  const enabled = { ...allDisabled(), crossref: true, openalex: true, pubmed: true };
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: unknown): Promise<Response> => {
    const url = String(input);
    const json = (body: unknown): Response =>
      ({ ok: true, status: 200, statusText: 'OK', json: async () => body }) as unknown as Response;
    if (url.includes('api.crossref.org')) {
      return json({
        message: {
          items: [
            {
              DOI: '10.3390/s26041325',
              title: ['Sleep HRV paper'],
              author: [{ family: 'Tan', given: 'B' }],
              'container-title': ['Sensors'],
              issued: { 'date-parts': [[2026]] },
            },
          ],
        },
      });
    }
    if (url.includes('api.openalex.org')) {
      return json({
        results: [
          {
            id: 'https://openalex.org/W99',
            doi: 'https://doi.org/10.3390/s26041325',
            ids: {
              openalex: 'https://openalex.org/W99',
              doi: 'https://doi.org/10.3390/s26041325',
              // PMID only â€” OpenAlex has no PMCID for this brand-new paper yet.
              pmid: 'https://pubmed.ncbi.nlm.nih.gov/41755264',
            },
            type: 'article',
            cited_by_count: 1,
            open_access: { is_oa: false, oa_status: 'closed' },
            best_oa_location: null,
            primary_location: { source: { issn: [], host_organization_name: 'MDPI', type: 'journal' } },
          },
        ],
      });
    }
    if (url.includes('/pmc/utils/idconv/')) {
      // The authoritative crosswalk supplies the missing PMCID for the doi/pmid record.
      return json({
        status: 'ok',
        records: [{ doi: '10.3390/s26041325', pmid: '41755264', pmcid: 'PMC12944331' }],
      });
    }
    throw new Error(`unexpected fetch in test: ${url}`);
  }) as typeof globalThis.fetch;

  const logs: string[] = [];
  try {
    await run({
      config: makeConfig(enabled),
      corpusDir: dir,
      seed: 'sleep_hrv',
      store,
      log: (l) => logs.push(l),
    });

    // The corpus collapsed to ONE canonical doi record; the prior-run orphan is gone.
    const m = Manifest.open(dir);
    assert.equal(m.all().length, 1, 'prior-run orphan absorbed corpus-wide');
    assert.equal(m.has('pmcid:PMC12944331'), false, 'orphan uid removed from manifest');
    const canon = m.get('doi:10.3390/s26041325');
    assert.equal(canon?.identifiers.pmid, '41755264', 'PMID from OpenAlex');
    assert.equal(canon?.identifiers.pmcid, 'PMC12944331', 'PMCID gap-filled by the NCBI crosswalk');
    // Its meta/ object was deleted from R2 by the corpus-wide cleanup.
    assert.ok(
      deletes.includes('meta/pmcid%3APMC12944331.json'),
      `expected deleteObject for the prior-run orphan; got ${JSON.stringify(deletes)}`,
    );
    assert.ok(
      logs.some((l) => l.startsWith('reconciled corpus:')),
      'logged the corpus-wide reconcile summary',
    );
    // Never delete the surviving canonical paper's meta object.
    assert.ok(!deletes.includes('meta/doi%3A10.3390%2Fs26041325.json'));
  } finally {
    globalThis.fetch = realFetch;
    rmSync(dir, { recursive: true, force: true });
  }
});

test('statusReport renders manifest + budget over a corpus dir', async () => {
  const dir = tmpCorpus();
  try {
    const m = Manifest.open(dir);
    m.append({
      paperUid: 'doi:10.1/x',
      identifiers: {},
      title: 'X',
      authors: [],
      year: null,
      venue: null,
      abstract: null,
      discoveredVia: 'crossref',
      topicTags: ['antibiotics'],
      oa: { isOa: false, status: 'unknown', bestOaUrl: null, license: null, version: null },
      retrievability: 'unknown',
      storage: { kind: 'none' },
      fullText: { extracted: false, method: null, charCount: null },
      status: 'fetched',
      errors: [],
      fetchedAt: '2026-06-29T00:00:00.000Z',
    });
    const report = statusReport({ config: makeConfig(), corpusDir: dir });
    assert.match(report, /fetched:\s+1/);
    assert.match(report, /antibiotics: 1/);
    assert.match(report, /openalex: \$0\.0000/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a stale CORE usage.json entry never blocks the free retrieval steps (regression)', async () => {
  const dir = tmpCorpus();
  const { store } = memStore();

  // Pre-seed usage.json with a CORE counter AT the old (wrong) 950/1000 hard-stop
  // â€” this is what an OLDER run of this tool would have left on disk, back when
  // CORE was (incorrectly) modeled as a daily-quota budget. This test proves two
  // things at once: (1) that stale state is now completely inert â€” CORE was
  // removed from BUDGETS entirely once live verification showed it has no real
  // daily cap (see limits/budget.ts / retrieval/core.ts docstrings), so nothing
  // reads this counter anymore; and (2) the free steps ahead of CORE (PMC/arXiv/
  // directOa) were never gated on it regardless â€” this is the same regression
  // `src/run.ts`'s whole-loop `break` used to cause before it was removed.
  const todayUtcMidnight = new Date(
    Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()),
  ).toISOString();
  writeFileSync(
    resolve(dir, 'usage.json'),
    JSON.stringify({ version: 1, counters: { core: { windowStart: todayUtcMidnight, spent: 950 } } }),
  );

  // A genuinely-parseable PDF (unpdf needs real structure, not just the magic
  // bytes) â€” reuse the same fixture arxivPdf.test.ts fetches over the wire.
  const pdfBytes = new Uint8Array(
    readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'arxiv-2401.12345.pdf')),
  );
  const bestOaUrl = 'https://example.org/oa/paper.pdf';

  const enabled = { ...allDisabled(), crossref: true, openalex: true };
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: unknown): Promise<Response> => {
    const url = String(input);
    const json = (body: unknown): Response =>
      ({ ok: true, status: 200, statusText: 'OK', json: async () => body }) as unknown as Response;
    if (url.includes('api.crossref.org')) {
      return json({
        message: {
          items: [
            {
              DOI: '10.9999/capped-core-test',
              title: ['A paper CORE alone used to have to serve'],
              author: [{ family: 'Ng', given: 'C' }],
              'container-title': ['Test Journal'],
              issued: { 'date-parts': [[2026]] },
            },
          ],
        },
      });
    }
    if (url.includes('api.openalex.org')) {
      return json({
        results: [
          {
            id: 'https://openalex.org/W99',
            doi: 'https://doi.org/10.9999/capped-core-test',
            ids: { openalex: 'https://openalex.org/W99', doi: 'https://doi.org/10.9999/capped-core-test' },
            open_access: { is_oa: true, oa_status: 'gold' },
            best_oa_location: { pdf_url: bestOaUrl, license: 'cc-by', version: 'publishedVersion' },
          },
        ],
      });
    }
    if (url === bestOaUrl) {
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        arrayBuffer: async () => pdfBytes.buffer,
      } as unknown as Response;
    }
    throw new Error(`unexpected fetch in test: ${url}`);
  }) as typeof globalThis.fetch;

  try {
    const result = await run({
      config: makeConfig(enabled),
      corpusDir: dir,
      seed: 'environmental_health',
      store,
      log: () => {},
    });

    // This record has no PMCID/arXiv id, so under the OLD code it would have
    // been deferred untouched the instant the pre-loop budget check saw the
    // stale CORE counter at its (fictional) cap. It's fetched via directOa now.
    assert.equal(result.fetched, 1, 'the free directOa step still served the paper');
    const m = Manifest.open(dir);
    const rec = m.get('doi:10.9999/capped-core-test');
    assert.equal(rec?.status, 'fetched');
    assert.equal(rec?.fullText.method, 'directOa');
    // No metered source is touched during retrieval anymore (CORE isn't
    // budget-guard-metered at all) â€” this is correctly false, not a stale cap.
    assert.equal(result.budgetStopped, false);
  } finally {
    globalThis.fetch = realFetch;
    rmSync(dir, { recursive: true, force: true });
  }
});

test('memoryGuard: when provided, run() pauses on host memory pressure before each retrieval', async () => {
  const dir = tmpCorpus();
  const { store } = memStore();

  const pdfBytes = new Uint8Array(
    readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'arxiv-2401.12345.pdf')),
  );
  const bestOaUrl = 'https://example.org/oa/memguard-paper.pdf';

  const enabled = { ...allDisabled(), crossref: true, openalex: true };
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: unknown): Promise<Response> => {
    const url = String(input);
    const json = (body: unknown): Response =>
      ({ ok: true, status: 200, statusText: 'OK', json: async () => body }) as unknown as Response;
    if (url.includes('api.crossref.org')) {
      return json({
        message: {
          items: [
            {
              DOI: '10.9999/memguard-test',
              title: ['A paper fetched while memory-constrained'],
              author: [{ family: 'Lim', given: 'D' }],
              'container-title': ['Test Journal'],
              issued: { 'date-parts': [[2026]] },
            },
          ],
        },
      });
    }
    if (url.includes('api.openalex.org')) {
      return json({
        results: [
          {
            id: 'https://openalex.org/W100',
            doi: 'https://doi.org/10.9999/memguard-test',
            ids: { openalex: 'https://openalex.org/W100', doi: 'https://doi.org/10.9999/memguard-test' },
            open_access: { is_oa: true, oa_status: 'gold' },
            best_oa_location: { pdf_url: bestOaUrl, license: 'cc-by', version: 'publishedVersion' },
          },
        ],
      });
    }
    if (url === bestOaUrl) {
      return { ok: true, status: 200, statusText: 'OK', arrayBuffer: async () => pdfBytes.buffer } as unknown as Response;
    }
    throw new Error(`unexpected fetch in test: ${url}`);
  }) as typeof globalThis.fetch;

  const logs: string[] = [];
  try {
    const result = await run({
      config: makeConfig(enabled),
      corpusDir: dir,
      seed: 'environmental_health',
      store,
      log: (l) => logs.push(l),
      memoryGuard: {
        freemem: () => 100 * 1024 * 1024, // always "critically tight"
        totalmem: () => 16 * 1024 * 1024 * 1024,
        maxWaits: 0, // don't actually wait â€” just prove it was checked
        sleep: async () => {},
      },
    });

    // The guard never blocks real work (soft-fail by design) â€” the paper still
    // gets fetched even while "memory" reports as critically tight throughout.
    assert.equal(result.fetched, 1);
    assert.ok(
      logs.some((l) => l.includes('memory guard') && l.includes('proceeding anyway')),
      `expected a memory-guard log line; got ${JSON.stringify(logs)}`,
    );
  } finally {
    globalThis.fetch = realFetch;
    rmSync(dir, { recursive: true, force: true });
  }
});

test('memoryGuard: omitted (the default) means zero memory checks â€” no log, no os reads', async () => {
  // Every other test in this file calls run() without `memoryGuard` and
  // passes â€” this test makes that contract explicit rather than merely implied.
  const dir = tmpCorpus();
  const { store } = memStore();
  const logs: string[] = [];
  try {
    const result = await run({
      config: makeConfig(),
      corpusDir: dir,
      seed: 'gut_microbiome',
      store,
      log: (l) => logs.push(l),
    });
    assert.equal(result.discovered, 0); // all sources disabled â€” nothing to find anyway
    assert.ok(!logs.some((l) => l.includes('memory guard')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Remote control plane (controlFromR2, src/control.ts) â€” nao UI â†” R2 â†” this CLI
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Like memStore(), but GetObjectCommand actually round-trips what was put/seeded. */
function controlStore(seed?: Record<string, string>): { store: R2Store; puts: string[] } {
  const objects = new Map<string, Uint8Array>(
    Object.entries(seed ?? {}).map(([k, v]) => [k, new TextEncoder().encode(v)]),
  );
  const puts: string[] = [];
  const client = {
    async send(command: unknown): Promise<unknown> {
      const c = command as { constructor: { name: string }; input: Record<string, unknown> };
      const name = c.constructor.name;
      const key = c.input['Key'] as string;
      if (name === 'HeadObjectCommand') {
        if (!objects.has(key)) {
          const err = new Error('NotFound') as Error & { name: string };
          err.name = 'NotFound';
          throw err;
        }
        return { Metadata: {} };
      }
      if (name === 'PutObjectCommand') {
        objects.set(key, c.input['Body'] as Uint8Array);
        puts.push(key);
        return {};
      }
      if (name === 'GetObjectCommand') {
        const body = objects.get(key);
        if (body === undefined) {
          const err = new Error('NoSuchKey') as Error & { name: string };
          err.name = 'NoSuchKey';
          throw err;
        }
        return { Body: { transformToString: async () => new TextDecoder().decode(body) } };
      }
      return {};
    },
  };
  return { store: new R2Store(makeConfig(), { client }), puts };
}

test('controlFromR2: paused does zero work and returns immediately', async () => {
  const dir = tmpCorpus();
  const control: IngestControlConfig = {
    paused: true,
    limits: {},
    updatedAt: '2026-07-02T00:00:00.000Z',
    updatedBy: 'ops@ourobion.com',
  };
  const { store } = controlStore({ [CONTROL_KEY]: JSON.stringify(control) });
  const logs: string[] = [];
  try {
    const result = await run({
      config: makeConfig({ ...allDisabled(), crossref: true }), // would discover if it ran
      corpusDir: dir,
      store,
      controlFromR2: true,
      log: (l) => logs.push(l),
    });
    assert.equal(result.discovered, 0);
    assert.equal(result.fetched, 0);
    assert.deepEqual(result.seedsRun, []);
    assert.ok(logs.some((l) => l.includes('paused via remote control')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('controlFromR2: omitted (the default) ignores a paused control document entirely', async () => {
  // Same paused document as above, but controlFromR2 is NOT set â€” must behave
  // exactly like an uncontrolled run (no R2 read at all, no pause).
  const dir = tmpCorpus();
  const control: IngestControlConfig = {
    paused: true,
    limits: {},
    updatedAt: '2026-07-02T00:00:00.000Z',
    updatedBy: 'ops@ourobion.com',
  };
  const { store } = controlStore({ [CONTROL_KEY]: JSON.stringify(control) });
  try {
    const result = await run({
      config: makeConfig(),
      corpusDir: dir,
      store,
      seed: 'gut_microbiome',
      // controlFromR2 omitted
    });
    // All discovery sources disabled by makeConfig()'s default, so this just
    // proves the run proceeded normally (didn't short-circuit on "paused").
    assert.deepEqual(result.seedsRun, ['gut_microbiome']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('controlFromR2: limits.openalexDailyUsd reaches createBudgetGuard without breaking the run', async () => {
  // The override mechanism itself (a stricter cap actually trips sooner) is
  // unit-tested precisely in limits/budget.test.ts's `budgetOverrides` tests.
  // This just proves control.limits â†’ run() â†’ createBudgetGuard is wired
  // correctly end-to-end and doesn't throw.
  const dir = tmpCorpus();
  const control: IngestControlConfig = {
    paused: false,
    limits: { openalexDailyUsd: 0.01 },
    updatedAt: '2026-07-02T00:00:00.000Z',
    updatedBy: 'ops@ourobion.com',
  };
  const { store } = controlStore({ [CONTROL_KEY]: JSON.stringify(control) });
  try {
    const result = await run({
      config: makeConfig(),
      corpusDir: dir,
      store,
      seed: 'antibiotics',
      controlFromR2: true,
      log: () => {},
    });
    assert.deepEqual(result.seedsRun, ['antibiotics']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
