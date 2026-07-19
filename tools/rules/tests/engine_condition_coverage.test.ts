// Coupling guard: rules-blueprint-to-engine-coverage (docs/graph/couplings.yaml). Every
// condition `type` used by a data/rules blueprint (including the leaves inside a coincidence
// conjunction) must have an evaluator branch in the refactored generate-insights engine
// (supabase/functions/generate-insights/evaluators.ts EVALUATORS), so an unevaluatable rule can
// never ship. Plus golden vectors per evaluator (rules-engine-design §C tests) — the evaluators
// are Deno-free pure functions, imported directly via tsx (the engine-stats mechanism).
//
// status: active (was planned until the engine refactor landed — U12).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { loadBlueprints } from '../lib/blueprints.mjs';
import {
  ALLOWED_LAG_DAYS,
  EVALUATORS,
  evaluateCoincidence,
  evaluateThreshold,
  evaluateTrend,
  windowedBaseline,
  type CoincidenceParams,
  type EngineBaseline,
} from '../../../supabase/functions/generate-insights/evaluators.ts';

const { blueprints, errors } = loadBlueprints();

function baseline(partial: Partial<EngineBaseline>): EngineBaseline {
  return {
    mean: 3,
    std_dev: 0.5,
    min: 2,
    max: 4,
    trend: 'stable',
    confidence: 'high',
    data_sources: ['self_report'],
    ...partial,
  };
}

test('every blueprint condition type (incl. coincidence leaves) has an evaluator branch', () => {
  assert.deepEqual(errors, []);
  assert.ok(blueprints.length > 0);
  const used = new Set<string>();
  for (const { blueprint } of blueprints) {
    used.add(blueprint.condition.type);
    if (blueprint.condition.type === 'coincidence') {
      for (const leaf of blueprint.condition.both) used.add(leaf.type);
    }
  }
  const covered = new Set(Object.keys(EVALUATORS));
  for (const type of used) {
    assert.ok(covered.has(type), `condition type "${type}" has no evaluator in EVALUATORS`);
  }
});

test('the shipped corpus exercises both scopes (single rules + the cross coincidence rule)', () => {
  const types = new Set(blueprints.map(({ blueprint }) => blueprint.condition.type));
  assert.ok(types.has('trend'), 'no trend blueprint shipped');
  assert.ok(types.has('threshold'), 'no threshold blueprint shipped');
  assert.ok(types.has('coincidence'), 'no cross-metric coincidence blueprint shipped');
});

test('every shipped coincidence lag is in the C10 set {0(null), 1, 2, 3, 7}', () => {
  for (const { relPath, blueprint } of blueprints) {
    if (blueprint.condition.type !== 'coincidence') continue;
    const lag = blueprint.condition.lagDays;
    assert.ok(
      lag === null || ALLOWED_LAG_DAYS.has(lag),
      `${relPath}: lagDays ${lag} outside the C10 lag set`,
    );
  }
});

// ─── Lag gate: {0,1,2,3,7} — lag 2 added (phase2-research-fixes C4·F5 / RU7 / A2) ─────────────
//
// The engine's load-time lag gate (generate-insights/index.ts) accepts a coincidence rule iff its
// lagDays is null (≡ lag 0) or a member of ALLOWED_LAG_DAYS. This pins the exact set after adding
// lag 2 (gut transit / DOMS both peak near the 1–3 day boundary the old {0,1,3,7} grid skipped),
// and proves lag 2 is now ACCEPTED while an out-of-set lag (4) is still REJECTED. Adding 2 only
// WIDENS what an author may specify — no shipped blueprint auto-expands across the set (each names
// a single lagDays), so lag 2 is inert until a rule opts into it.
test('ALLOWED_LAG_DAYS is exactly {1,2,3,7}: lag 2 accepted, lag 4 rejected (C4·F5)', () => {
  assert.deepEqual([...ALLOWED_LAG_DAYS].sort((a, b) => a - b), [1, 2, 3, 7]);
  assert.equal(ALLOWED_LAG_DAYS.has(2), true, 'lag 2 must now be accepted by the gate');
  assert.equal(ALLOWED_LAG_DAYS.has(4), false, 'lag 4 must still be rejected by the gate');
  assert.equal(ALLOWED_LAG_DAYS.has(1), true);
  assert.equal(ALLOWED_LAG_DAYS.has(3), true);
  assert.equal(ALLOWED_LAG_DAYS.has(7), true);
});

