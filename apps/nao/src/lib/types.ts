/**
 * mirrors tools/brain-ingest/src/types.ts — v2 may switch to a shared import
 *
 * The TRUTH-tier corpus record shape (`PaperRecord`) the nao dashboard reads from
 * R2 (`manifest/papers.jsonl` for listing, `meta/<encodeURIComponent(uid)>.json`
 * for detail) and indexes into D1/FTS5. Copied field-for-field from the ingestion
 * tool so the app has no build-time dependency on tools/brain-ingest. Keep in sync.
 *
 * Only the subset of types the dashboard consumes is mirrored (the record + its
 * nested metadata types); the tool's adapter/runtime/config types are not relevant
 * to nao and are intentionally omitted.
 */

/** Every known external identifier for a paper — the dedup + future-lookup map. */
export interface Identifiers {
  doi?: string;
  pmid?: string;
  pmcid?: string;
  arxiv?: string;
  openalex?: string;
  s2?: string;
}

/** OA status vocabulary. */
export type OaStatus = 'gold' | 'green' | 'hybrid' | 'bronze' | 'closed' | 'unknown';

/** OA version vocabulary. */
export type OaVersion = 'published' | 'accepted' | 'submitted' | null;

/** OA-location result for a paper. */
export interface OaInfo {
  isOa: boolean;
  status: OaStatus;
  bestOaUrl: string | null;
  /** 'cc-by' | 'cc-by-nc' | 'cc0' | 'publisher-specific' | null */
  license: string | null;
  version: OaVersion;
}

/** Retrievability classification. */
export type Retrievability = 'pdf' | 'html' | 'paywalled' | 'unknown';

/** Where a paper's binary/full text physically lives. */
export interface StorageInfo {
  kind: 'object' | 'local' | 'none';
  /** r2 key, e.g. `pdf/<paper_uid>.pdf` */
  key?: string;
  /** local path for browser-captured html */
  localPath?: string;
  contentType?: string;
  sizeBytes?: number;
  sha256?: string;
}

/** Text-extraction outcome. */
export interface FullTextInfo {
  extracted: boolean;
  method: 'jats' | 'core' | 'pdf' | 'html' | null;
  charCount: number | null;
}

/** Processing state of a manifest record. */
export type PaperStatus = 'discovered' | 'fetched' | 'failed';

/**
 * One `manifest/papers.jsonl` line — the TRUTH-tier index.
 * `paperUid` IS `Citation.paperId` in the brain contract.
 */
export interface PaperRecord {
  /** the join key; == Citation.paperId */
  paperUid: string;
  /** every known external id (dedup + future lookup) */
  identifiers: Identifiers;
  title: string;
  authors: string[];
  year: number | null;
  /** journal / preprint server */
  venue: string | null;
  abstract: string | null;
  /** which discovery API surfaced it */
  discoveredVia: string;
  /** seed domain(s): 'gut_microbiome' | 'dengue' | ... */
  topicTags: string[];
  oa: OaInfo;
  /** citation count snapshot; `asOf` = ISO date the count was read (counts drift) */
  metrics?: { citedByCount: number | null; source: 'openalex' | 'crossref' | null; asOf: string | null };
  /** structured complement to `venue`; `type` e.g. 'journal' | 'repository' | 'conference' */
  journal?: { issn: string[]; publisher: string | null; type: string | null };
  /** 'article' | 'preprint' | 'review' | ... */
  workType?: string | null;
  /** subject/topic display names (for dashboard facets) */
  concepts?: string[];
  retrievability: Retrievability;
  storage: StorageInfo;
  fullText: FullTextInfo;
  status: PaperStatus;
  errors: string[];
  /** ISO; null until fetched */
  fetchedAt: string | null;
}
