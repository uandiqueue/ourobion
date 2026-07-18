/// <reference types="jsr:@supabase/functions-js/edge-runtime.d.ts" />
import { createClient } from "jsr:@supabase/supabase-js@2.110.7"
import { METRICS } from "../../../shared/metrics/registry.ts"
import { validateCopyString } from "../../../shared/constants/copy_guidelines.ts"
import { classifyDaily } from "../evaluate-signals/stats.ts"
import { PAIR_GATES, SIGNAL_CONFIG } from "../evaluate-signals/config.ts"
import {
  ALLOWED_LAG_DAYS,
  EVALUATORS,
  evaluateCoincidence,
  evaluateThreshold,
  evaluateTrend,
  windowedBaseline,
  type CoincidenceParams,
  type EngineBaseline,
  type ThresholdParams,
  type TrendParams,
} from "./evaluators.ts"
import {
  classifyPattern,
  completenessScore,
  insightId,
  pairKey,
  personalPassesGate,
  type Branch,
  type CandidatePattern,
  type PersonalSignalRow,
  type ServableEdge,
} from "./composer.ts"
import {
  directionPhrase,
  edgeCardTemplate,
  edgeRuleId,
  PERSONAL_CARD_TEMPLATE,
  personalRuleId,
  RELATIONSHIP_CATEGORY,
  relationPhrase,
  renderCard,
} from "./render.ts"

// ─── S7 + S8 · generate-insights, data-driven (insight-engine-architecture §S7/§S8; ─────────
// rules-engine-design §C) ────────────────────────────────────────────────────────────────────
//
// The MVP's 6 hardcoded rules are GONE (their blueprints shipped in data/rules/**, U5): rules
// now load from the derived `rules` table and evaluate through the pure evaluators, including
// cross-metric `coincidence` rules SCOPED TO BRAIN NEIGHBOURS (a servable verified_edges 1-hop
// edge must connect the pair — C10) with lag windows from the C10 set {0,1,3,7}.
//
// FiredPattern consumption (§S4 "transport: pure function called in-process by S7's job"):
// the S4 3-state classify is RECOMPUTED IN-PROCESS by importing evaluate-signals' shared
// stats/config modules directly (they are Deno-free and dependency-free by construction) —
// no HTTP call to evaluate-signals, no fired-pattern store.
//
// The S7 composer joins each candidate (fired signal patterns + fired coincidence rules) to
// its 1-hop servable edges + the user's personal_signals row, classifies the branch
// (agree / research-context / idiosyncratic / contradiction — truth table in composer.ts),
// scores completeness from S2 raw day-counts with registry dqs weights, and appends
// composed_insights (idempotent on the deterministic insight_id).
//
// The S8 producer renders deterministic template copy (NO LLM in this function — the phrasing
// LLM is a later, copy-gated, cached layer; the template path shipped here stays its fallback),
// runs the RENDER-TIME validateCopyString gate (failing card dropped + logged), respects
// dismissals AND snoozes (both user-held until the user acts — D17, audit A18), honors
// per-rule expiry, and upserts on (user_id, rule_id) with the three §S8
// producer namespaces: 'rules' (blueprint ids), 'edge' ('edge:'||edge_id, cited relationship
// cards), 'personal' ('personal:'||a||'|'||b, the uncited "still researching" variant).

// ─── Registry-derived configuration (never hardcoded keys) ──────────────────────────────────

const BASELINE_METRICS = METRICS.filter((m) => m.status === "active" && m.baselineApplicable)
const BASELINE_METRIC_KEYS = BASELINE_METRICS.map((m) => m.key)
const SIGNAL_METRICS = BASELINE_METRICS.filter((m) => m.signal !== null)
const DEADBAND_K = new Map(SIGNAL_METRICS.map((m) => [m.key, m.signal!.deadbandK]))
const DQS_WEIGHT = new Map(BASELINE_METRICS.map((m) => [m.key, m.dqs.weight]))
const METRIC_LABEL = new Map(
  METRICS.map((m) => [m.key, m.ui?.label ?? m.key.split("_").join(" ")]),
)

