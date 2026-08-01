/**
 * Fixture-only tests for the D1 query layer + the ETL row mapping.
 * No live D1 / R2 / Supabase: searchPapers/facetCounts/getPaperRow take an injected
 * fake D1Database, and the ETL helpers are pure. Run: node --test (Node >=26).
 *
 * Asserts:
 *  - searchPapers SQL is PARAMETERIZED — user q + filter values arrive via .bind(),
 *    never concatenated into the SQL text.
 *  - the FTS5 MATCH query builds (and sanitises) for a sample q + filter set.
 *  - the ETL maps a sample PaperRecord fixture → the expected `papers` row + UPSERT.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  searchPapers,
  facetCounts,
  getPaperRow,
  getPaperDetailRow,
  buildFtsMatchQuery,
} from '../src/lib/d1.ts';
import {
  assertSqlLimits,
  createImportSnapshot,
  ETL_SCHEMA_VERSION,
  loadEnv,
  MANIFEST_KEY,
  manifestToSql,
  MAX_SQL_STATEMENT_BYTES,
  parseManifestRecords,
  recordToRow,
  rowToUpsertSql,
  sqlValue,
  SQL_RELATIVE_PATH,
} from '../scripts/etl.mjs';

// ─────────────────────────────────────────────────────────────────────────────
// Fake D1 — records every prepared SQL string and the values bound to it.
// ─────────────────────────────────────────────────────────────────────────────
interface Captured {
  sql: string;
  binds: unknown[];
}

function makeFakeDb(rows: unknown[] = [], firstVal: unknown = null) {
  const captured: Captured[] = [];
  const db = {
    prepare(sql: string) {
      const rec: Captured = { sql, binds: [] };
      captured.push(rec);
      const stmt = {
        bind(...args: unknown[]) {
          rec.binds = args;
          return stmt;
        },
        async first<T>() {
          return firstVal as T;
        },
        async all<T>() {
          return { results: rows as T[], success: true, meta: {} };
        },
      };
      return stmt;
    },
  };
  return { db: db as unknown as D1Database, captured };
}

// ─────────────────────────────────────────────────────────────────────────────
// buildFtsMatchQuery
// ─────────────────────────────────────────────────────────────────────────────
test('buildFtsMatchQuery: tokens become quoted prefix terms', () => {
  assert.equal(buildFtsMatchQuery('gut microbiome'), '"gut"* "microbiome"*');
});

test('buildFtsMatchQuery: strips FTS quote chars (no injection via MATCH)', () => {
  // a stray double-quote must not break out into the FTS query language
  assert.equal(buildFtsMatchQuery('a" OR b'), '"a"* "OR"* "b"*');
});

test('buildFtsMatchQuery: empty / whitespace-only yields null (caller lists)', () => {
  assert.equal(buildFtsMatchQuery('   '), null);
  assert.equal(buildFtsMatchQuery(''), null);
});

// ─────────────────────────────────────────────────────────────────────────────
// searchPapers — parameterization
// ─────────────────────────────────────────────────────────────────────────────
test('searchPapers: with q + filters, SQL is parameterized via bind (FTS branch)', async () => {
  const { db, captured } = makeFakeDb([], { n: 0 });
  await searchPapers(
    {
      q: 'dengue vaccine',
      filters: { oaStatus: 'gold', year: 2023, topicTag: 'dengue' },
      page: 2,
      pageSize: 10,
    },
    db,
  );

  // two statements: COUNT(*) and the SELECT page.
  assert.equal(captured.length, 2);
  const [countStmt, rowsStmt] = captured;

  // The FTS branch must use placeholders, not literals.
  assert.match(countStmt.sql, /papers_fts MATCH \?/);
  assert.match(countStmt.sql, /oa_status = \?/);
  assert.match(countStmt.sql, /year = \?/);
  assert.match(countStmt.sql, /json_each\(p\.topic_tags\) WHERE json_each\.value = \?/);

  // No raw user value may appear in the SQL text.
  for (const stmt of captured) {
    assert.ok(!stmt.sql.includes('dengue'), 'q must not be inlined in SQL');
    assert.ok(!stmt.sql.includes('gold'), 'filter value must not be inlined in SQL');
    assert.ok(!stmt.sql.includes('2023'), 'year must not be inlined in SQL');
  }

  // The MATCH string is the sanitised query, bound first.
  assert.equal(countStmt.binds[0], '"dengue"* "vaccine"*');
  assert.deepEqual(countStmt.binds, ['"dengue"* "vaccine"*', 'gold', 2023, 'dengue']);

  // The rows statement carries the same where-binds plus LIMIT + OFFSET.
  const rb = rowsStmt.binds;
  assert.equal(rb[rb.length - 2], 10, 'pageSize → LIMIT');
  assert.equal(rb[rb.length - 1], 10, 'page 2 * size 10 → OFFSET 10');
});

test('searchPapers: no q → list branch (no MATCH), still parameterized', async () => {
  const { db, captured } = makeFakeDb([], { n: 0 });
  await searchPapers({ filters: { workType: 'review' } }, db);
  const [countStmt] = captured;
  assert.ok(!countStmt.sql.includes('MATCH'), 'no q → no FTS MATCH');
  assert.match(countStmt.sql, /work_type = \?/);
  assert.ok(!countStmt.sql.includes('review'), 'filter value not inlined');
  assert.deepEqual(countStmt.binds, ['review']);
});

test('searchPapers: pageSize is clamped to the max', async () => {
  const { db, captured } = makeFakeDb([], { n: 0 });
  const res = await searchPapers({ pageSize: 99999 }, db);
  assert.equal(res.pageSize, 100);
  const rowsStmt = captured[1];
  assert.equal(rowsStmt.binds[rowsStmt.binds.length - 2], 100);
});

// ─────────────────────────────────────────────────────────────────────────────
// getPaperRow — parameterized + maps JSON columns
// ─────────────────────────────────────────────────────────────────────────────
test('getPaperRow: binds uid and parses JSON array columns', async () => {
  const raw = {
    paper_uid: 'doi:10.1/x',
    title: 'T',
    authors_json: '["Ada","Grace"]',
    year: 2020,
    venue: 'V',
    abstract: null,
    oa_status: 'gold',
    retrievability: 'pdf',
    work_type: 'article',
    cited_by_count: 5,
    journal_publisher: 'Pub',
    topic_tags: '["dengue"]',
    concepts: '["immunology"]',
    doi: '10.1/x',
    pmid: null,
    pmcid: null,
    status: 'fetched',
  };
  const { db, captured } = makeFakeDb([], raw);
  const row = await getPaperRow('doi:10.1/x', db);
  assert.match(captured[0].sql, /paper_uid = \?/);
  assert.deepEqual(captured[0].binds, ['doi:10.1/x']);
  assert.deepEqual(row?.authors, ['Ada', 'Grace']);
  assert.deepEqual(row?.topicTags, ['dengue']);
  assert.equal(row?.oaStatus, 'gold');
});

// ─────────────────────────────────────────────────────────────────────────────
// getPaperDetailRow — the paper-detail fallback read
//
// Selects four columns PAPER_COLUMNS omits (the detail page renders them, the
// list does not). Null still means "no such paper in the index", which is the
// one case where the detail page's 404 is honest.
// ─────────────────────────────────────────────────────────────────────────────
test('getPaperDetailRow: binds uid and maps the four detail-only columns', async () => {
  const raw = {
    paper_uid: 'doi:10.1/x',
    title: 'T',
    authors_json: '["Ada"]',
    year: 2020,
    venue: 'V',
    abstract: null,
    oa_status: 'gold',
    retrievability: 'pdf',
    work_type: 'article',
    cited_by_count: 5,
    journal_publisher: 'Pub',
    topic_tags: '["dengue"]',
    concepts: '["immunology"]',
    doi: '10.1/x',
    pmid: null,
    pmcid: null,
    status: 'fetched',
    discovered_via: 'openalex',
    full_text_extracted: 1,
    full_text_method: 'pdf',
    full_text_char_count: 41234,
    storage_kind: 'object',
    storage_size_bytes: 2048,
    fetched_at: '2026-06-29T07:58:04.045Z',
  };
  const { db, captured } = makeFakeDb([], raw);
  const row = await getPaperDetailRow('doi:10.1/x', db);
  assert.match(captured[0].sql, /paper_uid = \?/);
  assert.deepEqual(captured[0].binds, ['doi:10.1/x']);
  // The four columns the narrower list projection does not select.
  for (const column of [
    'full_text_char_count',
    'storage_kind',
    'storage_size_bytes',
    'fetched_at',
  ]) {
    assert.ok(captured[0].sql.includes(column), 'missing column ' + column);
  }
  assert.equal(row?.fullTextCharCount, 41234);
  assert.equal(row?.storageKind, 'object');
  assert.equal(row?.storageSizeBytes, 2048);
  assert.equal(row?.fetchedAt, '2026-06-29T07:58:04.045Z');
  // Still inherits the base mapping.
  assert.deepEqual(row?.authors, ['Ada']);
  assert.equal(row?.fullTextExtracted, true);
});

test('getPaperDetailRow: an absent uid yields null (the honest 404 case)', async () => {
  const { db } = makeFakeDb([], null);
  assert.equal(await getPaperDetailRow('doi:missing', db), null);
});

test('getPaperDetailRow: null detail columns stay null, never coerced to 0', async () => {
  const raw = {
    paper_uid: 'doi:10.1/y',
    title: 'T',
    authors_json: '[]',
    year: null,
    venue: null,
    abstract: null,
    oa_status: 'closed',
    retrievability: 'unknown',
    work_type: null,
    cited_by_count: null,
    journal_publisher: null,
    topic_tags: '[]',
    concepts: '[]',
    doi: null,
    pmid: null,
    pmcid: null,
    status: 'discovered',
    discovered_via: 'openalex',
    full_text_extracted: 0,
    full_text_method: null,
    full_text_char_count: null,
    storage_kind: null,
    storage_size_bytes: null,
    fetched_at: null,
  };
  const { db } = makeFakeDb([], raw);
  const row = await getPaperDetailRow('doi:10.1/y', db);
  assert.equal(row?.fullTextCharCount, null);
  assert.equal(row?.storageKind, null);
  assert.equal(row?.storageSizeBytes, null);
  assert.equal(row?.fetchedAt, null);
});

test('facetCounts: issues grouped queries and shapes buckets', async () => {
  const { db } = makeFakeDb([
    { value: 'gold', count: 3 },
    { value: 'closed', count: 1 },
  ]);
  const facets = await facetCounts(db);
  assert.deepEqual(facets.oaStatus, [
    { value: 'gold', count: 3 },
    { value: 'closed', count: 1 },
  ]);
  assert.ok(Array.isArray(facets.topicTags));
});

// ─────────────────────────────────────────────────────────────────────────────
// ETL row mapping (PaperRecord → row → UPSERT)
// ─────────────────────────────────────────────────────────────────────────────
const FIXTURE_RECORD = {
  paperUid: 'doi:10.1234/abc.def',
  identifiers: { doi: '10.1234/abc.def', pmid: '12345', pmcid: 'PMC9' },
  title: "O'Brien et al. on gut flora",
  authors: ['A. One', 'B. Two'],
  year: 2022,
  venue: 'Nature',
  abstract: 'An abstract.',
  discoveredVia: 'openalex',
  topicTags: ['gut_microbiome'],
  oa: { isOa: true, status: 'gold', bestOaUrl: 'https://x', license: 'cc-by', version: 'published' },
  metrics: { citedByCount: 42, source: 'openalex', asOf: '2026-06-01' },
  journal: { issn: ['1234-5678'], publisher: 'Springer', type: 'journal' },
  workType: 'article',
  concepts: ['microbiology', 'immunology'],
  retrievability: 'pdf',
  storage: { kind: 'object', key: 'pdf/x.pdf' },
  fullText: { extracted: true, method: 'pdf', charCount: 1000 },
  status: 'fetched',
  errors: [],
  fetchedAt: '2026-06-02T00:00:00Z',
};

test('recordToRow: maps nested PaperRecord fields to flat columns', () => {
  const row = recordToRow(FIXTURE_RECORD);
  assert.equal(row.paper_uid, 'doi:10.1234/abc.def');
  assert.equal(row.title, "O'Brien et al. on gut flora");
  assert.equal(row.authors_json, '["A. One","B. Two"]');
  assert.equal(row.year, 2022);
  assert.equal(row.oa_status, 'gold');
  assert.equal(row.retrievability, 'pdf');
  assert.equal(row.work_type, 'article');
  assert.equal(row.cited_by_count, 42);
  assert.equal(row.journal_publisher, 'Springer');
  assert.equal(row.topic_tags, '["gut_microbiome"]');
  assert.equal(row.concepts, '["microbiology","immunology"]');
  assert.equal(row.doi, '10.1234/abc.def');
  assert.equal(row.pmid, '12345');
  assert.equal(row.pmcid, 'PMC9');
  assert.equal(row.status, 'fetched');
  // pipeline-provenance / conversion columns
  assert.equal(row.discovered_via, 'openalex');
  assert.equal(row.full_text_extracted, 1);
  assert.equal(row.full_text_method, 'pdf');
  assert.equal(row.full_text_char_count, 1000);
  assert.equal(row.storage_kind, 'object');
  assert.equal(row.fetched_at, '2026-06-02T00:00:00Z');
});

test('recordToRow: tolerates missing optional fields (defaults, nulls)', () => {
  const row = recordToRow({ paperUid: 'doi:bare' });
  assert.equal(row.paper_uid, 'doi:bare');
  assert.equal(row.title, '');
  assert.equal(row.authors_json, '[]');
  assert.equal(row.year, null);
  assert.equal(row.oa_status, 'unknown');
  assert.equal(row.retrievability, 'unknown');
  assert.equal(row.cited_by_count, null);
  assert.equal(row.journal_publisher, null);
  assert.equal(row.topic_tags, '[]');
  assert.equal(row.concepts, '[]');
  assert.equal(row.status, 'discovered');
  assert.equal(row.discovered_via, null);
  assert.equal(row.full_text_extracted, 0);
  assert.equal(row.full_text_method, null);
  assert.equal(row.full_text_char_count, null);
  assert.equal(row.storage_kind, null);
  assert.equal(row.storage_size_bytes, null);
  assert.equal(row.fetched_at, null);
});

test('sqlValue: escapes single quotes and handles null/number', () => {
  assert.equal(sqlValue(null), 'NULL');
  assert.equal(sqlValue(undefined), 'NULL');
  assert.equal(sqlValue(42), '42');
  assert.equal(sqlValue("O'Brien"), "'O''Brien'");
});

test('rowToUpsertSql: idempotent UPSERT with ON CONFLICT and escaped values', () => {
  const sql = rowToUpsertSql(recordToRow(FIXTURE_RECORD));
  assert.match(sql, /^INSERT INTO papers \(/);
  assert.match(sql, /ON CONFLICT\(paper_uid\) DO UPDATE SET/);
  assert.match(sql, /title=excluded\.title/);
  // single quote in the title must be doubled, not break the literal
  assert.ok(sql.includes("'O''Brien et al. on gut flora'"));
  // primary key is not in the UPDATE set
  assert.ok(!/paper_uid=excluded\.paper_uid/.test(sql));
});

test('manifestToSql: generates one exact DELETE-plus-UPSERT replacement snapshot', () => {
  const jsonl = [
    JSON.stringify(FIXTURE_RECORD),
    JSON.stringify({ paperUid: 'doi:second', title: 'Second' }),
  ].join('\n');
  const stmts = manifestToSql(jsonl);
  assert.deepEqual(stmts.slice(0, 1), ['DELETE FROM papers;']);
  assert.equal(stmts.length, 3);
  assert.match(stmts[1], /doi:10\.1234\/abc\.def/);
  assert.match(stmts[2], /doi:second/);

  const snapshot = createImportSnapshot(jsonl);
  assert.ok(snapshot.sql.startsWith('DELETE FROM papers;\n'));
  assert.equal(snapshot.sql, `${stmts.join('\n')}\n`);
});

test('manifest parsing fails closed for malformed, keyless, duplicate, and empty truth data', () => {
  const cases: Array<[string, RegExp]> = [
    ['{not json}', /malformed JSON/],
    [JSON.stringify({ title: 'No primary key' }), /missing a non-empty string paperUid/],
    [JSON.stringify({ paperUid: 42 }), /missing a non-empty string paperUid/],
    [
      [
        JSON.stringify({ paperUid: 'doi:duplicate' }),
        JSON.stringify({ paperUid: 'doi:duplicate' }),
      ].join('\n'),
      /duplicate paperUid/,
    ],
    ['', /zero valid rows/],
    ['\n  \n', /zero valid rows/],
  ];

  for (const [manifest, expected] of cases) {
    assert.throws(() => parseManifestRecords(manifest), expected);
    assert.throws(() => manifestToSql(manifest), expected);
  }
});

test('SQL limits enforce the documented 100,000-byte statement boundary', () => {
  assert.doesNotThrow(() => assertSqlLimits(['x'.repeat(MAX_SQL_STATEMENT_BYTES)]));
  assert.throws(
    () => assertSqlLimits(['x'.repeat(MAX_SQL_STATEMENT_BYTES + 1)]),
    /SQL statement is 100001 bytes; limit is 100000/,
  );
});

test('createImportSnapshot rejects total imports over the configured limit', () => {
  const manifest = JSON.stringify({ paperUid: 'doi:one', title: 'One' });
  assert.throws(
    () => createImportSnapshot(manifest, { maxImportBytes: 1 }),
    /import is .* bytes; limit is 1/,
  );
});

test('createImportSnapshot has deterministic, content-free metadata', () => {
  const manifest = [
    JSON.stringify(FIXTURE_RECORD),
    JSON.stringify({ paperUid: 'doi:second', title: 'Second' }),
  ].join('\n');
  const first = createImportSnapshot(manifest);
  const second = createImportSnapshot(manifest);

  assert.deepEqual(first, second);
  assert.equal(first.metadata.schemaVersion, ETL_SCHEMA_VERSION);
  assert.equal(first.metadata.rowCount, 2);
  assert.equal(first.metadata.statementCount, 3);
  assert.equal(first.metadata.totalBytes, Buffer.byteLength(first.sql, 'utf8'));
  assert.equal(first.metadata.sqlRelativePath, SQL_RELATIVE_PATH);
  assert.match(first.metadata.manifestSha256, /^[a-f0-9]{64}$/);
  assert.match(first.metadata.sqlSha256, /^[a-f0-9]{64}$/);
  assert.ok(first.metadata.maxStatementBytes <= MAX_SQL_STATEMENT_BYTES);
  assert.ok(!JSON.stringify(first.metadata).includes(FIXTURE_RECORD.title));
});

test('createImportSnapshot produces a complete 5,335-row import without chunking', () => {
  const count = 5_335;
  const manifest = Array.from(
    { length: count },
    (_, index) =>
      JSON.stringify({
        paperUid: `doi:fixture-${index}`,
        title: `Fixture ${index}`,
      }),
  ).join('\n');

  const snapshot = createImportSnapshot(manifest);
  assert.equal(snapshot.metadata.rowCount, count);
  assert.equal(snapshot.metadata.statementCount, count + 1);
  assert.equal(snapshot.sql.split('\n').filter(Boolean).length, count + 1);
  assert.ok(snapshot.sql.startsWith('DELETE FROM papers;\n'));
});

test('loadEnv gives CI process credentials precedence over file configuration', () => {
  const env = loadEnv({
    R2_ENDPOINT: 'https://ci.example.invalid',
    R2_ACCESS_KEY_ID: 'ci-access',
    R2_SECRET_ACCESS_KEY: 'ci-secret',
    R2_BUCKET: 'ci-bucket',
  });
  assert.equal(env.R2_ENDPOINT, 'https://ci.example.invalid');
  assert.equal(env.R2_ACCESS_KEY_ID, 'ci-access');
  assert.equal(env.R2_SECRET_ACCESS_KEY, 'ci-secret');
  assert.equal(env.R2_BUCKET, 'ci-bucket');
  assert.equal(MANIFEST_KEY, 'manifest/papers.jsonl');
});
