/**
 * CORE v3 retrieval adapter (design §2 full-text table, §3 step 5a, §5, §5.1, §10.5).
 *
 * CORE is a general open-access aggregator that serves full text two ways:
 *   1. a **pre-extracted `fullText`** string on the work record (preferred — no
 *      PDF re-parsing, cleaner text), and
 *   2. the **binary PDF** via `GET /v3/outputs/{id}/download` (302 → PDF bytes).
 *
 * This adapter prefers (1): it looks the record up by DOI (or CORE id) through
 * `GET https://api.core.ac.uk/v3/search/works` and, if a non-empty `fullText`
 * field is present, returns it as extracted text with `method:'core'`. Otherwise
 * it falls back to (2), downloading the PDF binary which a later extract step
 * (`unpdf`) turns into text (`method:'pdf'`).
 *
 * RATE LIMIT (§5.1, verified live 2026-07-01): CORE is NOT a daily-quota
 * budget like OpenAlex — it's a **~10-request token bucket per ~60s window**
 * that fully refills once emptied (confirmed by hitting a real 429 and
 * watching `x-ratelimit-remaining` reset 60s later). There is no evidence of
 * any coarser daily cap on a free personal key, so CORE is deliberately
 * **absent from `BUDGETS`** (`limits/budget.ts`) — its own budget-guard checks
 * were removed. The real constraint is enforced proactively by the `'core'`
 * rate-limiter profile (`limits/rateLimiter.ts`, paced to match the bucket)
 * with a reactive backstop below: a 429 that slips through anyway is retried
 * once after ~61s (the bucket's confirmed refill window), not treated as a
 * hard failure.
 *
 * RETRIEVAL CONTRACT (types.ts `RetrieveFn`): returns
 *   { storage: StorageInfo; fullText: FullTextInfo }  on success, or
 *   null                                              when CORE cannot serve it
 * so the caller falls through to the next source. The brief's "core-fulltext"
 * vs "pdf" outcome is expressed on the contract-legal `fullText.method` field
 * ('core' | 'pdf'); the bytes/text live under R2 (`storage.kind:'object'`),
 * uploaded by the storage layer in 10.5 — here we surface the fetched bytes /
 * char-count so that step can persist them.
 *
 * NETWORK: every outbound call routes through `ctx.fetchJson` / `ctx.fetchBytes`
 * (which run inside the per-source rate limiter), wrapped in the shared
 * `retryWithBackoff` (429/5xx-aware, §10.7) tuned to CORE's real refill window.
 * No live calls in tests — the parse/select logic is pure and is exercised
 * against fixtures via the exported helpers below.
 *
 * SKIP `paywalled` RECORDS ENTIRELY (no query issued): `retrievability:
 * 'paywalled'` means the OA-location step (OpenAlex/Unpaywall) already
 * determined there is no known open-access copy. CORE's index heavily overlaps
 * theirs, so querying it here is a near-zero-yield request — live corpus data
 * showed paywalled/unknown records as the single largest category of CORE
 * calls that came back empty. `unknown` records still get a real query:
 * OA-location genuinely couldn't resolve them (not "confirmed no OA"), so
 * CORE has a legitimate chance of knowing something OpenAlex/Unpaywall don't.
 */

import type {
  PaperRecord,
  StorageInfo,
  FullTextInfo,
  SourceCtx,
  RetrieveFn,
  FetchOptions,
} from '../types.js';
import { retryWithBackoff, type RetryOptions } from './capture.js';

// ─────────────────────────────────────────────────────────────────────────────
// CORE v3 wire shapes (the subset we read — camelCase, design §2 "TS notes")
// ─────────────────────────────────────────────────────────────────────────────

/** One work object inside a `/v3/search/works` response. */
export interface CoreWork {
  /** CORE's own numeric output id — drives the `/outputs/{id}/download` route. */
  id?: number | string;
  doi?: string | null;
  title?: string | null;
  /** Pre-extracted plain text (preferred). Often null/empty when CORE has only a link. */
  fullText?: string | null;
  /** Direct download URL CORE advertises (informational; we use the id route). */
  downloadUrl?: string | null;
}

