/**
 * A10 · Verifier-owned retrieval (insight-engine-architecture §A10, step 2).
 *
 * Independence is "the verifier performs its OWN search" — not that results must
 * differ from synthesis. Two rungs, both CLI-side:
 *
 *   1. CORPUS-INTERNAL (always available, free, DETERMINISTIC): a BM25-lite rank
 *      of the corpus texts for the claim's topic (metric terms + claim keywords).
 *      This stands in for A6's co-occurrence index, which does not exist yet
 *      (interim — recorded in the session log). Pure + deterministic: same
 *      (query, docs) → same ranking, so it is fully unit-tested.
 *   2. EXTERNAL-FRESH (budget-permitting): query 1–2 existing discovery adapters
 *      (Crossref / Europe PMC — already tested, already rate-limited) for the
 *      claim's topic and collect candidate titles/abstracts as fresh sources
 *      beyond the corpus. Injectable so tests stay offline + deterministic.
 *
 * Both rungs are ECHO-CONTROLLED: a source already cited by the claim is excluded
 * from the retrieved set (a verifier that "confirms" using the synthesizer's own
 * papers is not independent — brain-synthesis-design "Active contradiction search").
 *
 * Retrieval produces CANDIDATE sources with a neutral `stance: 'mentions'` — it
 * does NOT decide support/contradiction. That judgement is the verifier LLM's, and
 * is re-derived deterministically in post-enforcement (`enforce.ts`) from the
 * stances the LLM assigns to THESE sources (it may not invent others).
 *
 * ESM / NodeNext — imports use explicit `.js` extensions.
 */

import type {
  Candidate,
  DiscoverFn,
  Seed,
  SourceCtx,
  SourceName,
} from '../types.js';
import { defaultTermsForKeys } from '../synth/passages.js';
import type {
  CorpusDoc,
  RankedDoc,
  RetrievalResult,
  SynthClaim,
  VerifyCitation,
  VerifyEvidencePassage,
  VerifyEvidenceTier,
  VerifyImpactTier,
} from './types.js';

// ─────────────────────────────────────────────────────────────────────────────
// Query construction (deterministic)
// ─────────────────────────────────────────────────────────────────────────────

/** Stopwords dropped from claim/population keywords (poor retrieval terms). */
const KEYWORD_STOP = new Set([
  'the', 'and', 'with', 'for', 'was', 'were', 'are', 'from', 'that', 'this',
  'have', 'has', 'had', 'not', 'but', 'all', 'any', 'per', 'via', 'into',
  'adults', 'patients', 'healthy', 'study', 'studies', 'group', 'groups',
]);

/** Split text into lowercased alphanumeric word tokens. */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0);
}

/**
 * Deterministic query terms for a claim: the subject + object metric tokens
 * (minus unit/suffix noise, via the shared `defaultTermsForKeys`) followed by
 * distinct population keywords (len ≥ 4, minus stopwords). Metric terms lead so
 * they dominate ranking; order is stable (first-seen).
 */
