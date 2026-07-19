// supabase/functions/generate-insights/evaluators.ts
//
// Pure rule-condition evaluators — the data-driven replacement for the MVP's 6 hardcoded
// `condition: (s) => boolean` closures (rules-engine-design §C). One evaluator per condition
// `type` in the shared/rules contract (trend / threshold / coincidence); the EVALUATORS record
// is the surface the rules-blueprint-to-engine-coverage guard
// (tools/rules/tests/engine_condition_coverage.test.ts) holds to the blueprint corpus, so an
// unevaluatable rule can never ship.
//
// DELIBERATELY dependency-free and free of Deno/Node globals (the evaluate-signals stats.ts
// pattern): imported by the Deno edge function (index.ts) AND directly by the node guard tests
// in tools/rules/tests/ via tsx — one source file, no mirror, no drift.
//
// Evaluators are pure functions of (params, baseline lookups) — no IO, no clock, no LLM
// (Invariant 2: deterministic serve path).

// ─── Baseline shapes (S3 baseline v2 rows / windowed recomputations) ──────────────────────

export type Confidence = "insufficient" | "low" | "medium" | "high"
export type Trend = "rising" | "falling" | "stable" | null

/** The stats surface a condition may test — an S3 snapshot row or a windowed recomputation. */
export interface EngineBaseline {
  mean: number | null
  std_dev: number | null
  min: number | null
  max: number | null
  trend: Trend
  confidence: Confidence
  data_sources: string[]
}

const CONFIDENCE_ORDER: Record<Confidence, number> = {
  insufficient: 0,
  low: 1,
  medium: 2,
  high: 3,
}

/** `minConfidence` generalizes the MVP's scattered `notInsufficient(s)` checks (§B1). */
export function meetsConfidence(actual: Confidence, min: "low" | "medium" | "high"): boolean {
  return CONFIDENCE_ORDER[actual] >= CONFIDENCE_ORDER[min]
}

// ─── Condition params (rules.condition_params jsonb — the leaf minus its `type`) ──────────

export interface TrendParams {
  metricKey: string
  equals: "rising" | "falling" | "stable"
  minConfidence: "low" | "medium" | "high"
}

export interface ThresholdParams {
  metricKey: string
  field: "mean" | "std_dev" | "min" | "max"
  op: "lt" | "lte" | "gt" | "gte" | "eq"
  value: number
  minConfidence: "low" | "medium" | "high"
}

export type CoincidenceLeafParams =
  | ({ type: "trend" } & TrendParams)
  | ({ type: "threshold" } & ThresholdParams)

export interface CoincidenceParams {
  metricKeys: readonly [string, string]
  both: readonly [CoincidenceLeafParams, CoincidenceLeafParams]
  /** Lag in days both[1]'s window trails both[0]'s; null = same window (C10 lag 0). */
  lagDays: number | null
  minConfidence: "low" | "medium" | "high"
}

/**
 * C10 (docs/temp/phase2-run-config-decisions.md) + C4·F5 (phase2-research-fixes): the provisional
 * cross-metric lag set is {0, 1, 2, 3, 7} days. The blueprint contract encodes lag 0 as
 * `lagDays: null` (schema forbids 0), so the non-null values the engine accepts are {1, 2, 3, 7}.
 * A coincidence rule carrying any other lag is skipped at load and logged — never silently
 * mis-evaluated. Widening this set only WIDENS what an author may specify; lag 2 stays inert until
 * a blueprint opts into it (no rule auto-expands across the allowed lags — each blueprint names a
 * single lagDays).
 *
 * WHAT THIS PATH IS (verify-first finding A2, phase2-research-fixes-findings.md §A2):
 * the coincidence/lag path is a BOOLEAN CONJUNCTION OF BASELINE LEAVES evaluated at lagged
 * windows (`evaluateCoincidence` → `getBaseline(metricB, lag)`) — it is NOT a rank
 * cross-correlation (CCF) and computes no ρ of any kind. It asks "did metric A's baseline fire on
 * day d and metric B's baseline fire on day d−lag?", not "how correlated are A and B at lag k?".
 * Consequences of that (all confirmed in A2):
 *   - The lag set is PHYSIOLOGICALLY-PLAUSIBLE COVERAGE, NOT CALIBRATED: gut transit (median ~28h,
 *     functional-GI 43–60h) and DOMS (peak 24–48h) both peak near the 1–3 day boundary the old
 *     grid {0,1,3,7} skipped — lag 2 fills that dense zone (RU7); short env-exposures span 0–7d.
 *   - lag 7 is CONFOUNDED WITH WEEKLY PERIODICITY: a lag-7 coincidence can reflect day-of-week
 *     calendar rhythm rather than a real 7-day physiological horizon. Deseasonalizing day-of-week
 *     before trusting lag-7 coincidences is a deferred backlog item (blocked-register B4), not a
 *     serve-path change — serve-time prewhitening/deseasonalizing is by-design offline (ADR-0002).
 *   - These lags NEVER enter any FDR/BH family: the BH-FDR family is the S5 lag-0 Spearman pair set
 *     only (`evaluate-signals`); this path never calls benjaminiHochberg, so there is no lag
 *     multiplicity to correct ("treat 4 lags as one hypothesis" is moot as coded — A2 R3).
 */
