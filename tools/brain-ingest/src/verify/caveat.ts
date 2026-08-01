/**
 * A10 · #300 §E · The `caveat` on an EdgeVerification — approve-with-caveat.
 *
 * WHY THIS MODULE EXISTS. `caveat` landed in the contract (`shared/brain/relationships.ts`,
 * `relationships.schema.ts`) and in the DB (`edge_verifications.caveat`), but NOTHING ever
 * populated it: a live Agnes run wrote 7 records with no `caveat` key at all. Low credibility was
 * therefore only expressible as a `uncertain` verdict — i.e. as silence on the card — which is
 * exactly what §E forbids. Limitations must be SURFACED, not converted into a shrug.
 *
 * THE HONESTY CONTRACT OF THIS FILE, in order of importance:
 *
 *   1. A caveat NAMES A LIMITATION THAT ACTUALLY FIRED. Every flag below is a pure read of a
 *      field the record already carries AFTER enforcement (`enforce.ts` re-derives those fields
 *      from the retrieval we performed — the LLM cannot move them). So a caveat can never assert
 *      a limitation the record itself does not evidence.
 *   2. NO FLAG FIRED ⇒ `null`, never a reassuring sentence. The UI renders a caveat as a real
 *      qualification; a caveat that says nothing is worse than no caveat, because it spends the
 *      user's attention on noise and teaches them to ignore the field.
 *   3. THE MODEL'S OWN WORDS ARE PREFERRED BUT NEVER TRUSTED. `chooseCaveat` accepts the
 *      verifier's text only when (a) at least one flag actually fired, (b) the text passes the
 *      shared copy gate, and (c) the text lexically CORROBORATES at least one fired flag. Text
 *      that names something we did not measure falls back to the derived sentence. See
 *      {@link chooseCaveat} for the residual limitation this does not close.
 *   4. QUALITY-OF-BACKING flags (tier, population, direction, effect size, claim kind) fire ONLY
 *      when there is backing to describe — either a retrieved supporting source (`supporting >= 1`)
 *      or the CITED PAPER itself (`citedPaperAssessed`, i.e. its verbatim quotes were shown to the
 *      verifier and the quote gate passed). With neither, those checks are the model's ungrounded
 *      opinion and the absence flag is the honest statement.
 *
 *      `citedPaperAssessed` exists because the verdict is now a single-paper faithfulness judgement
 *      (owner instruction 2026-08-01): population, direction, effect size and claim kind are read
 *      against the cited paper, so gating them on OTHER studies corroborating would hide exactly the
 *      limitations the verdict was reasoned over. Optional and defaulting to false, so the producers
 *      where no model saw the paper (the quoteCheck-only rung, the unenforceable-reply fallback) keep
 *      claiming nothing about backing.
 *
 * The derived sentences are USER-FACING CARD COPY, so they are plain-language and pass
 * `validateCopyString` (memory 0003 — no diagnostic language). `tests/caveat.test.ts` asserts
 * every one of them against the REAL shared gate, so a reworded sentence cannot drift into
 * language the contract would reject at append time.
 *
 * ESM / NodeNext — imports use explicit `.js` extensions.
 */

import type { CopyValidator } from '../synth/load.js';
import type { VerifyClaimKind, VerifyEvidenceTier } from './types.js';

/**
 * One named limitation. Each is a pure predicate over the ENFORCED record fields — never over the
 * LLM reply directly — so it cannot describe something the record does not show.
 */
export type CaveatFlag =
  | 'not-checked-independently'
  | 'no-sources-retrieved'
  | 'no-supporting-source'
  | 'contradicting-source'
  | 'single-supporting-source'
  | 'claim-kind-mismatch'
  | 'population-mismatch'
  | 'mechanistic-evidence'
  | 'observational-evidence'
  | 'direction-unconfirmed'
  | 'effect-size-unconfirmed'
  | 'low-confidence';

