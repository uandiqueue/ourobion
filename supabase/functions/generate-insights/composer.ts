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
// attach as context-only citations, never a directional claim. THIS INVARIANT IS UNCHANGED by the
// co-movement path added below: that path renders a card with NO direction at all, and
// `MONOTONIC_RELATIONS` / `relationSign()` are untouched — a correlational relation still has no
// sign and can still never be verbalised directionally.
//
// Branch truth table AS IMPLEMENTED (the doc's four rules, made disjoint + exhaustive — the doc
// leaves `agree`(personal-null) vs `research-context`(no personal) overlapping; resolution
// recorded in the U12 session log). Evaluated per pattern over its servable 1-hop edges, first
// match wins:
//   1. any servable edge whose gate-passing personal signal has the OPPOSITE sign -> contradiction
//   2. any MONOTONIC direction-consistent edge (its personal signal absent, non-gate-passing, or
//      sign-consistent)                                                           -> agree
//  2b. NO monotonic edge can carry the direction, but a CO-MOVEMENT edge (a sign-free
//      `correlates` relation) spans exactly the pattern's observed pair and both endpoints were
//      observed moving the SAME way                                               -> agree,
//      with `cardEdge` null and `coMovementEdge` set (a DIRECTIONLESS card — see below)
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
// with a cardEdge or a coMovementEdge, plus `idiosyncratic`, ever render;
// research-context/contradiction are gap-only).
//
// ─── THE CO-MOVEMENT PATH (branch rule 2b) ────────────────────────────────────────────
//
// WHY IT EXISTS: 13 of 14 verified edges carry `relation: 'correlates'`, which is the DOMINANT
// output of synthesis. Rule 2 can never match them (they are not monotonic and have no sign), so
// every correlational edge fell to rule 3 (`research-context`, deliberately gap-only) and NO
// `producer='edge'` card was reachable at all. That made the entire cited-card surface dead for
// the common case.
//
// WHAT IT IS ALLOWED TO SAY: co-movement, and nothing else. "These two moved together, and
// research reports they move together." It may never state which one moved which way, nor which
// one acted on the other.
//
// WHAT IT DELIBERATELY DOES NOT DO — the three things that would make it a causality leak:
//   * it does NOT widen MONOTONIC_RELATIONS. That set still holds exactly increases/decreases;
//   * it does NOT map `correlates` onto `increases`/`decreases`. `relationSign('correlates')`
//     still returns null, and `edgeDirectionConsistent` still returns null for it, so the edge
//     ref this path attaches carries `direction: null` and `monotonic: false` — a downstream
//     reader cannot mistake it for a directional edge;
//   * it does NOT set `cardEdge`. `cardEdge` is the DIRECTIONAL-card seam (the render path calls
//     `relationPhrase(cardEdge.relation, …)`, which THROWS for a non-monotonic relation). Keeping
//     `cardEdge` null means the directional template is structurally unreachable from here; the
//     co-movement edge travels in its own field to its own template.
//
// PRECONDITIONS (all required, `coMovementEdgeFor` below): the pattern is a `coincidence` pattern
// over exactly two metrics (so BOTH endpoints are observed by construction — O16 is satisfied
// because neither endpoint is a non-fired one); the edge spans exactly that pair; the relation is
// sign-free; and both endpoints were observed moving the SAME way, so "moved together" is a
// literal description of what happened rather than a paraphrase of the research.