const label = (key: string): string => METRIC_LABEL.get(key) ?? key.split("_").join(" ")
const dqsWeight = (key: string): number => DQS_WEIGHT.get(key) ?? 0

// ─── Engine configuration (named, never inline — ADR-0002 house style) ──────────────────────

/** Phases the engine currently evaluates (`rules.enabled_phase` gate, rules-engine-design §B2). */
const ACTIVE_PHASES: ReadonlySet<string> = new Set(["phase1_stage1", "phase2_engine"])

/** §S7 completeness window — the S4 signal window (28 days), one window for every pattern kind. */
const COMPLETENESS_WINDOW_DAYS = SIGNAL_CONFIG.windowDays

/** Composer cards (edge / personal) expire like the MVP's rule cards did — 7 days (provisional). */
const COMPOSER_EXPIRY_DAYS = 7

/** phase_generated stamped on composer-produced cards (rule cards carry their rule's phase). */
const COMPOSER_PHASE = "phase2_engine"

/**
 * User-held card statuses the regeneration pass must never overwrite (sign-off D17, audit
 * A18): a `snoozed` card is skipped exactly like a `dismissed` one — the hold persists until
 * the USER changes the status. N-day auto-reactivation (a snooze-until column) is deliberately
 * deferred to Jayden (D17). Skipping happens at pushCard — the only writer into the
 * (user_id, rule_id) upsert batch — so a held card can never be re-upserted `status: 'active'`.
 */
const USER_HELD_STATUSES: ReadonlySet<string> = new Set(["dismissed", "snoozed"])

/** Confidence-level → 0–1 score for RULE cards (preserved from the MVP for M6 / future use). */
const CONFIDENCE_SCORE: Record<string, number> = {
  insufficient: 0.1,
  low: 0.33,
  medium: 0.66,
  high: 1.0,
}

// ─── Row shapes ──────────────────────────────────────────────────────────────────────────────

type Confidence = "insufficient" | "low" | "medium" | "high"

interface RuleRow {
  rule_id: string
  scope: "single" | "cross"
  metric_keys: string[]
  condition_type: string
  condition_params: Record<string, unknown>
  title_template: string
  body_template: string
  severity: string
  category: string
  enabled_phase: string
  effective_from: string | null
  effective_to: string | null
  deprecated_at: string | null
  expiry_days: number
}

interface BaselineRow {
  user_id: string
  metric_key: string
  mean: number | null
  std_dev: number | null
  min: number | null
  max: number | null
  trend: "rising" | "falling" | "stable" | null
  confidence: Confidence
  data_sources: string[]
  /** Rolling-stats window the snapshot was computed over (baseline v2 column — A23). */
  window_days: number
}

interface SeriesRow {
  user_id: string
  metric_key: string
  log_date: string
  value: number
  source: string
}

interface CardRow {
  user_id: string
  rule_id: string
  generated_at: string
  title: string
  body: string
  category: string
  severity: string
  contributing_metrics: string[]
  confidence_score: number
  confidence_sources: string[]
  status: "active"
  expires_at: string
  phase_generated: string
  producer: "rules" | "edge" | "personal"
  insight_id: string | null
  edge_refs: { edgeId: string; verifiedAt: string }[]
}

interface InsightRow {
  insight_id: string
  user_id: string
  period_start: string
  period_end: string
  branch: Branch
  payload: Record<string, unknown>
}

// ─── Small helpers ───────────────────────────────────────────────────────────────────────────

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().split("T")[0]
}

function round(n: number, digits: number): number {
  const f = 10 ** digits
  return Math.round(n * f) / f
}

function toEngineBaseline(row: BaselineRow): EngineBaseline {
  return {
    mean: row.mean,
    std_dev: row.std_dev,
    min: row.min,
    max: row.max,
    trend: row.trend,
    confidence: row.confidence,
    data_sources: row.data_sources ?? [],
  }
}

// ─── Paginated table reads (stable order — the compute-baselines mechanism) ─────────────────

const PAGE_SIZE = 1000

// deno-lint-ignore no-explicit-any
async function fetchAll<T>(query: (from: number, to: number) => any): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await query(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(error.message)
    const page = (data ?? []) as T[]
    rows.push(...page)
    if (page.length < PAGE_SIZE) break
  }
  return rows
}