/**
 * The already-enforced record facts the flags read. Deliberately a flat value object rather than
 * the record itself: it is built at ONE call site per producer, from the record's own fields, so
 * the caveat and the record can never describe different runs.
 */
export interface CaveatInput {
  /** `independentRetrieval.performed`. */
  retrievalPerformed: boolean;
  /**
   * True when the CITED paper's verbatim quotes were shown to the verifier and the deterministic
   * quote gate passed — i.e. the check blocks below are a judgement about a real, quoted paper.
   * Optional (default false) so producers that never showed a paper to a model claim nothing.
   */
  citedPaperAssessed?: boolean;
  /** `independentRetrieval.sources.length`. */
  sourceCount: number;
  /** `corroboration.supporting` (re-derived from retrieved stances, not the reply). */
  supporting: number;
  /** `corroboration.contradicting` (likewise re-derived). */
  contradicting: number;
  /** `evidenceTier` of the record (strongest SUPPORTING source when there is one). */
  evidenceTier: VerifyEvidenceTier;
  /** `scopeCheck.mismatch`. */
  scopeMismatch: boolean;
  /** `claimKindCheck.matchesClaim`. */
  claimKindMatches: boolean;
  /** The kind the CLAIM asserts (from the claim, not the reply). */
  claimedKind: VerifyClaimKind;
  /** `claimKindCheck.supportedKind` — the kind the evidence actually supports. */
  supportedKind: VerifyClaimKind;
  /** `directionCheck.matchesClaim`. */
  directionMatches: boolean;
  /** `effectSizeCheck.matchesClaim`. */
  effectSizeMatches: boolean;
  /** `confidence` (0..1), post-clamp. */
  confidence: number;
}

/**
 * Below this the verifier's own stated confidence is itself a limitation worth surfacing. Not a
 * gate on anything — no verdict, spend or serving decision reads it — so it cannot be "tuned" to
 * obtain an approval. It only decides whether one extra sentence appears.
 */
export const LOW_CONFIDENCE_CAVEAT_THRESHOLD = 0.5;

/**
 * At most this many derived sentences are joined into one caveat. A card has room for a
 * qualification, not a report; the FULL set of fired limitations stays readable off the record's
 * own fields (`corroboration`, `evidenceTier`, `scopeCheck`, …), which are what a reviewer reads.
 * Ordering is by severity (see {@link CAVEAT_SEVERITY_ORDER}), so the sentences that survive the
 * cap are the strongest ones, never an arbitrary subset.
 */
export const MAX_CAVEAT_SENTENCES = 2;

/** Most-severe first. The cap keeps a PREFIX of this order, so nothing worse is ever dropped. */
export const CAVEAT_SEVERITY_ORDER: readonly CaveatFlag[] = [
  'not-checked-independently',
  'no-sources-retrieved',
  'no-supporting-source',
  'contradicting-source',
  'single-supporting-source',
  'claim-kind-mismatch',
  'population-mismatch',
  'mechanistic-evidence',
  'observational-evidence',
  'direction-unconfirmed',
  'effect-size-unconfirmed',
  'low-confidence',
];

/**
 * Which limitations actually fired for this record, most severe first.
 *
 * The four "absence" flags are mutually exclusive and describe the corroboration we hold; the
 * quality-of-backing flags describe the WEAKNESSES of what backs the claim — a retrieved supporting
 * source or the cited paper itself — and are gated on there being backing at all (file header, 4).
 */
