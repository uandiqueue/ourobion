// supabase/functions/evaluate-signals/stats.ts
//
// The pure statistical core for S4 (robust 3-state signal) and S5 (n=1 pairwise evaluator),
// exactly as specified by ADR-0002 (docs/development/decisions/0002-anomaly-definition.md):
//   S4 — median/MAD robust baseline (σ̂ = MAD/0.6745), |M| > 3.5 artifact rejection,
//        deadbandK·σ̂ 3-state deadband, baselineMinDays guard, MAD-degeneracy fallback.
//   S5 — Spearman ρ (average-rank tie handling), Pyper–Peterman modified-Chelton N_eff,
//        Student-t p-value on N_eff − 2 df, Benjamini–Hochberg step-up q-values,
//        Fisher-z confidence interval, sign-stability over fixed deterministic windows.
//
// DELIBERATELY dependency-free and free of Deno/Node globals: this file is imported by the
// Deno edge function (index.ts) AND directly by the node test suite in
// tools/engine-stats/tests/ (via tsx) — one source file, no mirror, no drift possible.
// Everything here is a deterministic pure function (Invariant 1: deterministic serve path).

// ─── Configuration types (values ship in config.ts, never inline — ADR-0002) ───────────

export interface SignalConfig {
  /** Rolling baseline window length in days (excludes the evaluated day). */
  windowDays: number
  /** Minimum non-null days in-window before any state is emitted. */
  baselineMinDays: number
  /** Artifact rejection: drop window points with |modified z| above this. */
  artifactZMax: number
  /** MAD-degeneracy guard: minimum distinct retained values to trust σ̂. */
  minDistinctValues: number
}

/**
 * S5 effective-sample-size method (F6 / RU4d). Values ship in config.ts; the dispatcher in
 * `effectiveN` defaults to `'pyper-peterman'` when `PairConfig.nEffMethod` is absent.
 *   'pyper-peterman' — the shipped Bartlett/Pyper–Peterman modified-Chelton estimator (default).
 *   'xdf'            — the cross-correlation-aware Afyouni–Smith–Nichols (2019) estimator; an
 *                      INTERIM seam that THROWS until a faithful port is verified (ADR-0002 Open-Q8).
 */
export type NEffMethod = "pyper-peterman" | "xdf"

export interface PairConfig {
  /** Pyper–Peterman lag truncation as a fraction of N (ADR-0002: ~N/5 → 0.2). */
  maxLagFraction: number
  /** Stability gate: number of fixed deterministic sub-windows (ADR-0002: 3). */
  stabilityRuns: number
  /** Stability gate: forward step in days between consecutive sub-windows. */
  stabilityStepDays: number
  /** Minimum joint non-null days for a pair row / a stability run (architecture §S5 failure mode). */
  minJointDays: number
  /**
   * S5 effective-N method (F6 / RU4d). Optional; ABSENT ⇒ `'pyper-peterman'`, so existing
   * callers and test fixtures are unaffected and the P&P result stays byte-identical.
   * `'xdf'` selects the INTERIM seam in `effectiveN` (throws until the faithful port lands).
   */
  nEffMethod?: NEffMethod
}

// ─── Robust location/scale (S4) ─────────────────────────────────────────────────────────

/** Φ⁻¹(0.75): makes MAD a consistent estimator of σ for Gaussian data (Iglewicz–Hoaglin). */
export const MAD_TO_SIGMA = 0.6745

