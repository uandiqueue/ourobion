/**
 * A9 quote-check tests (insight-engine-architecture §A9) — node:test, via tsx.
 *
 * Pure core, no I/O. Proves:
 *  - normalizeForMatch applies EXACTLY the documented rules (dashes, curly
 *    quotes, soft hyphens, whitespace collapse; case preserved) and its offset
 *    map points back into the original string;
 *  - exact match wins first; normalized match is the only fallback; anything
 *    fuzzier (case drift, paraphrase) is a miss;
 *  - null offsets → located offsets are computed + returned for backfill;
 *  - given offsets are verified (exact, then normalized tolerance); wrong
 *    offsets are flagged 'offset-mismatch' and corrected when the quote lives
 *    elsewhere;
 *  - missing paper text / empty quote → typed mismatch reasons;
 *  - the claim-level block is EXACTLY EdgeVerification.quoteCheck
 *    ({spansFound, spansTotal, allPresent}) and zero spans never pass vacuously;
 *  - the loader wrapper loads each cited paper once and degrades a loader
 *    failure to 'text-missing'.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeForMatch,
  checkQuoteSpan,
  checkClaimQuotes,
  checkClaimQuotesWithLoader,
  type QuoteSpanInput,
} from '../src/verify/quoteCheck.js';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Canonical text as extract.ts produces it (already whitespace-collapsed). */
const CANONICAL =
  'Background: dehydration impairs cognition. We found that mild dehydration ' +
  '(1-2% body mass loss) significantly reduced sustained attention in healthy adults. ' +
  'The effect was dose-dependent across the "hydration window" cohort.';

function span(partial: Partial<QuoteSpanInput> & { quote: string }): QuoteSpanInput {
  return {
    paperId: partial.paperId ?? 'doi:10.1234/hydration.1',
    quote: partial.quote,
    charStart: partial.charStart ?? null,
    charEnd: partial.charEnd ?? null,
  };
}

const TEXTS = new Map([['doi:10.1234/hydration.1', CANONICAL]]);

// ─────────────────────────────────────────────────────────────────────────────
// normalizeForMatch
// ─────────────────────────────────────────────────────────────────────────────

test('normalizeForMatch: dashes, curly quotes, NBSP, soft hyphen, whitespace collapse', () => {
  const input = 'a–b “q”  ‘s’ c de­hydrated\tx\n';
  const { text } = normalizeForMatch(input);
  assert.equal(text, 'a-b "q" \'s\' c dehydrated x');
});

test('normalizeForMatch: case is preserved (no fuzzy rung)', () => {
  assert.equal(normalizeForMatch('Mild Dehydration').text, 'Mild Dehydration');
});

test('normalizeForMatch: offset map points into the original string', () => {
  const input = '  a—b   c';
  const norm = normalizeForMatch(input);
  assert.equal(norm.text, 'a-b c');
  // 'a' at original 2, dash at 3, 'b' at 4, space run starting 5, 'c' at 8
  assert.deepEqual(norm.map, [2, 3, 4, 5, 8]);
});

// ─────────────────────────────────────────────────────────────────────────────
// checkQuoteSpan — matching rungs
// ─────────────────────────────────────────────────────────────────────────────

test('exact match: found, method exact, offsets computed for backfill', () => {
  const quote = 'mild dehydration (1-2% body mass loss) significantly reduced sustained attention';
  const v = checkQuoteSpan(span({ quote }), TEXTS);
  assert.equal(v.found, true);
  assert.equal(v.method, 'exact');
  assert.equal(v.offsetsComputed, true);
  assert.equal(v.mismatchReason, null);
  assert.equal(CANONICAL.slice(v.charStart!, v.charEnd!), quote);
});

