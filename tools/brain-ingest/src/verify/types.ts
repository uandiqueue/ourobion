/**
 * A10 · Verifier types (insight-engine-architecture §A10).
 *
 * House pattern (matches `verify/quoteCheck.ts` + `synth/types.ts`): this package
 * does NOT statically import `shared/`. The brain contract shapes are STRUCTURAL
 * MIRRORS here, and the REAL zod `validateVerification` gate is loaded at RUNTIME
 * via a dynamic import (`verify/load.ts`), keeping `shared/` out of this package's
 * `tsc` include exactly as synthesis + the seeder do.
 *
 * The mirrors below are the fields the verifier writes to `edges/verifications.jsonl`
 * (the artifact the A11 edge-loader reads). They mirror
 * `shared/brain/relationships.ts` — the AssertExact guard over the true contract
 * lives in `relationships.schema.ts`; drift there fails `tsc` at the source.
 *
 * ESM / NodeNext — imports use explicit `.js` extensions.
 */

import type { SynthClaim } from '../synth/types.js';
import type { EvidenceTierClassification } from '../evidenceTier.js';
import type { EvidenceTierInput } from '../evidenceTier.js';

// ─────────────────────────────────────────────────────────────────────────────
// Structural mirrors of shared/brain/relationships.ts (the verification half)
// ─────────────────────────────────────────────────────────────────────────────

/** Mirror of `Verdict` (relationships.ts:51-56). */
export type VerifyVerdict =
  | 'supported'
  | 'partial'
  | 'unsupported'
  | 'contradicted'
  | 'uncertain';

/** Mirror of `EvidenceTier` (relationships.ts:64). */
export type VerifyEvidenceTier = 1 | 2 | 3 | 4 | 5;

/** Mirror of `ImpactTier` (relationships.ts:67). */
export type VerifyImpactTier = 'high' | 'moderate' | 'low' | 'preprint';

/** Mirror of `ClaimKind` (relationships.ts:48). */
export type VerifyClaimKind = 'causal' | 'correlational' | 'mechanistic';

/** Mirror of `VerificationStatus` (relationships.ts:70-73). */
export type VerifyStatus = 'active' | 'stale' | 'superseded';

/**
 * Mirror of `EvidencePassage` (relationships.ts) — one bounded, provenance-addressable
 * passage carried on a citation (O15/B1). `locator` grammar:
 *   `chars:<start>-<end>`    — char span (end exclusive) into the source's canonical text;
 *   `abstract:<start>-<end>` — char span into an external candidate's abstract.
 */
export interface VerifyEvidencePassage {
  text: string;
  locator: string;
}

/** Mirror of `Citation` (relationships.ts). */
export interface VerifyCitation {
  paperId: string;
  title: string;
  year: number | null;
  population: string | null;
  evidenceTier: VerifyEvidenceTier;
  impactTier: VerifyImpactTier;
  stance: 'supports' | 'refutes' | 'mixed' | 'mentions';
  /**
   * Bounded evidence passages from THIS source — what the verifier prompt shows (O15/B1).
   * Optional + additive (absent on legacy records / sources with nothing extractable);
   * NEVER fabricated: absent means the source cannot ground the claim.
   */
  evidence?: readonly VerifyEvidencePassage[];
}