export function median(values: readonly number[]): number {
  if (values.length === 0) return NaN
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/** Median absolute deviation about the series median (not rescaled). */
export function mad(values: readonly number[]): number {
  const med = median(values)
  return median(values.map((v) => Math.abs(v - med)))
}

/**
 * Artifact rejection (ADR-0002 S4 threshold #1): drop points whose modified z-score
 * |M| = |0.6745·(x − median)/MAD| exceeds artifactZMax. The boundary itself is KEPT
 * (the rule is strictly `>`). If MAD = 0 the scores are undefined — nothing is dropped
 * (the degeneracy fallback downstream suppresses the signal instead).
 */
export function rejectArtifacts(values: readonly number[], artifactZMax: number): number[] {
  const med = median(values)
  const madValue = mad(values)
  if (madValue === 0) return [...values]
  return values.filter((v) => Math.abs((MAD_TO_SIGMA * (v - med)) / madValue) <= artifactZMax)
}

export type SignalState = "up" | "neutral" | "down"

export interface DailySignal {
  state: SignalState
  /** Modified z-score of the evaluated value vs the cleaned baseline (null when suppressed). */
  modifiedZ: number | null
  /** Why the signal was forced neutral, when it was. */
  suppressed: "insufficient-baseline" | "degenerate-mad" | null
  baselineMedian: number | null
  /** Robust scale σ̂ = MAD/0.6745 of the cleaned baseline (null when suppressed). */
  robustSigma: number | null
}

/**
 * S4 daily 3-state classification (ADR-0002):
 *   1. Guard: fewer than baselineMinDays baseline points → suppressed neutral.
 *   2. Artifact-reject the baseline window (|M| > artifactZMax). If rejection leaves fewer
 *      than baselineMinDays CLEAN points, the baseline is not trustworthy either →
 *      suppressed neutral (conservative reading of the ADR guard; judgment call, recorded
 *      in the U7 session log).
 *   3. Degeneracy fallback: MAD = 0 or too few distinct retained values → suppressed neutral.
 *   4. Deadband: neutral iff |x − median| ≤ deadbandK·σ̂ (boundary inclusive), else up/down.
 */
export function classifyDaily(
  baselineValues: readonly number[],
  value: number,
  deadbandK: number,
  cfg: SignalConfig,
): DailySignal {
  if (baselineValues.length < cfg.baselineMinDays) {
    return {
      state: "neutral",
      modifiedZ: null,
      suppressed: "insufficient-baseline",
      baselineMedian: null,
      robustSigma: null,
    }
  }

  const retained = rejectArtifacts(baselineValues, cfg.artifactZMax)
  if (retained.length < cfg.baselineMinDays) {
    return {
      state: "neutral",
      modifiedZ: null,
      suppressed: "insufficient-baseline",
      baselineMedian: null,
      robustSigma: null,
    }
  }
  const med = median(retained)
  const madValue = mad(retained)
  const distinct = new Set(retained).size
  if (madValue === 0 || distinct < cfg.minDistinctValues) {
    return {
      state: "neutral",
      modifiedZ: null,
      suppressed: "degenerate-mad",
      baselineMedian: Number.isNaN(med) ? null : med,
      robustSigma: null,
    }
  }

  const sigma = madValue / MAD_TO_SIGMA
  const modifiedZ = (value - med) / sigma
  const state: SignalState =
    Math.abs(value - med) <= deadbandK * sigma ? "neutral" : value > med ? "up" : "down"
  return { state, modifiedZ, suppressed: null, baselineMedian: med, robustSigma: sigma }
}

/**
 * Fraction of classified days that fired (non-neutral). Pure, deterministic instrumentation
 * for `deadbandK` calibration (RU3c / ADR-0002 Open-Q2): under a Gaussian, k = 1.0 leaves
 * ~68.3% of days neutral and fires ~31.7% (heavier tails fire more), so a run's observed
 * fire rate is the datum needed to decide whether k matches the intended product behaviour
 * (occasional anomaly alert vs ~1-in-3 daily 3-state nudge) and to later target a fire rate.
 * MEASUREMENT ONLY — this reads classifier output; it changes no threshold or classification.
 * Returns 0 for an empty input.
 */
export function fireRate(states: readonly SignalState[]): number {
  if (states.length === 0) return 0
  let fired = 0
  for (const s of states) if (s !== "neutral") fired++
  return fired / states.length
}

// ─── Ranking + Spearman ρ (S5) ──────────────────────────────────────────────────────────

/** Average ranks (1-based); ties share the mean of the positions they occupy. */
export function averageRanks(values: readonly number[]): number[] {
  const order = values.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0])
  const ranks = new Array<number>(values.length)
  let i = 0
  while (i < order.length) {
    let j = i
    while (j + 1 < order.length && order[j + 1][0] === order[i][0]) j++
    const avgRank = (i + j) / 2 + 1
    for (let k = i; k <= j; k++) ranks[order[k][1]] = avgRank
    i = j + 1
  }
  return ranks
}

function pearson(a: readonly number[], b: readonly number[]): number {
  const n = a.length
  const meanA = a.reduce((s, v) => s + v, 0) / n
  const meanB = b.reduce((s, v) => s + v, 0) / n
  let num = 0
  let denA = 0
  let denB = 0
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA
    const db = b[i] - meanB
    num += da * db
    denA += da * da
    denB += db * db
  }
  if (denA === 0 || denB === 0) return NaN
  return num / Math.sqrt(denA * denB)
}

