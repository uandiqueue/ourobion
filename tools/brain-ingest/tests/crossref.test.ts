/**
 * Crossref discovery adapter tests (design §2, §10.3) — node:test, run via tsx.
 *
 * Proves, with NO network:
 *  - the pure field mappers normalize DOIs, strip JATS abstracts, pick year
 *    from issued/published date-parts, and format author names;
 *  - mapResponse drops title-less junk;
 *  - `discover` builds the right URL/query (mailto polite-pool, rows,
 *    query.bibliographic) and routes through ctx.fetchJson against a fixture.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  discover,
  mapResponse,
  toCandidate,
  normalizeDoi,
  cleanAbstract,
  pickYear,
  pickAuthors,
  pickVenue,
} from '../src/sources/discovery/crossref.js';
import type {
  Candidate,
  Config,
  FetchOptions,
  Seed,
  SourceCtx,
  SourceName,
} from '../src/types.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = JSON.parse(
  readFileSync(join(HERE, 'fixtures', 'crossref-works.json'), 'utf8'),
) as Parameters<typeof mapResponse>[0];

const SEED: Seed = {
  topic: 'gut_microbiome',
  query: 'gut microbiome metabolism',
  topicTags: ['gut_microbiome'],
};

/** A minimal Config — only contactEmail is read by this adapter. */
function fakeConfig(): Config {
  const enabled = {
    crossref: true,
    pubmed: false,
    europepmc: false,
    arxiv: false,
    s2: false,
    doaj: false,
    biorxiv: false,
    lens: false,
    openalex: true,
    unpaywall: false,
    pmc: false,
    directOa: false,
    core: false,
  } satisfies Record<SourceName, boolean>;
  return {
    contactEmail: 'team@ourobion.test',
    keys: {
      openalex: 'oa-key',
      r2Endpoint: 'https://r2.test',
      r2AccessKeyId: 'id',
      r2SecretAccessKey: 'secret',
      r2Bucket: 'bucket',
    },
    enabled,
  };
}

/**
 * A SourceCtx whose fetchJson returns the fixture and records the call so the
 * test can assert URL + query shaping. No network, no real limiter/budget use.
 */
function fakeCtx(): {
  ctx: SourceCtx;
  calls: Array<{ source: SourceName; url: string; opts?: FetchOptions }>;
} {
  const calls: Array<{ source: SourceName; url: string; opts?: FetchOptions }> = [];
  const ctx: SourceCtx = {
    config: fakeConfig(),
    limiter: { schedule: <T>(_s: SourceName, fn: () => Promise<T>) => fn() },
    budget: {
      wouldExceed95: () => false,
      charge: () => {},
      spent: () => 0,
    },
    async fetchJson<T>(source: SourceName, url: string, opts?: FetchOptions): Promise<T> {
      calls.push({ source, url, opts });
      return FIXTURE as unknown as T;
    },
    async fetchText(): Promise<string> {
      throw new Error('fetchText not used by crossref discovery');
    },
    async fetchBytes(): Promise<Uint8Array> {
      throw new Error('fetchBytes not used by crossref discovery');
    },
  };
  return { ctx, calls };
}

test('normalizeDoi lowercases and strips resolver prefixes', () => {
  assert.equal(normalizeDoi('10.1038/S41586-020-2649-2'), '10.1038/s41586-020-2649-2');
  assert.equal(
    normalizeDoi('https://doi.org/10.1371/journal.pone.0123456'),
    '10.1371/journal.pone.0123456',
  );
  assert.equal(normalizeDoi('http://dx.doi.org/10.1/ABC'), '10.1/abc');
  assert.equal(normalizeDoi('  '), undefined);
  assert.equal(normalizeDoi(undefined), undefined);
});

test('cleanAbstract strips JATS tags and decodes entities', () => {
  const out = cleanAbstract(
    '<jats:p><jats:title>Background</jats:title> The gut &amp; its microbiota.</jats:p>',
  );
  assert.equal(out, 'Background The gut & its microbiota.');
  assert.equal(cleanAbstract(undefined), null);
  assert.equal(cleanAbstract('<p></p>'), null);
});

test('pickYear reads issued then falls back to published', () => {
  assert.equal(pickYear({ issued: { 'date-parts': [[2020, 9, 1]] } }), 2020);
  assert.equal(pickYear({ published: { 'date-parts': [[2019]] } }), 2019);
  assert.equal(pickYear({ issued: { 'date-parts': [[]] } }), null);
  assert.equal(pickYear({}), null);
});

test('pickAuthors formats given+family, family-only, and org names', () => {
  const names = pickAuthors({
    author: [
      { given: 'Ada', family: 'Lovelace' },
      { family: 'Turing' },
      { name: 'The Consortium' },
      { given: '', family: '' },
    ],
  });
  assert.deepEqual(names, ['Ada Lovelace', 'Turing', 'The Consortium']);
});

test('pickVenue returns first non-empty container-title or null', () => {
  assert.equal(pickVenue({ 'container-title': ['Nature'] }), 'Nature');
  assert.equal(pickVenue({ 'container-title': [] }), null);
  assert.equal(pickVenue({}), null);
});

test('toCandidate maps a full item; absent DOI yields empty identifiers', () => {
  const c = toCandidate({
    title: ['No DOI here'],
    author: [{ given: 'A', family: 'B' }],
    issued: { 'date-parts': [[2022]] },
  });
  assert.deepEqual(c.identifiers, {});
  assert.equal(c.discoveredVia, 'crossref');
  assert.equal(c.year, 2022);
});

test('mapResponse parses the fixture and drops the title-less item', () => {
  const candidates = mapResponse(FIXTURE);
  assert.equal(candidates.length, 2);

  const first = candidates[0] as Candidate;
  assert.equal(first.identifiers.doi, '10.1038/s41586-020-2649-2');
  assert.equal(first.title, 'Gut microbiome composition shapes host metabolism');
  assert.deepEqual(first.authors, ['Ada Lovelace', 'Alan Turing', 'The Microbiome Consortium']);
  assert.equal(first.venue, 'Nature');
  assert.equal(first.year, 2020);
  assert.equal(first.abstract, 'Background The gut & its microbiota influence metabolism.');
  assert.equal(first.discoveredVia, 'crossref');

  const second = candidates[1] as Candidate;
  assert.equal(second.identifiers.doi, '10.1371/journal.pone.0123456');
  assert.equal(second.year, 2019);
  assert.deepEqual(second.authors, ['Rosalind']);
  assert.equal(second.abstract, null);
});

test('discover routes through ctx.fetchJson with polite-pool query shaping', async () => {
  const { ctx, calls } = fakeCtx();
  const candidates = await discover(ctx, SEED);

  assert.equal(calls.length, 1);
  const call = calls[0]!;
  assert.equal(call.source, 'crossref');
  assert.equal(call.url, 'https://api.crossref.org/works');
  assert.equal(call.opts?.method, 'GET');
  assert.equal(call.opts?.query?.['query.bibliographic'], 'gut microbiome metabolism');
  assert.equal(call.opts?.query?.['mailto'], 'team@ourobion.test');
  assert.equal(call.opts?.query?.['rows'], 20);

  assert.equal(candidates.length, 2);
});
