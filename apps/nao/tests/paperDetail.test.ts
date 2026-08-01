/**
 * Pure-logic tests for the paper-detail fallback (`src/lib/paperDetail.ts`).
 *
 * Context: the detail page reads the full PaperRecord from the R2 corpus object
 * and used to `notFound()` when it was missing. The local `next dev` R2
 * simulator holds no objects, so every drill-down 404'd while the D1-backed list
 * worked. The page now falls back to the D1 index row — which is genuinely
 * THINNER, so these tests pin the honesty properties of that fallback:
 *
 *  - the unavailable-field list matches what D1's `papers` table lacks, and is
 *    non-empty (a silently-empty list would make the banner claim parity);
 *  - absent identifiers are OMITTED, never rendered blank;
 *  - absent columns read "not recorded" — never 0, never an em dash that would
 *    imply the source recorded an absence.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  D1_IDENTIFIER_KINDS,
  D1_UNAVAILABLE_FIELDS,
  indexRowFacts,
  indexRowIdentifiers,
  indexRowTags,
} from '../src/lib/paperDetail.ts';
import type { PaperDetailRow } from '../src/lib/d1.ts';

function detailRow(overrides: Partial<PaperDetailRow> = {}): PaperDetailRow {
  return {
    paperUid: 'doi:10.1234/abc',
    title: 'A paper',
    authors: ['Ada L.'],
    year: 2024,
    venue: 'Nature',
    abstract: 'An abstract.',
    oaStatus: 'gold',
    retrievability: 'pdf',
    workType: 'article',
    citedByCount: 12,
    journalPublisher: 'Pub',
    topicTags: ['gut_microbiome'],
    concepts: ['immunology'],
    doi: '10.1234/abc',
    pmid: '99',
    pmcid: null,
    status: 'fetched',
    discoveredVia: 'openalex',
    fullTextExtracted: true,
    fullTextMethod: 'pdf',
    fullTextCharCount: 41234,
    storageKind: 'object',
    storageSizeBytes: 2048,
    fetchedAt: '2026-06-29T07:58:04.045Z',
    ...overrides,
  };
}

// ── the unavailable-field contract ───────────────────────────────────────────

test('unavailable fields: non-empty, unique, and exactly the nine D1 lacks', () => {
  // A silently-empty list would let the banner imply the index row is complete.
  assert.ok(D1_UNAVAILABLE_FIELDS.length > 0);
  assert.equal(new Set(D1_UNAVAILABLE_FIELDS).size, D1_UNAVAILABLE_FIELDS.length);
  assert.deepEqual([...D1_UNAVAILABLE_FIELDS], [
    'identifiers.arxiv',
    'identifiers.openalex',
    'identifiers.s2',
    'oa.license',
    'oa.version',
    'oa.bestOaUrl',
    'storage.contentType',
    'storage.sha256',
    'errors',
  ]);
});

test('unavailable fields and stored identifier kinds do not overlap', () => {
  for (const kind of D1_IDENTIFIER_KINDS) {
    assert.equal(
      D1_UNAVAILABLE_FIELDS.includes(`identifiers.${kind}` as never),
      false,
      kind + ' is both claimed stored and claimed unavailable',
    );
  }
});

// ── identifiers ──────────────────────────────────────────────────────────────

test('identifiers: only the stored kinds, in display order, blanks omitted', () => {
  assert.deepEqual(indexRowIdentifiers(detailRow()), [
    { kind: 'doi', value: '10.1234/abc' },
    { kind: 'pmid', value: '99' },
  ]);
});

test('identifiers: an all-null row yields none rather than empty rows', () => {
  assert.deepEqual(indexRowIdentifiers(detailRow({ doi: null, pmid: null, pmcid: null })), []);
  // An empty string is not an identifier either.
  assert.deepEqual(indexRowIdentifiers(detailRow({ doi: '', pmid: null, pmcid: null })), []);
});

// ── provenance facts ─────────────────────────────────────────────────────────

test('facts: every stored column is reported, none of the missing ones invented', () => {
  const facts = indexRowFacts(detailRow());
  const keys = facts.map((f) => f.key);
  assert.deepEqual(keys, [
    'discoveredVia',
    'status',
    'fetchedAt',
    'retrievability',
    'fullText.extracted',
    'fullText.method',
    'fullText.charCount',
    'storage.kind',
    'storage.sizeBytes',
  ]);
  // Nothing the index lacks may appear as a fact row.
  for (const key of keys) {
    assert.equal(D1_UNAVAILABLE_FIELDS.includes(key as never), false, key);
  }
  const byKey = new Map(facts.map((f) => [f.key, f.value]));
  assert.equal(byKey.get('fetchedAt'), '2026-06-29 07:58:04.045 UTC');
  assert.equal(byKey.get('fullText.charCount'), (41234).toLocaleString());
  assert.equal(byKey.get('storage.sizeBytes'), '2.0 KB');
});

test('facts: a null column reads "not recorded", never 0 and never a bare dash', () => {
  const facts = indexRowFacts(
    detailRow({
      discoveredVia: null,
      fetchedAt: null,
      fullTextMethod: null,
      fullTextCharCount: null,
      storageKind: null,
      storageSizeBytes: null,
    }),
  );
  const byKey = new Map(facts.map((f) => [f.key, f.value]));
  for (const key of [
    'discoveredVia',
    'fetchedAt',
    'fullText.method',
    'fullText.charCount',
    'storage.kind',
    'storage.sizeBytes',
  ]) {
    assert.equal(byKey.get(key), 'not recorded', key);
  }
  // A missing char count must not read as a real zero-length extraction.
  assert.notEqual(byKey.get('fullText.charCount'), '0');
});

test('facts: a genuine zero size is reported as zero, not as missing', () => {
  const byKey = new Map(indexRowFacts(detailRow({ storageSizeBytes: 0 })).map((f) => [f.key, f.value]));
  assert.equal(byKey.get('storage.sizeBytes'), '0 B');
});

// ── tags ─────────────────────────────────────────────────────────────────────

test('tags: topic tags then concepts, de-duplicated, order preserved', () => {
  assert.deepEqual(indexRowTags(detailRow()), ['gut_microbiome', 'immunology']);
  assert.deepEqual(
    indexRowTags(detailRow({ topicTags: ['a', 'b'], concepts: ['b', 'c'] })),
    ['a', 'b', 'c'],
  );
  assert.deepEqual(indexRowTags(detailRow({ topicTags: [], concepts: [] })), []);
});
