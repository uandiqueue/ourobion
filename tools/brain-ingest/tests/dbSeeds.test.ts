/**
 * O14 seeds-as-data tests (run-2 U10) — node:test via tsx, NO network.
 *
 * Covers the reader's four load-bearing behaviours: shape conversion (a db row
 * becomes a static-Seed-shaped topic; query_hint falls back to the label),
 * FAIL-SOFT (absent env / unreachable / non-array / HTTP error → undefined +
 * exactly one loud warning, never a throw), merge semantics (dedupe by slug,
 * STATIC wins on collision), and the merged-pool counts the CLI header prints
 * ("N static + M db"). `fetch` is injected — offline by construction.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { fetchDbSeeds, mergeSeeds, loadMergedSeeds } from '../src/seeder/dbSeeds.js';
import { SEEDS } from '../src/seeds.js';
import type { Seed } from '../src/types.js';

const ENV = { SUPABASE_URL: 'http://127.0.0.1:54321', SUPABASE_SERVICE_ROLE_KEY: 'svc-key' };

function okFetch(rows: unknown): {
  fetchFn: (url: string, init: RequestInit) => Promise<Response>;
  calls: Array<{ url: string; init: RequestInit }>;
} {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchFn = async (url: string, init: RequestInit): Promise<Response> => {
    calls.push({ url, init });
    return {
      ok: true,
      status: 200,
      json: async () => rows,
      text: async () => JSON.stringify(rows),
    } as unknown as Response;
  };
  return { fetchFn, calls };
}

// ── fetchDbSeeds ─────────────────────────────────────────────────────────────

test('dbSeeds: rows convert to the static Seed shape; query_hint falls back to label', async () => {
  const { fetchFn, calls } = okFetch([
    { slug: 'magnesium_sleep', label: 'Magnesium and sleep quality', query_hint: 'magnesium supplementation sleep quality' },
    { slug: 'coffee_gut', label: 'Coffee and the gut', query_hint: null },
    { slug: 'zinc_mood', label: '  Zinc and mood  ', query_hint: '   ' },
  ]);
  const warnings: string[] = [];
  const seeds = await fetchDbSeeds({ env: ENV, fetchFn, warn: (m) => warnings.push(m) });

  assert.deepEqual(seeds, [
    { topic: 'magnesium_sleep', query: 'magnesium supplementation sleep quality', topicTags: ['magnesium_sleep'] },
    { topic: 'coffee_gut', query: 'Coffee and the gut', topicTags: ['coffee_gut'] },
    { topic: 'zinc_mood', query: 'Zinc and mood', topicTags: ['zinc_mood'] },
  ]);
  assert.equal(warnings.length, 0);

  // Only ENABLED seeds are requested, with the service key on the wire.
  assert.equal(calls.length, 1);
  assert.ok(calls[0]!.url.includes('/rest/v1/ingestion_seeds'), 'reads the O14 table');
  assert.ok(calls[0]!.url.includes('enabled=eq.true'), 'disabled seeds never reach the pipeline');
  const headers = calls[0]!.init.headers as Record<string, string>;
  assert.equal(headers.apikey, 'svc-key');
});

test('dbSeeds: a malformed row is skipped individually (warned), not fatal', async () => {
  const { fetchFn } = okFetch([
    { slug: 'Bad Slug!', label: 'invalid slug' },
    { slug: 'good_one', label: 'Good one' },
    { slug: 'no_label' },
  ]);
  const warnings: string[] = [];
  const seeds = await fetchDbSeeds({ env: ENV, fetchFn, warn: (m) => warnings.push(m) });
  assert.deepEqual(
    seeds!.map((s) => s.topic),
    ['good_one'],
  );
  assert.equal(warnings.length, 2);
  assert.ok(warnings.every((w) => w.includes('skipping malformed row')));
});

test('dbSeeds: a legacy 65-character slug is excluded from the CLI merged pool', async () => {
  const tooLong = 'a'.repeat(65);
  const { fetchFn } = okFetch([
    { slug: tooLong, label: 'Legacy invalid seed' },
    { slug: 'good_after_legacy', label: 'Good after legacy' },
  ]);
  const warnings: string[] = [];
  const merged = await loadMergedSeeds({ env: ENV, fetchFn, warn: (m) => warnings.push(m) });

  assert.equal(merged.dbAvailable, true);
  assert.equal(merged.dbCount, 1);
  assert.equal(merged.seeds.some((seed) => seed.topic === tooLong), false);
  assert.equal(merged.seeds.some((seed) => seed.topic === 'good_after_legacy'), true);
  assert.equal(warnings.length, 1);
  assert.ok(warnings[0]!.includes('skipping malformed row'));
});

test('dbSeeds: FAIL-SOFT — absent env → undefined + one loud warning, no fetch', async () => {
  let fetched = false;
  const warnings: string[] = [];
  const seeds = await fetchDbSeeds({
    env: {},
    fetchFn: async () => {
      fetched = true;
      throw new Error('must not be called');
    },
    warn: (m) => warnings.push(m),
  });
  assert.equal(seeds, undefined);
  assert.equal(fetched, false);
  assert.equal(warnings.length, 1);
  assert.ok(warnings[0]!.includes('STATIC seed topics only'), 'the warning is loud about the fallback');
});

test('dbSeeds: FAIL-SOFT — HTTP error / non-array / thrown fetch → undefined + one warning each', async () => {
  const cases: Array<(url: string, init: RequestInit) => Promise<Response>> = [
    async () =>
      ({ ok: false, status: 500, text: async () => 'boom', json: async () => ({}) }) as unknown as Response,
    okFetch({ not: 'an array' }).fetchFn,
    async () => {
      throw new Error('ECONNREFUSED');
    },
  ];
  for (const fetchFn of cases) {
    const warnings: string[] = [];
    const seeds = await fetchDbSeeds({ env: ENV, fetchFn, warn: (m) => warnings.push(m) });
    assert.equal(seeds, undefined);
    assert.equal(warnings.length, 1);
    assert.ok(warnings[0]!.includes('STATIC seed topics only'));
    assert.ok(warnings[0]!.includes('fail-soft'));
  }
});

// ── mergeSeeds ───────────────────────────────────────────────────────────────

const DB_SEED: Seed = { topic: 'magnesium_sleep', query: 'magnesium sleep', topicTags: ['magnesium_sleep'] };

test('merge: db seeds append after statics; counts feed the "N static + M db" header', () => {
  const merged = mergeSeeds(SEEDS, [DB_SEED]);
  assert.equal(merged.staticCount, 6);
  assert.equal(merged.dbCount, 1);
  assert.equal(merged.dbAvailable, true);
  assert.deepEqual(
    merged.seeds.map((s) => s.topic),
    [...SEEDS.map((s) => s.topic), 'magnesium_sleep'],
  );
});

test('merge: STATIC wins on slug collision — the shadowing db row is dropped with a warning', () => {
  const shadow: Seed = { topic: 'hydration', query: 'db tries to replace hydration', topicTags: ['hydration'] };
  const warnings: string[] = [];
  const merged = mergeSeeds(SEEDS, [shadow, DB_SEED], (m) => warnings.push(m));
  assert.equal(merged.dbCount, 1, 'shadowed row does not count');
  const hydration = merged.seeds.find((s) => s.topic === 'hydration')!;
  assert.equal(hydration.query, 'hydration water intake physiology', 'the static seed survives untouched');
  assert.equal(warnings.length, 1);
  assert.ok(warnings[0]!.includes("'hydration'"));
  assert.ok(warnings[0]!.includes('static wins'));
});

test('merge: db seeds unavailable (fail-soft) → static-only pool, dbAvailable=false', () => {
  const merged = mergeSeeds(SEEDS, undefined);
  assert.equal(merged.dbAvailable, false);
  assert.equal(merged.dbCount, 0);
  assert.deepEqual(
    merged.seeds.map((s) => s.topic),
    SEEDS.map((s) => s.topic),
  );
});

test('merge: db seeds dedupe against each other by slug (first wins)', () => {
  const dupe: Seed = { topic: 'magnesium_sleep', query: 'second copy', topicTags: ['magnesium_sleep'] };
  const warnings: string[] = [];
  const merged = mergeSeeds(SEEDS, [DB_SEED, dupe], (m) => warnings.push(m));
  assert.equal(merged.dbCount, 1);
  assert.equal(merged.seeds.filter((s) => s.topic === 'magnesium_sleep').length, 1);
  assert.equal(merged.seeds.find((s) => s.topic === 'magnesium_sleep')!.query, 'magnesium sleep');
  assert.equal(warnings.length, 1);
});

// ── loadMergedSeeds (the CLI's one call) ─────────────────────────────────────

test('loadMergedSeeds: boundary configured → 6 static + N db in one pool', async () => {
  const { fetchFn } = okFetch([
    { slug: 'magnesium_sleep', label: 'Magnesium and sleep quality', query_hint: null },
  ]);
  const merged = await loadMergedSeeds({ env: ENV, fetchFn, warn: () => {} });
  assert.equal(merged.staticCount, 6);
  assert.equal(merged.dbCount, 1);
  assert.equal(merged.dbAvailable, true);
  assert.equal(merged.seeds.length, 7);
});

test('loadMergedSeeds: boundary absent → the six static topics, one warning', async () => {
  const warnings: string[] = [];
  const merged = await loadMergedSeeds({ env: {}, warn: (m) => warnings.push(m) });
  assert.equal(merged.dbAvailable, false);
  assert.deepEqual(
    merged.seeds.map((s) => s.topic),
    SEEDS.map((s) => s.topic),
  );
  assert.equal(warnings.length, 1);
});
