-- ourobion nao — D1 (SQLite) search-index schema.
--
-- This is a DERIVED projection of the truth-tier corpus (R2 manifest/papers.jsonl).
-- It is rebuilt by scripts/etl.mjs and must never be treated as a source of truth.
-- Apply with:  wrangler d1 execute ourobion-nao-index --file=src/db/schema.sql
--
-- `papers`      : the queryable PaperRecord scalars (one row per paperUid).
-- `papers_fts`  : a CONTENTLESS FTS5 index (content='') over the searchable text
--                 columns, kept in sync with `papers` via AFTER triggers. Contentless
--                 means FTS5 stores only the index, not a copy of the text — we join
--                 back to `papers` by rowid to read displayable columns.
--
-- All multi-valued / nested PaperRecord fields are stored as JSON text columns
-- (authors_json, topic_tags, concepts) so the ETL can round-trip them and the app
-- can JSON.parse() them; scalar facets (oa_status, retrievability, work_type, year)
-- are first-class columns for fast GROUP BY facet counts.

PRAGMA foreign_keys = ON;

-- ─────────────────────────────────────────────────────────────────────────────
-- Base table — queryable PaperRecord scalars
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS papers (
  -- integer rowid alias so the contentless FTS5 index can reference it cheaply
  rowid             INTEGER PRIMARY KEY AUTOINCREMENT,
  paper_uid         TEXT NOT NULL UNIQUE,          -- join key == Citation.paperId
  title             TEXT NOT NULL DEFAULT '',
  authors_json      TEXT NOT NULL DEFAULT '[]',    -- JSON string[] (PaperRecord.authors)
  year              INTEGER,                        -- nullable (PaperRecord.year)
  venue             TEXT,
  abstract          TEXT,
  oa_status         TEXT NOT NULL DEFAULT 'unknown',-- OaStatus (oa.status)
  retrievability    TEXT NOT NULL DEFAULT 'unknown',-- Retrievability
  work_type         TEXT,                           -- PaperRecord.workType
  cited_by_count    INTEGER,                        -- metrics.citedByCount (nullable)
  journal_publisher TEXT,                           -- journal.publisher
  topic_tags        TEXT NOT NULL DEFAULT '[]',     -- JSON string[] (topicTags)
  concepts          TEXT NOT NULL DEFAULT '[]',     -- JSON string[] (concepts)
  doi               TEXT,                           -- identifiers.doi
  pmid              TEXT,                           -- identifiers.pmid
  pmcid             TEXT,                           -- identifiers.pmcid
  status            TEXT NOT NULL DEFAULT 'discovered' -- PaperStatus
);

-- Facet / sort indexes (GROUP BY oa_status, year, etc. and ORDER BY cited_by_count).
CREATE INDEX IF NOT EXISTS idx_papers_oa_status      ON papers(oa_status);
CREATE INDEX IF NOT EXISTS idx_papers_retrievability ON papers(retrievability);
CREATE INDEX IF NOT EXISTS idx_papers_work_type      ON papers(work_type);
CREATE INDEX IF NOT EXISTS idx_papers_year           ON papers(year);
CREATE INDEX IF NOT EXISTS idx_papers_status         ON papers(status);
CREATE INDEX IF NOT EXISTS idx_papers_cited_by_count ON papers(cited_by_count);

-- ─────────────────────────────────────────────────────────────────────────────
-- FTS5 — contentless full-text index over (title, authors, abstract, concepts)
-- ─────────────────────────────────────────────────────────────────────────────
-- content='' makes this an EXTERNAL-CONTENT-less (contentless) index: it indexes
-- text we feed it but stores no copy. We feed it the human-readable forms (authors
-- and concepts flattened from their JSON arrays — done in the triggers below). The
-- rowid of papers_fts mirrors papers.rowid so a MATCH yields paper rows by rowid.
CREATE VIRTUAL TABLE IF NOT EXISTS papers_fts USING fts5(
  title,
  authors,
  abstract,
  concepts,
  content='',
  tokenize = 'unicode61 remove_diacritics 2'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Sync triggers — keep papers_fts aligned with papers.
-- A contentless FTS5 table cannot be UPDATEd in place; the 'delete' command
-- (rowid + old values) removes the old index entry, then we INSERT the new one.
-- The ETL flattens JSON arrays to spaces, but we also flatten here so any direct
-- write to `papers` stays searchable. SQLite has no json_each-to-string helper in a
-- trigger, so we index the raw JSON text for authors/concepts — unicode61 tokenizes
-- it into the individual name/concept words (brackets/quotes become token breaks).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TRIGGER IF NOT EXISTS papers_fts_ai AFTER INSERT ON papers BEGIN
  INSERT INTO papers_fts(rowid, title, authors, abstract, concepts)
  VALUES (new.rowid, new.title, new.authors_json, new.abstract, new.concepts);
END;

CREATE TRIGGER IF NOT EXISTS papers_fts_ad AFTER DELETE ON papers BEGIN
  INSERT INTO papers_fts(papers_fts, rowid, title, authors, abstract, concepts)
  VALUES ('delete', old.rowid, old.title, old.authors_json, old.abstract, old.concepts);
END;

CREATE TRIGGER IF NOT EXISTS papers_fts_au AFTER UPDATE ON papers BEGIN
  INSERT INTO papers_fts(papers_fts, rowid, title, authors, abstract, concepts)
  VALUES ('delete', old.rowid, old.title, old.authors_json, old.abstract, old.concepts);
  INSERT INTO papers_fts(rowid, title, authors, abstract, concepts)
  VALUES (new.rowid, new.title, new.authors_json, new.abstract, new.concepts);
END;
