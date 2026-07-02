/**
 * Remote control plane (nao UI ↔ R2 ↔ tools/brain-ingest's CLI).
 *
 * Server-only. Reads/writes a single small JSON document — `control/ingest-config.json`
 * — in the SAME R2 bucket the corpus lives in, via the NATIVE Cloudflare binding
 * (`getCloudflareContext().env.CORPUS`), same pattern as `lib/r2.ts`'s `getPaperMeta`.
 * `tools/brain-ingest`'s CLI reads the SAME object via its S3 credentials when run
 * with `--remote-control` (see `src/control.ts` there) — this is the one shared
 * surface, not a new service.
 *
 * Best-effort read: a missing/malformed document degrades to
 * `DEFAULT_INGEST_CONTROL` rather than throwing, mirroring the CLI side exactly
 * (`tools/brain-ingest/src/control.ts`'s `loadIngestControl`) so both ends agree
 * on what "no control document yet" means.
 */

import { getCloudflareContext } from '@opennextjs/cloudflare';
// Relative (not `@/lib/types`) because this file is imported directly by
// `node --test` (see tests/ingestControl.test.ts) for its pure functions —
// plain Node resolves relative specifiers but not the `@/` alias (a
// Next.js/webpack-only path mapping). d1.ts/r2.ts get away with the alias
// because they only `import type` from it, which Node's TS-stripping erases
// entirely; DEFAULT_INGEST_CONTROL/INGEST_SEED_TOPICS are real runtime values.
import { DEFAULT_INGEST_CONTROL, INGEST_SEED_TOPICS } from './types.ts';
import type { IngestControlConfig, IngestControlPatch } from './types.ts';

/** R2 key for the control document (mirrors tools/brain-ingest/src/control.ts's CONTROL_KEY). */
export const CONTROL_KEY = 'control/ingest-config.json';

function corpus(): R2Bucket {
  return getCloudflareContext().env.CORPUS;
}

/** Fill in missing/malformed fields from a partial/older document with safe defaults. */
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

/** Best-effort read — missing key / malformed JSON degrades to defaults, never throws. */
export async function getIngestControl(): Promise<IngestControlConfig> {
  try {
    const obj = await corpus().get(CONTROL_KEY);
    if (obj === null) return { ...DEFAULT_INGEST_CONTROL };
    const text = await obj.text();
    return normalizeIngestControl(JSON.parse(text) as Partial<IngestControlConfig>);
  } catch {
    return { ...DEFAULT_INGEST_CONTROL };
  }
}

/** Persist the full control document (callers merge over the current value first). */
export async function putIngestControl(config: IngestControlConfig): Promise<void> {
  await corpus().put(CONTROL_KEY, JSON.stringify(config, null, 2), {
    httpMetadata: { contentType: 'application/json' },
  });
}

/**
 * Validate a `POST /api/ingest-control` body. Pure — no I/O — so it's
 * unit-testable without a Workers/R2 context. Returns an error message, or
 * `null` when the body is acceptable.
 */
export function validatePatchBody(body: IngestControlPatch): string | null {
  if (body.requestSeed !== undefined && !(INGEST_SEED_TOPICS as readonly string[]).includes(body.requestSeed)) {
    return `unknown seed '${body.requestSeed}'. Known: ${INGEST_SEED_TOPICS.join(', ')}`;
  }
  if (body.requestLimit !== undefined && (!Number.isInteger(body.requestLimit) || body.requestLimit <= 0)) {
    return 'requestLimit must be a positive integer';
  }
  if (
    body.openalexDailyUsd !== undefined &&
    body.openalexDailyUsd !== null &&
    (typeof body.openalexDailyUsd !== 'number' || !Number.isFinite(body.openalexDailyUsd) || body.openalexDailyUsd <= 0)
  ) {
    return 'openalexDailyUsd must be a positive number, or null to clear the override';
  }
  return null;
}

/**
 * Merge a validated patch over the current document. Pure — no I/O — so the
 * merge semantics (which field wins, one-shot request stamping) are
 * unit-testable without R2/auth. Callers persist the result themselves.
 */
export function applyIngestControlPatch(
  current: IngestControlConfig,
  body: IngestControlPatch,
  stampedBy: string,
  nowIso: string,
): IngestControlConfig {
  const next: IngestControlConfig = { ...current, updatedAt: nowIso, updatedBy: stampedBy };

  if (body.paused !== undefined) {
    next.paused = body.paused;
  }

  if (body.clearRequest === true) {
    next.requestedRun = null;
  } else if (body.requestSeed !== undefined || body.requestLimit !== undefined) {
    next.requestedRun = {
      seed: body.requestSeed,
      limit: body.requestLimit,
      requestedAt: nowIso,
      requestedBy: stampedBy,
    };
  }

  if (body.openalexDailyUsd !== undefined) {
    next.limits = {
      ...next.limits,
      openalexDailyUsd: body.openalexDailyUsd === null ? undefined : body.openalexDailyUsd,
    };
  }

  return next;
}
