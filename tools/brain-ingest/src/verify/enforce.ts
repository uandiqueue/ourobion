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
 *   6. #300 §E · `caveat` is populated from the limitations those re-derived facts
 *      show (`caveat.ts`), so low credibility is SURFACED as user-facing text rather
 *      than collapsed into a bare `uncertain`. It is a report ON the enforced record,
 *      never an input to the verdict: no threshold below decides a caveat, and no
 *      caveat decides a verdict.
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
  VerifyModelAttestation,
  VerifyRecord,
  VerifyVerdict,
} from './types.js';
import type { QuoteCheckBlock } from './quoteCheck.js';
import type { CopyValidator } from '../synth/load.js';
import { buildArtifactRef, posturefor } from './attest.js';
import { chooseCaveat, type CaveatInput } from './caveat.js';

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
  /**
   * #300 §E · the verifier's own one-sentence statement of the limitation it found. UNTRUSTED
   * like every other field: `caveat.ts` keeps it only if a limitation actually fired AND the text
   * names one of them, else the derived sentence is used instead.
   */
  caveat: string | null;
}

/**
 * #307 D3-a · Strip a markdown code fence around an otherwise well-formed JSON reply.
 *
 * MEASURED, not guessed. Agnes (`agnes-2.5-flash`) returns valid JSON wrapped in a fence:
 *
 *   "\n\n```json\n{ \"verdict\": \"uncertain\", … }\n```"
 *
 * so `JSON.parse` failed on the backticks and every one of 14 live verifier calls was recorded as an
 * `unparseable reply` — burning two attempts per claim and falling back to `uncertain`. The verdict
 * itself was fine; Agnes even reasoned the contract correctly ("no sources retrieved → the verdict
 * can only be 'uncertain'"). Only the wrapper broke it.
 *
 * Deliberately CONSERVATIVE. This unwraps a fence and nothing else — it does not hunt for the first
 * `{` in arbitrary prose, because that would start salvaging JSON out of commentary and quietly
 * accept replies that are genuinely malformed. A fence is an unambiguous, self-delimiting wrapper;
 * anything else still fails closed.
 */
export function stripJsonCodeFence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith('```')) return text;
  const firstNewline = trimmed.indexOf('\n');
  if (firstNewline === -1) return text;
  // The opening line is ``` optionally followed by a language tag (```json). Reject anything else,
  // so a stray backtick-prefixed reply is not silently reinterpreted.
  if (!/^```[a-zA-Z0-9_-]*$/.test(trimmed.slice(0, firstNewline).trim())) return text;
  const closing = trimmed.lastIndexOf('```');
  if (closing <= firstNewline) return text;
  return trimmed.slice(firstNewline + 1, closing).trim();
}

