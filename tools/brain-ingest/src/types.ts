/**
 * Shared types for the ourobion brain-ingestion tool.
 *
 * The TRUTH-tier manifest record (`PaperRecord`, design §8), the discovery
 * `Candidate`, the runtime `SourceCtx` every adapter receives, and the three
 * adapter function types (`DiscoverFn`, `ResolveOaFn`, `RetrieveFn`).
 *
 * Downstream adapter authors implement against the types in this file ONLY.
 * Import with explicit `.js` extensions (ESM / NodeNext):
 *   import type { Candidate, SourceCtx, DiscoverFn } from '../../types.js';
 */

// ─────────────────────────────────────────────────────────────────────────────
// Identity & metadata (design §4, §8)
// ─────────────────────────────────────────────────────────────────────────────

/** Every known external identifier for a paper — the dedup + future-lookup map (§4). */
export interface Identifiers {
  doi?: string;
  pmid?: string;
  pmcid?: string;
  arxiv?: string;
  openalex?: string;
  s2?: string;
}

/** OA status vocabulary (design §8). */
export type OaStatus = 'gold' | 'green' | 'hybrid' | 'bronze' | 'closed' | 'unknown';

/** OA version vocabulary (design §8). */
export type OaVersion = 'published' | 'accepted' | 'submitted' | null;

/** OA-location result for a paper (design §8 `oa{}`). */
export interface OaInfo {
  isOa: boolean;
  status: OaStatus;
  bestOaUrl: string | null;
  /** 'cc-by' | 'cc-by-nc' | 'cc0' | 'publisher-specific' | null */
  license: string | null;
  version: OaVersion;
}

/**
 * Richer per-work metadata returned by the OpenAlex adapter alongside `OaInfo`
 * (citation count, structured journal/source, work type, subject concepts).
 * Complements `OaInfo`; landed onto the `PaperRecord` by the orchestrator.
 */
export interface WorkMeta {
  citedByCount: number | null;
  journal: { issn: string[]; publisher: string | null; type: string | null };
  workType: string | null;
  concepts: string[];
}

/** Retrievability classification (design §3 step 4, §8). */
export type Retrievability = 'pdf' | 'html' | 'paywalled' | 'unknown';

/** Where a paper's binary/full text physically lives (design §6, §8 `storage{}`). */
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

/** Text-extraction outcome (design §8 `fullText{}`). */
export interface FullTextInfo {
  extracted: boolean;
  /**
   * Which adapter served the bytes. Mostly extraction-technique-tagged
   * (`'jats'` / `'pdf'`) except where the SOURCE matters for observability:
   * `'core'` (CORE's pre-extracted text) and `'directOa'` (the free direct
   * fetch of `oa.bestOaUrl`, ahead of CORE) are tagged by source specifically
   * so a `directOa` hit is distinguishable from CORE's own PDF-download
   * fallback — both would otherwise look identical as a generic `'pdf'`.
   */
  method: 'jats' | 'core' | 'pdf' | 'html' | 'directOa' | null;
  charCount: number | null;
}

/** Processing state of a manifest record (design §8). */
export type PaperStatus = 'discovered' | 'fetched' | 'failed';

/**
 * One `data/corpus/papers.jsonl` line — the TRUTH-tier index (design §8).
 * `paperUid` IS `Citation.paperId` in the brain contract (§4).
 */
