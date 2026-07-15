/**
 * Unpaywall OA-location adapter (design §2, §3 step 3, §5.1, §10.4).
 *
 * The free, per-DOI fallback used only for DOIs that OpenAlex did not resolve.
 *   GET https://api.unpaywall.org/v2/<doi>?email=<contactEmail>
 * Unpaywall is unmetered (rate-limited only, 100k/day) — so it carries a $0 cost
 * against the budget guard, but every call still routes through the limiter and is
 * gated by the guard for contract uniformity (design §5.1 "route EVERY call").
 *
 * Maps `best_oa_location` → OaInfo. Returns one entry per *resolved* record keyed
 * by `PaperRecord.paperUid`; records without a DOI, or whose lookup 404s/errors,
 * are simply absent from the returned map (the caller leaves their `oa{}` as-is).
 *
 * ESM / NodeNext: import from types with an explicit `.js` extension.
 */

import type {
  PaperRecord,
  OaInfo,
  OaStatus,
  OaVersion,
  SourceCtx,
  ResolveOaFn,
} from '../../types.js';

/** Unpaywall is free / rate-only — zero monetary cost per §5.1. */
const UNPAYWALL_COST = 0;

/** Unpaywall API base; the DOI is appended path-style and the email goes in `query`. */
const UNPAYWALL_BASE = 'https://api.unpaywall.org/v2';

/**
 * The subset of the Unpaywall v2 response this adapter reads.
 * (https://unpaywall.org/data-format — only the fields we map are typed.)
 */
interface UnpaywallOaLocation {
  url?: string | null;
  url_for_pdf?: string | null;
  url_for_landing_page?: string | null;
  license?: string | null;
  version?: string | null;
  host_type?: string | null;
}

interface UnpaywallResponse {
  doi?: string | null;
  is_oa?: boolean | null;
  oa_status?: string | null;
  best_oa_location?: UnpaywallOaLocation | null;
}

/** Normalize a DOI to the §4 bare form: lowercase, no scheme/host prefix. */
function normalizeDoi(raw: string): string {
  let doi = raw.trim().toLowerCase();
  doi = doi.replace(/^https?:\/\/(dx\.)?doi\.org\//, '');
  doi = doi.replace(/^doi:/, '');
  return doi;
}

/** Map Unpaywall `oa_status` to the manifest OaStatus vocabulary (design §8). */
function mapStatus(raw: string | null | undefined, isOa: boolean): OaStatus {
  switch (raw) {
    case 'gold':
    case 'green':
    case 'hybrid':
    case 'bronze':
    case 'closed':
      return raw;
    default:
      // No recognized status: closed if Unpaywall says not-OA, else unknown.
      return isOa ? 'unknown' : 'closed';
  }
}

/** Map Unpaywall `version` (publishedVersion/…) to the manifest OaVersion. */
function mapVersion(raw: string | null | undefined): OaVersion {
  switch (raw) {
    case 'publishedVersion':
      return 'published';
    case 'acceptedVersion':
      return 'accepted';
    case 'submittedVersion':
      return 'submitted';
    default:
      return null;
  }
}

/**
 * Map an Unpaywall `license` string to the manifest license vocabulary
 * ('cc-by' | 'cc-by-nc' | 'cc0' | 'publisher-specific' | null, design §8).
 * Unpaywall already emits short cc-* slugs; anything else non-empty is a
 * publisher-specific license; absent/empty → null.
 */
function mapLicense(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const l = raw.trim().toLowerCase();
  if (l === '') return null;
  if (l === 'cc0' || l === 'public-domain') return 'cc0';
  if (l === 'cc-by') return 'cc-by';
  // cc-by-nc, cc-by-nc-nd, cc-by-nc-sa → all non-commercial CC.
  if (l.startsWith('cc-by-nc')) return 'cc-by-nc';
  if (l.startsWith('cc-by')) return 'cc-by';
  return 'publisher-specific';
}

/** The "no OA copy" result for a DOI Unpaywall reports as closed. */
const CLOSED_OA: OaInfo = {
  isOa: false,
  status: 'closed',
  bestOaUrl: null,
  license: null,
  version: null,
};

/**
 * Pure mapper from a parsed Unpaywall response to OaInfo. Exported for unit
 * testing against fixtures (no network).
 */
export function toOaInfo(res: UnpaywallResponse): OaInfo {
  const isOa = res.is_oa === true;
  if (!isOa) {
    return { ...CLOSED_OA, status: mapStatus(res.oa_status, false) };
  }
  const loc = res.best_oa_location ?? null;
  // Prefer a direct PDF URL; fall back to landing page / generic url.
  const bestOaUrl =
    loc?.url_for_pdf ?? loc?.url ?? loc?.url_for_landing_page ?? null;
  return {
    isOa: true,
    status: mapStatus(res.oa_status, true),
    bestOaUrl,
    license: mapLicense(loc?.license),
    version: mapVersion(loc?.version),
  };
}

/**
 * Resolve OA location for the given records via Unpaywall, one DOI at a time.
 *
 * - Only records with a DOI are looked up (Unpaywall is DOI-only).
 * - Each lookup is gated by the budget guard ($0) and routed through the limiter.
 * - A failed/absent lookup (network/404/parse) is skipped, not thrown, so one bad
 *   DOI never aborts the batch; the caller keeps that record's existing `oa{}`.
 */
export const resolveOa: ResolveOaFn = async (
  ctx: SourceCtx,
  records: PaperRecord[],
): Promise<Map<string, OaInfo>> => {
  const out = new Map<string, OaInfo>();

  for (const record of records) {
    const rawDoi = record.identifiers.doi;
    if (!rawDoi) continue;

    const doi = normalizeDoi(rawDoi);
    if (doi === '') continue;

    // Fail-closed budget gate (Unpaywall cost is $0, so this never trips, but the
    // contract requires every metered/unmetered call to consult the guard first).
    if (ctx.budget.wouldExceed95('unpaywall', UNPAYWALL_COST)) break;

    const url = `${UNPAYWALL_BASE}/${encodeURIComponent(doi)}`;

    try {
      const res = await ctx.fetchJson<UnpaywallResponse>('unpaywall', url, {
        query: { email: ctx.config.contactEmail },
      });
      ctx.budget.charge('unpaywall', UNPAYWALL_COST);
      out.set(record.paperUid, toOaInfo(res));
    } catch {
      // DOI unknown to Unpaywall (404) or transient failure → skip this record.
      continue;
    }
  }

  return out;
};
