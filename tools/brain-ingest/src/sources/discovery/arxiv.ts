/**
 * arXiv discovery adapter (design §2, §10.3).
 *
 * Queries the arXiv Atom API:
 *   GET http://export.arxiv.org/api/query?search_query=all:<q>&max_results=N
 * arXiv asks for ~1 request / 3 s — the rate limiter (configured for the
 * `arxiv` bucket in §10.2) enforces that; this adapter only routes its single
 * call through `ctx.limiter` via `ctx.fetchText`. arXiv is free + keyless, so
 * there is no budget charge (the `arxiv` source is unmetered, §5.1).
 *
 * The Atom feed is parsed with `fast-xml-parser` and each `<entry>` is mapped
 * to a `Candidate`: the arXiv id (version stripped) becomes
 * `identifiers.arxiv`, `<title>` → title, `<author><name>` → authors,
 * `<published>` year → year, `<summary>` → abstract. `discoveredVia` is
 * `'arxiv'`.
 *
 * ESM / NodeNext: import with explicit `.js` extension; adapters import only
 * from `src/types.ts`.
 */

import { XMLParser } from 'fast-xml-parser';
import type { Candidate, DiscoverFn, SourceCtx, Seed } from '../../types.js';

/** Default page size; arXiv caps a single request well above this. */
const DEFAULT_MAX_RESULTS = 50;

const ARXIV_API_URL = 'http://export.arxiv.org/api/query';

// ─── Minimal shapes of the parsed Atom feed (only the fields we read) ────────

interface AtomAuthor {
  name?: string;
}

interface AtomEntry {
  id?: string;
  title?: string;
  summary?: string;
  published?: string;
  updated?: string;
  author?: AtomAuthor | AtomAuthor[];
  /** journal-ref when the preprint has been published somewhere. */
  'arxiv:journal_ref'?: string | { '#text'?: string };
}

interface AtomFeed {
  feed?: {
    entry?: AtomEntry | AtomEntry[];
  };
}

// ─── Parser (shared, configured once) ────────────────────────────────────────

const parser = new XMLParser({
  ignoreAttributes: true,
  trimValues: true,
  // Keep tag names verbatim so 'arxiv:journal_ref' stays addressable.
  removeNSPrefix: false,
});

// ─── Pure mapping helpers (unit-tested below the wire) ───────────────────────

/** Coerce a maybe-array / maybe-single / maybe-undefined into an array. */
function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

/** Collapse arbitrary parser output to a trimmed, whitespace-normalized string. */
function asText(value: unknown): string {
  if (typeof value === 'string') return value.replace(/\s+/g, ' ').trim();
  if (typeof value === 'number') return String(value);
  if (value && typeof value === 'object' && '#text' in value) {
    return asText((value as { '#text'?: unknown })['#text']);
  }
  return '';
}

/**
 * Extract the bare arXiv id from an Atom `<id>` URL, stripping both the
 * `http(s)://arxiv.org/abs/` prefix and any trailing version (`v2`).
 *   http://arxiv.org/abs/2101.00001v2 → 2101.00001
 *   http://arxiv.org/abs/cond-mat/0211045v1 → cond-mat/0211045
 * Returns '' when no id can be parsed.
 */
export function parseArxivId(idUrl: string | undefined): string {
  if (!idUrl) return '';
  const trimmed = idUrl.trim();
  // Take the path component after `/abs/` when present, else the last segment.
  const absMatch = trimmed.match(/\/abs\/(.+)$/);
  const raw = absMatch?.[1] ?? trimmed;
  // Strip a trailing version suffix: a 'v' + digits at the very end.
  return raw.replace(/v\d+$/, '');
}

/** Parse a 4-digit year out of an Atom `<published>`/`<updated>` ISO date. */
export function parseYear(published: string | undefined): number | null {
  if (!published) return null;
  const match = published.match(/(\d{4})/);
  if (!match?.[1]) return null;
  const year = Number.parseInt(match[1], 10);
  return Number.isFinite(year) ? year : null;
}

/** Map one parsed Atom `<entry>` to a normalized `Candidate`. */
export function entryToCandidate(entry: AtomEntry): Candidate {
  const arxivId = parseArxivId(entry.id);
  const authors = toArray(entry.author)
    .map((a) => asText(a?.name))
    .filter((name): name is string => name.length > 0);
  const venue = asText(entry['arxiv:journal_ref']) || 'arXiv';
  const abstract = asText(entry.summary);

  return {
    identifiers: arxivId ? { arxiv: arxivId } : {},
    title: asText(entry.title),
    authors,
    year: parseYear(entry.published),
    venue,
    abstract: abstract.length > 0 ? abstract : null,
    discoveredVia: 'arxiv',
  };
}

/**
 * Parse a raw arXiv Atom feed body into `Candidate[]`. Pure (no I/O) so it is
 * directly unit-testable against a fixture. Entries lacking an arXiv id are
 * dropped — without an id they cannot be deduped or retrieved.
 */
export function parseArxivFeed(xml: string): Candidate[] {
  const parsed = parser.parse(xml) as AtomFeed;
  const entries = toArray(parsed.feed?.entry);
  return entries
    .map(entryToCandidate)
    .filter((c) => Boolean(c.identifiers.arxiv) && c.title.length > 0);
}

// ─── The adapter ──────────────────────────────────────────────────────────────

/**
 * arXiv discovery: one Atom query for the seed, routed through the limiter
 * (which enforces the ~1 req/3 s arXiv etiquette). No budget charge — arXiv is
 * unmetered. Returns the mapped candidates (possibly empty).
 */
export const discover: DiscoverFn = async (ctx: SourceCtx, seed: Seed): Promise<Candidate[]> => {
  const xml = await ctx.fetchText('arxiv', ARXIV_API_URL, {
    query: {
      search_query: `all:${seed.query}`,
      max_results: DEFAULT_MAX_RESULTS,
      sortBy: 'relevance',
      sortOrder: 'descending',
    },
  });
  return parseArxivFeed(xml);
};
