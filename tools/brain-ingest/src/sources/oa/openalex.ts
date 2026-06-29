/**
 * OpenAlex bulk OA-location adapter (design §5.1, §10.4).
 *
 * Resolves OA location for a batch of records by **batching up to 50 DOIs per
 * OpenAlex list call** — `GET /works?filter=doi:<d1>|<d2>|…&per-page=50` — which
 * is a *list/filter* request, priced at **$0.0001/call** (§5.1). The whole
 * ~2000-paper corpus costs ≈40 calls ≈ $0.004; the $0.95 hard-stop is a safety
 * net, guarded with `wouldExceed95` before *every* call.
 *
 * Maps each OpenAlex `work` → `OaInfo` keyed by the record's `paperUid`:
 *   isOa      ← open_access.is_oa
 *   status    ← open_access.oa_status   (gold|green|hybrid|bronze|closed)
 *   bestOaUrl ← best_oa_location.pdf_url || landing_page_url
 *   license   ← best_oa_location.license (normalised to the manifest vocab)
 *   version   ← best_oa_location.version (publishedVersion → 'published', …)
 *
 * Network discipline: tests hit fixtures only; the single `fetchJson` call is
 * the sole live path and is routed through `ctx.limiter` (via `ctx.fetchJson`)
 * and metered through `ctx.budget`.
 */

import type { PaperRecord, OaInfo, OaStatus, OaVersion, WorkMeta, Identifiers, SourceCtx } from '../../types.js';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** OpenAlex `filter=doi:` list calls accept up to 50 DOIs per request (§5.1). */
export const OPENALEX_BATCH_SIZE = 50;

/** Cost of one OpenAlex list/filter request (§5.1). Mirrors budget.ts OPENALEX_COST.list. */
export const OPENALEX_LIST_COST = 0.0001;

const OPENALEX_WORKS_URL = 'https://api.openalex.org/works';

// ─────────────────────────────────────────────────────────────────────────────
// OpenAlex response shapes (only the fields we read)
// ─────────────────────────────────────────────────────────────────────────────

interface OpenAlexLocation {
  pdf_url?: string | null;
  landing_page_url?: string | null;
  license?: string | null;
  version?: string | null;
  source?: OpenAlexSource | null;
}

interface OpenAlexSource {
  display_name?: string | null;
  issn?: string[] | null;
  host_organization_name?: string | null;
  type?: string | null;
}

interface OpenAlexOpenAccess {
  is_oa?: boolean | null;
  oa_status?: string | null;
}

interface OpenAlexConcept {
  display_name?: string | null;
}

/** The full id set OpenAlex carries on a Work (`ids{}`) — each a URL/prefixed form. */
interface OpenAlexIds {
  openalex?: string | null;
  doi?: string | null;
  pmid?: string | null;
  pmcid?: string | null;
}

interface OpenAlexWork {
  id?: string | null;
  doi?: string | null;
  ids?: OpenAlexIds | null;
  type?: string | null;
  cited_by_count?: number | null;
  open_access?: OpenAlexOpenAccess | null;
  best_oa_location?: OpenAlexLocation | null;
  primary_location?: OpenAlexLocation | null;
  concepts?: OpenAlexConcept[] | null;
  topics?: OpenAlexConcept[] | null;
}

