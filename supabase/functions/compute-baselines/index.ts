/// <reference types="jsr:@supabase/functions-js/edge-runtime.d.ts" />
import { createClient } from "jsr:@supabase/supabase-js@2.110.7"
import { METRICS } from "../../../shared/metrics/registry.ts"
import { computeStaleSnapshots, snapshotKey, type SnapshotRowRef } from "./lifecycle.ts"
import { unauthorizedResponse, verifyInternalSecretRequest } from "../_shared/internal_auth.ts"
import { readServerKeyEnv, resolveServerKey, ServerKeyConfigurationError } from "../_shared/server_keys.ts"

// ─── S3 · baseline v2 (docs/implemented/insight-engine-architecture.md §S3) ─────────────────
// Reads the S2 `metric_daily_values` view — the single long-format seam over the per-day
// truth tables — instead of the wide tables directly, so a metric that moves to a new
// storage primitive (signals etc.) needs no change here.
//
// Metric keys are derived from the registry — never hardcoded. shared/metrics/registry.ts
// is the single source of truth; the metrics-registry-to-baselines guard
// (docs/graph/couplings.yaml) fails the build if this function reintroduces literal keys
// or stops reading through the S2 view.

const BASELINE_METRIC_KEYS = METRICS
  .filter((m) => m.status === "active" && m.baselineApplicable)
  .map((m) => m.key)

// ─── Window + confidence config ────────────────────────────────────────────────────────
// Named config object, never inline literals (ADR-0002 mandate). Cutoffs adopted per
// docs/shared/phase2-run-config-decisions.md C5: 3 / 7 / 14 - medium reverted 5->7 per evidence-review RU5b (lit favours 6-7 nights; nothing supports 5). Supersedes U6's 3/5/14.
//
//   insufficient : days_of_data < lowMinDays
//   low          : lowMinDays ≤ days_of_data < mediumMinDays
//   medium       : days_of_data ≥ mediumMinDays and total_history_days < highMinHistoryDays
//   high         : days_of_data ≥ mediumMinDays and total_history_days ≥ highMinHistoryDays
//
// days_of_data is the in-window coverage count (days with a non-null value within the last
// windowDays days); total_history_days is all non-null days ever, from the S2 view.
const BASELINE_CONFIG = {
  windowDays: 7,
  confidence: {
    lowMinDays: 3,
    mediumMinDays: 7,
    highMinHistoryDays: 14,
  },
} as const

type Trend = "rising" | "falling" | "stable" | null
type Confidence = "insufficient" | "low" | "medium" | "high"

interface SeriesRow {
  user_id: string
  metric_key: string
  log_date: string
  value: number
  source: string
}

/** One `baseline_snapshots` upsert row (typed so the O19 prune can read its identity). */
interface SnapshotRow {
  user_id: string
  metric_key: string
  computed_at: string
  window_days: number
  days_of_data: number
  total_history_days: number
  mean: number | null
  std_dev: number | null
  min: number | null
  max: number | null
  trend: Trend
  confidence: Confidence
  data_sources: string[]
}

// ─── Statistics helpers ───────────────────────────────────────────────────────

function avg(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0
  const mu = avg(values)
  return Math.sqrt(values.reduce((sum, v) => sum + (v - mu) ** 2, 0) / values.length)
}

// Values arrive sorted oldest → newest (ordered by date asc).
// Trend is significant when the shift between the early and late halves
// exceeds half a standard deviation — scale-agnostic across all metrics.
function computeTrend(values: number[]): Trend {
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
  const c = BASELINE_CONFIG.confidence
  if (daysOfData < c.lowMinDays) return "insufficient"
  if (daysOfData < c.mediumMinDays) return "low"
  return totalHistoryDays < c.highMinHistoryDays ? "medium" : "high"
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}

// ─── S2 view read ─────────────────────────────────────────────────────────────

