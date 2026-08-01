/**
 * Runtime loader for the verifier node's shared-contract dependency.
 *
 * House pattern (mirrors `synth/load.ts` + `seeder/load.ts`): `shared/` is TRUTH
 * but kept out of this package's static type graph + `tsc` include. The REAL zod
 * `validateVerification` gate (shared/brain/relationships.schema.ts) is loaded here
 * at RUNTIME via a dynamic `import()` (this package runs under tsx, so the `.ts`
 * source loads directly — no build step, one source of truth). Unit tests inject a
 * fake validator and never touch this module.
 *
 * ESM / NodeNext — imports use explicit `.js` extensions.
 */

import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { repoRoot } from '../seeder/load.js';
import type { VerificationValidator } from './types.js';

/**
 * Load `validateVerification` from shared/brain/relationships.schema.ts. It throws
 * a ZodError on any contract violation (the verifier job's hard gate); the caught
 * message is logged as the rejection detail.
 */
export async function loadVerificationValidator(
  root = repoRoot(),
): Promise<VerificationValidator> {
  const url = pathToFileURL(join(root, 'shared', 'brain', 'relationships.schema.ts')).href;
  const mod = (await import(url)) as { validateVerification?: (v: unknown) => unknown };
  if (typeof mod.validateVerification !== 'function') {
    throw new Error(`verify: shared/brain/relationships.schema.ts exported no validateVerification (${url})`);
  }
  return mod.validateVerification as VerificationValidator;
}

export { repoRoot } from '../seeder/load.js';

/**
 * #300 §E · The shared copy gate, re-exported here so the verifier node loads its shared
 * dependencies from ONE module. Same runtime-import pattern as above; it screens a MODEL-authored
 * `caveat` before that text is placed on a record (see `enforce.ts` `validateCopy`).
 */
export { loadCopyValidator, type CopyValidator } from '../synth/load.js';
