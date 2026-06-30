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
}

export interface SearchParams {
  q?: string;
  filters?: SearchFilters;
  page?: number;
  pageSize?: number;
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
  p.concepts, p.doi, p.pmid, p.pmcid, p.status
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
  if (filters.topicTag !== undefined) {
    clauses.push(
      `EXISTS (SELECT 1 FROM json_each(${alias}.topic_tags) WHERE json_each.value = ?)`,
    );
    binds.push(filters.topicTag);
  }
  return { clauses, binds };
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
  let orderBy: string;

  if (match !== null) {
    // FTS branch: join papers_fts (MATCH) back to papers by rowid, rank by bm25.
    baseFrom = `FROM papers_fts f JOIN papers p ON p.rowid = f.rowid`;
    clauses.unshift(`papers_fts MATCH ?`);
    leadingBinds.push(match);
    orderBy = `ORDER BY bm25(papers_fts), p.cited_by_count DESC`;
  } else {
    baseFrom = `FROM papers p`;
    orderBy = `ORDER BY p.cited_by_count DESC, p.year DESC, p.rowid DESC`;
  }

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
 * Facet counts across the whole indexed corpus. One grouped query per facet
 * dimension; topic_tags is unnested via json_each so each tag is counted.
 * Buckets are ordered by descending count (year ascending for chronological axes
 * is handled at render time if desired).
 */
export async function facetCounts(injectedDb?: D1Database): Promise<FacetCounts> {
  const database = db(injectedDb);

  const scalarFacet = async (column: string): Promise<FacetBucket[]> => {
    const sql = `
      SELECT ${column} AS value, COUNT(*) AS count
      FROM papers
      WHERE ${column} IS NOT NULL
      GROUP BY ${column}
      ORDER BY count DESC, value ASC
    `;
    const res = await database.prepare(sql).all<{ value: string | number; count: number }>();
    return (res.results ?? []).map((r) => ({ value: String(r.value), count: r.count }));
  };

  const topicTagsFacet = async (): Promise<FacetBucket[]> => {
    const sql = `
      SELECT json_each.value AS value, COUNT(*) AS count
      FROM papers, json_each(papers.topic_tags)
      GROUP BY json_each.value
      ORDER BY count DESC, value ASC
    `;
    const res = await database.prepare(sql).all<{ value: string; count: number }>();
    return (res.results ?? []).map((r) => ({ value: String(r.value), count: r.count }));
  };

  // Note: column names here are fixed literals (not user input) — safe to interpolate.
  const [oaStatus, retrievability, workType, year, topicTags] = await Promise.all([
    scalarFacet('oa_status'),
    scalarFacet('retrievability'),
    scalarFacet('work_type'),
    scalarFacet('year'),
    topicTagsFacet(),
  ]);

  return { oaStatus, retrievability, workType, year, topicTags };
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
