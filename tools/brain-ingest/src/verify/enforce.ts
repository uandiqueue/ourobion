/**
 * A10 · Post-enforcement of the schema invariants over the UNTRUSTED verifier
 * reply (insight-engine-architecture §A10; docs/memory/0012 "enforced, not left to
 * prompts").
 *
 * The verifier LLM's JSON is never trusted. This module rebuilds a valid
 * `EdgeVerification` from: the deterministic A9 quoteCheck block, the verifier's
 * OWN retrieval result, and the parsed reply — enforcing:
 *
 *   1. No independent retrieval ⇒ verdict FORCED to `uncertain` (the single
 *      invariant that prevents the rubber-stamp — a verdict with no grounding can
 *      never be affirmative).
 *   2. `supported` / `partial` require ≥1 source the LLM marked "supports";
 *      a `supported`-with-zero-supporting reply is REJECTED (not silently kept).
 *   3. `contradicted` requires ≥1 source the LLM marked "refutes"; else REJECTED.
 *   4. The LLM may only assign stances to sources WE retrieved — it cannot invent
 *      sources. Corroboration counts are re-derived from those stances, not read
 *      from the reply.
 *   5. The rebuilt record is then run through the shared zod `validateVerification`
 *      hard-gate (belt-and-suspenders: the same invariants, at the contract).
 *
 * A rejected reply is retried once by the caller, then falls back to `uncertain`
 * (§A10 failure mode 7) — enforcement never emits an invalid record.
 *
 * ESM / NodeNext — imports use explicit `.js` extensions.
 */

import type {
  RetrievalResult,
  SynthClaim,
  VerificationValidator,
  VerifyCitation,
  VerifyClaimKind,
  VerifyEvidenceTier,
  VerifyRecord,
  VerifyVerdict,
} from './types.js';
import type { QuoteCheckBlock } from './quoteCheck.js';

const CLAIM_KINDS: readonly VerifyClaimKind[] = ['causal', 'correlational', 'mechanistic'];
const STANCES = ['supports', 'refutes', 'mixed', 'mentions'] as const;
type Stance = (typeof STANCES)[number];

/** The parsed (still untrusted) verifier reply. */
export interface ParsedVerifierReply {
  verdict: string;
  sourceStances: Array<{ paperId: string; stance: string }>;
  directionCheck: { matchesClaim: boolean };
  claimKindCheck: { matchesClaim: boolean; supportedKind: string };
  scopeCheck: { mismatch: boolean; supportedPopulation: string | null };
  effectSizeCheck: { matchesClaim: boolean; extractedSize: number | null };
  evidenceTier: number;
  confidence: number;
}

/** Parse the verifier's JSON reply into a defensive, typed shape. Throws on non-JSON. */
export function parseVerifierResponse(rawText: string): ParsedVerifierReply {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch (err) {
    throw new Error(`verify: reply was not valid JSON — ${err instanceof Error ? err.message : String(err)}`);
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('verify: reply JSON was not an object');
  }
  const o = parsed as Record<string, unknown>;
  const obj = (v: unknown): Record<string, unknown> => (typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {});
  const bool = (v: unknown): boolean => v === true;
  const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const str = (v: unknown): string => (typeof v === 'string' ? v : '');

  const dc = obj(o['directionCheck']);
  const ck = obj(o['claimKindCheck']);
  const sc = obj(o['scopeCheck']);
  const ec = obj(o['effectSizeCheck']);
  const stances = Array.isArray(o['sourceStances'])
    ? (o['sourceStances'] as unknown[]).map((s) => {
        const r = obj(s);
        return { paperId: str(r['paperId']), stance: str(r['stance']) };
      })
    : [];

  return {
    verdict: str(o['verdict']),
    sourceStances: stances,
    directionCheck: { matchesClaim: bool(dc['matchesClaim']) },
    claimKindCheck: { matchesClaim: bool(ck['matchesClaim']), supportedKind: str(ck['supportedKind']) },
    scopeCheck: {
      mismatch: bool(sc['mismatch']),
      supportedPopulation: typeof sc['supportedPopulation'] === 'string' ? (sc['supportedPopulation'] as string) : null,
    },
    effectSizeCheck: { matchesClaim: bool(ec['matchesClaim']), extractedSize: num(ec['extractedSize']) },
    evidenceTier: num(o['evidenceTier']) ?? 1,
    confidence: num(o['confidence']) ?? 0,
  };
}