// Client factory with the handler's actual call shape. `ReturnType<typeof createClient>`
// resolves to the ZERO-ARG overload's default generics, which supabase-js ≥ 2.110's
// PostgrestVersion/schema generics no longer accept from a real createClient(url, key)
// instantiation (deno-check TS2345) — deriving the helper param type from this wrapper
// keeps the two in lockstep.
function makeClient(url: string, key: string) {
  return createClient(url, key)
}

const PAGE_SIZE = 1000

// Full per-day history for every baseline-applicable metric, paginated (stable order so
// pages can't skip rows), ordered log_date asc within each (user, metric) series.
async function fetchSeries(
  supabase: ReturnType<typeof makeClient>,
): Promise<SeriesRow[]> {
  const rows: SeriesRow[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("metric_daily_values")
      .select("user_id, metric_key, log_date, value, source")
      .in("metric_key", BASELINE_METRIC_KEYS)
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

/** The (user, metric) identity of every row currently in baseline_snapshots — the O19 prune input. */
async function fetchExistingSnapshots(
  supabase: ReturnType<typeof makeClient>,
): Promise<SnapshotRowRef[]> {
  const out: SnapshotRowRef[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("baseline_snapshots")
      .select("user_id, metric_key")
      .order("user_id", { ascending: true })
      .order("metric_key", { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(error.message)
    const page = (data ?? []) as unknown as SnapshotRowRef[]
    out.push(...page)
    if (page.length < PAGE_SIZE) break
  }
  return out
}

/** Per-user delete batch size for the O19 stale-snapshot prune (bounded `in=` filter length). */
const PRUNE_DELETE_CHUNK = 50

// ─── Snapshot builder ─────────────────────────────────────────────────────────

function buildSnapshots(rows: SeriesRow[], computedAt: string, windowStart: string): SnapshotRow[] {
  // Group into per-(user, metric) series; rows are already log_date-ascending.
  const bySeries = new Map<string, SeriesRow[]>()
  for (const row of rows) {
    const key = `${row.user_id}\u0000${row.metric_key}`
    const list = bySeries.get(key) ?? []
    list.push(row)
    bySeries.set(key, list)
  }

  const snapshots: SnapshotRow[] = []
  for (const series of bySeries.values()) {
    const { user_id, metric_key } = series[0]
    // The view emits only non-null values, so row count == non-null day count.
    const totalHistoryDays = series.length
    const windowRows = series.filter((r) => r.log_date >= windowStart)
    const values = windowRows
      .map((r) => r.value)
      .filter((v): v is number => typeof v === "number")

    // Sources that fed the stats (whole history when the window is empty), deterministic order.
    const sourceRows = windowRows.length > 0 ? windowRows : series
    const dataSources = [...new Set(sourceRows.map((r) => r.source))].sort()

    snapshots.push({
      user_id,
      metric_key,
      computed_at: computedAt,
      window_days: BASELINE_CONFIG.windowDays,
      days_of_data: values.length,
      total_history_days: totalHistoryDays,
      mean: values.length > 0 ? round3(avg(values)) : null,
      std_dev: values.length > 0 ? round3(stdDev(values)) : null,
      min: values.length > 0 ? Math.min(...values) : null,
      max: values.length > 0 ? Math.max(...values) : null,
      trend: computeTrend(values),
      confidence: computeConfidence(values.length, totalHistoryDays),
      data_sources: dataSources,
    })
  }
  return snapshots
}

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  // ── AUTHORIZATION FIRST (R4-U2) ─────────────────────────────────────────────────────────
  // Only pg_cron (or an admin curl) may invoke this function, and it proves that with the
  // dedicated `X-Ourobion-Internal-Secret` header, compared CONSTANT-TIME against the
  // CURRENT/PREVIOUS rotation pair. The old check was a plain `!==` against
  // SUPABASE_SERVICE_ROLE_KEY, placed AFTER a 500 config guard — both are fixed here:
  //   * the service-role key is no longer an authorization input (below it is used only as
  //     the database credential for this function's own writes), and
  //   * every denial — missing / blank / malformed header, wrong secret, or NO secret
  //     configured — answers with the same 401 and the same body bytes, never 500, so an
  //     anonymous prober cannot distinguish "misconfigured" from "wrong secret". The local
  //     `functions serve` probe that tools/run4_release_gate.mjs records depends on this too:
  //     it configures no internal secret and must still observe 401 with handlerReached.
  // The A22 concern behind the old ordering (an unset env degenerating the expected header to
  // the literal "Bearer undefined") is structurally gone: the shape validator rejects
  // absent/blank/malformed values on both sides before any comparison happens.
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

  // Window = the last windowDays calendar days, ending today (UTC, inclusive).
  const start = new Date()
  start.setUTCDate(start.getUTCDate() - (BASELINE_CONFIG.windowDays - 1))
  const windowStart = start.toISOString().split("T")[0]

  let rows: SeriesRow[]
  try {
    rows = await fetchSeries(supabase)
  } catch (e) {
    console.error("metric_daily_values fetch error", e)
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500 })
  }

  const computedAt = new Date().toISOString()
  const snapshots = buildSnapshots(rows, computedAt, windowStart)

  if (snapshots.length > 0) {
    const { error: upsertError } = await supabase
      .from("baseline_snapshots")
      .upsert(snapshots, { onConflict: "user_id,metric_key" })

    if (upsertError) {
      console.error("upsert error", upsertError)
      return new Response(JSON.stringify({ error: upsertError.message }), { status: 500 })
    }
  }

  // ── O19 · prune snapshots absent from the current projection (upsert+prune, D13/A19) ────
  // baseline_snapshots must stay a pure function of the current S2 data: any existing
  // (user, metric) row that did NOT earn a snapshot this run (raw rows deleted, metric
  // deprecated out of the registry set, user gone) is deleted, scoped per user to exactly
  // the stale metric keys — mirroring evaluate-signals' personal_signals lifecycle.
  //
  // Successful-empty-input policy (the A14 lesson, mirrored): a FAILED S2 fetch never reaches
  // this point (the handler already returned 500 above), so `rows` here is always the result
  // of a successful read. But a successful read of ZERO rows is still treated as suspect input
  // rather than proof that every user deleted everything — a mass raw wipe is indistinguishable
  // at this seam from a broken view/filter — so the prune is SKIPPED instead of wiping the
  // table. The cost is bounded: snapshots that survive a skipped prune stop being refreshed,
  // so generate-insights' O19 freshness filter (SNAPSHOT_FRESHNESS_DAYS) excludes them anyway.
  let snapshotsPruned = 0
  if (rows.length > 0) {
    let existing: SnapshotRowRef[]
    try {
      existing = await fetchExistingSnapshots(supabase)
    } catch (e) {
      console.error("baseline_snapshots existing-rows fetch error", e)
      return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500 })
    }
    const currentKeys = new Set(snapshots.map((s) => snapshotKey(s.user_id, s.metric_key)))
    const staleByUser = computeStaleSnapshots(currentKeys, existing)
    for (const [userId, staleMetricKeys] of staleByUser) {
      for (let from = 0; from < staleMetricKeys.length; from += PRUNE_DELETE_CHUNK) {
        const chunk = staleMetricKeys.slice(from, from + PRUNE_DELETE_CHUNK)
        const { error: deleteError } = await supabase
          .from("baseline_snapshots")
          .delete()
          .eq("user_id", userId)
          .in("metric_key", chunk)
        if (deleteError) {
          console.error("baseline_snapshots prune error", deleteError)
          return new Response(JSON.stringify({ error: deleteError.message }), { status: 500 })
        }
        snapshotsPruned += chunk.length
      }
    }
  }

  const uniqueUsers = new Set(rows.map((r) => r.user_id)).size
  return new Response(
    JSON.stringify({
      ok: true,
      users: uniqueUsers,
      snapshots: snapshots.length,
      snapshotsPruned,
    }),
    { headers: { "Content-Type": "application/json" } },
  )
})
