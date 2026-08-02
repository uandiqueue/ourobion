// shared/brain/relationships.ts
//
// THE shared contract for "the brain" — ourobion's knowledge graph of scientifically-derived
// relationships between metrics. Two LLM passes produce every edge:
//   1. SYNTHESIS  — an LLM scrapes papers and proposes an edge: a `RelationshipClaim`.
//   2. VERIFICATION — a SECOND, independent LLM adversarially re-checks that claim against
//      freshly-retrieved evidence (it is prompted to REFUTE, defaults to "uncertain" when it can't
//      ground the claim): an `EdgeVerification`.
// This file defines the shape of both records. The pipeline that produces them and the stored graph
// are a DERIVED, rebuildable projection (docs/memory/0001-two-tier-truth) — never hand-edited. To
// change an edge or a verdict, fix the INPUT (paper corpus, synthesis/verifier prompt — bump
// `promptVersion`) and re-run the job.
//
// TRUTH vs DERIVED: this *contract* (the types below) is TRUTH — git-tracked, 2-reviewer PR
// (docs/memory/0002-shared-contract-two-reviewers). The *instances* (claims + verifications) are the
// rebuildable projection.
//
// Edge endpoints (`subject` / `object`) are canonical snake_case metric keys from
// shared/metrics/registry.ts — every endpoint must resolve to an active registry metric
// (validate with `metrics.isActiveMetric`). The relationship graph is *seeded* by each derived
// metric's `derivedFrom` (see registry.ts) and *grown* by synthesis from the literature.
//
// Why a second LLM (the safeguard): synthesis is generative (high hallucination surface);
// verification is discriminative and grounded (a narrow, checkable task). A second pass earns its
// cost ONLY when it (a) retrieves evidence INDEPENDENTLY rather than re-opining over the synthesis
// context, and (b) is adversarial. Those two properties are encoded as schema invariants in
// relationships.schema.ts. Full rationale: docs/implemented/nao/brain-synthesis-design.md.
//
// TS-first: the brain ingestion pipeline is backend/tooling, so there is no registry.dart-style Dart
// mirror yet, and no DB/parity guard couplings (the data isn't persisted or app-rendered yet). A Dart
// mirror + ts-dart parity guard + a schema guard follow when the app renders edges and the graph is
// persisted — the same deferral the registry used for env_daily. See docs/implemented/nao/brain-synthesis-design.md
// "Guards (deferred)".

/** Canonical snake_case metric key — must resolve to an active shared/metrics registry entry. */
export type MetricKey = string;

/** How `subject` relates to `object`. `no_effect` records a studied NULL result (worth keeping). */
export type RelationKind =
  | 'increases'    // monotonic ↑ : more subject → more object
  | 'decreases'    // monotonic ↓ : more subject → less object
  | 'modulates'    // affects, but non-monotonic / conditional (e.g. inverted-U)
  | 'correlates'   // associated, direction of causation not claimed
  | 'confounds'    // subject is a third variable distorting object's other relationships
  | 'no_effect';   // studied and found null — prevents re-proposing a dead edge

/** The strongest claim the evidence licenses. The axis synthesis most often OVERSTATES. */
export type ClaimKind = 'causal' | 'correlational' | 'mechanistic';

/** Verifier verdict on a synthesised claim. */
export type Verdict =
  | 'supported'      // evidence backs the claim as stated
  | 'partial'        // backed only with a narrower scope / weaker claim_kind / smaller effect
  | 'unsupported'    // no evidence found either way (absence, not contradiction)
  | 'contradicted'   // independent evidence points the other way
  | 'uncertain';     // could not be grounded (e.g. no independent retrieval) — never served

/**
 * Study-design strength of the strongest SUPPORTING source — the causal-weight ladder, the brain's
 * analog of the registry's `reliability`. Higher = more causal weight.
 * 1 mechanistic / in-vitro · 2 cross-sectional / observational · 3 cohort / longitudinal
 * 4 RCT · 5 meta-analysis / systematic review.
 */
export type EvidenceTier = 1 | 2 | 3 | 4 | 5;

/** Venue / citation weight — kept SEPARATE from `evidenceTier` (a top venue can still run a weak design). */
export type ImpactTier = 'high' | 'moderate' | 'low' | 'preprint';

/** Lifecycle of a verification record. */
export type VerificationStatus =
  | 'active'       // current, serve per gating
  | 'stale'        // promptVersion / corpus moved on — re-run pending
  | 'superseded';  // replaced by a newer verification of the same edge

/**
 * One bounded, provenance-addressable evidence passage carried on a citation (O15/B1: the
 * verifier judges ONLY shown evidence, so the passage text must survive to the prompt).
 * `locator` addresses where in the paper the passage came from:
 *   - `chars:<start>-<end>` — character span (end exclusive) into the source's canonical
 *     extracted text (`StructuredPaper.canonicalText`), same coordinate space as
 *     `QuoteSpan.charStart`/`charEnd`;
 *   - `abstract:<start>-<end>` — character span into the source's abstract (external
 *     discovery candidates, where only an abstract is available).
 * Producers bound `text` (brain-ingest `maxEvidenceCharsPerSource`); the schema keeps it
 * additive-optional so legacy records without evidence stay valid.
 */
