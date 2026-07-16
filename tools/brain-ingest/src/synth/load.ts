/**
 * Runtime loaders for the synthesis node's shared-contract dependencies.
 *
 * House pattern (mirrors `seeder/load.ts`): `shared/` is TRUTH but kept out of
 * this package's static type graph + `tsc` include. The REAL zod `validateClaim`
 * gate (shared/brain/relationships.schema.ts) and the active-metric registry
 * check are loaded here at RUNTIME via dynamic `import()` (this package runs
 * under tsx, so the `.ts` sources load directly — no build step, one source of
 * truth). Unit tests inject a fake validator + active-key set and never touch
 * this module.
 *
 * ESM / NodeNext — imports use explicit `.js` extensions.
 */

import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { loadRegistryMetrics, repoRoot } from '../seeder/load.js';
import type { SynthClaim } from './types.js';

/** The shared zod gate, typed to this package's structural mirror. */
export type ClaimValidator = (claim: unknown) => SynthClaim;

/**
 * Load `validateClaim` from shared/brain/relationships.schema.ts. It throws a
 * ZodError on any contract violation (the synthesis job's hard gate); the caught
 * message is logged as the rejection detail.
 */
export async function loadClaimValidator(root = repoRoot()): Promise<ClaimValidator> {
  const url = pathToFileURL(join(root, 'shared', 'brain', 'relationships.schema.ts')).href;
  const mod = (await import(url)) as { validateClaim?: (c: unknown) => unknown };
  if (typeof mod.validateClaim !== 'function') {
    throw new Error(`synth: shared/brain/relationships.schema.ts exported no validateClaim (${url})`);
  }
  return mod.validateClaim as ClaimValidator;
}

/**
 * Load the set of ACTIVE registry metric keys (shared/metrics), so an explicit
 * `--pair` can be rejected early if an endpoint isn't a live metric — the same
 * invariant edge-loader enforces at projection time, just fail-fast here.
 */
export async function loadActiveMetricKeys(root = repoRoot()): Promise<Set<string>> {
  const metrics = await loadRegistryMetrics(root);
  return new Set(metrics.filter((m) => m.status === 'active').map((m) => m.key));
}

export { repoRoot } from '../seeder/load.js';
