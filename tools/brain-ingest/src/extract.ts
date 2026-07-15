/**
 * Text extraction (design §3 step 5, §8 `fullText{}`).
 *
 * Two pure, offline extractors that turn already-fetched bytes/markup into plain
 * full text plus a character count:
 *   - `extractFromPdf(bytes)`  — PDF binary → text via unpdf (`extractText`).
 *   - `extractFromJats(xml)`   — JATS / NLM XML → body text via fast-xml-parser.
 *
 * Neither function performs any network I/O; retrieval adapters fetch the bytes
 * (through `ctx`'s limiter + budget guard) and hand them here. The returned
 * `method` aligns with `FullTextInfo.method` in the manifest contract (§8).
 *
 * ESM / NodeNext: import with explicit `.js` extensions.
 */

import { extractText } from 'unpdf';
import { XMLParser } from 'fast-xml-parser';

/** Result of a single extraction pass — maps onto `FullTextInfo` (§8). */
export interface ExtractResult {
  /** Which extractor produced `text`; aligns with `FullTextInfo.method`. */
  method: 'pdf' | 'jats';
  /** The extracted plain text (whitespace-collapsed). */
  text: string;
  /** `text.length` — convenience mirror of `FullTextInfo.charCount`. */
  charCount: number;
}

/**
 * Collapse all runs of whitespace (incl. newlines / tabs) to a single space and
 * trim the ends. Keeps the output compact and stable for char-count comparisons.
 */
export function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Extract full text from a PDF binary via unpdf's `extractText`.
 *
 * `mergePages: true` concatenates every page into one string; we then collapse
 * whitespace so the result is directly comparable to the JATS path.
 *
 * `unpdf`/pdfjs takes ownership of the buffer it is given and detaches it once
 * parsing finishes, so we hand it a copy — callers (notably `run.ts`, which
 * uploads these same `bytes` to R2 right after extracting) still own an intact
 * `ArrayBuffer` afterward.
 *
 * @param bytes raw PDF bytes (as fetched by a retrieval adapter — never here).
 */
export async function extractFromPdf(bytes: Uint8Array): Promise<ExtractResult> {
  const { text } = await extractText(bytes.slice(), { mergePages: true });
  const collapsed = collapseWhitespace(text);
  return { method: 'pdf', text: collapsed, charCount: collapsed.length };
}

// ─────────────────────────────────────────────────────────────────────────────
// JATS / NLM XML extraction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * fast-xml-parser configured for JATS body extraction:
 *  - keep text under a stable `#text` key,
 *  - DO NOT collapse single-child arrays inconsistently → `isArray` always false,
 *    we handle both shapes (object | array) in the walker,
 *  - strip attributes (we only want prose),
 *  - trim per-node text values (final collapse happens once at the end).
 */
const parser = new XMLParser({
  ignoreAttributes: true,
  textNodeName: '#text',
  // Keep entities like &amp; resolved to their characters.
  processEntities: true,
  trimValues: true,
});

/** Tags whose textual content is metadata/markup noise, not body prose. */
const SKIP_TAGS = new Set<string>([
  'xref', // citation/figure cross-reference markers e.g. "[1]"
  'label', // figure/table/section numbering labels
  'table-wrap', // tabular data, not prose
  'table',
  'tex-math', // raw LaTeX
  'mml:math',
  'disp-formula',
  'inline-formula',
  'fig', // figure containers (caption prose lives in <caption>, often noise)
]);

/**
 * Recursively collect text from a parsed-XML subtree.
 *
 * fast-xml-parser represents:
 *  - a text leaf as a string (or under `#text` when a node mixes text + children),
 *  - a single child element as an object,
 *  - repeated child elements as an array.
 * We handle all three, skipping `SKIP_TAGS` and attribute keys.
 */
function collectText(node: unknown, parts: string[]): void {
  if (node == null) return;

  if (typeof node === 'string') {
    if (node.length > 0) parts.push(node);
    return;
  }
  if (typeof node === 'number' || typeof node === 'boolean') {
    parts.push(String(node));
    return;
  }
  if (Array.isArray(node)) {
    for (const child of node) collectText(child, parts);
    return;
  }
  if (typeof node === 'object') {
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (key === '#text') {
        collectText(value, parts);
        continue;
      }
      if (SKIP_TAGS.has(key)) continue;
      collectText(value, parts);
    }
  }
}

/** Depth-first search for the first node matching `name` anywhere in the tree. */
function findFirst(node: unknown, name: string): unknown {
  if (node == null || typeof node !== 'object') return undefined;
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = findFirst(child, name);
      if (hit !== undefined) return hit;
    }
    return undefined;
  }
  const obj = node as Record<string, unknown>;
  if (name in obj) return obj[name];
  for (const value of Object.values(obj)) {
    const hit = findFirst(value, name);
    if (hit !== undefined) return hit;
  }
  return undefined;
}

/**
 * Extract body full text from a JATS / NLM XML document.
 *
 * Strategy: parse → locate the `<body>` element (the article body in JATS) →
 * recursively concatenate all prose text (sections, paragraphs, etc.), skipping
 * cross-references, labels, tables and formulae → collapse whitespace. When no
 * `<body>` is present (e.g. abstract-only JATS), falls back to the whole tree so
 * we still surface whatever prose exists.
 *
 * @param xml the JATS/NLM XML string (as fetched by a retrieval adapter).
 */
export function extractFromJats(xml: string): ExtractResult {
  const parsed: unknown = parser.parse(xml);
  const body = findFirst(parsed, 'body');
  const root = body !== undefined ? body : parsed;

  const parts: string[] = [];
  collectText(root, parts);

  const collapsed = collapseWhitespace(parts.join(' '));
  return { method: 'jats', text: collapsed, charCount: collapsed.length };
}
