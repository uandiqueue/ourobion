/**
 * NCBI ID Converter crosswalk enrichment (design §3, §4).
 *
 * The reconciliation pass (§4) can only merge two representations of one paper
 * when their `identifiers` SHARE a real external id. But discovery sources often
 * expose DISJOINT ids — e.g. OpenAlex gives a brand-new 2026 paper a PMID but no
 * PMCID, while a legacy Europe PMC record carries only the PMCID. Same paper, no
 * overlap → reconcile can't link them.
 *
 * NCBI's **ID Converter** maps PMID ↔ PMCID ↔ DOI authoritatively, so filling the
 * gaps here (e.g. adding the PMCID to the DOI/PMID record) gives the two records a
 * shared id and lets reconciliation collapse them + drop the orphan.
 *
 *   GET https://www.ncbi.nlm.nih.gov/pmc/utils/idconv/v1.0/
 *       ?ids=<mixed csv>&format=json&tool=ourobion-brain-ingest&email=<contact>
 *       [&api_key=<NCBI_API_KEY>]
 *
 * The endpoint auto-detects id type and accepts MIXED PMID/PMCID/DOI inputs. It is
 * free, keyless, and unmetered (rate-limited only). BUT it is much stricter than the
 * E-utilities and effectively IGNORES the api_key, so the `'pubmed'` bucket's keyed
 * 10/s pacing is too fast and live runs get HTTP 429. We therefore:
 *   - batch SMALL (≤50 ids/request, was ≤200),
 *   - fire batches strictly SEQUENTIALLY (await each before the next — never concurrent),
 *   - and RETRY 429/5xx with exponential backoff (honoring `Retry-After`).
 * Calls still route through the NCBI rate bucket (`ctx.limiter.schedule('pubmed', …)`)
 * for shared pacing, with NO budget charge. Best-effort: after retries are exhausted
 * a batch is logged and skipped; the pipeline never throws here.
 *
 * NO live network at test time — tests drive a stub `SourceCtx` over a fixture.
 *
 * ESM / NodeNext — imports use explicit `.js` extensions.
 */

import type { Identifiers, PaperRecord, SourceCtx } from '../types.js';
import { mergeIdentifiers, normalizeIdentifiers } from '../identity.js';
import { retryWithBackoff } from '../retrieval/capture.js';

/** NCBI ID Converter endpoint (https; keyless). */
const IDCONV_URL = 'https://www.ncbi.nlm.nih.gov/pmc/utils/idconv/v1.0/';

/**
 * Max ids per request. The converter ACCEPTS up to 200, but it is rate-strict and
 * 429s readily, so we keep batches small (50) to stay polite and reduce blast radius.
 */
export const IDCONV_BATCH_SIZE = 50;

/** Max attempts per batch (1 initial + 3 retries) before giving up on it. */
export const IDCONV_MAX_ATTEMPTS = 4;

/** A fetch failure carrying the HTTP status — `httpStatusOf` reads `.status`. */
interface HttpStatusError extends Error {
  status: number;
}

/** One crosswalk record the converter returns (only the fields we read). */
interface IdConvRecord {
  pmcid?: string | null;
  pmid?: string | null;
  doi?: string | null;
  status?: string | null;
  errmsg?: string | null;
}

/** Top-level ID Converter JSON envelope. */
interface IdConvResponse {
  records?: IdConvRecord[] | null;
}

/** Split an array into fixed-size chunks. */
function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Build the de-duplicated list of every distinct PMID / PMCID present across
 * `records`, in canonical (normalized) form.
 *
 * DOIs are deliberately EXCLUDED: preprint / non-PMC DOIs (osf.io, preprints.org,
 * and multi-slash `…/v1` version forms) make the converter `400` the WHOLE batch,
 * and PMID↔PMCID is the only crosswalk reconciliation needs — a DOI record already
 * carries its DOI; what it may lack is the PMCID, which its PMID resolves. PMIDs and
 * PMCIDs are clean NCBI ids the converter always parses, so this never 400s.
 */
