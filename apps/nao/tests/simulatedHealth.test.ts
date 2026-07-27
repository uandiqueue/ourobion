/**
 * Fixture-only tests for the simulated health-data generator + loader planning
 * (`src/lib/simulatedHealth.ts`). No live Supabase — everything under test is pure
 * (the /api/loader route handlers are IO glue over these functions, nao's
 * ingestControl convention). Run: node --test (Node >=26).
 *
 * Asserts:
 *  - determinism: identical options → identical rows; a different seed diverges;
 *  - correlated-shift shape: 'recent-dip' days sit clearly below baseline days for
 *    the driven metrics, and gut_comfort/mood co-move over a long steady stretch;
 *  - CHECK-constraint safety: every generated value stays inside the daily_gut_rows
 *    migration's CHECK ranges across a long horizon;
 *  - provenance: EVERY row (both tables) carries SIMULATED_DATA_ORIGIN;
 *  - day-continuation math: first load ends today; increments fill forward to today
 *    first, then backfill history; never a day after today;
 *  - request validation: days/seed/scenario bounds.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  DIP_DAYS,
  MAX_LOAD_DAYS,
  SIMULATED_DATA_ORIGIN,
  addDaysIso,
  diffDaysIso,
  generateSimulatedDays,
  planLoadRange,
  validateLoaderBody,
} from '../src/lib/simulatedHealth.ts';

const TODAY = '2026-07-24';

function mean(values: readonly number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function pearson(xs: readonly number[], ys: readonly number[]): number {
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  return num / Math.sqrt(dx * dy);
}

test('generateSimulatedDays: deterministic — same options, same rows; different seed diverges', () => {
  const opts = { startDate: '2026-07-01', days: 21, seed: 'abc', anchorDate: TODAY } as const;
  const a = generateSimulatedDays(opts);
  const b = generateSimulatedDays(opts);
  assert.deepEqual(a, b, 'same inputs must yield byte-identical rows (idempotent re-loads)');

  const c = generateSimulatedDays({ ...opts, seed: 'xyz' });
  assert.notDeepEqual(a, c, 'a different seed must yield a different dataset');
});

test('generateSimulatedDays: overlapping batches agree day-by-day (continuation stitches cleanly)', () => {
  const whole = generateSimulatedDays({ startDate: '2026-07-04', days: 21, seed: 's', anchorDate: TODAY });
  const tail = generateSimulatedDays({ startDate: '2026-07-11', days: 14, seed: 's', anchorDate: TODAY });
  assert.deepEqual(whole.slice(7), tail, 'each day depends only on (seed, scenario, anchor, date)');
});

test("correlated shift: 'recent-dip' days sit clearly below baseline for the driven metrics", () => {
  const days = generateSimulatedDays({ startDate: '2026-06-27', days: 28, seed: 'dip', anchorDate: TODAY });
  const dipStart = addDaysIso(TODAY, -(DIP_DAYS - 1));
  const dip = days.filter((d) => d.date >= dipStart);
  const base = days.filter((d) => d.date < dipStart);
  assert.equal(dip.length, DIP_DAYS);

  const by = (rows: typeof days, pick: (d: (typeof days)[number]) => number) => mean(rows.map(pick));
  assert.ok(
    by(base, (d) => d.gut.gut_comfort_score) - by(dip, (d) => d.gut.gut_comfort_score) >= 1,
    'gut_comfort drops ≥1 point in the dip',
  );
  assert.ok(
    by(base, (d) => d.gut.mood_score) - by(dip, (d) => d.gut.mood_score) >= 1,
    'mood drops ≥1 point in the dip',
  );
  assert.ok(
    by(base, (d) => d.wearable.sleep_duration_min) - by(dip, (d) => d.wearable.sleep_duration_min) >= 50,
    'sleep drops ≥50 min in the dip',
  );
  assert.ok(
    by(base, (d) => d.wearable.hrv_sdnn_ms) - by(dip, (d) => d.wearable.hrv_sdnn_ms) >= 8,
    'HRV drops ≥8 ms in the dip',
  );
});

test("'steady' scenario has no dip: recent days match the overall level", () => {
  const days = generateSimulatedDays({
    startDate: '2026-06-27',
    days: 28,
    seed: 'flat',
    scenario: 'steady',
    anchorDate: TODAY,
  });
  const dipStart = addDaysIso(TODAY, -(DIP_DAYS - 1));
  const recent = mean(days.filter((d) => d.date >= dipStart).map((d) => d.gut.gut_comfort_score));
  const overall = mean(days.map((d) => d.gut.gut_comfort_score));
  assert.ok(Math.abs(recent - overall) < 1, 'no systematic recent shift under steady');
});

test('correlation backbone: gut_comfort and mood co-move over a long steady stretch', () => {
  const days = generateSimulatedDays({
    startDate: '2026-01-01',
    days: 120,
    seed: 'corr',
    scenario: 'steady',
    anchorDate: TODAY,
  });
  const rho = pearson(
    days.map((d) => d.gut.gut_comfort_score),
    days.map((d) => d.gut.mood_score),
  );
  assert.ok(rho > 0.3, `expected shared-latent correlation > 0.3, got ${rho.toFixed(3)}`);
});

test('CHECK-constraint safety: every value in range across 120 days (incl. dip days)', () => {
  const days = generateSimulatedDays({ startDate: '2026-03-27', days: 120, seed: 'rng', anchorDate: '2026-07-24' });
  for (const d of days) {
    const g = d.gut;
    assert.ok(g.urine_colour >= 1 && g.urine_colour <= 8, `urine_colour ${g.urine_colour}`);
    assert.ok(g.stool_form >= 1 && g.stool_form <= 7, `stool_form ${g.stool_form}`);
    assert.ok(g.stool_count >= 0 && g.stool_count <= 10, `stool_count ${g.stool_count}`);
    assert.ok(g.outside_meals >= 0 && g.outside_meals <= 3, `outside_meals ${g.outside_meals}`);
    assert.ok(g.mosquito_bites >= 0 && g.mosquito_bites <= 20, `mosquito_bites ${g.mosquito_bites}`);
    for (const score of [g.energy_score, g.mood_score, g.gut_comfort_score]) {
      assert.ok(score >= 1 && score <= 5, `score ${score}`);
      assert.ok(Number.isInteger(score), 'ordinal scores are integers');
    }
    assert.ok(g.log_completeness >= 0 && g.log_completeness <= 100, `dqs ${g.log_completeness}`);
    assert.ok(g.notes.length <= 140, 'notes within the CHECK length');
    assert.ok(d.wearable.sleep_duration_min > 0 && Number.isInteger(d.wearable.sleep_duration_min));
    assert.ok(Number.isInteger(d.wearable.step_count));
  }
});

test('provenance: EVERY generated row is flagged simulated on both tables', () => {
  const days = generateSimulatedDays({ startDate: '2026-07-01', days: 30, seed: 'prov', anchorDate: TODAY });
  for (const d of days) {
    assert.equal(d.gut.data_origin, SIMULATED_DATA_ORIGIN, `gut row ${d.date}`);
    assert.equal(d.wearable.source, SIMULATED_DATA_ORIGIN, `wearable row ${d.date}`);
  }
});

test('planLoadRange: first load is one batch of N days ENDING today', () => {
  const plan = planLoadRange(null, 14, TODAY);
  assert.deepEqual(plan, {
    segments: [{ startDate: '2026-07-11', days: 14 }],
    forwardDays: 14,
    backfillDays: 0,
  });
  const last = addDaysIso(plan.segments[0].startDate, plan.segments[0].days - 1);
  assert.equal(last, TODAY, 'the first load must reach today (the engine evaluates today)');
});

test('planLoadRange: fills forward from maxDate+1, clamped at today', () => {
  const plan = planLoadRange({ minDate: '2026-07-01', maxDate: '2026-07-19' }, 5, TODAY);
  assert.deepEqual(plan.segments, [{ startDate: '2026-07-20', days: 5 }]);
  assert.equal(plan.forwardDays, 5);
  assert.equal(plan.backfillDays, 0);
});

test('planLoadRange: overflow past today becomes history backfill (forward first, then prepend)', () => {
  const plan = planLoadRange({ minDate: '2026-07-11', maxDate: '2026-07-22' }, 7, TODAY);
  assert.equal(plan.forwardDays, 2, 'only 2 days of forward headroom to today');
  assert.equal(plan.backfillDays, 5);
  assert.deepEqual(plan.segments, [
    { startDate: '2026-07-23', days: 2 },
    { startDate: '2026-07-06', days: 5 },
  ]);
});

test('planLoadRange: range already at today → pure backfill, never a day after today', () => {
  const plan = planLoadRange({ minDate: '2026-07-11', maxDate: TODAY }, 7, TODAY);
  assert.equal(plan.forwardDays, 0);
  assert.equal(plan.backfillDays, 7);
  assert.deepEqual(plan.segments, [{ startDate: '2026-07-04', days: 7 }]);
  const end = addDaysIso(plan.segments[0].startDate, plan.segments[0].days - 1);
  assert.equal(end, '2026-07-10', 'backfill ends where the existing range began');
});

test('diffDaysIso / addDaysIso round-trip', () => {
  assert.equal(diffDaysIso('2026-07-01', '2026-07-24'), 23);
  assert.equal(addDaysIso('2026-07-01', 23), '2026-07-24');
  assert.equal(addDaysIso('2026-07-01', -1), '2026-06-30');
});

test('validateLoaderBody: accepts an empty body and full valid bodies', () => {
  assert.equal(validateLoaderBody({}), null);
  assert.equal(validateLoaderBody({ days: 14, seed: 'run2-demo', scenario: 'recent-dip' }), null);
  assert.equal(validateLoaderBody({ days: MAX_LOAD_DAYS, scenario: 'steady' }), null);
});

test('validateLoaderBody: rejects bad days / seed / scenario / shapes', () => {
  assert.match(validateLoaderBody({ days: 0 }) ?? '', /between 1 and/);
  assert.match(validateLoaderBody({ days: -3 }) ?? '', /between 1 and/);
  assert.match(validateLoaderBody({ days: 3.5 }) ?? '', /between 1 and/);
  assert.match(validateLoaderBody({ days: MAX_LOAD_DAYS + 1 }) ?? '', /between 1 and/);
  assert.match(validateLoaderBody({ days: '14' }) ?? '', /between 1 and/);
  assert.match(validateLoaderBody({ seed: '' }) ?? '', /seed/);
  assert.match(validateLoaderBody({ seed: 'x'.repeat(65) }) ?? '', /seed/);
  assert.match(validateLoaderBody({ scenario: 'apocalypse' }) ?? '', /scenario/);
  assert.match(validateLoaderBody(null) ?? '', /JSON object/);
  assert.match(validateLoaderBody([1]) ?? '', /JSON object/);
});

// R4-U2 re-review finding N1: `seed` was length-capped but never
// charset-checked, so it flowed straight into recordControlEvent's audit
// `detail` at api/loader/route.ts untouched — a NUL (or any other character
// the database cannot store) inside it could suppress the `loader.simulate`
// audit row while the loader's own write (plain numeric rows, never the seed
// string itself) still succeeded.
test('validateLoaderBody: rejects a NUL, and any character outside the allowed charset, in seed', () => {
  const nul = String.fromCharCode(0);
  assert.match(validateLoaderBody({ seed: `run4-demo${nul}` }) ?? '', /seed/);
  for (const badSeed of ['has space', 'semi;colon', 'quote"mark', "slash/es", 'emoji\u{1F600}', 'newline\n']) {
    assert.match(validateLoaderBody({ seed: badSeed }) ?? '', /seed/, `"${badSeed}" must be rejected`);
  }
});

test('validateLoaderBody: accepts every seed value real callers pass today', () => {
  // DEFAULT_SEED (api/loader/route.ts's fallback), every seed literal used by
  // this file's own fixtures above ('abc', 'xyz', 's', 'dip', 'flat', 'corr',
  // 'rng', 'prov'), and a colon-namespaced value in the style
  // SIMULATED_DATA_ORIGIN already uses ('simulated:run2-demo').
  const realSeeds = [
    'run2-demo', // DEFAULT_SEED
    'abc',
    'xyz',
    's',
    'dip',
    'flat',
    'corr',
    'rng',
    'prov',
    'simulated:run4-demo',
    'a.b_c-D9',
  ];
  for (const seed of realSeeds) {
    assert.equal(validateLoaderBody({ seed }), null, `"${seed}" must be accepted`);
  }
});
