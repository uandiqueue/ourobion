/**
 * R2 object storage (design §6, §10.5).
 *
 * Cloudflare R2 is S3-compatible, so one `@aws-sdk/client-s3` client drives it
 * with `region: 'auto'` + `forcePathStyle: true` and the endpoint/keys from
 * {@link Config}. This module is the durable, canonical backing store for the
 * corpus (the TRUTH tier, §1): both the metadata (the combined manifest index +
 * per-paper records) AND the binaries (PDFs / JATS / extracted text) live here;
 * the local `data/corpus/` is a git-untracked cache.
 *
 * Key layout (design §6, content-addressed by `paper_uid`):
 *   manifest/papers.jsonl  combined manifest index (all records, one JSON/line)
 *   meta/<uid>.json        per-paper metadata record (the full PaperRecord)
 *   pdf/<uid>.pdf          downloadable OA PDFs
 *   jats/<uid>.xml         PMC / Europe PMC structured full text (preferred for extraction)
 *   text/<uid>.txt         extracted plain text (DERIVED — rebuildable)
 *
 * Idempotent re-sync: every binary records a `sha256`; {@link R2Store.sync}
 * skips the upload when the object already exists with a matching checksum, so
 * a crashed/multi-day run can re-run without re-uploading (design §6, §10.5).
 *
 * R2 is unmetered local-style storage — it is NOT one of the §5.1 metered
 * `SourceName`s and is not rate-limited, so writes do not route through the
 * `ctx` limiter/budget guard (those gate the HTTP discovery/OA/retrieval APIs).
 * All network I/O lives inside these methods; the pure helpers (`sha256`,
 * `*Key`) touch nothing, so tests exercise them — or a mock client — offline.
 *
 * ESM / NodeNext — imports use explicit `.js` extensions.
 */

import { createHash } from 'node:crypto';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import type { Config } from '../types.js';

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers — no network, no client (CI-testable offline)
// ─────────────────────────────────────────────────────────────────────────────

/** Lowercase hex SHA-256 of `bytes` (design §6 — per-binary checksum). */
export function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** R2 key for a paper's OA PDF binary: `pdf/<uid>.pdf` (design §6). */
export function pdfKey(paperUid: string): string {
  return `pdf/${encodeKeySegment(paperUid)}.pdf`;
}

/** R2 key for a paper's JATS full text: `jats/<uid>.xml` (design §6). */
export function jatsKey(paperUid: string): string {
  return `jats/${encodeKeySegment(paperUid)}.xml`;
}

/** R2 key for a paper's extracted plain text: `text/<uid>.txt` (design §6). */
export function textKey(paperUid: string): string {
  return `text/${encodeKeySegment(paperUid)}.txt`;
}

/** R2 key for the combined manifest index (all records, one JSON per line, §6). */
export const MANIFEST_KEY = 'manifest/papers.jsonl';

/** R2 key for one paper's full metadata record: `meta/<uid>.json` (design §6). */
export function metaKey(paperUid: string): string {
  return `meta/${encodeKeySegment(paperUid)}.json`;
}

/**
 * Make a `paper_uid` safe for the single key segment after the prefix.
 *
 * `paper_uid`s contain `:` and `/` (e.g. `doi:10.1234/foo.bar`, design §4). A
 * raw `/` would fabricate extra key hierarchy and an unescaped uid round-trips
 * ambiguously, so the colon-and-slash characters are percent-encoded while the
 * `pdf/` `jats/` `text/` prefix slash is added by the caller. Already-safe
 * characters (incl. `.`, `-`, `_`) are preserved for human-auditable keys.
 */
export function encodeKeySegment(paperUid: string): string {
  // encodeURIComponent escapes `/` and `:` but leaves `. - _ ~` and alphanum.
  return encodeURIComponent(paperUid);
}

// ─────────────────────────────────────────────────────────────────────────────
// The store
// ─────────────────────────────────────────────────────────────────────────────

/** Minimal S3 surface this module uses — lets tests pass a mock client. */
export interface S3Like {
  send(command: unknown): Promise<unknown>;
}

export interface R2Options {
  /** Inject a pre-built client (a mock in tests). Overrides `config`-derived client. */
  client?: S3Like;
}

