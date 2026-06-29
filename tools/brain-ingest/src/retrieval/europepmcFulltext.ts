/**
 * Europe PMC OA full-text retrieval adapter (design §2 "Europe PMC", §3 step 5a,
 * §10.5). ADAPTER 11/14.
 *
 * Europe PMC serves structured JATS XML over a plain REST path for the articles
 * in its **open-access subset** (no API key, no metered budget — it is one of the
 * "unmetered (free, keyless)" sources in §5.1):
 *
 *     GET https://www.ebi.ac.uk/europepmc/webservices/rest/<source>/<id>/fullTextXML
 *
 * where `<source>` is Europe PMC's source code (`PMC`, `MED`, `PPR`, …) and `<id>`
 * is the id within that source (the bare PMC number for `PMC`, the PMID for `MED`).
 * On the OA subset the response is a JATS `<article>` document; off the subset (or
 * for a non-existent id) Europe PMC answers with an empty body or a small non-JATS
 * error/HTML page, which we treat as "this source cannot serve the record" → `null`.
 *
 * Per the `RetrieveFn` contract this adapter:
 *  - routes its single GET through `ctx.fetchText('europepmc', …)` so the limiter
 *    applies (Europe PMC is unmetered, so no `ctx.budget.charge`);
 *  - returns `{ storage, fullText }` describing the JATS it pulled, or `null` when
 *    the record has no Europe PMC id / is not on the OA subset / returns non-JATS.
 *
 * Storage note: durable persistence (R2 upload under `jats/<paper_uid>.xml`, §6) is
 * the orchestrator's / `storage/r2.ts`'s job — this adapter never touches R2. It
 * reports `storage.kind: 'none'` and exposes the raw `{ kind: 'jats', xml }` via the
 * exported `fetchEuropePmcJats` helper so the caller can persist + checksum it.
 */

import type {
  PaperRecord,
  StorageInfo,
  FullTextInfo,
  SourceCtx,
  RetrieveFn,
  Identifiers,
} from '../types.js';

import { XMLParser } from 'fast-xml-parser';

/** Europe PMC REST base (no trailing slash). */
const EUROPEPMC_REST = 'https://www.ebi.ac.uk/europepmc/webservices/rest';

/** Abort a stuck full-text fetch rather than hang the run. */
const FULLTEXT_TIMEOUT_MS = 30_000;

/**
 * A resolved Europe PMC `<source>/<id>` pair addressing the fullTextXML endpoint.
 * `source` is Europe PMC's source code; `id` is the id within that source.
 */
export interface EuropePmcRef {
  /** Europe PMC source code: 'PMC' | 'MED' | 'PPR' | … */
  source: string;
  /** id within that source (bare PMC number for PMC, PMID for MED). */
  id: string;
}

/** The raw JATS payload this source serves (design §3 "Return {kind:'jats', xml}"). */
export interface EuropePmcJats {
  kind: 'jats';
  /** Europe PMC's `<source>/<id>` that produced this body. */
  ref: EuropePmcRef;
  /** the JATS `<article>` document, verbatim. */
  xml: string;
}

/**
 * Derive the Europe PMC fullTextXML address from a record's identifiers.
 *
 * Preference order mirrors the OA-subset coverage: a PMCID is the most reliable
 * full-text key (Europe PMC's `PMC` source IS the PMC OA subset), then a PMID via
 * the MEDLINE (`MED`) source. DOIs and arXiv ids do not address this endpoint, so
 * a record carrying only those yields `null` (caller falls through to the next
 * source). Pure: no I/O.
 */
export function europePmcRefFromIdentifiers(ids: Identifiers): EuropePmcRef | null {
  const pmcid = normalizePmcid(ids.pmcid);
  if (pmcid !== null) return { source: 'PMC', id: pmcid };
  const pmid = normalizePmid(ids.pmid);
  if (pmid !== null) return { source: 'MED', id: pmid };
  return null;
}

/**
 * Normalize a PMCID to the bare numeric string Europe PMC's `/PMC/<id>` path wants.
 * Accepts `PMC1234567`, `pmcid:PMC1234567`, `1234567`; returns `1234567` or `null`.
 */
function normalizePmcid(raw: string | undefined): string | null {
  if (raw === undefined) return null;
  const m = raw.trim().match(/(\d+)\s*$/);
  const digits = m?.[1];
  if (digits === undefined || digits.length === 0) return null;
  return digits;
}

/** Normalize a PMID to a bare numeric string, or `null` when absent/malformed. */
function normalizePmid(raw: string | undefined): string | null {
  if (raw === undefined) return null;
  const m = raw.trim().match(/(\d+)\s*$/);
  const digits = m?.[1];
  if (digits === undefined || digits.length === 0) return null;
  return digits;
}

