/**
 * #300 · Whole-paper synthesis response post-processing — THE GATE.
 *
 * The LLM reply is UNTRUSTED. Requirements are enforced here by post-processing, never by
 * trusting the model. For each proposed claim, in order (first failure wins, logged with a
 * reason):
 *   1. must be a JSON object with string subject/object;
 *   2. `edgeId` is FORCED to `${subject}|${relation}|${object}` — never the model's;
 *   3. BOTH endpoints must be ACTIVE registry metric keys and distinct. This replaces the
 *      pair-scoped `unrequested-pair` gate: whole-paper synthesis is not told which pair to
 *      look for, so the registry is what bounds it (#300 §A);
 *   4. `ownFinding` must be exactly `true` — **`false` is REJECTED, not downgraded** (§C). A
 *      paper's Introduction citing someone else's result is not that paper's evidence, and
 *      citing it would produce a GREEN quote gate over a FALSE ATTRIBUTION, which is worse
 *      than no claim at all;
 *   5. every citation + quoteSpan paperId must be the provided uid (no foreign papers);
 *   6. model-declared `role`/`section` are folded into the existing free-text `locator`, so
 *      the mechanism span (§B) needs NO contract change and rides the SAME quote gate;
 *   7. charStart/charEnd are BACKFILLED from A9 quoteCheck's computed offsets;
 *   8. the EVIDENCE span must not sit in the leading Introduction/Background zone (§C interim
 *      mitigation, deterministic and free). The MECHANISM span is exempt — see
 *      `INTRO_ZONE_FRACTION`;
 *   9. the shared zod `validateClaim` hard-gate must pass;
 *  10. A9 quoteCheck against the ACTUAL paper text must find EVERY span — so the mechanism is
 *      verbatim by construction and a paraphrased pathway cannot survive;
 *  11. `derivation` must pass the shared copy gate (`validateCopyString`).
 *
 * Blueprints (§D) are gated separately and independently: a claim can be accepted while its
 * blueprint is rejected, because a bad rule template must never cost us a good edge.
 *
 * Pure: no I/O (texts + validators are injected).
 *
 * ESM / NodeNext — imports use explicit `.js` extensions.
 */

import { checkClaimQuotes, type QuoteSpanInput } from '../verify/quoteCheck.js';
import { blueprintDedupeKey } from './blueprint.js';
import type { BlueprintValidator, ClaimValidator, CopyValidator } from './load.js';
import {
  INTRO_ZONE_FRACTION,
  MECHANISM_LOCATOR_PREFIX,
  isMechanismLocator,
  type PaperCitationMetadata,
  type ProcessResult,
  type RejectedBlueprint,
  type RejectedClaim,
  type SynthBlueprintRecord,
  type SynthClaim,
} from './types.js';

export interface PaperProcessContext {
  /** The paper this response was asked about — the ONLY citable uid. */
  paperUid: string;
  /** paperId → canonical text, for the A9 quoteCheck + offset backfill. */
  texts: ReadonlyMap<string, string>;
  /** Corpus-owned title/year/evidenceTier by paper id; model copies are overwritten. */
  paperMetadata: ReadonlyMap<string, PaperCitationMetadata>;
  /** ACTIVE registry metric keys — the vocabulary that bounds claim endpoints. */
  activeMetricKeys: ReadonlySet<string>;
  /** The shared zod claim gate. */
  validateClaim: ClaimValidator;
  /** The shared copy gate over `derivation`. */
  validateCopy: CopyValidator;
  /** The shared zod blueprint gate (#300 §D). Omit to skip blueprint emission entirely. */
  validateBlueprint?: BlueprintValidator;
  /** Provenance stamps applied to every accepted claim/blueprint. */
  synthesisModel: string;
  promptVersion: string;
  /** Clock for `synthesisedAt` (tests inject a fixed one). */
  now?: () => number;
  /** Override the intro-zone fraction (tests). */
  introZoneFraction?: number;
}

