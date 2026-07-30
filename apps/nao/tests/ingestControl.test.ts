/**
 * Fixture-only tests for the ingestion remote-control plane (`src/lib/ingestControl.ts`).
 * No live R2/Workers/Supabase/GitHub — `normalizeIngestControl`/`validatePatchBody`/
 * `applyIngestControlPatch`/`validateTriggerBody` are pure. Run: node --test (Node >=26).
 *
 * Asserts:
 *  - normalizeIngestControl fills in a partial/older/malformed document with
 *    safe defaults, mirroring tools/brain-ingest/src/control.ts's own version;
 *  - validatePatchBody rejects a non-positive/NaN budget, accepts null (clear);
 *  - applyIngestControlPatch merges paused/limits independently and stamps
 *    updatedAt/updatedBy;
 *  - validateTriggerBody rejects an unknown seed or a non-positive/non-integer
 *    limit (the body /api/ingest-control/trigger validates before dispatching
 *    to GitHub Actions).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeIngestControl,
  validatePatchBody,
  applyIngestControlPatch,
  validateTriggerBody,
  validateTriggerBodyShape,
} from '../src/lib/ingestControl.ts';
import { buildSeedCatalog } from '../src/lib/seedsControl.ts';
import type { DbSeedRow } from '../src/lib/seedsControl.ts';
import { DEFAULT_INGEST_CONTROL, INGEST_SEED_TOPICS } from '../src/lib/types.ts';
import type { IngestControlConfig } from '../src/lib/types.ts';

function seedRow(overrides: Partial<DbSeedRow> = {}): DbSeedRow {
  return {
    id: 1,
    slug: 'magnesium_sleep',
    label: 'Magnesium and sleep',
    query_hint: null,
    enabled: true,
    created_by: 'uid-1',
    created_at: '2026-07-30T00:00:00Z',
    ...overrides,
  };
}

const STATIC_CATALOG = buildSeedCatalog(INGEST_SEED_TOPICS, []);

test('normalizeIngestControl: null/undefined degrades to defaults', () => {
  assert.deepEqual(normalizeIngestControl(null), DEFAULT_INGEST_CONTROL);
  assert.deepEqual(normalizeIngestControl(undefined), DEFAULT_INGEST_CONTROL);
});

test('normalizeIngestControl: fills in missing fields from a partial document', () => {
  const normalized = normalizeIngestControl({ paused: true });
  assert.equal(normalized.paused, true);
  assert.deepEqual(normalized.limits, {});
});

test('normalizeIngestControl: a fully-shaped document round-trips unchanged', () => {
  const doc: IngestControlConfig = {
    paused: false,
    limits: { openalexDailyUsd: 0.5 },
    updatedAt: '2026-07-02T00:00:00.000Z',
    updatedBy: 'a@b.com',
  };
  assert.deepEqual(normalizeIngestControl(doc), doc);
});

test('validatePatchBody: accepts an empty patch (no-op)', () => {
  assert.equal(validatePatchBody({}), null);
});

// R4-U2 re-review finding N1: `paused` was never type-checked at all, so it
// flowed straight into recordControlEvent's audit `detail` untouched. Layer 1
// (authz.ts's sanitizeStorageValue) now makes the AUDIT INSERT unfailable
// regardless; this is the boundary check that should have existed from the
// start — reject anything that isn't a real boolean.
test('validatePatchBody: rejects a non-boolean paused (string, number, null, object, and the string "true")', () => {
  assert.match(validatePatchBody({ paused: 'true' } as unknown as { paused?: boolean }) ?? '', /paused/);
  assert.match(validatePatchBody({ paused: 1 } as unknown as { paused?: boolean }) ?? '', /paused/);
  assert.match(validatePatchBody({ paused: null } as unknown as { paused?: boolean }) ?? '', /paused/);
  assert.match(validatePatchBody({ paused: {} } as unknown as { paused?: boolean }) ?? '', /paused/);
  assert.match(validatePatchBody({ paused: [] } as unknown as { paused?: boolean }) ?? '', /paused/);
});

test('validatePatchBody: accepts a real boolean paused (true and false)', () => {
  assert.equal(validatePatchBody({ paused: true }), null);
  assert.equal(validatePatchBody({ paused: false }), null);
});

test('validatePatchBody: rejects a non-positive/NaN budget, accepts null (clear) and a positive number', () => {
  assert.match(validatePatchBody({ openalexDailyUsd: 0 }) ?? '', /positive number/);
  assert.match(validatePatchBody({ openalexDailyUsd: -1 }) ?? '', /positive number/);
  assert.match(validatePatchBody({ openalexDailyUsd: Number.NaN }) ?? '', /positive number/);
  assert.equal(validatePatchBody({ openalexDailyUsd: null }), null, 'null clears the override — always valid');
  assert.equal(validatePatchBody({ openalexDailyUsd: 0.25 }), null);
});

test('applyIngestControlPatch: paused/limits are independent — patching one leaves the other', () => {
  const current: IngestControlConfig = { ...DEFAULT_INGEST_CONTROL, limits: { openalexDailyUsd: 0.5 } };
  const next = applyIngestControlPatch(current, { paused: true }, 'a@b.com', '2026-07-02T01:00:00.000Z');
  assert.equal(next.paused, true);
  assert.deepEqual(next.limits, { openalexDailyUsd: 0.5 }, 'untouched by a paused-only patch');
  assert.equal(next.updatedAt, '2026-07-02T01:00:00.000Z');
  assert.equal(next.updatedBy, 'a@b.com');
});

test('applyIngestControlPatch: openalexDailyUsd:null clears the override without touching other limits', () => {
  const current: IngestControlConfig = { ...DEFAULT_INGEST_CONTROL, limits: { openalexDailyUsd: 0.5 } };
  const next = applyIngestControlPatch(current, { openalexDailyUsd: null }, 'a@b.com', '2026-07-02T00:00:00.000Z');
  assert.deepEqual(next.limits, { openalexDailyUsd: undefined });
});

test('applyIngestControlPatch: an empty patch still re-stamps updatedAt/updatedBy (a no-op save)', () => {
  const next = applyIngestControlPatch(DEFAULT_INGEST_CONTROL, {}, 'a@b.com', '2026-07-02T03:00:00.000Z');
  assert.equal(next.updatedAt, '2026-07-02T03:00:00.000Z');
  assert.equal(next.paused, DEFAULT_INGEST_CONTROL.paused);
});

test('validateTriggerBody: accepts an empty body (all six seeds, no limit)', () => {
  assert.equal(validateTriggerBody({}, STATIC_CATALOG), null);
});

test('validateTriggerBody: rejects malformed bodies and slugs before dispatch', () => {
  for (const body of [null, [], 'x']) {
    assert.match(validateTriggerBody(body, STATIC_CATALOG) ?? '', /JSON object/);
  }
  assert.match(validateTriggerBody({ seed: 'Bad-Slug' }, STATIC_CATALOG) ?? '', /must match/);
  assert.match(validateTriggerBody({ seed: 'a'.repeat(65) }, STATIC_CATALOG) ?? '', /<= 64/);
});

test('validateTriggerBodyShape: validates a custom slug without claiming catalog runability', () => {
  assert.equal(validateTriggerBodyShape({ seed: 'custom_seed', limit: 20 }), null);
  assert.match(validateTriggerBodyShape({ seed: 'Bad-Slug' }) ?? '', /must match/);
});

test('validateTriggerBody: rejects an unknown seed', () => {
  assert.match(validateTriggerBody({ seed: 'not_a_real_seed' }, STATIC_CATALOG) ?? '', /unknown seed/);
});

test('validateTriggerBody: accepts every real seed topic', () => {
  for (const seed of ['gut_microbiome', 'hydration', 'antibiotics', 'sleep_hrv', 'dengue_vector', 'environmental_health']) {
    assert.equal(validateTriggerBody({ seed }, STATIC_CATALOG), null);
  }
});

test('validateTriggerBody: only enabled, non-shadowed custom seeds are runnable', () => {
  const catalog = buildSeedCatalog(INGEST_SEED_TOPICS, [
    seedRow(),
    seedRow({ id: 2, slug: 'disabled_seed', enabled: false }),
    seedRow({ id: 3, slug: 'hydration', enabled: true }),
  ]);
  assert.equal(validateTriggerBody({ seed: 'magnesium_sleep' }, catalog), null);
  assert.match(validateTriggerBody({ seed: 'disabled_seed' }, catalog) ?? '', /disabled/);
  assert.equal(
    validateTriggerBody({ seed: 'hydration' }, catalog),
    null,
    'the built-in remains runnable when a colliding custom row is shadowed',
  );
});

test('validateTriggerBody: a catalog-visible legacy 65-character seed cannot dispatch', () => {
  const slug = 'a'.repeat(65);
  const catalog = buildSeedCatalog(INGEST_SEED_TOPICS, [seedRow({ slug })]);
  const legacy = catalog.find((entry) => !entry.builtIn && entry.slug === slug)!;

  assert.match(legacy.unavailableReason ?? '', /invalid legacy slug/);
  assert.match(validateTriggerBody({ seed: slug }, catalog) ?? '', /<= 64/);
});

test('validateTriggerBody: rejects a non-positive or non-integer limit', () => {
  assert.match(validateTriggerBody({ limit: 0 }, STATIC_CATALOG) ?? '', /positive integer/);
  assert.match(validateTriggerBody({ limit: -5 }, STATIC_CATALOG) ?? '', /positive integer/);
  assert.match(validateTriggerBody({ limit: 3.5 }, STATIC_CATALOG) ?? '', /positive integer/);
  assert.equal(validateTriggerBody({ limit: 20 }, STATIC_CATALOG), null);
});
