/**
 * A8 · Synthesis types (insight-engine-architecture §A8).
 *
 * House pattern (matches `verify/quoteCheck.ts` + `seeder/`): this package does
 * NOT statically import `shared/` — the brain contract shapes are STRUCTURAL
 * MIRRORS here, and the REAL zod `validateClaim` gate is loaded at runtime via a
 * dynamic import (`synth/load.ts`), keeping `shared/` out of this package's `tsc`
 * include exactly as the seeder keeps the registry out of it.
 *
 * The mirrors below are the fields the synthesis post-processor reads and the
 * shape it writes to `edges/claims.jsonl`. They mirror
 * `shared/brain/relationships.ts` — the AssertExact guard over the true contract
 * lives in `relationships.schema.ts`; drift there fails `tsc` at the source.
 *
 * ESM / NodeNext — imports use explicit `.js` extensions.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Structural mirrors of shared/brain/relationships.ts
// ─────────────────────────────────────────────────────────────────────────────

/** Mirror of `RelationKind` (relationships.ts:39-45). */
export type SynthRelationKind =
  | 'increases'
  | 'decreases'
  | 'modulates'
  | 'correlates'
  | 'confounds'
  | 'no_effect';

/** Mirror of `ClaimKind` (relationships.ts:48). */
export type SynthClaimKind = 'causal' | 'correlational' | 'mechanistic';

/** Mirror of `EvidenceTier` (relationships.ts:64). */
export type SynthEvidenceTier = 1 | 2 | 3 | 4 | 5;

/** Mirror of `ImpactTier` (relationships.ts:67). */
export type SynthImpactTier = 'high' | 'moderate' | 'low' | 'preprint';

/** Mirror of `Citation` (relationships.ts:76-91). */
export interface SynthCitation {
  paperId: string;
  title: string;
  year: number | null;
  population: string | null;
  evidenceTier: SynthEvidenceTier;
  impactTier: SynthImpactTier;
  stance: 'supports' | 'refutes' | 'mixed' | 'mentions';
}

/** Manifest/corpus-owned citation identity fields; model-supplied copies are never trusted. */
export interface PaperCitationMetadata {
  title: string;
  year: number | null;
  evidenceTier: SynthEvidenceTier;
}

/** Mirror of `QuoteSpan` (relationships.ts:94-109). */
export interface SynthQuoteSpan {
  paperId: string;
  quote: string;
  locator: string | null;
  charStart: number | null;
  charEnd: number | null;
}

/** Mirror of `RelationshipClaim` (relationships.ts:116-145) — the artifact record. */
export interface SynthClaim {
  edgeId: string;
  subject: string;
  object: string;
  relation: SynthRelationKind;
  claimKind: SynthClaimKind;
  effect: { size: number | null; unit: string | null; ci: readonly [number, number] | null };
  population: string | null;
  citations: readonly SynthCitation[];
  quoteSpans: readonly SynthQuoteSpan[];
  derivation: string;
  synthesisModel: string;
  promptVersion: string;
  synthesisedAt: string;
}

/** Local-only provider evidence for one pair-scoped synthesis POST result. */
export interface SynthRawRecord {
  synthesisRunId: string;
  pairId: string;
  logicalCallId: string;
  attempt: number;
  capturedAt: string;
  result: 'accepted' | 'adverse-empty' | 'enforcement-rejected' | 'parse-error';
  acceptedCount: number;
  rejectedCount: number;
  synthesisModel: string;
  returnedModel: string;
  returnedVersion: string | null;
  family: string;
  attested: boolean;
  raw: SynthRawBody;
}

/** Structural mirror of the router's capped raw-provider-response evidence. */
export interface SynthRawBody {
  body: string;
  bytes: number;
  truncated: boolean;
  capBytes: number;
  sha256: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Input assembly (deterministic)
// ─────────────────────────────────────────────────────────────────────────────

/** A candidate pair synthesis is asked about (C9 — the ONLY source of edges). */
export interface SynthPair {
  /** Stable id — the seed-candidate id, or `pair:a|b` for an explicit `--pair`. */
  id: string;
  /** The two metric keys (order is presentational only; the edge is unordered). */
  metricKeys: [string, string];
  /** Human-readable target handed to the LLM. */
  label: string;
  /** Keyword/synonym terms driving the deterministic passage prefilter. */
  terms: string[];
}

/** One deterministically-selected passage of a paper's canonical text. */
export interface Passage {
  /** Start offset into the canonical text (inclusive). */
  charStart: number;
  /** End offset (exclusive). */
  charEnd: number;
  /** Verbatim slice `text.slice(charStart, charEnd)`. */
  text: string;
  /** Which pair terms matched inside this passage (dedup, first-seen order). */
  matchedTerms: string[];
}

/** A paper's assembled synthesis input: identity + its selected passages. */
export interface PaperPassages {
  paperUid: string;
  title: string | null;
  charCount: number;
  passages: Passage[];
}

/** The deterministic assembly output for ONE pair (drives one router call). */
export interface AssembledSynthesisInput {
  pair: SynthPair;
  papers: PaperPassages[];
  system: string;
  prompt: string;
  /** All paper uids the LLM is allowed to cite (== the loaded papers). */
  allowedPaperIds: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Post-processing (the gate)
// ─────────────────────────────────────────────────────────────────────────────

/** Why a proposed claim was rejected (post-processing gate). */
export type RejectionReason =
  | 'not-an-object' // the claim wasn't a JSON object
  | 'missing-endpoints' // subject/object absent or non-string
  | 'unrequested-pair' // endpoints are not the pair we asked about (C9)
  | 'foreign-paper' // cites a paperId outside the provided set
  | 'citation-metadata' // no authoritative title/year exists for a cited paper
  | 'schema-invalid' // failed the shared zod validateClaim gate
  | 'quote-not-found' // A9 quoteCheck: a span is not literally in the text
  | 'copy-gate'; // O20: derivation fails the shared validateCopyString gate (diagnostic language)

/** A claim the gate refused, with the reason + detail for the run log. */
export interface RejectedClaim {
  edgeId: string | null;
  reason: RejectionReason;
  detail: string;
}

/** The result of post-processing one synthesis response for one pair. */
export interface ProcessResult {
  accepted: SynthClaim[];
  rejected: RejectedClaim[];
}