/** Parse the reply into a list of raw claim objects. Throws on unparseable JSON. */
export function parsePaperClaimsResponse(rawText: string): unknown[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch (err) {
    throw new Error(
      `synth: response was not valid JSON — ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (Array.isArray(parsed)) return parsed;
  if (typeof parsed === 'object' && parsed !== null) {
    const claims = (parsed as { claims?: unknown }).claims;
    if (Array.isArray(claims)) return claims;
    return []; // an object without a claims array = zero proposals (valid)
  }
  throw new Error('synth: response JSON was neither a claims array nor an object with one');
}

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

/** A raw span coerced to the A9 input shape (defensive — untrusted fields). */
function toQuoteSpanInput(raw: unknown): QuoteSpanInput {
  const s = asRecord(raw);
  return {
    paperId: typeof s['paperId'] === 'string' ? s['paperId'] : '',
    quote: typeof s['quote'] === 'string' ? s['quote'] : '',
    charStart: typeof s['charStart'] === 'number' ? s['charStart'] : null,
    charEnd: typeof s['charEnd'] === 'number' ? s['charEnd'] : null,
  };
}

/**
 * Fold the model's `role` + claim-level `section` into the contract's free-text `locator`
 * (#300 §B/§C). A locator the model supplied directly is kept.
 *
 * #307 D2 · A span is labelled `mechanism:` ONLY when the model explicitly declared
 * `mechanismIsPathway: true` — its own judgement that the quote explains the biology or behaviour
 * rather than the study.
 *
 * WHY THE MODEL AND NOT A DETERMINISTIC RULE. A live run emitted two spans quoting
 * *"This lack of association may be due to the limited variability in sleep quality in this
 * population and the small sample size."* — verbatim, so the quote gate passed it, and labelled a
 * mechanism. That is a statement about the STUDY, and on a card it would tell a reader their body
 * works a certain way when the paper only said its own sample was too small.
 *
 * The first fix considered was a phrase blocklist. That is the wrong instrument: "may be due to"
 * occurs in genuine hedged mechanisms as readily as in limitations, so the list cannot separate
 * them. Deterministic gates belong on facts with ground truth — is this quote verbatim at these
 * offsets, is this key in the registry. "Is this sentence biology or methodology" is a JUDGEMENT,
 * and the model is the only component holding the whole paper. The earlier failure was ours: the
 * prompt asked for "the sentence explaining WHY the relationship holds" without ever saying a
 * methodological caveat disqualifies, and for a `no_effect` claim that instruction has no referent
 * at all — so the model answered the question it was actually asked.
 *
 * Undeclared spans are DEMOTED to a plain evidence span — not dropped, not trusted. The quote is
 * still verbatim and still useful; we simply stop asserting it is the mechanism. The failure mode
 * is therefore under-claiming, never mislabelling.
 */
function locatorForSpan(raw: unknown, section: string | null): string | null {
  const s = asRecord(raw);
  const existing = s['locator'];
  if (typeof existing === 'string' && existing.trim() !== '') return existing;
  const role = typeof s['role'] === 'string' ? s['role'].toLowerCase() : '';
  const sectionPart = section ?? '';
  if (role === 'mechanism' && s['mechanismIsPathway'] === true) {
    return `${MECHANISM_LOCATOR_PREFIX}${sectionPart}`;
  }
  return sectionPart === '' ? null : sectionPart;
}

/** All paperIds referenced by a raw claim's citations + quoteSpans (strings only). */
function referencedPaperIds(claim: Record<string, unknown>): string[] {
  const ids: string[] = [];
  const push = (arr: unknown) => {
    if (!Array.isArray(arr)) return;
    for (const el of arr) {
      const pid = asRecord(el)['paperId'];
      if (typeof pid === 'string') ids.push(pid);
    }
  };
  push(claim['citations']);
  push(claim['quoteSpans']);
  return ids;
}

/**
 * Process one whole-paper synthesis response. Returns accepted (validated,
 * offset-backfilled) claims + blueprints, and a reason for every rejection.
 */
export function processPaperSynthesisResponse(
  rawText: string,
  ctx: PaperProcessContext,
): ProcessResult {
  const now = ctx.now ?? Date.now;
  const synthesisedAt = new Date(now()).toISOString();
  const introFraction = ctx.introZoneFraction ?? INTRO_ZONE_FRACTION;
  const paperText = ctx.texts.get(ctx.paperUid) ?? '';
  const introZoneEnd = Math.floor(paperText.length * introFraction);

  const accepted: SynthClaim[] = [];
  const rejected: RejectedClaim[] = [];
  const acceptedBlueprints: SynthBlueprintRecord[] = [];
  const rejectedBlueprints: RejectedBlueprint[] = [];
  const raws = parsePaperClaimsResponse(rawText);

  for (const raw of raws) {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      rejected.push({ edgeId: null, reason: 'not-an-object', detail: 'claim was not a JSON object' });
      continue;
    }
    const c = raw as Record<string, unknown>;
    const subject = c['subject'];
    const object = c['object'];
    if (typeof subject !== 'string' || typeof object !== 'string') {
      rejected.push({
        edgeId: null,
        reason: 'missing-endpoints',
        detail: 'subject/object missing or not a string',
      });
      continue;
    }
    const relation = typeof c['relation'] === 'string' ? c['relation'] : '';
    // (2) FORCE edgeId — never trust the model's.
    const edgeId = `${subject}|${relation}|${object}`;

    // (3) ACTIVE-registry endpoint gate (replaces the pair-scoped gate in whole-paper mode).
    const inactive = [subject, object].filter((k) => !ctx.activeMetricKeys.has(k));
    if (inactive.length > 0) {
      rejected.push({
        edgeId,
        reason: 'inactive-metric-key',
        detail: `endpoint(s) not an active shared/metrics registry key: ${[...new Set(inactive)].join(', ')}`,
      });
      continue;
    }
    if (subject === object) {
      rejected.push({
        edgeId,
        reason: 'inactive-metric-key',
        detail: `subject and object are the same metric ('${subject}') — not a relationship`,
      });
      continue;
    }

    // (4) §C — ownFinding:false is REJECTED, never downgraded.
    if (c['ownFinding'] !== true) {
      rejected.push({
        edgeId,
        reason: 'not-own-finding',
        detail:
          c['ownFinding'] === false
            ? "ownFinding:false — the paper cites this result rather than finding it; rejected, not downgraded"
            : `ownFinding must be exactly true (got ${JSON.stringify(c['ownFinding'])})`,
      });
      continue;
    }

    // (5) foreign-paper gate — only the one provided uid is citable.
    const refs = referencedPaperIds(c);
    const foreign = refs.filter((id) => id !== ctx.paperUid);
    if (foreign.length > 0) {
      rejected.push({
        edgeId,
        reason: 'foreign-paper',
        detail: `cites paperId(s) other than ${ctx.paperUid}: ${[...new Set(foreign)].join(', ')}`,
      });
      continue;
    }

    const rawCitations = Array.isArray(c['citations']) ? (c['citations'] as unknown[]) : [];
    const citationPaperIds = rawCitations
      .map((citation) => asRecord(citation)['paperId'])
      .filter((paperId): paperId is string => typeof paperId === 'string');
    const missingMetadata = citationPaperIds.filter((paperId) => !ctx.paperMetadata.has(paperId));
    if (missingMetadata.length > 0) {
      rejected.push({
        edgeId,
        reason: 'citation-metadata',
        detail: `manifest/corpus metadata missing for: ${[...new Set(missingMetadata)].join(', ')}`,
      });
      continue;
    }
    // A claim with no citation array at all still needs the paper credited.
    const effectiveCitations = rawCitations.length > 0
      ? rawCitations
      : [{ paperId: ctx.paperUid, stance: 'supports' }];
    const authoritativeCitations = effectiveCitations.map((rawCitation) => {
      const citation = { ...asRecord(rawCitation) };
      const paperId = typeof citation['paperId'] === 'string' ? citation['paperId'] : ctx.paperUid;
      citation['paperId'] = paperId;
      if (typeof citation['stance'] !== 'string') citation['stance'] = 'supports';
      if (citation['population'] === undefined) citation['population'] = null;
      if (typeof citation['impactTier'] !== 'string') citation['impactTier'] = 'moderate';
      const metadata = ctx.paperMetadata.get(paperId);
      if (metadata !== undefined) {
        citation['title'] = metadata.title;
        citation['year'] = metadata.year;
        citation['evidenceTier'] = metadata.evidenceTier;
      }
      return citation;
    });

    // (6) role/section → locator, then (7) backfill offsets from quoteCheck.
    const section = typeof c['section'] === 'string' && c['section'].trim() !== ''
      ? c['section'].trim()
      : null;
    const rawSpans = Array.isArray(c['quoteSpans']) ? (c['quoteSpans'] as unknown[]) : [];
    const spanInputs = rawSpans.map(toQuoteSpanInput);
    const qc = checkClaimQuotes({ quoteSpans: spanInputs }, ctx.texts);
    const backfilledSpans = rawSpans.map((rawSpan, i) => {
      const s = { ...asRecord(rawSpan) };
      const verdict = qc.spans[i];
      if (verdict && verdict.found) {
        s['charStart'] = verdict.charStart;
        s['charEnd'] = verdict.charEnd;
      }
      s['locator'] = locatorForSpan(rawSpan, section);
      // `role` is a prompt-level convenience, not part of the contract — fold and drop it.
      delete s['role'];
      // Prompt-level declaration, folded into the locator above and not part of the contract.
      delete s['mechanismIsPathway'];
      if (typeof s['paperId'] !== 'string') s['paperId'] = ctx.paperUid;
      return s;
    });

    // (8) §C intro-zone gate — EVIDENCE spans only; the mechanism span is deliberately exempt.
    const introViolations = backfilledSpans
      .map((s, i) => ({ s, i, verdict: qc.spans[i] }))
      .filter(({ s }) => !isMechanismLocator(s['locator'] as string | null))
      .filter(({ verdict }) => verdict?.found === true && typeof verdict.charStart === 'number')
      .filter(({ verdict }) => (verdict!.charStart as number) < introZoneEnd);
    if (introZoneEnd > 0 && introViolations.length > 0) {
      rejected.push({
        edgeId,
        reason: 'intro-zone-quote',
        detail:
          `evidence quote at char ${introViolations[0]!.verdict!.charStart} sits in the leading ` +
          `${Math.round(introFraction * 100)}% of the paper (< ${introZoneEnd}), where ` +
          'Introduction/Background restate other work',
      });
      continue;
    }

    // Build the stamped candidate. `section`/`ownFinding`/`blueprint`/`evidenceTier` are
    // prompt-level fields, not claim-contract fields — they gate, then they are dropped.
    const rawBlueprint = c['blueprint'];
    const candidate: Record<string, unknown> = {
      ...c,
      edgeId,
      citations: authoritativeCitations,
      quoteSpans: backfilledSpans,
      synthesisModel: ctx.synthesisModel,
      promptVersion: ctx.promptVersion,
      synthesisedAt,
    };
    delete candidate['section'];
    delete candidate['ownFinding'];
    delete candidate['blueprint'];
    delete candidate['evidenceTier'];
    if (candidate['population'] === undefined) candidate['population'] = null;
    if (candidate['effect'] === undefined) {
      candidate['effect'] = { size: null, unit: null, ci: null };
    }

    // (9) shared zod hard-gate.
    let validated: SynthClaim;
    try {
      validated = ctx.validateClaim(candidate);
    } catch (err) {
      rejected.push({
        edgeId,
        reason: 'schema-invalid',
        detail: err instanceof Error ? err.message : String(err),
      });
      continue;
    }

    // (10) A9 quoteCheck — every span, evidence AND mechanism, must be literally present.
    if (!qc.quoteCheck.allPresent) {
      const bad = qc.spans
        .map((s, i) => ({ s, i }))
        .filter((x) => !x.s.found)
        .map((x) => `span#${x.i + 1}(${x.s.paperId || '?'}): ${x.s.mismatchReason ?? 'not-found'}`);
      rejected.push({
        edgeId,
        reason: 'quote-not-found',
        detail: `quoteCheck ${qc.quoteCheck.spansFound}/${qc.quoteCheck.spansTotal} present — ${bad.join('; ')}`,
      });
      continue;
    }

    // (11) copy gate over `derivation`.
    if (!ctx.validateCopy(validated.derivation)) {
      rejected.push({
        edgeId,
        reason: 'copy-gate',
        detail: 'derivation fails validateCopyString (diagnostic language)',
      });
      continue;
    }

    accepted.push(validated);

    // §D · the blueprint rides alongside, gated independently.
    if (rawBlueprint !== undefined && rawBlueprint !== null && ctx.validateBlueprint) {
      const outcome = gateBlueprint(rawBlueprint, {
        paperUid: ctx.paperUid,
        activeMetricKeys: ctx.activeMetricKeys,
        validateBlueprint: ctx.validateBlueprint,
        evidenceLocator: section,
        synthesisModel: ctx.synthesisModel,
        promptVersion: ctx.promptVersion,
        synthesisedAt,
      });
      if ('record' in outcome) acceptedBlueprints.push(outcome.record);
      else rejectedBlueprints.push(outcome.rejection);
    }
  }

  return { accepted, rejected, acceptedBlueprints, rejectedBlueprints };
}