test('a coincidence rule can be evaluated at lagDays:2 (leaf 1 routed to the lag-2 window)', () => {
  const params: CoincidenceParams = {
    metricKeys: ['a_metric', 'b_metric'],
    both: [
      { type: 'trend', metricKey: 'a_metric', equals: 'rising', minConfidence: 'low' },
      { type: 'trend', metricKey: 'b_metric', equals: 'rising', minConfidence: 'low' },
    ],
    lagDays: 2,
    minConfidence: 'low',
  };
  const lookups: string[] = [];
  const getBaseline = (key: string, lag: number): EngineBaseline | null => {
    lookups.push(`${key}@${lag}`);
    return baseline({ trend: 'rising' });
  };
  assert.equal(evaluateCoincidence(params, getBaseline), true);
  // both[0] at lag 0, both[1] trailing by the new lag 2 (contract semantics).
  assert.deepEqual(lookups, ['a_metric@0', 'b_metric@2']);
});

// ─── Golden vectors: trend ─────────────────────────────────────────────────────────────────

test('trend evaluator fires on equality and respects the minConfidence floor', () => {
  const params = { metricKey: 'm', equals: 'rising', minConfidence: 'low' } as const;
  assert.equal(evaluateTrend(params, baseline({ trend: 'rising' })), true);
  assert.equal(evaluateTrend(params, baseline({ trend: 'falling' })), false);
  assert.equal(evaluateTrend(params, baseline({ trend: null })), false);
  assert.equal(evaluateTrend(params, null), false);
  // minConfidence generalizes notInsufficient(s): insufficient never fires, ladder is ordered.
  assert.equal(evaluateTrend(params, baseline({ trend: 'rising', confidence: 'insufficient' })), false);
  const strict = { ...params, minConfidence: 'high' } as const;
  assert.equal(evaluateTrend(strict, baseline({ trend: 'rising', confidence: 'medium' })), false);
  assert.equal(evaluateTrend(strict, baseline({ trend: 'rising', confidence: 'high' })), true);
});

// ─── Golden vectors: threshold ─────────────────────────────────────────────────────────────

test('threshold evaluator implements the 5 ops and never fires on a null field', () => {
  const p = (op: 'lt' | 'lte' | 'gt' | 'gte' | 'eq', value: number) =>
    ({ metricKey: 'm', field: 'std_dev', op, value, minConfidence: 'low' }) as const;
  const b = baseline({ std_dev: 1.0 });
  assert.equal(evaluateThreshold(p('lte', 1.0), b), true); // gut_form_stable boundary
  assert.equal(evaluateThreshold(p('lt', 1.0), b), false);
  assert.equal(evaluateThreshold(p('gt', 2.0), baseline({ std_dev: 2.5 })), true); // gut_form_variable
  assert.equal(evaluateThreshold(p('gte', 1.0), b), true);
  assert.equal(evaluateThreshold(p('eq', 1.0), b), true);
  assert.equal(evaluateThreshold(p('lte', 1.0), baseline({ std_dev: null })), false);
});

// ─── Golden vectors: coincidence (cross-metric, lagged) ────────────────────────────────────

test('coincidence evaluator requires both leaves, the lag routes leaf 1, and the rule floor binds both', () => {
  const params: CoincidenceParams = {
    metricKeys: ['a_metric', 'b_metric'],
    both: [
      { type: 'trend', metricKey: 'a_metric', equals: 'rising', minConfidence: 'low' },
      { type: 'trend', metricKey: 'b_metric', equals: 'rising', minConfidence: 'low' },
    ],
    lagDays: 1,
    minConfidence: 'low',
  };
  const lookups: string[] = [];
  const getBaseline = (key: string, lag: number): EngineBaseline | null => {
    lookups.push(`${key}@${lag}`);
    return baseline({ trend: 'rising' });
  };
  assert.equal(evaluateCoincidence(params, getBaseline), true);
  // both[0] evaluated at lag 0, both[1] lagged behind it by lagDays (the contract semantics).
  assert.deepEqual(lookups, ['a_metric@0', 'b_metric@1']);

  // One leaf failing kills the conjunction.
  assert.equal(
    evaluateCoincidence(params, (key) =>
      key === 'b_metric' ? baseline({ trend: 'falling' }) : baseline({ trend: 'rising' })),
    false,
  );
  // A missing baseline (no data in the lagged window) never fires.
  assert.equal(
    evaluateCoincidence(params, (key) => (key === 'b_metric' ? null : baseline({ trend: 'rising' }))),
    false,
  );
  // The rule-level minConfidence floor applies to BOTH snapshots.
  const strict = { ...params, minConfidence: 'high' as const };
  assert.equal(
    evaluateCoincidence(strict, (key) =>
      baseline({ trend: 'rising', confidence: key === 'b_metric' ? 'medium' : 'high' })),
    false,
  );
});