/** The outcome of enforcement: a valid record, or a labelled rejection. */
export type EnforceResult =
  | { ok: true; record: VerifyRecord }
  | { ok: false; reason: 'enforcement-violation' | 'schema-invalid'; detail: string };

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function asEvidenceTier(n: number): VerifyEvidenceTier {
  const r = Math.round(n);
  return (r < 1 ? 1 : r > 5 ? 5 : r) as VerifyEvidenceTier;
}

function asStance(s: string): Stance {
  return (STANCES as readonly string[]).includes(s) ? (s as Stance) : 'mentions';
}

function asClaimKind(s: string, fallback: VerifyClaimKind): VerifyClaimKind {
  return CLAIM_KINDS.includes(s as VerifyClaimKind) ? (s as VerifyClaimKind) : fallback;
}

/** Deterministic dqs weight — high for well-evidenced servable verdicts, low otherwise. */
function computeDqsWeight(verdict: VerifyVerdict, confidence: number, tier: VerifyEvidenceTier): number {
  if (verdict === 'supported' || verdict === 'partial') {
    return clamp01(confidence * (0.4 + 0.6 * (tier / 5)));
  }
  return clamp01(confidence * 0.3);
}

export interface EnforceContext {
  claim: SynthClaim;
  quoteCheck: QuoteCheckBlock;
  retrieval: RetrievalResult;
  verifierModel: string;
  promptVersion: string;
  verifiedAt: string;
  validateVerification: VerificationValidator;
}

/**
 * Rebuild + enforce a verification from the untrusted reply. Applies the LLM's
 * per-source stances to the sources WE retrieved (never adds new ones), re-derives
 * corroboration, forces `uncertain` when retrieval was not performed, rejects
 * verdicts unsupported by the recomputed corroboration, and hard-gates the result
 * through the shared zod validator.
 */
