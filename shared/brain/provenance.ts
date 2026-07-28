// shared/brain/provenance.ts
//
// R4-U4 / O27 · Artifact trust posture and scientific claim-strength semantics — the two things
// that must survive UNBROKEN from a stored artifact to a rendered card.
//
// Two independent axes, deliberately kept separate (the register's B-UI9 vs B-SCI1 boundary):
//
//   1. TRUST POSTURE — *where a record came from and whether we can prove it*: the artifact
//      revision + content hash it was loaded from, whether that artifact is a frozen fixture or a
//      live provider run, and what the provider actually RETURNED (model identity/version,
//      family, decorrelation, attestation). A configured model id is NOT attestation (B-BR1).
//
//   2. CLAIM STRENGTH — *how strong a statement the evidence licenses*: the synthesis LLM's
//      `claimKind` and the verifier's independently-judged `supportedKind`. The pair is carried
//      through serving so rendering can never state more than the verifier supports (B-SCI1).
//
// Both axes FAIL CLOSED. A missing posture, a missing attestation, or a fixture artifact on a
// production path BLOCKS serving — it never degrades to a warning, and never falls back to a
// permissive default. Absence of evidence is treated as absence of trust.
//
// Dependency-free TS (no zod, no Deno/Node API) so the Supabase edge functions, the Node tools,
// and the shared typecheck can all import it directly. Runtime validation of these shapes lives
// in relationships.schema.ts; the user-facing WORDS for them live in trust_labels.ts (which is
// TS/Dart parity-guarded, O38).

import type {
  ArtifactPosture,
  ArtifactRef,
  ClaimKind,
  EdgeVerification,
  ModelAttestation,
  RelationshipClaim,
} from './relationships';

// ─── Axis 1 · artifact trust posture ────────────────────────────────────────────────────────
//
// The SHAPES (`ArtifactPosture`, `ArtifactRef`, `ModelAttestation`) live in relationships.ts with
// the rest of the stored contract — they are fields on persisted records, and keeping them there
// avoids a contract↔logic import cycle. They are re-exported here so a consumer that only cares
// about trust evaluation has one import site.

export type { ArtifactPosture, ArtifactRef, ModelAttestation };

// ─── Axis 2 · claim strength ────────────────────────────────────────────────────────────────

// The ladder itself lives in trust_labels.ts — the import-free module the Deno edge functions can
// load — so the serving path and the render path share ONE definition rather than two that could
// drift. Re-exported here so consumers of the serving logic have a single import site.
// This module is NEVER loaded by Deno — the edge functions import trust_labels.ts directly, which
// has no imports at all. That is why extensionless specifiers are correct here: they are what the
// Node/tsc consumers (tools/brain-ingest, tools/edge-loader) require under NodeNext resolution.
export {
  CLAIM_KIND_LADDER,
  claimKindRank,
  effectiveClaimKind,
  parseClaimKind,
} from './trust_labels';

import { effectiveClaimKind as effectiveClaimKindImpl } from './trust_labels';

/**
 * The pair of kinds carried through serving, plus the effective kind rendering must use. Both
 * inputs are retained (never collapsed to just the effective kind) because provenance has to be
 * able to show that synthesis overstated and the verifier caught it.
 */
export interface ClaimKindPosture {
  /** What the synthesis LLM proposed (`RelationshipClaim.claimKind`). */
  claimed: ClaimKind;
  /** What the verifier independently judged supportable (`claimKindCheck.supportedKind`). */
  supported: ClaimKind;
  /** The weaker of the two — the ONLY kind rendering may state. */
  effective: ClaimKind;
  /** True when the verifier had to weaken the synthesised kind. */
  downgraded: boolean;
}

/** Build the serving-side claim-kind posture from a claim and its verification. */
export function claimKindPosture(
  claim: Pick<RelationshipClaim, 'claimKind'>,
  verification: Pick<EdgeVerification, 'claimKindCheck'>,
): ClaimKindPosture {
  const claimed = claim.claimKind;
  const supported = verification.claimKindCheck.supportedKind;
  const effective = effectiveClaimKindImpl(claimed, supported);
  return { claimed, supported, effective, downgraded: effective !== claimed };
}

// ─── Fail-closed trust evaluation (re-exported) ─────────────────────────────────────────────
//
// The IMPLEMENTATION lives in trust_labels.ts — the import-free module a Deno edge function can
// load — so the serving gate and the render path share ONE definition rather than two that could
// drift. It is re-exported here so Node consumers have a single import site for the serving rules.
// trust_labels.ts types its inputs structurally and widened (`posture: string`) because it runs at
// a trust boundary over jsonb; `ArtifactRef` / `ModelAttestation` are assignable to those shapes.