interface OpenAlexWorksResponse {
  results?: OpenAlexWork[] | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure mapping helpers (unit-tested directly)
// ─────────────────────────────────────────────────────────────────────────────

const OA_STATUSES: readonly OaStatus[] = ['gold', 'green', 'hybrid', 'bronze', 'closed', 'unknown'];

/** Coerce OpenAlex `oa_status` into the manifest vocabulary (§8). */
export function mapOaStatus(raw: string | null | undefined): OaStatus {
  if (!raw) return 'unknown';
  const v = raw.toLowerCase().trim();
  return (OA_STATUSES as readonly string[]).includes(v) ? (v as OaStatus) : 'unknown';
}

/**
 * Normalise an OpenAlex location `version` to the manifest vocab (§8):
 * publishedVersion → 'published', acceptedVersion → 'accepted',
 * submittedVersion → 'submitted'; anything else → null.
 */
export function mapVersion(raw: string | null | undefined): OaVersion {
  if (!raw) return null;
  const v = raw.toLowerCase().trim();
  if (v.startsWith('publish')) return 'published';
  if (v.startsWith('accept')) return 'accepted';
  if (v.startsWith('submit')) return 'submitted';
  return null;
}

/**
 * Normalise an OpenAlex license string to the manifest vocab (§8):
 * 'cc-by' | 'cc-by-nc' | 'cc0' | 'publisher-specific' | null.
 * OpenAlex emits e.g. 'cc-by', 'cc-by-nc-nd', 'cc0', 'publisher-specific-oa'.
 */
export function mapLicense(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.toLowerCase().trim();
  if (v === 'cc0' || v === 'public-domain') return 'cc0';
  if (v.startsWith('cc-by-nc')) return 'cc-by-nc';
  if (v.startsWith('cc-by')) return 'cc-by';
  if (v.includes('publisher')) return 'publisher-specific';
  return v;
}

/** Map one OpenAlex work → OaInfo. Closed / missing locations degrade gracefully. */
export function mapWorkToOaInfo(work: OpenAlexWork): OaInfo {
  const oa = work.open_access ?? null;
  const loc = work.best_oa_location ?? null;
  const isOa = oa?.is_oa === true;
  const bestOaUrl = loc ? (loc.pdf_url ?? loc.landing_page_url ?? null) : null;
  return {
    isOa,
    status: mapOaStatus(oa?.oa_status),
    bestOaUrl,
    license: mapLicense(loc?.license),
    version: mapVersion(loc?.version),
  };
}

/**
 * Extract the work's full external id set into a {@link Identifiers}-shaped map
 * (design §4 reconciliation). OpenAlex emits each id as a URL/prefixed form:
 *   ids.doi   → https://doi.org/<doi>
 *   ids.pmid  → https://pubmed.ncbi.nlm.nih.gov/<pmid>
 *   ids.pmcid → https://www.ncbi.nlm.nih.gov/pmc/articles/PMC<n>
 *   ids.openalex / work.id → https://openalex.org/<W…>
 * We strip the URL/host prefixes here to the bare values identity.ts's
 * `normalizeIdentifiers` expects (it canonicalizes the DOI/PMID/PMCID further);
 * `openalex` is kept as the bare `W…` id. Falls back to the top-level `work.doi`
 * when `ids.doi` is absent.
 */
export function extractWorkIds(work: OpenAlexWork): Partial<Identifiers> {
  const ids = work.ids ?? null;
  const out: Partial<Identifiers> = {};

  const rawDoi = ids?.doi ?? work.doi ?? null;
  if (rawDoi) out.doi = normalizeDoi(rawDoi);

  if (ids?.pmid) {
    // strip the pubmed URL host → bare PMID integer (identity normalizes the rest)
    out.pmid = ids.pmid.trim().replace(/^https?:\/\/[^/]*pubmed[^/]*\/?/i, '').replace(/\/+$/, '');
  }
  if (ids?.pmcid) {
    // strip the ncbi pmc URL → leave the `PMC…` token (identity normalizes casing)
    const m = ids.pmcid.trim().match(/PMC\d+/i);
    out.pmcid = m ? m[0] : ids.pmcid.trim().replace(/^https?:\/\/.*\//, '');
  }
  const rawOa = ids?.openalex ?? work.id ?? null;
  if (rawOa) out.openalex = rawOa.trim().replace(/^https?:\/\/openalex\.org\//i, '');

  return out;
}

/** The OaInfo for a DOI OpenAlex returned no work for / could not resolve. */
function unknownOaInfo(): OaInfo {
  return { isOa: false, status: 'unknown', bestOaUrl: null, license: null, version: null };
}

/** Max subject/topic display names captured per work (dashboard facets, §8). */
const MAX_CONCEPTS = 5;

/**
 * Extract the richer metadata (citation count, structured journal/source, work
 * type, subject concepts) from an OpenAlex work → {@link WorkMeta}. Reads the
 * `primary_location.source` for journal detail and the top ~5 `concepts`
 * (preferring `topics` when present). Missing fields degrade to null/empty.
 */
export function mapWorkToMeta(work: OpenAlexWork): WorkMeta {
  const source = work.primary_location?.source ?? null;
  const issn = Array.isArray(source?.issn) ? source!.issn.filter((s): s is string => typeof s === 'string') : [];
  const raw = (work.topics && work.topics.length > 0 ? work.topics : work.concepts) ?? [];
  const concepts = raw
    .map((c) => c.display_name)
    .filter((n): n is string => typeof n === 'string' && n.length > 0)
    .slice(0, MAX_CONCEPTS);
  return {
    citedByCount: typeof work.cited_by_count === 'number' ? work.cited_by_count : null,
    journal: {
      issn,
      publisher: source?.host_organization_name ?? null,
      type: source?.type ?? null,
    },
    workType: work.type ?? null,
    concepts,
  };
}

/** The WorkMeta for a DOI OpenAlex returned no work for / could not resolve. */
function unknownWorkMeta(): WorkMeta {
  return {
    citedByCount: null,
    journal: { issn: [], publisher: null, type: null },
    workType: null,
    concepts: [],
  };
}

/**
 * Normalise a DOI to OpenAlex's expected bare form: lowercased, with any
 * `https://doi.org/` (or `doi:`) prefix stripped. Matches §4 normalize(doi).
 */
export function normalizeDoi(doi: string): string {
  return doi
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//, '')
    .replace(/^doi:/, '');
}

/** Split an array into fixed-size chunks. */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (size <= 0) throw new RangeError('chunk size must be > 0');
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Resolver
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve OA location for `records` in bulk via OpenAlex batched list calls.
 *
 * Returns a Map keyed by `PaperRecord.paperUid`. Records without a DOI are
 * skipped (no OpenAlex DOI filter possible → caller falls through to Unpaywall
 * / leaves `unknown`). A record whose DOI OpenAlex returns no work for is mapped
 * to an explicit `unknown` OaInfo so the caller can distinguish "asked, no OA"
 * from "never asked".
 *
 * Budget discipline (§5.1): before each list call we check `wouldExceed95`; if
 * the next $0.0001 charge would cross the 95% line we **stop cleanly** — the
 * already-resolved entries are returned and the remaining DOIs are simply left
 * absent from the map (caller treats them as not-yet-resolved, never `failed`).
 */
export const resolveOa = async (
  ctx: SourceCtx,
  records: PaperRecord[],
): Promise<Map<string, { oa: OaInfo; meta: WorkMeta; ids: Partial<Identifiers> }>> => {
  const result = new Map<string, { oa: OaInfo; meta: WorkMeta; ids: Partial<Identifiers> }>();

  // DOI (normalised) → the paperUids that carry it. One DOI can back several
  // records (e.g. duplicate discovery); all of them get the same OaInfo.
  const doiToUids = new Map<string, string[]>();
  for (const rec of records) {
    const doi = rec.identifiers.doi;
    if (!doi) continue;
    const norm = normalizeDoi(doi);
    if (!norm) continue;
    const uids = doiToUids.get(norm);
    if (uids) uids.push(rec.paperUid);
    else doiToUids.set(norm, [rec.paperUid]);
  }

  const dois = [...doiToUids.keys()];
  if (dois.length === 0) return result;

  const email = ctx.config.contactEmail;
  const apiKey = ctx.config.keys.openalex;

  for (const batch of chunk(dois, OPENALEX_BATCH_SIZE)) {
    // Fail-closed budget guard: stop before the charge that would cross 95%.
    if (ctx.budget.wouldExceed95('openalex', OPENALEX_LIST_COST)) break;
    ctx.budget.charge('openalex', OPENALEX_LIST_COST);

    const resp = await ctx.fetchJson<OpenAlexWorksResponse>('openalex', OPENALEX_WORKS_URL, {
      query: {
        filter: `doi:${batch.join('|')}`,
        'per-page': OPENALEX_BATCH_SIZE,
        api_key: apiKey,
        mailto: email,
      },
    });

    const works = resp.results ?? [];
    // Track which DOIs in this batch OpenAlex actually returned, so the rest
    // can be recorded as explicit `unknown`.
    const seen = new Set<string>();
    for (const work of works) {
      if (!work.doi) continue;
      const norm = normalizeDoi(work.doi);
      const uids = doiToUids.get(norm);
      if (!uids) continue;
      seen.add(norm);
      const oa = mapWorkToOaInfo(work);
      const meta = mapWorkToMeta(work);
      const ids = extractWorkIds(work);
      for (const uid of uids) result.set(uid, { oa, meta, ids });
    }
    for (const norm of batch) {
      if (seen.has(norm)) continue;
      const uids = doiToUids.get(norm);
      if (!uids) continue;
      const oa = unknownOaInfo();
      const meta = unknownWorkMeta();
      // OpenAlex returned no work → no new ids to contribute.
      for (const uid of uids) result.set(uid, { oa, meta, ids: {} });
    }
  }

  return result;
};
