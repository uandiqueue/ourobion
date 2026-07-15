/**
 * b2 venue-lookup tests (brain-support-models-design §2 (b2), phase2-run-config
 * C8) — node:test, via tsx.
 *
 * NO network: the client takes an injected fetch serving real-shaped OpenAlex
 * Sources fixtures. Proves:
 *  - ISSN normalization (hyphen insertion, X check digit, junk → null);
 *  - the client builds `/sources/issn:<issn>` with the polite mailto, maps
 *    `summary_stats` (incl. the literal "2yr_mean_citedness" key), `is_core`,
 *    `type`; 404 → typed unresolved (not an error); 5xx → thrown, NO retry;
 *  - C8 banding incl. the exact boundary values (h=100 → high, h=99 → moderate,
 *    h=50 → moderate, h=49 → low), SJR quartile ORs, preprint precedence over
 *    h-index, name-pattern preprint detection, unknown for unresolved venues
 *    (never a silent 'low');
 *  - the per-ISSN cache: miss fetches + persists, hit skips the fetch, entries
 *    survive a re-open, corrupt file tolerated, unresolved lookups cached too.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  fetchVenueByIssn,
  mapSourceToVenueInfo,
  normalizeIssn,
  unresolvedVenueInfo,
  type OpenAlexSourceEntity,
  type VenueInfo,
} from '../src/venue/openalexSources.js';
import {
  bandImpactTier,
  isPreprintVenue,
  IMPACT_BANDS_C8,
} from '../src/venue/banding.js';
import { VenueCache, lookupVenueCached, VENUE_CACHE_FILENAME } from '../src/venue/cache.js';

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures + doubles
// ─────────────────────────────────────────────────────────────────────────────

const HERE = dirname(fileURLToPath(import.meta.url));
const JOURNAL = JSON.parse(
  readFileSync(join(HERE, 'fixtures', 'openalex-source-journal.json'), 'utf8'),
) as OpenAlexSourceEntity;
const REPOSITORY = JSON.parse(
  readFileSync(join(HERE, 'fixtures', 'openalex-source-repository.json'), 'utf8'),
) as OpenAlexSourceEntity;

const NOW = (): Date => new Date('2026-07-15T12:00:00.000Z');

/** An injected fetch serving `bodyByIssn`; unknown ISSNs get a 404. Records URLs. */
function makeFetch(bodyByIssn: Record<string, OpenAlexSourceEntity>): {
  fetchFn: typeof fetch;
  urls: string[];
} {
  const urls: string[] = [];
  const fetchFn = (async (input: string | URL | Request): Promise<Response> => {
    const url = String(input);
    urls.push(url);
    const m = url.match(/sources\/issn:([^?]+)/);
    const body = m ? bodyByIssn[m[1] as string] : undefined;
    if (body === undefined) {
      return new Response('{"error":"not found"}', { status: 404, statusText: 'Not Found' });
    }
    return new Response(JSON.stringify(body), { status: 200, statusText: 'OK' });
  }) as typeof fetch;
  return { fetchFn, urls };
}

