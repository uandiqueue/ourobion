/**
 * A9 · Quote check — the deterministic pre-verifier (insight-engine-architecture §A9).
 *
 * Literal-presence check of every `QuoteSpan.quote` against the cited paper's
 * canonical extracted text, run BEFORE any verifier LLM token is spent. The
 * output block (`spansFound` / `spansTotal` / `allPresent`) is EXACTLY the
 * `EdgeVerification.quoteCheck` shape (shared/brain/relationships.ts:159-163)
 * so A10 can embed it verbatim; per-span verdicts ride alongside for triage.
 *
 * Matching is deterministic and conservative — two rungs, nothing fuzzier:
 *   1. `exact`      — plain substring match of the verbatim quote.
 *   2. `normalized` — substring match after {@link normalizeForMatch} on BOTH
 *      sides. The normalization is exactly:
 *        a. soft hyphens (U+00AD) removed;
 *        b. the unicode dash family (U+2010–U+2015, U+2212 minus) → ASCII '-';
 *        c. curly/angle single quotes (U+2018–U+201B, U+2039/U+203A) → ' and
 *           curly/angle double quotes (U+201C–U+201F, U+00AB/U+00BB) → ";
 *        d. every whitespace run (incl. NBSP U+00A0) collapsed to one space,
 *           ends trimmed.
 *      Case is preserved — a case difference is a real mismatch, not noise.
 *
 * Offsets: when a span carries `charStart`/`charEnd` we verify they actually
 * locate the quote (exact slice equality, else normalized slice equality — the
 * documented tolerance). When they are null — or set but wrong — we attempt to
 * locate the quote ourselves and RETURN computed offsets (into the ORIGINAL
 * canonical text, mapped back through the normalization) so callers can
 * backfill; `offsetsComputed` marks these, and a set-but-wrong input is
 * additionally flagged `mismatchReason: 'offset-mismatch'` even when the quote
 * was relocated (presence is the A9 invariant; offsets are the locator upgrade).
 *
 * Pure at the core: no I/O in the check functions. The thin wrapper at the
 * bottom takes an injectable {@link PaperTextLoader}; {@link r2TextLoader}
 * adapts the existing R2 layout (`text/<uid>.txt`, storage/r2.ts) to it.
 *
 * ESM / NodeNext — imports use explicit `.js` extensions.
 */

import { R2Store, textKey, isNotFound } from '../storage/r2.js';

// ─────────────────────────────────────────────────────────────────────────────
// Input shapes (structural mirrors of shared/brain/relationships.ts — this
// package does not import shared/, matching the house pattern of types.ts's
// "paperUid IS Citation.paperId" comment-level coupling)
// ─────────────────────────────────────────────────────────────────────────────

/** Structural mirror of `QuoteSpan` (relationships.ts:94-109) — the fields A9 reads. */
export interface QuoteSpanInput {
  /** Must match a `Citation.paperId` on the same claim (== PaperRecord.paperUid). */
  paperId: string;
  /** Verbatim text from the source. */
  quote: string;
  /** Start offset into the canonical extracted text; null when unknown. */
  charStart: number | null;
  /** End offset (exclusive); null when unknown. */
  charEnd: number | null;
}