export {
  assertTrustedForServing,
  isTrustedForServing,
  trustFailures,
} from './trust_labels';
export type {
  ServingEnvironment,
  TrustFailure,
  TrustFailureCode,
  TrustInputs,
} from './trust_labels';

// ─── Provenance-chain completeness ──────────────────────────────────────────────────────────

/**
 * The links a served card's provenance chain must have end to end. Each is independently
 * checkable, so a break is reported at the link that broke rather than as one opaque failure.
 */
export interface ProvenanceChain {
  /** The artifact the claim was loaded from. */
  claimArtifact?: ArtifactRef;
  /** The artifact the verification was loaded from. */
  verificationArtifact?: ArtifactRef;
  /** What the verifier provider returned. */
  attestation?: ModelAttestation;
  /** Source + verifier-supported claim kind. */
  claimKind?: ClaimKindPosture;
  /** Paper ids cited by the claim. */
  citedPaperIds: readonly string[];
  /** Paper ids the claim's grounding quote spans address. */
  quotedPaperIds: readonly string[];
}

export type ProvenanceGapCode =
  | 'no-claim-artifact'
  | 'no-verification-artifact'
  | 'no-attestation'
  | 'no-claim-kind'
  | 'no-citations'
  | 'no-quotes'
  | 'quote-cites-foreign-paper'
  | 'posture-mismatch';

export interface ProvenanceGap {
  code: ProvenanceGapCode;
  detail: string;
}

/**
 * Every break in a provenance chain, or an empty array when it is complete.
 *
 * `quote-cites-foreign-paper` is the FOREIGN-PAPER check: a grounding quote that addresses a
 * paper the claim does not cite means the quote was taken from an artifact that is not the cited
 * source, which is exactly the substitution a provenance chain exists to catch.
 *
 * `posture-mismatch` blocks a claim and its verification disagreeing about fixture-vs-live —
 * a live verification of a fixture claim (or the reverse) is a mixed-provenance record whose
 * card could not honestly disclose one posture.
 */
export function provenanceGaps(chain: ProvenanceChain): ProvenanceGap[] {
  const gaps: ProvenanceGap[] = [];

  if (chain.claimArtifact === undefined) {
    gaps.push({ code: 'no-claim-artifact', detail: 'claim has no artifact revision/content hash' });
  }
  if (chain.verificationArtifact === undefined) {
    gaps.push({
      code: 'no-verification-artifact',
      detail: 'verification has no artifact revision/content hash',
    });
  }
  if (chain.attestation === undefined) {
    gaps.push({ code: 'no-attestation', detail: 'verification has no returned-model attestation' });
  }
  if (chain.claimKind === undefined) {
    gaps.push({ code: 'no-claim-kind', detail: 'no source/verifier claim-kind pair was carried' });
  }
  if (chain.citedPaperIds.length === 0) {
    gaps.push({ code: 'no-citations', detail: 'claim cites no sources' });
  }
  if (chain.quotedPaperIds.length === 0) {
    gaps.push({ code: 'no-quotes', detail: 'claim carries no grounding quote spans' });
  }

  const cited = new Set(chain.citedPaperIds);
  for (const paperId of chain.quotedPaperIds) {
    if (!cited.has(paperId)) {
      gaps.push({
        code: 'quote-cites-foreign-paper',
        detail: `quote span addresses paper "${paperId}", which the claim does not cite`,
      });
    }
  }

  if (
    chain.claimArtifact !== undefined &&
    chain.verificationArtifact !== undefined &&
    chain.claimArtifact.posture !== chain.verificationArtifact.posture
  ) {
    gaps.push({
      code: 'posture-mismatch',
      detail:
        `claim posture "${chain.claimArtifact.posture}" != verification posture ` +
        `"${chain.verificationArtifact.posture}"`,
    });
  }

  return gaps;
}

/** True only when the provenance chain has no breaks. */
export function isProvenanceComplete(chain: ProvenanceChain): boolean {
  return provenanceGaps(chain).length === 0;
}

// ─── Exact-quote verification ───────────────────────────────────────────────────────────────

export type QuoteMatchFailure =
  | 'paper-not-cited'
  | 'offsets-missing'
  | 'offsets-out-of-range'
  | 'text-mismatch';

export interface QuoteMatchResult {
  ok: boolean;
  failure?: QuoteMatchFailure;
  detail?: string;
}

