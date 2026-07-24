// supabase/functions/generate-insights/composer.ts
//
// S7 · composed-insight composer + completeness scorer (docs/shared/insight-engine-architecture.md
// §S7), pure: (fired pattern) x (1-hop servable D1 edges) x (D2 personal signal) -> branch-
// classified ComposedInsight with attached stats/provenance and a deterministic completeness
// score. No IO — the index.ts shell supplies table rows; node guard tests import this directly
// via tsx (Deno-free by construction, the evaluate-signals stats.ts pattern).
//
// HARD INVARIANT (architecture §1.3): edge joins are 1-hop, MONOTONIC-ONLY — only
// `increases`/`decreases` relations may set a card's direction; `modulates`/`correlates` edges
// attach as context-only citations, never a directional claim.
//
// Branch truth table AS IMPLEMENTED (the doc's four rules, made disjoint + exhaustive — the doc
// leaves `agree`(personal-null) vs `research-context`(no personal) overlapping; resolution
// recorded in the U12 session log). Evaluated per pattern over its servable 1-hop edges, first
// match wins:
//   1. any servable edge whose gate-passing personal signal has the OPPOSITE sign -> contradiction
//   2. any MONOTONIC direction-consistent edge (its personal signal absent, non-gate-passing, or
//      sign-consistent)                                                           -> agree
//   3. any servable edge at all (context-only relations, or direction-inconsistent
//      without a personal contradiction)                                          -> research-context
//   4. no servable edge, but a gate-passing personal signal on the pair           -> idiosyncratic
//   5. neither                                                                    -> no insight (gap fuel)
// A personal signal "passes the gate" iff q_value <= qMax AND n_eff >= nEffMin AND stable
// (§S5 / config C4 — gates supplied by the caller from evaluate-signals' PAIR_GATES).
//
// O16 ORIENTATION INVARIANT (backlog, verdict B2): a directional card may only be driven by a
// SUBJECT-endpoint signal — `cardEdge` is null when a single-metric pattern's fired metric sits
// only on OBJECT endpoints, and `rendersCard` is the single surfacing policy (O18: only `agree`
// with a cardEdge, plus `idiosyncratic`, ever render; research-context/contradiction are
// gap-only).

// ─── Inputs ────────────────────────────────────────────────────────────────────────────────

/** A verified_edges view row (§S6) — the parts the composer reads. */
export interface ServableEdge {
  edge_id: string
  subject: string
  object: string
  relation: string
  verified_at: string
  edge_score: number
  serving_band: string
  /** RelationshipClaim jsonb — citations surfaced onto the insight payload. */
  claim: { citations?: { paperId: string }[] } | null
}

/** A personal_signals row (§S5) — the D2 check. */
export interface PersonalSignalRow {
  metric_a: string
  metric_b: string
  rho: number
  n_eff: number
  q_value: number
  stable: boolean
}

export interface PersonalGates {
  qMax: number
  nEffMin: number
}

/** The candidate the composer classifies — an S4 FiredPattern or a fired coincidence rule. */
export interface CandidatePattern {
  /** Stable identity inside insightId, e.g. "signal:hrv_sdnn_ms:up" | "rule:<ruleId>". */
  patternKey: string
  kind: "signal" | "trend" | "threshold" | "coincidence"
  /** Every metric the pattern reads (1 = single-metric signal, 2 = pair). */
  metricKeys: string[]
  /** Observed direction per metric where one exists (signal states, trend leaves). */
  states: Record<string, "up" | "down">
  /** Pattern stats carried verbatim onto the payload (zScore / trend / windowDays / ...). */
  stats: Record<string, unknown>
}

// ─── Monotonicity + direction ──────────────────────────────────────────────────────────────

/** The only relations allowed to set a direction (§1.3). */
export const MONOTONIC_RELATIONS: ReadonlySet<string> = new Set(["increases", "decreases"])

/** +1 / −1 for monotonic relations; null for context-only ones. */
export function relationSign(relation: string): 1 | -1 | null {
  if (relation === "increases") return 1
  if (relation === "decreases") return -1
  return null
}

