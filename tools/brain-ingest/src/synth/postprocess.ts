/**
 * A8 · Synthesis response post-processing — the GATE (design step 2).
 *
 * The LLM reply is UNTRUSTED. Requirements are enforced here by post-processing,
 * never by trusting the model (brain-synthesis-design.md). For each proposed
 * claim, in order (first failure wins, logged with a reason):
 *   1. must be a JSON object with string subject/object;
 *   2. `edgeId` is FORCED to `${subject}|${relation}|${object}` (index.ts:20-22)
 *      — the model's edgeId is never trusted;
 *   3. the pair must be EXACTLY the one asked about — endpoints outside the
 *      requested pair are rejected (C9: synthesis proposes only for its pair);
 *   4. every citation + quoteSpan paperId must be a PROVIDED uid (no foreign
 *      papers);
 *   5. charStart/charEnd are BACKFILLED from A9 quoteCheck's computed offsets;
 *   6. the shared zod `validateClaim` hard-gate must pass;
 *   7. A9 quoteCheck against the ACTUAL paper text must find every span — a
 *      fabricated/paraphrased quote is rejected without any verifier spend;
 *   8. `derivation` must pass the shared copy gate (`validateCopyString`, O20/H3)
 *      — diagnostic language is rejected before the artifact append.
 *
 * Provenance (`synthesisModel`, `promptVersion`, `synthesisedAt`) is stamped by
 * the pipeline, not the model. Pure: no I/O (texts + validator are injected).
 *
 * ESM / NodeNext — imports use explicit `.js` extensions.
 */

import { checkClaimQuotes, type QuoteSpanInput } from '../verify/quoteCheck.js';
import type { ClaimValidator, CopyValidator } from './load.js';
import type {
  ProcessResult,
  RejectedClaim,
  SynthClaim,
  SynthPair,
} from './types.js';

export interface ProcessContext {
  /** The pair this response was asked about — endpoints must match it. */
  pair: SynthPair;
  /** Paper uids the LLM was allowed to cite (== the loaded papers). */
  allowedPaperIds: readonly string[];
  /** paperId → canonical text, for the A9 quoteCheck + offset backfill. */
  texts: ReadonlyMap<string, string>;
  /** The shared zod gate (injected; loaded via synth/load.ts for a real run). */
  validateClaim: ClaimValidator;
  /** The shared copy gate over `derivation` (injected; loaded via synth/load.ts for a real run). O20/H3. */
  validateCopy: CopyValidator;
  /** Provenance stamps applied to every accepted claim. */
  synthesisModel: string;
  promptVersion: string;
  /** Clock for `synthesisedAt` (tests inject a fixed one). */
  now?: () => number;
}

/** Parse the reply into a list of raw claim objects. Throws on unparseable JSON. */
export function parseClaimsResponse(rawText: string): unknown[] {
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

/** A raw span coerced to the A9 input shape (defensive — untrusted fields). */
function toQuoteSpanInput(raw: unknown): QuoteSpanInput {
  const s = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    paperId: typeof s['paperId'] === 'string' ? s['paperId'] : '',
    quote: typeof s['quote'] === 'string' ? s['quote'] : '',
    charStart: typeof s['charStart'] === 'number' ? s['charStart'] : null,
    charEnd: typeof s['charEnd'] === 'number' ? s['charEnd'] : null,
  };
}

/** All paperIds referenced by a raw claim's citations + quoteSpans (strings only). */
function referencedPaperIds(claim: Record<string, unknown>): string[] {
  const ids: string[] = [];
  const push = (arr: unknown) => {
    if (!Array.isArray(arr)) return;
    for (const el of arr) {
      if (typeof el === 'object' && el !== null) {
        const pid = (el as Record<string, unknown>)['paperId'];
        if (typeof pid === 'string') ids.push(pid);
      }
    }
  };
  push(claim['citations']);
  push(claim['quoteSpans']);
  return ids;
}

/**
 * Process one synthesis response for one pair. Returns accepted (validated,
 * offset-backfilled) claims + a reason for every rejection.
 */
export function processSynthesisResponse(rawText: string, ctx: ProcessContext): ProcessResult {
  const now = ctx.now ?? Date.now;
  const synthesisedAt = new Date(now()).toISOString();
  const requestedPair = new Set(ctx.pair.metricKeys);
  const allowed = new Set(ctx.allowedPaperIds);

  const accepted: SynthClaim[] = [];
  const rejected: RejectedClaim[] = [];
  const raws = parseClaimsResponse(rawText);

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

    // (3) unrequested-pair gate (C9).
    if (!(requestedPair.has(subject) && requestedPair.has(object) && subject !== object)) {
      rejected.push({
        edgeId,
        reason: 'unrequested-pair',
        detail: `endpoints {${subject}, ${object}} are not the requested pair {${[...requestedPair].join(', ')}}`,
      });
      continue;
    }

    // (4) foreign-paper gate.
    const refs = referencedPaperIds(c);
    const foreign = refs.filter((id) => !allowed.has(id));
    if (foreign.length > 0) {
      rejected.push({
        edgeId,
        reason: 'foreign-paper',
        detail: `cites paperId(s) not in the provided set: ${[...new Set(foreign)].join(', ')}`,
      });
      continue;
    }

    // (5) backfill charStart/charEnd from A9 quoteCheck's computed offsets.
    const rawSpans = Array.isArray(c['quoteSpans']) ? (c['quoteSpans'] as unknown[]) : [];
    const spanInputs = rawSpans.map(toQuoteSpanInput);
    const qc = checkClaimQuotes({ quoteSpans: spanInputs }, ctx.texts);
    const backfilledSpans = rawSpans.map((raw, i) => {
      const s = (typeof raw === 'object' && raw !== null ? { ...raw } : {}) as Record<string, unknown>;
      const verdict = qc.spans[i];
      if (verdict && verdict.found) {
        s['charStart'] = verdict.charStart;
        s['charEnd'] = verdict.charEnd;
      }
      if (s['locator'] === undefined) s['locator'] = null;
      return s;
    });

    // Build the stamped candidate (provenance + forced edgeId + backfilled spans).
    const candidate = {
      ...c,
      edgeId,
      quoteSpans: backfilledSpans,
      synthesisModel: ctx.synthesisModel,
      promptVersion: ctx.promptVersion,
      synthesisedAt,
    };

    // (6) shared zod hard-gate.
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

    // (7) A9 quoteCheck — every span must be literally present in the real text.
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

    // (8) O20/H3 copy gate — `derivation` is user-adjacent copy (nao evidence panels); a claim
    // whose derivation carries diagnostic language is rejected here, before the artifact append
    // (the loader re-checks the same gate at ingestion for artifacts that bypass this producer).
    if (!ctx.validateCopy(validated.derivation)) {
      rejected.push({
        edgeId,
        reason: 'copy-gate',
        detail: 'derivation fails validateCopyString (diagnostic language)',
      });
      continue;
    }

    accepted.push(validated);
  }

  return { accepted, rejected };
}
