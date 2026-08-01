/**
 * ourobion nao — paper-detail source honesty.
 *
 * The detail page has two possible sources, and they are NOT equivalent:
 *
 *  - the **corpus object** `meta/<uid>.json` in R2 — the full truth-tier
 *    `PaperRecord`, every field the page renders;
 *  - the **D1 index row** — a derived projection built by scripts/etl.mjs, which
 *    has no column at all for nine of the fields the page renders.
 *
 * The page used to read only the corpus object and call `notFound()` when it was
 * missing. Under `next dev` the local R2 simulator holds no objects, so every
 * drill-down answered 404 while the list (D1) worked — a 404 that reads as "no
 * such paper" about a paper the list had just shown.
 *
 * This module exists so the fallback can never be mistaken for the full record:
 * it enumerates, as data, exactly what the index row cannot say. Pure and
 * IO-free — the page is glue over it (nao's ingestControl/modelsControl
 * convention).
 */

import type { PaperDetailRow } from '@/lib/d1';

/** Which source answered the request. */
export type PaperDetailSource = 'corpus_object' | 'index_row';

/**
 * Field paths the D1 `papers` table has NO column for, so the index row cannot
 * distinguish "recorded as absent" from "never carried here". Verified against
 * apps/nao/src/db/schema.sql (the authoritative DDL — there are no D1
 * migrations) and the fields apps/nao/src/app/(app)/paper/[uid]/page.tsx
 * renders. Keep in step with both.
 */
export const D1_UNAVAILABLE_FIELDS = [
  'identifiers.arxiv',
  'identifiers.openalex',
  'identifiers.s2',
  'oa.license',
  'oa.version',
  'oa.bestOaUrl',
  'storage.contentType',
  'storage.sha256',
  'errors',
] as const;

export type D1UnavailableField = (typeof D1_UNAVAILABLE_FIELDS)[number];

/** Identifier kinds the D1 row DOES carry. */
export const D1_IDENTIFIER_KINDS = ['doi', 'pmid', 'pmcid'] as const;

/** One label/value pair for the fallback's provenance grid. */
export interface DetailFact {
  key: string;
  value: string;
}

/** Bytes as a short human string; null/absent is reported, never guessed as 0. */
function bytes(value: number | null): string {
  if (value === null) return 'not recorded';
  if (value < 1024) return `${value} B`;
  const units = ['KB', 'MB', 'GB'];
  let scaled = value / 1024;
  let unit = 0;
  while (scaled >= 1024 && unit < units.length - 1) {
    scaled /= 1024;
    unit += 1;
  }
  return `${scaled.toFixed(1)} ${units[unit]}`;
}

/**
 * The identifiers the index row actually holds, in display order. Absent ids are
 * omitted rather than rendered blank — and because three id kinds have no column
 * at all, callers must also surface {@link D1_UNAVAILABLE_FIELDS}.
 */
export function indexRowIdentifiers(row: PaperDetailRow): Array<{ kind: string; value: string }> {
  const byKind: Record<string, string | null> = {
    doi: row.doi,
    pmid: row.pmid,
    pmcid: row.pmcid,
  };
  return D1_IDENTIFIER_KINDS.flatMap((kind) => {
    const value = byKind[kind];
    return typeof value === 'string' && value.length > 0 ? [{ kind, value }] : [];
  });
}

/**
 * Provenance facts the index row can support. Only columns that exist are
 * listed: a caller rendering this grid is not silently dropping a field it
 * should have shown, because the fields with no column are named separately.
 */
export function indexRowFacts(row: PaperDetailRow): DetailFact[] {
  return [
    { key: 'discoveredVia', value: row.discoveredVia ?? 'not recorded' },
    { key: 'status', value: row.status },
    {
      key: 'fetchedAt',
      value:
        row.fetchedAt === null
          ? 'not recorded'
          : row.fetchedAt.replace('T', ' ').replace('Z', ' UTC'),
    },
    { key: 'retrievability', value: row.retrievability },
    { key: 'fullText.extracted', value: String(row.fullTextExtracted) },
    { key: 'fullText.method', value: row.fullTextMethod ?? 'not recorded' },
    {
      key: 'fullText.charCount',
      value:
        row.fullTextCharCount === null ? 'not recorded' : row.fullTextCharCount.toLocaleString(),
    },
    { key: 'storage.kind', value: row.storageKind ?? 'not recorded' },
    { key: 'storage.sizeBytes', value: bytes(row.storageSizeBytes) },
  ];
}

/** Topic tags followed by concepts, de-duplicated, preserving order. */
export function indexRowTags(row: PaperDetailRow): string[] {
  return [...new Set([...row.topicTags, ...row.concepts])];
}
