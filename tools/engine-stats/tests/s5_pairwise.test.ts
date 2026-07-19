// Coupling guard: adr-0002-s5-evaluator-stats (docs/graph/couplings.yaml).
// Vectors holding the S5 half of supabase/functions/evaluate-signals/stats.ts to ADR-0002:
// Spearman ρ with average-rank tie handling, Pyper–Peterman modified-Chelton N_eff
// (bias-corrected autocorrelations, ~N/5 lag truncation, canonical 2/N rendering),
// Benjamini–Hochberg step-up q-values, Student-t p-values, Fisher-z CI, evaluatePair
// null-alignment, and the deterministic fixed-window sign-stability gate.
//
// status: active.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  averageRanks,
  benjaminiHochberg,
  effectiveN,
  effectiveNPyperPeterman,
  evaluatePair,
  fisherConfidenceInterval,
  signStability,
  spearman,
  studentTTwoSidedP,
} from '../../../supabase/functions/evaluate-signals/stats.ts';
import { PAIR_CONFIG } from '../../../supabase/functions/evaluate-signals/config.ts';

function closeTo(actual: number, expected: number, tol: number, label: string) {
  assert.ok(
    Math.abs(actual - expected) < tol,
    `${label}: expected ${expected} ± ${tol}, got ${actual}`,
  );
}

// ─── Ranks + Spearman ρ ──────────────────────────────────────────────────────────────────

test('averageRanks: ties share the mean of the positions they occupy', () => {
  assert.deepEqual(averageRanks([10, 20, 30]), [1, 2, 3]);
  assert.deepEqual(averageRanks([1, 2, 2, 4]), [1, 2.5, 2.5, 4]);
  assert.deepEqual(averageRanks([7, 7, 7]), [2, 2, 2]);
});

test('Spearman without ties: hand-computed ρ = 0.8', () => {
  // Ranks are the values themselves; Pearson on ranks: cov 8, var 10 each → 0.8 exactly.
  assert.equal(spearman([1, 2, 3, 4, 5], [2, 1, 4, 3, 5]), 0.8);
});

test('Spearman with ties: hand-computed ρ = √0.1', () => {
  // a ranks [1, 2.5, 2.5, 4], b ranks [3, 1, 2, 4] → 1.5/√(4.5·5) = √0.1.
  closeTo(spearman([1, 2, 2, 4], [3, 1, 2, 4]), Math.sqrt(0.1), 1e-12, 'tied rho');
});

test('Spearman is rank-based: any monotone transform gives |ρ| = 1', () => {
  const x = [1, 2, 3, 4, 5, 6];
  closeTo(spearman(x, x.map((v) => v * v)), 1, 1e-12, 'monotone increasing');
  closeTo(spearman(x, x.map((v) => -Math.exp(v))), -1, 1e-12, 'monotone decreasing');
});

test('Spearman degenerate inputs: constant series and length mismatch → NaN', () => {
  assert.ok(Number.isNaN(spearman([1, 2, 3], [5, 5, 5])));
  assert.ok(Number.isNaN(spearman([1, 2], [1, 2, 3])));
  assert.ok(Number.isNaN(spearman([1], [1])));
});

// ─── Pyper–Peterman N_eff ────────────────────────────────────────────────────────────────

test('N_eff on a perfectly autocorrelated alternating pair: hand-computed N* = 2', () => {
  // a = b = [1,2,1,2,...] (n=10, lags 1..2): bias-corrected r(1) = −1, r(2) = +1 →
  // 1/N* = 1/10 + (2/10)(1 + 1) = 0.5 → N* = 2 (also the clamp floor).
  const alternating = [1, 2, 1, 2, 1, 2, 1, 2, 1, 2];
  assert.equal(effectiveN(alternating, alternating, PAIR_CONFIG), 2);
});

test('N_eff of a smooth autocorrelated series is well below N', () => {
  // Slow ramp with pairwise-repeated values → strong positive lag-1/2 autocorrelation.
  const ramp = Array.from({ length: 20 }, (_, i) => Math.floor(i / 2) + 1);
  const nEff = effectiveN(ramp, ramp, PAIR_CONFIG);
  assert.ok(nEff >= 2 && nEff < 15, `expected 2 ≤ N_eff < 15, got ${nEff}`);
});