/** Outcome of an idempotent {@link R2Store.sync}. */
export interface SyncResult {
  key: string;
  sha256: string;
  sizeBytes: number;
  /** `true` when the object already existed with a matching sha (no upload issued). */
  skipped: boolean;
}

/**
 * Build the S3 client for an R2 bucket from {@link Config}. `region: 'auto'`
 * and `forcePathStyle: true` are the R2-compatibility settings (design §6).
 */
export function createR2Client(config: Config): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: config.keys.r2Endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.keys.r2AccessKeyId,
      secretAccessKey: config.keys.r2SecretAccessKey,
    },
  });
}

/**
 * Thin idempotent wrapper over the R2 bucket. Network lives only in the async
 * methods; construction is pure (a mock `client` keeps tests offline).
 */
export class R2Store {
  private readonly client: S3Like;
  private readonly bucket: string;

  constructor(config: Config, opts: R2Options = {}) {
    this.client = opts.client ?? (createR2Client(config) as unknown as S3Like);
    this.bucket = config.keys.r2Bucket;
  }

  /** Upload `body` under `key`. Returns the stored size + sha256 (design §6). */
  async putObject(
    key: string,
    body: Uint8Array,
    contentType?: string,
  ): Promise<{ key: string; sha256: string; sizeBytes: number }> {
    const digest = sha256(body);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        // Persist the checksum as object metadata so a future head can compare
        // without re-downloading the body.
        Metadata: { sha256: digest },
      }),
    );
    return { key, sha256: digest, sizeBytes: body.byteLength };
  }

  /**
   * Delete the object at `key` (design §4 reconciliation — orphan `meta/<uid>.json`
   * cleanup). A NotFound resolves successfully (the object is already gone, which
   * is the desired end state); other errors propagate.
   */
  async deleteObject(key: string): Promise<void> {
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (err) {
      if (isNotFound(err)) return;
      throw err;
    }
  }

  /** Fetch an object's body decoded as UTF-8 text (JATS / extracted text). */
  async getObjectText(key: string): Promise<string> {
    const out = (await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    )) as { Body?: { transformToString?(enc?: string): Promise<string> } };
    const body = out.Body;
    if (body?.transformToString === undefined) {
      throw new Error(`r2: GET '${key}' returned no readable body`);
    }
    return body.transformToString('utf-8');
  }

  /**
   * Whether `key` exists. Returns the stored `sha256` metadata when present so
   * {@link sync} can compare without downloading. A 404 / NotFound resolves to
   * `{ exists: false }`; other errors propagate.
   */
  async headExists(key: string): Promise<{ exists: boolean; sha256?: string }> {
    try {
      const out = (await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      )) as { Metadata?: Record<string, string> };
      const stored = out.Metadata?.['sha256'];
      return stored !== undefined ? { exists: true, sha256: stored } : { exists: true };
    } catch (err) {
      if (isNotFound(err)) return { exists: false };
      throw err;
    }
  }

  /**
   * Idempotent upload (design §6 "record a sha256 … so a re-sync is idempotent").
   * If the object already exists with a matching sha, skips the upload; if it
   * exists with a differing/absent sha, or is missing, (re)uploads.
   */
  async sync(key: string, body: Uint8Array, contentType?: string): Promise<SyncResult> {
    const digest = sha256(body);
    const head = await this.headExists(key);
    if (head.exists && head.sha256 === digest) {
      return { key, sha256: digest, sizeBytes: body.byteLength, skipped: true };
    }
    const put = await this.putObject(key, body, contentType);
    return { ...put, skipped: false };
  }
}

/**
 * Recognise an S3 "object does not exist" error across the shapes the SDK uses
 * (`NotFound` / `NoSuchKey` name, or a 404 HTTP status).
 */
export function isNotFound(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const e = err as {
    name?: string;
    Code?: string;
    $metadata?: { httpStatusCode?: number };
  };
  if (e.name === 'NotFound' || e.name === 'NoSuchKey') return true;
  if (e.Code === 'NotFound' || e.Code === 'NoSuchKey') return true;
  return e.$metadata?.httpStatusCode === 404;
}
