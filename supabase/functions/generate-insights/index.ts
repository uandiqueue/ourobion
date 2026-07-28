/// <reference types="jsr:@supabase/functions-js/edge-runtime.d.ts" />
import { createClient } from "jsr:@supabase/supabase-js@2.110.7"
import { METRICS } from "../../../shared/metrics/registry.ts"
import { validateCopyString } from "../../../shared/constants/copy_guidelines.ts"
import { unauthorizedResponse, verifyInternalSecretRequest } from "../_shared/internal_auth.ts"
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
  gapStatusFor,
  composeClaimKind,
  composeTrustPosture,
  insightId,
  pairKey,
  personalPassesGate,
  rendersCard,
  type Branch,
  type CandidatePattern,
  type ComposedClaimKind,
  type ComposedTrustPosture,
  type GapStatus,
  type PersonalSignalRow,
  type ServableEdge,
} from "./composer.ts"
import {
  directionPhrase,
  edgeCardTemplate,
  edgeRuleId,
  PERSONAL_CARD_TEMPLATE,
  personalRuleId,
  postureDisclosure,
  RELATIONSHIP_CATEGORY,
  relationPhrase,
  renderCard,
} from "./render.ts"
// R4-U4/O27 · the shared, tested artifact-trust rule. Imported from trust_labels.ts — the
// import-free shared module — for the same reason validateCopyString is imported straight from
// copy_guidelines.ts: one definition, no vendored copy that could drift. It must be this module
// and not provenance.ts, because Deno resolves specifiers literally and cannot follow the
// extensionless imports the rest of shared/brain uses.
import {
  trustFailures,
  type ServingEnvironment,
} from "../../../shared/brain/trust_labels.ts"

/**
 * R4-U4/O27 · Which trust posture this serving path runs under.
 *
 * DEFAULTS TO `production` — the STRICTEST value — on purpose. An unset variable must not be the
 * permissive case: a deployment that forgot to configure this has to fail closed, not silently
 * serve fixture-derived cards as if they were real findings. Local and demo runs opt IN by
 * setting OUROBION_SERVING_ENV=demo (or =development), which is what permits fixture artifacts —
 * always with the fixture disclosed on the card (B-UI9), never silently.
 */
const SERVING_ENVIRONMENT: ServingEnvironment = ((): ServingEnvironment => {
  const raw = Deno.env.get("OUROBION_SERVING_ENV")
  return raw === "demo" || raw === "development" || raw === "production" ? raw : "production"
})()

// ─── S7 + S8 · generate-insights, data-driven (insight-engine-architecture §S7/§S8; ─────────
// rules-engine-design §C) ────────────────────────────────────────────────────────────────────
//
// The MVP's 6 hardcoded rules are GONE (their blueprints shipped in data/rules/**, U5): rules
// now load from the derived `rules` table and evaluate through the pure evaluators, including
// cross-metric `coincidence` rules SCOPED TO BRAIN NEIGHBOURS (a servable verified_edges 1-hop
// edge must connect the pair — C10) with lag windows from the C10 set {0,1,2,3,7} (lag 2 added
// per phase2-research-fixes C4·F5 / RU7 — gut-transit & DOMS peak near the 1–3 day boundary).
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
// SURFACING (O16 + O18, `rendersCard` in composer.ts is the single policy): only `agree` with
// a SUBJECT-endpoint cardEdge and `idiosyncratic` ever render a user card. research-context and
// contradiction are GAP-ONLY (composed row + A1 gap event — architecture §S7, decision O18(a)),
// and an object-only fired signal (O16: the fired metric is only an edge's OBJECT endpoint)
// likewise records a gap event instead of a card — a card never states the non-fired endpoint
// as having moved. Gap events land in gap_ledger via record_gap_events() (§A1): aggregate
// demand per (pair, status), deduped per user per run, NO user ids (privacy invariant).
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
 * O19 defense-in-depth (verdict H2): baseline_snapshots is refreshed AND pruned by every
 * successful compute-baselines run, so under normal operation no snapshot is older than the
 * last run. A snapshot whose computed_at is older than this many days therefore survives only
 * when the baseline job is down or its prune was skipped (the A14 empty-input guard) — and it
 * describes a 7-day stats window that has entirely rolled past. Exclude it from evaluation
 * rather than serving stale stats. One baseline window (7 days) is the shipped provisional
 * value — named config, never inline (ADR-0002 house style; calibration is a data change).
 */