/** Mirror of `EdgeVerification` (relationships.ts:152-198) — the artifact record. */
export interface VerifyRecord {
  edgeId: string;
  verdict: VerifyVerdict;
  quoteCheck: { spansFound: number; spansTotal: number; allPresent: boolean };
  independentRetrieval: { performed: boolean; sources: readonly VerifyCitation[] };
  corroboration: { supporting: number; contradicting: number };
  directionCheck: { matchesClaim: boolean };
  claimKindCheck: { matchesClaim: boolean; supportedKind: VerifyClaimKind };
  scopeCheck: { mismatch: boolean; supportedPopulation: string | null };
  effectSizeCheck: { matchesClaim: boolean; extractedSize: number | null };
  evidenceTier: VerifyEvidenceTier;
  confidence: number;
  dqs: { weight: number };
  /**
   * #300 §E · approve-with-caveat — the user-facing limitation that actually fired
   * (`verify/caveat.ts`). Mirrors `EdgeVerification.caveat`, INCLUDING its three-state
   * semantics: a string = "approved, with this qualification"; `null` = "no limitation
   * fired"; ABSENT = "this producer predates caveats". Every producer in this package
   * emits the key (string or `null`), so absence in an artifact line is a real signal
   * about its age, never a shrug about its quality.
   */
  caveat?: string | null;
  /**
   * The CONFIGURED verifier id (router config / a MOCK or INTERIM provenance stamp).
   * This is a config echo, NOT attestation (B-BR1) — it is whatever the caller asked
   * for, never proof of what answered. The provider-returned identity lives in
   * {@link VerifyRecord.attestation} and nowhere else; the two are deliberately not
   * collapsed into this one field.
   */
  verifierModel: string;
  promptVersion: string;
  verifiedAt: string;
  status: VerifyStatus;
  /**
   * R4-U4/O27 · Mirror of `ArtifactRef` — which artifact bundle + exact bytes this
   * record is. Optional: absent means UNTRUSTED (shared/brain trustFailures blocks
   * serving), never "fine".
   */
  artifact?: VerifyArtifactRef;
  /**
   * R4-U4/O27 · Mirror of `ModelAttestation` — what the PROVIDER returned. Absent
   * when no provider response backed this record (quoteCheck-only rung, mailbox
   * fulfilment, fixtures). `attested` is true only for a provider-returned identity.
   */
  attestation?: VerifyModelAttestation;
}

/** Mirror of `ArtifactPosture` (relationships.ts) — 'fixture' = no provider was called. */
export type VerifyArtifactPosture = 'fixture' | 'live';

/** Mirror of `ArtifactRef` (relationships.ts). */
export interface VerifyArtifactRef {
  revision: string;
  /** `sha256:<64 lowercase hex>` over this record's canonical bytes. */
  contentHash: string;
  posture: VerifyArtifactPosture;
}

