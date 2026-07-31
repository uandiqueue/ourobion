/**
 * #300 §D · The extracted-blueprint artifact.
 *
 * Append-safe JSONL beside `claims.jsonl`, mirroring `synth/artifact.ts`. Deliberately a
 * SEPARATE file from `claims.jsonl` because the two feed different consumers: the A11
 * edge-loader reads claims, while `rules:load` reads blueprints into the `rules` table.
 * Writing blueprints into the claims stream would make the edge-loader parse records it has
 * no schema for.
 *
 * Two-tier truth (AGENTS.md §2): this artifact is a **derived projection**, rebuildable by
 * re-running synthesis. The hand-authored blueprints in `data/rules/**` remain git-tracked
 * TRUTH and are never touched by this producer — extracted blueprints land here, in the
 * corpus's `edges/` directory, and reach the `rules` table through the same loader.
 *
 * ESM / NodeNext — imports use explicit `.js` extensions.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { blueprintDedupeKey, dedupeBlueprints, existingBlueprintKeysFromText } from './blueprint.js';
import type { SynthBlueprintRecord } from './types.js';

/** Basename inside the edges dir. */
export const BLUEPRINTS_BASENAME = 'blueprints.jsonl';

/** R2 object key for the blueprint artifact, symmetric with `R2_CLAIMS_KEY`. */
export const R2_BLUEPRINTS_KEY = `edges/${BLUEPRINTS_BASENAME}`;

/** Absolute blueprints.jsonl path for an edges dir. */
export function blueprintsPath(edgesDir: string): string {
  return join(edgesDir, BLUEPRINTS_BASENAME);
}

/** Dedupe keys already present in the artifact at `path` (absent file → empty set). */
export function existingBlueprintKeys(path: string): Set<string> {
  if (!existsSync(path)) return new Set();
  try {
    return existingBlueprintKeysFromText(readFileSync(path, 'utf8'));
  } catch {
    return new Set();
  }
}

/** One JSONL line per blueprint record (no trailing newline). */
export function blueprintsToJsonl(records: readonly SynthBlueprintRecord[]): string {
  return records.map((r) => JSON.stringify(r)).join('\n');
}

export interface BlueprintWriteResult {
  path: string;
  written: number;
  skipped: number;
}

/**
 * Append blueprint records to `<edgesDir>/blueprints.jsonl`, skipping any whose dedupe key is
 * already present (G3). Idempotent: appending the same batch twice writes nothing the second
 * time, so a re-run after a partial batch cannot duplicate a rule.
 */
export function appendBlueprintsToDir(
  edgesDir: string,
  records: readonly SynthBlueprintRecord[],
): BlueprintWriteResult {
  const path = blueprintsPath(edgesDir);
  const existing = existingBlueprintKeys(path);
  const { toWrite, merged } = dedupeBlueprints(existing, records);
  if (toWrite.length === 0) return { path, written: 0, skipped: merged.length };

  mkdirSync(edgesDir, { recursive: true });
  const prior = existsSync(path) ? readFileSync(path, 'utf8') : '';
  const needsNewline = prior.length > 0 && !prior.endsWith('\n');
  const body = blueprintsToJsonl(toWrite);
  writeFileSync(path, `${prior}${needsNewline ? '\n' : ''}${body}\n`, 'utf8');
  return { path, written: toWrite.length, skipped: merged.length };
}

export { blueprintDedupeKey };
