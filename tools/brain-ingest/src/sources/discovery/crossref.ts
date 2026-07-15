/**
 * Crossref discovery adapter (design §2 "Crossref REST", §10.3).
 *
 * Crossref is the canonical DOI resolver: free, keyless, JSON over `fetch`.
 * We hit the works search endpoint with the seed's bibliographic query and map
 * each `message.items[]` entry to a normalized `Candidate`.
 *
 *   GET https://api.crossref.org/works
 *       ?query.bibliographic=<q>&rows=<N>&mailto=<contactEmail>
 *
 * `mailto` puts us in Crossref's "polite pool" (better, more predictable limits).
 * Every outbound call is routed through `ctx.fetchJson`, which itself goes
 * through the per-source rate limiter; Crossref is unmetered (§5.1) so there is
 * no budget charge.
 */

import type { Candidate, DiscoverFn, Seed, SourceCtx } from '../../types.js';

/** Base URL of the Crossref REST works endpoint. */
const CROSSREF_WORKS_URL = 'https://api.crossref.org/works';

/** How many works to request per seed (kept modest — discovery is breadth-first). */
const DEFAULT_ROWS = 20;

/** `discoveredVia` tag stamped onto every candidate from this source. */
const VIA = 'crossref';

// ─────────────────────────────────────────────────────────────────────────────
// Crossref response shape (only the fields we read; everything else ignored).
// ─────────────────────────────────────────────────────────────────────────────

/** One author object in `item.author[]`. */
interface CrossrefAuthor {
  family?: string;
  given?: string;
  /** organisational authors carry `name` instead of family/given */
  name?: string;
}

/** One work in `message.items[]`. */
interface CrossrefItem {
  DOI?: string;
  title?: string[];
  author?: CrossrefAuthor[];
  'container-title'?: string[];
  abstract?: string;
  issued?: { 'date-parts'?: Array<Array<number>> };
  published?: { 'date-parts'?: Array<Array<number>> };
}

/** The envelope Crossref wraps every response in. */
interface CrossrefResponse {
  message?: { items?: CrossrefItem[] };
}

// ─────────────────────────────────────────────────────────────────────────────
// Field mappers (pure — unit-tested directly via the exported helpers below).
// ─────────────────────────────────────────────────────────────────────────────

/** Normalize a DOI: trim, lowercase, strip any resolver prefix. Empty → undefined. */
export function normalizeDoi(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const doi = raw
    .trim()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')
    .toLowerCase();
  return doi.length > 0 ? doi : undefined;
}

/** First non-empty title string, or '' when Crossref gives us none. */
export function pickTitle(item: CrossrefItem): string {
  const title = item.title?.find((t) => typeof t === 'string' && t.trim().length > 0);
  return title ? title.trim() : '';
}

/** First non-empty container-title (journal / venue), or null. */
export function pickVenue(item: CrossrefItem): string | null {
  const venue = item['container-title']?.find(
    (v) => typeof v === 'string' && v.trim().length > 0,
  );
  return venue ? venue.trim() : null;
}

/** Display name for one author: "Given Family", else `name`, else trimmed family/given. */
export function authorName(a: CrossrefAuthor): string {
  const given = a.given?.trim();
  const family = a.family?.trim();
  if (given && family) return `${given} ${family}`;
  if (family) return family;
  if (given) return given;
  const name = a.name?.trim();
  return name ?? '';
}

/** Map an author list to display names, dropping empties. */
export function pickAuthors(item: CrossrefItem): string[] {
  if (!item.author) return [];
  return item.author.map(authorName).filter((n) => n.length > 0);
}

/**
 * Publication year. Crossref puts the structured date in `issued.date-parts`
 * (an array of `[year, month?, day?]` arrays); fall back to `published`.
 * The first element of the first date-parts entry is the year.
 */
export function pickYear(item: CrossrefItem): number | null {
  const fromDateParts = (d?: { 'date-parts'?: Array<Array<number>> }): number | null => {
    const parts = d?.['date-parts'];
    if (!parts || parts.length === 0) return null;
    const first = parts[0];
    if (!first || first.length === 0) return null;
    const year = first[0];
    return typeof year === 'number' && Number.isFinite(year) ? year : null;
  };
  return fromDateParts(item.issued) ?? fromDateParts(item.published);
}

/**
 * Crossref abstracts arrive as a JATS/XML fragment (e.g.
 * `<jats:p>Background. …</jats:p>`). We strip tags to a plain-text abstract.
 * Returns null when absent or empty after stripping.
 */
export function cleanAbstract(raw: string | undefined): string | null {
  if (!raw) return null;
  const text = raw
    .replace(/<[^>]+>/g, ' ') // drop all tags
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > 0 ? text : null;
}

/** Map one Crossref work to a `Candidate`. */
export function toCandidate(item: CrossrefItem): Candidate {
  const doi = normalizeDoi(item.DOI);
  return {
    identifiers: doi ? { doi } : {},
    title: pickTitle(item),
    authors: pickAuthors(item),
    year: pickYear(item),
    venue: pickVenue(item),
    abstract: cleanAbstract(item.abstract),
    discoveredVia: VIA,
  };
}

/** Map a full Crossref response envelope to candidates, dropping title-less junk. */
export function mapResponse(res: CrossrefResponse): Candidate[] {
  const items = res.message?.items ?? [];
  return items.map(toCandidate).filter((c) => c.title.length > 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// The adapter.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Discover candidate works from Crossref for one topic seed.
 * Routes through `ctx.fetchJson('crossref', …)` (rate-limited; unmetered).
 */
export const discover: DiscoverFn = async (ctx: SourceCtx, seed: Seed): Promise<Candidate[]> => {
  const res = await ctx.fetchJson<CrossrefResponse>('crossref', CROSSREF_WORKS_URL, {
    method: 'GET',
    query: {
      'query.bibliographic': seed.query,
      rows: DEFAULT_ROWS,
      mailto: ctx.config.contactEmail,
    },
  });
  return mapResponse(res);
};
