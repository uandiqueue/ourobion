// supabase/functions/evaluate-signals/config.ts
//
// The adopted S4/S5 constants — docs/shared/phase2-run-config-decisions.md C3 + C4, per
// ADR-0002 (docs/shared/decisions/0002-anomaly-definition.md). Every value ships in a named
// config object, never an inline literal (ADR-0002 mandate: calibration is a data change,
// not a code change). Dependency-free and Deno-free so the node test suite can import it.
//
// The per-metric deadband (`deadbandK`, in robust σ̂ units) deliberately does NOT live here:
// it is a per-metric registry field (shared/metrics/registry.ts `signal.deadbandK`,
// architecture §S4 generalization M).

import type { PairConfig, SignalConfig } from "./stats.ts"

/** C3 · S4 robust anomaly definition (ADR-0002, supersedes the architecture doc's dummies). */
export const SIGNAL_CONFIG: SignalConfig = {
  /** 28-day rolling baseline window, excluding the evaluated day (provisional). */
  windowDays: 28,
  /** No state emitted before 14 baseline days exist (provisional, gray/practitioner lit). */
  baselineMinDays: 14,
  /** Artifact rejection: drop window points with |modified z| > 3.5 (Iglewicz–Hoaglin). */
  artifactZMax: 3.5,
  /**
   * MAD-degeneracy guard: minimum distinct retained values to trust σ̂. ADR-0002 open-Q9
   * leaves the exact figure to calibration; 3 is the shipped provisional floor (2 distinct
   * values make MAD a step function of the split, not a scale estimate).
   */
  minDistinctValues: 3,
}

/** C4 · S5 evaluator mechanics (window shape + N_eff + stability windows). */
export const PAIR_CONFIG: PairConfig = {
  /** Pyper–Peterman lag truncation at ~N/5 (ADR-0002). */
  maxLagFraction: 0.2,
  /** Stability = 3 fixed deterministic windows (C4; never unseeded resampling). */
  stabilityRuns: 3,
  /**
   * Forward step between stability sub-windows. With the 60-day window and 3 runs this
   * yields three 40-day windows at offsets 0/10/20 days — fixed, reproducible, overlapping
   * enough that each run keeps a workable joint-day count (provisional; the ADR leaves the
   * exact window geometry to calibration, open-Q7).
   */
  stabilityStepDays: 10,
  /** Joint days below this → no row (architecture §S5 failure mode: "joint days < 10 → no row"). */
  minJointDays: 10,
}

/** C4 · the 60-day joint-series evaluation window. */
export const PAIR_WINDOW_DAYS = 60

/**
 * Interim pair scope (recorded): a metric enters the pair set only with
 * ≥ PAIR_MIN_METRIC_DAYS non-null days inside the 60-day window — reusing C3's
 * baselineMinDays = 14 as the per-metric floor. Brain-neighbour pruning of the pair set
 * arrives in U12 (C10); until then the family is all baselineApplicable × baselineApplicable
 * pairs passing this floor.
 */
export const PAIR_MIN_METRIC_DAYS = 14

/**
 * C4 · serve gates. `rhoMin` feeds the `stable` column (|ρ| ≥ 0.3 AND sign-stability);
 * `qMax` / `nEffMin` are stored per row and applied by S7 at read time
 * (signal := q ≤ 0.05 ∧ N_eff ≥ 10 ∧ stable).
 *
 * Note: `rhoMin = 0.3` is a conservative ~top-quartile ("relatively large") effect-size
 * screen — NOT a Cohen-"medium" cutoff (that label is a mislabel; only ~27% of published
 * correlations exceed .30, per Bosco 2015 / Gignac–Szodorai 2016; see evidence-review RU4b).
 */
export const PAIR_GATES = {
  rhoMin: 0.3,
  qMax: 0.05,
  nEffMin: 10,
} as const
