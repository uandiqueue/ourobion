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

// ─────────────────────────────────────────────────────────────────────────────
// #300 · Model-declared span roles — carried in the EXISTING free-text `locator`
//
// The mechanism and the model-declared section both ride `locator`, so #300 §B
// lands with NO change to the `RelationshipClaim` contract and rides the SAME A9
// quote gate: verbatim text at exact offsets in the canonical text.
//
//   evidence span   locator = "<section>"              e.g. "Results"
//   mechanism span  locator = "mechanism:<section>"     e.g. "mechanism:Discussion"
//
// The mechanism is therefore ALWAYS a verbatim quote of the paper's own sentence and
// never a model paraphrase — a paraphrased pathway is precisely where invented
// biology appears ("gut bacteria produce serotonin which crosses the blood-brain
// barrier" reads plausibly and is wrong).
// ─────────────────────────────────────────────────────────────────────────────

/** Locator prefix marking a span as the paper's own stated mechanism (#300 §B). */
export const MECHANISM_LOCATOR_PREFIX = 'mechanism:';

/** True when a span's locator marks it as the mechanism span. */
export function isMechanismLocator(locator: string | null | undefined): boolean {
  return typeof locator === 'string' && locator.startsWith(MECHANISM_LOCATOR_PREFIX);
}

