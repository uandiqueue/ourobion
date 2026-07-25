/**
 * Pure-logic tests for the /models panel helpers (`src/lib/modelsControl.ts`,
 * O10 run-2 U8). No live Supabase — the /api/models route handlers are IO glue
 * over these functions (nao's ingestControl convention). Run: node --test.
 *
 * Asserts:
 *  - caps-body validation: node whitelist, null-clears, positivity, the two
 *    bound mirrors (US$5.00 / 200000 tokens), integer-only run cap, cents
 *    rounding for the USD cap;
 *  - effective-cap precedence (override replaces file value);
 *  - spend fraction + hard-stop line semantics (>= 95%);
 *  - snapshot staleness (1h threshold; unparsable timestamps are stale).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  LLM_ROUTER_NODES,
  MAX_PER_DAY_USD_CAP,
  MAX_PER_RUN_TOKEN_CAP,
  STALE_AFTER_MS,
  effectiveCap,
  isHardStopped,
  isStale,
  parseCapsBody,
  spendFraction,
} from '../src/lib/modelsControl.ts';

// ── parseCapsBody ────────────────────────────────────────────────────────────

test('caps body: happy path with both values', () => {
  const r = parseCapsBody({ node: 'phrasing_card', perDayUsdCap: 0.5, perRunTokenCap: 30000 });
  assert.ok(r.ok);
  assert.deepEqual(r.value, { node: 'phrasing_card', perDayUsdCap: 0.5, perRunTokenCap: 30000 });
});

test('caps body: null / absent values clear that override', () => {
  const r = parseCapsBody({ node: 'verifier', perDayUsdCap: null });
  assert.ok(r.ok);
  assert.deepEqual(r.value, { node: 'verifier', perDayUsdCap: null, perRunTokenCap: null });
});

test('caps body: every known node passes; unknown or missing node fails', () => {
  for (const node of LLM_ROUTER_NODES) {
    assert.ok(parseCapsBody({ node }).ok, node);
  }
  for (const bad of [{ node: 'model_id_editor' }, {}, { node: 42 }, null, [], 'x']) {
    assert.equal(parseCapsBody(bad).ok, false);
  }
});

test('caps body: bounds mirror the migration CHECKs', () => {
  assert.ok(parseCapsBody({ node: 'seeder', perDayUsdCap: MAX_PER_DAY_USD_CAP }).ok);
  assert.equal(parseCapsBody({ node: 'seeder', perDayUsdCap: MAX_PER_DAY_USD_CAP + 0.01 }).ok, false);
  assert.ok(parseCapsBody({ node: 'seeder', perRunTokenCap: MAX_PER_RUN_TOKEN_CAP }).ok);
  assert.equal(parseCapsBody({ node: 'seeder', perRunTokenCap: MAX_PER_RUN_TOKEN_CAP + 1 }).ok, false);
});

test('caps body: non-positive, non-numeric, and non-integer run caps fail', () => {
  assert.equal(parseCapsBody({ node: 'seeder', perDayUsdCap: 0 }).ok, false);
  assert.equal(parseCapsBody({ node: 'seeder', perDayUsdCap: -1 }).ok, false);
  assert.equal(parseCapsBody({ node: 'seeder', perDayUsdCap: '0.5' }).ok, false);
  assert.equal(parseCapsBody({ node: 'seeder', perDayUsdCap: Number.NaN }).ok, false);
  assert.equal(parseCapsBody({ node: 'seeder', perRunTokenCap: 100.5 }).ok, false);
  assert.equal(parseCapsBody({ node: 'seeder', perRunTokenCap: 0 }).ok, false);
});

test('caps body: USD cap is rounded to cents (numeric(8,2) granularity)', () => {
  const r = parseCapsBody({ node: 'seeder', perDayUsdCap: 0.4999999 });
  assert.ok(r.ok);
  assert.equal(r.value.perDayUsdCap, 0.5);
  // A value that rounds to 0 cents is rejected, not silently zeroed.
  assert.equal(parseCapsBody({ node: 'seeder', perDayUsdCap: 0.001 }).ok, false);
});

// ── effectiveCap ─────────────────────────────────────────────────────────────

test('effective cap: override replaces the file value; null/undefined fall through', () => {
  assert.deepEqual(effectiveCap(1.0, 0.5), { value: 0.5, overridden: true });
  assert.deepEqual(effectiveCap(1.0, null), { value: 1.0, overridden: false });
  assert.deepEqual(effectiveCap(1.0, undefined), { value: 1.0, overridden: false });
  // Overrides may also RAISE the cap (bounded upstream at US$5 / 200k).
  assert.deepEqual(effectiveCap(1.0, 2.5), { value: 2.5, overridden: true });
});

// ── spendFraction / isHardStopped ────────────────────────────────────────────

test('spend fraction + hard stop: 95% line is inclusive; degenerate caps are 0', () => {
  assert.equal(spendFraction(0.5, 1.0), 0.5);
  assert.equal(spendFraction(0.5, 0), 0);
  assert.equal(isHardStopped(0.9499, 1.0, 0.95), false);
  assert.equal(isHardStopped(0.95, 1.0, 0.95), true); // AT the line = stopped (router semantics)
  assert.equal(isHardStopped(0.00015125, 1.0, 0.95), false); // U1's real spend: nowhere close
});

// ── isStale ──────────────────────────────────────────────────────────────────

test('staleness: >1h old is stale, fresher is not, unparsable is stale', () => {
  const now = Date.parse('2026-07-24T12:00:00.000Z');
  assert.equal(isStale('2026-07-24T11:30:00.000Z', now), false);
  assert.equal(isStale(new Date(now - STALE_AFTER_MS).toISOString(), now), false); // exactly 1h = still fresh
  assert.equal(isStale('2026-07-24T10:59:59.000Z', now), true);
  assert.equal(isStale('not-a-date', now), true);
});
