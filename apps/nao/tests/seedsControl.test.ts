/**
 * Pure-logic tests for the seeds-as-data helpers (`src/lib/seedsControl.ts`,
 * O14 run-2 U10). No live Supabase — the /api/seeds route handlers are IO glue
 * over these functions (nao's ingestControl/modelsControl convention).
 *
 * Asserts:
 *  - slug derivation: lowercase, non-alphanumeric runs collapse to one `_`,
 *    trimmed, length-capped, and always table-CHECK-valid when non-empty;
 *  - add-seed body validation: label required, slug optional (derived),
 *    queryHint optional/trimmed/nulled, table CHECK mirrored;
 *  - toggle body validation: slug shape + boolean enabled only;
 *  - catalog composition: built-ins first (always enabled), db rows after,
 *    shadowed-by-built-in flagged honestly (pipeline merge is static-wins);
 *  - INGEST_SEED_TOPICS still mirrors the six static seeds.ts topics
 *    (hand-synced coupling — this test pins the shape the catalog relies on).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  SEED_SLUG_RE,
  buildSeedCatalog,
  deriveSeedSlug,
  parseAddSeedBody,
  parseToggleSeedBody,
  type DbSeedRow,
} from '../src/lib/seedsControl.ts';
import { INGEST_SEED_TOPICS } from '../src/lib/types.ts';

// ── slug derivation ───────────────────────────────────────────────────────────

test('deriveSeedSlug: label → table-valid slug', () => {
  assert.equal(deriveSeedSlug('Magnesium and sleep quality'), 'magnesium_and_sleep_quality');
  assert.equal(deriveSeedSlug('  Vitamin D — immune function!  '), 'vitamin_d_immune_function');
  assert.equal(deriveSeedSlug('CO2 & indoor air'), 'co2_indoor_air');
  assert.equal(deriveSeedSlug('___'), '');
  assert.equal(deriveSeedSlug('!!!'), '');
});

test('deriveSeedSlug: output always matches the table CHECK when non-empty, and is length-capped', () => {
  const labels = ['A'.repeat(500), 'weird---label___here', 'ünïcödé topic', '42 metrics'];
  for (const label of labels) {
    const slug = deriveSeedSlug(label);
    if (slug !== '') {
      assert.match(slug, SEED_SLUG_RE, `derived slug '${slug}' must satisfy the CHECK`);
      assert.ok(slug.length <= 64, 'slug capped at 64 chars');
      assert.ok(!slug.endsWith('_'), 'no trailing underscore survives the cap');
    }
  }
});

// ── add-seed body validation ─────────────────────────────────────────────────

test('parseAddSeedBody: happy path derives the slug and nulls an empty hint', () => {
  const r = parseAddSeedBody({ label: '  Magnesium and sleep quality ', queryHint: '  ' });
  assert.ok(r.ok);
  assert.deepEqual(r.value, {
    slug: 'magnesium_and_sleep_quality',
    label: 'Magnesium and sleep quality',
    queryHint: null,
  });
});

test('parseAddSeedBody: explicit slug and hint pass through validated', () => {
  const r = parseAddSeedBody({ label: 'Mg/sleep', slug: 'mg_sleep', queryHint: ' magnesium sleep RCT ' });
  assert.ok(r.ok);
  assert.deepEqual(r.value, { slug: 'mg_sleep', label: 'Mg/sleep', queryHint: 'magnesium sleep RCT' });
});

test('parseAddSeedBody: rejections — shape, label, slug CHECK, lengths', () => {
  for (const bad of [null, [], 'x', { label: '' }, { label: '   ' }, { label: 42 }]) {
    assert.equal(parseAddSeedBody(bad).ok, false, `must reject ${JSON.stringify(bad)}`);
  }
  assert.equal(parseAddSeedBody({ label: 'ok', slug: 'Bad-Slug' }).ok, false, 'slug must match CHECK');
  assert.equal(parseAddSeedBody({ label: 'ok', slug: 'a'.repeat(65) }).ok, false, 'slug length cap');
  assert.equal(parseAddSeedBody({ label: 'x'.repeat(121) }).ok, false, 'label length cap');
  assert.equal(parseAddSeedBody({ label: 'ok', queryHint: 'q'.repeat(301) }).ok, false, 'hint length cap');
  assert.equal(parseAddSeedBody({ label: '!!!' }).ok, false, 'derivation producing nothing is an error');
  assert.equal(parseAddSeedBody({ label: 'ok', queryHint: 7 }).ok, false, 'hint must be a string');
});

// ── toggle body validation ───────────────────────────────────────────────────

test('parseToggleSeedBody: valid toggle passes; bad slug/enabled rejected', () => {
  const r = parseToggleSeedBody({ slug: 'mg_sleep', enabled: false });
  assert.ok(r.ok);
  assert.deepEqual(r.value, { slug: 'mg_sleep', enabled: false });

  for (const bad of [
    { slug: 'Bad Slug', enabled: true },
    { slug: 'mg_sleep', enabled: 'yes' },
    { slug: '', enabled: true },
    {},
    null,
  ]) {
    assert.equal(parseToggleSeedBody(bad).ok, false, `must reject ${JSON.stringify(bad)}`);
  }
});

// ── catalog composition ──────────────────────────────────────────────────────

function row(overrides: Partial<DbSeedRow>): DbSeedRow {
  return {
    id: 1,
    slug: 'mg_sleep',
    label: 'Magnesium and sleep',
    query_hint: null,
    enabled: true,
    created_by: 'uid-1',
    created_at: '2026-07-24T15:00:00Z',
    ...overrides,
  };
}

test('buildSeedCatalog: built-ins first (always enabled), db rows after in order', () => {
  const catalog = buildSeedCatalog(INGEST_SEED_TOPICS, [
    row({ id: 1, slug: 'mg_sleep' }),
    row({ id: 2, slug: 'coffee_gut', label: 'Coffee and the gut', enabled: false, query_hint: 'coffee gut' }),
  ]);
  assert.equal(catalog.length, INGEST_SEED_TOPICS.length + 2);
  for (let i = 0; i < INGEST_SEED_TOPICS.length; i++) {
    assert.equal(catalog[i]!.slug, INGEST_SEED_TOPICS[i]);
    assert.equal(catalog[i]!.builtIn, true);
    assert.equal(catalog[i]!.enabled, true);
    assert.equal(catalog[i]!.shadowedByBuiltIn, false);
  }
  const mg = catalog[INGEST_SEED_TOPICS.length]!;
  assert.deepEqual(mg, {
    slug: 'mg_sleep',
    label: 'Magnesium and sleep',
    queryHint: null,
    enabled: true,
    builtIn: false,
    shadowedByBuiltIn: false,
    createdAt: '2026-07-24T15:00:00Z',
  });
  const coffee = catalog[INGEST_SEED_TOPICS.length + 1]!;
  assert.equal(coffee.enabled, false);
  assert.equal(coffee.queryHint, 'coffee gut');
});

test('buildSeedCatalog: a db row shadowing a built-in slug is flagged (static wins in the pipeline)', () => {
  const catalog = buildSeedCatalog(INGEST_SEED_TOPICS, [row({ slug: 'hydration' })]);
  const shadowed = catalog.find((c) => !c.builtIn && c.slug === 'hydration')!;
  assert.equal(shadowed.shadowedByBuiltIn, true);
});

// ── coupling: the built-in mirror still matches seeds.ts's six topics ────────

test('INGEST_SEED_TOPICS: still the six static topics, all CHECK-valid slugs', () => {
  assert.equal(INGEST_SEED_TOPICS.length, 6);
  for (const t of INGEST_SEED_TOPICS) assert.match(t, SEED_SLUG_RE);
});