/**
 * Direction consistency of one monotonic edge against the observed states (§S7 payload field:
 * sign(edge.relation) vs pattern.state). When BOTH endpoints have an observed state the edge is
 * consistent iff the observed co-movement matches the relation sign (increases -> same
 * direction, decreases -> opposite). When only one endpoint has a state, no contradiction is
 * observable — the edge counts as consistent (judgment call, recorded in the session log).
 * Context-only relations are never "consistent" for direction purposes (they cannot set one).
 */
export function edgeDirectionConsistent(
  edge: ServableEdge,
  states: Record<string, "up" | "down">,
): "consistent" | "inconsistent" | null {
  const sign = relationSign(edge.relation)
  if (sign === null) return null
  const subjectState = states[edge.subject]
  const objectState = states[edge.object]
  if (subjectState === undefined || objectState === undefined) return "consistent"
  const sameDirection = subjectState === objectState
  return (sign === 1) === sameDirection ? "consistent" : "inconsistent"
}

/** Lexicographic pair key — personal_signals stores metric_a < metric_b. */
export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

export function personalPassesGate(row: PersonalSignalRow | null, gates: PersonalGates): boolean {
  if (row === null) return false
  return row.stable && row.q_value <= gates.qMax && row.n_eff >= gates.nEffMin
}

/**
 * Does a gate-passing personal signal CONTRADICT a monotonic edge? rho's sign is symmetric in
 * the pair, so rho > 0 agrees with `increases` and rho < 0 with `decreases`.
 */
function personalOpposesEdge(row: PersonalSignalRow, edge: ServableEdge): boolean {
  const sign = relationSign(edge.relation)
  if (sign === null || row.rho === 0) return false
  return (row.rho > 0 ? 1 : -1) !== sign
}

// ─── U1 applicability stub ─────────────────────────────────────────────────────────────────

export interface ApplicabilityGrade {
  paperId: string
  score: number | "unknown"
  rationale: string | null
}

/**
 * U1 applicability transferability grader — TYPED SEAM ONLY this session. The real grader
 * (Claude Sonnet 5, rubric-anchored, cached to applicability_grades) lands later; until then
 * every citation grades 'unknown', rendered honestly (§U1 cold-start posture: show, no gating).
 */
export function gradeApplicability(paperId: string): ApplicabilityGrade {
  return { paperId, score: "unknown", rationale: null }
}

// ─── Composition ───────────────────────────────────────────────────────────────────────────

export type Branch = "agree" | "research-context" | "idiosyncratic" | "contradiction"

export interface ComposedEdgeRef {
  edgeId: string
  verifiedAt: string
  servingBand: string
  edgeScore: number
  relation: string
  monotonic: boolean
  direction: "consistent" | "inconsistent" | null
  citations: { paperId: string }[]
  applicability: ApplicabilityGrade[]
}

export interface Completeness {
  score: number
  daysPresent: number
  windowDays: number
  perMetric: Record<string, number>
}

export interface ComposedInsight {
  patternKey: string
  pattern: CandidatePattern
  edges: ComposedEdgeRef[]
  personal: { rho: number; nEff: number; qValue: number; stable: boolean } | null
  branch: Branch
  completeness: Completeness
}

function toEdgeRef(edge: ServableEdge, states: Record<string, "up" | "down">): ComposedEdgeRef {
  const citations = edge.claim?.citations ?? []
  return {
    edgeId: edge.edge_id,
    verifiedAt: edge.verified_at,
    servingBand: edge.serving_band,
    edgeScore: edge.edge_score,
    relation: edge.relation,
    monotonic: MONOTONIC_RELATIONS.has(edge.relation),
    direction: edgeDirectionConsistent(edge, states),
    citations: citations.map((c) => ({ paperId: c.paperId })),
    applicability: citations.map((c) => gradeApplicability(c.paperId)),
  }
}