export interface PaperRecord {
  /** §4 — the join key; == Citation.paperId */
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

/**
 * A pre-identity candidate work as surfaced by a discovery adapter (design §10.3).
 * Collapsed to a canonical `PaperRecord` by the identity step (§4 / §10.4).
 */
export interface Candidate {
  identifiers: Identifiers;
  title: string;
  authors: string[];
  year: number | null;
  venue: string | null;
  abstract: string | null;
  /** which discovery API surfaced it — becomes PaperRecord.discoveredVia */
  discoveredVia: string;
}

/** A topic seed driving discovery (design §3.1 / §10.3). */
export interface Seed {
  topic: string;
  query: string;
  topicTags: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Source identity
// ─────────────────────────────────────────────────────────────────────────────

/** Every source the pipeline can talk to (discovery, OA-location, retrieval). */
export type SourceName =
  | 'crossref'
  | 'pubmed'
  | 'europepmc'
  | 'arxiv'
  | 's2'
  | 'doaj'
  | 'biorxiv'
  | 'lens'
  | 'openalex'
  | 'unpaywall'
  | 'pmc'
  | 'core'
  | 'directOa';

// ─────────────────────────────────────────────────────────────────────────────
// Runtime context handed to every adapter (design §5, §5.1)
// ─────────────────────────────────────────────────────────────────────────────

/** Per-source enablement, derived from key presence in config (§10.1). */
export type SourceEnablement = Record<SourceName, boolean>;

/**
 * Loaded, validated configuration (design §10.1).
 * Secrets come only from `tools/brain-ingest/.env` — never inlined, never logged.
 */
export interface Config {
  /** mailto= / email= polite-pool param (Crossref, OpenAlex, Unpaywall). [REQUIRED] */
  contactEmail: string;
  keys: {
    /** [REQUIRED] OA-location backbone */
    openalex: string;
    /** [REQUIRED] R2 / S3-compatible object storage */
    r2Endpoint: string;
    r2AccessKeyId: string;
    r2SecretAccessKey: string;
    r2Bucket: string;
    /** [RECOMMENDED/OPTIONAL] — undefined when absent → source disabled */
    ncbi?: string;
    s2?: string;
    core?: string;
    lens?: string;
  };
  /** per-source on/off, computed from required + optional key presence */
  enabled: SourceEnablement;
}

/**
 * Per-source rate-limiter handle (token bucket + concurrency). Implemented in
 * §10.2; adapters acquire a slot via `schedule` before every network call.
 */
export interface RateLimiter {
  /** Run `fn` once a slot for `source` is available (respects that source's bucket). */
  schedule<T>(source: SourceName, fn: () => Promise<T>): Promise<T>;
}

/**
 * Budget guard (design §5.1). Fail-closed: refuses the call that would cross
 * 95% of a metered source's daily cap. Counters persist across runs
 * (`data/corpus/usage.json`); reset at the provider's UTC-midnight window.
 */
export interface BudgetGuard {
  /** True if charging `cost` to `source` now would cross the 95% hard-stop line. */
  wouldExceed95(source: SourceName, cost: number): boolean;
  /**
   * Atomically charge `cost` against `source`'s daily budget and persist.
   * Throws (denies) when `wouldExceed95` — callers must not dispatch the call.
   */
  charge(source: SourceName, cost: number): void;
  /** Current consumed amount for `source` within the active window. */
  spent(source: SourceName): number;
}

/** Options accepted by the typed fetch helpers. */
export interface FetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string | Uint8Array;
  /** abort the request after this many ms */
  timeoutMs?: number;
  /** query params appended to the URL (polite-pool email etc. injected by the helper) */
  query?: Record<string, string | number | undefined>;
}

/**
 * The runtime context every adapter receives (design §5). Bundles config,
 * the rate limiter, the budget guard, and typed fetch helpers. The helpers
 * route through the rate limiter for `source`; charging the budget is the
 * adapter's explicit responsibility via `ctx.budget` (cost is source-specific).
 */
export interface SourceCtx {
  config: Config;
  limiter: RateLimiter;
  budget: BudgetGuard;
  /** GET/POST JSON, parsed as `T`. Routes through the limiter for `source`. */
  fetchJson<T>(source: SourceName, url: string, opts?: FetchOptions): Promise<T>;
  /** Fetch a text body (XML/Atom/JATS/HTML). Routes through the limiter for `source`. */
  fetchText(source: SourceName, url: string, opts?: FetchOptions): Promise<string>;
  /** Fetch raw bytes (PDF binary). Routes through the limiter for `source`. */
  fetchBytes(source: SourceName, url: string, opts?: FetchOptions): Promise<Uint8Array>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Adapter function types (the three layers — design §3, §10.3–§10.5)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Discovery adapter (§10.3): topic seed → candidate works with identifiers.
 * One per source under `src/sources/discovery/`.
 */
export type DiscoverFn = (ctx: SourceCtx, seed: Seed) => Promise<Candidate[]>;

/**
 * OA-location adapter (§10.4): resolve OA location for a batch of records
 * (OpenAlex batches up to 50 DOIs/call; Unpaywall is the per-DOI fallback).
 * Returns the resolved `OaInfo` keyed by the record's `paperUid`.
 */
export type ResolveOaFn = (
  ctx: SourceCtx,
  records: PaperRecord[],
) => Promise<Map<string, OaInfo>>;

/**
 * Retrieval adapter (§10.5): fetch the actual full text for one record and
 * return the stored-bytes + extracted-text outcome (storage + fullText patch).
 * Returns `null` when this source cannot serve the record (caller tries next).
 */
export type RetrieveFn = (
  ctx: SourceCtx,
  record: PaperRecord,
) => Promise<{ storage: StorageInfo; fullText: FullTextInfo } | null>;
