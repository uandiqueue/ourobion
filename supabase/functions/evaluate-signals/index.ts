/// <reference types="jsr:@supabase/functions-js/edge-runtime.d.ts" />
import { createClient } from "jsr:@supabase/supabase-js@2.110.7"
import { METRICS } from "../../../shared/metrics/registry.ts"
import { unauthorizedResponse, verifyInternalSecretRequest } from "../_shared/internal_auth.ts"
import { readServerKeyEnv, resolveServerKey, ServerKeyConfigurationError } from "../_shared/server_keys.ts"
import {
  benjaminiHochberg,
  classifyDaily,
  evaluatePair,
  fireRate,
  signStability,
  type SignalState,
} from "./stats.ts"
import {
  PAIR_CONFIG,
  PAIR_GATES,
  PAIR_MIN_METRIC_DAYS,
  PAIR_WINDOW_DAYS,
  SIGNAL_CONFIG,
} from "./config.ts"
import { computeStalePairs, pairEligibilityKey, type PairRowRef } from "./lifecycle.ts"

// ─── S4 + S5 · evaluate-signals (docs/implemented/shared/insight-engine-architecture.md §S4/§S5, as ───
// superseded by ADR-0002, docs/development/decisions/0002-anomaly-definition.md) ───────────────
//
// S4 — per (user, metric): robust median/MAD baseline over the 28-day window EXCLUDING the
//      evaluated day, artifact rejection, per-metric deadband from the registry
//      (`signal.deadbandK`, in σ̂ units) → 3-state signal; non-neutral states are emitted as
//      FiredPattern[] IN THE RESPONSE. Per §S4 the fired-pattern store is "none — recomputable
//      from S2" (ephemeral; S7's generation job consumes them in-process), so this function
//      persists nothing for S4 and the response body is the S7 handoff shape.
// S5 — per user: 60-day calendar-aligned joint series for every baselineApplicable pair
//      (interim scope — brain-neighbour pruning arrives in U12/C10), Spearman ρ +
//      Pyper–Peterman N_eff + Benjamini–Hochberg q across the user's pair family, and the
//      ADR-0002 deterministic 3-window sign-stability gate → upserted into personal_signals.
//      After the upsert, rows whose pair LOST eligibility (metric under the 14-day floor,
//      joint days < minJointDays, or no longer evaluated) are DELETED, keeping the table a
//      pure function of the current data — the loaders' upsert+prune model, D13 (audit A19).
//
// Metric keys and deadbands derive from the registry — never hardcoded. Reads go through the
// S2 metric_daily_values view only (the metrics-registry-to-signals guard,
// docs/graph/couplings.yaml, fails the build otherwise).

const SIGNAL_METRICS = METRICS.filter(
  (m) => m.status === "active" && m.baselineApplicable && m.signal !== null,
)
const SIGNAL_METRIC_KEYS = SIGNAL_METRICS.map((m) => m.key)
const DEADBAND_K = new Map(SIGNAL_METRICS.map((m) => [m.key, m.signal!.deadbandK]))

type Confidence = "insufficient" | "low" | "medium" | "high"

interface SeriesRow {
  user_id: string
  metric_key: string
  log_date: string
  value: number
  source: string
}

/** §S4 MetricSignal (+ `suppressed`, additive — surfaces WHY a state was forced neutral). */
interface MetricSignal {
  userId: string
  metricKey: string
  day: string
  state: SignalState
  zScore: number | null
  baselineConfidence: Confidence
  suppressed: "insufficient-baseline" | "degenerate-mad" | null
}

/** §S4 FiredPattern — the S7 composer trigger. Never neutral. */
interface FiredPattern {
  userId: string
  day: string
  kind: "signal" | "trend" | "threshold"
  metricKey: string
  state: "up" | "down"
  stats: { zScore: number | null; trend: string | null; windowDays: number }
}

// ─── Small helpers ────────────────────────────────────────────────────────────────────────

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().split("T")[0]
}

function round(n: number, digits: number): number {
  const f = 10 ** digits
  return Math.round(n * f) / f
}

// Client factory with the handler's actual call shape. `ReturnType<typeof createClient>`
// resolves to the ZERO-ARG overload's default generics, which supabase-js ≥ 2.110's
// PostgrestVersion/schema generics no longer accept from a real createClient(url, key)
// instantiation (deno-check TS2345) — deriving the helper param type from this wrapper
// keeps the two in lockstep.
function makeClient(url: string, key: string) {
  return createClient(url, key)
}

// ─── S2 view read (paginated, stable order — compute-baselines mechanism) ────────────────

