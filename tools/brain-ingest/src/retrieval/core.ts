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
 * BUDGET (§5.1): CORE is metered in **tokens** (1000/day, hard stop 950). We
 * charge **1 token per request** and guard `wouldExceed95` *before* dispatching
 * — fail-closed. The download fallback is a second request → a second token.
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
 * (which run inside the per-source rate limiter); we charge the budget guard
 * explicitly. No live calls in tests — the parse/select logic is pure and is
 * exercised against fixtures via the exported helpers below.
 */

import type {
  PaperRecord,
  StorageInfo,
  FullTextInfo,
  SourceCtx,
  RetrieveFn,
  FetchOptions,
} from '../types.js';

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

export const retrieve: RetrieveFn = async (ctx: SourceCtx, record: PaperRecord) => {
  // Source must be enabled (CORE key present) — otherwise we cannot serve it.
  if (!ctx.config.enabled.core || !ctx.config.keys.core) return null;

  const query = buildSearchQuery(record);
  if (query === '') return null; // nothing to look up by

  const authHeaders: Record<string, string> = {
    Authorization: `Bearer ${ctx.config.keys.core}`,
  };

  // ── Request 1: search works (1 token) ───────────────────────────────────────
  if (ctx.budget.wouldExceed95('core', CORE_TOKENS_PER_REQUEST)) return null;
  ctx.budget.charge('core', CORE_TOKENS_PER_REQUEST);

  const searchOpts: FetchOptions = {
    headers: authHeaders,
    query: { q: query, limit: 5 },
  };

  let resp: CoreSearchResponse;
  try {
    resp = await ctx.fetchJson<CoreSearchResponse>(
      'core',
      `${CORE_API_BASE}/search/works`,
      searchOpts,
    );
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

  // ── Fallback: download the PDF binary (302 → bytes), 1 more token ────────────
  const downloadUrl = coreDownloadPath(work);
  if (!downloadUrl) return null;

  if (ctx.budget.wouldExceed95('core', CORE_TOKENS_PER_REQUEST)) return null;
  ctx.budget.charge('core', CORE_TOKENS_PER_REQUEST);

  let bytes: Uint8Array;
  try {
    bytes = await ctx.fetchBytes('core', downloadUrl, { headers: authHeaders });
  } catch {
    return null;
  }
  if (bytes.byteLength === 0) return null;

  return pdfOutcome(record.paperUid, bytes);
};

export default retrieve;