// ─── Windowed baseline (the lagged-leaf stats surface) matches compute-baselines' math ─────

test('windowedBaseline reproduces the S3 window stats and C5 confidence on a lagged window', () => {
  // 20 days of history ending 2026-07-16; window under test ends 2026-07-15 (lag 1).
  const series = new Map<string, number>();
  for (let i = 0; i < 20; i++) {
    const d = new Date(Date.UTC(2026, 5, 27 + i)); // 2026-06-27 .. 2026-07-16
    series.set(d.toISOString().split('T')[0]!, i); // a clean ramp 0..19
  }
  const b = windowedBaseline(series, '2026-07-15');
  assert.ok(b);
  // Window 2026-07-09..15 → values [12..18]; the day AFTER the window end must not leak in.
  assert.equal(b.mean, 15);
  assert.equal(b.min, 12);
  assert.equal(b.max, 18);
  assert.equal(b.trend, 'rising'); // late half clearly above early half (compute-baselines rule)
  assert.equal(b.confidence, 'high'); // 7 in-window days, 19 history days ≤ end ≥ 14
  // An empty window with zero history returns null (no snapshot → leaf never fires).
  assert.equal(windowedBaseline(new Map(), '2026-07-15'), null);
});

// ─── C5 medium-cutoff revert 5→7 (RU5b · phase2-research-fixes F2) ──────────────────────────
//
// The medium confidence floor was reverted from 5 back to 7 in-window days: the confirmed
// literature mildly favours 6–7 nights for "medium/acceptable" reliability and nothing supports
// 5, so the deployed 7 is the better-grounded choice. These boundary cases pin the reverted
// behaviour on a deterministic integer ramp — 6 in-window days is now `low` (was `medium` under
// the 5-day floor) and `medium`/`high` require the full 7-day window.
test('C5 confidence: medium floor is 7 in-window days (reverted 5→7 per RU5b)', () => {
  const endDay = '2026-07-15';
  // A clean (date → value) ramp of `historyDays` days ending on `endDay`, minus any `skip` dates
  // (thins in-window coverage without changing total history). Window = the 7 days ending endDay.
  const ramp = (historyDays: number, skip: string[] = []): Map<string, number> => {
    const m = new Map<string, number>();
    for (let i = 0; i < historyDays; i++) {
      const d = new Date(Date.UTC(2026, 6, 15));
      d.setUTCDate(d.getUTCDate() - (historyDays - 1 - i));
      const iso = d.toISOString().split('T')[0]!;
      if (!skip.includes(iso)) m.set(iso, i);
    }
    return m;
  };

  // days_of_data = 6 (drop one in-window day), abundant history → LOW (was `medium` at floor 5).
  const six = windowedBaseline(ramp(20, ['2026-07-10']), endDay);
  assert.ok(six);
  assert.equal(six.confidence, 'low');

  // days_of_data = 5 (drop two in-window days) → LOW — the crux of the revert (was `medium`).
  const five = windowedBaseline(ramp(20, ['2026-07-10', '2026-07-11']), endDay);
  assert.ok(five);
  assert.equal(five.confidence, 'low');

  // days_of_data = 7, total_history = 14 (≥ highMinHistoryDays) → HIGH.
  const sevenHigh = windowedBaseline(ramp(14), endDay);
  assert.ok(sevenHigh);
  assert.equal(sevenHigh.confidence, 'high');

  // days_of_data = 7, total_history = 13 (< highMinHistoryDays) → MEDIUM.
  const sevenMedium = windowedBaseline(ramp(13), endDay);
  assert.ok(sevenMedium);
  assert.equal(sevenMedium.confidence, 'medium');
});
