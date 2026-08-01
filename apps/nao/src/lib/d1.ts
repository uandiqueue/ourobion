/**
 * D1 (SQLite + FTS5) query helpers for the nao corpus dashboard.
 *
 * Server-only. These run inside Server Components / Route Handlers and read the
 * D1 binding via `getCloudflareContext().env.DB`. The D1 index is a DERIVED
 * projection of the truth-tier R2 manifest (built by scripts/etl.mjs) — it backs
 * count / search / facet queries so we never parse papers.jsonl per request.
 *
 * SECURITY: every query that embeds user input is PARAMETERIZED — values are bound
 * via `.bind(...)`, never string-concatenated. The only place user text reaches
 * SQL text is the FTS5 MATCH query string, which we sanitise into a quoted prefix
 * query (buildFtsMatchQuery) and then BIND as a parameter — so injection through
 * the MATCH operator is not possible.
 */

import { getCloudflareContext } from '@opennextjs/cloudflare';
import type { OaStatus, Retrievability, PaperStatus } from '@/lib/types';

// ─────────────────────────────────────────────────────────────────────────────
// Row + result types (what the helpers return)
// ─────────────────────────────────────────────────────────────────────────────

/** A row of the `papers` table, with JSON columns parsed into arrays. */
export interface PaperRow {
  paperUid: string;
  title: string;
  authors: string[];
  year: number | null;
  venue: string | null;
  abstract: string | null;
  oaStatus: OaStatus;
  retrievability: Retrievability;
  workType: string | null;
  citedByCount: number | null;
  journalPublisher: string | null;
  topicTags: string[];
  concepts: string[];
  doi: string | null;
  pmid: string | null;
  pmcid: string | null;
  status: PaperStatus;
  discoveredVia: string | null;
  fullTextExtracted: boolean;
  fullTextMethod: string | null;
}

/** Raw shape D1 returns for a `papers` row (JSON columns still strings). */
interface PaperRowRaw {
  paper_uid: string;
  title: string;
  authors_json: string;
  year: number | null;
  venue: string | null;
  abstract: string | null;
  oa_status: string;
  retrievability: string;
  work_type: string | null;
  cited_by_count: number | null;
  journal_publisher: string | null;
  topic_tags: string;
  concepts: string;
  doi: string | null;
  pmid: string | null;
  pmcid: string | null;
  status: string;
  discovered_via: string | null;
  full_text_extracted: number;
  full_text_method: string | null;
}

/** Filters accepted by searchPapers — each maps to an equality / membership clause. */
export interface SearchFilters {
  oaStatus?: string;
  retrievability?: string;
  workType?: string;
  year?: number;
  /** match papers whose topic_tags JSON array contains this tag */
  topicTag?: string;
  status?: string;
  discoveredVia?: string;
  /** full_text_method (jats|core|pdf|html|directOa) */
  method?: string;
}

/** Sort orders the Papers list offers. */
export type SortKey = 'citedByCount' | 'year' | 'title' | 'fetchedAt';

export interface SearchParams {
  q?: string;
  filters?: SearchFilters;
  page?: number;
  pageSize?: number;
  sort?: SortKey;
}

export interface SearchResult {
  rows: PaperRow[];
  total: number;
  page: number;
  pageSize: number;
}

/** One facet bucket: a value and the number of papers with it. */
export interface FacetBucket {
  value: string;
  count: number;
}

export interface FacetCounts {
  oaStatus: FacetBucket[];
  retrievability: FacetBucket[];
  workType: FacetBucket[];
  year: FacetBucket[];
  topicTags: FacetBucket[];
  status: FacetBucket[];
  discoveredVia: FacetBucket[];
  method: FacetBucket[];
}

