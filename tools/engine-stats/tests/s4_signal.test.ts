// Coupling guard: adr-0002-s4-signal-stats (docs/graph/couplings.yaml).
// Vectors holding the S4 half of supabase/functions/evaluate-signals/stats.ts to ADR-0002:
// robust median/MAD baseline (σ̂ = MAD/0.6745), |M| > 3.5 artifact rejection (boundary KEPT —
// the rule is strictly `>`), deadbandK·σ̂ 3-state deadband (boundary NEUTRAL — the rule is
// `≤`), baselineMinDays guard (nothing before 14 days), MAD-degeneracy fallback.
//
// status: active.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  MAD_TO_SIGMA,
  classifyDaily,
  fireRate,
  mad,
  median,
  rejectArtifacts,
} from '../../../supabase/functions/evaluate-signals/stats.ts';
import { SIGNAL_CONFIG } from '../../../supabase/functions/evaluate-signals/config.ts';

const DEADBAND_K = 1.0; // registry signal.deadbandK for all 16 baselineApplicable metrics (C3)

// ─── median / MAD ────────────────────────────────────────────────────────────────────────

test('median: odd, even, singleton', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  assert.equal(median([7]), 7);
  assert.ok(Number.isNaN(median([])));
});

test('MAD is the median absolute deviation about the median (unscaled)', () => {
  // NIST-style vector: median 4, |devs| = [3,2,1,0,1,2,3] → MAD 2.
  assert.equal(mad([1, 2, 3, 4, 5, 6, 7]), 2);
  // Constant series → MAD 0 (the degenerate case S4 must suppress on).
  assert.equal(mad([5, 5, 5, 5]), 0);
});

// ─── Artifact rejection: |M| > 3.5, boundary kept ────────────────────────────────────────
// Window [1..19, lo, hi] with lo/hi symmetric: median stays 10, MAD stays 5 (the two outlier
// deviations land past the middle of the sorted deviations), so M(hi) = 0.6745·(hi−10)/5.

const ARTIFACT_BASE = Array.from({ length: 19 }, (_, i) => i + 1); // 1..19, median 10, MAD 5

test('artifact rejection drops |M| > 3.5 and keeps the |M| = 3.5 boundary', () => {
  const exact = (3.5 * 5) / MAD_TO_SIGMA; // deviation whose modified z is exactly 3.5
  const boundary = [...ARTIFACT_BASE, 10 - exact, 10 + exact];
  assert.equal(median(boundary), 10);
  assert.equal(mad(boundary), 5);
  // Strictly `>` — the boundary points survive.
  assert.equal(rejectArtifacts(boundary, SIGNAL_CONFIG.artifactZMax).length, 21);

  const outlier = [...ARTIFACT_BASE, 10 - exact, 10 + exact * 1.001];
  const retained = rejectArtifacts(outlier, SIGNAL_CONFIG.artifactZMax);
  assert.equal(retained.length, 20); // only the high outlier dropped
  assert.ok(!retained.includes(10 + exact * 1.001));
  assert.ok(retained.includes(10 - exact));
});

test('artifact rejection is a no-op when MAD = 0 (degeneracy handled downstream)', () => {
  const flat = [5, 5, 5, 5, 5, 1000];
  assert.deepEqual(rejectArtifacts(flat, SIGNAL_CONFIG.artifactZMax), flat);
});

// ─── Minimum-baseline guard: < 14 days emits nothing ─────────────────────────────────────

test('fewer than baselineMinDays baseline points → suppressed neutral, no stats', () => {
  const thirteenDays = Array.from({ length: 13 }, (_, i) => i + 1);
  const signal = classifyDaily(thirteenDays, 999, DEADBAND_K, SIGNAL_CONFIG);
  assert.equal(signal.state, 'neutral');
  assert.equal(signal.suppressed, 'insufficient-baseline');
  assert.equal(signal.modifiedZ, null);
  assert.equal(signal.robustSigma, null);
});

test('artifact rejection eroding the window below baselineMinDays also suppresses', () => {
  // 14 raw days, but one is a wild artifact (M = 0.6745·992.5/3.5 ≈ 191) → 13 clean days.
  const withArtifact = [...Array.from({ length: 13 }, (_, i) => i + 1), 1000];
  const signal = classifyDaily(withArtifact, 7, DEADBAND_K, SIGNAL_CONFIG);
  assert.equal(signal.state, 'neutral');
  assert.equal(signal.suppressed, 'insufficient-baseline');
});

// ─── Deadband: neutral iff |x − median| ≤ deadbandK·σ̂, else up/down by sign ──────────────
// Baseline [1..15]: median 8, MAD 4 (max in-window |M| = 0.6745·7/4 ≈ 1.18 → nothing
// artifact-rejected), σ̂ = 4/0.6745 ≈ 5.9303.

const DEADBAND_BASE = Array.from({ length: 15 }, (_, i) => i + 1);
const SIGMA_HAT = 4 / MAD_TO_SIGMA;

