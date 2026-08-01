/**
 * Paper manifest — the TRUTH-tier index (`data/corpus/papers.jsonl`, design §1, §6, §8).
 *
 * One {@link PaperRecord} per line (JSON Lines). The manifest is the only
 * durable run state besides `usage.json`: it records *what we have and where it
 * came from*, and re-reading it is how a crashed / multi-day ingest resumes
 * (§5.1, §10.6). The binaries themselves live in R2; this file is git-tracked
 * metadata only.
 *
 * Crash-safety:
 *  - {@link Manifest.append} appends a single line with a trailing `\n`, so a
 *    process killed mid-write loses at most the line being written — never
 *    corrupts prior records (append-only, no rewrite).
 *  - {@link Manifest.upsert} keeps an in-memory index keyed by `paperUid`. A new
 *    uid appends; an existing uid is updated by an atomic full-file rewrite
 *    (temp file + rename), so the file is never left half-written.
 *  - {@link readAll} tolerates blank / partially-written trailing lines (skips
 *    any line that does not parse) so a resume after a hard crash still loads.
 *
 * ESM / NodeNext — imports use explicit `.js` extensions. No network.
 */

import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  appendFileSync,
  renameSync,
  existsSync,
  unlinkSync,
} from 'node:fs';
import { resolve, dirname } from 'node:path';
import type { PaperRecord, PaperStatus } from './types.js';

/** Default manifest filename within a corpus dir (design §6). */
export const MANIFEST_FILENAME = 'papers.jsonl';

/** Per-status counts plus the total (powers the `status` CLI verb). */
export interface ManifestSummary {
  total: number;
  discovered: number;
  fetched: number;
  failed: number;
  /** distinct `topicTags` seen across all records, with per-tag totals */
  byTopic: Record<string, number>;
}

/**
 * Parse a JSONL buffer into records, skipping any line that is blank or does
 * not parse as a `PaperRecord` (tolerates a torn trailing line after a crash).
 */
export function parseJsonl(text: string): PaperRecord[] {
  const out: PaperRecord[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '') continue;
    try {
      const rec = JSON.parse(line) as PaperRecord;
      if (rec && typeof rec === 'object' && typeof rec.paperUid === 'string') {
        out.push(rec);
      }
    } catch {
      // Torn / partial line (crash mid-append) — skip it; the record will be
      // re-discovered on resume.
    }
  }
  return out;
}

/**
 * Read every record from a manifest file. Returns `[]` when the file does not
 * exist yet (a fresh corpus). Later records win on duplicate `paperUid` so the
 * returned list reflects the latest upsert for each paper.
 */
export function readAll(manifestPath: string): PaperRecord[] {
  if (!existsSync(manifestPath)) return [];
  const text = readFileSync(manifestPath, 'utf8');
  const rows = parseJsonl(text);
  // Collapse duplicates (an upsert that appended a fresh status line, etc.):
  // last-write-wins, preserving first-seen order.
  const index = new Map<string, number>();
  const result: PaperRecord[] = [];
  for (const rec of rows) {
    const at = index.get(rec.paperUid);
    if (at === undefined) {
      index.set(rec.paperUid, result.length);
      result.push(rec);
    } else {
      result[at] = rec;
    }
  }
  return result;
}

/** Compute a {@link ManifestSummary} over a set of records. */
export function summarize(records: readonly PaperRecord[]): ManifestSummary {
  const summary: ManifestSummary = {
    total: records.length,
    discovered: 0,
    fetched: 0,
    failed: 0,
    byTopic: {},
  };
  for (const rec of records) {
    switch (rec.status) {
      case 'discovered':
        summary.discovered++;
        break;
      case 'fetched':
        summary.fetched++;
        break;
      case 'failed':
        summary.failed++;
        break;
    }
    for (const tag of rec.topicTags) {
      summary.byTopic[tag] = (summary.byTopic[tag] ?? 0) + 1;
    }
  }
  return summary;
}

/**
 * A file-backed, in-memory-indexed manifest. Construct via {@link Manifest.open}
 * (or `new Manifest(path)`) — it eagerly loads existing records so `upsert`
 * dedups against them and `resume` can inspect prior state.
 */
export class Manifest {
  readonly path: string;
  /** paperUid → record (the live, deduped view) */
  private readonly index = new Map<string, PaperRecord>();
  /** insertion order of uids, so a rewrite preserves a stable line order */
  private readonly order: string[] = [];

  constructor(manifestPath: string) {
    this.path = manifestPath;
    for (const rec of readAll(manifestPath)) {
      if (!this.index.has(rec.paperUid)) this.order.push(rec.paperUid);
      this.index.set(rec.paperUid, rec);
    }
  }