export interface EvidencePassage {
  /** Verbatim passage text from the source (bounded by the producer). */
  text: string;
  /** Provenance address of the passage within the source (see grammar above). */
  locator: string;
}

/** A cited source, scored on the two independent axes (design strength × venue impact). */
export interface Citation {
  /** DOI when available, else a stable internal corpus id. */
  paperId: string;
  title: string;
  year: number | null;
  /**
   * Per-paper studied population, verbatim, when the source states one; null when not reported.
   * Distinct from the claim-level `RelationshipClaim.population` (the claimed scope of the whole
   * edge) — this is what THIS paper actually studied. U1 applicability-grader input.
   */
  population: string | null;
  evidenceTier: EvidenceTier;
  impactTier: ImpactTier;
  /** What this source does to the edge. */
  stance: 'supports' | 'refutes' | 'mixed' | 'mentions';
  /**
   * Bounded evidence passages from THIS source (O15/B1) — what the verifier was actually
   * shown. OPTIONAL and additive: absent on legacy records and on sources where no passage
   * could be extracted honestly (e.g. an external candidate with no abstract). Never
   * fabricated — an empty/absent list means the source cannot ground the claim.
   */
  evidence?: readonly EvidencePassage[];
}

/**
 * R4-U4 / O27 · Whether a record was loaded from a frozen FIXTURE artifact (no provider was
 * called) or from a LIVE provider run. There is deliberately no 'unknown' member: a record that
 * cannot state its posture has none, and no posture fails closed at the serving gate.
 */
export type ArtifactPosture = 'fixture' | 'live';

/**
 * R4-U4 / O27 · Content-addressed identity of the artifact line a record was loaded from — the
 * anchor of the provenance chain. `revision` names the artifact BUNDLE; `contentHash` pins this
 * record's exact bytes within it, so a rebuild that changes a claim yields a different hash and
 * any revision-bound expert disposition (B-BR7) stops applying instead of silently carrying over.
 */
export interface ArtifactRef {
  /** Revision id of the artifact bundle (corpus / edge manifest revision). */
  revision: string;
  /** Hash of this record's canonical artifact bytes, formatted `sha256:<64 lowercase hex>`. */
  contentHash: string;
  /** Fixture vs live — disclosed on every card derived from this record (B-UI9). */
  posture: ArtifactPosture;
}

/**
 * R4-U4 / O27 · What a provider actually RETURNED, as distinct from what was configured.
 * `attested` is true ONLY when `returnedModel` came back on a real provider response — a model id
 * copied from router config is a configuration echo, not attestation (B-BR1).
 */
export interface ModelAttestation {
  /** Model identity the provider returned on the response. */
  returnedModel: string;
  /** Provider-returned version / snapshot id, or null when the provider exposes none. */
  returnedVersion: string | null;
  /** Provider family — the unit the decorrelation invariant compares (O7 / B-BR2). */
  family: string;
  /** True iff this verification's family differs from the synthesising family for the same edge. */
  decorrelated: boolean;
  /** True ONLY for a provider-returned identity. A configured id is not attestation. */
  attested: boolean;
}

/** A verbatim span grounding a claim in a specific source — enables a near-free deterministic check. */
export interface QuoteSpan {
  /** Must match a `Citation.paperId` on the same claim. */
  paperId: string;
  /** Verbatim text from the source — checked for literal presence before the verifier LLM runs. */
  quote: string;
  /** Section / page / figure locator, when known. */
  locator: string | null;
  /**
   * Start character offset of `quote` into the source's canonical extracted text
   * (`StructuredPaper.canonicalText`); null when unknown. Upgrades `locator` from free-text-only
   * and makes the deterministic quote check exact.
   */
  charStart: number | null;
  /** End character offset (exclusive) into the canonical extracted text; null when unknown. */
  charEnd: number | null;
}

/**
 * What the SYNTHESIS LLM proposes. One edge of the graph, pre-verification.
 * `edgeId` is the deterministic identity of the edge (see `index.relationKey`) so re-synthesis and
 * re-verification address the same edge rather than duplicating it.
 */