import {
  effectiveClaimKind,
  parseClaimKind,
  trustFailures,
  type ServingEnvironment,
  type TrustFailure,
  type TrustInputs,
} from "../../../shared/brain/trust_labels.ts"

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
  /** #300 §E — verifier-authored qualification, already copy-gated at artifact load. */
  caveat?: string | null
  /**
   * RelationshipClaim jsonb — citations surfaced onto the insight payload, and (R4-U4/B-SCI1)
   * the synthesised `claimKind`. The claim kind was previously NOT read here at all: the row
   * carried it, this type narrowed it away, and the card was rendered with directional wording
   * regardless of what the research actually claimed. That drop is the defect B-SCI1 records.
   */
  claim: {
    citations?: { paperId: string }[]
    claimKind?: string
    quoteSpans?: { paperId: string }[]
    artifact?: { revision: string; contentHash: string; posture: string }
  } | null
  /**
   * EdgeVerification jsonb — R4-U4 reads the verifier's INDEPENDENTLY judged supported claim kind
   * plus the returned-model attestation. `verification` is already selected by the view; only the
   * TypeScript view of it is widened here.
   */
  verification?: {
    claimKindCheck?: { matchesClaim?: boolean; supportedKind?: string }
    evidenceTier?: number
    artifact?: { revision: string; contentHash: string; posture: string }
    attestation?: {
      returnedModel: string
      returnedVersion: string | null
      family: string
      decorrelated: boolean
      attested: boolean
    }
  } | null

  // ── R4-U4/O27 · the verified_edges view's FLAT artifact/attestation columns ────────────────
  //
  // These are the columns the U4 migration added and the A11 edge-loader now populates. They are
  // the PREFERRED source over the jsonb above: they are what the database actually constrains
  // (`artifact_posture in ('fixture','live')`, `content_hash ~ '^sha256:[0-9a-f]{64}$'`), and
  // reading them is what makes the loader's population observable at serving time at all — the
  // fetch previously selected neither them nor `verification`, so the gate saw a null posture for
  // EVERY database-loaded edge and no cited card could ever be produced.
  //
  // All optional + nullable: a pre-U4 row has them null, which means UNTRUSTED, never "fine".
  claim_artifact_revision?: string | null
  claim_artifact_content_hash?: string | null
  claim_artifact_posture?: string | null
  verification_artifact_revision?: string | null
  verification_artifact_content_hash?: string | null
  verification_artifact_posture?: string | null
  attestation_returned_model?: string | null
  attestation_returned_version?: string | null
  attestation_family?: string | null
  attestation_decorrelated?: boolean | null
  attestation_attested?: boolean | null
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

/** The only relations allowed to set a direction (§1.3). NEVER widen this set. */
export const MONOTONIC_RELATIONS: ReadonlySet<string> = new Set(["increases", "decreases"])

/**
 * Relations that assert CO-MOVEMENT WITHOUT A DIRECTION — the two variables vary together
 * and the research states nothing about which way, or which one acts on the other.
 *
 * Only `correlates` qualifies. The other context-only relations are excluded on purpose:
 *   * `modulates` is ASYMMETRIC (the subject conditions the object), so "moved together" would be
 *     a mistranslation of it, not a weaker reading of it;
 *   * `confounds` describes a third-variable artefact, i.e. a reason NOT to show a pairing;
 *   * `no_effect` asserts the absence of a relationship — a card would invert it.
 *
 * This set is DISJOINT from MONOTONIC_RELATIONS by construction (asserted by the unit vectors):
 * no relation may be both a direction carrier and a co-movement carrier.
 */
export const CO_MOVEMENT_RELATIONS: ReadonlySet<string> = new Set(["correlates"])

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

// ─── Co-movement edge selection (branch rule 2b) ─────────────────────────────────────

/**
 * True when this edge may back a DIRECTIONLESS co-movement card for this pattern. Every clause is
 * load-bearing; see the file header for why. In order:
 *
 *  1. the pattern is a fired `coincidence` pattern over exactly two metrics. A single-metric
 *     signal pattern is excluded: only one endpoint fired, so "these two moved together" would
 *     state movement the data never observed (that is O16, and it applies to co-movement wording
 *     just as it applies to directional wording);
 *  2. the edge spans EXACTLY the pattern's pair. A 1-hop edge that merely touches one of the two
 *     metrics describes a different pairing than the one that fired;
 *  3. the relation is a CO-MOVEMENT relation and is NOT monotonic. The second half is redundant
 *     with the first while the two sets stay disjoint, and it is written anyway so that widening
 *     either set can never silently route a direction carrier through the directionless path;
 *  4. the relation has NO SIGN. A third, independent statement of the same rule, phrased against
 *     `relationSign` — the function the directional path actually uses — so this predicate cannot
 *     drift from it;
 *  5. both endpoints were observed, moving the SAME way. This is what makes "moved together" a
 *     literal report of the user's own two series. Opposite movements are NOT co-movement, and
 *     they get no card here: a `correlates` relation carries no sign, so nothing in the research
 *     licenses calling an up/down pairing a match.
 */