/** Parse the verifier's JSON reply into a defensive, typed shape. Throws on non-JSON. */
export function parseVerifierResponse(rawText: string): ParsedVerifierReply {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonCodeFence(rawText));
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
    caveat: typeof o['caveat'] === 'string' && o['caveat'].trim().length > 0 ? (o['caveat'] as string) : null,
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
  /** The CONFIGURED verifier id — a config echo, never attestation (B-BR1). */
  verifierModel: string;
  promptVersion: string;
  verifiedAt: string;
  validateVerification: VerificationValidator;
  /**
   * R4-U4/O27 · What the PROVIDER returned for this call (built by attest.ts from
   * the router response). Absent ⇒ the record carries no attestation and can never
   * pass the serving trust gate.
   */
  attestation?: VerifyModelAttestation;
  /**
   * R4-U4/O27 · Artifact BUNDLE revision (operator-supplied). Absent ⇒ no artifact
   * ref is stamped, which leaves the record unservable — never invented here.
   */
  artifactRevision?: string;
  /**
   * #300 §E · the shared copy gate (`shared/constants/copy_guidelines.ts`), used to screen a
   * MODEL-authored `caveat` before it is placed on the record. Absent ⇒ fail-closed: the model's
   * words are not used and the derived sentence is emitted instead (see `caveat.ts`).
   *
   * Screening here rather than only at the contract is deliberate. The shared zod gate rejects a
   * caveat with diagnostic language by failing the WHOLE record — one bad adjective would cost the
   * verdict and burn a retry. This gate costs only the model's phrasing.
   */
  validateCopy?: CopyValidator;
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
  const supportedKind = asClaimKind(reply.claimKindCheck.supportedKind, ctx.claim.claimKind);

  // #300 §E · the caveat is computed from the ENFORCED facts (re-derived corroboration, the tier
  // taken from the strongest supporting source, the retrieval WE performed) — never from the
  // reply's own verdict or counts. The model's sentence is offered as phrasing only; `caveat.ts`
  // keeps it exclusively when it names a limitation these facts show. No limitation ⇒ null.
  const caveatInput: CaveatInput = {
    retrievalPerformed: ctx.retrieval.performed,
    sourceCount: sources.length,
    supporting,
    contradicting,
    evidenceTier,
    scopeMismatch: reply.scopeCheck.mismatch,
    claimKindMatches: reply.claimKindCheck.matchesClaim,
    claimedKind: ctx.claim.claimKind,
    supportedKind,
    directionMatches: reply.directionCheck.matchesClaim,
    effectSizeMatches: reply.effectSizeCheck.matchesClaim,
    confidence,
  };
  const caveat = chooseCaveat(caveatInput, reply.caveat, ctx.validateCopy).caveat;

  const record: VerifyRecord = {
    edgeId: ctx.claim.edgeId,
    verdict,
    quoteCheck: ctx.quoteCheck,
    independentRetrieval: { performed: ctx.retrieval.performed, sources },
    corroboration: { supporting, contradicting },
    directionCheck: { matchesClaim: reply.directionCheck.matchesClaim },
    claimKindCheck: {
      matchesClaim: reply.claimKindCheck.matchesClaim,
      supportedKind,
    },
    scopeCheck: { mismatch: reply.scopeCheck.mismatch, supportedPopulation: reply.scopeCheck.supportedPopulation },
    effectSizeCheck: { matchesClaim: reply.effectSizeCheck.matchesClaim, extractedSize: reply.effectSizeCheck.extractedSize },
    evidenceTier,
    confidence,
    dqs: { weight: computeDqsWeight(verdict, confidence, evidenceTier) },
    caveat,
    verifierModel: ctx.verifierModel,
    promptVersion: ctx.promptVersion,
    verifiedAt: ctx.verifiedAt,
    status: 'active',
    ...(ctx.attestation !== undefined ? { attestation: ctx.attestation } : {}),
  };

  // (6) R4-U4/O27 · artifact ref LAST, over the finished record: the content hash
  // pins these exact bytes (attestation included), so any re-verification yields a
  // different hash and retires a revision-bound expert verdict (B-BR7).
  const artifact = buildArtifactRef(record, ctx.artifactRevision, posturefor(ctx.attestation));
  if (artifact !== undefined) record.artifact = artifact;

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
  /** R4-U4/O27 · artifact BUNDLE revision; absent ⇒ no artifact ref (unservable). */
  artifactRevision?: string;
}

/**
 * Build the cheap `quoteCheck`-only record (triage's low-stakes rung): the A9 quote
 * gate ran, but NO independent retrieval and NO verifier LLM — so the verdict is
 * `uncertain` (never served) and corroboration is empty. This is the correct safe
 * default for a well-corroborated, low-impact edge until budget frees up.
 */
export function buildQuoteOnlyRecord(ctx: QuoteOnlyContext): VerifyRecord {
  const evidenceTier = strongestCitationTier(ctx.claim);
  const confidence = 0.3;
  // #300 §E · DERIVED only — no provider spoke on this rung, so there are no model words to
  // prefer. What fired is exactly "not checked independently" (retrieval was never performed).
  const caveat = chooseCaveat(
    {
      retrievalPerformed: false,
      sourceCount: 0,
      supporting: 0,
      contradicting: 0,
      evidenceTier,
      scopeMismatch: false,
      claimKindMatches: false,
      claimedKind: ctx.claim.claimKind,
      supportedKind: ctx.claim.claimKind,
      directionMatches: false,
      effectSizeMatches: false,
      confidence,
    },
    null,
  ).caveat;
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
    evidenceTier,
    confidence,
    dqs: { weight: 0.2 },
    caveat,
    verifierModel: ctx.verifierModel,
    promptVersion: ctx.promptVersion,
    verifiedAt: ctx.verifiedAt,
    status: 'active',
  };
  // R4-U4/O27: NO provider was called on this rung, so posture is 'fixture' and there
  // is no attestation at all — the record is intentionally unservable either way
  // (verdict 'uncertain' AND 'missing-attestation' at the trust gate).
  const artifact = buildArtifactRef(record, ctx.artifactRevision, 'fixture');
  if (artifact !== undefined) record.artifact = artifact;
  return ctx.validateVerification(record); // hard-gate (throws on any violation)
}

/** Strongest evidenceTier among a claim's citations (default 1 when none). */
function strongestCitationTier(claim: SynthClaim): VerifyEvidenceTier {
  let best = 1;
  for (const c of claim.citations) if (c.evidenceTier > best) best = c.evidenceTier;
  return best as VerifyEvidenceTier;
}