const PAGE_SIZE = 1000

async function fetchSeries(
  supabase: ReturnType<typeof makeClient>,
  windowStart: string,
): Promise<SeriesRow[]> {
  const rows: SeriesRow[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("metric_daily_values")
      .select("user_id, metric_key, log_date, value, source")
      .in("metric_key", SIGNAL_METRIC_KEYS)
      .gte("log_date", windowStart)
      .order("user_id", { ascending: true })
      .order("metric_key", { ascending: true })
      .order("log_date", { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(error.message)
    const page = (data ?? []) as unknown as SeriesRow[]
    rows.push(...page)
    if (page.length < PAGE_SIZE) break
  }
  return rows
}

/** S3 confidence per (user, metric) — carried on MetricSignal for S7 observability. */
async function fetchConfidence(
  supabase: ReturnType<typeof makeClient>,
): Promise<Map<string, Confidence>> {
  const out = new Map<string, Confidence>()
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("baseline_snapshots")
      .select("user_id, metric_key, confidence")
      .order("user_id", { ascending: true })
      .order("metric_key", { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(error.message)
    const page = (data ?? []) as unknown as {
      user_id: string
      metric_key: string
      confidence: Confidence
    }[]
    for (const row of page) out.set(`${row.user_id} ${row.metric_key}`, row.confidence)
    if (page.length < PAGE_SIZE) break
  }
  return out
}

/** The (user, pair) identity of every row currently in personal_signals — the prune input. */
async function fetchExistingPairs(
  supabase: ReturnType<typeof makeClient>,
): Promise<PairRowRef[]> {
  const out: PairRowRef[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("personal_signals")
      .select("user_id, metric_a, metric_b")
      .order("user_id", { ascending: true })
      .order("metric_a", { ascending: true })
      .order("metric_b", { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(error.message)
    const page = (data ?? []) as unknown as PairRowRef[]
    out.push(...page)
    if (page.length < PAGE_SIZE) break
  }
  return out
}

/** Per-user delete batch size for the stale-pair prune (PostgREST `or=` filter length cap). */
const PRUNE_DELETE_CHUNK = 50

// ─── Handler ──────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  // ── AUTHORIZATION FIRST (R4-U2) ─────────────────────────────────────────────────────────
  // Only run-pipeline / pg_cron / an admin curl may invoke this function, proven by the
  // dedicated `X-Ourobion-Internal-Secret` header and a CONSTANT-TIME compare against the
  // CURRENT/PREVIOUS rotation pair. Replaces a plain `!==` against SUPABASE_SERVICE_ROLE_KEY
  // that also sat AFTER a 500 config guard. Every denial (missing / blank / malformed header,
  // wrong secret, or no secret configured) returns the same 401 with the same body bytes and
  // never 500 — no "misconfigured vs wrong secret" oracle, and the recorded serve probe in
  // tools/run4_release_gate.mjs (which configures no secret) still observes 401.
  const verdict = await verifyInternalSecretRequest(req, {
    current: Deno.env.get("OUROBION_INTERNAL_SECRET_CURRENT"),
    previous: Deno.env.get("OUROBION_INTERNAL_SECRET_PREVIOUS"),
  })
  if (!verdict.ok) {
    console.error(`internal auth denied: ${verdict.reason}`) // reason only — never a value
    return unauthorizedResponse()
  }

  // Replacement secret keys are privileged DATABASE credentials only. Resolution is after the
  // internal-secret gate so malformed configuration cannot become an unauthenticated oracle.
  let databaseSecret: string
  try {
    const env = readServerKeyEnv("secret")
    databaseSecret = resolveServerKey(env, "secret", {
      allowLegacyLocalCli: true,
      supabaseUrl: env.SUPABASE_URL,
    }).value
  } catch (error) {
    console.error("Supabase secret-key configuration unavailable", error instanceof ServerKeyConfigurationError ? error.message : error)
    return new Response(
      JSON.stringify({ error: "server misconfiguration: database credential unavailable" }),
      { status: 500 },
    )
  }

  const supabase = makeClient(Deno.env.get("SUPABASE_URL")!, databaseSecret)

  // The evaluated day (UTC). The S5 window is the PAIR_WINDOW_DAYS days ending today; the
  // S4 baseline is the SIGNAL_CONFIG.windowDays days ENDING YESTERDAY (window excludes the
  // evaluated day, per ADR-0002) — a strict subset of the S5 fetch window.
  const day = new Date().toISOString().split("T")[0]
  const pairWindowStart = addDays(day, -(PAIR_WINDOW_DAYS - 1))
  const s4WindowStart = addDays(day, -SIGNAL_CONFIG.windowDays)

  let rows: SeriesRow[]
  let confidence: Map<string, Confidence>
  try {
    rows = await fetchSeries(supabase, pairWindowStart)
    confidence = await fetchConfidence(supabase)
  } catch (e) {
    console.error("metric_daily_values fetch error", e)
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500 })
  }

  // Group per user → metric → (date → value). Input rows are stably ordered.
  const byUser = new Map<string, Map<string, Map<string, number>>>()
  for (const row of rows) {
    if (typeof row.value !== "number") continue
    let metrics = byUser.get(row.user_id)
    if (!metrics) byUser.set(row.user_id, (metrics = new Map()))
    let series = metrics.get(row.metric_key)
    if (!series) metrics.set(row.metric_key, (series = new Map()))
    series.set(row.log_date, row.value)
  }

  // The 60 calendar dates of the joint-series window, oldest first (index-aligned series).
  const windowDates: string[] = []
  for (let i = 0; i < PAIR_WINDOW_DAYS; i++) windowDates.push(addDays(pairWindowStart, i))

  const metricSignals: MetricSignal[] = []
  const firedPatterns: FiredPattern[] = []
  const signalRows: object[] = []
  const eligiblePairKeys = new Set<string>() // every (user, pair) that earns a row THIS run
  let pairsEvaluated = 0

  for (const [userId, metrics] of byUser) {
    // ── S4 · 3-state signal per metric with a value today ────────────────────────────────
    for (const [metricKey, series] of metrics) {
      const todayValue = series.get(day)
      if (todayValue === undefined) continue // nothing logged today — nothing to classify
      const baseline: number[] = []
      for (const [date, value] of series) {
        if (date >= s4WindowStart && date < day) baseline.push(value)
      }
      const signal = classifyDaily(baseline, todayValue, DEADBAND_K.get(metricKey)!, SIGNAL_CONFIG)
      metricSignals.push({
        userId,
        metricKey,
        day,
        state: signal.state,
        zScore: signal.modifiedZ === null ? null : round(signal.modifiedZ, 4),
        baselineConfidence: confidence.get(`${userId} ${metricKey}`) ?? "insufficient",
        suppressed: signal.suppressed,
      })
      if (signal.state !== "neutral") {
        firedPatterns.push({
          userId,
          day,
          kind: "signal",
          metricKey,
          state: signal.state,
          stats: {
            zScore: signal.modifiedZ === null ? null : round(signal.modifiedZ, 4),
            trend: null,
            windowDays: SIGNAL_CONFIG.windowDays,
          },
        })
      }
    }

    // ── S5 · pairwise evaluator over the 60-day joint series ─────────────────────────────
    // Interim pair scope: every eligible baselineApplicable pair (brain-neighbour pruning
    // lands in U12/C10). Eligibility: ≥ PAIR_MIN_METRIC_DAYS non-null days in-window.
    const eligible: [string, (number | null)[]][] = []
    for (const key of [...metrics.keys()].sort()) {
      const series = metrics.get(key)!
      const aligned = windowDates.map((date) => series.get(date) ?? null)
      const nonNull = aligned.filter((v) => v !== null).length
      if (nonNull >= PAIR_MIN_METRIC_DAYS) eligible.push([key, aligned])
    }

    const pending: { row: Record<string, unknown>; p: number }[] = []
    for (let i = 0; i < eligible.length; i++) {
      for (let j = i + 1; j < eligible.length; j++) {
        const [metricA, seriesA] = eligible[i]
        const [metricB, seriesB] = eligible[j]
        const evaluated = evaluatePair(seriesA, seriesB, PAIR_CONFIG)
        pairsEvaluated++
        // §S5 failure mode: too few joint days → NO row (distinguished from "flat", which
        // gets a row with rho 0 / p 1 / stable false).
        if (evaluated.nDays < PAIR_CONFIG.minJointDays) continue
        const stability = signStability(seriesA, seriesB, PAIR_CONFIG)
        const stable = stability.consistent && Math.abs(evaluated.rho) >= PAIR_GATES.rhoMin
        pending.push({
          p: evaluated.p,
          row: {
            user_id: userId,
            metric_a: metricA,
            metric_b: metricB,
            window_days: PAIR_WINDOW_DAYS,
            n_days: evaluated.nDays,
            n_eff: round(evaluated.nEff, 2),
            rho: round(evaluated.rho, 4),
            ci_low: evaluated.ciLow === null ? null : round(evaluated.ciLow, 4),
            ci_high: evaluated.ciHigh === null ? null : round(evaluated.ciHigh, 4),
            stable,
            computed_at: new Date().toISOString(),
            runs_observed: 1,
          },
        })
      }
    }

    // Benjamini–Hochberg across THIS user's evaluated pair family (q is per user per run).
    const qValues = benjaminiHochberg(pending.map((entry) => entry.p))
    for (let k = 0; k < pending.length; k++) {
      const row = pending[k].row
      signalRows.push({ ...row, q_value: round(qValues[k], 5) })
      eligiblePairKeys.add(
        pairEligibilityKey(userId, row.metric_a as string, row.metric_b as string),
      )
    }
  }

  if (signalRows.length > 0) {
    const { error: upsertError } = await supabase
      .from("personal_signals")
      .upsert(signalRows, { onConflict: "user_id,metric_a,metric_b" })
    if (upsertError) {
      console.error("personal_signals upsert error", upsertError)
      return new Response(JSON.stringify({ error: upsertError.message }), { status: 500 })
    }
  }

  // ── A19 · prune lost-eligibility pairs (delete-on-loss, D13 upsert+prune model) ──────────
  // personal_signals must stay a pure function of the current data: any existing row whose
  // pair did NOT earn a row this run (metric under the PAIR_MIN_METRIC_DAYS floor, joint days
  // < minJointDays, metric no longer evaluated, or the user's data left the window entirely)
  // is deleted, scoped per user to exactly the stale pairs. BH q-values stay coherent: q is
  // computed per user per run over that run's evaluated family — a pruned pair was not in the
  // current family, so the surviving rows' q-values never depended on it.
  //
  // Guard (the A14 lesson): if the S2 view returned NO users at all, treat it as a suspect
  // input rather than proof every signal died, and skip the prune instead of wiping the table.
  let rowsPruned = 0
  if (byUser.size > 0) {
    let existingPairs: PairRowRef[]
    try {
      existingPairs = await fetchExistingPairs(supabase)
    } catch (e) {
      console.error("personal_signals existing-pairs fetch error", e)
      return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500 })
    }
    const staleByUser = computeStalePairs(eligiblePairKeys, existingPairs)
    for (const [userId, stalePairs] of staleByUser) {
      for (let from = 0; from < stalePairs.length; from += PRUNE_DELETE_CHUNK) {
        const chunk = stalePairs.slice(from, from + PRUNE_DELETE_CHUNK)
        // Registry metric keys are ^[a-z0-9_]+$ — safe inside a PostgREST or= expression.
        const orFilter = chunk
          .map((p) => `and(metric_a.eq.${p.metricA},metric_b.eq.${p.metricB})`)
          .join(",")
        const { error: deleteError } = await supabase
          .from("personal_signals")
          .delete()
          .eq("user_id", userId)
          .or(orFilter)
        if (deleteError) {
          console.error("personal_signals prune error", deleteError)
          return new Response(JSON.stringify({ error: deleteError.message }), { status: 500 })
        }
        rowsPruned += chunk.length
      }
    }
  }

  // ── RU3c / ADR-0002 Open-Q2 · deadbandK fire-rate instrumentation (MEASUREMENT ONLY) ─────
  // Accrue the per-metric fire rate (fraction of today's classifications that were non-neutral)
  // so real n=1 fire-rate data builds up for `deadbandK` calibration. This reads classifier
  // output; it changes no threshold, no classification, and no response contract. The intent
  // question (anomaly alert vs ~1-in-3 daily nudge) is product-gated — see phase2-research-fixes
  // D3 / blocked-register B3; `deadbandK` stays 1.0 until calibrated against these numbers.
  const statesByMetric = new Map<string, SignalState[]>()
  for (const s of metricSignals) {
    const arr = statesByMetric.get(s.metricKey)
    if (arr) arr.push(s.state)
    else statesByMetric.set(s.metricKey, [s.state])
  }
  const fireRates = [...statesByMetric.entries()]
    .map(([metricKey, states]) => ({
      metricKey,
      n: states.length,
      fireRate: round(fireRate(states), 4),
    }))
    .sort((a, b) => a.metricKey.localeCompare(b.metricKey))
  if (fireRates.length > 0) {
    console.log(`[evaluate-signals] deadbandK fire-rate (RU3c/Open-Q2) ${day}:`, JSON.stringify(fireRates))
  }

  return new Response(
    JSON.stringify({
      ok: true,
      day,
      users: byUser.size,
      metricSignals,
      firedPatterns,
      personalSignals: { pairsEvaluated, rowsUpserted: signalRows.length, rowsPruned },
      fireRates,
    }),
    { headers: { "Content-Type": "application/json" } },
  )
})