/** Corpus-wide aggregates that power the Overview dashboard (what the pipeline did). */
export interface CorpusStats {
  total: number;
  discovered: number;
  fetched: number;
  failed: number;
  /** papers with retrievability in (pdf, html) */
  retrievable: number;
  /** papers with full text extracted */
  extracted: number;
  /** Σ full_text_char_count */
  totalCharCount: number;
  /** Σ storage_size_bytes */
  storageBytes: number;
  /** # objects physically stored (storage_kind = 'object') */
  storedObjects: number;
  /** MAX(fetched_at) ISO string, or null */
  lastFetchedAt: string | null;
  retrievability: FacetBucket[];
  oaStatus: FacetBucket[];
  topicTags: FacetBucket[];
  discoveredVia: FacetBucket[];
  year: FacetBucket[];
  /** extraction method counts (full_text_method, extracted papers only) */
  method: FacetBucket[];
  workType: FacetBucket[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Internals
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

/**
 * Resolve the D1 handle. Production passes nothing → the CORPUS-sibling DB binding
 * via getCloudflareContext(). Tests inject a fake D1Database (fixture-only, no live
 * DB) so the SQL-building / parameterization logic is exercised offline.
 */
function db(injected?: D1Database): D1Database {
  return injected ?? getCloudflareContext().env.DB;
}

function safeJsonArray(raw: string | null | undefined): string[] {
  if (raw === null || raw === undefined || raw === '') return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((v) => String(v)) : [];
  } catch {
    return [];
  }
}

function mapRow(r: PaperRowRaw): PaperRow {
  return {
    paperUid: r.paper_uid,
    title: r.title,
    authors: safeJsonArray(r.authors_json),
    year: r.year,
    venue: r.venue,
    abstract: r.abstract,
    oaStatus: r.oa_status as OaStatus,
    retrievability: r.retrievability as Retrievability,
    workType: r.work_type,
    citedByCount: r.cited_by_count,
    journalPublisher: r.journal_publisher,
    topicTags: safeJsonArray(r.topic_tags),
    concepts: safeJsonArray(r.concepts),
    doi: r.doi,
    pmid: r.pmid,
    pmcid: r.pmcid,
    status: r.status as PaperStatus,
    discoveredVia: r.discovered_via,
    fullTextExtracted: r.full_text_extracted === 1,
    fullTextMethod: r.full_text_method,
  };
}

/**
 * Turn free user text into a SAFE FTS5 MATCH query.
 *
 * FTS5 has its own query mini-language (column filters, `NEAR`, `*`, `-`, `OR`,
 * unbalanced quotes) that would either error or let a user craft odd queries. We
 * neutralise it: split on whitespace, strip the FTS5 quote char, drop empties,
 * wrap each token in double quotes (so it is a literal phrase token), and append
 * `*` for prefix matching. The resulting string is then BOUND as a parameter, not
 * concatenated into SQL. Returns null when there is no usable token (caller lists).
 */
export function buildFtsMatchQuery(q: string): string | null {
  const tokens = q
    .split(/\s+/)
    .map((t) => t.replace(/"/g, '').trim())
    .filter((t) => t.length > 0);
  if (tokens.length === 0) return null;
  // Each token: "phrase"* → quoted literal + prefix match. AND-joined by FTS5 default.
  return tokens.map((t) => `"${t}"*`).join(' ');
}

// Always qualified with the `p` alias: in the FTS branch we JOIN papers_fts (which
// exposes its own title/abstract/concepts columns), so unqualified names would be
// ambiguous. Both branches alias the base table as `p`, so `p.col` is unambiguous.
const PAPER_COLUMNS = `
  p.paper_uid, p.title, p.authors_json, p.year, p.venue, p.abstract, p.oa_status,
  p.retrievability, p.work_type, p.cited_by_count, p.journal_publisher, p.topic_tags,
  p.concepts, p.doi, p.pmid, p.pmcid, p.status,
  p.discovered_via, p.full_text_extracted, p.full_text_method
`;

/**
 * Build the WHERE fragment + ordered bind values for the scalar filters.
 * Each clause uses a `?` placeholder; values are returned for `.bind(...)`.
 * topicTag uses an EXISTS over json_each(topic_tags) so it matches array membership.
 */
function buildFilterClauses(
  filters: SearchFilters | undefined,
  alias: string,
): { clauses: string[]; binds: Array<string | number> } {
  const clauses: string[] = [];
  const binds: Array<string | number> = [];
  if (filters === undefined) return { clauses, binds };

  if (filters.oaStatus !== undefined) {
    clauses.push(`${alias}.oa_status = ?`);
    binds.push(filters.oaStatus);
  }
  if (filters.retrievability !== undefined) {
    clauses.push(`${alias}.retrievability = ?`);
    binds.push(filters.retrievability);
  }
  if (filters.workType !== undefined) {
    clauses.push(`${alias}.work_type = ?`);
    binds.push(filters.workType);
  }
  if (filters.year !== undefined) {
    clauses.push(`${alias}.year = ?`);
    binds.push(filters.year);
  }
  if (filters.status !== undefined) {
    clauses.push(`${alias}.status = ?`);
    binds.push(filters.status);
  }
  if (filters.discoveredVia !== undefined) {
    clauses.push(`${alias}.discovered_via = ?`);
    binds.push(filters.discoveredVia);
  }
  if (filters.method !== undefined) {
    clauses.push(`${alias}.full_text_method = ?`);
    binds.push(filters.method);
  }
  if (filters.topicTag !== undefined) {
    clauses.push(
      `EXISTS (SELECT 1 FROM json_each(${alias}.topic_tags) WHERE json_each.value = ?)`,
    );
    binds.push(filters.topicTag);
  }
  return { clauses, binds };
}

/**
 * Build the ORDER BY clause for a sort key. Fixed column literals only (no user
 * input). When no sort is given: FTS ranks by bm25 relevance, the plain list by
 * citations. NULLs sort last under DESC in SQLite, which is what we want.
 */
function orderByFor(sort: SortKey | undefined, isFts: boolean): string {
  switch (sort) {
    case 'year':
      return `ORDER BY p.year DESC, p.cited_by_count DESC`;
    case 'title':
      return `ORDER BY p.title COLLATE NOCASE ASC`;
    case 'fetchedAt':
      return `ORDER BY p.fetched_at DESC, p.cited_by_count DESC`;
    case 'citedByCount':
      return `ORDER BY p.cited_by_count DESC, p.year DESC, p.rowid DESC`;
    default:
      return isFts
        ? `ORDER BY bm25(papers_fts), p.cited_by_count DESC`
        : `ORDER BY p.cited_by_count DESC, p.year DESC, p.rowid DESC`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Search / list papers. When `q` yields FTS tokens we MATCH the contentless
 * `papers_fts` index and join back to `papers`; otherwise we list `papers`
 * directly. Filters (scalar equality + topic-tag membership) and pagination apply
 * in both branches. Fully parameterized.
 */
export async function searchPapers(
  params: SearchParams = {},
  injectedDb?: D1Database,
): Promise<SearchResult> {
  const page = Math.max(1, Math.floor(params.page ?? 1));
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Math.floor(params.pageSize ?? DEFAULT_PAGE_SIZE)),
  );
  const offset = (page - 1) * pageSize;

  const match = params.q !== undefined ? buildFtsMatchQuery(params.q) : null;
  const { clauses, binds } = buildFilterClauses(params.filters, 'p');

  let baseFrom: string;
  const leadingBinds: Array<string | number> = [];

  if (match !== null) {
    // FTS branch: join papers_fts (MATCH) back to papers by rowid.
    baseFrom = `FROM papers_fts f JOIN papers p ON p.rowid = f.rowid`;
    clauses.unshift(`papers_fts MATCH ?`);
    leadingBinds.push(match);
  } else {
    baseFrom = `FROM papers p`;
  }

  // Sort: an explicit sort key wins; otherwise FTS ranks by relevance and the
  // plain list ranks by citations. Column names are fixed literals (not user
  // input), so they are safe to interpolate.
  const orderBy = orderByFor(params.sort, match !== null);

  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const whereBinds = [...leadingBinds, ...binds];

  const countSql = `SELECT COUNT(*) AS n ${baseFrom} ${where}`;
  const rowsSql = `SELECT ${PAPER_COLUMNS} ${baseFrom} ${where} ${orderBy} LIMIT ? OFFSET ?`;

  const database = db(injectedDb);
  const countStmt = database.prepare(countSql).bind(...whereBinds);
  const rowsStmt = database.prepare(rowsSql).bind(...whereBinds, pageSize, offset);

  const [countRes, rowsRes] = await Promise.all([
    countStmt.first<{ n: number }>(),
    rowsStmt.all<PaperRowRaw>(),
  ]);

  return {
    rows: (rowsRes.results ?? []).map(mapRow),
    total: countRes?.n ?? 0,
    page,
    pageSize,
  };
}

/**
 * Grouped COUNT over one scalar column (NULLs excluded), ordered by count desc.
 * `column` is a fixed literal supplied by this module — never user input.
 */
async function scalarFacet(database: D1Database, column: string): Promise<FacetBucket[]> {
  const sql = `
    SELECT ${column} AS value, COUNT(*) AS count
    FROM papers
    WHERE ${column} IS NOT NULL
    GROUP BY ${column}
    ORDER BY count DESC, value ASC
  `;
  const res = await database.prepare(sql).all<{ value: string | number; count: number }>();
  return (res.results ?? []).map((r) => ({ value: String(r.value), count: r.count }));
}

/** Grouped COUNT over the unnested topic_tags JSON array (each tag counted once). */
async function topicTagsFacet(database: D1Database): Promise<FacetBucket[]> {
  const sql = `
    SELECT json_each.value AS value, COUNT(*) AS count
    FROM papers, json_each(papers.topic_tags)
    GROUP BY json_each.value
    ORDER BY count DESC, value ASC
  `;
  const res = await database.prepare(sql).all<{ value: string; count: number }>();
  return (res.results ?? []).map((r) => ({ value: String(r.value), count: r.count }));
}

/**
 * Facet counts across the whole indexed corpus. One grouped query per facet
 * dimension; topic_tags is unnested via json_each so each tag is counted.
 * Buckets are ordered by descending count.
 */
export async function facetCounts(injectedDb?: D1Database): Promise<FacetCounts> {
  const database = db(injectedDb);
  const [oaStatus, retrievability, workType, year, topicTags, status, discoveredVia, method] =
    await Promise.all([
      scalarFacet(database, 'oa_status'),
      scalarFacet(database, 'retrievability'),
      scalarFacet(database, 'work_type'),
      scalarFacet(database, 'year'),
      topicTagsFacet(database),
      scalarFacet(database, 'status'),
      scalarFacet(database, 'discovered_via'),
      scalarFacet(database, 'full_text_method'),
    ]);

  return { oaStatus, retrievability, workType, year, topicTags, status, discoveredVia, method };
}

/** Raw shape the corpus-totals query returns. */
interface TotalsRaw {
  total: number;
  discovered: number;
  fetched: number;
  failed: number;
  retrievable: number;
  extracted: number;
  chars: number;
  bytes: number;
  objects: number;
  last_fetched: string | null;
}

/**
 * Corpus-wide aggregates for the Overview dashboard: one scalar-totals query plus
 * the grouped breakdowns (reusing the facet helpers). All column names are fixed
 * literals — no user input reaches the SQL.
 */
export async function corpusStats(injectedDb?: D1Database): Promise<CorpusStats> {
  const database = db(injectedDb);

  const totalsSql = `
    SELECT
      COUNT(*)                                                        AS total,
      SUM(CASE WHEN status = 'discovered' THEN 1 ELSE 0 END)          AS discovered,
      SUM(CASE WHEN status = 'fetched'    THEN 1 ELSE 0 END)          AS fetched,
      SUM(CASE WHEN status = 'failed'     THEN 1 ELSE 0 END)          AS failed,
      SUM(CASE WHEN retrievability IN ('pdf','html') THEN 1 ELSE 0 END) AS retrievable,
      SUM(full_text_extracted)                                       AS extracted,
      SUM(COALESCE(full_text_char_count, 0))                         AS chars,
      SUM(COALESCE(storage_size_bytes, 0))                           AS bytes,
      SUM(CASE WHEN storage_kind = 'object' THEN 1 ELSE 0 END)       AS objects,
      MAX(fetched_at)                                                AS last_fetched
    FROM papers
  `;

  const [totals, retrievability, oaStatus, topicTags, discoveredVia, year, method, workType] =
    await Promise.all([
      database.prepare(totalsSql).first<TotalsRaw>(),
      scalarFacet(database, 'retrievability'),
      scalarFacet(database, 'oa_status'),
      topicTagsFacet(database),
      scalarFacet(database, 'discovered_via'),
      scalarFacet(database, 'year'),
      scalarFacet(database, 'full_text_method'),
      scalarFacet(database, 'work_type'),
    ]);

  return {
    total: totals?.total ?? 0,
    discovered: totals?.discovered ?? 0,
    fetched: totals?.fetched ?? 0,
    failed: totals?.failed ?? 0,
    retrievable: totals?.retrievable ?? 0,
    extracted: totals?.extracted ?? 0,
    totalCharCount: totals?.chars ?? 0,
    storageBytes: totals?.bytes ?? 0,
    storedObjects: totals?.objects ?? 0,
    lastFetchedAt: totals?.last_fetched ?? null,
    retrievability,
    oaStatus,
    topicTags,
    discoveredVia,
    year,
    method,
    workType,
  };
}

/** Fetch a single paper row by paperUid (parameterized). Null when absent. */
export async function getPaperRow(
  uid: string,
  injectedDb?: D1Database,
): Promise<PaperRow | null> {
  const sql = `SELECT ${PAPER_COLUMNS} FROM papers p WHERE p.paper_uid = ? LIMIT 1`;
  const res = await db(injectedDb).prepare(sql).bind(uid).first<PaperRowRaw>();
  return res === null ? null : mapRow(res);
}

// ─────────────────────────────────────────────────────────────────────────────
// Detail-row read (the paper-detail fallback)
//
// The paper-detail page reads the full PaperRecord from the R2 corpus object.
// When that object is not reachable (the local `next dev` R2 simulator holds no
// objects — see apps/nao/README.md), the page falls back to this row so a paper
// the index demonstrably lists does not answer with a bare 404. It selects four
// columns `PAPER_COLUMNS` omits, which the detail page renders but the list does
// not; PAPER_COLUMNS and the search path are deliberately left untouched.
//
// This row is STRICTLY thinner than the corpus object — nine rendered fields have
// no column in `papers` at all (see D1_UNAVAILABLE_FIELDS in lib/paperDetail.ts).
// Callers MUST label the difference; that is why this is a separate type.
// ─────────────────────────────────────────────────────────────────────────────

/** `PaperRow` plus the four detail-only columns. */
export interface PaperDetailRow extends PaperRow {
  fullTextCharCount: number | null;
  storageKind: string | null;
  storageSizeBytes: number | null;
  fetchedAt: string | null;
}

interface PaperDetailRowRaw extends PaperRowRaw {
  full_text_char_count: number | null;
  storage_kind: string | null;
  storage_size_bytes: number | null;
  fetched_at: string | null;
}

const PAPER_DETAIL_COLUMNS = `
  ${PAPER_COLUMNS.trim()},
  p.full_text_char_count, p.storage_kind, p.storage_size_bytes, p.fetched_at
`;

/**
 * Fetch the widened detail row by paperUid (parameterized). Null when absent —
 * which, unlike an unreachable corpus object, genuinely means the index has no
 * such paper and a 404 is the honest answer.
 */
export async function getPaperDetailRow(
  uid: string,
  injectedDb?: D1Database,
): Promise<PaperDetailRow | null> {
  const sql = `SELECT ${PAPER_DETAIL_COLUMNS} FROM papers p WHERE p.paper_uid = ? LIMIT 1`;
  const res = await db(injectedDb).prepare(sql).bind(uid).first<PaperDetailRowRaw>();
  if (res === null) return null;
  return {
    ...mapRow(res),
    fullTextCharCount: res.full_text_char_count,
    storageKind: res.storage_kind,
    storageSizeBytes: res.storage_size_bytes,
    fetchedAt: res.fetched_at,
  };
}
