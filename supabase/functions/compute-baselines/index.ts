/// <reference types="jsr:@supabase/functions-js/edge-runtime.d.ts" />
import { createClient } from "jsr:@supabase/supabase-js@2"

// ─── Types ────────────────────────────────────────────────────────────────────

const METRIC_KEYS = [
  "urine_colour",
  "stool_form",
  "stool_count",
  "stool_variability",
  "outside_meals",
  "mosquito_bites",
  "energy_score",
  "mood_score",
  "gut_comfort_score",
  "log_completeness",
] as const

type MetricKey = typeof METRIC_KEYS[number]

interface GutRow {
  user_id: string
  log_date: string
  urine_colour: number | null
  stool_form: number | null
  stool_count: number | null
  stool_variability: number | null
  outside_meals: number | null
  mosquito_bites: number | null
  energy_score: number | null
  mood_score: number | null
  gut_comfort_score: number | null
  log_completeness: number
}

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

// Values arrive sorted oldest → newest (ordered by log_date asc).
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

  // Fetch all gut rows across all users within the lookback window.
  const since = new Date()
  since.setDate(since.getDate() - LOOKBACK_DAYS)
  const sinceDate = since.toISOString().split("T")[0]

  const { data: rows, error: fetchError } = await supabase
    .from("daily_gut_rows")
    .select(
      "user_id, log_date, urine_colour, stool_form, stool_count, stool_variability, " +
      "outside_meals, mosquito_bites, energy_score, mood_score, gut_comfort_score, log_completeness"
    )
    .gte("log_date", sinceDate)
    .order("log_date", { ascending: true })

  if (fetchError) {
    console.error("fetch error", fetchError)
    return new Response(JSON.stringify({ error: fetchError.message }), { status: 500 })
  }

  // Group rows by user.
  const byUser = new Map<string, GutRow[]>()
  for (const row of rows ?? []) {
    const list = byUser.get(row.user_id) ?? []
    list.push(row as GutRow)
    byUser.set(row.user_id, list)
  }

  // Build one snapshot record per (user, metric) that has at least one value.
  const snapshots: object[] = []
  const computedAt = new Date().toISOString()

  for (const [userId, userRows] of byUser) {
    for (const metric of METRIC_KEYS) {
      // Preserve chronological order (rows already sorted by log_date asc).
      const values: number[] = userRows
        .map((r) => r[metric as MetricKey])
        .filter((v): v is number => v !== null && v !== undefined)

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
        data_sources: ["self_report"],
      })
    }
  }

  if (snapshots.length > 0) {
    const { error: upsertError } = await supabase
      .from("baseline_snapshots")
      .upsert(snapshots, { onConflict: "user_id,metric_key" })

    if (upsertError) {
      console.error("upsert error", upsertError)
      return new Response(JSON.stringify({ error: upsertError.message }), { status: 500 })
    }
  }

  return new Response(
    JSON.stringify({ ok: true, users: byUser.size, snapshots: snapshots.length }),
    { headers: { "Content-Type": "application/json" } },
  )
})