  /**
   * Open the manifest at `${corpusDir}/papers.jsonl`. Convenience wrapper that
   * resolves the conventional filename within a corpus directory (§6).
   */
  static open(corpusDir: string): Manifest {
    return new Manifest(resolve(corpusDir, MANIFEST_FILENAME));
  }

  /** All current records, in first-seen order (latest value per uid). */
  all(): PaperRecord[] {
    return this.order.map((uid) => this.index.get(uid) as PaperRecord);
  }

  /** Whether a record with this `paperUid` is already known. */
  has(paperUid: string): boolean {
    return this.index.has(paperUid);
  }

  /** Look up a single record by `paperUid`. */
  get(paperUid: string): PaperRecord | undefined {
    return this.index.get(paperUid);
  }

  /** Status summary over the current records (powers the `status` verb). */
  summary(): ManifestSummary {
    return summarize(this.all());
  }

  private ensureDir(): void {
    mkdirSync(dirname(this.path), { recursive: true });
  }

  /** Append a single record line (crash-safe, append-only). */
  private appendLine(record: PaperRecord): void {
    this.ensureDir();
    appendFileSync(this.path, JSON.stringify(record) + '\n', 'utf8');
  }

  /** Atomic full-file rewrite from the in-memory index (temp file + rename). */
  private rewrite(): void {
    this.ensureDir();
    const expectedCount = this.index.size;
    const body = this.order
      .map((uid) => JSON.stringify(this.index.get(uid)))
      .join('\n');
    const payload = body.length > 0 ? body + '\n' : '';
    const tmp = `${this.path}.tmp`;
    writeFileSync(tmp, payload, 'utf8');

    // Validate the staged file before replacing the last known-good manifest.
    // At 20k+ records, a silently truncated rewrite would discard hours of
    // network work; count equality is the fail-closed invariant that matters.
    const stagedCount = readAll(tmp).length;
    if (stagedCount !== expectedCount) {
      unlinkSync(tmp);
      throw new Error(
        `manifest: staged rewrite count mismatch (expected ${expectedCount}, got ${stagedCount})`,
      );
    }

    renameSync(tmp, this.path);

    const persistedCount = readAll(this.path).length;
    if (persistedCount !== expectedCount) {
      throw new Error(
        `manifest: persisted rewrite count mismatch (expected ${expectedCount}, got ${persistedCount})`,
      );
    }
  }

  /**
   * Append a brand-new record. Throws if the uid already exists (use
   * {@link upsert} when a paper may already be present). Crash-safe append.
   */
  append(record: PaperRecord): void {
    if (this.index.has(record.paperUid)) {
      throw new Error(
        `manifest: append() called for existing paperUid '${record.paperUid}' — use upsert()`,
      );
    }
    this.index.set(record.paperUid, record);
    this.order.push(record.paperUid);
    this.appendLine(record);
  }

  /**
   * Insert `record` if its `paperUid` is new (crash-safe append), or replace the
   * existing record for that uid (atomic rewrite). Idempotent: re-upserting the
   * same uid never duplicates a manifest line. Returns whether the record was
   * newly inserted (`true`) vs updated (`false`).
   */
  upsert(record: PaperRecord): boolean {
    const existed = this.index.has(record.paperUid);
    this.index.set(record.paperUid, record);
    if (!existed) {
      this.order.push(record.paperUid);
      this.appendLine(record);
      return true;
    }
    this.rewrite();
    return false;
  }

  /**
   * Upsert many records efficiently: new uids are appended in one pass and any
   * update triggers a single trailing rewrite (instead of one per record).
   * Returns the count of newly-inserted records.
   */
  upsertMany(records: readonly PaperRecord[]): number {
    let inserted = 0;
    let needsRewrite = false;
    for (const record of records) {
      const existed = this.index.has(record.paperUid);
      this.index.set(record.paperUid, record);
      if (!existed) {
        this.order.push(record.paperUid);
        this.appendLine(record);
        inserted++;
      } else {
        needsRewrite = true;
      }
    }
    if (needsRewrite) this.rewrite();
    return inserted;
  }

  /**
   * Remove the record with `paperUid` from the in-memory index + order array and
   * atomically rewrite the file (reusing {@link rewrite}). Returns whether a
   * record existed for that uid. Used by the §4 reconciliation pass to drop an
   * orphan uid whose paper now lives under a canonical (merged) uid.
   */
  delete(paperUid: string): boolean {
    if (!this.index.has(paperUid)) return false;
    this.index.delete(paperUid);
    const at = this.order.indexOf(paperUid);
    if (at !== -1) this.order.splice(at, 1);
    this.rewrite();
    return true;
  }

  /** Records currently in a given processing status (resume selection helper). */
  withStatus(status: PaperStatus): PaperRecord[] {
    return this.all().filter((r) => r.status === status);
  }
}