/** The slice of `RelationshipClaim` A9 needs — any claim object satisfies it. */
export interface ClaimQuotesInput {
  quoteSpans: readonly QuoteSpanInput[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Verdict shapes
// ─────────────────────────────────────────────────────────────────────────────

/** How a quote was matched. */
export type QuoteMatchMethod = 'exact' | 'normalized';

/** Why a span failed (or partially failed) the check. */
export type QuoteMismatchReason =
  | 'text-missing'      // no canonical text available for the cited paperId
  | 'empty-quote'       // quote is empty/whitespace-only — nothing checkable
  | 'not-found'         // quote absent from the text, even normalized
  | 'offset-mismatch';  // given charStart/charEnd did not locate the quote
                        // (quote may still be `found` elsewhere — see charStart/charEnd)

/** Per-span verdict. */
export interface QuoteSpanVerdict {
  paperId: string;
  /** The A9 invariant: is the quote literally present in the canonical text? */
  found: boolean;
  /** Which rung matched; null when not found. */
  method: QuoteMatchMethod | null;
  /**
   * Where the quote lives in the ORIGINAL canonical text. Verified input
   * offsets are echoed; otherwise located offsets are computed here (see
   * `offsetsComputed`). Null when the quote was not found.
   */
  charStart: number | null;
  charEnd: number | null;
  /**
   * True when the offsets above were computed by this check (input offsets
   * were null, or set but wrong) — callers can backfill the span with them.
   */
  offsetsComputed: boolean;
  /** Failure detail; null on a clean pass. */
  mismatchReason: QuoteMismatchReason | null;
}

/** EXACTLY `EdgeVerification.quoteCheck` (relationships.ts:159-163). */
export interface QuoteCheckBlock {
  spansFound: number;
  spansTotal: number;
  allPresent: boolean;
}

/** Claim-level result: the embeddable block + the per-span detail. */
export interface QuoteCheckResult {
  /** Merge this verbatim into the `EdgeVerification` record (A10). */
  quoteCheck: QuoteCheckBlock;
  spans: QuoteSpanVerdict[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Normalization (rung 2) — documented in the header; nothing beyond it
// ─────────────────────────────────────────────────────────────────────────────

/** Unicode dash family normalized to ASCII '-': hyphen…horizontal bar + minus sign. */
const DASHES = new Set(['‐', '‑', '‒', '–', '—', '―', '−']);
/** Curly/angle single quotes → `'`. */
const SINGLE_QUOTES = new Set(['‘', '’', '‚', '‛', '‹', '›']);
/** Curly/angle double quotes → `"`. */
const DOUBLE_QUOTES = new Set(['“', '”', '„', '‟', '«', '»']);
/** Soft hyphen — removed entirely (a line-break artifact, not content). */
const SOFT_HYPHEN = '­';

/** True for every char the whitespace-collapse rung folds (incl. NBSP). */
function isCollapsibleWhitespace(ch: string): boolean {
  return /\s/.test(ch) || ch === ' ';
}

/** Normalized text plus the map back into the original string. */
export interface NormalizedText {
  text: string;
  /** `map[i]` = index into the ORIGINAL string of the char that produced `text[i]`. */
  map: number[];
}

/**
 * Apply the documented A9 normalization (dashes, quotes, soft hyphens,
 * whitespace collapse — case preserved) while recording, per output char, the
 * original index it came from, so a match in normalized space maps back to
 * exact offsets in the canonical text.
 */
export function normalizeForMatch(input: string): NormalizedText {
  const out: string[] = [];
  const map: number[] = [];
  let pendingSpaceAt = -1; // original index of the first char of a pending whitespace run

  for (let i = 0; i < input.length; i++) {
    const ch = input[i] as string;
    if (ch === SOFT_HYPHEN) continue;
    if (isCollapsibleWhitespace(ch)) {
      if (pendingSpaceAt === -1) pendingSpaceAt = i;
      continue;
    }
    if (pendingSpaceAt !== -1) {
      if (out.length > 0) {
        // interior run → single space (leading whitespace is trimmed)
        out.push(' ');
        map.push(pendingSpaceAt);
      }
      pendingSpaceAt = -1;
    }
    if (DASHES.has(ch)) {
      out.push('-');
    } else if (SINGLE_QUOTES.has(ch)) {
      out.push("'");
    } else if (DOUBLE_QUOTES.has(ch)) {
      out.push('"');
    } else {
      out.push(ch);
    }
    map.push(i);
  }
  // trailing whitespace run is trimmed (never emitted)
  return { text: out.join(''), map };
}

/** Offsets into the original string for a match at `[idx, idx+len)` in normalized space. */
function originalOffsets(norm: NormalizedText, idx: number, len: number): { start: number; end: number } {
  const start = norm.map[idx] as number;
  const end = (norm.map[idx + len - 1] as number) + 1;
  return { start, end };
}

// ─────────────────────────────────────────────────────────────────────────────
// Core check (pure)
// ─────────────────────────────────────────────────────────────────────────────

/** Locate `quote` in `text` — exact rung, then normalized rung. Null when absent. */
function locateQuote(
  text: string,
  quote: string,
): { method: QuoteMatchMethod; start: number; end: number } | null {
  // Rung 1 — exact substring.
  const exactIdx = text.indexOf(quote);
  if (exactIdx !== -1) {
    return { method: 'exact', start: exactIdx, end: exactIdx + quote.length };
  }
  // Rung 2 — normalized substring, offsets mapped back to the original text.
  const normText = normalizeForMatch(text);
  const normQuote = normalizeForMatch(quote).text;
  if (normQuote.length === 0) return null;
  const normIdx = normText.text.indexOf(normQuote);
  if (normIdx === -1) return null;
  const { start, end } = originalOffsets(normText, normIdx, normQuote.length);
  return { method: 'normalized', start, end };
}

/** Do `charStart..charEnd` locate `quote` in `text`? Exact slice, else normalized slice. */
function verifyOffsets(
  text: string,
  quote: string,
  charStart: number,
  charEnd: number,
): QuoteMatchMethod | null {
  if (charStart < 0 || charEnd > text.length || charStart >= charEnd) return null;
  const slice = text.slice(charStart, charEnd);
  if (slice === quote) return 'exact';
  if (normalizeForMatch(slice).text === normalizeForMatch(quote).text) return 'normalized';
  return null;
}

/**
 * Check ONE span against the cited paper's canonical text. Pure — `texts` maps
 * `paperId` → canonical extracted text (absent = text unavailable).
 */
export function checkQuoteSpan(
  span: QuoteSpanInput,
  texts: ReadonlyMap<string, string>,
): QuoteSpanVerdict {
  const base: QuoteSpanVerdict = {
    paperId: span.paperId,
    found: false,
    method: null,
    charStart: null,
    charEnd: null,
    offsetsComputed: false,
    mismatchReason: null,
  };

  const text = texts.get(span.paperId);
  if (text === undefined) return { ...base, mismatchReason: 'text-missing' };
  if (normalizeForMatch(span.quote).text.length === 0) {
    return { ...base, mismatchReason: 'empty-quote' };
  }

  // Offsets supplied → verify they locate the quote (documented tolerance:
  // exact slice equality, else normalized slice equality).
  if (span.charStart !== null && span.charEnd !== null) {
    const method = verifyOffsets(text, span.quote, span.charStart, span.charEnd);
    if (method !== null) {
      return {
        ...base,
        found: true,
        method,
        charStart: span.charStart,
        charEnd: span.charEnd,
      };
    }
    // Offsets are wrong. Presence is the A9 invariant, so fall through to the
    // whole-text search; a relocation keeps the 'offset-mismatch' flag so the
    // bad input offsets are visible (and the corrected ones backfillable).
    const relocated = locateQuote(text, span.quote);
    if (relocated !== null) {
      return {
        ...base,
        found: true,
        method: relocated.method,
        charStart: relocated.start,
        charEnd: relocated.end,
        offsetsComputed: true,
        mismatchReason: 'offset-mismatch',
      };
    }
    return { ...base, mismatchReason: 'not-found' };
  }

  // No offsets → locate and return computed offsets for backfill.
  const located = locateQuote(text, span.quote);
  if (located === null) return { ...base, mismatchReason: 'not-found' };
  return {
    ...base,
    found: true,
    method: located.method,
    charStart: located.start,
    charEnd: located.end,
    offsetsComputed: true,
  };
}

/**
 * Check every span of a claim. `quoteCheck` in the result is the exact
 * `EdgeVerification.quoteCheck` block; `allPresent=false` gates the claim
 * before any verifier spend (§A9 failure mode 7).
 */
export function checkClaimQuotes(
  claim: ClaimQuotesInput,
  texts: ReadonlyMap<string, string>,
): QuoteCheckResult {
  const spans = claim.quoteSpans.map((span) => checkQuoteSpan(span, texts));
  const spansFound = spans.filter((s) => s.found).length;
  const spansTotal = spans.length;
  return {
    quoteCheck: {
      spansFound,
      spansTotal,
      // A claim with zero spans violates the ≥1-span contract invariant
      // (relationships.ts:134) — it must not pass vacuously.
      allPresent: spansTotal > 0 && spansFound === spansTotal,
    },
    spans,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Thin I/O wrapper (injectable loader; R2 adapter provided)
// ─────────────────────────────────────────────────────────────────────────────

/** Resolve a paperId to its canonical extracted text; null when unavailable. */
export type PaperTextLoader = (paperId: string) => Promise<string | null>;

/**
 * Run the claim-level check, loading each cited paper's text once through
 * `loader`. A loader failure for one paper degrades to `text-missing` for its
 * spans rather than sinking the whole claim check.
 */
export async function checkClaimQuotesWithLoader(
  claim: ClaimQuotesInput,
  loader: PaperTextLoader,
): Promise<QuoteCheckResult> {
  const texts = new Map<string, string>();
  const uniqueIds = [...new Set(claim.quoteSpans.map((s) => s.paperId))];
  for (const paperId of uniqueIds) {
    try {
      const text = await loader(paperId);
      if (text !== null) texts.set(paperId, text);
    } catch {
      // unavailable → absent from the map → 'text-missing' verdicts
    }
  }
  return checkClaimQuotes(claim, texts);
}

/**
 * A {@link PaperTextLoader} over the R2 corpus layout: reads `text/<uid>.txt`
 * (storage/r2.ts `textKey`); a missing object resolves to null.
 */
export function r2TextLoader(store: R2Store): PaperTextLoader {
  return async (paperId: string): Promise<string | null> => {
    try {
      return await store.getObjectText(textKey(paperId));
    } catch (err) {
      if (isNotFound(err)) return null;
      throw err;
    }
  };
}