export function firedCaveatFlags(input: CaveatInput): CaveatFlag[] {
  const fired = new Set<CaveatFlag>();

  // ── Corroboration we hold (exactly one of these, or none when supporting >= 2) ──
  if (!input.retrievalPerformed) {
    fired.add('not-checked-independently');
  } else if (input.sourceCount === 0) {
    fired.add('no-sources-retrieved');
  } else if (input.supporting === 0) {
    fired.add('no-supporting-source');
  } else if (input.supporting === 1) {
    fired.add('single-supporting-source');
  }

  // Independent of the above: disagreement is worth saying even alongside support.
  if (input.contradicting >= 1) fired.add('contradicting-source');

  // ── Weaknesses OF the backing — only meaningful when backing exists ──
  // Backing = a retrieved supporting source OR the cited paper the verifier actually read.
  if (input.supporting >= 1 || input.citedPaperAssessed === true) {
    if (!input.claimKindMatches) fired.add('claim-kind-mismatch');
    if (input.scopeMismatch) fired.add('population-mismatch');
    if (input.evidenceTier === 1) fired.add('mechanistic-evidence');
    else if (input.evidenceTier === 2) fired.add('observational-evidence');
    if (!input.directionMatches) fired.add('direction-unconfirmed');
    if (!input.effectSizeMatches) fired.add('effect-size-unconfirmed');
  }

  if (input.confidence < LOW_CONFIDENCE_CAVEAT_THRESHOLD) fired.add('low-confidence');

  return CAVEAT_SEVERITY_ORDER.filter((f) => fired.has(f));
}

/**
 * The derived sentence for one flag. User-facing card copy: plain language, no diagnostic terms,
 * and it states the limitation rather than softening it. `claim-kind-mismatch` is the one flag
 * whose wording depends on WHICH inflation happened, so it takes the input.
 */
export function caveatSentence(flag: CaveatFlag, input: CaveatInput): string {
  switch (flag) {
    case 'not-checked-independently':
      return 'This has not been checked against other studies yet.';
    case 'no-sources-retrieved':
      return 'No other studies were found to check this against.';
    case 'no-supporting-source':
      return 'The other studies found did not back this up.';
    case 'contradicting-source':
      return 'At least one other study points the other way.';
    case 'single-supporting-source':
      return 'Only one other study backed this up.';
    case 'claim-kind-mismatch':
      return input.claimedKind === 'causal' && input.supportedKind !== 'causal'
        ? 'The evidence shows a link, not a proven cause.'
        : 'The evidence does not match the kind of link claimed.';
    case 'population-mismatch':
      return 'The people studied may not be a close match for you.';
    case 'mechanistic-evidence':
      return 'The backing is early lab work rather than a study in people.';
    case 'observational-evidence':
      return 'The backing is an observational study rather than a trial.';
    case 'direction-unconfirmed':
      return 'The direction of this link was not confirmed.';
    case 'effect-size-unconfirmed':
      return 'The size of this effect was not confirmed.';
    case 'low-confidence':
      return 'This check was not conclusive.';
  }
}

/**
 * Compose the derived caveat from the fired flags — `null` when nothing fired (point 2 of the
 * honesty contract: silence beats a reassuring sentence).
 */
export function composeCaveat(flags: readonly CaveatFlag[], input: CaveatInput): string | null {
  if (flags.length === 0) return null;
  return flags
    .slice(0, MAX_CAVEAT_SENTENCES)
    .map((f) => caveatSentence(f, input))
    .join(' ');
}

/**
 * Lowercase substrings that count as the verifier NAMING a given limitation in its own words.
 * Deliberately generous within each flag (a model phrases "one study" many ways) and deliberately
 * disjoint ACROSS flags (a match must be attributable to the flag that fired, not to any flag).
 */