export const ALLOWED_LAG_DAYS: ReadonlySet<number> = new Set([1, 2, 3, 7])

// ─── Leaf evaluators ───────────────────────────────────────────────────────────────────────

/** Trend leaf: fires when the baseline trend equals `equals` (replaces the 4 MVP trend rules). */
export function evaluateTrend(params: TrendParams, baseline: EngineBaseline | null): boolean {
  if (baseline === null) return false
  if (!meetsConfidence(baseline.confidence, params.minConfidence)) return false
  return baseline.trend === params.equals
}

/**
 * Threshold leaf: fires when `<field> <op> <value>` holds; a null field never fires
 * (replaces gut_form_stable / gut_form_variable).
 */
export function evaluateThreshold(
  params: ThresholdParams,
  baseline: EngineBaseline | null,
): boolean {
  if (baseline === null) return false
  if (!meetsConfidence(baseline.confidence, params.minConfidence)) return false
  const actual = baseline[params.field]
  if (actual === null || actual === undefined) return false
  switch (params.op) {
    case "lt":
      return actual < params.value
    case "lte":
      return actual <= params.value
    case "gt":
      return actual > params.value
    case "gte":
      return actual >= params.value
    case "eq":
      return actual === params.value
  }
}

function evaluateLeaf(leaf: CoincidenceLeafParams, baseline: EngineBaseline | null): boolean {
  return leaf.type === "trend"
    ? evaluateTrend(leaf, baseline)
    : evaluateThreshold(leaf, baseline)
}

/**
 * Coincidence conjunction (the cross-metric primitive, §B1): both leaves hold for one user.
 * `getBaseline(metricKey, lagDays)` supplies the leaf's stats surface — lag 0 is the current
 * S3 snapshot window; lag > 0 is a windowed recomputation over the S2 series ending `lagDays`
 * days earlier (both[1] trails both[0] per the contract). The engine additionally scopes
 * coincidence rules to brain-neighbour pairs (C10) — that gate lives in the composer join,
 * not here: this function only answers "do the two leaf conditions hold".
 */
export function evaluateCoincidence(
  params: CoincidenceParams,
  getBaseline: (metricKey: string, lagDays: number) => EngineBaseline | null,
): boolean {
  const lag = params.lagDays ?? 0
  const b0 = getBaseline(params.both[0].metricKey, 0)
  const b1 = getBaseline(params.both[1].metricKey, lag)
  if (b0 === null || b1 === null) return false
  // The rule-level floor applies to BOTH snapshots' confidence (contract: CoincidenceCondition).
  if (!meetsConfidence(b0.confidence, params.minConfidence)) return false
  if (!meetsConfidence(b1.confidence, params.minConfidence)) return false
  return evaluateLeaf(params.both[0], b0) && evaluateLeaf(params.both[1], b1)
}

/**
 * One evaluator per condition `type` — the coverage surface the
 * rules-blueprint-to-engine-coverage guard asserts against (every condition type used by a
 * shipped blueprint must be a key here).
 */
export const EVALUATORS = {
  trend: evaluateTrend,
  threshold: evaluateThreshold,
  coincidence: evaluateCoincidence,
} as const