/** The model-declared section a span came from, with any mechanism prefix stripped. */
export function sectionFromLocator(locator: string | null | undefined): string | null {
  if (typeof locator !== 'string' || locator.length === 0) return null;
  const section = isMechanismLocator(locator)
    ? locator.slice(MECHANISM_LOCATOR_PREFIX.length)
    : locator;
  const trimmed = section.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Model-declared provenance for one proposed claim (#300 §C). Used to GATE and
 * deliberately NOT persisted on the claim: `ownFinding: false` is REJECTED rather
 * than downgraded, so every accepted claim is the paper's own finding by
 * construction and there is nothing left to record.
 */
export interface SynthDeclaredProvenance {
  /** Section the model says the evidence came from (free text; we do not parse JATS). */
  section: string | null;
  /** Whether this is the paper's OWN finding, vs a result it cites from elsewhere. */
  ownFinding: boolean;
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
  /**
   * #300 §A · Whole-paper mode. When set, the FULL canonical text is sent and
   * `passages` is empty — no keyword prefilter decides what the model may read.
   *
   * This DELETES the `METRIC_TERMS` problem rather than solving it. A
   * hand-maintained synonym table would mean a human must expand the vocabulary
   * before the system can research any new pair, which defeats the automated-research
   * premise. The model already knows "depressive symptoms" bears on mood.
   */
  fullText?: string;
}

/** One paper's whole-text synthesis target (#300 §A — the paper is the unit of work). */
export interface SynthPaperTarget {
  paperUid: string;
  title: string | null;
  /** Full canonical text — the entire paper, not a prefiltered window. */
  text: string;
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
  | 'unrequested-pair' // endpoints are not the pair we asked about (C9, pair-scoped mode)
  | 'inactive-metric-key' // #300: paper-scoped mode — an endpoint is not an ACTIVE registry key
  | 'not-own-finding' // #300 §C: ownFinding:false is REJECTED, never downgraded
  | 'intro-zone-quote' // #300 §C: evidence quote sits in the leading Introduction/Background zone
  | 'foreign-paper' // cites a paperId outside the provided set
  | 'citation-metadata' // no authoritative title/year exists for a cited paper
  | 'schema-invalid' // failed the shared zod validateClaim gate
  | 'quote-not-found' // A9 quoteCheck: a span is not literally in the text
  | 'copy-gate'; // O20: derivation fails the shared validateCopyString gate (diagnostic language)

/**
 * #300 §C interim mitigation. While model-declared section reliability is unproven, reject
 * evidence quotes falling in the leading fraction of the canonical text, where
 * Introduction/Background nearly always sit. Deterministic and free.
 *
 * The MECHANISM span is deliberately exempt: a paper very often states the pathway it is
 * building on in its Introduction, and that sentence is still the paper's own words at exact
 * offsets. Only the load-bearing EVIDENCE span has to come from the body.
 */
export const INTRO_ZONE_FRACTION = 0.15;

// ─────────────────────────────────────────────────────────────────────────────
// #300 §D · Rule-blueprint output — a new PRODUCER, not an architectural change
//
// `provenance.tier: 'extracted'` and `provenance.citation` ALREADY exist in
// `shared/rules/rule.schema.ts` and have never been written to. Blueprints go
// through the SAME zod gate, the SAME loader (`rules:load`) and the SAME engine.
// ─────────────────────────────────────────────────────────────────────────────

/** A blueprint the gate accepted, plus the paper lineage that produced it. */
export interface SynthBlueprintRecord {
  /** The validated `RuleBlueprint` (shape owned by shared/rules; structurally opaque here). */
  blueprint: Record<string, unknown>;
  /** Stable dedupe identity — metric pair + condition shape + direction (#300 G3). */
  dedupeKey: string;
  /** Paper this blueprint was extracted from. */
  paperId: string;
  /** Provenance stamps, mirroring the claim record. */
  synthesisModel: string;
  promptVersion: string;
  synthesisedAt: string;
}

/** Why a proposed blueprint was rejected. */
export type BlueprintRejectionReason =
  | 'not-an-object'
  | 'inactive-metric-key'
  | 'not-own-finding'
  | 'schema-invalid' // failed the shared zod validateBlueprint gate (incl. the copy gate)
  | 'quote-not-found' // the citation locator's quote is not literally in the paper text
  | 'missing-citation'; // an 'extracted' blueprint with no paper citation is not extracted

/** A blueprint the gate refused, with the reason + detail for the run log. */
export interface RejectedBlueprint {
  ruleId: string | null;
  reason: BlueprintRejectionReason;
  detail: string;
}

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
  /** #300 §D — rule/personal blueprints emitted alongside edges (empty in pair-scoped mode). */
  acceptedBlueprints?: SynthBlueprintRecord[];
  rejectedBlueprints?: RejectedBlueprint[];
}

// ─────────────────────────────────────────────────────────────────────────────
// #300 G2 · Per-run budget accounting + resumability
// ─────────────────────────────────────────────────────────────────────────────

/** Why a batch run stopped — a clean stop is a legitimate outcome, not an error. */
export type BatchStopReason =
  | 'completed' // every requested paper was processed
  | 'budget-ceiling' // the per-run USD ceiling would be exceeded by the next paper
  | 'call-ceiling'; // the per-run provider-call ceiling was reached

/** Per-paper outcome inside a batch run (#300 G1/G2). */
export interface PaperOutcome {
  paperUid: string;
  /** 'synthesised' = a provider call was made; 'skipped-already-done' = resumability (never pay twice). */
  status: 'synthesised' | 'skipped-already-done' | 'not-reached' | 'failed';
  acceptedClaims: number;
  rejectedClaims: number;
  acceptedBlueprints: number;
  rejectedBlueprints: number;
  /** Actual spend attributed to this paper, when the router reported it. */
  usd?: number;
  detail?: string;
}

/** The budget/resumability report a batch run always returns (#300 G2). */
export interface BatchBudgetReport {
  stopReason: BatchStopReason;
  papersRequested: number;
  papersSynthesised: number;
  papersSkippedAlreadyDone: number;
  papersNotReached: number;
  /**
   * #307 · Papers that errored — no canonical text, missing manifest metadata, a router failure, or
   * an unparseable reply.
   *
   * Added because the summary reported only the three buckets above, so a real run printed
   * `2 synthesised, 0 already done, 0 not reached (of 3 requested)`: a paper had failed and was
   * counted nowhere. The four buckets must now sum to `papersRequested`, so a run cannot silently
   * lose a paper from its own accounting.
   */
  papersFailed: number;
  providerCalls: number;
  usdSpent: number;
  /** The ceilings this run was held to (absent = uncapped). */
  maxUsd: number | null;
  maxCalls: number | null;
}