/**
 * Spearman rank correlation with average-rank tie handling (Pearson on ranks — the
 * tie-correct general form; `simple-statistics` ships no rank correlation, so this is the
 * custom reducer ADR-0002 calls for). NaN when either series is constant (flat sensor).
 */
export function spearman(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length || a.length < 2) return NaN
  return pearson(averageRanks(a), averageRanks(b))
}

// ─── Pyper–Peterman effective N (S5) ────────────────────────────────────────────────────

/**
 * Lag-j autocorrelation with the Pyper–Peterman N/(N−j) bias correction
 * (Box–Jenkins estimator × N/(N−j)). 0 for a constant series.
 */
export function biasCorrectedAutocorr(values: readonly number[], lag: number): number {
  const n = values.length
  if (lag <= 0 || lag >= n) return 0
  const mean = values.reduce((s, v) => s + v, 0) / n
  let denom = 0
  for (const v of values) denom += (v - mean) ** 2
  if (denom === 0) return 0
  let num = 0
  for (let t = 0; t + lag < n; t++) num += (values[t] - mean) * (values[t + lag] - mean)
  return (n / (n - lag)) * (num / denom)
}

/**
 * Pyper–Peterman (1998) modified-Chelton effective sample size:
 *   1/N* = 1/N + (2/N)·Σ_{j=1..J} r_XX(j)·r_YY(j),  J = floor(N·maxLagFraction)
 * with bias-corrected autocorrelations. Clamped to [2, N] (a negative-autocorrelation sum
 * cannot make the series MORE informative than independent observations; nor do we allow
 * a degenerate df). The coded 2/N coefficient + N/(N−j) correction are the canonical
 * Bartlett/Bayley–Hammersley/Pyper–Peterman form — verify-first A1 resolved ADR-0002 Open-Q1
 * (`phase2-research-fixes-findings.md` §A1); `1 + 4Σ/N` is the non-canonical rendering, not this.
 *
 * This is the default `effectiveN` path, extracted verbatim so the dispatcher below leaves the
 * P&P arithmetic and result BYTE-IDENTICAL.
 */
export function effectiveNPyperPeterman(
  a: readonly number[],
  b: readonly number[],
  cfg: PairConfig,
): number {
  const n = Math.min(a.length, b.length)
  if (n < 2) return n
  const maxLag = Math.floor(n * cfg.maxLagFraction)
  let sum = 0
  for (let j = 1; j <= maxLag; j++) {
    sum += biasCorrectedAutocorr(a, j) * biasCorrectedAutocorr(b, j)
  }
  const invNStar = 1 / n + (2 / n) * sum
  if (invNStar <= 1 / n) return n // clamp at N (independence or negative-sum case)
  return Math.max(2, Math.min(n, 1 / invNStar))
}

/**
 * Effective-N dispatcher (S5). Reads `cfg.nEffMethod`, DEFAULTING to `'pyper-peterman'` when
 * absent so every existing caller/fixture is unaffected and the default computation is identical.
 *   'pyper-peterman' (default) → `effectiveNPyperPeterman` (byte-identical result).
 *   'xdf'                      → an INTERIM seam that THROWS (see below).
 *
 * ── INTERIM PROVENANCE (F6 / RU4d / ADR-0002 Open-Q8) ────────────────────────────────────────
 * The Pyper–Peterman/Bartlett estimator depends only on each series' OWN autocorrelation
 * (Σ ρ_XX·ρ_YY) and is "substantially biased by non-zero cross-correlation" — the exact regime
 * this detector operates in, since it selects pairs BECAUSE they co-move (RU4d). The principled
 * fix is the cross-correlation-aware xDF (Afyouni–Smith–Nichols 2019). It is NOT hand-rolled in
 * this run: the exact Afyouni equations are not obtainable from an accessible source, and a
 * faithful xDF needs FFT-based auto/cross-correlation + Tukey-taper/adaptive-truncation
 * regularization + verification against reference vectors — shipping an unverified hand-roll as
 * functional would violate this run's honesty invariant. So the mechanism/dispatch exists and is
 * swappable, but the `'xdf'` branch THROWS rather than run unverified science. Faithful port +
 * verification are backlogged (phase2-research-fixes B5).
 */