export type ConditionType = keyof typeof EVALUATORS

// ─── Windowed baseline recomputation (lagged coincidence leaves) ───────────────────────────
//
// Lagged evaluation needs per-window stats the single current-window baseline_snapshots row
// cannot provide (the deferral recorded on CoincidenceCondition.lagDays lands here). The math
// is compute-baselines' exactly — mean / population std-dev / half-split trend / C5 3-7-14
// confidence — over a 7-day window ending on an arbitrary day of the S2 series.
// (medium cutoff reverted 5→7 per evidence-review RU5b; see phase2-research-fixes F2.)

/** Mirrors compute-baselines' BASELINE_CONFIG (C5) — the S3 window + confidence cutoffs. */
export const WINDOWED_BASELINE_CONFIG = {
  windowDays: 7,
  confidence: {
    lowMinDays: 3,
    mediumMinDays: 7,
    highMinHistoryDays: 14,
  },
} as const

function avg(values: readonly number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length
}

function stdDev(values: readonly number[]): number {
  if (values.length < 2) return 0
  const mu = avg(values)
  return Math.sqrt(values.reduce((sum, v) => sum + (v - mu) ** 2, 0) / values.length)
}

/** compute-baselines' half-split trend: |late − early| must exceed 0.5·sd to leave "stable". */
function computeTrend(values: readonly number[]): Trend {
  if (values.length < 3) return null
  const half = Math.floor(values.length / 2)
  const earlyMean = avg(values.slice(0, half))
  const lateMean = avg(values.slice(-half))
  const delta = lateMean - earlyMean
  const sd = stdDev(values)
  if (sd === 0 || Math.abs(delta) <= sd * 0.5) return "stable"
  return delta > 0 ? "rising" : "falling"
}

function computeConfidence(daysOfData: number, totalHistoryDays: number): Confidence {
  const c = WINDOWED_BASELINE_CONFIG.confidence
  if (daysOfData < c.lowMinDays) return "insufficient"
  if (daysOfData < c.mediumMinDays) return "low"
  return totalHistoryDays < c.highMinHistoryDays ? "medium" : "high"
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().split("T")[0]!
}

/**
 * S3-equivalent stats over the 7-day window ending `endDay` (inclusive), from a (date → value)
 * day-series. `total_history_days` counts non-null days up to and including `endDay`, so a
 * lagged window's confidence never peeks at data after its own window end. Returns null when
 * the series has no value in the window at all (mirrors S3, which emits no snapshot row for a
 * metric with zero in-window and zero historical rows — a missing baseline never fires a leaf).
 *
 * CONSERVATIVE-HISTORY caveat (A23): the history count sees only the days present in the
 * supplied series — the engine fetches a ~28-day slice, so a user with months of history is
 * undercounted relative to S3's all-days-ever semantics. The error is one-directional:
 * lagged-leaf confidence can only come out LOWER than S3 would grant ('high' needs
 * ≥ highMinHistoryDays of visible history), never higher — a leaf may under-fire, never
 * over-claim.
 */
export function windowedBaseline(
  series: ReadonlyMap<string, number>,
  endDay: string,
  sourcesByDay?: ReadonlyMap<string, string>,
): EngineBaseline | null {
  const windowStart = addDays(endDay, -(WINDOWED_BASELINE_CONFIG.windowDays - 1))
  const values: number[] = []
  const sources = new Set<string>()
  let totalHistoryDays = 0
  for (const [date, value] of series) {
    if (date > endDay) continue
    totalHistoryDays++
    if (date >= windowStart) {
      values.push(value)
      const source = sourcesByDay?.get(date)
      if (source !== undefined) sources.add(source)
    }
  }
  if (totalHistoryDays === 0) return null
  return {
    mean: values.length > 0 ? avg(values) : null,
    std_dev: values.length > 0 ? stdDev(values) : null,
    min: values.length > 0 ? Math.min(...values) : null,
    max: values.length > 0 ? Math.max(...values) : null,
    trend: computeTrend(values),
    confidence: computeConfidence(values.length, totalHistoryDays),
    data_sources: [...sources].sort(),
  }
}
