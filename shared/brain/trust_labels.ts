// shared/brain/trust_labels.ts
//
// R4-U4 / O27 + O38 · The USER-FACING WORDS for artifact trust posture and claim strength.
// This file is the single source of truth; `trust_labels.dart` is its hand-maintained mirror and
// `apps/biotope/test/guards/brain_trust_labels_parity_test.dart` fails if the two drift.
//
// O38 — parity WITHOUT a cross-language import. `shared/` is the only cross-language seam, and a
// Dart file may not import TypeScript, so the two files are kept identical by an executable
// guard rather than by a build step or a direct import. To keep that guard simple and total,
// BOTH files quote every map key and list every entry in the same order — the guard compares the
// ordered sequence of string literals inside each named constant. If you add an entry here, add
// it to the Dart mirror in the same position.
//
// ── B-SCI2 vocabulary rules encoded here ──
//
//  1. "evidence tier" is renamed STUDY-DESIGN TIER everywhere a user can see it. The old name
//     invited reading a study-design proxy as an appraisal of the evidence itself.
//  2. The composite rank (`edgeScore`) is NEVER called confidence or certainty. It is an
//     uncalibrated PROTOTYPE SUPPORT RANK — it orders edges and means nothing else
//     (shared/brain/index.ts EDGE_GATES documents why: the gates have no published basis and no
//     calibration to any external probability).
//  3. Ordinary users do not see the numeric rank at all; they see a band word. Any surface that
//     does show the number must show `supportRankDisclosure` beside it.
//  4. Every surface that shows a rank or a tier also states that CERTAINTY IS NOT ASSESSED.
//
// The study-design ladder below is THIS REPO'S OWN definition (relationships.ts `EvidenceTier`).
// It is deliberately NOT derived from MEDLINE PublicationType, BioRED, or Cochrane Crowd — see
// docs/memory/0017: those three dataset assumptions are wrong, and in particular
// PublicationType cannot express this ladder at all.
//
// All copy here must pass shared/constants/copy_guidelines validateCopyString (non-diagnostic
// language, docs/memory/0003) — the render-time gate re-checks the final filled text anyway.

// ── Why this file has NO imports ──
// The Supabase edge functions import it directly (Deno), exactly as they already import
// shared/constants/copy_guidelines.ts. Deno resolves module specifiers literally, and the rest of
// shared/brain uses extensionless imports that Deno cannot resolve — so importing the contract
// types here would make this file un-loadable from an edge function. It therefore restates the
// handful of string unions it labels, and `trust_labels.typetest.ts` asserts at compile time that
// each restated union is EXACTLY the contract union. Drift fails `tsc`, so the copy is guarded,
// not trusted.

/** Mirror of `relationships.ClaimKind` — pinned by trust_labels.typetest.ts. */
export type TrustLabelClaimKind = 'causal' | 'correlational' | 'mechanistic';
/** Mirror of `relationships.RelationKind` — pinned by trust_labels.typetest.ts. */
export type TrustLabelRelationKind =
  | 'increases'
  | 'decreases'
  | 'modulates'
  | 'correlates'
  | 'confounds'
  | 'no_effect';
/** Mirror of `relationships.Verdict` — pinned by trust_labels.typetest.ts. */
export type TrustLabelVerdict =
  | 'supported'
  | 'partial'
  | 'unsupported'
  | 'contradicted'
  | 'uncertain';
/** Mirror of `relationships.EvidenceTier` — pinned by trust_labels.typetest.ts. */
export type TrustLabelStudyDesignTier = 1 | 2 | 3 | 4 | 5;
/** Mirror of `relationships.ArtifactPosture` — pinned by trust_labels.typetest.ts. */
export type TrustLabelPosture = 'fixture' | 'live';
/** Mirror of `provenance.ExpertDisposition` — pinned by trust_labels.typetest.ts. */
export type TrustLabelDisposition = 'accepted' | 'rejected' | 'pending' | 'unavailable';
/** Mirror of `provenance.DispositionStatus` — pinned by trust_labels.typetest.ts. */
export type TrustLabelDispositionStatus = 'current' | 'stale-revision' | 'none';

