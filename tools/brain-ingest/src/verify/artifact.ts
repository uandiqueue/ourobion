/**
 * A10 · Verifications artifact — append-safe `edges/verifications.jsonl` (§A10.5).
 *
 * The TRUTH-tier, rebuildable projection (memory 0001) the A11 edge-loader reads
 * (`tools/edge-loader --from-dir` / `--from-r2`). APPEND-ONLY JSONL: one
 * `EdgeVerification` per line. The local mirror lives beside the claims artifact
 * under the R2 cache layout at `data/corpus/edges/verifications.jsonl` (the same
 * basename R2's `edges/` prefix uses + edge-loader's VERIFICATIONS_BASENAME), so
 * `edge-loader --from-dir <edgesDir>` loads both artifacts unchanged.
 *
 * DEDUPE SEMANTICS (idempotent re-runs): a verification is skipped when a line
 * with the same `(edgeId, verifiedAt)` key already exists — EXACTLY the loader's
 * `on conflict (edge_id, verified_at) do nothing` version identity (§A11). A
 * re-verification produces a NEW verifiedAt and appends a fresh line (the loader
 * supersedes the older active row).
 *
 * R4-U3 · A SECOND, side artifact lives beside it: `edges/verification-raw.jsonl`
 * holds the verbatim provider response body behind each verification, joined on
 * the same `(edgeId, verifiedAt)` key. It is deliberately NOT part of the record
 * the loader ingests — see RAW_VERIFICATIONS_BASENAME.
 *
 * ESM / NodeNext — imports use explicit `.js` extensions.
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { R2Store } from '../storage/r2.js';
import type { VerifyRawRecord, VerifyRecord } from './types.js';

/** Basename inside the edges dir / R2 prefix (matches edge-loader's VERIFICATIONS_BASENAME). */
export const VERIFICATIONS_BASENAME = 'verifications.jsonl';
/** R2 object key for the verifications artifact (matches edge-loader's R2_VERIFICATIONS_KEY). */
export const R2_VERIFICATIONS_KEY = `edges/${VERIFICATIONS_BASENAME}`;

/**
 * R4-U3 · Basename of the RAW PROVIDER EVIDENCE side artifact.
 *
 * A separate file, not extra fields on `verifications.jsonl`, because the loader
 * ingests that file into `edge_verifications` — the table the serving path reads
 * to compose user-facing cards. Raw provider bodies are unreviewed model output;
 * they are evidence that must survive, and they must not ride into a serving
 * table. The edge-loader reads by exact basename, so this file sits inertly
 * beside the artifacts it loads and joins to them on `(edgeId, verifiedAt)`.
 */
export const RAW_VERIFICATIONS_BASENAME = 'verification-raw.jsonl';

/** Absolute verifications.jsonl path for an edges dir. */
export function verificationsPath(edgesDir: string): string {
  return join(edgesDir, VERIFICATIONS_BASENAME);
}

/** Absolute verification-raw.jsonl path for an edges dir (R4-U3). */
export function rawVerificationsPath(edgesDir: string): string {
  return join(edgesDir, RAW_VERIFICATIONS_BASENAME);
}

/** The dedupe key for a verification — the loader's (edge_id, verified_at) identity. */
export function verificationDedupeKey(v: Pick<VerifyRecord, 'edgeId' | 'verifiedAt'>): string {
  return `${v.edgeId}\0${v.verifiedAt}`;
}

/** Existing dedupe keys parsed from JSONL text (blank / unparseable lines ignored). */
export function existingKeysFromText(text: string): Set<string> {
  const keys = new Set<string>();
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (const line of clean.split(/\r?\n/)) {
    if (line.trim() === '') continue;
    try {
      const rec = JSON.parse(line) as VerifyRecord;
      if (rec && typeof rec.edgeId === 'string' && typeof rec.verifiedAt === 'string') {
        keys.add(verificationDedupeKey(rec));
      }
    } catch {
      // tolerate a bad line — dedupe just won't match it
    }
  }
  return keys;
}

export interface DedupeResult {
  toWrite: VerifyRecord[];
  skipped: VerifyRecord[];
}

/** Pure dedupe: partition by (edgeId, verifiedAt) key; also dedupes within the batch. */
export function dedupeAgainst(existingKeys: ReadonlySet<string>, records: readonly VerifyRecord[]): DedupeResult {
  const seen = new Set(existingKeys);
  const toWrite: VerifyRecord[] = [];
  const skipped: VerifyRecord[] = [];
  for (const v of records) {
    const key = verificationDedupeKey(v);
    if (seen.has(key)) {
      skipped.push(v);
    } else {
      seen.add(key);
      toWrite.push(v);
    }
  }
  return { toWrite, skipped };
}

