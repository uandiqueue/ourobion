/**
 * Retrieval adapter 8/14 — PMC OA full text via JATS XML (PRIMARY for biomedical).
 *
 * Given a record with a PMCID, fetch the structured JATS XML — NOT the PDF.
 * JATS is the cleaner extraction source (design §5: "prefer PMC JATS / CORE
 * fullText over re-parsing a PDF"). Two endpoints are tried, in order:
 *
 *   1. E-utilities efetch  — db=pmc, id=<numeric pmcid>, rettype=xml  (NCBI)
 *   2. PMC OA web service  — id=PMC<id>  (the OA-subset record service)
 *
 * Both return JATS-flavoured XML. The first that yields a body containing an
 * <article> element wins; we char-count its <body> text and hand back a
 * `{ storage, fullText }` patch. The raw XML is returned as `storage.kind:'jats'`
 * conceptually, but the manifest `StorageInfo.kind` vocabulary is
 * 'object'|'local'|'none' (design §8) — the *caller* (10.5 retrieval step) is
 * what uploads the bytes to R2 under `jats/<paper_uid>.xml` and rewrites
 * `storage.kind` to 'object'. This adapter therefore returns the fetched JATS in
 * a `kind:'jats'` envelope (see {@link JatsFetch}) AND the manifest-shaped patch
 * the RetrieveFn contract demands; the in-band XML lets the orchestrator persist
 * the bytes without re-fetching.
 *
 * Network discipline: EVERY outbound call routes through `ctx.fetchText` (which
 * goes through the per-source rate limiter) and is gated by `ctx.budget`. PMC is
 * unmetered (design §5.1) so the budget charge is $0 — but we still call the
 * guard so a future metering of the source is honoured centrally.
 *
 * ESM / NodeNext: import with explicit `.js`, `import type` for type-only names
 * (tsconfig verbatimModuleSyntax).
 */

import { XMLParser } from 'fast-xml-parser';

import type {
  PaperRecord,
  StorageInfo,
  FullTextInfo,
  SourceCtx,
  RetrieveFn,
} from '../types.js';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** This adapter's source identity for limiter + budget bookkeeping. */
const SOURCE = 'pmc' as const;

/** NCBI E-utilities efetch base (db=pmc → JATS XML). */
const EFETCH_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi';

/** PMC OA web service (records endpoint) — second JATS source. */
const PMC_OA_BASE = 'https://www.ncbi.nlm.nih.gov/pmc/utils/oa/oa.fcgi';

/** PMC is unmetered (design §5.1) → no daily cap; charge $0 through the guard. */
const PMC_COST = 0;

/** Per-request timeout — JATS bodies are small (≤ a few MB). */
const FETCH_TIMEOUT_MS = 30_000;

// ─────────────────────────────────────────────────────────────────────────────
// The in-band JATS envelope (brief: "Return {kind:'jats', xml:string}")
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The raw fetch result this adapter produces before the manifest patch. The
 * brief specifies this exact `{kind:'jats', xml}` shape; the orchestrator uses
 * `xml` to persist `jats/<paper_uid>.xml` to R2 (§6) without a re-fetch.
 */
export interface JatsFetch {
  kind: 'jats';
  xml: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// PMCID normalisation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalise a PMCID to its bare numeric form (the id efetch wants) and its
 * canonical `PMC…` form (the OA service wants). Accepts `PMC1234567`,
 * `pmc1234567`, `pmcid:PMC1234567`, or a bare `1234567`. Returns `null` when no
 * digits are present.
 */
export function normalizePmcid(raw: string | undefined): { numeric: string; canonical: string } | null {
  if (!raw) return null;
  const digits = raw.replace(/[^0-9]/g, '');
  if (digits.length === 0) return null;
  return { numeric: digits, canonical: `PMC${digits}` };
}

// ─────────────────────────────────────────────────────────────────────────────
// JATS parse / validation / char-count (pure — unit-tested against the fixture)
// ─────────────────────────────────────────────────────────────────────────────

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  // Keep text nodes addressable under '#text' so we can walk the body.
  textNodeName: '#text',
  trimValues: true,
});

/**
 * Recursively collect all text from a parsed JATS subtree, joined with spaces.
 * Used to char-count the article `<body>` for `FullTextInfo.charCount`.
 */
function collectText(node: unknown): string {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'number' || typeof node === 'boolean') return String(node);
  if (Array.isArray(node)) {
    return node.map(collectText).join(' ');
  }
  if (typeof node === 'object') {
    const parts: string[] = [];
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      // Skip XML attributes (prefixed) — they are not body prose.
      if (key.startsWith('@_')) continue;
      parts.push(collectText(value));
    }
    return parts.join(' ');
  }
  return '';
}

/**
 * Parse a JATS XML string and return whether it is a usable article plus the
 * character count of its `<body>` (falling back to whole-article text when no
 * explicit `<body>` element is present, e.g. abstract-only OA records).
 *
 * Pure and offline — this is the testable core. `usable` is false when the XML
 * does not contain a JATS `<article>` root (e.g. an E-utils error envelope).
 */
export function parseJats(xml: string): { usable: boolean; charCount: number } {
  if (typeof xml !== 'string' || xml.trim().length === 0) {
    return { usable: false, charCount: 0 };
  }
  let parsed: unknown;
  try {
    parsed = xmlParser.parse(xml) as unknown;
  } catch {
    return { usable: false, charCount: 0 };
  }
  if (parsed == null || typeof parsed !== 'object') {
    return { usable: false, charCount: 0 };
  }
  const root = parsed as Record<string, unknown>;

  // E-utilities wraps efetch(db=pmc) results in <pmc-articleset>; the OA service
  // and bare efetch can return <article> directly. Locate the article node.
  const article = locateArticle(root);
  if (article == null) {
    return { usable: false, charCount: 0 };
  }

  // Prefer the <body>; fall back to the whole article (abstract-only records).
  const articleObj = article as Record<string, unknown>;
  const bodyNode = articleObj['body'] ?? article;
  const text = collectText(bodyNode).replace(/\s+/g, ' ').trim();
  return { usable: true, charCount: text.length };
}