test('N_eff clamps at N when the autocorrelation sum is non-positive (independence)', () => {
  // A constant partner series has zero autocorrelation at every lag → sum 0 → N* = N.
  const a = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3];
  const constant = Array(10).fill(7);
  assert.equal(effectiveN(a, constant, PAIR_CONFIG), 10);
});

// ─── nEffMethod toggle: P&P default byte-unchanged · xDF INTERIM seam (F6 / RU4d / Open-Q8) ──
// The mechanism is a swappable dispatcher; the default Pyper–Peterman path must be identical,
// and the 'xdf' branch must THROW (no unverified cross-correlation-aware science runs in-run).

const NEFF_METHOD_CASES: ReadonlyArray<readonly [string, number[], number[]]> = [
  ['alternating self-pair (N* = 2 clamp floor)', [1, 2, 1, 2, 1, 2, 1, 2, 1, 2], [1, 2, 1, 2, 1, 2, 1, 2, 1, 2]],
  ['smooth ramp self-pair (below N)', Array.from({ length: 20 }, (_, i) => Math.floor(i / 2) + 1), Array.from({ length: 20 }, (_, i) => Math.floor(i / 2) + 1)],
  ['independence clamp at N', [3, 1, 4, 1, 5, 9, 2, 6, 5, 3], Array(10).fill(7)],
];

test('nEffMethod: default (absent) reproduces the P&P N_eff vectors exactly', () => {
  // Regression guard: omitting nEffMethod must give the exact same result as the extracted
  // Pyper–Peterman helper — i.e. the dispatch changed nothing for the shipped default.
  for (const [label, a, b] of NEFF_METHOD_CASES) {
    assert.equal(effectiveN(a, b, PAIR_CONFIG), effectiveNPyperPeterman(a, b, PAIR_CONFIG), label);
  }
});

test("nEffMethod: explicit 'pyper-peterman' equals the default", () => {
  const cfg = { ...PAIR_CONFIG, nEffMethod: 'pyper-peterman' as const };
  for (const [label, a, b] of NEFF_METHOD_CASES) {
    assert.equal(effectiveN(a, b, cfg), effectiveN(a, b, PAIR_CONFIG), label);
  }
});

test("nEffMethod: 'xdf' throws the documented INTERIM error (no unverified science runs)", () => {
  const cfg = { ...PAIR_CONFIG, nEffMethod: 'xdf' as const };
  assert.throws(
    () => effectiveN([1, 2, 1, 2, 1, 2], [1, 2, 1, 2, 1, 2], cfg),
    /nEffMethod 'xdf' not yet implemented.*B5.*RU4d\/Open-Q8.*must not ship unverified/s,
  );
});

// ─── Student-t p-values ──────────────────────────────────────────────────────────────────

test('Student-t two-sided p: table anchors', () => {
  // t = 2, df = 10 → p = 0.07339 (standard table value).
  closeTo(studentTTwoSidedP(2, 10), 0.07339, 2e-4, 't=2 df=10');
  // t = 0 → p = 1; huge t → p → 0.
  assert.equal(studentTTwoSidedP(0, 10), 1);
  assert.ok(studentTTwoSidedP(50, 10) < 1e-9);
});

// ─── Benjamini–Hochberg ──────────────────────────────────────────────────────────────────

test('BH q-values match the published step-up example, in input order', () => {
  // R: p.adjust(c(0.005, 0.009, 0.05, 0.1, 0.2, 0.3), "BH")
  //    → 0.027 0.027 0.100 0.150 0.240 0.300
  // Shuffled input proves order preservation.
  const p = [0.1, 0.005, 0.3, 0.009, 0.2, 0.05];
  const expected = [0.15, 0.027, 0.3, 0.027, 0.24, 0.1];
  const q = benjaminiHochberg(p);
  assert.equal(q.length, 6);
  for (let i = 0; i < q.length; i++) closeTo(q[i], expected[i], 1e-12, `q[${i}]`);
});

