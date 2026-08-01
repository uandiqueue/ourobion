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
  hasUnpricedCalls,
  isHardStopped,
  isStale,
  parseCapsBody,
  providerFamilyOf,
  rollupByProvider,
  spendFraction,
  type CapOverrideRow,
  type LlmRouterNode,
  type ModelSpendRow,
  type ModelStatusRow,
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

// ── providerFamilyOf / hasUnpricedCalls / rollupByProvider ───────────────────
//
// These back the provider rollup that replaced the hardcoded budget literals on
// BrainPipelinePanel + ModelsPanel. The point of the rollup is that every figure
// is derived from a published row, so the empty and zero-priced paths are
// asserted as carefully as the happy path.

test('provider family: every router.config.json prefix maps; unknown ids are named', () => {
  assert.equal(providerFamilyOf('gpt-5'), 'openai');
  assert.equal(providerFamilyOf('gpt-5-mini'), 'openai');
  assert.equal(providerFamilyOf('o3-mini'), 'openai');
  assert.equal(providerFamilyOf('o4-mini'), 'openai');
  assert.equal(providerFamilyOf('claude-sonnet-5'), 'anthropic');
  assert.equal(providerFamilyOf('gemini-2.5-flash'), 'google');
  assert.equal(providerFamilyOf('agnes-2.5-flash'), 'agnes');
  // Never guessed: an unpublished prefix is reported as unrecognized rather than
  // folded into a neighbouring family.
  assert.equal(providerFamilyOf('llama-4'), 'unrecognized');
  assert.equal(providerFamilyOf(''), 'unrecognized');
  assert.equal(providerFamilyOf('  GPT-5  '), 'openai'); // trimmed + case-folded
});

test('unpriced calls: calls with zero USD only; idle and paid nodes are not', () => {
  assert.equal(hasUnpricedCalls(10, 0), true);
  assert.equal(hasUnpricedCalls(0, 0), false); // idle today is not the same as unpriced
  assert.equal(hasUnpricedCalls(10, 0.5), false);
  assert.equal(hasUnpricedCalls(0, 0.5), false);
});

const PUBLISHED_AT = '2026-08-01T09:00:00.000Z';

function statusRow(node: LlmRouterNode, modelId: string, perDayUsdCap = 1.0): ModelStatusRow {
  return {
    node,
    model_id: modelId,
    route: 'api_worker',
    max_output_tokens: 8000,
    per_day_usd_cap: perDayUsdCap,
    per_run_token_cap: 60000,
    hard_stop_fraction: 0.95,
    test_mode: false,
    test_mode_reason: null,
    published_at: PUBLISHED_AT,
  };
}

function spendRow(node: LlmRouterNode, calls: number, usd: number): ModelSpendRow {
  return {
    day: '2026-08-01',
    node,
    calls,
    tokens_in: 1000,
    tokens_out: 500,
    usd,
    published_at: PUBLISHED_AT,
  };
}

test('provider rollup: empty status yields no rows, never a zeroed placeholder', () => {
  assert.deepEqual(rollupByProvider([], [], []), []);
  // Spend without a matching status row cannot invent a family either.
  assert.deepEqual(rollupByProvider([], [spendRow('synthesis', 40, 1.58452)], []), []);
});

test('provider rollup: sums calls, USD and caps per family, sorted by family', () => {
  const status = [
    statusRow('seeder', 'gpt-5-mini'),
    statusRow('synthesis', 'gpt-5'),
    statusRow('verifier', 'agnes-2.5-flash'),
  ];
  // The figures published on 2026-08-01 by tools/llm-router/scripts/publish-status.ts.
  const spend = [
    spendRow('seeder', 2, 0.0202325),
    spendRow('synthesis', 40, 1.58452),
    spendRow('verifier', 10, 0),
  ];
  const rollup = rollupByProvider(status, spend, []);
  assert.deepEqual(rollup.map((r) => r.family), ['agnes', 'openai']);

  const openai = rollup[1];
  assert.deepEqual(openai.nodes, ['seeder', 'synthesis']);
  assert.equal(openai.calls, 42);
  assert.equal(openai.usd, 0.0202325 + 1.58452);
  assert.equal(openai.dayCapUsd, 2.0);
  assert.equal(openai.unpricedCalls, false);
  assert.equal(openai.noRecordedCalls, false);
  assert.equal(openai.fraction, (0.0202325 + 1.58452) / 2.0);
});

test('provider rollup: a zero-priced node with real calls is flagged, not hidden', () => {
  const rollup = rollupByProvider(
    [statusRow('verifier', 'agnes-2.5-flash')],
    [spendRow('verifier', 10, 0)],
    [],
  );
  assert.equal(rollup.length, 1);
  const agnes = rollup[0];
  assert.equal(agnes.family, 'agnes');
  assert.equal(agnes.calls, 10); // the work stays visible
  assert.equal(agnes.usd, 0); // and so does the real zero
  assert.equal(agnes.unpricedCalls, true);
  assert.equal(agnes.noRecordedCalls, false);
  // Which is exactly why the fraction must not be rendered as headroom.
  assert.equal(agnes.fraction, 0);
});

test('provider rollup: a missing spend row means no recorded calls, not unpriced', () => {
  const rollup = rollupByProvider([statusRow('phrasing_card', 'gpt-5-mini')], [], []);
  assert.equal(rollup[0].noRecordedCalls, true);
  assert.equal(rollup[0].unpricedCalls, false);
  assert.equal(rollup[0].calls, 0);
  assert.equal(rollup[0].dayCapUsd, 1.0);
});

test('provider rollup: cap overrides replace the file cap in the family total', () => {
  const overrides: CapOverrideRow[] = [
    {
      node: 'synthesis',
      per_day_usd_cap: 3.5,
      per_run_token_cap: null,
      updated_by: '',
      updated_at: PUBLISHED_AT,
    },
    {
      node: 'seeder',
      per_day_usd_cap: null, // a run-cap-only override leaves the day cap at the file value
      per_run_token_cap: 100,
      updated_by: '',
      updated_at: PUBLISHED_AT,
    },
  ];
  const rollup = rollupByProvider(
    [statusRow('seeder', 'gpt-5-mini'), statusRow('synthesis', 'gpt-5')],
    [],
    overrides,
  );
  assert.equal(rollup.length, 1);
  assert.equal(rollup[0].dayCapUsd, 4.5); // 1.00 file + 3.50 override
});

test('provider rollup: an unrecognized model id is its own family, never merged', () => {
  const rollup = rollupByProvider(
    [statusRow('synthesis', 'gpt-5'), statusRow('extract_assist', 'mystery-1')],
    [spendRow('extract_assist', 3, 0.01)],
    [],
  );
  assert.deepEqual(rollup.map((r) => r.family), ['openai', 'unrecognized']);
  assert.deepEqual(rollup[1].nodes, ['extract_assist']);
});