/**
 * Find the JATS `<article>` node within a parsed document, unwrapping the
 * E-utils `<pmc-articleset>` envelope and tolerating an array of articles.
 */
function locateArticle(root: Record<string, unknown>): unknown {
  if ('article' in root) {
    return unwrapFirst(root['article']);
  }
  const set = root['pmc-articleset'];
  if (set != null && typeof set === 'object') {
    const setObj = set as Record<string, unknown>;
    if ('article' in setObj) {
      return unwrapFirst(setObj['article']);
    }
  }
  return null;
}

/** An XML element may parse to a single object or an array; take the first. */
function unwrapFirst(node: unknown): unknown {
  if (Array.isArray(node)) {
    return node.length > 0 ? node[0] : null;
  }
  return node ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Endpoint fetchers (each routes through ctx → limiter; budget gated by caller)
// ─────────────────────────────────────────────────────────────────────────────

/** Fetch JATS via NCBI E-utilities efetch (db=pmc, rettype=xml). */
async function fetchViaEfetch(ctx: SourceCtx, numericPmcid: string): Promise<string> {
  return ctx.fetchText(SOURCE, EFETCH_BASE, {
    timeoutMs: FETCH_TIMEOUT_MS,
    query: {
      db: 'pmc',
      id: numericPmcid,
      rettype: 'xml',
      retmode: 'xml',
    },
  });
}

/** Fetch the OA-subset record via the PMC OA web service. */
async function fetchViaOaService(ctx: SourceCtx, canonicalPmcid: string): Promise<string> {
  return ctx.fetchText(SOURCE, PMC_OA_BASE, {
    timeoutMs: FETCH_TIMEOUT_MS,
    query: {
      id: canonicalPmcid,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// RetrieveFn (the foundation contract)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retrieve PMC OA full text as JATS XML for one record.
 *
 * Returns `null` (caller falls through to the next source) when:
 *  - the record carries no PMCID, or
 *  - neither endpoint yields a usable JATS `<article>`, or
 *  - the budget guard would deny the call.
 *
 * On success returns the manifest-shaped `{ storage, fullText }` patch. The
 * fetched XML is exposed separately as a `kind:'jats'` envelope via
 * {@link retrieveJats} for orchestrators that want the bytes in-band; `retrieve`
 * itself conforms exactly to `RetrieveFn`.
 */
export const retrieve: RetrieveFn = async (ctx, record) => {
  const result = await retrieveJats(ctx, record);
  if (result == null) return null;
  return { storage: result.storage, fullText: result.fullText };
};

/**
 * Like {@link retrieve} but also returns the raw `{kind:'jats', xml}` envelope
 * (brief). Internal/orchestrator-facing: lets the 10.5 retrieval step persist
 * `jats/<paper_uid>.xml` to R2 without a second fetch.
 */
export async function retrieveJats(
  ctx: SourceCtx,
  record: PaperRecord,
): Promise<{ jats: JatsFetch; storage: StorageInfo; fullText: FullTextInfo } | null> {
  const ids = normalizePmcid(record.identifiers.pmcid);
  if (ids == null) {
    // No PMCID → this source cannot serve the record.
    return null;
  }

  // Budget gate (PMC is unmetered → $0, but route through the guard centrally).
  if (ctx.budget.wouldExceed95(SOURCE, PMC_COST)) {
    return null;
  }

  let xml: string | null = null;

  // 1) E-utilities efetch (db=pmc).
  xml = await tryFetch(() => fetchViaEfetch(ctx, ids.numeric));
  let parsed = xml == null ? { usable: false, charCount: 0 } : parseJats(xml);

  // 2) Fall back to the PMC OA web service.
  if (!parsed.usable) {
    const oaXml = await tryFetch(() => fetchViaOaService(ctx, ids.canonical));
    if (oaXml != null) {
      const oaParsed = parseJats(oaXml);
      if (oaParsed.usable) {
        xml = oaXml;
        parsed = oaParsed;
      }
    }
  }

  if (xml == null || !parsed.usable) {
    return null;
  }

  // Charge the (zero) cost now that a real call succeeded.
  ctx.budget.charge(SOURCE, PMC_COST);

  // StorageInfo: this adapter holds the JATS in-band; the orchestrator uploads
  // it to R2 and rewrites kind→'object'. We report 'none' (not yet stored) with
  // the byte size + content type so the caller can size the upload.
  const sizeBytes = byteLength(xml);
  const storage: StorageInfo = {
    kind: 'none',
    contentType: 'application/xml',
    sizeBytes,
  };

  const fullText: FullTextInfo = {
    extracted: parsed.charCount > 0,
    method: 'jats',
    charCount: parsed.charCount > 0 ? parsed.charCount : null,
  };

  return { jats: { kind: 'jats', xml }, storage, fullText };
}

// ─────────────────────────────────────────────────────────────────────────────
// Small helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Run a fetch, swallowing network/HTTP errors into `null` (try the next route). */
async function tryFetch(fn: () => Promise<string>): Promise<string | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

/** UTF-8 byte length of a string (TextEncoder is global in Node 18+). */
function byteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}