/** Mirror of `ModelAttestation` (relationships.ts). */
export interface VerifyModelAttestation {
  returnedModel: string;
  returnedVersion: string | null;
  family: string;
  decorrelated: boolean;
  attested: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// R4-U3 · Raw provider evidence (SIDE artifact — deliberately NOT on VerifyRecord)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * R4-U3 · The raw provider response behind one verification, as persisted.
 *
 * WHY THIS IS NOT A FIELD OF {@link VerifyRecord}: `VerifyRecord` mirrors the
 * `EdgeVerification` contract that `tools/edge-loader` ingests into
 * `edge_verifications`, which is read by the serving path that composes
 * user-facing cards. A raw provider body is unreviewed model output — evidence,
 * not product — so putting it on that record would push megabytes of unvetted
 * text into the exact table that feeds user-facing output. It therefore lives in
 * its OWN append-only artifact beside the verifications, keyed by the same
 * `(edgeId, verifiedAt)` identity the loader uses, so the two are joinable
 * offline without the evidence ever entering the serving surface.
 *
 * It also keeps the brain contract in `shared/brain/` untouched (that would need
 * the two-reviewer shared-contract process) while still making the evidence
 * survive on disk, which was the actual requirement.
 */
export interface VerifyRawRecord {
  /** Join key — same identity as the verification's dedupe key. */
  edgeId: string;
  /** Join key — the verification's `verifiedAt`. */
  verifiedAt: string;
  /** The CONFIGURED verifier id (config echo — mirrors VerifyRecord.verifierModel). */
  verifierModel: string;
  /** The PROVIDER-RETURNED id when the response was attested, else null. */
  attestedModel: string | null;
  /** True iff the response backing this body was provider-attested. */
  attested: boolean;
  /** The raw body itself, with its size cap and truncation flag. */
  raw: VerifyRawBody;
}

/**
 * The retained body. Structurally the router's `RawProviderResponse`; restated
 * here for the same reason the contract mirrors above exist — this package does
 * not take a value-level dependency on another package's shapes.
 */
export interface VerifyRawBody {
  /** Verbatim response text, truncated to at most `capBytes`. */
  body: string;
  /** Byte length of the FULL body before capping. */
  bytes: number;
  /** True when `body` was cut. Truncation is recorded, never silent. */
  truncated: boolean;
  /** The cap applied, in bytes. */
  capBytes: number;
  /** `sha256:<hex>` over the FULL, untruncated body. */
  sha256: string;
}

/** The shared zod gate, typed to this package's structural mirror. */
export type VerificationValidator = (v: unknown) => VerifyRecord;

// ─────────────────────────────────────────────────────────────────────────────
// Budget triage (C7 — insight-engine-architecture §A10; brain-synthesis-design "Tiered spend")
// ─────────────────────────────────────────────────────────────────────────────

/** The two verification-budget rungs (brain-synthesis-design point 4). */
export type TriageMode = 'full' | 'quoteCheck-only';

/**
 * The budget-triage policy (C7): full independent-retrieval verification is spent
 * only on high-impact OR low-corroboration edges; every other edge gets the cheap
 * `quoteCheck`-only pass (no retrieval, no verifier LLM).
 */
export interface TriageConfig {
  /** A claim citing a source in any of these impact tiers earns full retrieval. */
  fullRetrievalImpactTiers: readonly VerifyImpactTier[];
  /**
   * A claim with FEWER than this many independent supporting citations is
   * "low-corroboration" and earns full retrieval (the least-corroborated edges
   * are exactly where a second pass is worth the spend).
   */
  lowCorroborationThreshold: number;
}

/** The triage decision for one claim — the mode plus the reasons that drove it. */
export interface TriageDecision {
  mode: TriageMode;
  /** Human-readable reasons (empty on the quoteCheck-only default). */
  reasons: string[];
  /** Distinct supporting-citation count that fed the low-corroboration test. */
  supportingCitations: number;
  /** Strongest impact tier among the claim's citations (null when none). */
  topImpactTier: VerifyImpactTier | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Retrieval (deterministic corpus-internal + injectable external-fresh)
// ─────────────────────────────────────────────────────────────────────────────

/** A corpus paper the verifier can rank + retrieve over (its own search — §A10). */
export interface CorpusDoc {
  paperId: string;
  title: string;
  year: number | null;
  /** Canonical extracted text (the finding sentences the ranker scores). */
  text: string;
  evidenceTier: VerifyEvidenceTier;
  /** Truth inputs retained so classification/hash are recomputed on every load. */
  evidenceInputs?: Omit<EvidenceTierInput, 'paperUid' | 'title'>;
  /** Local classifier posture; mandatory for acceptance bundles, optional for legacy corpora. */
  evidenceClassification?: EvidenceTierClassification;
  impactTier: VerifyImpactTier;
}

/** One ranked corpus hit. */
export interface RankedDoc {
  doc: CorpusDoc;
  score: number;
  matchedTerms: string[];
}

/** The evidence block the verifier assembled by its OWN retrieval (→ independentRetrieval). */
export interface RetrievalResult {
  /** True when retrieval was actually attempted (full mode); false = not performable. */
  performed: boolean;
  /** Candidate sources the verifier LLM will assess (stance defaults to 'mentions'). */
  sources: VerifyCitation[];
  /** The corpus hits (with scores) — kept for the run log / prompt evidence. */
  corpusHits: RankedDoc[];
  /** How many came from live external discovery (echo-controlled). */
  externalCount: number;
}

// Re-export the claim shape the verifier consumes (from synthesis).
export type { SynthClaim };