/** Build the fullTextXML URL for a resolved ref. Pure. */
export function fullTextXmlUrl(ref: EuropePmcRef): string {
  return `${EUROPEPMC_REST}/${encodeURIComponent(ref.source)}/${encodeURIComponent(
    ref.id,
  )}/fullTextXML`;
}

/**
 * True when `body` looks like a Europe PMC JATS full-text document rather than an
 * empty body, an HTML error page, or the small XML error envelope Europe PMC emits
 * for ids that are not on the OA subset. Pure — cheap structural sniff before we
 * commit to parsing.
 */
export function looksLikeJats(body: string): boolean {
  if (body.length === 0) return false;
  const head = body.slice(0, 4096).toLowerCase();
  // A JATS article (optionally preceded by an XML decl / doctype) has an <article …> root.
  if (!head.includes('<article')) return false;
  // Europe PMC's "not found / not OA" error bodies are HTML or a tiny <error>/<responseWrapper>.
  if (head.includes('<!doctype html') || head.includes('<html')) return false;
  return true;
}

/**
 * Extract a plain-text approximation + char count from a JATS `<article>` body.
 *
 * The corpus's canonical extraction lives in `src/extract.ts` (§10.5); this is a
 * dependency-free structural extraction sufficient to (a) populate `FullTextInfo`
 * here and (b) confirm offline, against a fixture, that the body really is JATS we
 * can read. Concatenates `<article-title>`, `<abstract>`, and `<body>` text. Pure.
 */
export function jatsToText(xml: string): string {
  const parser = new XMLParser({
    ignoreAttributes: true,
    // keep text nodes; collapse element structure to its text content
    textNodeName: '#text',
    parseTagValue: false,
    trimValues: true,
  });
  let parsed: unknown;
  try {
    parsed = parser.parse(xml);
  } catch {
    return '';
  }
  const parts: string[] = [];
  collectText(parsed, parts);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

/** Depth-first text harvest over the parsed-XML object tree. */
function collectText(node: unknown, out: string[]): void {
  if (node === null || node === undefined) return;
  if (typeof node === 'string') {
    if (node.length > 0) out.push(node);
    return;
  }
  if (typeof node === 'number' || typeof node === 'boolean') {
    out.push(String(node));
    return;
  }
  if (Array.isArray(node)) {
    for (const child of node) collectText(child, out);
    return;
  }
  if (typeof node === 'object') {
    for (const value of Object.values(node as Record<string, unknown>)) {
      collectText(value, out);
    }
  }
}

/**
 * Fetch the raw Europe PMC JATS for a record, or `null` when this source can't
 * serve it (no Europe PMC id, not on the OA subset, or a non-JATS body). Routes
 * through `ctx.fetchText('europepmc', …)`; Europe PMC is unmetered (no budget
 * charge). Exposed so the orchestrator can persist + checksum the XML (§6).
 */
export async function fetchEuropePmcJats(
  ctx: SourceCtx,
  record: PaperRecord,
): Promise<EuropePmcJats | null> {
  const ref = europePmcRefFromIdentifiers(record.identifiers);
  if (ref === null) return null;

  const url = fullTextXmlUrl(ref);
  let body: string;
  try {
    body = await ctx.fetchText('europepmc', url, { timeoutMs: FULLTEXT_TIMEOUT_MS });
  } catch {
    // Network/abort/HTTP error → this source could not serve the record.
    return null;
  }
  if (!looksLikeJats(body)) return null;
  return { kind: 'jats', ref, xml: body };
}

/**
 * Europe PMC OA full-text retrieval adapter (the `RetrieveFn` for this source).
 *
 * Returns `{ storage, fullText }` describing the JATS pulled from the OA subset, or
 * `null` when Europe PMC cannot serve the record (caller tries the next source).
 * `storage.kind` is `'none'` because durable upload is the orchestrator's job (§6);
 * the raw bytes are available via `fetchEuropePmcJats` for that step.
 */
export const retrieve: RetrieveFn = async (
  ctx: SourceCtx,
  record: PaperRecord,
): Promise<{ storage: StorageInfo; fullText: FullTextInfo } | null> => {
  const jats = await fetchEuropePmcJats(ctx, record);
  if (jats === null) return null;

  const text = jatsToText(jats.xml);
  const charCount = text.length;

  const storage: StorageInfo = {
    kind: 'none',
    contentType: 'application/xml',
    sizeBytes: byteLength(jats.xml),
  };
  const fullText: FullTextInfo = {
    extracted: charCount > 0,
    method: 'jats',
    charCount: charCount > 0 ? charCount : null,
  };
  return { storage, fullText };
};

/** UTF-8 byte length of a string (Node has TextEncoder globally). */
function byteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}