/** One JSONL line per verification (no trailing newline). */
export function toJsonl(records: readonly VerifyRecord[]): string {
  return records.map((v) => JSON.stringify(v)).join('\n');
}

export interface WriteResult {
  path: string;
  written: number;
  skipped: number;
  /**
   * R4-U3 · Present when raw provider bodies accompanied the batch: where the
   * side artifact was written and how many lines landed.
   */
  raw?: { path: string; written: number; skipped: number };
}

/** Append JSONL lines to `path`, preserving the append-only single-newline layout. */
function appendJsonlLines(path: string, existing: string, lines: string): void {
  const needsLeadingNl = existing.length > 0 && !existing.endsWith('\n');
  appendFileSync(path, (needsLeadingNl ? '\n' : '') + lines + '\n', 'utf8');
}

/**
 * Append new verifications to the local `edges/verifications.jsonl`, skipping
 * duplicates. Creates the dir + file on first write. Append-only: existing lines
 * are never rewritten (truth-artifact semantics).
 *
 * R4-U3: when `rawRecords` are supplied, their provider bodies are appended to
 * the SIDE artifact `edges/verification-raw.jsonl` in the same call, under the
 * same `(edgeId, verifiedAt)` dedupe identity. Writing both here — rather than
 * leaving the caller to remember a second call — is what makes the evidence
 * survive by default instead of by discipline. See RAW_VERIFICATIONS_BASENAME
 * for why the bodies are not fields of the verification record.
 */
export function appendVerificationsToDir(
  edgesDir: string,
  records: readonly VerifyRecord[],
  rawRecords: readonly VerifyRawRecord[] = [],
): WriteResult {
  mkdirSync(edgesDir, { recursive: true });
  const path = verificationsPath(edgesDir);
  const existing = existsSync(path) ? readFileSync(path, 'utf8') : '';
  const { toWrite, skipped } = dedupeAgainst(existingKeysFromText(existing), records);
  if (toWrite.length > 0) {
    appendJsonlLines(path, existing, toJsonl(toWrite));
  }
  const result: WriteResult = { path, written: toWrite.length, skipped: skipped.length };
  if (rawRecords.length > 0) {
    result.raw = appendRawVerificationsToDir(edgesDir, rawRecords);
  }
  return result;
}

/**
 * R4-U3 · Append raw provider bodies to `edges/verification-raw.jsonl`.
 *
 * Same append-only + `(edgeId, verifiedAt)` dedupe semantics as the verifications
 * artifact, so a re-run is idempotent and a re-verification (new `verifiedAt`)
 * appends fresh evidence beside the fresh verdict rather than overwriting the
 * body that justified the old one.
 *
 * Exported separately as well as called from {@link appendVerificationsToDir} so
 * a caller holding evidence for already-written verifications can still land it.
 */
export function appendRawVerificationsToDir(
  edgesDir: string,
  rawRecords: readonly VerifyRawRecord[],
): { path: string; written: number; skipped: number } {
  mkdirSync(edgesDir, { recursive: true });
  const path = rawVerificationsPath(edgesDir);
  const existing = existsSync(path) ? readFileSync(path, 'utf8') : '';
  const seen = existingKeysFromText(existing);
  const toWrite: VerifyRawRecord[] = [];
  let skipped = 0;
  for (const r of rawRecords) {
    const key = verificationDedupeKey(r);
    if (seen.has(key)) {
      skipped++;
      continue;
    }
    seen.add(key);
    toWrite.push(r);
  }
  if (toWrite.length > 0) {
    appendJsonlLines(path, existing, toWrite.map((r) => JSON.stringify(r)).join('\n'));
  }
  return { path, written: toWrite.length, skipped };
}

/**
 * Append new verifications to the R2 `edges/verifications.jsonl` object (dual-mode
 * with the local mirror). R2 has no append primitive, so this reads the current
 * object, dedupes, and PUTs the merged JSONL back. Opt-in for a terminal /
 * prepopulation run (the R2 copy is the shared truth tier — write it deliberately).
 */
export async function appendVerificationsToR2(
  store: R2Store,
  records: readonly VerifyRecord[],
): Promise<{ key: string; written: number; skipped: number }> {
  let existing = '';
  try {
    existing = await store.getObjectText(R2_VERIFICATIONS_KEY);
  } catch {
    existing = '';
  }
  const { toWrite, skipped } = dedupeAgainst(existingKeysFromText(existing), records);
  if (toWrite.length > 0) {
    const base = existing.length === 0 ? '' : existing.endsWith('\n') ? existing : existing + '\n';
    const body = base + toJsonl(toWrite) + '\n';
    await store.putObject(R2_VERIFICATIONS_KEY, new TextEncoder().encode(body), 'application/x-ndjson');
  }
  return { key: R2_VERIFICATIONS_KEY, written: toWrite.length, skipped: skipped.length };
}