// ─── Claim strength ─────────────────────────────────────────────────────────────────────────

/**
 * The claim-strength ladder, weakest first. Rendering may never state a kind stronger than the
 * verifier supports, so the ladder needs a total order: an association is the weakest thing the
 * data can say, a proposed mechanism adds an explanation, and a causal claim is the strongest.
 *
 * This lives in the import-free file (rather than in provenance.ts, where the rest of the
 * serving logic sits) because the Supabase edge functions need it at render time and can only
 * import a module with no further specifiers to resolve. provenance.ts re-exports it, so there
 * is still exactly one definition.
 */
export const CLAIM_KIND_LADDER: readonly TrustLabelClaimKind[] = [
  'correlational',
  'mechanistic',
  'causal',
];

/** Position on the ladder; higher = stronger claim. */
export function claimKindRank(kind: TrustLabelClaimKind): number {
  const rank = CLAIM_KIND_LADDER.indexOf(kind);
  // A kind outside the ladder is a contract violation, not a rendering decision — fail closed
  // rather than silently ranking it weakest, which would let an unknown kind render as safe.
  if (rank < 0) throw new Error(`claimKindRank: unknown claim kind "${kind}"`);
  return rank;
}

/**
 * The claim kind a card may actually state: the WEAKER of what synthesis proposed and what the
 * verifier independently found supportable. This is the B-SCI1 fix in one function — a
 * `correlational` verifier judgment caps a `causal` synthesis claim at `correlational`, so
 * "associated with higher" can never be rendered as "raises".
 */
export function effectiveClaimKind(
  claimed: TrustLabelClaimKind,
  supported: TrustLabelClaimKind,
): TrustLabelClaimKind {
  return claimKindRank(supported) < claimKindRank(claimed) ? supported : claimed;
}

/**
 * Parse an untrusted claim-kind string (from jsonb at a trust boundary) into a contract value,
 * or null when it is absent/unrecognised. Callers MUST fail closed on null — a card whose claim
 * kind cannot be established may not be rendered with directional wording.
 */
export function parseClaimKind(value: unknown): TrustLabelClaimKind | null {
  return typeof value === 'string' && (CLAIM_KIND_LADDER as readonly string[]).includes(value)
    ? (value as TrustLabelClaimKind)
    : null;
}

/**
 * What each claim kind means to a reader. These are the words a card may use ABOUT a claim; the
 * words used INSIDE a sentence are `RELATION_PHRASES`.
 */
export const CLAIM_KIND_LABELS = {
  'correlational': 'Observed association',
  'mechanistic': 'Proposed mechanism',
  'causal': 'Reported causal effect',
} as const satisfies Record<TrustLabelClaimKind, string>;

/** One-line plain-language expansion, for progressive disclosure under the label. */
export const CLAIM_KIND_DESCRIPTIONS = {
  'correlational': 'These moved together in the research. Direction of influence was not established.',
  'mechanistic': 'A plausible biological route was proposed. Effects in people were not established.',
  'causal': 'The research reports one changing the other, under the study conditions stated.',
} as const satisfies Record<TrustLabelClaimKind, string>;

/**
 * THE B-SCI1 FIX. The verb phrase a card may use for a monotonic relation, keyed by the
 * EFFECTIVE claim kind (see provenance.ts `effectiveClaimKind` — the weaker of the synthesised
 * and verifier-supported kinds).
 *
 * Only `causal` gets a directional verb. `correlational` gets association wording and
 * `mechanistic` gets explicitly hedged mechanism wording, so a correlational edge can no longer
 * be rendered as "tends to raise" — which is exactly the inflation B-SCI1 records.
 *
 * Non-monotonic relations (`modulates`, `correlates`, `confounds`, `no_effect`) are absent on
 * purpose: they may never carry a directional phrase (architecture §1.3), and a lookup miss must
 * fail loudly rather than fall back to a directional default.
 */