export function claimQueryTerms(claim: SynthClaim): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (t: string) => {
    const term = t.trim().toLowerCase();
    if (term.length === 0 || seen.has(term)) return;
    seen.add(term);
    out.push(term);
  };
  for (const t of defaultTermsForKeys([claim.subject, claim.object])) push(t);
  if (claim.population) {
    for (const tok of tokenize(claim.population)) {
      if (tok.length >= 4 && !KEYWORD_STOP.has(tok)) push(tok);
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Corpus-internal ranking (BM25-lite, deterministic)
// ─────────────────────────────────────────────────────────────────────────────

const BM25_K1 = 1.5;
const BM25_B = 0.75;

/** IDF over the corpus: ln(1 + (N - n + 0.5)/(n + 0.5)) — always positive. */
function idf(nDocsWithTerm: number, nDocs: number): number {
  return Math.log(1 + (nDocs - nDocsWithTerm + 0.5) / (nDocsWithTerm + 0.5));
}

/**
 * Rank `docs` for `query` with a BM25-lite score. Deterministic: docs with a
 * positive score, sorted by score desc then paperId asc (locale-independent
 * tie-break). Empty query or no matches → []. `limit` caps the returned hits.
 */
export function rankCorpus(
  query: readonly string[],
  docs: readonly CorpusDoc[],
  opts: { limit?: number } = {},
): RankedDoc[] {
  const limit = opts.limit ?? 8;
  const terms = [...new Set(query.map((t) => t.toLowerCase()).filter((t) => t.length > 0))];
  if (terms.length === 0 || docs.length === 0 || limit <= 0) return [];

  // Per-doc token counts + lengths.
  const tokenCounts: Array<Map<string, number>> = [];
  const lengths: number[] = [];
  for (const doc of docs) {
    const counts = new Map<string, number>();
    const toks = tokenize(`${doc.title} ${doc.text}`);
    for (const tok of toks) counts.set(tok, (counts.get(tok) ?? 0) + 1);
    tokenCounts.push(counts);
    lengths.push(toks.length);
  }
  const avgLen = lengths.reduce((a, b) => a + b, 0) / docs.length || 1;

  // Document frequency per query term (for idf).
  const df = new Map<string, number>();
  for (const term of terms) {
    let n = 0;
    for (const counts of tokenCounts) if ((counts.get(term) ?? 0) > 0) n++;
    df.set(term, n);
  }

  const ranked: RankedDoc[] = [];
  docs.forEach((doc, i) => {
    const counts = tokenCounts[i]!;
    const len = lengths[i]!;
    let score = 0;
    const matched: string[] = [];
    for (const term of terms) {
      const tf = counts.get(term) ?? 0;
      if (tf === 0) continue;
      matched.push(term);
      const termIdf = idf(df.get(term)!, docs.length);
      const denom = tf + BM25_K1 * (1 - BM25_B + (BM25_B * len) / avgLen);
      score += termIdf * ((tf * (BM25_K1 + 1)) / denom);
    }
    if (score > 0) ranked.push({ doc, score, matchedTerms: matched });
  });

  ranked.sort((a, b) => b.score - a.score || (a.doc.paperId < b.doc.paperId ? -1 : a.doc.paperId > b.doc.paperId ? 1 : 0));
  return ranked.slice(0, limit);
}

// ─────────────────────────────────────────────────────────────────────────────
// Evidence passages (O15/B1 — the verifier judges ONLY shown evidence)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Per-source evidence budget, in characters (O15). Bounds how much passage text a
 * single citation may carry into the verifier prompt, so a large corpus doc can
 * never blow the prompt up. Config value, not an inline literal — override per
 * call via `maxEvidenceCharsPerSource` ({@link RetrieveOptions}).
 */
export const DEFAULT_MAX_EVIDENCE_CHARS_PER_SOURCE = 700;

/** One sentence of a doc's canonical text with its char span (end exclusive). */
interface SentenceSpan {
  text: string;
  start: number;
  end: number;
}

/** Split text into trimmed sentences, keeping each one's char span in the ORIGINAL text. */
function sentenceSpans(text: string): SentenceSpan[] {
  const out: SentenceSpan[] = [];
  const pushSegment = (rawStart: number, rawEnd: number): void => {
    const seg = text.slice(rawStart, rawEnd);
    const lead = seg.length - seg.trimStart().length;
    const trimmed = seg.trim();
    if (trimmed.length === 0) return;
    const start = rawStart + lead;
    out.push({ text: trimmed, start, end: start + trimmed.length });
  };
  let segStart = 0;
  const re = /[.!?]+(?=\s|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const segEnd = m.index + m[0].length;
    pushSegment(segStart, segEnd);
    segStart = segEnd;
  }
  pushSegment(segStart, text.length);
  return out;
}

/**
 * Extract bounded, provenance-addressable evidence passages from a corpus doc for
 * the query terms that matched it (O15). Deterministic: sentences are scored by how
 * many DISTINCT matched terms they contain, selected best-first (ties broken by
 * document order) under the `maxChars` budget, then emitted in document order. Each
 * passage's locator is `chars:<start>-<end>` into `doc.text` (the canonical
 * extracted text — the same coordinate space as QuoteSpan offsets). When the best
 * sentence alone exceeds the budget it is truncated (locator reflects the truncated
 * span) so a ranked hit with a matching sentence is never silently evidence-less.
 * No matching sentence (e.g. the terms only hit the title) → [] — evidence is
 * carried honestly or not at all, never padded.
 */
export function extractEvidencePassages(
  doc: CorpusDoc,
  matchedTerms: readonly string[],
  maxChars: number = DEFAULT_MAX_EVIDENCE_CHARS_PER_SOURCE,
): VerifyEvidencePassage[] {
  if (maxChars <= 0) return [];
  const terms = new Set(matchedTerms.map((t) => t.toLowerCase()).filter((t) => t.length > 0));
  if (terms.size === 0) return [];

  const scored = sentenceSpans(doc.text)
    .map((s, order) => {
      const toks = new Set(tokenize(s.text));
      let hits = 0;
      for (const t of terms) if (toks.has(t)) hits++;
      return { ...s, order, hits };
    })
    .filter((s) => s.hits > 0);
  scored.sort((a, b) => b.hits - a.hits || a.order - b.order);

  const chosen: Array<SentenceSpan & { order: number }> = [];
  let used = 0;
  for (const s of scored) {
    if (used + s.text.length <= maxChars) {
      chosen.push(s);
      used += s.text.length;
    } else if (chosen.length === 0) {
      // Best sentence alone exceeds the budget → carry it truncated.
      chosen.push({ text: s.text.slice(0, maxChars), start: s.start, end: s.start + maxChars, order: s.order });
      break;
    }
  }
  chosen.sort((a, b) => a.order - b.order);
  return chosen.map((s) => ({ text: s.text, locator: `chars:${s.start}-${s.end}` }));
}

/**
 * Map a ranked corpus hit to a candidate Citation (neutral stance — LLM decides),
 * carrying bounded evidence passages from the doc's canonical text (O15): the
 * verifier judges ONLY shown evidence, so the passage text must survive this
 * mapping instead of being stripped at the type boundary.
 */
export function corpusHitToCitation(
  hit: RankedDoc,
  opts: { maxEvidenceChars?: number } = {},
): VerifyCitation {
  const evidence = extractEvidencePassages(
    hit.doc,
    hit.matchedTerms,
    opts.maxEvidenceChars ?? DEFAULT_MAX_EVIDENCE_CHARS_PER_SOURCE,
  );
  return {
    paperId: hit.doc.paperId,
    title: hit.doc.title,
    year: hit.doc.year,
    population: null,
    evidenceTier: hit.doc.evidenceTier,
    impactTier: hit.doc.impactTier,
    stance: 'mentions',
    ...(evidence.length > 0 ? { evidence } : {}),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// External-fresh retrieval (reuses the tested discovery adapters)
// ─────────────────────────────────────────────────────────────────────────────

/** Default conservative tiers for a freshly-discovered candidate (venue unscored yet). */
const EXTERNAL_DEFAULT_EVIDENCE_TIER: VerifyEvidenceTier = 2;
const EXTERNAL_DEFAULT_IMPACT_TIER: VerifyImpactTier = 'low';

/** Stable paperId for a discovery candidate: its DOI, else a title fingerprint. */
export function candidatePaperId(c: Candidate): string {
  if (c.identifiers.doi) return `doi:${c.identifiers.doi}`;
  if (c.identifiers.pmid) return `pmid:${c.identifiers.pmid}`;
  if (c.identifiers.pmcid) return `pmcid:${c.identifiers.pmcid}`;
  const slug = c.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  return `title:${slug}`;
}

/**
 * Map a discovery candidate to a candidate Citation (neutral stance, conservative
 * tiers). External candidates have no canonical text yet — the only honest evidence
 * available is the abstract, carried bounded with an `abstract:<start>-<end>`
 * locator. No abstract → NO evidence (never fabricated): the prompt then shows the
 * source as unable to ground the claim.
 */
export function candidateToCitation(
  c: Candidate,
  opts: { maxEvidenceChars?: number } = {},
): VerifyCitation {
  const maxChars = opts.maxEvidenceChars ?? DEFAULT_MAX_EVIDENCE_CHARS_PER_SOURCE;
  const abstract = (c.abstract ?? '').trim();
  const evidence: VerifyEvidencePassage[] =
    abstract.length > 0 && maxChars > 0
      ? [{ text: abstract.slice(0, maxChars), locator: `abstract:0-${Math.min(abstract.length, maxChars)}` }]
      : [];
  return {
    paperId: candidatePaperId(c),
    title: c.title,
    year: c.year,
    population: null,
    evidenceTier: EXTERNAL_DEFAULT_EVIDENCE_TIER,
    impactTier: EXTERNAL_DEFAULT_IMPACT_TIER,
    stance: 'mentions',
    ...(evidence.length > 0 ? { evidence } : {}),
  };
}

/** One discovery adapter paired with its source name (for the rate limiter). */
export interface ExternalAdapter {
  source: SourceName;
  discover: DiscoverFn;
}

/**
 * Query the given discovery adapters for a claim's topic and collect candidate
 * Citations, echo-excluding any paperId already in `excludePaperIds`. Each adapter
 * is called through the live {@link SourceCtx} (rate-limited); an adapter failure
 * is swallowed (retrieval degrades, never sinks the verification). Results are
 * de-duped by paperId (first adapter wins) and capped at `limit`.
 */
export async function retrieveExternal(
  ctx: SourceCtx,
  seed: Seed,
  adapters: readonly ExternalAdapter[],
  opts: { limit?: number; excludePaperIds?: ReadonlySet<string>; maxEvidenceChars?: number } = {},
): Promise<VerifyCitation[]> {
  const limit = opts.limit ?? 5;
  const exclude = opts.excludePaperIds ?? new Set<string>();
  const seen = new Set<string>();
  const out: VerifyCitation[] = [];
  for (const adapter of adapters) {
    if (out.length >= limit) break;
    let candidates: Candidate[] = [];
    try {
      candidates = await adapter.discover(ctx, seed);
    } catch {
      candidates = []; // adapter failure → skip; retrieval degrades gracefully
    }
    for (const c of candidates) {
      if (out.length >= limit) break;
      const cite = candidateToCitation(
        c,
        opts.maxEvidenceChars !== undefined ? { maxEvidenceChars: opts.maxEvidenceChars } : {},
      );
      if (exclude.has(cite.paperId) || seen.has(cite.paperId)) continue;
      seen.add(cite.paperId);
      out.push(cite);
    }
  }
  return out;
}

/** Build a discovery {@link Seed} for a claim's topic from its query terms. */
export function claimSeed(claim: SynthClaim): Seed {
  const terms = claimQueryTerms(claim);
  return {
    topic: `verify:${claim.edgeId}`,
    query: terms.join(' '),
    topicTags: [claim.subject, claim.object],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Orchestrated retrieval (corpus + external) → the independentRetrieval block
// ─────────────────────────────────────────────────────────────────────────────

export interface RetrieveOptions {
  /** The corpus docs the verifier ranks over (interim: caller-supplied; A6 later). */
  corpus?: readonly CorpusDoc[];
  /** Max corpus hits kept. */
  corpusLimit?: number;
  /**
   * Per-source evidence budget in characters (O15);
   * default {@link DEFAULT_MAX_EVIDENCE_CHARS_PER_SOURCE}.
   */
  maxEvidenceCharsPerSource?: number;
  /** Live external top-up: adapters + ctx. Omit to skip external retrieval. */
  external?: { ctx: SourceCtx; adapters: readonly ExternalAdapter[]; limit?: number };
}

/**
 * Run the verifier's own retrieval for a claim: rank the corpus, optionally top up
 * with live discovery, echo-exclude the claim's own citations, and assemble the
 * `independentRetrieval` evidence block. `performed` is true whenever retrieval
 * was ATTEMPTED (full mode) — even a zero-result search is grounded absence
 * (§A10 zero-result policy), distinct from "not performable".
 */
export async function retrieveForClaim(
  claim: SynthClaim,
  opts: RetrieveOptions = {},
): Promise<RetrievalResult> {
  const query = claimQueryTerms(claim);
  const ownIds = new Set(claim.citations.map((c) => c.paperId));

  const evidenceOpts =
    opts.maxEvidenceCharsPerSource !== undefined
      ? { maxEvidenceChars: opts.maxEvidenceCharsPerSource }
      : {};
  const corpusHits = rankCorpus(query, opts.corpus ?? [], { limit: opts.corpusLimit ?? 8 }).filter(
    (h) => !ownIds.has(h.doc.paperId),
  );
  const sources: VerifyCitation[] = corpusHits.map((h) => corpusHitToCitation(h, evidenceOpts));
  const have = new Set(sources.map((s) => s.paperId));

  let externalCount = 0;
  if (opts.external) {
    const exclude = new Set<string>([...ownIds, ...have]);
    const external = await retrieveExternal(
      opts.external.ctx,
      claimSeed(claim),
      opts.external.adapters,
      {
        ...(opts.external.limit !== undefined ? { limit: opts.external.limit } : {}),
        excludePaperIds: exclude,
        ...evidenceOpts,
      },
    );
    for (const c of external) {
      if (have.has(c.paperId)) continue;
      have.add(c.paperId);
      sources.push(c);
      externalCount++;
    }
  }

  return { performed: true, sources, corpusHits, externalCount };
}