interface BlueprintGateContext {
  paperUid: string;
  activeMetricKeys: ReadonlySet<string>;
  validateBlueprint: BlueprintValidator;
  evidenceLocator: string | null;
  synthesisModel: string;
  promptVersion: string;
  synthesisedAt: string;
}

/**
 * §D · Gate one proposed rule blueprint. Stamps `provenance.tier: 'extracted'` and the paper
 * citation from OUR side — the model never supplies provenance, so it cannot claim a lineage
 * it does not have. The shared zod gate then enforces every structural invariant *and* the
 * non-diagnostic copy rules over `template.title` / `template.body`.
 */
export function gateBlueprint(
  raw: unknown,
  ctx: BlueprintGateContext,
): { record: SynthBlueprintRecord } | { rejection: RejectedBlueprint } {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return {
      rejection: { ruleId: null, reason: 'not-an-object', detail: 'blueprint was not a JSON object' },
    };
  }
  const bp = { ...(raw as Record<string, unknown>) };
  const ruleId = typeof bp['ruleId'] === 'string' ? bp['ruleId'] : null;

  const metricKeys = Array.isArray(bp['metricKeys'])
    ? (bp['metricKeys'] as unknown[]).filter((k): k is string => typeof k === 'string')
    : [];
  const inactive = metricKeys.filter((k) => !ctx.activeMetricKeys.has(k));
  if (metricKeys.length === 0 || inactive.length > 0) {
    return {
      rejection: {
        ruleId,
        reason: 'inactive-metric-key',
        detail:
          metricKeys.length === 0
            ? 'blueprint has no metricKeys'
            : `metricKeys not active registry keys: ${[...new Set(inactive)].join(', ')}`,
      },
    };
  }

  // Provenance is OURS, never the model's — this is what makes the lineage trustworthy.
  bp['provenance'] = {
    tier: 'extracted',
    sourceNote:
      `extracted by ${ctx.synthesisModel} (${ctx.promptVersion}) from ${ctx.paperUid}` +
      (ctx.evidenceLocator ? ` § ${ctx.evidenceLocator}` : ''),
    citation: { paperId: ctx.paperUid, locator: ctx.evidenceLocator },
  };

  let validated: Record<string, unknown>;
  try {
    validated = ctx.validateBlueprint(bp);
  } catch (err) {
    return {
      rejection: {
        ruleId,
        reason: 'schema-invalid',
        detail: err instanceof Error ? err.message : String(err),
      },
    };
  }

  return {
    record: {
      blueprint: validated,
      dedupeKey: blueprintDedupeKey(validated),
      paperId: ctx.paperUid,
      synthesisModel: ctx.synthesisModel,
      promptVersion: ctx.promptVersion,
      synthesisedAt: ctx.synthesisedAt,
    },
  };
}
