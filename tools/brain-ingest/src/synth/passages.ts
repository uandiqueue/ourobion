/**
 * Deterministic passage selection (A8 input assembly, design step 1).
 *
 * INTERIM SIMPLIFICATION (recorded per the session brief): a cheap deterministic
 * windowing + keyword prefilter over caller-supplied `terms`. The proper mention
 * tagging — A6's co-occurrence index driven by the shared `METRIC_TERMS`
 * synonym map, restricted to `role='finding'` + `asserted` sentences (A7) —
 * lands in a LATER session (insight-engine-architecture §A6/§A7). A8 here reads
 * the extracted canonical text directly (`text/<uid>.txt`) and windows it, so the
 * quality of the prefilter is only as good as the `terms` handed in; the synonym
 * expansion a snake_case metric key can't provide is supplied by `--terms` until
 * A6 exists.
 *
 * Pure: no I/O. Same (text, terms, opts) → same passages, stable order.
 *
 * ESM / NodeNext — imports use explicit `.js` extensions.
 */

import type { Passage } from './types.js';

/** One sentence with its offsets into the original text. */
interface Sentence {
  charStart: number;
  charEnd: number;
  text: string;
}

/**
 * Segment `text` into sentences carrying original offsets. Deterministic and
 * conservative: a boundary is `.`, `!` or `?` followed by whitespace. Newlines
 * also break (extraction often drops terminal punctuation at block ends). The
 * offsets are exact slices of the original so a quote copied from a passage
 * round-trips through A9 quoteCheck.
 */
export function segmentSentences(text: string): Sentence[] {
  const out: Sentence[] = [];
  let start = 0;
  const n = text.length;
  for (let i = 0; i < n; i++) {
    const ch = text[i] as string;
    const isTerminal = ch === '.' || ch === '!' || ch === '?';
    const next = text[i + 1];
    const boundary =
      (isTerminal && (next === undefined || /\s/.test(next))) || ch === '\n' || ch === '\r';
    if (boundary) {
      const raw = text.slice(start, i + 1);
      if (raw.trim().length > 0) {
        // Trim leading whitespace off the recorded offsets so charStart points at
        // the first non-space char (a copied quote won't lead with a space).
        let s = start;
        while (s < i + 1 && /\s/.test(text[s] as string)) s++;
        let e = i + 1;
        while (e > s && /\s/.test(text[e - 1] as string)) e--;
        if (e > s) out.push({ charStart: s, charEnd: e, text: text.slice(s, e) });
      }
      start = i + 1;
    }
  }
  if (start < n) {
    const raw = text.slice(start, n);
    if (raw.trim().length > 0) {
      let s = start;
      while (s < n && /\s/.test(text[s] as string)) s++;
      let e = n;
      while (e > s && /\s/.test(text[e - 1] as string)) e--;
      if (e > s) out.push({ charStart: s, charEnd: e, text: text.slice(s, e) });
    }
  }
  return out;
}

/** Distinct terms (lowercased) that appear in `haystack` (lowercased), first-seen order. */
function matchedTerms(haystackLower: string, terms: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of terms) {
    const term = t.trim().toLowerCase();
    if (term.length === 0 || seen.has(term)) continue;
    if (haystackLower.includes(term)) {
      seen.add(term);
      out.push(term);
    }
  }
  return out;
}

export interface SelectPassagesOptions {
  /** Max passages returned; default 12. Highest term-coverage first, ties by position. */
  maxPassages?: number;
  /** Include N neighbour sentences on each side of a matched sentence; default 1. */
  contextSentences?: number;
}

/**
 * Select passages of `text` relevant to `terms`. A sentence is a "hit" when it
 * contains ≥1 term; each hit is expanded by `contextSentences` neighbours and
 * overlapping windows are merged, so the LLM sees a claim-bearing sentence with
 * enough context to judge direction/scope. Passages are ranked by distinct-term
 * coverage (desc) then position (asc), capped, then RE-SORTED by position for a
 * stable, readable prompt.
 */
export function selectPassages(
  text: string,
  terms: readonly string[],
  opts: SelectPassagesOptions = {},
): Passage[] {
  const maxPassages = opts.maxPassages ?? 12;
  const ctx = opts.contextSentences ?? 1;
  const cleanTerms = [...new Set(terms.map((t) => t.trim().toLowerCase()).filter((t) => t.length > 0))];
  if (cleanTerms.length === 0 || maxPassages <= 0) return [];

  const sentences = segmentSentences(text);
  const hits: number[] = [];
  for (let i = 0; i < sentences.length; i++) {
    const s = sentences[i] as Sentence;
    if (matchedTerms(s.text.toLowerCase(), cleanTerms).length > 0) hits.push(i);
  }
  if (hits.length === 0) return [];

  // Expand each hit into a [lo, hi] sentence-index window, then merge overlaps.
  const windows: Array<[number, number]> = [];
  for (const h of hits) {
    const lo = Math.max(0, h - ctx);
    const hi = Math.min(sentences.length - 1, h + ctx);
    const last = windows[windows.length - 1];
    if (last && lo <= last[1] + 1) {
      last[1] = Math.max(last[1], hi);
    } else {
      windows.push([lo, hi]);
    }
  }

  const passages: Passage[] = windows.map(([lo, hi]) => {
    const first = sentences[lo] as Sentence;
    const last = sentences[hi] as Sentence;
    const charStart = first.charStart;
    const charEnd = last.charEnd;
    const slice = text.slice(charStart, charEnd);
    return {
      charStart,
      charEnd,
      text: slice,
      matchedTerms: matchedTerms(slice.toLowerCase(), cleanTerms),
    };
  });

  // Rank by coverage desc, then position asc; cap; re-sort by position.
  const ranked = passages
    .map((p, idx) => ({ p, idx }))
    .sort((a, b) => b.p.matchedTerms.length - a.p.matchedTerms.length || a.idx - b.idx)
    .slice(0, maxPassages)
    .sort((a, b) => a.p.charStart - b.p.charStart)
    .map((x) => x.p);

  return ranked;
}

/** Small stoplist of snake_case suffix/unit tokens that make poor search terms. */
const TERM_STOP = new Set([
  'score',
  'count',
  'min',
  'ms',
  'bpm',
  'c',
  'present',
  'flags',
  'completeness',
  'colour',
  'color',
]);

/**
 * Default deterministic terms for a metric key: its snake_case tokens minus the
 * stoplist (unit/suffix noise). A weak fallback — real synonym expansion is A6's
 * `METRIC_TERMS` job; callers should prefer explicit `--terms`.
 */
export function defaultTermsForKeys(metricKeys: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const key of metricKeys) {
    for (const tok of key.split('_')) {
      const t = tok.trim().toLowerCase();
      if (t.length < 2 || TERM_STOP.has(t) || seen.has(t)) continue;
      seen.add(t);
      out.push(t);
    }
  }
  return out;
}