const SNAPSHOT_FRESHNESS_DAYS = 7

/**
 * User-held card statuses the regeneration pass must never overwrite (sign-off D17, audit
 * A18): a `snoozed` card is skipped exactly like a `dismissed` one — the hold persists until
 * the USER changes the status. N-day auto-reactivation (a snooze-until column) is deliberately
 * deferred to Jayden (D17). Skipping happens at pushCard — the only writer into the
 * (user_id, rule_id) upsert batch — so a held card can never be re-upserted `status: 'active'`.
 *
 * ⚠ EVERY non-`active` value of insight_cards.status MUST appear here. A value that is missing
 * is not "not held" — it is silently UN-held: the nightly pass re-upserts the card
 * `status: 'active'` and the user's choice disappears with no error anywhere. `archived` (the
 * biotope Archive tab's save, added 20260728040000) is held for exactly this reason.
 * The value set is mirrored by shared/types/index.ts InsightCard.status, the migration's status
 * CHECK, and the Dart `InsightStatus` enum; drift between them is caught by
 * apps/biotope/test/m5b_insight_engine/insight_status_contract_test.dart, which parses THIS
 * literal out of THIS file rather than trusting a copy.
 */
const USER_HELD_STATUSES: ReadonlySet<string> = new Set(["dismissed", "snoozed", "archived"])

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
  /**
   * R4-U4/O27: a cited card's edge ref carries the scientific meaning and trust posture forward
   * alongside the edge identity, so the provenance surface reads them from the CARD rather than
   * re-deriving them (and so it cannot disagree with what was actually rendered). The extra keys
   * are additive and optional — the `rules` and `personal` producers still write `[]`, and the
   * U7 biotope consumer ignores keys it does not know.
   */
  edge_refs: {
    edgeId: string
    verifiedAt: string
    claimKind?: ComposedClaimKind
    trust?: ComposedTrustPosture
    studyDesignTier?: number | null
  }[]
}

interface InsightRow {
  insight_id: string
  user_id: string
  period_start: string
  period_end: string
  branch: Branch
  payload: Record<string, unknown>
}

/** One record_gap_events() element (§A1 aggregate demand — NO user id ever leaves the batch). */
interface GapEventRow {
  metric_a: string
  metric_b: string
  status: GapStatus
  demand: number
  completeness?: number
  lit_candidate?: Record<string, unknown>
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

