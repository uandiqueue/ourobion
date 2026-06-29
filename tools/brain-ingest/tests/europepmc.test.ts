/**
 * Europe PMC discovery adapter — fixture-only tests (no network).
 *
 * Run: node --import tsx --test tests/europepmc.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  mapResult,
  mapSearchResponse,
  discover,
  type EpmcSearchResponse,
} from '../src/sources/discovery/europepmc.js';
import type {
  Candidate,
  Config,
  FetchOptions,
  Seed,
  SourceCtx,
  SourceName,
} from '../src/types.js';

const fixturePath = fileURLToPath(
  new URL('./fixtures/europepmc.search.json', import.meta.url),
);
const fixture = JSON.parse(
  readFileSync(fixturePath, 'utf8'),
) as EpmcSearchResponse;

const SEED: Seed = {
  topic: 'gut_microbiome',
  query: 'gut microbiome',
  topicTags: ['gut_microbiome'],
};

// ── pure mapping ─────────────────────────────────────────────────────────────

test('mapSearchResponse drops the id-less, title-less result', () => {
  const candidates = mapSearchResponse(fixture);
  assert.equal(candidates.length, 2);
  for (const c of candidates) {
    assert.equal(c.discoveredVia, 'europepmc');
  }
});

test('journal article captures the FULL id set (doi+pmid+pmcid), normalized', () => {
  const [article] = mapSearchResponse(fixture);
  assert.ok(article);
  // Track C: a result exposing all three ids must arrive with all three captured
  // so resolveDedup can link disjoint-id variants up front.
  assert.deepEqual(Object.keys(article.identifiers).sort(), ['doi', 'pmcid', 'pmid']);
  assert.deepEqual(article.identifiers, {
    doi: '10.1016/j.cell.2024.01.001',
    pmid: '38123456',
    pmcid: 'PMC10765432',
  });
  assert.equal(
    article.title,
    'Gut microbiome composition and host metabolic health: a cohort study',
  );
  assert.equal(article.venue, 'Cell');
  assert.equal(article.year, 2024);
  assert.ok(article.abstract && article.abstract.startsWith('We profiled'));
});

test('structured author list is preferred over authorString', () => {
  const [article] = mapSearchResponse(fixture);
  assert.ok(article);
  assert.deepEqual(article.authors, [
    'Tan Wei Hong',
    'Lim Jia Kai',
    'Garcia, Maria',
  ]);
});

test('preprint falls back to publisher venue and authorString', () => {
  const candidates = mapSearchResponse(fixture);
  const preprint = candidates[1];
  assert.ok(preprint);
  assert.equal(preprint.venue, 'bioRxiv');
  assert.deepEqual(preprint.identifiers, { doi: '10.1101/2024.05.10.593001' });
  assert.deepEqual(preprint.authors, ['Okafor C', 'Nguyen T.']);
});

test('mapResult returns null when there is no id and no title', () => {
  assert.equal(mapResult({ source: 'MED', title: '' }), null);
  assert.equal(mapResult({}), null);
});

test('mapResult keeps a title-only result (fingerprint identity downstream)', () => {
  const c = mapResult({ title: 'A paper with no external ids' });
  assert.ok(c);
  assert.deepEqual(c.identifiers, {});
  assert.equal(c.year, null);
  assert.equal(c.venue, null);
  assert.equal(c.abstract, null);
});

// ── adapter wiring (stub ctx, no network) ───────────────────────────────────

interface Recorded {
  source: SourceName;
  url: string;
  opts?: FetchOptions;
}

function makeCtx(
  resp: EpmcSearchResponse,
  recorded: Recorded[],
  charges: Array<{ source: SourceName; cost: number }>,
): SourceCtx {
  const config = { contactEmail: 'test@example.com' } as unknown as Config;
  const fail = (): never => {
    throw new Error('unexpected call');
  };
  return {
    config,
    limiter: {
      schedule: async <T>(_s: SourceName, fn: () => Promise<T>): Promise<T> =>
        fn(),
    },
    budget: {
      wouldExceed95: () => false,
      charge: (source, cost) => {
        charges.push({ source, cost });
      },
      spent: () => 0,
    },
    fetchJson: async <T>(
      source: SourceName,
      url: string,
      opts?: FetchOptions,
    ): Promise<T> => {
      recorded.push({ source, url, opts });
      return resp as unknown as T;
    },
    fetchText: fail,
    fetchBytes: fail,
  };
}

test('discover routes through fetchJson with the right source + query params', async () => {
  const recorded: Recorded[] = [];
  const charges: Array<{ source: SourceName; cost: number }> = [];
  const ctx = makeCtx(fixture, recorded, charges);

  const candidates: Candidate[] = await discover(ctx, SEED);

  assert.equal(candidates.length, 2);
  assert.equal(recorded.length, 1);

  const call = recorded[0];
  assert.ok(call);
  assert.equal(call.source, 'europepmc');
  assert.match(call.url, /europepmc\/webservices\/rest\/search$/);
  assert.equal(call.opts?.query?.query, SEED.query);
  assert.equal(call.opts?.query?.format, 'json');
  assert.equal(call.opts?.query?.resultType, 'core');

  // budget guard was consulted (a $0 charge, since europepmc is unmetered)
  assert.deepEqual(charges, [{ source: 'europepmc', cost: 0 }]);
});

test('discover returns [] when the budget guard would be exceeded', async () => {
  const recorded: Recorded[] = [];
  const ctx = makeCtx(fixture, recorded, []);
  ctx.budget.wouldExceed95 = () => true;

  const candidates = await discover(ctx, SEED);
  assert.deepEqual(candidates, []);
  assert.equal(recorded.length, 0, 'no network call when budget-blocked');
});
