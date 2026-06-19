/// <reference types="jsr:@supabase/functions-js/edge-runtime.d.ts" />
import { createClient } from "jsr:@supabase/supabase-js@2"
import { METRICS } from "../../../shared/metrics/registry.ts"

// ─── Metric keys (derived from the registry — never hardcoded) ──────────────────
// shared/metrics/registry.ts is the single source of truth. The metrics-registry-to-baselines
// guard (docs/graph/couplings.yaml) fails the build if this function reintroduces literal keys or
// drifts from the registry — that drift is exactly the bug this registry was introduced to kill.

const GUT_METRIC_KEYS = METRICS
  .filter((m) => m.table === "daily_gut_rows" && m.status === "active" && m.baselineApplicable)
  .map((m) => m.key)

const WEARABLE_METRIC_KEYS = METRICS
  .filter((m) => m.table === "wearable_daily" && m.status === "active" && m.baselineApplicable)
  .map((m) => m.key)

type Trend = "rising" | "falling" | "stable" | null
type Confidence = "insufficient" | "low" | "medium" | "high"

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

function computeConfidence(daysOfData: number): Confidence {
  if (daysOfData < 3) return "insufficient"
  if (daysOfData < 7) return "low"
  if (daysOfData < 14) return "medium"
  return "high"
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}

function groupByUser(rows: Record<string, unknown>[]): Map<string, Record<string, unknown>[]> {
  const map = new Map<string, Record<string, unknown>[]>()
  for (const row of rows) {
    const uid = row.user_id as string
    const list = map.get(uid) ?? []
    list.push(row)
    map.set(uid, list)
  }
  return map
}

function buildSnapshots(
  byUser: Map<string, Record<string, unknown>[]>,
  metricKeys: readonly string[],
  dataSource: string,
  computedAt: string,
): object[] {
  const snapshots: object[] = []
  for (const [userId, userRows] of byUser) {
    for (const metric of metricKeys) {
      const values = userRows
        .map((r) => r[metric])
        .filter((v): v is number => typeof v === "number")

      if (values.length === 0) continue

      snapshots.push({
        user_id: userId,
        metric_key: metric,
        computed_at: computedAt,
        days_of_data: values.length,
        mean: round3(avg(values)),
        std_dev: round3(stdDev(values)),
        min: Math.min(...values),
        max: Math.max(...values),
        trend: computeTrend(values),
        confidence: computeConfidence(values.length),
        data_sources: [dataSource],
      })
    }
  }
  return snapshots
}

// ─── Handler ──────────────────────────────────────────────────────────────────

// 30-day lookback gives users a path to 'medium' confidence after two weeks
// and 'high' after one month, while keeping the query light for MVP scale.
const LOOKBACK_DAYS = 30

Deno.serve(async (req) => {
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

  // Only pg_cron (or an admin curl) may invoke this function.
  const auth = req.headers.get("Authorization")
  if (!auth || auth !== `Bearer ${serviceRoleKey}`) {
    return new Response("Unauthorized", { status: 401 })
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceRoleKey!)

  const since = new Date()
  since.setDate(since.getDate() - LOOKBACK_DAYS)
  const sinceDate = since.toISOString().split("T")[0]

  // Fetch gut and wearable rows in parallel.
  const [gutResult, wearableResult] = await Promise.all([
    supabase
      .from("daily_gut_rows")
      .select(["user_id", "log_date", ...GUT_METRIC_KEYS].join(", "))
      .gte("log_date", sinceDate)
      .order("log_date", { ascending: true }),
    supabase
      .from("wearable_daily")
      .select(["user_id", "date", ...WEARABLE_METRIC_KEYS].join(", "))
      .gte("date", sinceDate)
      .order("date", { ascending: true }),
  ])

  if (gutResult.error) {
    console.error("gut fetch error", gutResult.error)
    return new Response(JSON.stringify({ error: gutResult.error.message }), { status: 500 })
  }
  if (wearableResult.error) {
    console.error("wearable fetch error", wearableResult.error)
    return new Response(JSON.stringify({ error: wearableResult.error.message }), { status: 500 })
  }

  const gutByUser = groupByUser(gutResult.data ?? [])
  const wearableByUser = groupByUser(wearableResult.data ?? [])

  const computedAt = new Date().toISOString()
  const snapshots = [
    ...buildSnapshots(gutByUser, GUT_METRIC_KEYS, "self_report", computedAt),
    ...buildSnapshots(wearableByUser, WEARABLE_METRIC_KEYS, "wearable", computedAt),
  ]

  if (snapshots.length > 0) {
    const { error: upsertError } = await supabase
      .from("baseline_snapshots")
      .upsert(snapshots, { onConflict: "user_id,metric_key" })

    if (upsertError) {
      console.error("upsert error", upsertError)
      return new Response(JSON.stringify({ error: upsertError.message }), { status: 500 })
    }
  }

  const uniqueUsers = new Set([...gutByUser.keys(), ...wearableByUser.keys()]).size
  return new Response(
    JSON.stringify({ ok: true, users: uniqueUsers, snapshots: snapshots.length }),
    { headers: { "Content-Type": "application/json" } },
  )
})