test('deadband boundary is neutral (rule is ≤); just past it fires up/down', () => {
  const atBoundary = classifyDaily(DEADBAND_BASE, 8 + DEADBAND_K * SIGMA_HAT, DEADBAND_K, SIGNAL_CONFIG);
  assert.equal(atBoundary.state, 'neutral');
  assert.equal(atBoundary.suppressed, null);
  assert.equal(atBoundary.baselineMedian, 8);

  const justAbove = classifyDaily(DEADBAND_BASE, 8 + DEADBAND_K * SIGMA_HAT * 1.0001, DEADBAND_K, SIGNAL_CONFIG);
  assert.equal(justAbove.state, 'up');
  assert.equal(justAbove.suppressed, null);

  const justBelow = classifyDaily(DEADBAND_BASE, 8 - DEADBAND_K * SIGMA_HAT * 1.0001, DEADBAND_K, SIGNAL_CONFIG);
  assert.equal(justBelow.state, 'down');
});

test('inside the deadband is neutral; modified z is reported either way', () => {
  const inside = classifyDaily(DEADBAND_BASE, 10, DEADBAND_K, SIGNAL_CONFIG);
  assert.equal(inside.state, 'neutral');
  assert.ok(Math.abs(inside.modifiedZ! - (10 - 8) / SIGMA_HAT) < 1e-12);

  const fired = classifyDaily(DEADBAND_BASE, 20, DEADBAND_K, SIGNAL_CONFIG);
  assert.equal(fired.state, 'up');
  assert.ok(Math.abs(fired.modifiedZ! - (20 - 8) / SIGMA_HAT) < 1e-12);
});

test('per-metric deadbandK widens/narrows the neutral band', () => {
  const value = 8 + 1.4 * SIGMA_HAT;
  assert.equal(classifyDaily(DEADBAND_BASE, value, 1.0, SIGNAL_CONFIG).state, 'up');
  assert.equal(classifyDaily(DEADBAND_BASE, value, 1.5, SIGNAL_CONFIG).state, 'neutral');
});

// ─── MAD degeneracy fallback ─────────────────────────────────────────────────────────────

test('MAD = 0 (flat sensor) → suppressed neutral, never a division by zero', () => {
  const flat = [...Array(13).fill(5), 6]; // 14 days, >50% identical → MAD 0
  const signal = classifyDaily(flat, 100, DEADBAND_K, SIGNAL_CONFIG);
  assert.equal(signal.state, 'neutral');
  assert.equal(signal.suppressed, 'degenerate-mad');
  assert.equal(signal.robustSigma, null);
});

test('too few distinct in-window values → suppressed neutral (minDistinctValues guard)', () => {
  const twoValued = [...Array(7).fill(5), ...Array(7).fill(6)]; // MAD 0.5 > 0, but 2 distinct
  const signal = classifyDaily(twoValued, 100, DEADBAND_K, SIGNAL_CONFIG);
  assert.equal(signal.state, 'neutral');
  assert.equal(signal.suppressed, 'degenerate-mad');
});

// ─── fireRate: deadbandK calibration instrumentation (RU3c / ADR-0002 Open-Q2) ───────────
// Pure, deterministic, measurement-only. Fraction of classified days that fired (non-neutral).

test('fireRate: non-neutral fraction; all-neutral and empty are 0', () => {
  assert.equal(fireRate(['up', 'neutral', 'down', 'neutral']), 0.5);
  assert.equal(fireRate(['neutral', 'neutral', 'neutral']), 0);
  assert.equal(fireRate([]), 0);
  assert.equal(fireRate(['up', 'down', 'up']), 1);
  assert.equal(fireRate(['up']), 1);
});

test('fireRate through classifyDaily at k=1.0 is materially ABOVE an anomaly rate (RU3c)', () => {
  // Baseline [1..15]: median 8, MAD 4, σ̂ = 4/0.6745 ≈ 5.9303 (nothing artifact-rejected).
  // Feed a deterministic standard-normal-quantile sample as evaluated values = median + z·σ̂.
  // Because the deadband is |x−median| ≤ k·σ̂ ⟺ |z| ≤ k, σ̂ cancels: at k=1.0 a day fires iff
  // |z| > 1 — exactly the Gaussian tail P(|Z|>1) ≈ 0.3173 that RU3c flags against "anomaly".
  const zQuantiles = [
    // Φ⁻¹((i−0.5)/20) for i = 1..20 — 20 evenly-spaced standard-normal quantiles.
    -1.9600, -1.4395, -1.1503, -0.9346, -0.7554, -0.5978, -0.4538, -0.3186, -0.1891, -0.0627,
    0.0627, 0.1891, 0.3186, 0.4538, 0.5978, 0.7554, 0.9346, 1.1503, 1.4395, 1.9600,
  ];
  const sigmaHat = 4 / MAD_TO_SIGMA;
  const states = zQuantiles.map(
    (z) => classifyDaily(DEADBAND_BASE, 8 + z * sigmaHat, DEADBAND_K, SIGNAL_CONFIG).state,
  );
  // 6 of 20 quantiles have |z| > 1 (the ±1.15/±1.44/±1.96 pairs) → 0.30.
  const fr = fireRate(states);
  assert.equal(fr, 0.3);
  // The RU3c point: ~30% is far hotter than an "occasional anomaly alert" would be (< ~5-10%).
  assert.ok(fr > 0.25, `k=1.0 fire rate ${fr} should be materially above an anomaly rate`);
});