/** Top-level `/v3/search/works` envelope. */
export interface CoreSearchResponse {
  totalHits?: number;
  limit?: number;
  offset?: number;
  results?: CoreWork[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const CORE_API_BASE = 'https://api.core.ac.uk/v3';
/** CORE budget unit is tokens; one request costs one token (§5.1). */
export const CORE_TOKENS_PER_REQUEST = 1;
/** A `fullText` shorter than this is treated as absent (link stubs, whitespace). */
const MIN_FULLTEXT_CHARS = 200;

// ─────────────────────────────────────────────────────────────────────────────
// Pure selection / mapping logic (unit-tested against fixtures, no network)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pick the best work from a CORE search response for `record`.
 * Prefers an exact DOI match (case-insensitive); else the first result that
 * carries usable content (a `fullText` or a resolvable `id`). Returns null when
 * the response is empty or no result is usable.
 */
export function selectCoreWork(
  resp: CoreSearchResponse,
  record: Pick<PaperRecord, 'identifiers'>,
): CoreWork | null {
  const results = resp.results;
  if (!results || results.length === 0) return null;

  const wantDoi = normalizeDoi(record.identifiers.doi);
  if (wantDoi) {
    const exact = results.find((w) => normalizeDoi(w.doi) === wantDoi);
    if (exact) return exact;
  }

  // No DOI match → first result that can actually serve text or a download.
  const usable = results.find((w) => hasUsableFullText(w) || hasDownloadableId(w));
  return usable ?? null;
}

/** True when a work carries pre-extracted full text worth using. */
export function hasUsableFullText(work: CoreWork): boolean {
  const ft = work.fullText;
  return typeof ft === 'string' && ft.trim().length >= MIN_FULLTEXT_CHARS;
}

/** True when a work has a CORE output id we can hit `/outputs/{id}/download` with. */
export function hasDownloadableId(work: CoreWork): boolean {
  return coreOutputId(work) !== null;
}

/** The `/v3/outputs/{id}/download` path for a work, or null if it has no id. */
export function coreDownloadPath(work: CoreWork): string | null {
  const id = coreOutputId(work);
  return id === null ? null : `${CORE_API_BASE}/outputs/${id}/download`;
}

/** Normalize a CORE output id to a non-empty string, or null. */
export function coreOutputId(work: CoreWork): string | null {
  const { id } = work;
  if (typeof id === 'number' && Number.isFinite(id)) return String(id);
  if (typeof id === 'string' && id.trim().length > 0) return id.trim();
  return null;
}

/** Lowercase + strip the doi.org prefix; undefined/empty → null. */
export function normalizeDoi(doi: string | null | undefined): string | null {
  if (!doi) return null;
  const cleaned = doi
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//, '')
    .replace(/^doi:/, '');
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * Build the `{ storage, fullText }` patch for a successful **pre-extracted**
 * full-text hit (the preferred path → `method:'core'`).
 */
export function fulltextOutcome(
  paperUid: string,
  text: string,
): { storage: StorageInfo; fullText: FullTextInfo } {
  const charCount = text.length;
  return {
    storage: {
      kind: 'object',
      key: `text/${paperUid}.txt`,
      contentType: 'text/plain; charset=utf-8',
      sizeBytes: Buffer.byteLength(text, 'utf8'),
    },
    fullText: { extracted: true, method: 'core', charCount },
  };
}

/**
 * Build the `{ storage, fullText }` patch for a downloaded **PDF binary** (the
 * fallback path → `method:'pdf'`). Text isn't extracted here — `unpdf` does that
 * in the extract step — so `fullText.extracted` is false / `charCount` null.
 */
export function pdfOutcome(
  paperUid: string,
  bytes: Uint8Array,
): { storage: StorageInfo; fullText: FullTextInfo } {
  return {
    storage: {
      kind: 'object',
      key: `pdf/${paperUid}.pdf`,
      contentType: 'application/pdf',
      sizeBytes: bytes.byteLength,
    },
    fullText: { extracted: false, method: 'pdf', charCount: null },
  };
}

/** The search query string CORE expects for a DOI / title lookup of a record. */
export function buildSearchQuery(record: Pick<PaperRecord, 'identifiers' | 'title'>): string {
  const doi = normalizeDoi(record.identifiers.doi);
  if (doi) return `doi:"${doi}"`;
  if (record.title && record.title.trim().length > 0) return `title:"${record.title.trim()}"`;
  return '';
}

// ─────────────────────────────────────────────────────────────────────────────
// The retrieval adapter (live calls at runtime only; routed through ctx)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * How long to wait before retrying a 429 (design §2/§5.1, verified live
 * 2026-07-01): CORE's token bucket refills fully within ~60s of exhaustion, so
 * a single ~61s wait-and-retry recovers from the real limit rather than a
 * generic exponential backoff (which would need dozens of tiny retries to
 * reach 60s). Only 2 attempts total — a second 429 means something's
 * genuinely wrong (or another process is sharing the key), so we give up and
 * leave the paper `discovered` for a later run rather than blocking this one.
 */
const CORE_RETRY_OPTIONS = { attempts: 2, baseDelayMs: 61_000, maxDelayMs: 61_000, factor: 1, jitter: 0.1 };

/** Fetch JSON through the shared retry helper (429/5xx-aware, §10.7). Exported for tests. */
export async function fetchJsonWithRetry<T>(
  ctx: SourceCtx,
  url: string,
  opts: FetchOptions,
  retryOpts: RetryOptions = CORE_RETRY_OPTIONS,
): Promise<T> {
  return retryWithBackoff(() => ctx.fetchJson<T>('core', url, opts), retryOpts);
}

/** Fetch bytes through the shared retry helper (429/5xx-aware, §10.7). Exported for tests. */
export async function fetchBytesWithRetry(
  ctx: SourceCtx,
  url: string,
  opts: FetchOptions,
  retryOpts: RetryOptions = CORE_RETRY_OPTIONS,
): Promise<Uint8Array> {
  return retryWithBackoff(() => ctx.fetchBytes('core', url, opts), retryOpts);
}

export const retrieve: RetrieveFn = async (ctx: SourceCtx, record: PaperRecord) => {
  // Source must be enabled (CORE key present) — otherwise we cannot serve it.
  if (!ctx.config.enabled.core || !ctx.config.keys.core) return null;

  // OA-location already confirmed no open-access copy exists — don't spend a
  // request asking CORE to confirm it again (see module docstring).
  if (record.retrievability === 'paywalled') return null;

  const query = buildSearchQuery(record);
  if (query === '') return null; // nothing to look up by

  const authHeaders: Record<string, string> = {
    Authorization: `Bearer ${ctx.config.keys.core}`,
  };

  // ── Request 1: search works ──────────────────────────────────────────────────
  // No budget-guard check here (design §5.1 note above): CORE has no confirmed
  // daily quota, only the ~10-req/60s bucket the rate limiter paces to. A 429
  // that slips through anyway is retried once after the bucket's known refill
  // window rather than treated as a hard failure.
  const searchOpts: FetchOptions = {
    headers: authHeaders,
    query: { q: query, limit: 5 },
  };

  let resp: CoreSearchResponse;
  try {
    resp = await fetchJsonWithRetry<CoreSearchResponse>(ctx, `${CORE_API_BASE}/search/works`, searchOpts);
  } catch {
    return null;
  }

  const work = selectCoreWork(resp, record);
  if (!work) return null;

  // ── Preferred: pre-extracted fullText (no second request) ────────────────────
  if (hasUsableFullText(work)) {
    // hasUsableFullText guarantees a non-empty string.
    return fulltextOutcome(record.paperUid, (work.fullText as string).trim());
  }

  // ── Fallback: download the PDF binary (302 → bytes) ──────────────────────────
  const downloadUrl = coreDownloadPath(work);
  if (!downloadUrl) return null;

  let bytes: Uint8Array;
  try {
    bytes = await fetchBytesWithRetry(ctx, downloadUrl, { headers: authHeaders });
  } catch {
    return null;
  }
  if (bytes.byteLength === 0) return null;

  return pdfOutcome(record.paperUid, bytes);
};

export default retrieve;