function isCoMovementEdgeFor(pattern: CandidatePattern, edge: ServableEdge): boolean {
  if (pattern.kind !== "coincidence" || pattern.metricKeys.length !== 2) return false
  if (pairKey(edge.subject, edge.object) !== pairKey(pattern.metricKeys[0]!, pattern.metricKeys[1]!)) {
    return false
  }
  if (!CO_MOVEMENT_RELATIONS.has(edge.relation) || MONOTONIC_RELATIONS.has(edge.relation)) return false
  if (relationSign(edge.relation) !== null) return false
  const subjectState = pattern.states[edge.subject]
  const objectState = pattern.states[edge.object]
  if (subjectState === undefined || objectState === undefined) return false
  return subjectState === objectState
}

/**
 * The best co-movement edge for this pattern (highest edge_score), or null when none qualifies.
 * Ordering is by `edge_score` alone — there is no orientation preference to express, because the
 * card names both metrics symmetrically and asserts nothing about either one's role.
 */
export function coMovementEdgeFor(
  pattern: CandidatePattern,
  edges: readonly ServableEdge[],
): ServableEdge | null {
  const candidates = edges
    .filter((e) => isCoMovementEdgeFor(pattern, e))
    .sort((a, b) => b.edge_score - a.edge_score)
  return candidates[0] ?? null
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

/**
 * R4-U4/B-SCI1 · The scientific meaning that must survive to the card, carried per edge.
 * `claimed` is what synthesis proposed, `supported` is what the verifier independently judged,
 * and `effective` — the weaker of the two — is the ONLY kind rendering may state. All three are
 * retained (never collapsed) so provenance can show that synthesis overstated and the verifier
 * caught it. `null` members mean the row could not establish a kind, which fails closed at
 * render: no directional wording is emitted at all.
 */
export interface ComposedClaimKind {
  claimed: string | null
  supported: string | null
  effective: string | null
  downgraded: boolean
}

/** R4-U4/B-UI9 · Where an edge's underlying artifact came from, carried per edge to the card. */
export interface ComposedTrustPosture {
  /** 'fixture' | 'live', or null when the artifact did not state one (untrusted). */
  posture: string | null
  artifactRevision: string | null
  artifactContentHash: string | null
  /** Provider-RETURNED model identity, not the configured id (B-BR1). */
  returnedModel: string | null
  returnedVersion: string | null
  modelFamily: string | null
  /** null when unknown — never defaulted to true. */
  decorrelated: boolean | null
  attested: boolean | null
}

export interface ComposedEdgeRef {
  edgeId: string
  verifiedAt: string
  /** Verifier-authored qualification carried unchanged to card provenance. */
  caveat: string | null
  servingBand: string
  edgeScore: number
  relation: string
  monotonic: boolean
  direction: "consistent" | "inconsistent" | null
  citations: { paperId: string }[]
  applicability: ApplicabilityGrade[]
  /** R4-U4/B-SCI1 — source + verifier-supported claim kind, and the effective (weaker) one. */
  claimKind: ComposedClaimKind
  /** R4-U4/B-UI9 — fixture-vs-live posture, artifact identity, and returned-model attestation. */
  trust: ComposedTrustPosture
  /** R4-U4 — study-design tier (renamed from "evidence tier", B-SCI2); null when unstated. */
  studyDesignTier: number | null
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

/**
 * R4-U4/B-SCI1 · Resolve the claim kind for one edge row.
 *
 * The verifier's `supportedKind` CAPS the synthesised kind — `effectiveClaimKind` takes the
 * weaker of the two. When either side is missing or unrecognised the effective kind is `null`,
 * which fails closed downstream: the render path refuses to emit a directional phrase rather
 * than assuming a safe default. (Assuming "correlational" would be the *safe-sounding* default,
 * but it would silently fabricate a scientific judgment nobody made.)
 */
export function composeClaimKind(edge: ServableEdge): ComposedClaimKind {
  const claimed = parseClaimKind(edge.claim?.claimKind)
  const supported = parseClaimKind(edge.verification?.claimKindCheck?.supportedKind)
  if (claimed === null || supported === null) {
    return { claimed, supported, effective: null, downgraded: false }
  }
  const effective = effectiveClaimKind(claimed, supported)
  return { claimed, supported, effective, downgraded: effective !== claimed }
}

/**
 * R4-U4 follow-on (B-BR1) · Model strings that are PROVENANCE STAMPS, not provider-returned
 * identities: the brain-ingest CLI's configured-node echo (`config:…`, formerly the opaque
 * `router:verifier-node`), the unset default, MOCK proofs, INTERIM single-paper stamps,
 * hand-authored fixtures, and the llm-router TEST-MODE label
 * ("scaffolded + unit-tested (TEST-MODE: single-provider, decorrelation OFF)").
 *
 * WHY THE SERVING PATH CHECKS THIS AT ALL, given the producer already refuses to mark them
 * attested: this is the last gate before a user-facing card, and `attestation_attested` is a
 * plain boolean column in a database that also accepts hand-inserted and imported rows. A row
 * asserting `attested = true` next to a returned model of "MOCK" is self-contradictory; the
 * conservative reading of a self-contradictory trust claim is "not attested".
 *
 * DUPLICATION IS DELIBERATE: this is a Deno edge function and may not import from `tools/`.
 * tools/brain-ingest/src/verify/attest.ts holds the producer-side twin, and a guard test
 * (tools/rules/tests/edge_trust_gate.test.ts) pins the two lists' behaviour against the real
 * TEST_MODE_LABEL so they cannot drift apart silently.
 */
export const NON_PROVIDER_MODEL_MARKERS: readonly RegExp[] = [
  /^config:/i,
  /^router:/i,
  /^unset-/i,
  /^mock\b/i,
  /^interim:/i,
  /^fixture:/i,
  /TEST-MODE/i,
]

/** True when a recorded model string is one of the provenance stamps above. */
export function isNonProviderModelString(model: string | null): boolean {
  if (model === null) return false
  return NON_PROVIDER_MODEL_MARKERS.some((re) => re.test(model.trim()))
}

/**
 * An ArtifactRef assembled ATOMICALLY from one source — all three members, or nothing.
 * Mixing (a revision from the flat column with a hash from the jsonb) could describe an
 * artifact that never existed, so a partial group yields null rather than a hybrid.
 */
function artifactFrom(
  revision: string | null | undefined,
  contentHash: string | null | undefined,
  posture: string | null | undefined,
): { revision: string; contentHash: string; posture: string } | null {
  if (
    revision === null || revision === undefined ||
    contentHash === null || contentHash === undefined ||
    posture === null || posture === undefined
  ) {
    return null
  }
  return { revision, contentHash, posture }
}

/**
 * R4-U4/B-UI9 · Lift the artifact posture and returned-model attestation onto the edge ref.
 *
 * SOURCE ORDER, per record: the flat U4 view columns first (what the loader wrote and the DB
 * constrains), then the record's own jsonb (the truth-tier artifact copy — correct for rows
 * loaded before the loader populated the columns). Within each, the VERIFICATION's artifact
 * outranks the CLAIM's, as before: it is the newer record.
 *
 * Nothing is defaulted, inferred, or filled in from a sibling field. An absent value stays
 * null so the gate below can see exactly what is missing.
 */
export function composeTrustPosture(edge: ServableEdge): ComposedTrustPosture {
  const artifact =
    artifactFrom(
      edge.verification_artifact_revision,
      edge.verification_artifact_content_hash,
      edge.verification_artifact_posture,
    ) ??
    artifactFrom(
      edge.claim_artifact_revision,
      edge.claim_artifact_content_hash,
      edge.claim_artifact_posture,
    ) ??
    edge.verification?.artifact ??
    edge.claim?.artifact ??
    null

  // The attestation column group is likewise taken whole-or-not-at-all: `attestation_attested`
  // alone says nothing without the identity it is asserting about.
  const columnAttestation =
    edge.attestation_returned_model !== null && edge.attestation_returned_model !== undefined
      ? {
        returnedModel: edge.attestation_returned_model,
        returnedVersion: edge.attestation_returned_version ?? null,
        family: edge.attestation_family ?? null,
        decorrelated: edge.attestation_decorrelated ?? null,
        attested: edge.attestation_attested ?? null,
      }
      : null
  const jsonbAttestation = edge.verification?.attestation ?? null
  const attestation = columnAttestation ?? jsonbAttestation

  return {
    posture: artifact?.posture ?? null,
    artifactRevision: artifact?.revision ?? null,
    artifactContentHash: artifact?.contentHash ?? null,
    returnedModel: attestation?.returnedModel ?? null,
    returnedVersion: attestation?.returnedVersion ?? null,
    modelFamily: attestation?.family ?? null,
    decorrelated: attestation?.decorrelated ?? null,
    // Recorded verbatim — the card carries the honest stored value. The SENTINEL correction
    // is applied in the gate below, not here, so provenance keeps showing what the row said.
    attested: attestation?.attested ?? null,
  }
}

/**
 * R4-U4/O27 · Map a composed trust posture onto the shared `TrustInputs` the serving gate
 * evaluates. THE FAIL-CLOSED TRANSLATION LIVES HERE:
 *
 *  - a partial artifact group (any of revision / hash / posture missing) becomes `undefined`,
 *    i.e. "no artifact ref" — never a half-populated one the gate might partly accept;
 *  - a partial attestation group likewise becomes `undefined` — 'missing-attestation';
 *  - `attested` is ANDed with "the returned model is not one of our own provenance stamps",
 *    so a sentinel string can never satisfy the attestation requirement even if some row
 *    claims it was attested. `decorrelated` falls to false when unknown; it is never assumed.
 *
 * Absence is treated as absence of trust at every branch. There is no path through this
 * function that turns missing information into a passing input.
 */
export function trustInputsFor(trust: ComposedTrustPosture): TrustInputs {
  const inputs: TrustInputs = {}

  if (
    trust.posture !== null &&
    trust.artifactRevision !== null &&
    trust.artifactContentHash !== null
  ) {
    inputs.artifact = {
      revision: trust.artifactRevision,
      contentHash: trust.artifactContentHash,
      posture: trust.posture,
    }
  }

  if (trust.returnedModel !== null && trust.modelFamily !== null) {
    inputs.attestation = {
      returnedModel: trust.returnedModel,
      returnedVersion: trust.returnedVersion,
      family: trust.modelFamily,
      decorrelated: trust.decorrelated === true,
      attested: trust.attested === true && !isNonProviderModelString(trust.returnedModel),
    }
  }

  return inputs
}

/**
 * R4-U4/O27 · Every reason this edge may not become a cited card in `environment`, or an empty
 * array when it is clean. The ONE place the serving trust decision is made, so index.ts cannot
 * drift from what the tests exercise. Empty ⇒ servable; non-empty ⇒ the card is NOT produced.
 */
export function edgeTrustFailures(
  edge: ServableEdge,
  environment: ServingEnvironment,
): TrustFailure[] {
  return trustFailures(trustInputsFor(composeTrustPosture(edge)), environment)
}

function toEdgeRef(edge: ServableEdge, states: Record<string, "up" | "down">): ComposedEdgeRef {
  const citations = edge.claim?.citations ?? []
  return {
    edgeId: edge.edge_id,
    verifiedAt: edge.verified_at,
    caveat: edge.caveat ?? null,
    servingBand: edge.serving_band,
    edgeScore: edge.edge_score,
    relation: edge.relation,
    monotonic: MONOTONIC_RELATIONS.has(edge.relation),
    direction: edgeDirectionConsistent(edge, states),
    citations: citations.map((c) => ({ paperId: c.paperId })),
    applicability: citations.map((c) => gradeApplicability(c.paperId)),
    claimKind: composeClaimKind(edge),
    trust: composeTrustPosture(edge),
    studyDesignTier: edge.verification?.evidenceTier ?? null,
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
   *
   * A co-movement (`correlates`) edge NEVER appears here. It has no direction to drive, and
   * the render path that consumes `cardEdge` throws on a non-monotonic relation by design.
   */
  cardEdge: ServableEdge | null
  /**
   * The edge allowed to drive a DIRECTIONLESS CO-MOVEMENT card, or null. Set only by
   * branch rule 2b, and only when NO monotonic edge could carry a direction (rule 2 returns
   * first), so this never changes the outcome of an already-serving directional pattern.
   *
   * `cardEdge` and `coMovementEdge` are mutually exclusive by construction: the two rules return
   * from different branches of the classifier. That mutual exclusion is what keeps the directional
   * template and the co-movement template from ever seeing each other's edge.
   */
  coMovementEdge: ServableEdge | null
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
      // Co-movement path: contradiction is checked FIRST and returns FIRST, so it still wins over the
      // co-movement path below. A pair whose gate-passing personal signal opposes a monotonic
      // edge is 'needs-review' even when a `correlates` edge over the same pair would otherwise
      // have rendered — a co-movement card must not paper over a live disagreement.
      return {
        branch: "contradiction",
        edges: refs,
        personal,
        topEdge: null,
        cardEdge: null,
        coMovementEdge: null,
      }
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
      coMovementEdge: null,
    }
  }

  // 2b. co-movement agree: no monotonic edge could carry a direction (rule 2 returned
  //     already if one could), but a sign-free `correlates` edge spans exactly this coincidence
  //     pattern's observed pair and both endpoints moved the same way. That is a real, citable
  //     agreement — about CO-MOVEMENT, not about direction — so it is `agree` rather than
  //     `research-context`, and it renders through its own directionless template.
  //
  //     `cardEdge` stays null (nothing here may drive directional copy) and `coMovementEdge`
  //     carries the edge. `branch` deliberately reuses `agree`: composed_insights.branch has a
  //     four-value CHECK constraint, and inventing a fifth value would need a migration against a
  //     live database to say something the existing value already says truthfully.
  const coMovement = coMovementEdgeFor(pattern, edges)
  if (coMovement !== null) {
    const personal = personalFor(pairKey(coMovement.subject, coMovement.object))
    return {
      branch: "agree",
      edges: refs,
      personal: personal !== null && personalPassesGate(personal, gates) ? personal : null,
      topEdge: coMovement,
      cardEdge: null,
      coMovementEdge: coMovement,
    }
  }

  // 3. research-context: edges exist but none can carry the direction (context-only relations,
  //    or inconsistent direction without a personal contradiction) AND none qualifies as a
  //    co-movement edge for this pattern. Still gap-only (O18) — rule 2b narrowed what reaches
  //    here, it did not make this branch surfaceable.
  if (edges.length > 0) {
    return {
      branch: "research-context",
      edges: refs,
      personal: null,
      topEdge: null,
      cardEdge: null,
      coMovementEdge: null,
    }
  }

  // 4. idiosyncratic: no edge, but the user's own data holds (pair patterns only — a
  //    single-metric pattern's idiosyncratic pairs are enumerated by the caller).
  if (pattern.metricKeys.length === 2) {
    const personal = personalFor(pairKey(pattern.metricKeys[0]!, pattern.metricKeys[1]!))
    if (personal !== null && personalPassesGate(personal, gates)) {
      return {
        branch: "idiosyncratic",
        edges: [],
        personal,
        topEdge: null,
        cardEdge: null,
        coMovementEdge: null,
      }
    }
  }

  // 5. nothing to say — the pattern is gap fuel (the handler writes the A1 gap event).
  return null
}

// ─── Surfacing policy + A1 gap-status mapping (O16 + O18) ───────────────────────────────────

/**
 * O18 (Jayden 2026-07-24, decision (a): gap-only) + O16 — the ONE place that says which
 * classified patterns may render a user card:
 *   - `agree` renders the cited DIRECTIONAL edge card only with a subject-endpoint cardEdge (O16);
 *   - `agree` renders the cited DIRECTIONLESS co-movement card with a coMovementEdge;
 *   - `idiosyncratic` renders the uncited "still researching" card (architecture §S7);
 *   - `research-context` and `contradiction` NEVER render — composed row + gap event only
 *     (architecture §S7 / the composed_insights migration comment; verdict H1).
 *
 * The co-movement path keeps this function the SINGLE surfacing policy: the new path added a disjunct here rather
 * than a second gate at a call site, so there is still exactly one predicate to read and to test.
 * Which TEMPLATE a renderable `agree` pattern gets is then decided by which of the two mutually
 * exclusive fields is set — never by re-deriving the relation at the call site.
 */
export function rendersCard(classified: ClassifiedPattern): boolean {
  if (classified.branch === "agree") {
    return classified.cardEdge !== null || classified.coMovementEdge !== null
  }
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
 *     fired signal has no servable edge in the orientation that could serve it;
 *   - co-movement: `agree` with a coMovementEdge → null: that pattern DOES serve a card, so it is not a
 *     gap. Reading only `cardEdge` here would have logged unmet demand for a pair the run just
 *     served, double-counting it against the very edge that satisfied it.
 * The fifth serve-path status, 'personal-null' (pair with a computed-but-non-gate-passing
 * personal signal and no edge — branch 5), is written by the handler's idiosyncratic sweep,
 * which never constructs a ClassifiedPattern.
 */
export function gapStatusFor(classified: ClassifiedPattern): GapStatus | null {
  switch (classified.branch) {
    case "agree":
      return classified.cardEdge === null && classified.coMovementEdge === null
        ? "personal-signal-no-edge"
        : null
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