  // ── Configuration guard — reachable only by an AUTHORIZED caller, so 500 leaks nothing.
  // SUPABASE_SERVICE_ROLE_KEY is a DATABASE credential here, never a request credential.
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!serviceRoleKey) {
    console.error("SUPABASE_SERVICE_ROLE_KEY is not set — refusing to serve")
    return new Response(
      JSON.stringify({ error: "server misconfiguration: service-role key unavailable" }),
      { status: 500 },
    )
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
    // O19 freshness filter: snapshots older than SNAPSHOT_FRESHNESS_DAYS never enter the run
    // (a small WHERE — the downstream union of series-having + snapshot-having users is
    // unchanged in shape; stale-snapshot-only users simply drop out of it naturally).
    const snapshotFreshnessCutoff = new Date(
      Date.now() - SNAPSHOT_FRESHNESS_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString()
    baselines = await fetchAll<BaselineRow>((from, to) =>
      supabase
        .from("baseline_snapshots")
        .select(
          "user_id, metric_key, mean, std_dev, min, max, trend, confidence, data_sources, window_days",
        )
        .gte("computed_at", snapshotFreshnessCutoff)
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
        // O13: a human REJECT supersedes the verifier FOR SERVING — a rejected edge must never
        // be cited by a NEW card (already-served cards keep honest provenance via the O12 RPC).
        // Null-safe on purpose: no human action (null) = the verifier default stands.
        .or("human_verdict.is.null,human_verdict.neq.reject")
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
        ruleLoadIssues.push({ ruleId: rule.rule_id, reason: `lagDays ${lag} outside the C10 set {0,1,2,3,7}` })
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

  // A1 gap events (§A1 / biotope-nao-link §6): aggregated per (pair, status) across the run,
  // deduped per user — demand counts DEMANDING USERS per run, and the user id itself never
  // leaves this function (privacy invariant: aggregate counts only).
  const gapSeenUserKeys = new Set<string>()
  const gapByAggKey = new Map<string, GapEventRow>()
  const pushGap = (
    userId: string,
    metricA: string,
    metricB: string,
    status: GapStatus,
    extra?: { completeness?: number; lit_candidate?: Record<string, unknown> },
  ): void => {
    const [a, b] = metricA < metricB ? [metricA, metricB] : [metricB, metricA]
    const userKey = `${userId}:${a}|${b}:${status}`
    if (gapSeenUserKeys.has(userKey)) return
    gapSeenUserKeys.add(userKey)
    const aggKey = `${a}|${b}:${status}`
    const existing = gapByAggKey.get(aggKey)
    if (existing) existing.demand++
    else gapByAggKey.set(aggKey, { metric_a: a, metric_b: b, status, demand: 1, ...extra })
  }
  /** The §A1 lit_candidate snapshot for a pair's servable edges (best band when any exist). */
  const litCandidate = (pairEdges: ServableEdge[]): Record<string, unknown> => {
    if (pairEdges.length === 0) return { hasEdge: false }
    const best = pairEdges.reduce((x, y) => (y.edge_score > x.edge_score ? y : x))
    return { hasEdge: true, servingBand: best.serving_band }
  }
  const renderDrops: { userId: string; ruleId: string; reason: string }[] = []
  const brainScopeSkips: { userId: string; ruleId: string; pair: string }[] = []
  let firedPatternCount = 0
  let dismissedSkips = 0
  let snoozedSkips = 0
  let archivedSkips = 0
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
      // D17 / A18: a user-held card (dismissed, snoozed OR archived) is never re-upserted — the
      // upsert would rewrite `status: 'active'` over the user's choice. Held = held until the user
      // acts. Each held status is counted separately: folding `archived` into `snoozedSkipped`
      // would silently misreport saves as snoozes once the Archive tab started writing `archived`.
      const held = heldStatusByKey.get(key)
      if (held !== undefined) {
        if (held === "dismissed") dismissedSkips++
        else if (held === "archived") archivedSkips++
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

      // O18 (decision (a), Jayden 2026-07-24): ONLY `agree` renders the rule's card —
      // research-context and contradiction keep their composed row (pushInsight above) and
      // write an A1 gap event instead of surfacing (§S7 / composed_insights migration comment).
      if (!rendersCard(classified)) {
        const gapStatus = gapStatusFor(classified)
        if (gapStatus !== null) {
          pushGap(userId, keyA, keyB, gapStatus, {
            completeness: completeness.score,
            lit_candidate: litCandidate(pairEdges),
          })
        }
        continue
      }
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
      // O18: edge_refs may ONLY carry monotonic direction-consistent edges — the former
      // all-pairEdges fallback let correlates/modulates citations decorate a card (§1.3
      // monotonic-only invariant). For `agree` (the only branch that reaches here) at least
      // one such edge exists by construction.
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
        edge_refs: monotonicConsistent.map((e) => ({
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

        // agree with a SUBJECT-endpoint cardEdge → the cited edge card (producer 'edge',
        // rule_id = 'edge:'||edge_id). O16: `rendersCard` is false for an object-only signal
        // (cardEdge null) — the directional template would state that the SUBJECT moved when
        // only the object fired — and for research-context / contradiction (O18 gap-only);
        // all three route to the A1 gap event below instead of a card.
        if (rendersCard(classified) && classified.cardEdge !== null) {
          const cardEdge = classified.cardEdge
          const state = userStates[metricKey]
          // O16 binding invariant: the card states the metric that ACTUALLY fired. The composer
          // guarantees cardEdge.subject === the fired metric; verify anyway and drop loudly —
          // a wrong-metric card must never ship.
          if (cardEdge.subject !== metricKey) {
            renderDrops.push({
              userId,
              ruleId: edgeRuleId(cardEdge.edge_id),
              reason: `O16 orientation violation: cardEdge.subject "${cardEdge.subject}" is not the fired metric "${metricKey}"`,
            })
            console.error(
              `O16 orientation violation dropped: ${userId}:${edgeRuleId(cardEdge.edge_id)} ` +
                `cardEdge.subject "${cardEdge.subject}" != fired metric "${metricKey}"`,
            )
          } else {
            // R4-U4/O27 · artifact trust gate, evaluated BEFORE any copy is produced. A cited
            // card inherits its source's trust posture, so an edge that cannot prove where it
            // came from must not become a card at all. `trustFailures` is the shared, tested
            // rule (shared/brain/provenance.ts); this call site only supplies the environment.
            const edgeClaimKind = composeClaimKind(cardEdge)
            const edgeTrust = composeTrustPosture(cardEdge)
            const failures = trustFailures(
              {
                artifact:
                  edgeTrust.posture === null ||
                  edgeTrust.artifactRevision === null ||
                  edgeTrust.artifactContentHash === null
                    ? undefined
                    : {
                        revision: edgeTrust.artifactRevision,
                        contentHash: edgeTrust.artifactContentHash,
                        posture: edgeTrust.posture as "fixture" | "live",
                      },
                attestation:
                  edgeTrust.returnedModel === null ||
                  edgeTrust.modelFamily === null ||
                  edgeTrust.decorrelated === null ||
                  edgeTrust.attested === null
                    ? undefined
                    : {
                        returnedModel: edgeTrust.returnedModel,
                        returnedVersion: edgeTrust.returnedVersion,
                        family: edgeTrust.modelFamily,
                        decorrelated: edgeTrust.decorrelated,
                        attested: edgeTrust.attested,
                      },
              },
              SERVING_ENVIRONMENT,
            )
            if (failures.length > 0) {
              // BLOCK, never warn-and-serve (B-UI9 fail-closed).
              const reason =
                `artifact trust check failed for ${SERVING_ENVIRONMENT}: ` +
                failures.map((f) => f.code).join(",")
              renderDrops.push({ userId, ruleId: edgeRuleId(cardEdge.edge_id), reason })
              console.warn(
                `card blocked by artifact trust gate: ${userId}:${edgeRuleId(cardEdge.edge_id)}`,
                failures,
              )
            } else {
            // A21: the "matching pattern" clause ships only when a gate-passing personal signal
            // backs it (classified.personal is exactly that row, or null).
            const rendered = renderCard(
              edgeCardTemplate(classified.personal !== null),
              {
                // The stated "shifted" subject IS the fired metric (asserted equal to
                // cardEdge.subject above) — never the other endpoint (O16).
                metric_a_label: label(metricKey),
                metric_b_label: label(cardEdge.object),
                pattern_metric_label: label(metricKey),
                direction_phrase: directionPhrase(state ?? "up"),
                // B-SCI1: the phrase is now chosen by the EFFECTIVE claim kind, so a
                // correlational finding can no longer be stated as a causal one.
                relation_phrase: relationPhrase(cardEdge.relation, edgeClaimKind.effective),
                // B-UI9: the fixture disclosure sits at the FRONT of the body, before the claim.
                posture_disclosure: postureDisclosure(edgeTrust.posture),
              },
              // B-SCI1 defence in depth: the causal-verb gate runs over the final copy.
              { effectiveKind: edgeClaimKind.effective },
            )
            if (!rendered.ok) {
              renderDrops.push({
                userId,
                ruleId: edgeRuleId(cardEdge.edge_id),
                reason: JSON.stringify(rendered.failure),
              })
              console.warn(`card dropped at render: ${userId}:${edgeRuleId(cardEdge.edge_id)}`, rendered.failure)
            } else {
              pushCard({
                user_id: userId,
                rule_id: edgeRuleId(cardEdge.edge_id),
                generated_at: now,
                title: rendered.copy.title,
                body: rendered.copy.body,
                category: RELATIONSHIP_CATEGORY,
                severity: "info",
                contributing_metrics: contributing,
                confidence_score: round(cardEdge.edge_score, 3),
                confidence_sources: [...new Set([...snapshotSources(contributing), "brain"])].sort(),
                status: "active",
                expires_at: addDaysIso(now, COMPOSER_EXPIRY_DAYS),
                phase_generated: COMPOSER_PHASE,
                producer: "edge",
                insight_id: id,
                // R4-U4: the card's edge ref carries the scientific meaning and trust posture
                // forward, so the provenance surface reads them from the CARD rather than
                // re-deriving them (and cannot disagree with what was rendered).
                edge_refs: [
                  {
                    edgeId: cardEdge.edge_id,
                    verifiedAt: cardEdge.verified_at,
                    claimKind: edgeClaimKind,
                    trust: edgeTrust,
                    studyDesignTier: cardEdge.verification?.evidenceTier ?? null,
                  },
                ],
              })
            }
            }
          }
        } else {
          // No card → A1 gap event (O16 object-only agree / O18 research-context /
          // contradiction). Pair selection per case; completeness recomputed per pair.
          const gapStatus = gapStatusFor(classified)
          if (gapStatus === "personal-signal-no-edge" && topEdge !== null) {
            // O16 object-only: a servable edge exists, but not in an orientation that can
            // serve the fired signal.
            pushGap(userId, topEdge.subject, topEdge.object, gapStatus, {
              completeness: completeness.score,
              lit_candidate: { ...litCandidate([topEdge]), orientation: "object-only" },
            })
          } else if (gapStatus === "blocked-completeness") {
            // research-context: every distinct 1-hop pair that could not carry the direction.
            const seenPairs = new Set<string>()
            for (const e of oneHop) {
              const pk = pairKey(e.subject, e.object)
              if (seenPairs.has(pk)) continue
              seenPairs.add(pk)
              const pairCompleteness = completenessScore(
                [e.subject, e.object],
                daysPresent,
                COMPLETENESS_WINDOW_DAYS,
                dqsWeight,
              )
              pushGap(userId, e.subject, e.object, gapStatus, {
                completeness: pairCompleteness.score,
                lit_candidate: litCandidate(edgesByPair.get(pk) ?? [e]),
              })
            }
          } else if (gapStatus === "needs-review" && classified.personal !== null) {
            // contradiction: the pair whose gate-passing personal signal opposes the edge.
            pushGap(userId, classified.personal.metric_a, classified.personal.metric_b, gapStatus, {
              completeness: completeness.score,
              lit_candidate: litCandidate(
                edgesByPair.get(pairKey(classified.personal.metric_a, classified.personal.metric_b)) ?? [],
              ),
            })
          }
        }
      }

      // idiosyncratic sweep: gate-passing personal pairs involving this metric with NO servable
      // edge → the "still researching" card (uncited, edge_refs = [] by CHECK) + its insight
      // AND its A1 gap event (§S7: idiosyncratic does BOTH — card + 'personal-signal-no-edge').
      // A computed-but-NON-gate-passing personal pair with no edge is branch-5 gap fuel:
      // 'personal-null', no card, no insight.
      for (const [pk, row] of personal) {
        const [a, b] = pk.split("|")
        if (a !== metricKey && b !== metricKey) continue
        if (edgesByPair.has(pk)) continue
        if (!personalPassesGate(row, PAIR_GATES)) {
          pushGap(userId, a!, b!, "personal-null", {
            completeness: completenessScore([a!, b!], daysPresent, COMPLETENESS_WINDOW_DAYS, dqsWeight)
              .score,
            lit_candidate: { hasEdge: false },
          })
          continue
        }
        pushGap(userId, a!, b!, "personal-signal-no-edge", {
          completeness: completenessScore([a!, b!], daysPresent, COMPLETENESS_WINDOW_DAYS, dqsWeight)
            .score,
          lit_candidate: { hasEdge: false },
        })

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

  // A1 gap events (§S7 "emits gap events to A1" — same run, beside the composed rows; the
  // upsert-increment is atomic per event inside record_gap_events).
  const gapEvents = [...gapByAggKey.values()]
  if (gapEvents.length > 0) {
    const { error } = await supabase.rpc("record_gap_events", { events: gapEvents })
    if (error) {
      console.error("gap_ledger record_gap_events error", error)
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
  const gapStatusCounts: Record<string, number> = {}
  for (const g of gapEvents) {
    gapStatusCounts[g.status] = (gapStatusCounts[g.status] ?? 0) + g.demand
  }

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
        archivedSkipped: archivedSkips,
      },
      gapLedger: { pairsTouched: gapEvents.length, demandByStatus: gapStatusCounts },
      brainScopeSkips,
    }),
    { headers: { "Content-Type": "application/json" } },
  )
})

/** ISO datetime `days` days after `fromIso`. */
function addDaysIso(fromIso: string, days: number): string {
  return new Date(new Date(fromIso).getTime() + days * 24 * 60 * 60 * 1000).toISOString()
}