test('normalized match: en-dash + curly quotes + loose whitespace still locate', () => {
  // The synthesis LLM quotes with an en-dash, curly quotes and doubled spaces.
  const quote = 'mild  dehydration (1–2% body mass loss)';
  const v = checkQuoteSpan(span({ quote }), TEXTS);
  assert.equal(v.found, true);
  assert.equal(v.method, 'normalized');
  assert.equal(v.offsetsComputed, true);
  // Returned offsets index the ORIGINAL canonical text.
  const slice = CANONICAL.slice(v.charStart!, v.charEnd!);
  assert.equal(slice, 'mild dehydration (1-2% body mass loss)');
});

test('normalized match: curly-quoted phrase in canonical straight quotes', () => {
  const v = checkQuoteSpan(span({ quote: '“hydration window” cohort' }), TEXTS);
  assert.equal(v.found, true);
  assert.equal(v.method, 'normalized');
  assert.equal(CANONICAL.slice(v.charStart!, v.charEnd!), '"hydration window" cohort');
});

test('miss: paraphrase / absent text is not found (no fuzzy matching)', () => {
  const v = checkQuoteSpan(span({ quote: 'dehydration mildly reduced attention' }), TEXTS);
  assert.equal(v.found, false);
  assert.equal(v.method, null);
  assert.equal(v.charStart, null);
  assert.equal(v.mismatchReason, 'not-found');
});

test('miss: case drift is a real mismatch, not normalized away', () => {
  const v = checkQuoteSpan(span({ quote: 'MILD DEHYDRATION (1-2% body mass loss)' }), TEXTS);
  assert.equal(v.found, false);
  assert.equal(v.mismatchReason, 'not-found');
});

test('missing paper text → text-missing', () => {
  const v = checkQuoteSpan(span({ paperId: 'doi:10.9999/absent', quote: 'anything' }), TEXTS);
  assert.equal(v.found, false);
  assert.equal(v.mismatchReason, 'text-missing');
});

test('empty / whitespace-only quote → empty-quote', () => {
  const v = checkQuoteSpan(span({ quote: '    ' }), TEXTS);
  assert.equal(v.found, false);
  assert.equal(v.mismatchReason, 'empty-quote');
});

// ─────────────────────────────────────────────────────────────────────────────
// checkQuoteSpan — offset verification
// ─────────────────────────────────────────────────────────────────────────────

test('correct offsets verify exactly: echoed, not recomputed', () => {
  const quote = 'dehydration impairs cognition';
  const start = CANONICAL.indexOf(quote);
  const v = checkQuoteSpan(span({ quote, charStart: start, charEnd: start + quote.length }), TEXTS);
  assert.equal(v.found, true);
  assert.equal(v.method, 'exact');
  assert.equal(v.offsetsComputed, false);
  assert.equal(v.charStart, start);
  assert.equal(v.charEnd, start + quote.length);
  assert.equal(v.mismatchReason, null);
});

test('offsets correct modulo normalization → verified with method normalized', () => {
  const canonicalSlice = 'mild dehydration (1-2% body mass loss)';
  const start = CANONICAL.indexOf(canonicalSlice);
  // Quote text differs from the slice only by an en-dash.
  const quote = 'mild dehydration (1–2% body mass loss)';
  const v = checkQuoteSpan(
    span({ quote, charStart: start, charEnd: start + canonicalSlice.length }),
    TEXTS,
  );
  assert.equal(v.found, true);
  assert.equal(v.method, 'normalized');
  assert.equal(v.offsetsComputed, false);
  assert.equal(v.mismatchReason, null);
});

test('wrong offsets, quote present elsewhere → found + corrected offsets + offset-mismatch', () => {
  const quote = 'dehydration impairs cognition';
  const v = checkQuoteSpan(span({ quote, charStart: 0, charEnd: quote.length }), TEXTS);
  assert.equal(v.found, true);
  assert.equal(v.offsetsComputed, true);
  assert.equal(v.mismatchReason, 'offset-mismatch');
  assert.equal(CANONICAL.slice(v.charStart!, v.charEnd!), quote);
});

