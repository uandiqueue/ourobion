/**
 * PubMed discovery adapter (design §2 "PubMed E-utilities", §10.3).
 *
 * Two-step NCBI E-utilities flow:
 *   1. `esearch.fcgi?db=pubmed&term=<q>&retmode=json` → a list of PMIDs.
 *   2. `efetch.fcgi?db=pubmed&id=<csv>&retmode=xml`   → article metadata (XML).
 * The XML is parsed with `fast-xml-parser` and each `PubmedArticle` mapped to a
 * normalized {@link Candidate}. PMIDs come straight from the search; DOI / PMCID
 * (and a PMID cross-check) are read from each article's `ArticleIdList`.
 *
 * Rate limits (§5.1): NCBI is unmetered (rate-only). With a free `NCBI_API_KEY`
 * the polite limit is 10 req/s, else 3 req/s. We pass `api_key=` when present
 * and route every call through `ctx.limiter` (via the typed fetch helpers) — the
 * limiter owns the token bucket. The budget guard is consulted uniformly even
 * though pubmed is unmetered (the guard is a no-op for it), so the call site
 * matches every other adapter and stays correct if pubmed ever becomes metered.
 *
 * NO live network here at test time — tests drive a stub `SourceCtx` over the
 * fixtures in `tests/fixtures/`. Real HTTP happens only at runtime.
 *
 * ESM / NodeNext — imports use explicit `.js` extensions.
 */

import { XMLParser } from 'fast-xml-parser';
import type { Candidate, DiscoverFn, Identifiers, SourceCtx, Seed } from '../../types.js';

/** NCBI E-utilities base (https; all endpoints share it). */
const EUTILS_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';

/** How many PMIDs to pull per seed by default (kept modest; rate-limited). */
const DEFAULT_RETMAX = 50;

/** esearch JSON envelope — only the fields we read. */
interface ESearchResponse {
  esearchresult?: {
    idlist?: string[];
    count?: string;
  };
}

// ── fast-xml-parser shapes ───────────────────────────────────────────────────
// efetch XML is irregular: repeated nodes are arrays, singletons are objects,
// text-with-attributes nodes carry a `#text` field. We type defensively and
// normalize with the helpers below rather than trusting any single shape.

/** A node that is either the raw scalar or `{ '#text': scalar, ...attrs }`. */
type TextNode = string | number | { '#text'?: string | number; [k: string]: unknown };

interface ArticleId {
  '#text'?: string | number;
  /** attribute: `pubmed` | `doi` | `pmc` | `mid` | … (parser prefixes with `@_`) */
  '@_IdType'?: string;
}

interface AuthorNode {
  LastName?: TextNode;
  ForeName?: TextNode;
  CollectiveName?: TextNode;
}

interface AbstractTextNode {
  '#text'?: string | number;
  '@_Label'?: string;
}

interface JournalNode {
  Title?: TextNode;
  ISOAbbreviation?: TextNode;
  JournalIssue?: {
    PubDate?: { Year?: TextNode; MedlineDate?: TextNode };
  };
}

interface ArticleNode {
  ArticleTitle?: TextNode;
  Abstract?: { AbstractText?: AbstractTextNode | AbstractTextNode[] | TextNode };
  AuthorList?: { Author?: AuthorNode | AuthorNode[] };
  Journal?: JournalNode;
}

interface PubmedArticleNode {
  MedlineCitation?: {
    PMID?: TextNode;
    Article?: ArticleNode;
  };
  PubmedData?: {
    ArticleIdList?: { ArticleId?: ArticleId | ArticleId[] };
  };
}

interface EFetchResponse {
  PubmedArticleSet?: {
    PubmedArticle?: PubmedArticleNode | PubmedArticleNode[];
  };
}

// ── normalization helpers (pure) ──────────────────────────────────────────────

/** Always view a possibly-single, possibly-array, possibly-absent node as an array. */
function asArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

/** Pull a trimmed string out of a scalar-or-`{#text}` node; '' when absent. */
function textOf(node: TextNode | undefined): string {
  if (node === undefined || node === null) return '';
  if (typeof node === 'string') return node.trim();
  if (typeof node === 'number') return String(node);
  const t = node['#text'];
  if (typeof t === 'string') return t.trim();
  if (typeof t === 'number') return String(t);
  return '';
}