export function effectiveN(
  a: readonly number[],
  b: readonly number[],
  cfg: PairConfig,
): number {
  const method: NEffMethod = cfg.nEffMethod ?? "pyper-peterman"
  if (method === "xdf") {
    throw new Error(
      "nEffMethod 'xdf' not yet implemented — faithful Afyouni xDF port + reference-vector " +
        "verification pending (phase2-research-fixes B5). Cross-correlation-aware effective-N " +
        "is the principled fix for co-moving pairs (RU4d/Open-Q8) but must not ship unverified.",
    )
  }
  return effectiveNPyperPeterman(a, b, cfg)
}

// ─── Student-t two-sided p-value (via the regularized incomplete beta) ──────────────────

/** Lanczos log-gamma (Numerical Recipes gammln). */
function logGamma(x: number): number {
  const cof = [
    76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155,
    0.1208650973866179e-2, -0.5395239384953e-5,
  ]
  let y = x
  let tmp = x + 5.5
  tmp -= (x + 0.5) * Math.log(tmp)
  let ser = 1.000000000190015
  for (let j = 0; j < 6; j++) ser += cof[j] / ++y
  return -tmp + Math.log((2.5066282746310005 * ser) / x)
}

/** Continued fraction for the incomplete beta (Numerical Recipes betacf, modified Lentz). */
function betaContinuedFraction(a: number, b: number, x: number): number {
  const MAXIT = 300
  const EPS = 3e-12
  const FPMIN = 1e-300
  const qab = a + b
  const qap = a + 1
  const qam = a - 1
  let c = 1
  let d = 1 - (qab * x) / qap
  if (Math.abs(d) < FPMIN) d = FPMIN
  d = 1 / d
  let h = d
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2))
    d = 1 + aa * d
    if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c
    if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d
    h *= d * c
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2))
    d = 1 + aa * d
    if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c
    if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < EPS) break
  }
  return h
}

/** Regularized incomplete beta I_x(a, b). */
export function regularizedIncompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const bt = Math.exp(
    logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x),
  )
  if (x < (a + 1) / (a + b + 2)) return (bt * betaContinuedFraction(a, b, x)) / a
  return 1 - (bt * betaContinuedFraction(b, a, 1 - x)) / b
}

/** Two-sided p-value of a Student-t statistic: p = I_{df/(df+t²)}(df/2, 1/2). */
export function studentTTwoSidedP(t: number, df: number): number {
  if (!Number.isFinite(t)) return 0
  if (df <= 0) return 1
  const x = df / (df + t * t)
  return Math.min(1, Math.max(0, regularizedIncompleteBeta(x, df / 2, 0.5)))
}

/** Two-sided p for Spearman ρ under the t-approximation with df = nEff − 2. */
export function spearmanPValue(rho: number, nEff: number): number {
  if (Number.isNaN(rho)) return 1
  const df = nEff - 2
  if (df <= 0) return 1
  if (Math.abs(rho) >= 1) return 0
  const t = rho * Math.sqrt(df / (1 - rho * rho))
  return studentTTwoSidedP(t, df)
}

// ─── Benjamini–Hochberg step-up q-values (S5 multiplicity) ──────────────────────────────

/**
 * BH-adjusted p-values (q-values), returned in the input order:
 * sort ascending, q_(i) = p_(i)·m/i, enforce monotonicity from the largest down, clamp to 1.
 */
export function benjaminiHochberg(pValues: readonly number[]): number[] {
  const m = pValues.length
  if (m === 0) return []
  const order = pValues.map((p, i) => [p, i] as const).sort((a, b) => a[0] - b[0])
  const q = new Array<number>(m)
  let running = 1
  for (let i = m - 1; i >= 0; i--) {
    const raw = (order[i][0] * m) / (i + 1)
    running = Math.min(running, raw)
    q[order[i][1]] = Math.min(1, running)
  }
  return q
}

// ─── Fisher-z confidence interval ───────────────────────────────────────────────────────

const Z_95 = 1.959963984540054

/** 95% CI for ρ via the Fisher z-transform with N_eff; nulls when N_eff ≤ 3. */
export function fisherConfidenceInterval(
  rho: number,
  nEff: number,
): { low: number | null; high: number | null } {
  if (Number.isNaN(rho) || nEff <= 3) return { low: null, high: null }
  const clamped = Math.max(-0.999999, Math.min(0.999999, rho))
  const z = Math.atanh(clamped)
  const se = 1 / Math.sqrt(nEff - 3)
  return { low: Math.tanh(z - Z_95 * se), high: Math.tanh(z + Z_95 * se) }
}

