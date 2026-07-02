/**
 * Remote control plane (nao UI ↔ R2 ↔ this CLI).
 *
 * A single small JSON document — `control/ingest-config.json` — in the SAME R2
 * bucket the corpus already lives in (design §6). It's the one shared surface
 * both sides already read/write: `apps/nao` via its native R2 binding at
 * request time (an authenticated API route), this CLI via the existing S3
 * credentials (`storage/r2.ts`). Nothing new to provision.
 *
 * Deliberately best-effort and OPT-IN (see `run.ts`'s `RunOptions.controlFromR2`):
 * a missing/unreadable/malformed document never blocks a local/offline run —
 * it just falls back to `DEFAULT_INGEST_CONTROL` (unpaused, no overrides).
 *
 * ESM / NodeNext — imports use explicit `.js` extensions.
 */

import type { IngestControlConfig } from './types.js';
import { DEFAULT_INGEST_CONTROL } from './types.js';
import type { R2Store } from './storage/r2.js';

/** R2 key for the control document (design §6 layout — alongside manifest/meta/pdf/jats/text). */
export const CONTROL_KEY = 'control/ingest-config.json';

/**
 * Fill in any missing/malformed fields from a partially-shaped document
 * (an older schema version, hand-edited JSON, etc.) with safe defaults.
 * Never throws — a non-object input degrades to `DEFAULT_INGEST_CONTROL`.
 */
export function normalizeIngestControl(
  partial: Partial<IngestControlConfig> | null | undefined,
): IngestControlConfig {
  if (partial == null || typeof partial !== 'object') return { ...DEFAULT_INGEST_CONTROL };
  return {
    paused: partial.paused === true,
    requestedRun: partial.requestedRun ?? null,
    limits: partial.limits != null && typeof partial.limits === 'object' ? partial.limits : {},
    updatedAt: typeof partial.updatedAt === 'string' ? partial.updatedAt : DEFAULT_INGEST_CONTROL.updatedAt,
    updatedBy: typeof partial.updatedBy === 'string' ? partial.updatedBy : DEFAULT_INGEST_CONTROL.updatedBy,
  };
}

/**
 * Best-effort read of the control document. Any failure (missing key, network
 * error, malformed JSON) degrades to `DEFAULT_INGEST_CONTROL` rather than
 * throwing — a controlled run must behave exactly like an uncontrolled one
 * when there's nothing (or nothing readable) to control it with.
 */
export async function loadIngestControl(store: R2Store): Promise<IngestControlConfig> {
  try {
    const text = await store.getObjectText(CONTROL_KEY);
    return normalizeIngestControl(JSON.parse(text) as Partial<IngestControlConfig>);
  } catch {
    return { ...DEFAULT_INGEST_CONTROL };
  }
}

/**
 * Clear a consumed one-shot `requestedRun` and persist. Best-effort: a failed
 * write here must not fail the run — a stale request just gets honored again
 * next time, which is harmless (same seed/limit, and `run()` is idempotent —
 * already-`fetched` papers are skipped either way).
 */
export async function clearRequestedRun(store: R2Store, current: IngestControlConfig): Promise<void> {
  const next: IngestControlConfig = { ...current, requestedRun: null };
  try {
    const body = new TextEncoder().encode(JSON.stringify(next, null, 2));
    await store.sync(CONTROL_KEY, body, 'application/json');
  } catch {
    // Best-effort — see docstring.
  }
}