export function enforceVerification(reply: ParsedVerifierReply, ctx: EnforceContext): EnforceResult {
  // (4) Apply LLM stances ONLY to retrieved sources — the model cannot invent one.
  const stanceById = new Map<string, Stance>();
  for (const s of reply.sourceStances) if (s.paperId) stanceById.set(s.paperId, asStance(s.stance));
  const sources: VerifyCitation[] = ctx.retrieval.sources.map((src) => ({
    ...src,
    stance: stanceById.get(src.paperId) ?? src.stance,
  }));

  const supporting = sources.filter((s) => s.stance === 'supports').length;
  const contradicting = sources.filter((s) => s.stance === 'refutes').length;

  // Verdict enforcement.
  let verdict: VerifyVerdict;
  const llmVerdict = reply.verdict as VerifyVerdict;
  const knownVerdict: readonly VerifyVerdict[] = ['supported', 'partial', 'unsupported', 'contradicted', 'uncertain'];

  if (!ctx.retrieval.performed) {
    // (1) No independent retrieval ⇒ the verdict can only ever be uncertain.
    verdict = 'uncertain';
  } else if (!knownVerdict.includes(llmVerdict)) {
    return { ok: false, reason: 'enforcement-violation', detail: `unknown verdict '${reply.verdict}'` };
  } else {
    verdict = llmVerdict;
    // (2) supported/partial need a supporting source.
    if ((verdict === 'supported' || verdict === 'partial') && supporting < 1) {
      return {
        ok: false,
        reason: 'enforcement-violation',
        detail: `verdict '${verdict}' but 0 supporting sources after stance re-derivation`,
      };
    }
    // (3) contradicted needs a contradicting source.
    if (verdict === 'contradicted' && contradicting < 1) {
      return {
        ok: false,
        reason: 'enforcement-violation',
        detail: "verdict 'contradicted' but 0 contradicting sources after stance re-derivation",
      };
    }
  }

  // evidenceTier: prefer the strongest SUPPORTING source's tier (a structural fact);
  // fall back to the LLM's stated tier when nothing supports.
  const supportingTiers = sources.filter((s) => s.stance === 'supports').map((s) => s.evidenceTier);
  const evidenceTier: VerifyEvidenceTier =
    supportingTiers.length > 0
      ? (Math.max(...supportingTiers) as VerifyEvidenceTier)
      : asEvidenceTier(reply.evidenceTier);

  const confidence = clamp01(reply.confidence);

  const record: VerifyRecord = {
    edgeId: ctx.claim.edgeId,
    verdict,
    quoteCheck: ctx.quoteCheck,
    independentRetrieval: { performed: ctx.retrieval.performed, sources },
    corroboration: { supporting, contradicting },
    directionCheck: { matchesClaim: reply.directionCheck.matchesClaim },
    claimKindCheck: {
      matchesClaim: reply.claimKindCheck.matchesClaim,
      supportedKind: asClaimKind(reply.claimKindCheck.supportedKind, ctx.claim.claimKind),
    },
    scopeCheck: { mismatch: reply.scopeCheck.mismatch, supportedPopulation: reply.scopeCheck.supportedPopulation },
    effectSizeCheck: { matchesClaim: reply.effectSizeCheck.matchesClaim, extractedSize: reply.effectSizeCheck.extractedSize },
    evidenceTier,
    confidence,
    dqs: { weight: computeDqsWeight(verdict, confidence, evidenceTier) },
    verifierModel: ctx.verifierModel,
    promptVersion: ctx.promptVersion,
    verifiedAt: ctx.verifiedAt,
    status: 'active',
  };

  // (5) Shared zod hard-gate — the same invariants, at the contract.
  try {
    ctx.validateVerification(record);
  } catch (err) {
    return { ok: false, reason: 'schema-invalid', detail: err instanceof Error ? err.message : String(err) };
  }
  return { ok: true, record };
}

export interface QuoteOnlyContext {
  claim: SynthClaim;
  quoteCheck: QuoteCheckBlock;
  verifierModel: string;
  promptVersion: string;
  verifiedAt: string;
  validateVerification: VerificationValidator;
}

/**
 * Build the cheap `quoteCheck`-only record (triage's low-stakes rung): the A9 quote
 * gate ran, but NO independent retrieval and NO verifier LLM — so the verdict is
 * `uncertain` (never served) and corroboration is empty. This is the correct safe
 * default for a well-corroborated, low-impact edge until budget frees up.
 */
export function buildQuoteOnlyRecord(ctx: QuoteOnlyContext): VerifyRecord {
  const record: VerifyRecord = {
    edgeId: ctx.claim.edgeId,
    verdict: 'uncertain',
    quoteCheck: ctx.quoteCheck,
    independentRetrieval: { performed: false, sources: [] },
    corroboration: { supporting: 0, contradicting: 0 },
    directionCheck: { matchesClaim: false },
    claimKindCheck: { matchesClaim: false, supportedKind: ctx.claim.claimKind },
    scopeCheck: { mismatch: false, supportedPopulation: null },
    effectSizeCheck: { matchesClaim: false, extractedSize: null },
    // Structural: the strongest tier the claim's own citations assert (not a verdict).
    evidenceTier: strongestCitationTier(ctx.claim),
    confidence: 0.3,
    dqs: { weight: 0.2 },
    verifierModel: ctx.verifierModel,
    promptVersion: ctx.promptVersion,
    verifiedAt: ctx.verifiedAt,
    status: 'active',
  };
  return ctx.validateVerification(record); // hard-gate (throws on any violation)
}

/** Strongest evidenceTier among a claim's citations (default 1 when none). */
function strongestCitationTier(claim: SynthClaim): VerifyEvidenceTier {
  let best = 1;
  for (const c of claim.citations) if (c.evidenceTier > best) best = c.evidenceTier;
  return best as VerifyEvidenceTier;
}
