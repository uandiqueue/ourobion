/// <reference types="jsr:@supabase/functions-js/edge-runtime.d.ts" />
import { createClient } from "jsr:@supabase/supabase-js@2"

// ─── Types ────────────────────────────────────────────────────────────────────

interface BaselineSnapshot {
  user_id: string
  metric_key: string
  mean: number | null
  std_dev: number | null
  trend: "rising" | "falling" | "stable" | null
  confidence: "insufficient" | "low" | "medium" | "high"
  data_sources: string[]
}

interface Rule {
  ruleId: string
  metricKey: string
  category: string
  title: string
  body: string
  condition: (s: BaselineSnapshot) => boolean
}

// ─── Rules ────────────────────────────────────────────────────────────────────
// Phase 1 Stage 1: descriptive discovery only. Single metric per rule.
// No threshold alerts. All copy is observational — never diagnostic.

const notInsufficient = (s: BaselineSnapshot) => s.confidence !== "insufficient"

const RULES: Rule[] = [
  {
    ruleId: "hydration_trending_up",
    metricKey: "urine_colour",
    category: "hydration",
    title: "Hydration pattern this week",
    body: "Your urine colour data shows a rising pattern over the past week.",
    condition: (s) => s.trend === "rising" && notInsufficient(s),
  },
  {
    ruleId: "hydration_trending_down",
    metricKey: "urine_colour",
    category: "hydration",
    title: "Hydration pattern this week",
    body: "Your urine colour data shows a falling pattern this week — values suggest improving hydration.",
    condition: (s) => s.trend === "falling" && notInsufficient(s),
  },
  {
    ruleId: "gut_form_stable",
    metricKey: "stool_form",
    category: "gut",
    title: "Gut consistency pattern",
    body: "Your stool consistency data has been notably stable this week.",
    condition: (s) => s.std_dev !== null && s.std_dev <= 1.0 && notInsufficient(s),
  },
  {
    ruleId: "gut_form_variable",
    metricKey: "stool_form",
    category: "gut",
    title: "Gut consistency pattern",
    body: "Your stool consistency data shows notable variation this week.",
    condition: (s) => s.std_dev !== null && s.std_dev > 2.0 && notInsufficient(s),
  },
  {
    ruleId: "energy_trending_down",
    metricKey: "energy_score",
    category: "behaviour",
    title: "Energy pattern this week",
    body: "Your energy data shows a declining pattern over the past week.",
    condition: (s) => s.trend === "falling" && notInsufficient(s),
  },
  {
    ruleId: "gut_comfort_trending_down",
    metricKey: "gut_comfort_score",
    category: "gut",
    title: "Gut comfort pattern",
    body: "Your gut comfort data shows a declining pattern over the past week.",
    condition: (s) => s.trend === "falling" && notInsufficient(s),
  },
]

// Maps confidence level to a 0–1 score stored on the card for M6 / future use.
const CONFIDENCE_SCORE: Record<string, number> = {
  insufficient: 0.1,
  low: 0.33,
  medium: 0.66,
  high: 1.0,
}

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

  const auth = req.headers.get("Authorization")
  if (!auth || auth !== `Bearer ${serviceRoleKey}`) {
    return new Response("Unauthorized", { status: 401 })
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceRoleKey!)

  // Fetch all current baselines across all users.
  const { data: baselines, error: bError } = await supabase
    .from("baseline_snapshots")
    .select("user_id, metric_key, mean, std_dev, trend, confidence, data_sources")

  if (bError) {
    console.error("baselines fetch", bError)
    return new Response(JSON.stringify({ error: bError.message }), { status: 500 })
  }

  // Fetch existing cards — only need user_id, rule_id, status to check dismissals.
  const { data: existingCards, error: cError } = await supabase
    .from("insight_cards")
    .select("user_id, rule_id, status")

  if (cError) {
    console.error("cards fetch", cError)
    return new Response(JSON.stringify({ error: cError.message }), { status: 500 })
  }

  // Build a set of dismissed "userId:ruleId" keys — these are never regenerated.
  const dismissed = new Set(
    (existingCards ?? [])
      .filter((c) => c.status === "dismissed")
      .map((c) => `${c.user_id}:${c.rule_id}`)
  )

  // Index baselines by user → metricKey for O(1) rule evaluation.
  const byUser = new Map<string, Map<string, BaselineSnapshot>>()
  for (const b of baselines ?? []) {
    if (!byUser.has(b.user_id)) byUser.set(b.user_id, new Map())
    byUser.get(b.user_id)!.set(b.metric_key, b as BaselineSnapshot)
  }

  const now = new Date().toISOString()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const upserts: object[] = []

  for (const [userId, metrics] of byUser) {
    for (const rule of RULES) {
      const snapshot = metrics.get(rule.metricKey)
      if (!snapshot) continue
      if (!rule.condition(snapshot)) continue
      if (dismissed.has(`${userId}:${rule.ruleId}`)) continue

      upserts.push({
        user_id: userId,
        rule_id: rule.ruleId,
        generated_at: now,
        title: rule.title,
        body: rule.body,
        category: rule.category,
        severity: "info",
        contributing_metrics: [rule.metricKey],
        confidence_score: CONFIDENCE_SCORE[snapshot.confidence] ?? 0.1,
        confidence_sources: snapshot.data_sources,
        status: "active",
        expires_at: expiresAt,
        phase_generated: "phase1_stage1",
      })
    }
  }

  if (upserts.length > 0) {
    const { error: upsertError } = await supabase
      .from("insight_cards")
      .upsert(upserts, { onConflict: "user_id,rule_id" })

    if (upsertError) {
      console.error("upsert", upsertError)
      return new Response(JSON.stringify({ error: upsertError.message }), { status: 500 })
    }
  }

  return new Response(
    JSON.stringify({ ok: true, users: byUser.size, cards_upserted: upserts.length }),
    { headers: { "Content-Type": "application/json" } },
  )
})
