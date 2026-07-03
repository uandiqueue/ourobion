/**
 * Direct OA-URL retrieval adapter — the free fetch the pipeline already paid for.
 *
 * The OA-location step (design §3 step 3, `run.ts`'s `resolveOaAndClassify`)
 * resolves `record.oa.bestOaUrl` for every OA record via OpenAlex (batched list
 * calls, ~$0.0001/call) or Unpaywall (free, keyless, 100k req/day) — that URL is
 * a direct link to the OA copy. Until now nothing fetched it: `retrieveRecord`
 * in `run.ts` only knew PMC JATS / Europe PMC / arXiv, and anything else fell
 * through to CORE, which re-resolves the paper via its own DOI/title search and
 * spends a metered token on content we had already located for free.
 *
 * This adapter closes that gap: fetch `bestOaUrl` directly (unmetered, keyless —
 * it's a plain publisher/repository URL, not a CORE API call) and, if the
 * response is actually a PDF, hand back the bytes for extraction + upload.
 * Anything that isn't a PDF (an HTML landing page, a redirect to a paywall
 * splash, a 404) returns `null` so the caller falls through to CORE next —
 * this is a short-circuit ahead of CORE, not a replacement for it.
 *
 * ESM / NodeNext — every import carries an explicit `.js` extension.
 */

import type { PaperRecord, SourceCtx } from '../types.js';

/** Direct-fetch is unmetered — pass-through cost for the budget guard. */
const DIRECT_OA_COST = 0;

/** The `%PDF` magic bytes every PDF file starts with. */
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46] as const;

/**
 * True when `bytes` start with the `%PDF` signature. Checked on the bytes
 * rather than trusting the response's `Content-Type` header, which some hosts
 * mislabel (a generic `application/octet-stream`, or a redirect target that
 * serves a PDF under `text/html`) — the magic bytes are the reliable signal.
 */
export function looksLikePdf(bytes: Uint8Array): boolean {
  if (bytes.length < PDF_MAGIC.length) return false;
  return PDF_MAGIC.every((byte, i) => bytes[i] === byte);
}

/**
 * Fetch `record.oa.bestOaUrl` directly, routed through the `'directOa'`
 * rate-limiter bucket via `ctx.fetchBytes`. Returns `null` when the record has
 * no `bestOaUrl`, the fetch fails/times out, or the response is empty/not a
 * PDF (the caller then tries the next retrieval source, CORE). Never throws —
 * every failure mode degrades to `null` so one slow/broken host can't sink the
 * run.
 */
export async function fetchBestOaUrl(
  ctx: SourceCtx,
  record: PaperRecord,
  timeoutMs = 30_000,
): Promise<Uint8Array | null> {
  const url = record.oa.bestOaUrl;
  if (url === null || url === '') return null;

  ctx.budget.charge('directOa', DIRECT_OA_COST);

  let bytes: Uint8Array;
  try {
    bytes = await ctx.fetchBytes('directOa', url, { timeoutMs });
  } catch {
    return null;
  }

  if (bytes.byteLength === 0 || !looksLikePdf(bytes)) return null;
  return bytes;
}
