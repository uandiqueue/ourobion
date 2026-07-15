/**
 * Semantic Scholar discovery-adapter tests (design §2 / §10.3) — node:test via tsx.
 *
 * NO network: `discover` is driven through a stub `SourceCtx` whose `fetchJson`
 * returns the canned fixture and records how it was called (so we can assert the
 * source name, header, and limiter routing). The pure mappers run against the
 * fixture directly.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { discover, mapPaper, mapResponse } from '../src/sources/discovery/s2.js';
import type {
  Candidate,
  Config,
  FetchOptions,
  Seed,
  SourceCtx,
  SourceName,
} from '../src/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = JSON.parse(
  readFileSync(join(__dirname, 'fixtures', 's2-search.json'), 'utf8'),
) as unknown;

const SEED: Seed = {
  topic: 'gut_microbiome',
  query: 'gut microbiome short-chain fatty acids',
  topicTags: ['gut_microbiome'],
};

/** Build a Config with S2 enabled/disabled and an optional key. */
function makeConfig(opts: { s2Enabled: boolean; s2Key?: string }): Config {
  const enabled = {
    crossref: true,
    pubmed: true,
    europepmc: true,
    arxiv: true,
    s2: opts.s2Enabled,
    doaj: true,
    biorxiv: true,
    lens: false,
    openalex: true,
    unpaywall: true,
    pmc: true,
    directOa: true,
    core: false,
  } satisfies Record<SourceName, boolean>;

  return {
    contactEmail: 'test@example.com',
    keys: {
      openalex: 'oa-key',
      r2Endpoint: 'https://r2.example',
      r2AccessKeyId: 'id',
      r2SecretAccessKey: 'secret',
      r2Bucket: 'bucket',
      s2: opts.s2Key,
    },
    enabled,
  };
}

interface Recorded {
  source: SourceName;
  url: string;
  opts?: FetchOptions;
  scheduledFor: SourceName | null;
}

/** A stub SourceCtx that serves the fixture and records the call shape. */
function makeCtx(config: Config, payload: unknown): { ctx: SourceCtx; calls: Recorded[] } {
  const calls: Recorded[] = [];
  let lastScheduled: SourceName | null = null;

  const ctx: SourceCtx = {
    config,
    limiter: {
      schedule<T>(source: SourceName, fn: () => Promise<T>): Promise<T> {
        lastScheduled = source;
        return fn();
      },
    },
    budget: {
      wouldExceed95() {
        return false;
      },
      charge() {
        throw new Error('S2 is rate-limited only — charge must never be called');
      },
      spent() {
        return 0;
      },
    },
    async fetchJson<T>(source: SourceName, url: string, opts?: FetchOptions): Promise<T> {
      // Mirror the real helper: route the (recorded) fetch through the limiter.
      return this.limiter.schedule(source, async () => {
        calls.push({ source, url, opts, scheduledFor: lastScheduled });
        return payload as T;
      });
    },
    async fetchText(): Promise<string> {
      throw new Error('s2 adapter must not call fetchText');
    },
    async fetchBytes(): Promise<Uint8Array> {
      throw new Error('s2 adapter must not call fetchBytes');
    },
  };

  return { ctx, calls };
}

test('mapResponse: drops untitled stub, keeps the three real rows', () => {
  const cands = mapResponse(FIXTURE as Parameters<typeof mapResponse>[0]);
  assert.equal(cands.length, 3);
  assert.ok(cands.every((c: Candidate) => c.discoveredVia === 's2'));
});

test('mapPaper: maps externalIds DOI/PubMed/PMC + s2 paperId', () => {
  const data = (FIXTURE as { data: Parameters<typeof mapPaper>[0][] }).data;
  const numpy = mapPaper(data[0]!);
  assert.ok(numpy);
  assert.deepEqual(numpy!.identifiers, {
    doi: '10.1038/s41586-020-2649-2',
    pmid: '32939066',
    pmcid: 'PMC7759461',
    s2: '649def34f8be52c8b66281af98ae884c09aef38b',
  });
  assert.equal(numpy!.title, 'Array programming with NumPy');
  assert.equal(numpy!.year, 2020);
  assert.equal(numpy!.venue, 'Nature');
  assert.deepEqual(numpy!.authors, ['Charles R. Harris', 'K. Jarrod Millman']);
});

test('mapPaper: trims title, maps arXiv id, blank venue→null, blank author dropped', () => {
  const data = (FIXTURE as { data: Parameters<typeof mapPaper>[0][] }).data;
  const clip = mapPaper(data[1]!);
  assert.ok(clip);
  assert.equal(clip!.title, 'Learning Transferable Visual Models From Natural Language Supervision');
  assert.equal(clip!.identifiers.arxiv, '2103.00020');
  assert.equal(clip!.identifiers.doi, '10.48550/arXiv.2103.00020');
  assert.equal(clip!.venue, null);
  assert.equal(clip!.abstract, null);
  assert.deepEqual(clip!.authors, ['Alec Radford']); // blank-name author dropped
});

test('mapPaper: s2-only paper (no externalIds) keeps just the s2 id; year null', () => {
  const data = (FIXTURE as { data: Parameters<typeof mapPaper>[0][] }).data;
  const pre = mapPaper(data[2]!);
  assert.ok(pre);
  assert.deepEqual(pre!.identifiers, { s2: '0000s2onlypaperidnoexternalids0000' });
  assert.equal(pre!.year, null);
  assert.equal(pre!.venue, 'bioRxiv');
});

test('mapPaper: untitled stub → null', () => {
  const data = (FIXTURE as { data: Parameters<typeof mapPaper>[0][] }).data;
  assert.equal(mapPaper(data[3]!), null);
});

test('discover: returns [] fast when s2 disabled (no fetch, no limiter)', async () => {
  const config = makeConfig({ s2Enabled: false, s2Key: 'k' });
  const { ctx, calls } = makeCtx(config, FIXTURE);
  const out = await discover(ctx, SEED);
  assert.deepEqual(out, []);
  assert.equal(calls.length, 0);
});

test('discover: enabled+keyed sends x-api-key, routes through limiter for s2, maps fixture', async () => {
  const config = makeConfig({ s2Enabled: true, s2Key: 'secret-key' });
  const { ctx, calls } = makeCtx(config, FIXTURE);
  const out = await discover(ctx, SEED);

  assert.equal(out.length, 3);
  assert.equal(calls.length, 1);
  const call = calls[0]!;
  assert.equal(call.source, 's2');
  assert.equal(call.scheduledFor, 's2'); // went through the limiter for s2
  assert.match(call.url, /\/graph\/v1\/paper\/search$/);
  assert.equal(call.opts?.headers?.['x-api-key'], 'secret-key');
  assert.equal(call.opts?.query?.query, SEED.query);
  assert.equal(call.opts?.query?.fields, 'title,year,venue,abstract,externalIds,authors');
  assert.equal(call.opts?.query?.limit, 50);
});

test('discover: enabled but no key → anonymous (no x-api-key header)', async () => {
  const config = makeConfig({ s2Enabled: true, s2Key: undefined });
  const { ctx, calls } = makeCtx(config, FIXTURE);
  const out = await discover(ctx, SEED);

  assert.equal(out.length, 3);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.opts?.headers?.['x-api-key'], undefined);
});

test('discover: empty data array → no candidates', async () => {
  const config = makeConfig({ s2Enabled: true });
  const { ctx } = makeCtx(config, { total: 0, offset: 0, data: [] });
  const out = await discover(ctx, SEED);
  assert.deepEqual(out, []);
});