test('BH edge cases: empty input, all-equal p, clamp at 1', () => {
  assert.deepEqual(benjaminiHochberg([]), []);
  assert.deepEqual(benjaminiHochberg([0.5, 0.5]), [0.5, 0.5]); // p·m/i monotone-corrected
  assert.deepEqual(benjaminiHochberg([0.9, 1]), [1, 1]);
});

// ─── Fisher-z confidence interval ────────────────────────────────────────────────────────

test('Fisher CI: r = 0.5, N_eff = 30 → 95% CI ≈ [0.17, 0.73] (textbook value)', () => {
  const ci = fisherConfidenceInterval(0.5, 30);
  closeTo(ci.low!, 0.17, 5e-3, 'ci low');
  closeTo(ci.high!, 0.729, 5e-3, 'ci high');
});

test('Fisher CI nulls out when N_eff ≤ 3', () => {
  assert.deepEqual(fisherConfidenceInterval(0.5, 3), { low: null, high: null });
});

// ─── evaluatePair: calendar alignment + flat-pair failure mode ───────────────────────────

test('evaluatePair uses only joint non-null days, in date order', () => {
  const a = [1, null, 3, 4, null, 6];
  const b = [2, 5, null, 8, 9, 12];
  const result = evaluatePair(a, b, PAIR_CONFIG); // joint days: indices 0, 3, 5
  assert.equal(result.nDays, 3);
  closeTo(result.rho, 1, 1e-12, 'joint rho');
});

test('evaluatePair on a flat pair → rho 0 / p 1 (a row distinguishable from "no data")', () => {
  const a = Array.from({ length: 20 }, (_, i) => i + 1).map((v) => v as number | null);
  const flat = Array(20).fill(4) as (number | null)[];
  const result = evaluatePair(a, flat, PAIR_CONFIG);
  assert.equal(result.rho, 0);
  assert.equal(result.p, 1);
  assert.equal(result.nDays, 20);
});

test('evaluatePair with < 2 joint days degenerates safely', () => {
  const result = evaluatePair([1, null, null], [null, 2, 3], PAIR_CONFIG);
  assert.equal(result.nDays, 0);
  assert.equal(result.p, 1);
});

// ─── Sign-stability over fixed deterministic windows ─────────────────────────────────────
// With the shipped config (60-day series, 3 runs, 10-day step) each run is a 40-day window
// at offsets 0 / 10 / 20 — fixed and reproducible (Invariant 1; never unseeded resampling).

const DAYS = 60;

test('a consistently monotone pair is sign-stable across all 3 windows', () => {
  const a = Array.from({ length: DAYS }, (_, i) => i + 1) as (number | null)[];
  const b = a.map((v) => (v as number) * 2 + 3) as (number | null)[];
  const result = signStability(a, b, PAIR_CONFIG);
  assert.equal(result.consistent, true);
  assert.equal(result.runRhos.length, PAIR_CONFIG.stabilityRuns);
  for (const rho of result.runRhos) closeTo(rho!, 1, 1e-12, 'window rho');
});

test('a sign flip between windows breaks stability', () => {
  // Tent-shaped partner: co-moves up in the earliest window, down in the latest.
  const a = Array.from({ length: DAYS }, (_, i) => i + 1) as (number | null)[];
  const tent = Array.from({ length: DAYS }, (_, i) => Math.min(i, DAYS - 1 - i)) as (number | null)[];
  const result = signStability(a, tent, PAIR_CONFIG);
  assert.equal(result.consistent, false);
  assert.ok(result.runRhos[0]! > 0, 'earliest window should co-move up');
  assert.ok(result.runRhos[PAIR_CONFIG.stabilityRuns - 1]! < 0, 'latest window should co-move down');
});

test('windows with too few joint days can never demonstrate stability', () => {
  const sparseA = Array(DAYS).fill(null) as (number | null)[];
  const sparseB = Array(DAYS).fill(null) as (number | null)[];
  for (let i = 0; i < 9; i++) {
    sparseA[i] = i + 1; // 9 joint days < minJointDays = 10, all in the earliest window
    sparseB[i] = i + 2;
  }
  const result = signStability(sparseA, sparseB, PAIR_CONFIG);
  assert.equal(result.consistent, false);
  assert.ok(result.runRhos.every((rho) => rho === null));
});