/** A resolved VenueInfo with overridable fields (banding-table cases). */
function venue(partial: Partial<VenueInfo> = {}): VenueInfo {
  return {
    issn: '1234-5678',
    resolved: true,
    sourceId: 'S1',
    displayName: 'Journal of Testing',
    type: 'journal',
    issnL: '1234-5678',
    hIndex: null,
    twoYrMeanCitedness: null,
    isCore: true,
    worksCount: 1000,
    fetchedAt: NOW().toISOString(),
    ...partial,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ISSN normalization
// ─────────────────────────────────────────────────────────────────────────────

test('normalizeIssn: hyphenated, bare, lowercase-x, padded forms', () => {
  assert.equal(normalizeIssn('0028-0836'), '0028-0836');
  assert.equal(normalizeIssn('00280836'), '0028-0836');
  assert.equal(normalizeIssn(' 2692-8205 '), '2692-8205');
  assert.equal(normalizeIssn('1550-527x'), '1550-527X');
});

test('normalizeIssn: junk is null, never a throw', () => {
  assert.equal(normalizeIssn('not-an-issn'), null);
  assert.equal(normalizeIssn('12345678901'), null);
  assert.equal(normalizeIssn(''), null);
});

// ─────────────────────────────────────────────────────────────────────────────
// Client
// ─────────────────────────────────────────────────────────────────────────────

test('fetchVenueByIssn: builds issn: URL with mailto, maps the journal fixture', async () => {
  const { fetchFn, urls } = makeFetch({ '0028-0836': JOURNAL });
  const info = await fetchVenueByIssn('00280836', {
    fetchFn,
    contactEmail: 'test@ourobion.dev',
    now: NOW,
  });
  assert.equal(urls.length, 1);
  assert.match(urls[0]!, /^https:\/\/api\.openalex\.org\/sources\/issn:0028-0836\?/);
  assert.match(urls[0]!, /mailto=test%40ourobion\.dev/);
  assert.equal(info.resolved, true);
  assert.equal(info.sourceId, 'S137773608'); // URL prefix stripped
  assert.equal(info.displayName, 'Nature');
  assert.equal(info.type, 'journal');
  assert.equal(info.hIndex, 1331);
  assert.equal(info.twoYrMeanCitedness, 19.0298);
  assert.equal(info.isCore, true);
  assert.equal(info.worksCount, 432093);
  assert.equal(info.fetchedAt, NOW().toISOString());
});

test('fetchVenueByIssn: 404 → typed unresolved outcome, not an error', async () => {
  const { fetchFn } = makeFetch({});
  const info = await fetchVenueByIssn('0000-0000', { fetchFn, now: NOW });
  assert.equal(info.resolved, false);
  assert.equal(info.sourceId, null);
  assert.equal(info.hIndex, null);
});

test('fetchVenueByIssn: non-ISSN input short-circuits without a fetch', async () => {
  const { fetchFn, urls } = makeFetch({ '0028-0836': JOURNAL });
  const info = await fetchVenueByIssn('garbage', { fetchFn, now: NOW });
  assert.equal(info.resolved, false);
  assert.equal(urls.length, 0);
});

test('fetchVenueByIssn: 5xx throws HTTP error, single attempt (house style: no retry)', async () => {
  let calls = 0;
  const fetchFn = (async (): Promise<Response> => {
    calls += 1;
    return new Response('oops', { status: 503, statusText: 'Service Unavailable' });
  }) as typeof fetch;
  await assert.rejects(
    fetchVenueByIssn('0028-0836', { fetchFn, now: NOW }),
    /HTTP 503/,
  );
  assert.equal(calls, 1);
});

test('mapSourceToVenueInfo: missing summary_stats degrades to nulls', () => {
  const info = mapSourceToVenueInfo('1234-5678', { display_name: 'Sparse' }, NOW().toISOString());
  assert.equal(info.resolved, true);
  assert.equal(info.hIndex, null);
  assert.equal(info.twoYrMeanCitedness, null);
  assert.equal(info.isCore, null);
});

// ─────────────────────────────────────────────────────────────────────────────
// Banding (C8) — table incl. boundaries
// ─────────────────────────────────────────────────────────────────────────────

test('banding: h-index boundaries (100 → high, 99 → moderate, 50 → moderate, 49 → low)', () => {
  const cases: Array<[number, string]> = [
    [100, 'high'],
    [99, 'moderate'],
    [50, 'moderate'],
    [49, 'low'],
    [0, 'low'],
  ];
  for (const [h, expected] of cases) {
    const outcome = bandImpactTier(venue({ hIndex: h }));
    assert.equal(outcome.kind, 'resolved', `h=${h}`);
    assert.equal(outcome.kind === 'resolved' && outcome.tier, expected, `h=${h}`);
  }
});

test('banding: SJR quartile ORs with h-index (Q1 → high, Q2 → moderate, Q3/Q4 → low)', () => {
  const q1 = bandImpactTier(venue({ hIndex: 10 }), { sjrQuartile: 1 });
  assert.deepEqual(q1, { kind: 'resolved', tier: 'high', reason: 'sjr-q1' });
  const q2 = bandImpactTier(venue({ hIndex: 10 }), { sjrQuartile: 2 });
  assert.deepEqual(q2, { kind: 'resolved', tier: 'moderate', reason: 'sjr-q2' });
  for (const q of [3, 4] as const) {
    const outcome = bandImpactTier(venue({ hIndex: 10 }), { sjrQuartile: q });
    assert.equal(outcome.kind === 'resolved' && outcome.tier, 'low', `q=${q}`);
  }
  // h-index can still lift a Q3 venue (OR semantics, per C8).
  const q3h = bandImpactTier(venue({ hIndex: 150 }), { sjrQuartile: 3 });
  assert.equal(q3h.kind === 'resolved' && q3h.tier, 'high');
});

test('banding: journal fixture (h=1331) → high; without SJR input the path is OpenAlex-only', () => {
  const info = mapSourceToVenueInfo('0028-0836', JOURNAL, NOW().toISOString());
  const outcome = bandImpactTier(info);
  assert.equal(outcome.kind === 'resolved' && outcome.tier, 'high');
});

test('banding: repository fixture → preprint even with h-index 214 (precedence)', () => {
  const info = mapSourceToVenueInfo('2692-8205', REPOSITORY, NOW().toISOString());
  assert.equal(isPreprintVenue(info), true);
  const outcome = bandImpactTier(info);
  assert.equal(outcome.kind === 'resolved' && outcome.tier, 'preprint');
});

test('banding: preprint by name pattern when type is not repository', () => {
  const byName = bandImpactTier(venue({ displayName: 'Research Square (Preprints)', type: 'other' }));
  assert.equal(byName.kind === 'resolved' && byName.tier, 'preprint');
  const arxivLike = bandImpactTier(venue({ displayName: 'medRxiv', type: 'journal', hIndex: 120 }));
  assert.equal(arxivLike.kind === 'resolved' && arxivLike.tier, 'preprint');
});

test('banding: resolvable venue with no stats and no SJR → low (C8 else-branch)', () => {
  const outcome = bandImpactTier(venue({ hIndex: null }));
  assert.deepEqual(outcome, {
    kind: 'resolved',
    tier: 'low',
    reason: 'resolvable-venue-below-bands',
  });
});

test('banding: unresolved venue → typed unknown, never a silent low', () => {
  const outcome = bandImpactTier(unresolvedVenueInfo('0000-0000', NOW().toISOString()));
  assert.equal(outcome.kind, 'unknown');
  assert.match(outcome.kind === 'unknown' ? outcome.reason : '', /venue-unresolved/);
});

test('banding: thresholds come from the config object (override respected)', () => {
  const outcome = bandImpactTier(venue({ hIndex: 10 }), {
    thresholds: { ...IMPACT_BANDS_C8, highHIndexMin: 10 },
  });
  assert.equal(outcome.kind === 'resolved' && outcome.tier, 'high');
});

// ─────────────────────────────────────────────────────────────────────────────
// Per-ISSN cache
// ─────────────────────────────────────────────────────────────────────────────

function tmpCacheDir(): string {
  return mkdtempSync(join(tmpdir(), 'venue-cache-'));
}

test('cache: miss fetches + persists; hit skips the fetch entirely', async () => {
  const dir = tmpCacheDir();
  const cache = VenueCache.open(dir);
  const { fetchFn, urls } = makeFetch({ '0028-0836': JOURNAL });

  const miss = await lookupVenueCached('0028-0836', cache, { fetchFn, now: NOW });
  assert.equal(miss.cacheHit, false);
  assert.equal(miss.venue.displayName, 'Nature');
  assert.equal(urls.length, 1);

  const hit = await lookupVenueCached('00280836', cache, { fetchFn, now: NOW }); // un-hyphenated alias
  assert.equal(hit.cacheHit, true);
  assert.equal(hit.venue.displayName, 'Nature');
  assert.equal(urls.length, 1); // no second fetch
});

test('cache: entries survive a re-open (file-backed)', async () => {
  const dir = tmpCacheDir();
  const { fetchFn, urls } = makeFetch({ '2692-8205': REPOSITORY });
  await lookupVenueCached('2692-8205', VenueCache.open(dir), { fetchFn, now: NOW });

  const reopened = VenueCache.open(dir);
  assert.equal(reopened.size, 1);
  const { cacheHit, venue: info } = await lookupVenueCached('2692-8205', reopened, {
    fetchFn,
    now: NOW,
  });
  assert.equal(cacheHit, true);
  assert.equal(info.type, 'repository');
  assert.equal(urls.length, 1);
});

test('cache: unresolved lookups are cached too (a 404 is an answer)', async () => {
  const dir = tmpCacheDir();
  const cache = VenueCache.open(dir);
  const { fetchFn, urls } = makeFetch({});
  const first = await lookupVenueCached('0000-0000', cache, { fetchFn, now: NOW });
  assert.equal(first.venue.resolved, false);
  const second = await lookupVenueCached('0000-0000', cache, { fetchFn, now: NOW });
  assert.equal(second.cacheHit, true);
  assert.equal(urls.length, 1);
});

test('cache: corrupt file tolerated (starts clean, then persists over it)', async () => {
  const dir = tmpCacheDir();
  writeFileSync(join(dir, VENUE_CACHE_FILENAME), '{not json', 'utf8');
  const cache = VenueCache.open(dir);
  assert.equal(cache.size, 0);
  const { fetchFn } = makeFetch({ '0028-0836': JOURNAL });
  await lookupVenueCached('0028-0836', cache, { fetchFn, now: NOW });
  assert.equal(VenueCache.open(dir).size, 1);
});

test('cache: non-ISSN input is not cached (uncacheable key)', async () => {
  const dir = tmpCacheDir();
  const cache = VenueCache.open(dir);
  const { fetchFn, urls } = makeFetch({});
  const { venue: info, cacheHit } = await lookupVenueCached('garbage', cache, {
    fetchFn,
    now: NOW,
  });
  assert.equal(info.resolved, false);
  assert.equal(cacheHit, false);
  assert.equal(urls.length, 0);
  assert.equal(cache.size, 0);
});