test('wrong offsets, quote absent entirely → not-found', () => {
  const v = checkQuoteSpan(span({ quote: 'no such sentence', charStart: 0, charEnd: 16 }), TEXTS);
  assert.equal(v.found, false);
  assert.equal(v.mismatchReason, 'not-found');
});

test('out-of-range offsets do not throw; fall back to search', () => {
  const quote = 'dehydration impairs cognition';
  const v = checkQuoteSpan(span({ quote, charStart: 5000, charEnd: 6000 }), TEXTS);
  assert.equal(v.found, true);
  assert.equal(v.mismatchReason, 'offset-mismatch');
});

// ─────────────────────────────────────────────────────────────────────────────
// checkClaimQuotes — the EdgeVerification.quoteCheck block
// ─────────────────────────────────────────────────────────────────────────────

test('multi-span claim: block matches EdgeVerification.quoteCheck exactly', () => {
  const claim = {
    quoteSpans: [
      span({ quote: 'dehydration impairs cognition' }),
      span({ quote: 'The effect was dose-dependent' }),
      span({ quote: 'this sentence does not exist' }),
    ],
  };
  const result = checkClaimQuotes(claim, TEXTS);
  // Field names align EXACTLY with relationships.ts:159-163 for A10 embedding.
  assert.deepEqual(result.quoteCheck, { spansFound: 2, spansTotal: 3, allPresent: false });
  assert.deepEqual(Object.keys(result.quoteCheck).sort(), ['allPresent', 'spansFound', 'spansTotal']);
  assert.equal(result.spans.length, 3);
});

test('all spans found → allPresent true (the A9 gate opens)', () => {
  const claim = {
    quoteSpans: [
      span({ quote: 'dehydration impairs cognition' }),
      span({ quote: '“hydration window” cohort' }), // normalized rung
    ],
  };
  const result = checkClaimQuotes(claim, TEXTS);
  assert.deepEqual(result.quoteCheck, { spansFound: 2, spansTotal: 2, allPresent: true });
});

test('zero spans never pass vacuously (≥1-span contract invariant)', () => {
  const result = checkClaimQuotes({ quoteSpans: [] }, TEXTS);
  assert.deepEqual(result.quoteCheck, { spansFound: 0, spansTotal: 0, allPresent: false });
});

// ─────────────────────────────────────────────────────────────────────────────
// Loader wrapper
// ─────────────────────────────────────────────────────────────────────────────

test('loader wrapper: one load per unique paperId; verdicts as with the map', async () => {
  const loads: string[] = [];
  const loader = async (paperId: string): Promise<string | null> => {
    loads.push(paperId);
    return paperId === 'doi:10.1234/hydration.1' ? CANONICAL : null;
  };
  const claim = {
    quoteSpans: [
      span({ quote: 'dehydration impairs cognition' }),
      span({ quote: 'The effect was dose-dependent' }), // same paper — must not re-load
      span({ paperId: 'doi:10.9999/absent', quote: 'anything' }),
    ],
  };
  const result = await checkClaimQuotesWithLoader(claim, loader);
  assert.deepEqual(loads, ['doi:10.1234/hydration.1', 'doi:10.9999/absent']);
  assert.deepEqual(result.quoteCheck, { spansFound: 2, spansTotal: 3, allPresent: false });
  assert.equal(result.spans[2]!.mismatchReason, 'text-missing');
});

test('loader wrapper: a throwing loader degrades to text-missing, not a crash', async () => {
  const loader = async (): Promise<string | null> => {
    throw new Error('r2 down');
  };
  const result = await checkClaimQuotesWithLoader(
    { quoteSpans: [span({ quote: 'dehydration impairs cognition' })] },
    loader,
  );
  assert.deepEqual(result.quoteCheck, { spansFound: 0, spansTotal: 1, allPresent: false });
  assert.equal(result.spans[0]!.mismatchReason, 'text-missing');
});