export const RELATION_PHRASES = {
  'correlational': {
    'increases': 'is associated with higher',
    'decreases': 'is associated with lower',
  },
  'mechanistic': {
    'increases': 'has a proposed route to higher',
    'decreases': 'has a proposed route to lower',
  },
  'causal': {
    'increases': 'tends to raise',
    'decreases': 'tends to lower',
  },
} as const;

/**
 * Verbs and phrases that assert one thing changing another. A rendered card whose effective
 * claim kind is not `causal` must contain NONE of these — enforced by `containsCausalLanguage`
 * and, at render time, by the causal-verb copy gate.
 *
 * Entries are lowercase and matched on word boundaries, with an optional trailing `s`/`es`, so
 * "raises" trips on "raise" while benign words that merely CONTAIN one do not ("increasingly"
 * is not matched by "increase", because `\b` will not anchor mid-word).
 *
 * Two deliberate omissions, both load-bearing:
 *   * bare `lower` is absent — it is the comparative ADJECTIVE in this vocabulary's own
 *     non-causal phrasing ("is associated with lower"), so listing it would make correlational
 *     copy fail the very gate that is supposed to permit it. The verb forms `lowers` /
 *     `lowering` and the explicit causal template phrase `tends to lower` are listed instead.
 *   * bare `higher` is not a verb in any form and is absent for the same reason.
 *
 * The list is otherwise deliberately CONSERVATIVE: a noun use ("an increase in") also trips it.
 * That is the safe direction — a false positive drops one card, a false negative ships causal
 * copy for a correlational finding.
 */
export const CAUSAL_VERBS: readonly string[] = [
  'cause',
  'caused',
  'causing',
  'raise',
  'raised',
  'raising',
  'lowers',
  'lowered',
  'lowering',
  'increase',
  'increased',
  'increasing',
  'decrease',
  'decreased',
  'decreasing',
  'reduce',
  'reduced',
  'reducing',
  'boost',
  'boosted',
  'boosting',
  'trigger',
  'triggered',
  'triggering',
  'improve',
  'improved',
  'improving',
  'worsen',
  'worsened',
  'worsening',
  'prevent',
  'prevented',
  'preventing',
  'leads to',
  'led to',
  'results in',
  'resulted in',
  'brings on',
  'makes you',
  'tends to lower',
];

// ─── Artifact trust posture ─────────────────────────────────────────────────────────────────

/** What a card says about where its underlying artifact came from (B-UI9). */
export const POSTURE_LABELS = {
  'fixture': 'Demo fixture',
  'live': 'Live source',
} as const satisfies Record<TrustLabelPosture, string>;

/**
 * The disclosure that must appear BEFORE the claim on any card derived from a fixture artifact
 * (B-UI9: "card-level demo fixture + simulated-data disclosure before the claim").
 */
export const POSTURE_DISCLOSURES = {
  'fixture': 'Demo fixture — built from stored sample data, not a live source.',
  'live': 'Built from a live source run.',
} as const satisfies Record<TrustLabelPosture, string>;

/** Whether the returned model identity was proven or merely configured (B-BR1). */
export const ATTESTATION_LABELS = {
  'attested': 'Model identity returned by the provider',
  'unattested': 'Model identity not confirmed by the provider',
} as const;

/** Whether the checking model came from a different family than the proposing one (O7). */
export const DECORRELATION_LABELS = {
  'decorrelated': 'Checked by a different model family',
  'correlated': 'Checked by the same model family',
} as const;

// ─── Study-design tier (renamed from "evidence tier" — B-SCI2) ──────────────────────────────

/** The user-facing NAME of the ladder. Never "evidence tier", never "quality". */
export const STUDY_DESIGN_TIER_NAME = 'Study-design tier';

