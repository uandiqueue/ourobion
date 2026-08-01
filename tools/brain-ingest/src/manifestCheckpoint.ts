/**
 * Bounded local-manifest checkpointing for long retrieval runs.
 *
 * Retrieval can touch tens of thousands of existing records. Calling
 * `Manifest.upsert()` per record rewrites the complete JSONL each time, making
 * the run O(n²) in corpus size. This buffer preserves atomic rewrite semantics
 * while limiting crash loss to one small batch of changed records.
 */

import process from 'node:process';

import { Manifest, readAll } from './manifest.js';
import type { PaperRecord } from './types.js';

export const DEFAULT_MANIFEST_CHECKPOINT_RECORDS = 100;

export interface ManifestCheckpointOptions {
  interval?: number;
  log?: (line: string) => void;
}

export class ManifestCheckpointBuffer {
  private readonly pending = new Map<string, PaperRecord>();
  private readonly interval: number;
  private readonly log: (line: string) => void;

  constructor(
    private readonly manifest: Manifest,
    options: ManifestCheckpointOptions = {},
  ) {
    this.interval = options.interval ?? DEFAULT_MANIFEST_CHECKPOINT_RECORDS;
    if (!Number.isInteger(this.interval) || this.interval <= 0) {
      throw new RangeError('manifest checkpoint interval must be a positive integer');
    }
    this.log = options.log ?? (() => undefined);
  }

  /** Queue one changed record and atomically checkpoint once the bound is met. */
  stage(record: PaperRecord): void {
    this.pending.set(record.paperUid, record);
    if (this.pending.size >= this.interval) this.flush('interval');
  }

  /** Number of changed records not yet durably reflected in the local manifest. */
  pendingCount(): number {
    return this.pending.size;
  }

  /**
   * Atomically persist the pending batch and assert that no record disappeared.
   * The retrieval batch only updates already-discovered uids, so an insertion is
   * itself a fail-closed invariant violation.
   */
  flush(reason: string): void {
    if (this.pending.size === 0) return;

    const batch = [...this.pending.values()];
    const beforeCount = this.manifest.all().length;
    const inserted = this.manifest.upsertMany(batch);
    const afterCount = this.manifest.all().length;
    const persistedCount = readAll(this.manifest.path).length;

    if (inserted !== 0 || afterCount !== beforeCount || persistedCount !== beforeCount) {
      throw new Error(
        'manifest checkpoint count mismatch: ' +
          `before=${beforeCount}, inserted=${inserted}, after=${afterCount}, persisted=${persistedCount}`,
      );
    }

    this.pending.clear();
    this.log(`manifest checkpoint (${reason}): ${batch.length} changed record(s), ${afterCount} total`);
  }
}

interface ProcessLike {
  pid: number;
  once(event: 'exit', listener: () => void): unknown;
  once(event: 'SIGINT' | 'SIGTERM', listener: () => void): unknown;
  removeListener(event: 'exit', listener: () => void): unknown;
  removeListener(event: 'SIGINT' | 'SIGTERM', listener: () => void): unknown;
  kill(pid: number, signal: 'SIGINT' | 'SIGTERM'): boolean;
}

/** Install synchronous exit/signal guards; returns a cleanup function. */
export function installManifestCheckpointGuards(
  checkpoint: ManifestCheckpointBuffer,
  proc: ProcessLike = process,
): () => void {
  let handlingSignal = false;

  const onExit = (): void => checkpoint.flush('exit');
  const onSignal = (signal: 'SIGINT' | 'SIGTERM'): void => {
    if (handlingSignal) return;
    handlingSignal = true;
    try {
      checkpoint.flush(signal);
    } finally {
      cleanup();
      proc.kill(proc.pid, signal);
    }
  };
  const onSigint = (): void => onSignal('SIGINT');
  const onSigterm = (): void => onSignal('SIGTERM');
  const cleanup = (): void => {
    proc.removeListener('exit', onExit);
    proc.removeListener('SIGINT', onSigint);
    proc.removeListener('SIGTERM', onSigterm);
  };

  proc.once('exit', onExit);
  proc.once('SIGINT', onSigint);
  proc.once('SIGTERM', onSigterm);
  return cleanup;
}
