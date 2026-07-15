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
} from '../src/lib/ingestControl.ts';
import { DEFAULT_INGEST_CONTROL } from '../src/lib/types.ts';
import type { IngestControlConfig } from '../src/lib/types.ts';

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
  assert.equal(validateTriggerBody({}), null);
});

test('validateTriggerBody: rejects an unknown seed', () => {
  assert.match(validateTriggerBody({ seed: 'not_a_real_seed' }) ?? '', /unknown seed/);
});

test('validateTriggerBody: accepts every real seed topic', () => {
  for (const seed of ['gut_microbiome', 'hydration', 'antibiotics', 'sleep_hrv', 'dengue_vector', 'environmental_health']) {
    assert.equal(validateTriggerBody({ seed }), null);
  }
});

test('validateTriggerBody: rejects a non-positive or non-integer limit', () => {
  assert.match(validateTriggerBody({ limit: 0 }) ?? '', /positive integer/);
  assert.match(validateTriggerBody({ limit: -5 }) ?? '', /positive integer/);
  assert.match(validateTriggerBody({ limit: 3.5 }) ?? '', /positive integer/);
  assert.equal(validateTriggerBody({ limit: 20 }), null);
});