/** What each rung of the ladder is, in plain words. */
export const STUDY_DESIGN_TIER_LABELS = {
  '1': 'Laboratory or mechanism study',
  '2': 'Cross-sectional or observational study',
  '3': 'Cohort or long-term follow-up study',
  '4': 'Randomised trial',
  '5': 'Review across many studies',
} as const satisfies Record<`${TrustLabelStudyDesignTier}`, string>;

/** Said wherever a tier is shown: the tier describes the DESIGN, not the truth of the finding. */
export const STUDY_DESIGN_TIER_DISCLOSURE =
  'Describes how the research was designed, not how certain the finding is.';

// ─── Support rank (never "confidence", never "certainty" — B-SCI2) ──────────────────────────

/** The user-facing NAME of the composite rank. */
export const SUPPORT_RANK_NAME = 'Prototype support rank';

/**
 * The band words ordinary users see INSTEAD of the number. `hold` is included so the vocabulary
 * is total, though a held edge is never surfaced as a card.
 */
export const SUPPORT_BAND_LABELS = {
  'high': 'More supporting research',
  'mid': 'Limited supporting research',
  'hold': 'Not enough supporting research',
} as const;

/** Required beside any surface that exposes the NUMERIC rank (reviewer/expert surfaces only). */
export const SUPPORT_RANK_DISCLOSURE =
  'Prototype support rank — an uncalibrated ordering used to sort research links. ' +
  'It is not a probability and does not measure how well established a finding is.';

/** Required on every surface that shows a rank or a tier. The single sentence B-SCI2 mandates. */
export const CERTAINTY_NOT_ASSESSED = 'Certainty is not assessed.';

// ─── Verifier verdicts and expert disposition ───────────────────────────────────────────────

/** Plain-language verdict words. */
export const VERDICT_LABELS = {
  'supported': 'Backed by the sources checked',
  'partial': 'Partly backed by the sources checked',
  'unsupported': 'No supporting sources found',
  'contradicted': 'Sources point the other way',
  'uncertain': 'Could not be checked',
} as const satisfies Record<TrustLabelVerdict, string>;

/** Current expert disposition, shown prominently on provenance (B-UI3). */
export const DISPOSITION_LABELS = {
  'accepted': 'Accepted by a reviewer',
  'rejected': 'Rejected by a reviewer',
  'pending': 'Not yet reviewed',
  'unavailable': 'Review status unavailable',
} as const satisfies Record<TrustLabelDisposition, string>;

/**
 * Why a disposition reads as it does. `stale-revision` is the B-BR7 case: a reviewer's decision
 * was about DIFFERENT artifact bytes, so it does not carry over to what is being shown now.
 */
export const DISPOSITION_STATUS_LABELS = {
  'current': 'Reviewed for this version of the research link.',
  'stale-revision': 'An earlier review applied to a previous version and no longer applies.',
  'none': 'No reviewer decision has been recorded.',
} as const satisfies Record<TrustLabelDispositionStatus, string>;

// ─── Interim / held outputs ─────────────────────────────────────────────────────────────────

/**
 * An INTERIM result is a stand-in, not a finding. It may never set a serving band, bypass a
 * deterministic gate, or be shown as final — so it gets its own vocabulary rather than borrowing
 * a verdict word.
 */
export const INTERIM_LABEL = 'Interim — held';
export const INTERIM_DISCLOSURE =
  'A stand-in step produced this. It is on hold and is not served as a finding.';

// ─── Lookup helpers (fail loudly, never silently default) ───────────────────────────────────

/**
 * The verb phrase for a monotonic relation at a given effective claim kind. Throws for a
 * non-monotonic relation or an unknown kind: a missing phrase must surface as a bug, never fall
 * back to directional wording (that fallback is precisely how B-SCI1's inflation happened).
 */
