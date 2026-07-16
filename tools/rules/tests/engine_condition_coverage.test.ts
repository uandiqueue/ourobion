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

test('every shipped coincidence lag is in the C10 set {0(null), 1, 3, 7}', () => {
  for (const { relPath, blueprint } of blueprints) {
    if (blueprint.condition.type !== 'coincidence') continue;
    const lag = blueprint.condition.lagDays;
    assert.ok(
      lag === null || ALLOWED_LAG_DAYS.has(lag),
      `${relPath}: lagDays ${lag} outside the C10 lag set`,
    );
  }
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
