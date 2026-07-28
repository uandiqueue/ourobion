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

/**
 * The trust posture of the path a record is being served INTO. `production` is the strict path;
 * `demo` and `development` permit fixtures because showing fixture-derived cards is the entire
 * point of a demo — with the fixture disclosed on the card (B-UI9), never silently.
 */
export type ServingEnvironment = 'development' | 'demo' | 'production';

// ─── Axis 2 · claim strength ────────────────────────────────────────────────────────────────

// The ladder itself lives in trust_labels.ts — the import-free module the Deno edge functions can
// load — so the serving path and the render path share ONE definition rather than two that could
// drift. Re-exported here so consumers of the serving logic have a single import site.
// NOTE the explicit `.ts` extensions on the two VALUE imports below. They are what lets a Deno
// edge function load this module: Deno resolves specifiers literally and cannot follow an
// extensionless one. The type-only imports above need no extension because `import type` is
// erased before the module graph is built. `allowImportingTsExtensions` in shared/tsconfig.json
// (safe under `noEmit`) is what keeps `tsc` happy with the same spelling.
export {
  CLAIM_KIND_LADDER,
  claimKindRank,
  effectiveClaimKind,
  parseClaimKind,
} from './trust_labels.ts';

import { effectiveClaimKind as effectiveClaimKindImpl } from './trust_labels.ts';

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

// ─── Fail-closed trust evaluation ───────────────────────────────────────────────────────────

/** A machine-readable reason a record may not be served. Every value BLOCKS; none is a warning. */
export type TrustFailureCode =
  | 'missing-artifact-ref'
  | 'missing-posture'
  | 'malformed-content-hash'
  | 'fixture-in-production'
  | 'missing-attestation'
  | 'unattested-model'
  | 'correlated-verifier-in-production';

export interface TrustFailure {
  code: TrustFailureCode;
  /** Operator-facing detail. NOT user-facing copy — see trust_labels.ts for that. */
  detail: string;
}

/** `sha256:` + 64 lowercase hex characters. Anything else is not a usable content hash. */
const CONTENT_HASH_RE = /^sha256:[0-9a-f]{64}$/;

/** The provenance inputs the trust evaluation reads. Both are optional so LEGACY records —
 *  which predate these fields — are evaluated as what they are: untrusted, and blocked on any
 *  path that requires trust. */
export interface TrustInputs {
  artifact?: ArtifactRef;
  attestation?: ModelAttestation;
}

/**
 * Every reason this record may not be served into `environment`, or an empty array when it is
 * clean. FAIL CLOSED by construction: absence of a field is a failure, never a pass.
 *
 * `production` additionally rejects fixture-derived records and non-decorrelated verifiers. Those
 * two rules are inert in Run 4 (no production serving is authorized) but are written now so the
 * gate exists before the path does, rather than being added under pressure later.
 */
export function trustFailures(
  inputs: TrustInputs,
  environment: ServingEnvironment,
): TrustFailure[] {
  const failures: TrustFailure[] = [];
  const production = environment === 'production';

  const artifact = inputs.artifact;
  if (artifact === undefined) {
    failures.push({
      code: 'missing-artifact-ref',
      detail: 'record carries no artifact revision/content hash — provenance chain is broken',
    });
  } else {
    // An empty-string posture cannot occur in typed code, but this function also guards records
    // parsed from JSON at a trust boundary, where anything can arrive.
    if (artifact.posture !== 'fixture' && artifact.posture !== 'live') {
      failures.push({
        code: 'missing-posture',
        detail: `artifact posture must be 'fixture' or 'live', got ${JSON.stringify(artifact.posture)}`,
      });
    }
    if (!CONTENT_HASH_RE.test(artifact.contentHash)) {
      failures.push({
        code: 'malformed-content-hash',
        detail: `contentHash must match sha256:<64 hex>, got ${JSON.stringify(artifact.contentHash)}`,
      });
    }
    if (production && artifact.posture === 'fixture') {
      failures.push({
        code: 'fixture-in-production',
        detail: `fixture-derived artifact ${artifact.revision} may never be served on a production path`,
      });
    }
  }

  const attestation = inputs.attestation;
  if (attestation === undefined) {
    failures.push({
      code: 'missing-attestation',
      detail: 'record carries no model attestation — returned model identity is unknown',
    });
  } else {
    if (!attestation.attested) {
      failures.push({
        code: 'unattested-model',
        detail: `model "${attestation.returnedModel}" is recorded but not provider-attested (a configured id is not attestation)`,
      });
    }
    if (production && !attestation.decorrelated) {
      failures.push({
        code: 'correlated-verifier-in-production',
        detail: `verifier family "${attestation.family}" is not decorrelated from synthesis`,
      });
    }
  }

  return failures;
}

/**
 * True only when a record has a complete, verifiable provenance chain for `environment`.
 * The negation of "has any failure" — there is no partial-trust state on purpose.
 */
export function isTrustedForServing(
  inputs: TrustInputs,
  environment: ServingEnvironment,
): boolean {
  return trustFailures(inputs, environment).length === 0;
}

/**
 * Assert servability, throwing with every reason at once. Call sites that must not proceed on an
 * untrusted record use this so the failure is loud and complete rather than a silent filter.
 */
export function assertTrustedForServing(
  inputs: TrustInputs,
  environment: ServingEnvironment,
): void {
  const failures = trustFailures(inputs, environment);
  if (failures.length > 0) {
    throw new Error(
      `artifact trust check failed for ${environment}: ` +
        failures.map((f) => `${f.code} (${f.detail})`).join('; '),
    );
  }
}

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
