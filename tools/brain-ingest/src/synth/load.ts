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

/** The shared copy gate (shared/constants/copy_guidelines.ts) — true iff the text is clean. */
export type CopyValidator = (text: string) => boolean;

/**
 * Load `validateCopyString` from shared/constants/copy_guidelines.ts (O20/H3): the synthesized
 * `derivation` is user-adjacent copy (nao evidence panels), so diagnostic language must be
 * rejected BEFORE the artifact append — same runtime-import pattern as `loadClaimValidator`.
 */
export async function loadCopyValidator(root = repoRoot()): Promise<CopyValidator> {
  const url = pathToFileURL(join(root, 'shared', 'constants', 'copy_guidelines.ts')).href;
  const mod = (await import(url)) as { validateCopyString?: (t: string) => boolean };
  if (typeof mod.validateCopyString !== 'function') {
    throw new Error(
      `synth: shared/constants/copy_guidelines.ts exported no validateCopyString (${url})`,
    );
  }
  return mod.validateCopyString as CopyValidator;
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

/**
 * One active metric as the whole-paper prompt names it (#300 §A).
 *
 * Whole-paper synthesis no longer hands the model keyword terms — it hands it the
 * VOCABULARY OF METRICS and the entire paper, and lets the model decide which
 * relationships the paper actually supports. The human-readable `label` is included
 * because `gut_comfort_score` alone under-describes the metric, and the model has to
 * recognise the concept in prose that never uses the key.
 *
 * This is NOT a synonym map. Nothing here is a hand-maintained alias list a human must
 * extend before a new pair can be researched — it is the registry's own `ui.label`,
 * which already exists for every metric and is maintained for the app UI regardless.
 */
export interface ActiveMetricDescriptor {
  key: string;
  label: string | null;
  unit: string | null;
}

/**
 * Load the ACTIVE metric catalogue (key + registry `ui.label` + unit) for the whole-paper
 * prompt. Same runtime dynamic-import pattern as the other loaders, so `shared/` stays out
 * of this package's `tsc` include.
 */
export async function loadActiveMetricCatalogue(
  root = repoRoot(),
): Promise<ActiveMetricDescriptor[]> {
  const registryUrl = pathToFileURL(join(root, 'shared', 'metrics', 'registry.ts')).href;
  const mod = (await import(registryUrl)) as {
    METRICS?: ReadonlyArray<{
      key: string;
      status: string;
      unit: string | null;
      ui: { label: string } | null;
    }>;
  };
  if (!mod.METRICS) {
    throw new Error(`synth: shared/metrics/registry.ts exported no METRICS (${registryUrl})`);
  }
  return mod.METRICS.filter((m) => m.status === 'active').map((m) => ({
    key: m.key,
    label: m.ui?.label ?? null,
    unit: m.unit ?? null,
  }));
}

/** The shared blueprint zod gate, kept structurally opaque in this package (#300 §D). */
export type BlueprintValidator = (blueprint: unknown) => Record<string, unknown>;

/**
 * Load `validateBlueprint` from shared/rules/rule.schema.ts (#300 §D). It throws a ZodError on
 * any contract violation — including the non-diagnostic copy gate over `template.title` /
 * `template.body`, which the schema already enforces via `validateCopyString`. So an extracted
 * blueprint carrying diagnostic copy can never reach the artifact.
 */
export async function loadBlueprintValidator(root = repoRoot()): Promise<BlueprintValidator> {
  const url = pathToFileURL(join(root, 'shared', 'rules', 'rule.schema.ts')).href;
  const mod = (await import(url)) as { validateBlueprint?: (b: unknown) => unknown };
  if (typeof mod.validateBlueprint !== 'function') {
    throw new Error(`synth: shared/rules/rule.schema.ts exported no validateBlueprint (${url})`);
  }
  return mod.validateBlueprint as BlueprintValidator;
}

export { repoRoot } from '../seeder/load.js';
