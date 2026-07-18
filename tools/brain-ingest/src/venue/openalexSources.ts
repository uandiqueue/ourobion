/**
 * b2 · Venue lookup — OpenAlex Sources-by-ISSN client
 * (docs/nao/brain-support-models-design.md §2 (b2)).
 *
 * `GET https://api.openalex.org/sources/issn:<issn>` resolves a journal /
 * preprint server to the fields the impactTier banding reads:
 * `summary_stats.h_index`, `summary_stats["2yr_mean_citedness"]`, `is_core`,
 * `type`, `works_count`. Single-entity lookups are keyless and free (verified
 * in the design doc: HTTP 200, `X-RateLimit-Cost-USD: 0`), so this client is
 * NOT budget-metered; it still sends the polite-pool `mailto=` param like the
 * OA-location adapter (sources/oa/openalex.ts).
 *
 * Deliberately a SIBLING of, not an extension to, the OA-location adapter:
 * that adapter resolves OA locations for `PaperRecord`s inside the pipeline's
 * SourceCtx (limiter + budget); this one is a standalone support-model lookup.
 * Style matched to the house fetch discipline (run.ts `rawFetch`): native
 * fetch, AbortController timeout, non-OK → thrown `HTTP <status>` error, NO
 * automatic retry (brain-ingest adapters never retry — callers decide). The
 * fetch is injectable so tests stay fully offline. A 404 is NOT an error: it
 * means "OpenAlex knows no source under this ISSN" → `resolved: false`.
 *
 * ESM / NodeNext — imports use explicit `.js` extensions.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

export const OPENALEX_SOURCES_URL = 'https://api.openalex.org/sources';

/** Default fetch abort timeout — mirrors run.ts `rawFetch`. */
const DEFAULT_TIMEOUT_MS = 30_000;

// ─────────────────────────────────────────────────────────────────────────────
// OpenAlex Source response shape (only the fields we read)
// ─────────────────────────────────────────────────────────────────────────────

interface OpenAlexSummaryStats {
  h_index?: number | null;
  /** OpenAlex's impact-factor-like number — literal key with a leading digit. */
  '2yr_mean_citedness'?: number | null;
}

/** An OpenAlex Source entity (only the fields the banding reads). */
export interface OpenAlexSourceEntity {
  id?: string | null;
  display_name?: string | null;
  issn_l?: string | null;
  /** 'journal' | 'repository' | 'conference' | 'ebook platform' | ... */
  type?: string | null;
  is_core?: boolean | null;
  works_count?: number | null;
  summary_stats?: OpenAlexSummaryStats | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Venue info — the cacheable lookup result
// ─────────────────────────────────────────────────────────────────────────────

/** What a per-ISSN lookup yields (cached verbatim — venue/cache.ts). */
export interface VenueInfo {
  /** The normalized ISSN this lookup was keyed on. */
  issn: string;
  /** False when OpenAlex returned no source for the ISSN (HTTP 404). */
  resolved: boolean;
  /** Bare OpenAlex source id (`S…`); null when unresolved. */
  sourceId: string | null;
  displayName: string | null;
  /** OpenAlex source `type` — trusted over work-level types (design gotcha). */
  type: string | null;
  /** Linking ISSN OpenAlex canonicalizes to; null when unresolved/absent. */
  issnL: string | null;
  hIndex: number | null;
  twoYrMeanCitedness: number | null;
  isCore: boolean | null;
  worksCount: number | null;
  /** ISO datetime of the lookup — makes cache staleness visible. */
  fetchedAt: string;
}

/**
 * Normalize an ISSN to the canonical `NNNN-NNNC` form (uppercase check digit,
 * hyphen inserted when missing). Returns null when the input cannot be an
 * ISSN — callers treat that as an unresolvable venue, never as an error.
 */
export function normalizeIssn(raw: string): string | null {
  const compact = raw.trim().toUpperCase().replace(/[\s-]/g, '');
  if (!/^\d{7}[\dX]$/.test(compact)) return null;
  return `${compact.slice(0, 4)}-${compact.slice(4)}`;
}

/** Strip the OpenAlex URL prefix off a source id → bare `S…` (matches extractWorkIds). */
function bareSourceId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return raw.trim().replace(/^https?:\/\/openalex\.org\//i, '');
}

/** Map one OpenAlex Source entity → {@link VenueInfo}. Missing fields degrade to null. */
export function mapSourceToVenueInfo(
  issn: string,
  source: OpenAlexSourceEntity,
  fetchedAt: string,
): VenueInfo {
  const stats = source.summary_stats ?? null;
  return {
    issn,
    resolved: true,
    sourceId: bareSourceId(source.id),
    displayName: source.display_name ?? null,
    type: source.type ?? null,
    issnL: source.issn_l ?? null,
    hIndex: typeof stats?.h_index === 'number' ? stats.h_index : null,
    twoYrMeanCitedness:
      typeof stats?.['2yr_mean_citedness'] === 'number' ? stats['2yr_mean_citedness'] : null,
    isCore: typeof source.is_core === 'boolean' ? source.is_core : null,
    worksCount: typeof source.works_count === 'number' ? source.works_count : null,
    fetchedAt,
  };
}

/** The VenueInfo for an ISSN OpenAlex knows no source for (or a non-ISSN input). */
export function unresolvedVenueInfo(issn: string, fetchedAt: string): VenueInfo {
  return {
    issn,
    resolved: false,
    sourceId: null,
    displayName: null,
    type: null,
    issnL: null,
    hIndex: null,
    twoYrMeanCitedness: null,
    isCore: null,
    worksCount: null,
    fetchedAt,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// The lookup
// ─────────────────────────────────────────────────────────────────────────────

/** Injectable dependencies — tests pass a canned `fetchFn` and a fixed `now`. */
export interface VenueLookupOptions {
  /** Polite-pool contact for the `mailto=` param (design §b2). Omitted when absent. */
  contactEmail?: string;
  /** Injectable fetch (defaults to native `globalThis.fetch`). */
  fetchFn?: typeof fetch;
  /** Abort timeout in ms (default 30s, mirrors run.ts). */
  timeoutMs?: number;
  /** Clock for `fetchedAt` (tests pin it). */
  now?: () => Date;
}

/**
 * Look one ISSN up in OpenAlex Sources. Non-ISSN input and HTTP 404 both
 * resolve to an `unresolved` VenueInfo (typed outcome, not an error); other
 * non-OK statuses throw (`HTTP <status> …`, house style) — no retry.
 */
export async function fetchVenueByIssn(
  rawIssn: string,
  opts: VenueLookupOptions = {},
): Promise<VenueInfo> {
  const now = opts.now ?? ((): Date => new Date());
  const fetchedAt = now().toISOString();

  const issn = normalizeIssn(rawIssn);
  if (issn === null) return unresolvedVenueInfo(rawIssn.trim(), fetchedAt);

  const url = new URL(`${OPENALEX_SOURCES_URL}/issn:${issn}`);
  if (opts.contactEmail !== undefined) url.searchParams.set('mailto', opts.contactEmail);

  const fetchFn = opts.fetchFn ?? globalThis.fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetchFn(url.toString(), { method: 'GET', signal: controller.signal });
    if (res.status === 404) return unresolvedVenueInfo(issn, fetchedAt);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText} for ${url.toString()}`);
    }
    const body = (await res.json()) as OpenAlexSourceEntity;
    return mapSourceToVenueInfo(issn, body, fetchedAt);
  } finally {
    clearTimeout(timer);
  }
}
