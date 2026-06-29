/**
 * Discovery adapter — Europe PMC search (design §2 discovery, §10.3).
 *
 * Europe PMC's REST search returns MEDLINE + PMC + preprint metadata over its
 * OA subset. Keyless and unmetered (design §5.1 table: rate-limited only), so
 * there is no daily budget cap — but every outbound call still routes through
 * the rate limiter (via `ctx.fetchJson`) and records a $0 budget charge so the
 * guardrail accounting stays uniform across adapters.
 *
 *   GET https://www.ebi.ac.uk/europepmc/webservices/rest/search
 *       ?query=<q>&format=json&pageSize=N&resultType=core
 *
 * `resultType=core` is what surfaces the abstract + author list + cross-ids
 * (DOI / PMID / PMCID) we map onto a `Candidate`.
 */

import type {
  Candidate,
  Seed,
  SourceCtx,
  DiscoverFn,
  Identifiers,
} from '../../types.js';
import { normalizeIdentifiers } from '../../identity.js';

const EUROPEPMC_SEARCH_URL =
  'https://www.ebi.ac.uk/europepmc/webservices/rest/search';

/** How many results to request per seed. Europe PMC caps pageSize at 1000. */
const DEFAULT_PAGE_SIZE = 100;

// ─────────────────────────────────────────────────────────────────────────────
// Response shape (the subset we read — Europe PMC `resultType=core`)
// ─────────────────────────────────────────────────────────────────────────────

/** One author block under `result.authorList.author[]`. */
interface EpmcAuthor {
  fullName?: string;
  firstName?: string;
  lastName?: string;
  initials?: string;
}

/** One `resultList.result[]` entry (only the fields we consume). */
export interface EpmcResult {
  /** Europe PMC internal id (e.g. "38000000"); paired with `source`. */
  id?: string;
  /** "MED" | "PMC" | "PPR" | "AGR" | … — the id namespace. */
  source?: string;
  pmid?: string;
  pmcid?: string;
  doi?: string;
  title?: string;
  authorString?: string;
  authorList?: { author?: EpmcAuthor[] };
  journalTitle?: string;
  /** preprint server name when source === "PPR". */
  bookOrReportDetails?: { publisher?: string };
  pubYear?: string;
  abstractText?: string;
}

/** Top-level `/search` JSON envelope. */
export interface EpmcSearchResponse {
  hitCount?: number;
  resultList?: { result?: EpmcResult[] };
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure mapping (fixture-testable, no I/O)
// ─────────────────────────────────────────────────────────────────────────────

/** Normalize a DOI: lowercase, strip a leading resolver prefix. */
function normalizeDoi(raw: string): string {
  return raw
    .trim()
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')
    .toLowerCase();
}

/** Normalize a PMCID to the bare "PMC…" form. */
function normalizePmcid(raw: string): string {
  const t = raw.trim();
  return /^PMC/i.test(t) ? t.toUpperCase() : `PMC${t}`;
}

/**
 * Build the `Identifiers` map from one result, capturing the FULL id set
 * (DOI + PMID + PMCID) that Europe PMC exposes so dedup can link disjoint-id
 * variants at discovery time (design §3, §4). Final canonicalization is delegated
 * to identity's {@link normalizeIdentifiers} (the same normalizer dedup/paperUid
 * use) so the forms are consistent across the pipeline; the local pre-normalizers
 * just trim/strip before that. Empty values are dropped by the normalizer.
 */
function toIdentifiers(r: EpmcResult): Identifiers {
  const raw: Identifiers = {};
  if (r.doi && r.doi.trim()) raw.doi = normalizeDoi(r.doi);
  if (r.pmid && r.pmid.trim()) raw.pmid = r.pmid.trim();
  if (r.pmcid && r.pmcid.trim()) raw.pmcid = normalizePmcid(r.pmcid);
  return normalizeIdentifiers(raw);
}

/** One author block → a display name, preferring `fullName`. */
function authorName(a: EpmcAuthor): string {
  if (a.fullName && a.fullName.trim()) return a.fullName.trim();
  const family = (a.lastName ?? '').trim();
  const given = (a.firstName ?? a.initials ?? '').trim();
  return [family, given].filter(Boolean).join(', ');
}

/** Authors from the structured list, falling back to the flat `authorString`. */
function toAuthors(r: EpmcResult): string[] {
  const list = r.authorList?.author;
  if (list && list.length > 0) {
    const names = list.map(authorName).filter((n) => n.length > 0);
    if (names.length > 0) return names;
  }
  if (r.authorString && r.authorString.trim()) {
    return r.authorString
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
  return [];
}

/** Venue: journal title, else preprint publisher, else null. */
function toVenue(r: EpmcResult): string | null {
  if (r.journalTitle && r.journalTitle.trim()) return r.journalTitle.trim();
  const pub = r.bookOrReportDetails?.publisher;
  if (pub && pub.trim()) return pub.trim();
  return null;
}

/** Parse a 4-digit year string → number, else null. */
function toYear(r: EpmcResult): number | null {
  if (!r.pubYear) return null;
  const n = Number.parseInt(r.pubYear.trim(), 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * Map one Europe PMC `result` → a `Candidate`, or `null` when it carries no
 * usable identity at all (no DOI/PMID/PMCID and no title to fingerprint on).
 */
export function mapResult(r: EpmcResult): Candidate | null {
  const identifiers = toIdentifiers(r);
  const title = (r.title ?? '').trim();
  const hasAnyId =
    identifiers.doi !== undefined ||
    identifiers.pmid !== undefined ||
    identifiers.pmcid !== undefined;
  if (!hasAnyId && title.length === 0) return null;

  const abstract = (r.abstractText ?? '').trim();
  return {
    identifiers,
    title,
    authors: toAuthors(r),
    year: toYear(r),
    venue: toVenue(r),
    abstract: abstract.length > 0 ? abstract : null,
    discoveredVia: 'europepmc',
  };
}

/** Map a full `/search` response envelope → de-duped `Candidate[]`. */
export function mapSearchResponse(resp: EpmcSearchResponse): Candidate[] {
  const results = resp.resultList?.result ?? [];
  const out: Candidate[] = [];
  for (const r of results) {
    const c = mapResult(r);
    if (c) out.push(c);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Adapter
// ─────────────────────────────────────────────────────────────────────────────

export const discover: DiscoverFn = async (
  ctx: SourceCtx,
  seed: Seed,
): Promise<Candidate[]> => {
  // Europe PMC is keyless + unmetered (design §5.1) — no daily cap. Record a
  // $0 charge so the budget guard's per-source accounting stays uniform; the
  // limiter slot is acquired by fetchJson.
  if (ctx.budget.wouldExceed95('europepmc', 0)) return [];
  ctx.budget.charge('europepmc', 0);

  const resp = await ctx.fetchJson<EpmcSearchResponse>(
    'europepmc',
    EUROPEPMC_SEARCH_URL,
    {
      query: {
        query: seed.query,
        format: 'json',
        resultType: 'core',
        pageSize: DEFAULT_PAGE_SIZE,
      },
    },
  );

  return mapSearchResponse(resp);
};