/**
 * Deterministic EXACT-quote check: the quote must appear at its recorded offsets in the cited
 * paper's canonical text, verbatim. This is stricter than "the quote appears somewhere" — a
 * quote whose offsets point at different text is a provenance break even when the string occurs
 * elsewhere in the paper, because the recorded locator is what provenance displays.
 *
 * `citedPaperIds` is passed so the FOREIGN-PAPER case is caught here too: verifying a quote
 * against a paper the claim never cited must fail rather than pass on a coincidental match.
 */
export function verifyExactQuote(
  span: { paperId: string; quote: string; charStart: number | null; charEnd: number | null },
  paper: { paperId: string; canonicalText: string },
  citedPaperIds: readonly string[],
): QuoteMatchResult {
  if (span.paperId !== paper.paperId) {
    return {
      ok: false,
      failure: 'paper-not-cited',
      detail: `span addresses "${span.paperId}" but was checked against "${paper.paperId}"`,
    };
  }
  if (!citedPaperIds.includes(span.paperId)) {
    return {
      ok: false,
      failure: 'paper-not-cited',
      detail: `paper "${span.paperId}" is not cited by the claim`,
    };
  }
  if (span.charStart === null || span.charEnd === null) {
    return {
      ok: false,
      failure: 'offsets-missing',
      detail: `span in "${span.paperId}" has no character offsets to verify against`,
    };
  }
  if (
    span.charStart < 0 ||
    span.charEnd > paper.canonicalText.length ||
    span.charStart >= span.charEnd
  ) {
    return {
      ok: false,
      failure: 'offsets-out-of-range',
      detail: `span ${span.charStart}-${span.charEnd} is not inside 0-${paper.canonicalText.length}`,
    };
  }
  const actual = paper.canonicalText.slice(span.charStart, span.charEnd);
  if (actual !== span.quote) {
    return {
      ok: false,
      failure: 'text-mismatch',
      detail: `text at ${span.charStart}-${span.charEnd} does not match the recorded quote verbatim`,
    };
  }
  return { ok: true };
}

// ─── Revision-bound expert disposition (B-BR7) ──────────────────────────────────────────────

/** An expert's recorded disposition toward an edge. */
export type ExpertDisposition = 'accepted' | 'rejected' | 'pending' | 'unavailable';

/**
 * A recorded expert decision, bound to the ARTIFACT it was made about — not to the relation key
 * alone. B-BR7: a relation-key-only verdict silently carries over to a rebuilt or re-synthesised
 * claim the expert never saw, which can poison a future claim. Binding to revision + content hash
 * means a rebuild that changes the claim retires the disposition instead of inheriting it.
 */
export interface ExpertVerdictRecord {
  edgeId: string;
  disposition: Exclude<ExpertDisposition, 'pending' | 'unavailable'>;
  /** Artifact revision the expert was looking at. */
  artifactRevision: string;
  /** Content hash of the exact claim bytes the expert judged. */
  artifactContentHash: string;
  decidedAt: string;
  decidedBy: string;
}

export type DispositionStatus =
  /** The verdict was made about exactly this artifact — it applies. */
  | 'current'
  /** A verdict exists, but for different artifact bytes — it does NOT apply (needs re-review). */
  | 'stale-revision'
  /** No verdict has been recorded for this edge at all. */
  | 'none';

export interface ResolvedDisposition {
  disposition: ExpertDisposition;
  status: DispositionStatus;
  /** The record consulted, when one existed — retained as labelled, superseded history (B-UI3). */
  record: ExpertVerdictRecord | null;
}

/**
 * Resolve which expert disposition applies to the artifact currently being served.
 *
 * FAIL CLOSED in the direction that matters: a verdict recorded against DIFFERENT artifact bytes
 * never carries over as `accepted`. It resolves to `pending` with status `stale-revision`, so a
 * rebuilt claim must be re-reviewed rather than inheriting approval it never received. A stale
 * `rejected` is likewise not silently applied — it is surfaced as history, and the caller decides
 * (the serving path keeps excluding the edge; see the migration's serving overlay).
 */
export function resolveDisposition(
  current: ArtifactRef | undefined,
  record: ExpertVerdictRecord | null,
): ResolvedDisposition {
  if (record === null) return { disposition: 'pending', status: 'none', record: null };
  if (current === undefined) {
    // We cannot prove the verdict was about this artifact, so it does not apply.
    return { disposition: 'pending', status: 'stale-revision', record };
  }
  const sameArtifact =
    record.artifactRevision === current.revision &&
    record.artifactContentHash === current.contentHash;
  return sameArtifact
    ? { disposition: record.disposition, status: 'current', record }
    : { disposition: 'pending', status: 'stale-revision', record };
}
