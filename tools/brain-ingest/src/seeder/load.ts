/**
 * Runtime loaders for the seeder's deterministic inputs (design step 1).
 *
 * The registry (`shared/metrics/registry.ts`) is TypeScript TRUTH; the rule
 * blueprints (`data/rules/single/**\/*.json`) are git-tracked TRUTH. Following
 * the house pattern (`verify/quoteCheck.ts` does not import `shared/`), this
 * module reads them at RUNTIME rather than statically importing the shared
 * types: the registry via a dynamic `import()` (this package already runs under
 * tsx, so the `.ts` source loads directly — no build step, one source of truth,
 * mirroring `tools/metric-view/lib/view.mjs`), and the blueprints via `fs`.
 *
 * The pure candidate builder (`candidates.ts`) takes these as plain inputs, so
 * unit tests bypass this module entirely with fixtures.
 *
 * ESM / NodeNext — imports use explicit `.js` extensions.
 */

import { readdirSync, readFileSync, type Dirent } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import type { BlueprintInput, RegistryMetricInput } from './types.js';

/** Repo root: `<repoRoot>/tools/brain-ingest/src/seeder` → up four. */
export function repoRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url)); // .../src/seeder
  return resolve(here, '..', '..', '..', '..'); // <repoRoot>
}

/**
 * Load the metric registry's relationship-seeding slice. Dynamic import keeps
 * `shared/` out of this package's static type graph (house pattern) and out of
 * its `tsc` include; the returned rows are cast to the structural mirror.
 */
export async function loadRegistryMetrics(root = repoRoot()): Promise<RegistryMetricInput[]> {
  const registryUrl = pathToFileURL(
    join(root, 'shared', 'metrics', 'registry.ts'),
  ).href;
  const mod = (await import(registryUrl)) as {
    METRICS?: ReadonlyArray<{
      key: string;
      status: string;
      derivedFrom: readonly string[] | null;
    }>;
  };
  if (!mod.METRICS) {
    throw new Error(`seeder: shared/metrics/registry.ts exported no METRICS (${registryUrl})`);
  }
  return mod.METRICS.map((m) => ({
    key: m.key,
    status: m.status,
    derivedFrom: m.derivedFrom,
  }));
}

/** Recursively collect `*.json` file paths under `dir` (sorted, deterministic). */
function jsonFilesUnder(dir: string): string[] {
  const out: string[] = [];
  let entries: Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true }) as Dirent[];
  } catch {
    return out; // missing dir → no blueprints
  }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...jsonFilesUnder(full));
    else if (e.isFile() && e.name.endsWith('.json')) out.push(full);
  }
  return out.sort();
}

/**
 * Load the shipped rule blueprints' `{ ruleId, metricKeys, status }` slice from
 * `data/rules/single/` (and `data/rules/cross/` when it lands). Only the fields
 * the candidate builder needs; ignores blueprints missing a valid shape.
 */
export function loadBlueprints(root = repoRoot()): BlueprintInput[] {
  const dirs = [join(root, 'data', 'rules', 'single'), join(root, 'data', 'rules', 'cross')];
  const out: BlueprintInput[] = [];
  for (const dir of dirs) {
    for (const file of jsonFilesUnder(dir)) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(readFileSync(file, 'utf8'));
      } catch {
        continue; // skip unreadable / non-JSON (e.g. a README that slipped in)
      }
      if (typeof parsed !== 'object' || parsed === null) continue;
      const obj = parsed as Record<string, unknown>;
      const ruleId = obj['ruleId'];
      const metricKeys = obj['metricKeys'];
      if (typeof ruleId !== 'string') continue;
      if (!Array.isArray(metricKeys) || !metricKeys.every((k) => typeof k === 'string')) continue;
      out.push({
        ruleId,
        metricKeys: metricKeys as string[],
        ...(typeof obj['status'] === 'string' ? { status: obj['status'] as string } : {}),
      });
    }
  }
  return out;
}