// ─── Handler ─────────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  // A22: without this guard an unset env var degenerates the expected header to the literal
  // string "Bearer undefined" — fail loudly (500, secret never echoed) before any compare.
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!serviceRoleKey) {
    console.error("SUPABASE_SERVICE_ROLE_KEY is not set — refusing to serve")
    return new Response(
      JSON.stringify({ error: "server misconfiguration: service-role key unavailable" }),
      { status: 500 },
    )
  }

  const auth = req.headers.get("Authorization")
  if (!auth || auth !== `Bearer ${serviceRoleKey}`) {
    return new Response("Unauthorized", { status: 401 })
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceRoleKey)
  const day = new Date().toISOString().split("T")[0]
  const now = new Date().toISOString()
  const seriesStart = addDays(day, -SIGNAL_CONFIG.windowDays) // 28 baseline days + today
  const completenessStart = addDays(day, -(COMPLETENESS_WINDOW_DAYS - 1))

  // ── Fetch the five read surfaces ───────────────────────────────────────────────────────────
  let ruleRows: RuleRow[]
  let baselines: BaselineRow[]
  let existingCards: { user_id: string; rule_id: string; status: string }[]
  let personalRows: (PersonalSignalRow & { user_id: string })[]
  let edges: ServableEdge[]
  let seriesRows: SeriesRow[]
  try {
    ruleRows = await fetchAll<RuleRow>((from, to) =>
      supabase
        .from("rules")
        .select(
          "rule_id, scope, metric_keys, condition_type, condition_params, title_template, " +
            "body_template, severity, category, enabled_phase, effective_from, effective_to, " +
            "deprecated_at, expiry_days",
        )
        .is("deprecated_at", null)
        .order("rule_id", { ascending: true })
        .range(from, to),
    )
    baselines = await fetchAll<BaselineRow>((from, to) =>
      supabase
        .from("baseline_snapshots")
        .select(
          "user_id, metric_key, mean, std_dev, min, max, trend, confidence, data_sources, window_days",
        )
        .order("user_id", { ascending: true })
        .order("metric_key", { ascending: true })
        .range(from, to),
    )
    existingCards = await fetchAll((from, to) =>
      supabase
        .from("insight_cards")
        .select("user_id, rule_id, status")
        .order("user_id", { ascending: true })
        .order("rule_id", { ascending: true })
        .range(from, to),
    )
    personalRows = await fetchAll((from, to) =>
      supabase
        .from("personal_signals")
        .select("user_id, metric_a, metric_b, rho, n_eff, q_value, stable")
        .order("user_id", { ascending: true })
        .order("metric_a", { ascending: true })
        .order("metric_b", { ascending: true })
        .range(from, to),
    )
    edges = await fetchAll<ServableEdge>((from, to) =>
      supabase
        .from("verified_edges")
        .select("edge_id, subject, object, relation, verified_at, edge_score, serving_band, claim")
        .in("serving_band", ["high", "mid"]) // hold is never served (shared/brain isServable)
        .order("edge_id", { ascending: true })
        .range(from, to),
    )
    seriesRows = await fetchAll<SeriesRow>((from, to) =>
      supabase
        .from("metric_daily_values")
        .select("user_id, metric_key, log_date, value, source")
        .in("metric_key", BASELINE_METRIC_KEYS)
        .gte("log_date", seriesStart)
        .order("user_id", { ascending: true })
        .order("metric_key", { ascending: true })
        .order("log_date", { ascending: true })
        .range(from, to),
    )
  } catch (e) {
    console.error("generate-insights fetch error", e)
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500 })
  }

  // ── Load-time rule gate (belt over the loader's braces) ────────────────────────────────────
  // The loader (tools/rules/load_rules.mjs) already hard-fails bad blueprints; the engine
  // re-validates anyway so a hand-edited projection row can never reach a user: copy gate on
  // both templates, an evaluator must exist for the condition type, coincidence lag ∈ C10.
  const rules: RuleRow[] = []
  const ruleLoadIssues: { ruleId: string; reason: string }[] = []
  for (const rule of ruleRows) {
    if (!ACTIVE_PHASES.has(rule.enabled_phase)) continue
    if (rule.effective_from !== null && rule.effective_from > day) continue
    if (rule.effective_to !== null && rule.effective_to < day) continue
    if (!(rule.condition_type in EVALUATORS)) {
      ruleLoadIssues.push({ ruleId: rule.rule_id, reason: `no evaluator for condition_type "${rule.condition_type}"` })
      continue
    }
    if (!validateCopyString(rule.title_template) || !validateCopyString(rule.body_template)) {
      ruleLoadIssues.push({ ruleId: rule.rule_id, reason: "template fails validateCopyString (load-time copy gate)" })
      continue
    }
    if (rule.condition_type === "coincidence") {
      const lag = (rule.condition_params as unknown as CoincidenceParams).lagDays
      if (lag !== null && !ALLOWED_LAG_DAYS.has(lag)) {
        ruleLoadIssues.push({ ruleId: rule.rule_id, reason: `lagDays ${lag} outside the C10 set {0,1,3,7}` })
        continue
      }
    }
    rules.push(rule)
  }
  for (const issue of ruleLoadIssues) {
    console.warn(`rule skipped at load: ${issue.ruleId} — ${issue.reason}`)
  }

  // ── Index the read surfaces ────────────────────────────────────────────────────────────────
  // User-held cards (dismissed / snoozed — D17): key → status, consulted before every push.
  const heldStatusByKey = new Map<string, string>()
  for (const c of existingCards) {
    if (USER_HELD_STATUSES.has(c.status)) heldStatusByKey.set(`${c.user_id}:${c.rule_id}`, c.status)
  }

  const snapshotsByUser = new Map<string, Map<string, BaselineRow>>()
  for (const b of baselines) {
    let m = snapshotsByUser.get(b.user_id)
    if (!m) snapshotsByUser.set(b.user_id, (m = new Map()))
    m.set(b.metric_key, b)
  }

  const personalByUser = new Map<string, Map<string, PersonalSignalRow>>()
  for (const p of personalRows) {
    let m = personalByUser.get(p.user_id)
    if (!m) personalByUser.set(p.user_id, (m = new Map()))
    m.set(pairKey(p.metric_a, p.metric_b), p)
  }

  // §S6 1-hop lookup, in-memory: by endpoint and by pair (servable rows only — filtered above).
  const edgesByMetric = new Map<string, ServableEdge[]>()
  const edgesByPair = new Map<string, ServableEdge[]>()
  for (const e of edges) {
    for (const key of [e.subject, e.object]) {
      const list = edgesByMetric.get(key) ?? []
      list.push(e)
      edgesByMetric.set(key, list)
    }
    const pk = pairKey(e.subject, e.object)
    const list = edgesByPair.get(pk) ?? []
    list.push(e)
    edgesByPair.set(pk, list)
  }

  const seriesByUser = new Map<string, Map<string, Map<string, number>>>()
  for (const row of seriesRows) {
    if (typeof row.value !== "number") continue
    let metrics = seriesByUser.get(row.user_id)
    if (!metrics) seriesByUser.set(row.user_id, (metrics = new Map()))
    let series = metrics.get(row.metric_key)
    if (!series) metrics.set(row.metric_key, (series = new Map()))
    series.set(row.log_date, row.value)
  }

  // ── Per-user evaluation → composition → production ─────────────────────────────────────────
  const cardsByKey = new Map<string, CardRow>() // in-batch dedupe on (user_id, rule_id)
  const insightsById = new Map<string, InsightRow>()
  const renderDrops: { userId: string; ruleId: string; reason: string }[] = []
  const brainScopeSkips: { userId: string; ruleId: string; pair: string }[] = []
  let firedPatternCount = 0
  let dismissedSkips = 0
  let snoozedSkips = 0
  const branchCounts: Record<Branch, number> = {
    agree: 0,
    "research-context": 0,
    idiosyncratic: 0,
    contradiction: 0,
  }

  const userIds = new Set<string>([...seriesByUser.keys(), ...snapshotsByUser.keys()])

  for (const userId of userIds) {
    const metrics = seriesByUser.get(userId) ?? new Map<string, Map<string, number>>()
    const snapshots = snapshotsByUser.get(userId) ?? new Map<string, BaselineRow>()
    const personal = personalByUser.get(userId) ?? new Map<string, PersonalSignalRow>()
    const personalFor = (pk: string): PersonalSignalRow | null => personal.get(pk) ?? null

    // Completeness inputs: non-null day count per metric inside the 28-day window (S2 raw).
    const daysPresent = new Map<string, number>()
    for (const [metricKey, series] of metrics) {
      let n = 0
      for (const date of series.keys()) if (date >= completenessStart && date <= day) n++
      daysPresent.set(metricKey, n)
    }

    const snapshotSources = (metricKeys: readonly string[]): string[] => {
      const out = new Set<string>()
      for (const key of metricKeys) {
        for (const s of snapshots.get(key)?.data_sources ?? []) out.add(s)
      }
      return out.size > 0 ? [...out].sort() : ["self_report"]
    }

    const pushCard = (card: CardRow): void => {
      const key = `${card.user_id}:${card.rule_id}`
      // D17 / A18: a user-held card (dismissed OR snoozed) is never re-upserted — the upsert
      // would rewrite `status: 'active'` over the user's choice. Held = held until the user acts.
      const held = heldStatusByKey.get(key)
      if (held !== undefined) {
        if (held === "dismissed") dismissedSkips++
        else snoozedSkips++
        return
      }
      if (!cardsByKey.has(key)) cardsByKey.set(key, card) // first wins; duplicates are equivalent
    }

    const pushInsight = (row: InsightRow): void => {
      if (!insightsById.has(row.insight_id)) {
        insightsById.set(row.insight_id, row)
        branchCounts[row.branch]++
      }
    }

    // ── S4 recompute, in-process (shared stats module — see header) ──────────────────────────
    const userStates: Record<string, "up" | "down"> = {}
    const firedSignals: CandidatePattern[] = []
    for (const [metricKey, series] of metrics) {
      const todayValue = series.get(day)
      if (todayValue === undefined) continue
      const deadbandK = DEADBAND_K.get(metricKey)
      if (deadbandK === undefined) continue // metric S4 never signals on
      const baseline: number[] = []
      for (const [date, value] of series) {
        if (date >= seriesStart && date < day) baseline.push(value)
      }
      const signal = classifyDaily(baseline, todayValue, deadbandK, SIGNAL_CONFIG)
      if (signal.state === "neutral") continue
      userStates[metricKey] = signal.state
      firedSignals.push({
        patternKey: `signal:${metricKey}:${signal.state}`,
        kind: "signal",
        metricKeys: [metricKey],
        states: {}, // filled with userStates below (direction check reads both endpoints)
        stats: {
          zScore: signal.modifiedZ === null ? null : round(signal.modifiedZ, 4),
          trend: null,
          windowDays: SIGNAL_CONFIG.windowDays,
        },
      })
      firedPatternCount++
    }
    for (const p of firedSignals) p.states = userStates

    // ── Rules evaluation (data-driven — zero hardcoded rules) ─────────────────────────────────
    for (const rule of rules) {
      if (rule.condition_type === "trend" || rule.condition_type === "threshold") {
        const params = rule.condition_params as unknown as TrendParams | ThresholdParams
        const snapshot = snapshots.get(params.metricKey)
        if (!snapshot) continue // metric not available for this user
        const baseline = toEngineBaseline(snapshot)
        const fired =
          rule.condition_type === "trend"
            ? evaluateTrend(params as TrendParams, baseline)
            : evaluateThreshold(params as ThresholdParams, baseline)
        if (!fired) continue

        const rendered = renderCard(
          { title: rule.title_template, body: rule.body_template },
          {
            metric_label: label(params.metricKey),
            mean: snapshot.mean ?? "",
            std_dev: snapshot.std_dev ?? "",
            min: snapshot.min ?? "",
            max: snapshot.max ?? "",
            trend: snapshot.trend ?? "",
            window_days: snapshot.window_days, // the snapshot's actual window (A23)
          },
        )
        if (!rendered.ok) {
          renderDrops.push({ userId, ruleId: rule.rule_id, reason: JSON.stringify(rendered.failure) })
          console.warn(`card dropped at render: ${userId}:${rule.rule_id}`, rendered.failure)
          continue
        }
        pushCard({
          user_id: userId,
          rule_id: rule.rule_id,
          generated_at: now,
          title: rendered.copy.title,
          body: rendered.copy.body,
          category: rule.category,
          severity: rule.severity,
          contributing_metrics: [...rule.metric_keys],
          confidence_score: CONFIDENCE_SCORE[snapshot.confidence] ?? 0.1,
          confidence_sources: snapshot.data_sources ?? ["self_report"],
          status: "active",
          expires_at: addDaysIso(now, rule.expiry_days),
          phase_generated: rule.enabled_phase,
          producer: "rules",
          insight_id: null,
          edge_refs: [],
        })
        continue
      }

      // coincidence — brain-neighbour scoped (C10): only evaluated when a servable 1-hop edge
      // connects the pair; the lag window comes from lagDays (both[1] trails both[0]).
      const params = rule.condition_params as unknown as CoincidenceParams
      const [keyA, keyB] = params.metricKeys
      const pk = pairKey(keyA, keyB)
      const pairEdges = edgesByPair.get(pk) ?? []
      if (pairEdges.length === 0) {
        brainScopeSkips.push({ userId, ruleId: rule.rule_id, pair: pk })
        continue
      }

      const getBaseline = (metricKey: string, lagDays: number): EngineBaseline | null => {
        if (lagDays === 0) {
          const snapshot = snapshots.get(metricKey)
          return snapshot ? toEngineBaseline(snapshot) : null
        }
        const series = metrics.get(metricKey)
        if (!series) return null
        return windowedBaseline(series, addDays(day, -lagDays))
      }
      if (!evaluateCoincidence(params, getBaseline)) continue

      // Observed directions: trend leaves carry one (rising→up / falling→down); S4 states fill in.
      const leafStates: Record<string, "up" | "down"> = { ...userStates }
      for (const leaf of params.both) {
        if (leaf.type === "trend" && leaf.equals !== "stable") {
          leafStates[leaf.metricKey] = leaf.equals === "rising" ? "up" : "down"
        }
      }
      const pattern: CandidatePattern = {
        patternKey: `rule:${rule.rule_id}`,
        kind: "coincidence",
        metricKeys: [...rule.metric_keys],
        states: leafStates,
        stats: { lagDays: params.lagDays ?? 0, windowDays: 7 },
      }
      firedPatternCount++

      const classified = classifyPattern(pattern, pairEdges, personalFor, PAIR_GATES)
      if (classified === null) continue // unreachable while pairEdges is non-empty
      const topEdge = classified.topEdge ?? pairEdges[0]
      const id = await insightId(userId, pattern.patternKey, topEdge.edge_id, day)
      const completeness = completenessScore(
        rule.metric_keys,
        daysPresent,
        COMPLETENESS_WINDOW_DAYS,
        dqsWeight,
      )
      pushInsight({
        insight_id: id,
        user_id: userId,
        period_start: day,
        period_end: day,
        branch: classified.branch,
        payload: {
          patternKey: pattern.patternKey,
          pattern,
          edges: classified.edges,
          personal: classified.personal
            ? {
              rho: classified.personal.rho,
              nEff: classified.personal.n_eff,
              qValue: classified.personal.q_value,
              stable: classified.personal.stable,
            }
            : null,
          branch: classified.branch,
          completeness,
        },
      })

      // contradiction is never surfaced (§S7); agree / research-context render the rule's card.
      if (classified.branch !== "agree" && classified.branch !== "research-context") continue
      const rendered = renderCard(
        { title: rule.title_template, body: rule.body_template },
        {
          metric_a_label: label(keyA),
          metric_b_label: label(keyB),
          lag_days: params.lagDays ?? 0,
        },
      )
      if (!rendered.ok) {
        renderDrops.push({ userId, ruleId: rule.rule_id, reason: JSON.stringify(rendered.failure) })
        console.warn(`card dropped at render: ${userId}:${rule.rule_id}`, rendered.failure)
        continue
      }
      const monotonicConsistent = pairEdges.filter(
        (e) => classified.edges.find((r) => r.edgeId === e.edge_id)?.direction === "consistent",
      )
      pushCard({
        user_id: userId,
        rule_id: rule.rule_id,
        generated_at: now,
        title: rendered.copy.title,
        body: rendered.copy.body,
        category: rule.category,
        severity: rule.severity,
        contributing_metrics: [...rule.metric_keys],
        confidence_score: round(topEdge.edge_score, 3),
        confidence_sources: [...new Set([...snapshotSources(rule.metric_keys), "brain"])].sort(),
        status: "active",
        expires_at: addDaysIso(now, rule.expiry_days),
        phase_generated: rule.enabled_phase,
        producer: "rules",
        insight_id: id,
        edge_refs: (monotonicConsistent.length > 0 ? monotonicConsistent : pairEdges).map((e) => ({
          edgeId: e.edge_id,
          verifiedAt: e.verified_at,
        })),
      })
    }

    // ── S7 composition over the fired S4 signal patterns ──────────────────────────────────────
    for (const pattern of firedSignals) {
      const metricKey = pattern.metricKeys[0]
      const oneHop = edgesByMetric.get(metricKey) ?? []

      const classified = classifyPattern(pattern, oneHop, personalFor, PAIR_GATES)
      if (classified !== null && oneHop.length > 0) {
        const topEdge = classified.topEdge
        const contributing = topEdge ? [topEdge.subject, topEdge.object] : [metricKey]
        const id = await insightId(userId, pattern.patternKey, topEdge?.edge_id ?? null, day)
        const completeness = completenessScore(
          contributing,
          daysPresent,
          COMPLETENESS_WINDOW_DAYS,
          dqsWeight,
        )
        pushInsight({
          insight_id: id,
          user_id: userId,
          period_start: day,
          period_end: day,
          branch: classified.branch,
          payload: {
            patternKey: pattern.patternKey,
            pattern,
            edges: classified.edges,
            personal: classified.personal
              ? {
                rho: classified.personal.rho,
                nEff: classified.personal.n_eff,
                qValue: classified.personal.q_value,
                stable: classified.personal.stable,
              }
              : null,
            branch: classified.branch,
            completeness,
          },
        })

        // agree → the cited edge card (producer 'edge', rule_id = 'edge:'||edge_id — both
        // endpoints' patterns collapse onto the same upsert key by construction).
        if (classified.branch === "agree" && topEdge !== null) {
          const state = userStates[metricKey]
          // A21: the "matching pattern" clause ships only when a gate-passing personal signal
          // backs it (classified.personal is exactly that row, or null).
          const rendered = renderCard(edgeCardTemplate(classified.personal !== null), {
            metric_a_label: label(topEdge.subject),
            metric_b_label: label(topEdge.object),
            pattern_metric_label: label(metricKey),
            direction_phrase: directionPhrase(state ?? "up"),
            relation_phrase: relationPhrase(topEdge.relation),
          })
          if (!rendered.ok) {
            renderDrops.push({
              userId,
              ruleId: edgeRuleId(topEdge.edge_id),
              reason: JSON.stringify(rendered.failure),
            })
            console.warn(`card dropped at render: ${userId}:${edgeRuleId(topEdge.edge_id)}`, rendered.failure)
          } else {
            pushCard({
              user_id: userId,
              rule_id: edgeRuleId(topEdge.edge_id),
              generated_at: now,
              title: rendered.copy.title,
              body: rendered.copy.body,
              category: RELATIONSHIP_CATEGORY,
              severity: "info",
              contributing_metrics: contributing,
              confidence_score: round(topEdge.edge_score, 3),
              confidence_sources: [...new Set([...snapshotSources(contributing), "brain"])].sort(),
              status: "active",
              expires_at: addDaysIso(now, COMPOSER_EXPIRY_DAYS),
              phase_generated: COMPOSER_PHASE,
              producer: "edge",
              insight_id: id,
              edge_refs: [{ edgeId: topEdge.edge_id, verifiedAt: topEdge.verified_at }],
            })
          }
        }
      }

      // idiosyncratic sweep: gate-passing personal pairs involving this metric with NO servable
      // edge → the "still researching" card (uncited, edge_refs = [] by CHECK) + its insight.
      for (const [pk, row] of personal) {
        const [a, b] = pk.split("|")
        if (a !== metricKey && b !== metricKey) continue
        if (edgesByPair.has(pk)) continue
        if (!personalPassesGate(row, PAIR_GATES)) continue

        const partnerPattern: CandidatePattern = {
          patternKey: `personal:${pk}`,
          kind: pattern.kind,
          metricKeys: [a, b],
          states: userStates,
          stats: pattern.stats,
        }
        const id = await insightId(userId, partnerPattern.patternKey, null, day)
        const completeness = completenessScore(
          [a, b],
          daysPresent,
          COMPLETENESS_WINDOW_DAYS,
          dqsWeight,
        )
        pushInsight({
          insight_id: id,
          user_id: userId,
          period_start: day,
          period_end: day,
          branch: "idiosyncratic",
          payload: {
            patternKey: partnerPattern.patternKey,
            pattern: partnerPattern,
            edges: [],
            personal: { rho: row.rho, nEff: row.n_eff, qValue: row.q_value, stable: row.stable },
            branch: "idiosyncratic",
            completeness,
          },
        })

        const rendered = renderCard(PERSONAL_CARD_TEMPLATE, {
          metric_a_label: label(a),
          metric_b_label: label(b),
        })
        if (!rendered.ok) {
          renderDrops.push({ userId, ruleId: personalRuleId(a, b), reason: JSON.stringify(rendered.failure) })
          console.warn(`card dropped at render: ${userId}:${personalRuleId(a, b)}`, rendered.failure)
          continue
        }
        pushCard({
          user_id: userId,
          rule_id: personalRuleId(a, b),
          generated_at: now,
          title: rendered.copy.title,
          body: rendered.copy.body,
          category: RELATIONSHIP_CATEGORY,
          severity: "info",
          contributing_metrics: [a, b],
          confidence_score: round(Math.min(1, Math.abs(row.rho)), 3),
          confidence_sources: snapshotSources([a, b]),
          status: "active",
          expires_at: addDaysIso(now, COMPOSER_EXPIRY_DAYS),
          phase_generated: COMPOSER_PHASE,
          producer: "personal",
          insight_id: id,
          edge_refs: [], // NEVER cited (§S8 CHECK: producer 'personal' ⇒ edge_refs = '[]')
        })
      }
    }
  }

  // ── Persist: composed_insights first (cards FK it), then the card upsert ────────────────────
  const insightRows = [...insightsById.values()]
  if (insightRows.length > 0) {
    const { error } = await supabase
      .from("composed_insights")
      .upsert(insightRows, { onConflict: "insight_id", ignoreDuplicates: true }) // append-only
    if (error) {
      console.error("composed_insights insert error", error)
      return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }
  }

  const cardRows = [...cardsByKey.values()]
  if (cardRows.length > 0) {
    const { error } = await supabase
      .from("insight_cards")
      .upsert(cardRows, { onConflict: "user_id,rule_id" })
    if (error) {
      console.error("insight_cards upsert error", error)
      return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }
  }

  const producerCounts = { rules: 0, edge: 0, personal: 0 }
  for (const c of cardRows) producerCounts[c.producer]++

  return new Response(
    JSON.stringify({
      ok: true,
      day,
      users: userIds.size,
      rules: { loaded: rules.length, skippedAtLoad: ruleLoadIssues },
      firedPatterns: firedPatternCount,
      insights: { upserted: insightRows.length, byBranch: branchCounts },
      cards: {
        upserted: cardRows.length,
        byProducer: producerCounts,
        droppedAtRender: renderDrops,
        dismissedSkipped: dismissedSkips,
        snoozedSkipped: snoozedSkips,
      },
      brainScopeSkips,
    }),
    { headers: { "Content-Type": "application/json" } },
  )
})

/** ISO datetime `days` days after `fromIso`. */
function addDaysIso(fromIso: string, days: number): string {
  return new Date(new Date(fromIso).getTime() + days * 24 * 60 * 60 * 1000).toISOString()
}