export interface ClassifiedPattern {
  branch: Branch
  edges: ComposedEdgeRef[]
  /** The personal row backing the branch decision (opposing row for contradiction, the pair's
   *  row otherwise), when one exists. */
  personal: PersonalSignalRow | null
  /** For agree: the best monotonic direction-consistent edge — SUBJECT-endpoint edges first
   *  (O16), then by edge_score. */
  topEdge: ServableEdge | null
  /**
   * O16 · The edge allowed to drive a DIRECTIONAL card, or null. For a single-metric (fired
   * signal) pattern this is the best consistent edge whose SUBJECT is the fired metric — an
   * edge where the fired metric is only the OBJECT endpoint yields cardEdge = null, because
   * the directional template states that the subject moved and the subject did not fire
   * (backlog O16: a card never states the non-fired endpoint as having moved). For pair
   * patterns (both endpoints observed by construction) cardEdge === topEdge. Non-agree
   * branches always carry null.
   */
  cardEdge: ServableEdge | null
}

/**
 * The branch classifier (truth table in the header). `edges` are the servable 1-hop edges the
 * caller joined for this pattern; `personalFor(pair)` looks up the user's personal_signals row.
 */
export function classifyPattern(
  pattern: CandidatePattern,
  edges: ServableEdge[],
  personalFor: (pairKey: string) => PersonalSignalRow | null,
  gates: PersonalGates,
): ClassifiedPattern | null {
  const refs = edges.map((e) => toEdgeRef(e, pattern.states))

  // 1. contradiction: any servable monotonic edge opposed by a gate-passing personal signal.
  for (const edge of edges) {
    const personal = personalFor(pairKey(edge.subject, edge.object))
    if (personal !== null && personalPassesGate(personal, gates) && personalOpposesEdge(personal, edge)) {
      return { branch: "contradiction", edges: refs, personal, topEdge: null, cardEdge: null }
    }
  }

  // 2. agree: a monotonic direction-consistent edge (personal absent / non-gating / consistent —
  //    opposition was excluded above). Triangulation (agree-with-personal outranking
  //    agree-without) is an S9 rank modulator, not a branch change.
  //    O16 orientation: for a single-metric (fired signal) pattern, only an edge whose SUBJECT
  //    is the fired metric may drive the directional card — subject-endpoint edges are
  //    preferred as topEdge, and cardEdge is null when the fired metric sits only on OBJECT
  //    endpoints (the handler then routes to gap handling: composed row + gap event, no card).
  const consistent = edges
    .filter(
      (e) =>
        MONOTONIC_RELATIONS.has(e.relation) &&
        edgeDirectionConsistent(e, pattern.states) === "consistent",
    )
    .sort((a, b) => b.edge_score - a.edge_score)
  if (consistent.length > 0) {
    const firedMetric = pattern.metricKeys.length === 1 ? pattern.metricKeys[0]! : null
    const subjectDriven =
      firedMetric === null ? consistent : consistent.filter((e) => e.subject === firedMetric)
    const top = subjectDriven[0] ?? consistent[0]!
    const personal = personalFor(pairKey(top.subject, top.object))
    return {
      branch: "agree",
      edges: refs,
      personal: personal !== null && personalPassesGate(personal, gates) ? personal : null,
      topEdge: top,
      cardEdge: subjectDriven[0] ?? null,
    }
  }

  // 3. research-context: edges exist but none can carry the direction (context-only relations,
  //    or inconsistent direction without a personal contradiction).
  if (edges.length > 0) {
    return { branch: "research-context", edges: refs, personal: null, topEdge: null, cardEdge: null }
  }

  // 4. idiosyncratic: no edge, but the user's own data holds (pair patterns only — a
  //    single-metric pattern's idiosyncratic pairs are enumerated by the caller).
  if (pattern.metricKeys.length === 2) {
    const personal = personalFor(pairKey(pattern.metricKeys[0]!, pattern.metricKeys[1]!))
    if (personal !== null && personalPassesGate(personal, gates)) {
      return { branch: "idiosyncratic", edges: [], personal, topEdge: null, cardEdge: null }
    }
  }

  // 5. nothing to say — the pattern is gap fuel (the handler writes the A1 gap event).
  return null
}

// ─── Surfacing policy + A1 gap-status mapping (O16 + O18) ───────────────────────────────────