/** First non-empty parse of a 4-digit year out of any of the candidate strings. */
function parseYear(...candidates: string[]): number | null {
  for (const c of candidates) {
    const m = c.match(/\b(\d{4})\b/);
    if (m && m[1]) {
      const n = Number(m[1]);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

/** "Smith J" style author label from a PubMed Author node. */
function authorLabel(a: AuthorNode): string {
  const collective = textOf(a.CollectiveName);
  if (collective) return collective;
  const last = textOf(a.LastName);
  const fore = textOf(a.ForeName);
  return [last, fore].filter(Boolean).join(' ').trim();
}

/** Join structured/labelled AbstractText segments into one string. */
function abstractText(
  node: ArticleNode['Abstract'],
): string | null {
  if (node === undefined) return null;
  const parts = asArray(node.AbstractText as AbstractTextNode | AbstractTextNode[] | undefined);
  const joined = parts
    .map((p) => {
      const body = textOf(p as TextNode);
      const label =
        typeof p === 'object' && p !== null && '@_Label' in p
          ? String((p as AbstractTextNode)['@_Label'] ?? '').trim()
          : '';
      return label && body ? `${label}: ${body}` : body;
    })
    .filter(Boolean)
    .join(' ')
    .trim();
  return joined.length > 0 ? joined : null;
}

/** Map an ArticleIdList into our Identifiers, seeding `pmid` from the citation. */
function identifiersOf(citationPmid: string, ids: ArticleId[]): Identifiers {
  const out: Identifiers = {};
  if (citationPmid) out.pmid = citationPmid;
  for (const id of ids) {
    const type = (id['@_IdType'] ?? '').toString().toLowerCase();
    const value = textOf(id as TextNode);
    if (!value) continue;
    switch (type) {
      case 'doi':
        out.doi = value.toLowerCase();
        break;
      case 'pmc':
      case 'pmcid':
        // Normalize to the canonical `PMC…` form.
        out.pmcid = value.toUpperCase().startsWith('PMC') ? value : `PMC${value}`;
        break;
      case 'pubmed':
        if (!out.pmid) out.pmid = value;
        break;
      default:
        break;
    }
  }
  return out;
}

/** Map one parsed `<PubmedArticle>` to a Candidate, or null if it has no PMID. */
function articleToCandidate(node: PubmedArticleNode): Candidate | null {
  const citation = node.MedlineCitation;
  const article = citation?.Article;
  const pmid = textOf(citation?.PMID);
  // A record with no PMID can't be a pubmed candidate (the spine id is missing).
  if (!pmid) return null;

  const idList = asArray(node.PubmedData?.ArticleIdList?.ArticleId);
  const identifiers = identifiersOf(pmid, idList);

  const authors = asArray(article?.AuthorList?.Author).map(authorLabel).filter(Boolean);

  const journal = article?.Journal;
  const venue =
    textOf(journal?.Title) || textOf(journal?.ISOAbbreviation) || null;

  const pubDate = journal?.JournalIssue?.PubDate;
  const year = parseYear(textOf(pubDate?.Year), textOf(pubDate?.MedlineDate));

  const title = textOf(article?.ArticleTitle) || '';

  return {
    identifiers,
    title,
    authors,
    year,
    venue: venue || null,
    abstract: abstractText(article?.Abstract),
    discoveredVia: 'pubmed',
  };
}

/**
 * Parse an efetch `retmode=xml` body into Candidates. Exported for unit tests so
 * the pure XML→Candidate mapping is exercised against a fixture with no network.
 */
export function parseEfetchXml(xml: string): Candidate[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    // Keep `#text` alongside attributes (e.g. ArticleId carries IdType + value).
    textNodeName: '#text',
    trimValues: true,
    parseTagValue: false, // keep ids/years as strings; we coerce deliberately
    parseAttributeValue: false,
  });
  const parsed = parser.parse(xml) as EFetchResponse;
  const articles = asArray(parsed.PubmedArticleSet?.PubmedArticle);
  const out: Candidate[] = [];
  for (const a of articles) {
    const c = articleToCandidate(a);
    if (c) out.push(c);
  }
  return out;
}

/** Extract the PMID id list from an esearch JSON envelope (exported for tests). */
export function parseEsearchJson(json: ESearchResponse): string[] {
  const ids = json.esearchresult?.idlist ?? [];
  return ids.filter((s): s is string => typeof s === 'string' && s.length > 0);
}

/**
 * Discovery entry point. esearch → PMIDs → efetch → Candidates.
 * Every outbound call is routed through `ctx`'s limiter (the typed fetch helpers
 * do this) and gated by the budget guard (a no-op for unmetered pubmed).
 */
export const discover: DiscoverFn = async (ctx: SourceCtx, seed: Seed): Promise<Candidate[]> => {
  const apiKey = ctx.config.keys.ncbi;

  // The polite-pool / key params shared by both calls.
  const commonQuery: Record<string, string | number | undefined> = {
    db: 'pubmed',
    // tool + email are NCBI's requested politeness params.
    tool: 'ourobion-brain-ingest',
    email: ctx.config.contactEmail,
    api_key: apiKey,
  };

  // ── 1 · esearch → PMIDs ──────────────────────────────────────────────────
  // Budget guard consulted uniformly (no-op for unmetered pubmed); throws would
  // deny dispatch on a metered source. Cost 0 → never trips the 95% line here.
  if (ctx.budget.wouldExceed95('pubmed', 0)) return [];
  ctx.budget.charge('pubmed', 0);

  const search = await ctx.fetchJson<ESearchResponse>(
    'pubmed',
    `${EUTILS_BASE}/esearch.fcgi`,
    {
      query: {
        ...commonQuery,
        term: seed.query,
        retmode: 'json',
        retmax: DEFAULT_RETMAX,
      },
    },
  );

  const pmids = parseEsearchJson(search);
  if (pmids.length === 0) return [];

  // ── 2 · efetch → article XML ─────────────────────────────────────────────
  ctx.budget.charge('pubmed', 0);
  const xml = await ctx.fetchText('pubmed', `${EUTILS_BASE}/efetch.fcgi`, {
    query: {
      ...commonQuery,
      id: pmids.join(','),
      retmode: 'xml',
    },
  });

  return parseEfetchXml(xml);
};