export function relationPhraseFor(kind: TrustLabelClaimKind, relation: TrustLabelRelationKind): string {
  const byRelation = (RELATION_PHRASES as Record<string, Record<string, string> | undefined>)[kind];
  if (byRelation === undefined) {
    throw new Error(`relationPhraseFor: unknown claim kind "${kind}"`);
  }
  const phrase = byRelation[relation];
  if (phrase === undefined) {
    throw new Error(
      `relationPhraseFor: relation "${relation}" is not monotonic and cannot carry a directional phrase`,
    );
  }
  return phrase;
}

/** Word-boundary matcher for a causal term, allowing a trailing plural/3rd-person `s`. */
function causalTermPattern(term: string): RegExp {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}(?:e?s)?\\b`);
}

/** Every causal term present in `text` (lowercased match), in `CAUSAL_VERBS` order. */
export function causalTermsIn(text: string): string[] {
  const lower = text.toLowerCase();
  return CAUSAL_VERBS.filter((term) => causalTermPattern(term).test(lower));
}

/** True when `text` asserts one thing changing another. */
export function containsCausalLanguage(text: string): boolean {
  return causalTermsIn(text).length > 0;
}

/**
 * THE CAUSAL-VERB COPY GATE. Rendered copy is admissible only if its causal language is licensed
 * by the effective claim kind: anything weaker than `causal` must contain no causal verb at all.
 *
 * Returns the offending terms so a failure names what tripped it. An empty array means the copy
 * passed — callers must treat a non-empty result as a DROP, never as a warning.
 */
export function causalCopyViolations(text: string, effectiveKind: TrustLabelClaimKind): string[] {
  if (effectiveKind === 'causal') return [];
  return causalTermsIn(text);
}

/** The user-facing study-design tier label for a tier number. */
export function studyDesignTierLabel(tier: TrustLabelStudyDesignTier): string {
  const label = (STUDY_DESIGN_TIER_LABELS as Record<string, string | undefined>)[String(tier)];
  if (label === undefined) throw new Error(`studyDesignTierLabel: unknown tier "${tier}"`);
  return label;
}

// ─── Fail-closed artifact trust gate ────────────────────────────────────────────────────────
//
// This lives HERE, in the import-free module, rather than in provenance.ts with the rest of the
// serving logic, for one concrete reason: the Supabase edge function needs it at serve time, and
// a Deno edge function can only load a module with no further specifiers to resolve. provenance.ts
// re-exports every symbol below, so Node consumers still have one import site and there is exactly
// ONE implementation.
//
// The input types are deliberately STRUCTURAL and widened (`posture: string`, not the union):
// this function runs at a trust boundary over values parsed from jsonb, where anything can
// arrive, and validating the posture string is part of its job. The contract types
// (`ArtifactRef` / `ModelAttestation`) are assignable to these, so provenance.ts's typed
// re-export is exact.

/**
 * The trust posture of the path a record is being served INTO. `production` is the strict path;
 * `demo` and `development` permit fixtures because showing fixture-derived cards is the entire
 * point of a demo — with the fixture disclosed on the card (B-UI9), never silently.
 */
export type ServingEnvironment = 'development' | 'demo' | 'production';

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
  /** Operator-facing detail. NOT user-facing copy — the labels above are that. */
  detail: string;
}

/**
 * The provenance inputs the trust evaluation reads. Both are optional so LEGACY records — which
 * predate these fields — are evaluated as what they are: untrusted, and blocked on any path that
 * requires trust.
 */
export interface TrustInputs {
  artifact?: { revision: string; contentHash: string; posture: string };
  attestation?: {
    returnedModel: string;
    returnedVersion: string | null;
    family: string;
    decorrelated: boolean;
    attested: boolean;
  };
}

/** `sha256:` + 64 lowercase hex characters. Anything else is not a usable content hash. */
const CONTENT_HASH_RE = /^sha256:[0-9a-f]{64}$/;

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