export interface RelationshipClaim {
  /** Deterministic id: `${subject}|${relation}|${object}` (see index.relationKey). */
  edgeId: string;
  subject: MetricKey;
  object: MetricKey;
  relation: RelationKind;
  claimKind: ClaimKind;
  /** Quantified effect when the source gives one; nulls where only a direction is stated. */
  effect: {
    size: number | null;
    unit: string | null;
    ci: readonly [number, number] | null;
  };
  /** Claimed population / scope, verbatim (e.g. 'healthy adults 18–40') — the overgeneralisation axis. */
  population: string | null;
  /** Sources synthesis leaned on (≥1). */
  citations: readonly Citation[];
  /** Grounding spans (≥1) — exact text the claim rests on. */
  quoteSpans: readonly QuoteSpan[];
  /**
   * The synthesis node's plain-language reasoning trace — "how these sentences produce this
   * claim". Captured AT synthesis time (never regenerated on view), copy-gated before storage.
   * Required on every claim.
   */
  derivation: string;
  /** Provenance — makes the claim a reproducible projection. */
  synthesisModel: string;
  promptVersion: string;
  synthesisedAt: string; // ISO datetime, supplied by the job
  /**
   * R4-U4 / O27 · The artifact revision + content hash this claim was loaded from, and whether
   * that artifact is a fixture or a live run. ADDITIVE + OPTIONAL (accepted-contract discipline:
   * add optional, never remove/rename) so pre-U4 records still validate — but absence is not
   * benign: `provenance.trustFailures` treats a missing ref as an untrusted record and BLOCKS it
   * on any path that requires trust. Legacy records are therefore honestly untrusted, not
   * grandfathered in.
   */
  artifact?: ArtifactRef;
}

/**
 * What the VERIFICATION LLM emits for a claim. This is the record that feeds gating / confidence.
 * Kept separate from the claim so verification can be re-run (cheaper, better verifier, new corpus)
 * without re-running synthesis.
 */
export interface EdgeVerification {
  /** FK to `RelationshipClaim.edgeId`. */
  edgeId: string;
  verdict: Verdict;

  // ── grounding: the properties that make a second pass non-redundant ──
  /** Deterministic, runs BEFORE the verifier LLM: are the claim's quote spans literally in the sources? */
  quoteCheck: {
    spansFound: number;
    spansTotal: number;
    allPresent: boolean;
  };
  /** The verifier's OWN retrieval — NOT the synthesis context. A grounded verdict requires this. */
  independentRetrieval: {
    performed: boolean;
    sources: readonly Citation[];
  };
  /** Independent corroboration vs contradiction across retrieved sources. */
  corroboration: {
    supporting: number;
    contradicting: number;
  };

  // ── the specific failure modes synthesis is bad at ──
  /** A→B vs B→A. */
  directionCheck: { matchesClaim: boolean };
  /** causal-vs-correlational drift — the most-overstated axis. */
  claimKindCheck: { matchesClaim: boolean; supportedKind: ClaimKind };
  /** Overgeneralisation: does the evidence actually cover the claimed population? */
  scopeCheck: { mismatch: boolean; supportedPopulation: string | null };
  /** Effect-size inflation. */
  effectSizeCheck: { matchesClaim: boolean; extractedSize: number | null };

  // ── rolled-up trust that feeds gating ──
  /** Study-design strength of the strongest supporting source. */
  evidenceTier: EvidenceTier;
  /** Verifier's calibrated belief, 0..1. */
  confidence: number;
  /** Edge's contribution to graph trust — the brain's analog of metric `dqs.weight`, 0..1. */
  dqs: { weight: number };
  /**
   * #300 §E · APPROVE-WITH-CAVEAT. A short, user-safe note on *why* to read this edge with care
   * — a narrower population than claimed, a weak study design, a small sample.
   *
   * This exists because low credibility must be **surfaced, not silently converted into a
   * rejection**: the user decides whether to trust it. Rejection is reserved for the one case
   * where nothing can be salvaged — the evidence is simply not relevant to the claim.
   *
   * Because it is user-facing copy it MUST pass the non-diagnostic copy gate, which
   * `relationships.schema.ts` enforces — a caveat cannot smuggle diagnostic language onto a
   * card by the back door.
   *
   * ADDITIVE + OPTIONAL: absent on every legacy record, and `null` means "approved with no
   * caveat", which is distinct from absent ("this producer predates caveats").
   */
  caveat?: string | null;

  // ── provenance ──
  verifierModel: string;
  promptVersion: string;
  verifiedAt: string; // ISO datetime, supplied by the job
  status: VerificationStatus;
  /**
   * R4-U4 / O27 · The artifact revision + content hash this verification was loaded from.
   * ADDITIVE + OPTIONAL; absence fails closed at the serving gate (see `RelationshipClaim.artifact`).
   */
  artifact?: ArtifactRef;
  /**
   * R4-U4 / O27 · What the verifier PROVIDER returned — model identity/version, family,
   * decorrelation, and whether the identity is genuinely attested. Distinct from `verifierModel`,
   * which is the CONFIGURED id and can be a mere echo of router config (B-BR1). ADDITIVE +
   * OPTIONAL; absence blocks serving on any path that requires attestation.
   */
  attestation?: ModelAttestation;
}

/** A claim joined with its current verification — the servable unit of the graph. */
export interface VerifiedEdge {
  claim: RelationshipClaim;
  verification: EdgeVerification;
}