// ─── Pair evaluation (the architecture §S5 evaluator I/O) ───────────────────────────────

export interface PairEvaluation {
  rho: number
  nDays: number
  nEff: number
  p: number
  ciLow: number | null
  ciHigh: number | null
}

/**
 * evaluatePair(seriesA, seriesB) → {rho, nDays, nEff, ci, p} (architecture §S5).
 * Inputs are calendar-aligned nullable day-series; only joint non-null days are used,
 * in date order. A flat pair (either side constant on joint days) evaluates to
 * rho = 0 / p = 1 — a row distinguishable from "no data" (§S5 failure mode).
 */
export function evaluatePair(
  seriesA: readonly (number | null)[],
  seriesB: readonly (number | null)[],
  cfg: PairConfig,
): PairEvaluation {
  const a: number[] = []
  const b: number[] = []
  const n = Math.min(seriesA.length, seriesB.length)
  for (let i = 0; i < n; i++) {
    const va = seriesA[i]
    const vb = seriesB[i]
    if (va !== null && vb !== null) {
      a.push(va)
      b.push(vb)
    }
  }
  const nDays = a.length
  if (nDays < 2) return { rho: 0, nDays, nEff: nDays, p: 1, ciLow: null, ciHigh: null }

  const rawRho = spearman(a, b)
  const nEff = effectiveN(a, b, cfg)
  if (Number.isNaN(rawRho)) {
    // Flat series: no monotone co-movement measurable.
    return { rho: 0, nDays, nEff, p: 1, ciLow: null, ciHigh: null }
  }
  const p = spearmanPValue(rawRho, nEff)
  const ci = fisherConfidenceInterval(rawRho, nEff)
  return { rho: rawRho, nDays, nEff, p, ciLow: ci.low, ciHigh: ci.high }
}

// ─── Sign-stability across fixed deterministic windows (ADR-0002 S5 stability gate) ─────

export interface StabilityResult {
  /** sign(ρ) defined, non-zero and identical in every sub-window. */
  consistent: boolean
  /** ρ per sub-window, oldest first (null when a window had too few joint days or was flat). */
  runRhos: (number | null)[]
}

/**
 * ADR-0002 stability gate, DETERMINISTIC by construction (Invariant 1): ρ is recomputed on
 * `stabilityRuns` FIXED stepped sub-windows of the calendar-aligned joint series — never
 * unseeded resampling. With L = series length, each sub-window spans
 * W = L − (stabilityRuns−1)·stabilityStepDays days; run r covers indices
 * [r·step, r·step + W). Consistent iff every run has ≥ minJointDays joint days and a
 * non-zero ρ of the same sign. (The |ρ| ≥ rhoMin half of the `stable` column is applied by
 * the caller on the full-window ρ.)
 */
export function signStability(
  seriesA: readonly (number | null)[],
  seriesB: readonly (number | null)[],
  cfg: PairConfig,
): StabilityResult {
  const length = Math.min(seriesA.length, seriesB.length)
  const windowLen = length - (cfg.stabilityRuns - 1) * cfg.stabilityStepDays
  if (windowLen < cfg.minJointDays) return { consistent: false, runRhos: [] }

  const runRhos: (number | null)[] = []
  let consistent = true
  let expectedSign = 0
  for (let run = 0; run < cfg.stabilityRuns; run++) {
    const start = run * cfg.stabilityStepDays
    const a: number[] = []
    const b: number[] = []
    for (let i = start; i < start + windowLen; i++) {
      const va = seriesA[i]
      const vb = seriesB[i]
      if (va !== null && va !== undefined && vb !== null && vb !== undefined) {
        a.push(va)
        b.push(vb)
      }
    }
    if (a.length < cfg.minJointDays) {
      runRhos.push(null)
      consistent = false
      continue
    }
    const rho = spearman(a, b)
    if (Number.isNaN(rho) || rho === 0) {
      runRhos.push(Number.isNaN(rho) ? null : rho)
      consistent = false
      continue
    }
    runRhos.push(rho)
    const sign = rho > 0 ? 1 : -1
    if (expectedSign === 0) expectedSign = sign
    else if (sign !== expectedSign) consistent = false
  }
  return { consistent, runRhos }
}
