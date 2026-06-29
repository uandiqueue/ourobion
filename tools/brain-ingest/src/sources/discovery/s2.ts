/**
 * Discovery adapter — Semantic Scholar Graph API (S2AG), design §2 / §10.3.
 *
 * Endpoint: GET https://api.semanticscholar.org/graph/v1/paper/search
 *   ?query=<q>&limit=<N>&fields=title,year,venue,abstract,externalIds,authors
 *
 * Auth: sends the `x-api-key` header when `config.keys.s2` is present (higher
 * rate). Otherwise runs anonymous (lower introductory rate, ~1 RPS) — still
 * usable. When `s2` is disabled in `config.enabled`, the adapter returns `[]`
 * immediately without issuing a call (no budget/limiter touch).
 *
 * S2 is rate-limited only (no daily $ cap, §5.1) → we route through the limiter
 * but do not charge the budget guard.
 *
 * ESM / NodeNext: type-only import from src/types.ts with a `.js` extension.
 */

import type { Candidate, DiscoverFn, FetchOptions, Seed, SourceCtx } from '../../types.js';

/** S2AG paper-search endpoint (Graph API v1). */
const S2_SEARCH_URL = 'https://api.semanticscholar.org/graph/v1/paper/search';

/** The exact `fields` projection we request from S2. */
const S2_FIELDS = 'title,year,venue,abstract,externalIds,authors';

/** How many results to request per seed (single page; S2 caps `limit` at 100). */
const S2_LIMIT = 50;

/**
 * The subset of the S2AG `/paper/search` response we depend on. Every field is
 * optional because S2 omits keys it has no value for (e.g. a paper with no DOI
 * has no `externalIds.DOI`, a preprint may have a `null` venue).
 */
interface S2ExternalIds {
  DOI?: string | null;
  /** numeric PMID, returned as a string */
  PubMed?: string | null;
  /** e.g. "PMC1234567" */
  PubMedCentral?: string | null;
  /** e.g. "2103.00020" */
  ArXiv?: string | null;
  [other: string]: string | null | undefined;
}

interface S2Author {
  authorId?: string | null;
  name?: string | null;
}

interface S2Paper {
  paperId?: string | null;
  externalIds?: S2ExternalIds | null;
  title?: string | null;
  year?: number | null;
  venue?: string | null;
  abstract?: string | null;
  authors?: S2Author[] | null;
}

interface S2SearchResponse {
  total?: number;
  offset?: number;
  next?: number;
  data?: S2Paper[] | null;
}

/** Trim + drop empty; PMCID is normalized to a lowercase `pmc…` shape downstream by identity. */
function clean(v: string | null | undefined): string | undefined {
  if (v == null) return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

/**
 * Map one S2 paper record → a normalized `Candidate`. Pure (no I/O) so the test
 * can exercise it via the exported `mapPaper`. Returns `null` for a record with
 * no usable title (S2 occasionally returns stub rows).
 */
export function mapPaper(p: S2Paper): Candidate | null {
  const title = clean(p.title);
  if (title === undefined) return null;

  const ext = p.externalIds ?? {};
  const identifiers: Candidate['identifiers'] = {};

  const doi = clean(ext.DOI);
  if (doi !== undefined) identifiers.doi = doi;
  const pmid = clean(ext.PubMed);
  if (pmid !== undefined) identifiers.pmid = pmid;
  const pmcid = clean(ext.PubMedCentral);
  if (pmcid !== undefined) identifiers.pmcid = pmcid;
  const arxiv = clean(ext.ArXiv);
  if (arxiv !== undefined) identifiers.arxiv = arxiv;
  const s2Id = clean(p.paperId);
  if (s2Id !== undefined) identifiers.s2 = s2Id;

  const authors: string[] = (p.authors ?? [])
    .map((a) => clean(a?.name))
    .filter((n): n is string => n !== undefined);

  return {
    identifiers,
    title,
    authors,
    year: typeof p.year === 'number' ? p.year : null,
    venue: clean(p.venue) ?? null,
    abstract: clean(p.abstract) ?? null,
    discoveredVia: 's2',
  };
}

/** Map a full S2 search response → candidate list (drops untitled stubs). */
export function mapResponse(res: S2SearchResponse): Candidate[] {
  const rows = res.data ?? [];
  const out: Candidate[] = [];
  for (const row of rows) {
    const c = mapPaper(row);
    if (c !== null) out.push(c);
  }
  return out;
}

/**
 * Discovery entry point (§10.3). Returns `[]` fast when S2 is disabled, else
 * runs one search query through the rate limiter and maps the result.
 */
export const discover: DiscoverFn = async (ctx: SourceCtx, seed: Seed): Promise<Candidate[]> => {
  if (!ctx.config.enabled.s2) return [];

  const apiKey = ctx.config.keys.s2;
  const headers: Record<string, string> = { accept: 'application/json' };
  if (apiKey !== undefined && apiKey.length > 0) headers['x-api-key'] = apiKey;

  const opts: FetchOptions = {
    headers,
    query: {
      query: seed.query,
      limit: S2_LIMIT,
      fields: S2_FIELDS,
    },
  };

  const res = await ctx.fetchJson<S2SearchResponse>('s2', S2_SEARCH_URL, opts);
  return mapResponse(res);
};
