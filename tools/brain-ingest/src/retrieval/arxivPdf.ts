/**
 * arXiv PDF retrieval adapter (design §3 step 5a, §5, §6, §10.5).
 *
 * arXiv serves the PDF of any preprint at a stable URL:
 *     GET https://arxiv.org/pdf/<id>.pdf  →  application/pdf bytes
 *
 * This adapter is the `pdf`-method retrieval source for records that carry an
 * arXiv id. It fetches the raw bytes (`ctx.fetchBytes`), content-addresses them
 * (sha256), and returns the `StorageInfo` describing where the binary will live
 * in object storage (`pdf/<paper_uid>.pdf`, §6). It does NOT upload (that is
 * `storage/r2.ts`) and does NOT extract text (that is `extract.ts`); per §10.5
 * those are separate steps, so `fullText` is returned un-extracted here.
 *
 * arXiv is free + keyless but politely rate-limited to ~1 request / 3 s — every
 * outbound call therefore goes through `ctx.limiter` (the 'arxiv' bucket) via
 * `ctx.fetchBytes`, and is charged to `ctx.budget` (cost 0: arXiv is unmetered,
 * but we still pass through the guard per the pipeline contract).
 *
 * Returns `null` when the record has no usable arXiv id — the caller then falls
 * through to the next retrieval source.
 *
 * ESM / NodeNext — every import carries an explicit `.js` extension.
 */

import { createHash } from 'node:crypto';

import type {
  PaperRecord,
  StorageInfo,
  FullTextInfo,
  SourceCtx,
  RetrieveFn,
} from '../types.js';

/** arXiv is unmetered (free, keyless) — pass-through cost for the budget guard. */
const ARXIV_COST = 0;

/** Object-storage key prefix for downloadable OA PDFs (§6 layout). */
const PDF_KEY_PREFIX = 'pdf/';

/** The low-level fetch result: the raw PDF bytes + a discriminant tag. */
export interface ArxivPdfResult {
  kind: 'pdf';
  bytes: Uint8Array;
}

/**
 * Normalise whatever lives in `identifiers.arxiv` to the bare arXiv id used in
 * the PDF URL. Accepts the common shapes seen across discovery adapters:
 *   - new scheme:  `2401.12345`, `2401.12345v2`
 *   - old scheme:  `hep-th/9901001`, `math.GT/0309136`
 *   - prefixed:    `arXiv:2401.12345`, `arxiv:hep-th/9901001`
 *   - full URLs:   `https://arxiv.org/abs/2401.12345v1`, `.../pdf/2401.12345.pdf`
 * Returns `null` when nothing id-shaped can be recovered.
 */
export function normalizeArxivId(raw: string | undefined): string | null {
  if (raw === undefined) return null;
  let s = raw.trim();
  if (s === '') return null;

  // Strip a full arXiv URL down to its path tail (abs/<id> or pdf/<id>.pdf).
  const urlMatch = /arxiv\.org\/(?:abs|pdf)\/(.+)$/i.exec(s);
  if (urlMatch && urlMatch[1] !== undefined) s = urlMatch[1];

  // Drop a leading `arXiv:` / `arxiv:` scheme prefix.
  s = s.replace(/^arxiv:/i, '');

  // A `.pdf` suffix (from a pdf URL) is not part of the id.
  s = s.replace(/\.pdf$/i, '');

  // Trim surrounding slashes/whitespace left over from URL splitting.
  s = s.replace(/^\/+|\/+$/g, '').trim();
  if (s === '') return null;

  // New-scheme id: NNNN.NNNNN with an optional version suffix.
  const newScheme = /^\d{4}\.\d{4,5}(v\d+)?$/i;
  // Old-scheme id: archive[.subclass]/NNNNNNN with an optional version suffix.
  const oldScheme = /^[a-z-]+(\.[a-z]{2,})?\/\d{7}(v\d+)?$/i;

  if (newScheme.test(s) || oldScheme.test(s)) return s;
  return null;
}

/** Build the canonical arXiv PDF URL for a bare/normalised id. */
export function arxivPdfUrl(id: string): string {
  return `https://arxiv.org/pdf/${id}.pdf`;
}

/** Recover a usable arXiv id from a record's identifiers, or `null`. */
export function arxivIdFromRecord(record: PaperRecord): string | null {
  return normalizeArxivId(record.identifiers.arxiv);
}

/** Lowercase hex sha256 of a byte buffer (content-addressing per §6). */
export function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/**
 * Fetch the raw arXiv PDF bytes for an id, routed through the limiter +
 * budget guard. Pure transport: returns the bytes tagged `{ kind:'pdf' }`.
 * Throws if arXiv returns no body / the budget guard denies the charge.
 */
export async function fetchArxivPdf(
  ctx: SourceCtx,
  id: string,
  timeoutMs = 30_000,
): Promise<ArxivPdfResult> {
  // Pass through the budget guard (arXiv is unmetered → cost 0, never denied,
  // but the call is still accounted for per the pipeline contract).
  ctx.budget.charge('arxiv', ARXIV_COST);

  // `fetchBytes` routes through `ctx.limiter` for the 'arxiv' bucket (~1/3s).
  const bytes = await ctx.fetchBytes('arxiv', arxivPdfUrl(id), { timeoutMs });
  if (bytes.byteLength === 0) {
    throw new Error(`arxivPdf: empty body for arXiv id '${id}'`);
  }
  return { kind: 'pdf', bytes };
}

/**
 * Retrieval adapter (`RetrieveFn`, §10.5). Fetches the arXiv PDF for a record
 * and returns the storage descriptor for the content-addressed binary plus an
 * un-extracted `fullText` (extraction happens later in `extract.ts`).
 * Returns `null` when the record carries no arXiv id.
 */
export const retrieve: RetrieveFn = async (
  ctx: SourceCtx,
  record: PaperRecord,
): Promise<{ storage: StorageInfo; fullText: FullTextInfo } | null> => {
  const id = arxivIdFromRecord(record);
  if (id === null) return null;

  const { bytes } = await fetchArxivPdf(ctx, id);

  const storage: StorageInfo = {
    kind: 'object',
    key: `${PDF_KEY_PREFIX}${record.paperUid}.pdf`,
    contentType: 'application/pdf',
    sizeBytes: bytes.byteLength,
    sha256: sha256Hex(bytes),
  };

  // This adapter only fetches + addresses the binary; text extraction is a
  // separate §10.5 step, so the PDF is not yet extracted here.
  const fullText: FullTextInfo = {
    extracted: false,
    method: 'pdf',
    charCount: null,
  };

  return { storage, fullText };
};
