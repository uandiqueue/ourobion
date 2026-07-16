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

/** Mirror of `Citation` (relationships.ts:76-91). */
export interface VerifyCitation {
  paperId: string;
  title: string;
  year: number | null;
  population: string | null;
  evidenceTier: VerifyEvidenceTier;
  impactTier: VerifyImpactTier;
  stance: 'supports' | 'refutes' | 'mixed' | 'mentions';
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
  verifierModel: string;
  promptVersion: string;
  verifiedAt: string;
  status: VerifyStatus;
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