/**
 * O18 (Jayden 2026-07-24, decision (a): gap-only) + O16 — the ONE place that says which
 * classified patterns may render a user card:
 *   - `agree` renders the cited edge card ONLY with a subject-endpoint cardEdge (O16);
 *   - `idiosyncratic` renders the uncited "still researching" card (architecture §S7);
 *   - `research-context` and `contradiction` NEVER render — composed row + gap event only
 *     (architecture §S7 / the composed_insights migration comment; verdict H1).
 */
export function rendersCard(classified: ClassifiedPattern): boolean {
  if (classified.branch === "agree") return classified.cardEdge !== null
  return classified.branch === "idiosyncratic"
}

/** The gap_ledger status values the serve path writes (subset of the architecture §A1 enum). */
export type GapStatus =
  | "personal-signal-no-edge"
  | "blocked-completeness"
  | "needs-review"
  | "personal-null"

/**
 * Architecture §A1 status for a classified pattern's gap event, or null when no gap is written
 * (a served card is not a gap). The mapping is the architecture §S7 text, verbatim:
 *   - `research-context` → completeness-gated → 'blocked-completeness';
 *   - `contradiction` → 'needs-review';
 *   - `idiosyncratic` → 'personal-signal-no-edge' (card AND gap event — §S7 does both);
 *   - `agree` with cardEdge null (O16 object-only signal) → 'personal-signal-no-edge': the
 *     fired signal has no servable edge in the orientation that could serve it.
 * The fifth serve-path status, 'personal-null' (pair with a computed-but-non-gate-passing
 * personal signal and no edge — branch 5), is written by the handler's idiosyncratic sweep,
 * which never constructs a ClassifiedPattern.
 */
export function gapStatusFor(classified: ClassifiedPattern): GapStatus | null {
  switch (classified.branch) {
    case "agree":
      return classified.cardEdge === null ? "personal-signal-no-edge" : null
    case "research-context":
      return "blocked-completeness"
    case "contradiction":
      return "needs-review"
    case "idiosyncratic":
      return "personal-signal-no-edge"
  }
}

// ─── Completeness scorer (§S7.2) ───────────────────────────────────────────────────────────

/**
 * score = Σ_m w_m · daysPresent(m, window)/windowDays over the pattern's contributing metrics,
 * weights w_m = registry dqs.weight, normalised across the contributing metrics. Computed from
 * S2 raw day-counts (supplied by the caller), reproducible. When every contributing metric has
 * dqs.weight 0 (wearables carry 0 — they never gate daily completeness), the score falls back
 * to EQUAL weights so a wearable-only pattern is not scored 0/undefined (judgment call,
 * recorded in the session log). Weights are provisional pending calibration (§11).
 */
export function completenessScore(
  metricKeys: readonly string[],
  daysPresentByMetric: ReadonlyMap<string, number>,
  windowDays: number,
  weightOf: (metricKey: string) => number,
): Completeness {
  const perMetric: Record<string, number> = {}
  let weightSum = 0
  for (const key of metricKeys) weightSum += weightOf(key)
  let score = 0
  let minDays = Infinity
  for (const key of metricKeys) {
    const days = Math.min(daysPresentByMetric.get(key) ?? 0, windowDays)
    perMetric[key] = days
    minDays = Math.min(minDays, days)
    const weight = weightSum > 0 ? weightOf(key) / weightSum : 1 / metricKeys.length
    score += weight * (days / windowDays)
  }
  return {
    score: Math.round(score * 1000) / 1000,
    daysPresent: Number.isFinite(minDays) ? minDays : 0,
    windowDays,
    perMetric,
  }
}

// ─── Deterministic insight identity (§S7 output shape) ─────────────────────────────────────

/**
 * insightId = sha-256(userId, patternKey, edgeId|'none', periodStart) — the §S7 identity that
 * makes re-runs idempotent inserts. Uses WebCrypto (present in both Deno and Node ≥ 20).
 */
export async function insightId(
  userId: string,
  patternKey: string,
  edgeId: string | null,
  periodStart: string,
): Promise<string> {
  const input = `${userId} ${patternKey} ${edgeId ?? "none"} ${periodStart}`
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("")
}