const CAVEAT_FLAG_VOCAB: Record<CaveatFlag, readonly string[]> = {
  'not-checked-independently': [
    'not been checked', 'no independent', 'without independent', 'not independently', 'no retrieval',
  ],
  'no-sources-retrieved': [
    'no other stud', 'no sources', 'no studies', 'nothing was retrieved', 'no evidence was retrieved',
    'zero sources', 'no corroborat',
  ],
  'no-supporting-source': [
    'did not support', "didn't support", 'do not support', 'no supporting', 'did not back',
    'none of the retrieved', 'none of the other',
  ],
  'contradicting-source': ['contradict', 'disagree', 'points the other way', 'opposite direction', 'refut'],
  'single-supporting-source': ['one study', 'single study', 'one source', 'single source', 'only one'],
  'claim-kind-mismatch': [
    'not a proven cause', 'not causal', 'not a cause', 'correlat', 'association', 'associational',
    'mechanistic claim', 'link, not',
  ],
  'population-mismatch': [
    'population', 'people studied', 'participants', 'group studied', 'may not apply', 'generalis', 'generaliz',
  ],
  'mechanistic-evidence': [
    'mechanistic', 'in vitro', 'in-vitro', 'lab work', 'laboratory', 'animal', 'preclinical',
    'early-stage', 'early stage',
  ],
  'observational-evidence': [
    'observational', 'cross-sectional', 'cross sectional', 'not a trial', 'snapshot', 'not randomised',
    'not randomized',
  ],
  'direction-unconfirmed': ['direction'],
  'effect-size-unconfirmed': ['effect size', 'size of the effect', 'magnitude', 'no effect size'],
  'low-confidence': ['not conclusive', 'inconclusive', 'not certain', 'low confidence', 'uncertain'],
};

/** Upper bound on a model-authored caveat — a card qualification, not an essay. */
export const MAX_MODEL_CAVEAT_CHARS = 300;

/** Where the emitted caveat text came from (logged; not persisted on the record). */
export type CaveatSource = 'model' | 'derived' | 'none';

export interface CaveatChoice {
  caveat: string | null;
  source: CaveatSource;
  flags: CaveatFlag[];
}

/**
 * Pick the caveat text for a record: the verifier's own words when they are a FAITHFUL rendering
 * of a limitation that fired, otherwise the derived sentence, otherwise `null`.
 *
 * The model's text is accepted only when ALL of:
 *   a. at least one flag fired — the model may not introduce a limitation out of nowhere;
 *   b. it is non-empty and within {@link MAX_MODEL_CAVEAT_CHARS};
 *   c. `validateCopy` passes — a caveat is card copy, so the copy gate applies here and not only
 *      at the contract (where a failure would sink the whole record instead of one string);
 *   d. it lexically corroborates at least one FIRED flag via {@link CAVEAT_FLAG_VOCAB}.
 *
 * `validateCopy` absent ⇒ the model's text is NOT accepted (fail-closed): a producer that cannot
 * reach the copy gate emits derived text, which is authored clean, rather than shipping unchecked
 * model prose onto a card.
 *
 * RESIDUAL LIMITATION, stated rather than hidden: (d) proves the model named a limitation that
 * fired; it does NOT prove the model named ONLY those. A sentence that correctly says "only one
 * study backed this up" and then adds an unmeasured clause would pass. Closing that needs
 * entailment checking, not string matching. The bound that does hold is that a caveat naming
 * nothing we measured is always replaced by one that does.
 */
export function chooseCaveat(
  input: CaveatInput,
  modelCaveat: string | null | undefined,
  validateCopy?: CopyValidator,
): CaveatChoice {
  const flags = firedCaveatFlags(input);
  if (flags.length === 0) return { caveat: null, source: 'none', flags };

  const text = typeof modelCaveat === 'string' ? modelCaveat.trim() : '';
  if (
    text.length > 0 &&
    text.length <= MAX_MODEL_CAVEAT_CHARS &&
    validateCopy !== undefined &&
    validateCopy(text) &&
    corroboratesAFiredFlag(text, flags)
  ) {
    return { caveat: text, source: 'model', flags };
  }
  return { caveat: composeCaveat(flags, input), source: 'derived', flags };
}

/** True when `text` mentions the vocabulary of at least one flag in `flags`. */
export function corroboratesAFiredFlag(text: string, flags: readonly CaveatFlag[]): boolean {
  const lower = text.toLowerCase();
  return flags.some((f) => CAVEAT_FLAG_VOCAB[f].some((term) => lower.includes(term)));
}