export function collectQueryIds(records: PaperRecord[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (v: string | undefined): void => {
    if (v == null || v === '' || seen.has(v)) return;
    seen.add(v);
    out.push(v);
  };
  for (const rec of records) {
    const ids = normalizeIdentifiers(rec.identifiers);
    add(ids.pmid);
    add(ids.pmcid);
  }
  return out;
}

/**
 * Normalize one ID Converter record's {pmid, pmcid, doi} into our `Identifiers`
 * shape (the converter emits `PMC…`, bare PMID digits, and a bare doi). Drops
 * per-record errors (`status:"error"` / `errmsg`). Returns `null` when nothing
 * usable is present.
 */
export function recordToIdentifiers(r: IdConvRecord): Identifiers | null {
  if ((r.status != null && r.status.toLowerCase() === 'error') || r.errmsg != null) return null;
  const raw: Identifiers = {};
  if (r.doi != null && r.doi !== '') raw.doi = r.doi;
  if (r.pmid != null && r.pmid !== '') raw.pmid = r.pmid;
  if (r.pmcid != null && r.pmcid !== '') raw.pmcid = r.pmcid;
  const norm = normalizeIdentifiers(raw);
  return Object.keys(norm).length > 0 ? norm : null;
}

/**
 * The ID Converter's own notion of an id type. It infers exactly ONE per request and 400s on a
 * mixed batch, so this is what we must partition by.
 */
export type IdConvType = 'pmcid' | 'pmid' | 'doi';

/**
 * Classify one query id the way the converter does: `PMC…` is a pmcid, all-digits is a pmid,
 * anything else is treated as a doi. Returns `null` for an id we should not send at all, so an
 * empty or unrecognisable value cannot poison an otherwise valid batch.
 */
export function idConvTypeOf(id: string): IdConvType | null {
  const v = id.trim();
  if (v === '') return null;
  if (/^PMC\d+$/i.test(v)) return 'pmcid';
  if (/^\d+$/.test(v)) return 'pmid';
  // A doi is the only remaining shape the converter accepts; require the `10.` registrant
  // prefix rather than waving through arbitrary junk.
  if (/^10\.\S+\/\S+/.test(v)) return 'doi';
  return null;
}

/**
 * Partition query ids by converter id type, then chunk each partition to {@link IDCONV_BATCH_SIZE}.
 *
 * Every yielded batch is therefore HOMOGENEOUS, which is what keeps the converter from 400ing (see
 * the call site for the measured evidence). Order is deterministic — pmcid, then pmid, then doi, each
 * preserving input order — so a run is reproducible and test expectations are stable.
 */
export function idConvBatches(queryIds: readonly string[]): string[][] {
  const groups = new Map<IdConvType, string[]>([
    ['pmcid', []],
    ['pmid', []],
    ['doi', []],
  ]);
  for (const id of queryIds) {
    const type = idConvTypeOf(id);
    if (type === null) continue; // unsendable id: dropped rather than allowed to fail a batch
    groups.get(type)!.push(id);
  }
  const out: string[][] = [];
  for (const ids of groups.values()) {
    if (ids.length > 0) out.push(...chunk(ids, IDCONV_BATCH_SIZE));
  }
  return out;
}

/** Build the ID Converter request URL with the polite-pool query params. */
function buildIdConvUrl(ctx: SourceCtx, batch: string[]): string {
  const u = new URL(IDCONV_URL);
  u.searchParams.set('ids', batch.join(','));
  u.searchParams.set('format', 'json');
  u.searchParams.set('tool', 'ourobion-brain-ingest');
  u.searchParams.set('email', ctx.config.contactEmail);
  // Passed for politeness even though the converter effectively ignores it.
  const apiKey = ctx.config.keys.ncbi;
  if (apiKey !== undefined) u.searchParams.set('api_key', apiKey);
  return u.toString();
}

/**
 * One status-aware ID Converter GET, routed through the `'pubmed'` rate bucket for
 * shared NCBI pacing. Returns the parsed body on 2xx; throws a status-bearing Error
 * on non-2xx (so the shared {@link retryWithBackoff} / `httpStatusOf` can read the
 * 429/5xx and decide to retry). We read the status ourselves rather than going
 * through `ctx.fetchJson` (which throws a status-less generic Error). A network-level
 * error propagates as-is — its message matches the shared retryable-network patterns.
 */
async function fetchBatchOnce(ctx: SourceCtx, batch: string[]): Promise<IdConvResponse> {
  return ctx.limiter.schedule('pubmed', async () => {
    const res = await fetch(buildIdConvUrl(ctx, batch));
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status} ${res.statusText}`) as HttpStatusError;
      err.status = res.status;
      throw err;
    }
    return (await res.json()) as IdConvResponse;
  });
}

/**
 * Fetch one batch with retry-on-429/5xx + transient-network, exponential backoff.
 * Delegates to the shared {@link retryWithBackoff} (design §10.7): up to
 * {@link IDCONV_MAX_ATTEMPTS} attempts, jitter disabled for determinism. The batches
 * themselves are fired SEQUENTIALLY by the caller (the converter 429s under bursts).
 * `backoffBaseMs` is injectable so tests pass 0 for instant runs. Returns the parsed
 * body, or null when every attempt failed (best-effort — never throws).
 */
async function fetchBatchWithRetry(
  ctx: SourceCtx,
  batch: string[],
  backoffBaseMs: number,
  log: (line: string) => void,
): Promise<IdConvResponse | null> {
  try {
    return await retryWithBackoff(() => fetchBatchOnce(ctx, batch), {
      attempts: IDCONV_MAX_ATTEMPTS,
      baseDelayMs: backoffBaseMs,
      jitter: 0,
    });
  } catch (err) {
    log(`  idconv: batch failed after retries — ${err instanceof Error ? err.message : String(err)} (skipped)`);
    return null;
  }
}

/**
 * Crosswalk-enrich `records` IN PLACE via the NCBI ID Converter (design §3, §4).
 *
 * Collects every distinct pmid/pmcid/doi across the batch, asks the converter for
 * the linked id sets, then for every record that already carries ANY id in a
 * returned set, gap-fills the missing pmid/pmcid/doi (existing non-null ids win —
 * `mergeIdentifiers(existing, crosswalk)`). Batches are SMALL (≤50) and fired
 * SEQUENTIALLY with retry-on-429/5xx + backoff. Best-effort: a batch that fails all
 * retries is logged and skipped; the function never throws out of the pipeline.
 *
 * `backoffBaseMs` seeds the retry backoff (default ~1s real; tests pass 0).
 */
export async function enrichWithIdConverter(
  ctx: SourceCtx,
  records: PaperRecord[],
  log: (line: string) => void = () => {},
  backoffBaseMs = 1000,
): Promise<void> {
  const queryIds = collectQueryIds(records);
  if (queryIds.length === 0) return;

  // Each known input id → the full crosswalked id set it belongs to. One id can
  // map to a set carrying the other two; we key by every id IN that set so any
  // record matches on whichever id it holds.
  const linkByKey = new Map<string, Identifiers>();

  // SEQUENTIAL: await each batch before starting the next (no concurrent idconv
  // requests — the converter 429s under any burst).
  //
  // HOMOGENEOUS BY ID TYPE, and that is load-bearing. The converter infers ONE `idtype` per
  // request and rejects a request mixing types with a flat HTTP 400. Verified directly against
  // the live endpoint:
  //
  //     ids=<pmid>,<pmid>    -> 200 ok, idtype=pmid
  //     ids=<pmcid>,<pmcid>  -> 200 ok, idtype=pmcid
  //     ids=<pmid>,<pmcid>   -> 400 Bad Request     <- the mix we were actually sending
  //
  // `collectQueryIds` already excludes DOIs (the file docstring records why: a preprint DOI
  // 400s the whole batch), so DOIs were never the problem. But it collects PMIDs *and* PMCIDs
  // into one list, and chunking that list produced batches carrying both — two id types, hence
  // the 400. Retries cannot help: 400 is not transient. Observed as 138 of 138 batches failing
  // and 0 papers fetched on the #307 bounded ingestion run.
  //
  // Deliberately partitioning rather than restricting to one type: PMIDs and PMCIDs are both
  // legitimate query ids, and dropping either would lose crosswalk coverage. Note this bug can
  // only fire once a corpus holds records of both shapes — which is why it can lie dormant and
  // then appear to be caused by whatever most recently changed the corpus mix.
  for (const batch of idConvBatches(queryIds)) {
    const resp = await fetchBatchWithRetry(ctx, batch, backoffBaseMs, log);
    if (resp === null) continue; // batch skipped after retries — keep going

    for (const r of resp.records ?? []) {
      const ids = recordToIdentifiers(r);
      if (ids === null) continue;
      // Index this id set under each of its own ids so a record holding any one of
      // them can be matched and gap-filled.
      for (const key of [ids.doi, ids.pmid, ids.pmcid]) {
        if (key != null && key !== '') linkByKey.set(key, ids);
      }
    }
  }

  if (linkByKey.size === 0) return;

  let filled = 0;
  for (const rec of records) {
    const cur = normalizeIdentifiers(rec.identifiers);
    // Find the crosswalk set this record belongs to via any of its current ids.
    const link =
      (cur.doi != null ? linkByKey.get(cur.doi) : undefined) ??
      (cur.pmid != null ? linkByKey.get(cur.pmid) : undefined) ??
      (cur.pmcid != null ? linkByKey.get(cur.pmcid) : undefined);
    if (link === undefined) continue;
    // Gap-fill: existing non-null ids win on conflict; the crosswalk fills holes.
    const merged = mergeIdentifiers(cur, link);
    // Only count/replace when the crosswalk actually added something.
    const before = Object.keys(cur).length;
    if (Object.keys(merged).length > before) filled++;
    rec.identifiers = merged;
  }

  if (filled > 0) log(`  idconv: crosswalk filled ids on ${filled} record(s)`);
}
