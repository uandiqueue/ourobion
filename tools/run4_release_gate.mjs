#!/usr/bin/env node
/** Run 4 release-gate primitives. Malformed, incomplete, or ambiguous input fails closed. */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import TOML from '@iarna/toml';
import { parseDocument } from 'yaml';

const repo = resolve(fileURLToPath(new URL('..', import.meta.url)));
const sha = (value) => createHash('sha256').update(value).digest('hex');
const fail = (message) => { throw new Error(message); };
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/** Hash repository text canonically so Windows CRLF and Linux LF checkouts attest identically. */
export function hashTextEvidence(value) {
  const text = Buffer.isBuffer(value) ? value.toString('utf8') : String(value);
  return sha(text.replaceAll('\r\n', '\n'));
}

// This is deliberately the CURRENT unit boundary, not the original Run 4 envelope/bootstrap SHA.
// Consolidated Run 3/MT3 history landed before the U0 reconciliation and was excluded by selecting
// the exact post-consolidation integration tip as that unit's explicit starting point.
//
// ADVANCE THIS PER UNIT. run-envelope.json accepts the caps for `RUN4_UNIT_BASE_SHA..HEAD` ONLY,
// and orchestration-log.md recorded the previous value as "ACCEPTED for U0 only" — the caps are a
// per-unit landing budget, never a whole-run total. Freezing one SHA across the run charges every
// later unit for everything that landed on the integration branch after it. That is not theoretical:
// R4-U1 (PR #170) failed with `landing delta has 12957 added lines; cap is 8500` because the
// model-training MT4 merge (PR #169) had advanced the base and alone consumed 7,897 of the 8,500
// lines, leaving 603 for any unit. The same class of failure is recorded for Run 3 in
// docs/temp/run4/README.md ("MT0 added 59 files / 5,362 insertions after the candidate baseline and
// broke U0's evidence and mergeability").
//
// So: at the start of each unit, set this to that unit's exact base SHA and re-record the deploy
// attestation (`record-attestation`), which binds these same three constants at :577. The caps
// themselves (115 / 8,500) are unchanged and still fail closed.
//
// Superseded values, retained as provenance:
//   837b7e690f92dc1669428a2476c9d8d0456020e8  (earliest U0 unit base)
//   77c98213e23ad56ae37c86201b39ef4e7543a543  (U0 unit base — consolidated Run 3/MT3 tip)
//   c558c04f1b661a59c8987c96770768eeea46e0cc  (U0 post-reconciliation base; ACCEPTED for U0 only)
//   ff0546434f081cadc3e5683217d484f250c19139  (R4-U7 canonical-UI base; ACCEPTED for U7/U8 only)
//   547280f69fe37fe1c7271ea126002f9ffaadafb9  (U9 base — tip after #191/#202; ACCEPTED for U9 only)
//   87a6364ff34cfd7072e29e466f2f1e90d3c1e25f  (U10 candidate base — tip after #206/#205/#208/#210/
//                                              #211; superseded before push by #176/#190/#217
//                                              landing while this unit was blocked on Docker)
//   2749381a405de882c6d96cdf21a57034e28204ea  (U10 base — tip after #217; ACCEPTED for U10 only)
//   da6b11b5df057fe6b5f5f6dcb14f13343805a94b  (R4-U1 correction base — tip after #214; ACCEPTED
//                                              for that #232 push only)
//
// Re-advanced for the same R4-U1 correction (#232), same branch. #232's green status went stale
// again: PR #199 (the U4 scientific-semantics/trust-labels unit) merged into the integration
// branch after da6b11b was set, advancing the tip to 789e6a0 and, per the same mechanism recorded
// above for #214, charging U1 for #199's lines — cumulative delta from 2749381 was measured at
// roughly 12,500 added lines against the 8,500 cap. #232 already touches this file, ci.yml, and
// the attestation manifest, so the base advance is folded into this PR rather than opening a
// separate base-advance PR that would collide with it.
//
// Advanced for the final R4-U3 landing after #232, #224, #230, #213, #216 and the reconciliation
// closeout #237 merged. This is the exact dev-phase2-run4 tip at branch cut. Re-check the remote
// immediately before push; if it moved, this value and the generated attestation must move again.
// Caps remain 115 / 8,500 and fail closed; only the per-unit starting point changes.
export const RUN4_UNIT_BASE_SHA = 'e975a21e8c75b6ec93ff0f90954a87bc4948c2dd';

// ---------------------------------------------------------------------------------------------
// Immutable product cap (issue #183) — MEASURED AND RECORDED, NOT YET GATING.
//
// RUN4_UNIT_BASE_SHA above is a per-unit landing budget: it moves every unit, so it can never
// answer "how big did Run 4's final product actually get?". #183's answer is one immutable union
// from the Run 4 product base, with the MT4 model-training merge excluded through its exact
// first-parent merge delta (path set, per-path status, and resulting blob all bound below, so the
// exclusion cannot be widened by hand).
//
// Why this is not wired to CI as a gate. Measured on the dev-phase2-run4 tip (da6b11b) at the
// time this landed, the product union is already 186 paths / 25,773 added lines against the
// 115 / 8,500 cap — over by 71 paths and 17,273 lines before this unit contributes anything
// (with U1 it reads 196 / 31,017). Enforcing it here would turn
// `Run 4 release evidence` and `Run 4 Gate` permanently red for every branch in the run, which is
// not a result any unit can fix by writing less code. #183 itself says "No cap increase", so the
// cap is NOT raised and the numbers are NOT massaged: the enforcement path is implemented in full
// and exercised by the negative tests in run4_release_gate.test.mjs, and the attestation records
// `productCapAcceptanceClaimed: false` so nothing downstream can mistake measurement for
// acceptance. Wiring checkProductLandingDelta into the workflow is a one-line change once a human
// decides whether the run's product envelope is re-scoped or the cap is formally revised.
//
// The per-unit gate below is unchanged and still enforcing.
export const RUN4_PRODUCT_BASE_SHA = '77c98213e23ad56ae37c86201b39ef4e7543a543';
export const RUN4_MT4_PARENT_SHA = '66bfde53b0dc388e40af42ab0ff4737ffb2fd8aa';
export const RUN4_MT4_MERGE_SHA = 'c558c04f1b661a59c8987c96770768eeea46e0cc';
export const RUN4_MT4_EXCLUSION_COUNT = 28;
export const RUN4_MT4_EXCLUSION_SHA256 = 'd848a20c263eae7255c532e358605f17aa07e1f17d3dd526825860d767e5bfd6';
// Per-unit measurement, preserved under an explicitly non-acceptance name (#183 scope line 3).
export const RUN4_NON_ACCEPTANCE_UNIT_BASE_SHA = RUN4_UNIT_BASE_SHA;

export const RUN4_MAX_CHANGED_PATHS = 115;
export const RUN4_MAX_ADDED_LINES = 8500;
export const RUN4_FUNCTIONS = Object.freeze([
  'compute-baselines',
  'evaluate-signals',
  'generate-insights',
  'run-pipeline',
]);
export const RUN4_REQUIRED_JOBS = Object.freeze([
  'context',
  'run4-release',
  'flutter',
  'typescript',
  'node-tools',
  'nao',
  'deno-check',
  'migrations-apply',
  'model-training-core',
  'model-training-lint-type',
  'arch-boundaries',
  'secret-scan',
]);
const U1_CHECKOUT = 'actions/checkout@11d5960a326750d5838078e36cf38b85af677262';
const U1_SETUP_NODE = 'actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020';
const RUN4_U1_JOB_HASHES = Object.freeze({
  'arch-boundaries': '00e6f4b5879544b3deea43a964f690a96fbc63b29a0766786e88f779944c18ec',
  // Re-frozen when the history scan was scoped to the landing ref's ancestry and the history
  // canary + ancestry-traversal assertions were added. Superseded:
  //   f312ee6dd0ae2ebe4f169681cd7c0c5c78707313d8d088869c6259c30d1f53e0 (unscoped all-refs history scan)
  [RUN4_REQUIRED_JOBS[11]]: '6ca9031d18aa318e9cb000ea8800a6b9f035c233f91135a1c0f19940f157e0b0',
});
export const RUN4_NODE_TOOL_PACKAGES = Object.freeze([
  'tools/brain-ingest',
  'tools/llm-router',
  'tools/rules',
  'tools/edge-loader',
  'tools/engine-stats',
  'tools/metric-view',
]);
export const RUN4_NODE_TOOL_DRIFT_PACKAGES = Object.freeze(['tools/rules', 'tools/metric-view']);
export const RUN4_EVENT_SCOPE = "${{ (github.event_name == 'push' && github.ref == 'refs/heads/dev-phase2-run4') || (github.event_name == 'pull_request' && github.base_ref == 'dev-phase2-run4') }}";
export const RUN4_AGGREGATE_SCOPE = "${{ always() && ((github.event_name == 'push' && github.ref == 'refs/heads/dev-phase2-run4') || (github.event_name == 'pull_request' && github.base_ref == 'dev-phase2-run4')) }}";
export const RUN4_LOCAL_SERVE_COMMAND = 'node_modules/.bin/supabase functions serve --debug --no-verify-jwt';
export const RUN4_ATTESTATION_GENERATOR = 'node tools/run4_release_gate.mjs record-attestation';

function sameSet(actual, expected, label) {
  if (!Array.isArray(actual) || actual.some((value) => typeof value !== 'string')) fail(`${label} must be a string array`);
  if (new Set(actual).size !== actual.length) fail(`${label} contains duplicates`);
  const a = [...actual].sort();
  const e = [...expected].sort();
  if (a.length !== e.length || a.some((value, index) => value !== e[index])) fail(`${label} mismatch: expected ${e.join(', ')}, got ${a.join(', ')}`);
}

function parseWorkflowYaml(text) {
  const document = parseDocument(text, { version: '1.2', uniqueKeys: true, maxAliasCount: 0 });
  if (document.errors.length || document.warnings.length) {
    const problems = [...document.errors, ...document.warnings].map((item) => item.message).join('; ');
    fail(`invalid workflow YAML: ${problems}`);
  }
  const workflow = document.toJS({ maxAliasCount: 0 });
  if (!isObject(workflow) || !isObject(workflow.jobs)) fail('workflow has no jobs map');
  return workflow;
}

/** Parse the whole TOML document, then expose each function table without applying permissive defaults. */
export function parseFunctionConfig(text) {
  let document;
  try { document = TOML.parse(text); } catch (error) { fail(`invalid TOML: ${error.message}`); }
  const functions = document?.functions;
  if (!isObject(functions) || !Object.keys(functions).length) fail('config has no [functions.*] sections');
  return Object.entries(functions).map(([name, section]) => {
    if (!isObject(section)) fail(`functions.${name} must be a TOML table`);
    if (!own(section, 'enabled') || typeof section.enabled !== 'boolean') fail(`functions.${name}.enabled must be explicitly boolean`);
    if (typeof section.entrypoint !== 'string' || !section.entrypoint) fail(`functions.${name}.entrypoint must be an explicit string`);
    if (typeof section.import_map !== 'string' || !section.import_map) fail(`functions.${name}.import_map must be an explicit string`);
    return { name, enabled: section.enabled, entrypoint: section.entrypoint, importMap: section.import_map };
  });
}

function validateDenoConfig(name, text) {
  const document = parseDocument(text, { version: '1.2', uniqueKeys: true, maxAliasCount: 0 });
  if (document.errors.length || document.warnings.length) {
    const problems = [...document.errors, ...document.warnings].map((item) => item.message).join('; ');
    fail(`functions.${name}: invalid deno.json: ${problems}`);
  }
  let config;
  try { config = JSON.parse(text); } catch (error) { fail(`functions.${name}: invalid deno.json: ${error.message}`); }
  if (!isObject(config.lock) || config.lock.path !== '../../deno.lock' || config.lock.frozen !== true || Object.keys(config.lock).length !== 2) {
    fail(`functions.${name}: deno.json must use exactly {path:"../../deno.lock", frozen:true}`);
  }
  return config;
}

function assertNoFailOpen(node, label) {
  if (!isObject(node)) fail(`${label} is missing or malformed`);
  if (own(node, 'continue-on-error')) fail(`${label} cannot set continue-on-error`);
}

function exactStep(job, name, { allowedIf } = {}) {
  if (!Array.isArray(job.steps)) fail('job steps are missing');
  const matches = job.steps.filter((step) => isObject(step) && step.name === name);
  if (matches.length !== 1) fail(`expected exactly one workflow step named ${name}`);
  assertNoFailOpen(matches[0], `step ${name}`);
  if (allowedIf === undefined && own(matches[0], 'if')) fail(`step ${name} cannot set if`);
  if (allowedIf !== undefined && matches[0].if !== allowedIf) fail(`step ${name} must use exact if ${allowedIf}`);
  return matches[0];
}

function validateCheckout(job, jobName) {
  if (!Array.isArray(job.steps)) fail(`${jobName} steps are missing`);
  const expected = RUN4_U1_JOB_HASHES[jobName] ? U1_CHECKOUT : 'actions/checkout@v4';
  const checkouts = job.steps.filter((step) => step?.uses === expected);
  if (checkouts.length !== 1) fail(`${jobName} must use exactly one approved checkout step`);
  if (checkouts[0].with?.ref !== undefined) fail(`${jobName} checkout must not override the event SHA`);
}

function validateRequiredJobStepGuards(job, jobName) {
  if (!Array.isArray(job.steps)) fail(`${jobName} steps are missing`);
  for (const step of job.steps) {
    if (!isObject(step)) fail(`${jobName} has a malformed step`);
    assertNoFailOpen(step, `${jobName} step ${step.name ?? step.uses ?? '<unnamed>'}`);
    validateExactEnvironment(step.env, `${jobName} step ${step.name ?? step.uses ?? '<unnamed>'}`, REQUIRED_STEP_ENVS[`${jobName}:${step.name}`]);
    if (!own(step, 'if')) continue;
    if (jobName === 'node-tools' && step.name === 'Drift check' && step.if === 'matrix.drift_check') continue;
    fail(`${jobName} step ${step.name ?? step.uses ?? '<unnamed>'} cannot set if`);
  }
}

function exactRun(job, jobName, stepName, command, options) {
  if (exactStep(job, stepName, options).run !== command) fail(`${jobName} step ${stepName} command drifted`);
}

const REQUIRED_JOB_STEP_SETS = Object.freeze({
  context: ['uses:<unnamed>:actions/checkout@v4', 'uses:Set up Node:actions/setup-node@v4', 'run:Context check', 'run:Human graph view — renderer tests and single-view invariant'],
  'run4-release': ['uses:<unnamed>:actions/checkout@v4', 'uses:<unnamed>:actions/setup-node@v4', 'uses:<unnamed>:denoland/setup-deno@v2', 'run:Install release-gate dependencies', 'run:Assert exact landing SHA and current unit base', 'run:Verify parsed function and workflow invariants', 'run:Recompute frozen graphs and verify local-only runtime attestation'],
  flutter: ['uses:<unnamed>:actions/checkout@v4', 'uses:Setup Flutter:subosito/flutter-action@v2', 'run:Create public env file', 'run:Install dependencies', 'run:Analyze', 'run:Test'],
  typescript: ['uses:<unnamed>:actions/checkout@v4', 'uses:Setup Node:actions/setup-node@v4', 'run:Install dependencies', 'run:Type check shared types'],
  'node-tools': ['uses:<unnamed>:actions/checkout@v4', 'uses:Set up Node:actions/setup-node@v4', 'run:Install shared contract dependencies', 'run:Install dependencies', 'run:Typecheck', 'run:Test', 'run:Drift check'],
  nao: ['uses:<unnamed>:actions/checkout@v4', 'uses:Set up Node:actions/setup-node@v4', 'run:Install dependencies', 'run:Typecheck', 'run:Test'],
  'deno-check': ['uses:<unnamed>:actions/checkout@v4', 'uses:Set up Deno:denoland/setup-deno@v2', 'run:Type check handler'],
  'migrations-apply': ['uses:<unnamed>:actions/checkout@v4', 'run:Install pg_cron/pg_net stubs into the service container', 'run:Bootstrap supabase-shaped primitives', 'run:Apply migrations in filename order'],
  'model-training-core': ['uses:<unnamed>:actions/checkout@v4', 'uses:Set up Python:actions/setup-python@v5', 'run:Unit tests (stdlib unittest, zero installs)', 'run:Config validation (dry-run resolves the fixture job without executing it)', 'run:Offline smoke (tiny local fixture only — no network, no real data)'],
  'model-training-lint-type': ['uses:<unnamed>:actions/checkout@v4', 'uses:Set up Python:actions/setup-python@v5', 'run:Install the dev extra only (ruff + mypy)', 'run:Format check', 'run:Lint', 'run:Type check'],
  'arch-boundaries': [`uses:Checkout:${U1_CHECKOUT}`, `uses:Set up Node:${U1_SETUP_NODE}`, 'run:Guard unit tests (positive + negative fixtures per rule)', 'run:Enforce architecture boundaries over the tracked tree'],
  'secret-scan': [`uses:Checkout:${U1_CHECKOUT}`, `uses:Set up Node:${U1_SETUP_NODE}`, 'run:Resolve pinned scanner', 'run:Install pinned gitleaks (SHA256-verified)', 'run:Verify scanner identity', 'run:Validate scanner policy and allowlist narrowness', 'run:Guard unit tests (reachable-failure-path proof)', 'run:Prove the scanner detects (canary)', 'run:Scan working tree at HEAD', 'run:Verify the working-tree scan actually covered the tree', 'run:Prove history scanning detects an ancestry-only secret (canary)', 'run:Scan the full history of the landing ref', 'run:Verify the history scan actually walked the ref\'s ancestry', 'run:Client-surface leak assertions', 'run:Install nao dependencies for local client canary', 'run:Build and inspect local Next client canary'],
  'run4-gate': ['uses:<unnamed>:actions/checkout@v4', 'uses:Set up Node:actions/setup-node@v4', 'run:Install release-gate dependencies', 'run:Fail unless every required dependency succeeded'],
});

function validateWorkflowDefaults(workflow) {
  if (own(workflow, 'defaults')) fail('workflow cannot set defaults that change required execution');
}

function validateRequiredJobSteps(job, jobName) {
  const modelTrainingJob = jobName === 'model-training-core' || jobName === 'model-training-lint-type';
  if (modelTrainingJob) {
    const defaults = job.defaults;
    if (!isObject(defaults) || Object.keys(defaults).join('|') !== 'run' || !isObject(defaults.run) || Object.keys(defaults.run).join('|') !== 'working-directory' || defaults.run['working-directory'] !== 'model-training') {
      fail(`${jobName} job defaults must use only model-training as the working directory`);
    }
  } else if (own(job, 'defaults')) {
    fail(`${jobName} job cannot set defaults that change required execution`);
  }
  const expected = REQUIRED_JOB_STEP_SETS[jobName];
  if (!expected) fail(`no required step set for ${jobName}`);
  const actual = job.steps.map((step) => {
    if (typeof step.uses === 'string') return `uses:${step.name ?? '<unnamed>'}:${step.uses}`;
    if (own(step, 'run')) return `run:${step.name ?? '<unnamed>'}`;
    fail(`${jobName} has an unapproved non-run/non-uses step`);
  });
  sameSet(actual, expected, `${jobName} approved step set`);
}

function expectedWorkingDirectory(jobName, stepName) {
  if (jobName === 'flutter') return 'apps/biotope';
  if (jobName === 'typescript') return 'shared';
  if (jobName === 'node-tools') return stepName === 'Install shared contract dependencies' ? 'shared' : '${{ matrix.package }}';
  if (jobName === 'nao') return 'apps/nao';
  if (jobName === 'deno-check') return 'supabase/functions/${{ matrix.function }}';
  if (jobName === 'secret-scan' && (stepName === 'Install nao dependencies for local client canary' || stepName === 'Build and inspect local Next client canary')) return 'apps/nao';
  return undefined;
}

function validateRequiredRunExecution(job, jobName) {
  for (const step of job.steps) {
    if (!own(step, 'run')) continue;
    if (own(step, 'shell')) fail(`${jobName} step ${step.name ?? '<unnamed>'} cannot set shell`);
    if (step['working-directory'] !== expectedWorkingDirectory(jobName, step.name)) fail(`${jobName} step ${step.name ?? '<unnamed>'} working-directory drifted`);
  }
}

const DANGEROUS_ENV_KEYS = new Set(['BASH_ENV', 'ENV', 'PATH', 'NODE_OPTIONS']);
const REQUIRED_JOB_ENVS = Object.freeze({
  'migrations-apply': Object.freeze({ PGHOST: 'localhost', PGUSER: 'postgres', PGDATABASE: 'postgres', PGPASSWORD: 'postgres' }),
});
const REQUIRED_STEP_ENVS = Object.freeze({
  'run4-release:Assert exact landing SHA and current unit base': Object.freeze({ RUN4_UNIT_BASE_SHA, RUN4_MAX_CHANGED_PATHS, RUN4_MAX_ADDED_LINES }),
  'run4-gate:Fail unless every required dependency succeeded': Object.freeze({ NEEDS_JSON: '${{ toJson(needs) }}' }),
  'model-training-core:Unit tests (stdlib unittest, zero installs)': Object.freeze({ PYTHONPATH: 'src' }),
  'model-training-core:Config validation (dry-run resolves the fixture job without executing it)': Object.freeze({ PYTHONPATH: 'src' }),
  'secret-scan:Build and inspect local Next client canary': Object.freeze({ NEXT_PUBLIC_SUPABASE_URL: 'https://example.invalid', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'synthetic-public-anon', NEXT_PUBLIC_APP_ENV: 'ci', SUPABASE_SERVICE_ROLE_KEY: 'run4-u1-synthetic-server-canary-178-not-a-secret' }),
  'model-training-core:Offline smoke (tiny local fixture only — no network, no real data)': Object.freeze({ PYTHONPATH: 'src' }),
});

function validateExactEnvironment(value, label, expected) {
  if (value === undefined) {
    if (expected) fail(`${label} env is missing`);
    return;
  }
  if (!isObject(value)) fail(`${label} env is malformed`);
  for (const key of Object.keys(value)) if (DANGEROUS_ENV_KEYS.has(key)) fail(`${label} env cannot set ${key}`);
  if (!expected) fail(`${label} cannot set env`);
  sameSet(Object.keys(value), Object.keys(expected), `${label} env keys`);
  for (const [key, expectedValue] of Object.entries(expected)) if (value[key] !== expectedValue) fail(`${label} env ${key} drifted`);
}

function validateHostContract(job, jobName) {
  if (job['runs-on'] !== 'ubuntu-latest') fail(`${jobName} must run on exact ubuntu-latest`);
  if (own(job, 'container')) fail(`${jobName} cannot set container`);
  if (jobName !== 'migrations-apply') {
    if (own(job, 'services')) fail(`${jobName} cannot set services`);
    return;
  }
  if (!isObject(job.services) || Object.keys(job.services).length !== 1 || !isObject(job.services.postgres)) fail('migrations-apply requires only the exact postgres service');
  const postgres = job.services.postgres;
  if (postgres.image !== 'postgres:17') fail('migrations-apply postgres image drifted');
  validateExactEnvironment(postgres.env, 'migrations-apply postgres service', { POSTGRES_PASSWORD: 'postgres' });
  if (!Array.isArray(postgres.ports) || postgres.ports.length !== 1 || postgres.ports[0] !== '5432:5432') fail('migrations-apply postgres port drifted');
  if (String(postgres.options ?? '').trim() !== '--health-cmd "pg_isready -U postgres" --health-interval 5s --health-timeout 5s --health-retries 10') fail('migrations-apply postgres health check drifted');
}

export function validateFunctionConfig(configText, workflowText, { fileExists = existsSync, readText = (path) => readFileSync(path, 'utf8'), repoRoot = repo } = {}) {
  const configured = parseFunctionConfig(configText);
  sameSet(configured.map((fn) => fn.name), RUN4_FUNCTIONS, 'configured Supabase function set');
  for (const fn of configured) {
    if (fn.enabled !== true) fail(`functions.${fn.name} must be explicitly enabled`);
    const expectedEntrypoint = `./functions/${fn.name}/index.ts`;
    const expectedImportMap = `./functions/${fn.name}/deno.json`;
    if (fn.entrypoint !== expectedEntrypoint) fail(`functions.${fn.name}: entrypoint must be exactly ${expectedEntrypoint}`);
    if (fn.importMap !== expectedImportMap) fail(`functions.${fn.name}: import_map must be exactly ${expectedImportMap}`);
    const entrypointPath = resolve(repoRoot, 'supabase', fn.entrypoint.slice(2));
    const importMapPath = resolve(repoRoot, 'supabase', fn.importMap.slice(2));
    const functionDir = resolve(repoRoot, 'supabase', 'functions', fn.name);
    for (const path of [entrypointPath, importMapPath]) {
      const rel = relative(functionDir, path);
      if (rel.startsWith('..') || isAbsolute(rel)) fail(`functions.${fn.name}: configured path escapes its function directory`);
      if (!fileExists(path)) fail(`functions.${fn.name}: configured file is missing: ${path}`);
    }
    validateDenoConfig(fn.name, readText(importMapPath));
  }

  const workflow = parseWorkflowYaml(workflowText);
  const job = workflow.jobs['deno-check'];
  assertNoFailOpen(job, 'CI deno-check job');
  if (job.if !== undefined) fail('CI deno-check job must not be conditional');
  const matrix = job.strategy?.matrix;
  if (!isObject(matrix) || Object.keys(matrix).join('|') !== 'function') fail('CI deno-check matrix must contain only function');
  sameSet(matrix.function, RUN4_FUNCTIONS, 'CI deno-check matrix');
  if (job.strategy['fail-fast'] !== false) fail('CI deno-check strategy must explicitly use fail-fast: false');
  validateCheckout(job, 'deno-check');
  const setup = exactStep(job, 'Set up Deno');
  if (setup.uses !== 'denoland/setup-deno@v2' || setup.with?.['deno-version'] !== 'v2.8.1') fail('CI deno-check must use exact Deno v2.8.1');
  const check = exactStep(job, 'Type check handler');
  if (check['working-directory'] !== 'supabase/functions/${{ matrix.function }}') fail('CI deno-check working directory is not exact');
  if (check.run !== 'deno check --config deno.json --lock ../../deno.lock --frozen index.ts') fail('CI deno-check command is not the exact frozen handler command');
  return configured;
}

export function validateRun4Workflow(workflowText) {
  const workflow = parseWorkflowYaml(workflowText);
  validateWorkflowDefaults(workflow);
  validateExactEnvironment(workflow.env, 'workflow', undefined);
  const release = workflow.jobs['run4-release'];
  assertNoFailOpen(release, 'run4-release job');
  if (release.if !== RUN4_EVENT_SCOPE) fail('run4-release is not scoped exactly to dev-phase2-run4 events');
  validateCheckout(release, 'run4-release');
  if (exactStep(release, 'Install release-gate dependencies').run !== 'npm ci') fail('run4-release must install with exact npm ci');
  const landing = exactStep(release, 'Assert exact landing SHA and current unit base');
  if (landing.env?.RUN4_UNIT_BASE_SHA !== RUN4_UNIT_BASE_SHA || Number(landing.env?.RUN4_MAX_CHANGED_PATHS) !== RUN4_MAX_CHANGED_PATHS || Number(landing.env?.RUN4_MAX_ADDED_LINES) !== RUN4_MAX_ADDED_LINES) fail('run4-release landing constants drifted');
  const landingLines = String(landing.run).trim().split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const expectedLandingLines = [
    'git fetch --no-tags origin "$RUN4_UNIT_BASE_SHA"',
    'node tools/run4_release_gate.mjs provenance --event-path "$GITHUB_EVENT_PATH" --github-sha "$GITHUB_SHA"',
    'node tools/run4_release_gate.mjs landing --base "$RUN4_UNIT_BASE_SHA" --head "$GITHUB_SHA" --max-paths "$RUN4_MAX_CHANGED_PATHS" --max-added "$RUN4_MAX_ADDED_LINES"',
  ];
  if (JSON.stringify(landingLines) !== JSON.stringify(expectedLandingLines)) fail('run4-release landing commands drifted');
  const config = exactStep(release, 'Verify parsed function and workflow invariants');
  if (String(config.run).trim() !== 'node --test tools/run4_release_gate.test.mjs\nnode tools/run4_release_gate.mjs config') fail('run4-release config commands drifted');
  const attest = exactStep(release, 'Recompute frozen graphs and verify local-only runtime attestation');
  if (attest.run !== 'node tools/run4_release_gate.mjs attest --deno deno --supabase-cli ./node_modules/.bin/supabase --graph-dir "$RUNNER_TEMP/run4-graphs"') fail('run4-release attestation command drifted');

  for (const jobName of RUN4_REQUIRED_JOBS) {
    const job = workflow.jobs[jobName];
    assertNoFailOpen(job, `${jobName} job`);
    validateHostContract(job, jobName);
    validateExactEnvironment(job.env, `${jobName} job`, REQUIRED_JOB_ENVS[jobName]);
    if (jobName === 'arch-boundaries' || jobName === 'secret-scan') {
      if (job.if !== RUN4_EVENT_SCOPE) fail(`${jobName} is not scoped exactly to dev-phase2-run4 events`);
      if (hashTextEvidence(JSON.stringify(job)) !== RUN4_U1_JOB_HASHES[jobName]) fail(`${jobName} frozen job contract drifted`);
    } else if (jobName !== 'run4-release' && own(job, 'if')) fail(`${jobName} job cannot set if`);
    validateCheckout(job, jobName);
    validateRequiredJobStepGuards(job, jobName);
    validateRequiredJobSteps(job, jobName);
    validateRequiredRunExecution(job, jobName);
  }

  const context = workflow.jobs.context;
  exactRun(context, 'context', 'Context check', 'node tools/context_sync.mjs --check');
  exactRun(context, 'context', 'Human graph view — renderer tests and single-view invariant', 'node --test tools/graph-view/tests/*.test.mjs\nnode tools/graph-view/generate_graph_view.mjs --check\n');
  const flutter = workflow.jobs.flutter;
  exactRun(flutter, 'flutter', 'Install dependencies', 'flutter pub get');
  exactRun(flutter, 'flutter', 'Analyze', 'flutter analyze');
  exactRun(flutter, 'flutter', 'Test', 'flutter test');
  const typescript = workflow.jobs.typescript;
  exactRun(typescript, 'typescript', 'Install dependencies', 'npm ci');
  exactRun(typescript, 'typescript', 'Type check shared types', 'npx tsc --noEmit');
  const nodeTools = workflow.jobs['node-tools'];
  const nodeMatrix = nodeTools.strategy?.matrix;
  if (!isObject(nodeMatrix) || Object.keys(nodeMatrix).sort().join('|') !== 'include|package') fail('node-tools matrix must contain only package and include');
  sameSet(nodeMatrix.package, RUN4_NODE_TOOL_PACKAGES, 'node-tools package matrix');
  if (!Array.isArray(nodeMatrix.include) || nodeMatrix.include.some((item) => !isObject(item) || Object.keys(item).sort().join('|') !== 'drift_check|package' || item.drift_check !== true)) fail('node-tools drift include records are malformed');
  sameSet(nodeMatrix.include.map((item) => item.package), RUN4_NODE_TOOL_DRIFT_PACKAGES, 'node-tools drift include set');
  exactRun(nodeTools, 'node-tools', 'Install shared contract dependencies', 'npm ci');
  exactRun(nodeTools, 'node-tools', 'Install dependencies', 'npm ci');
  exactRun(nodeTools, 'node-tools', 'Typecheck', 'npm run typecheck');
  exactRun(nodeTools, 'node-tools', 'Test', 'npm test');
  exactRun(nodeTools, 'node-tools', 'Drift check', 'npm run check', { allowedIf: 'matrix.drift_check' });
  const nao = workflow.jobs.nao;
  exactRun(nao, 'nao', 'Install dependencies', 'npm ci');
  exactRun(nao, 'nao', 'Typecheck', 'npm run typecheck');
  exactRun(nao, 'nao', 'Test', 'npm test');
  const migrations = workflow.jobs['migrations-apply'];
  exactRun(migrations, 'migrations-apply', 'Bootstrap supabase-shaped primitives', 'psql -v ON_ERROR_STOP=1 -q -f ci/migrations-bootstrap.sql');
  exactRun(migrations, 'migrations-apply', 'Apply migrations in filename order', 'set -eu\nfor f in $(ls supabase/migrations/*.sql | sort); do\n  echo "== $f"\n  psql -v ON_ERROR_STOP=1 -q -f "$f"\ndone\n');

  const modelCore = workflow.jobs['model-training-core'];
  const modelCorePython = exactStep(modelCore, 'Set up Python');
  if (modelCorePython.uses !== 'actions/setup-python@v5' || Object.keys(modelCorePython.with ?? {}).join('|') !== 'python-version' || modelCorePython.with?.['python-version'] !== '3.10') fail('model-training-core must use exact Python 3.10 setup');
  exactRun(modelCore, 'model-training-core', 'Unit tests (stdlib unittest, zero installs)', 'python -m unittest discover -s tests -v');
  exactRun(modelCore, 'model-training-core', 'Config validation (dry-run resolves the fixture job without executing it)', 'python -m ourobion_model_lab.cli dry-run --model self-check --config tests/fixtures/example_config.json\n');
  exactRun(modelCore, 'model-training-core', 'Offline smoke (tiny local fixture only — no network, no real data)', 'python -m ourobion_model_lab.cli smoke --model self-check --config tests/fixtures/example_config.json\n');

  const modelLint = workflow.jobs['model-training-lint-type'];
  const modelLintPython = exactStep(modelLint, 'Set up Python');
  if (modelLintPython.uses !== 'actions/setup-python@v5' || Object.keys(modelLintPython.with ?? {}).join('|') !== 'python-version' || modelLintPython.with?.['python-version'] !== '3.10') fail('model-training-lint-type must use exact Python 3.10 setup');
  exactRun(modelLint, 'model-training-lint-type', 'Install the dev extra only (ruff + mypy)', 'pip install -c constraints.txt -e ".[dev]"');
  exactRun(modelLint, 'model-training-lint-type', 'Format check', 'ruff format --check .');
  exactRun(modelLint, 'model-training-lint-type', 'Lint', 'ruff check .');
  exactRun(modelLint, 'model-training-lint-type', 'Type check', 'mypy src');

  const aggregate = workflow.jobs['run4-gate'];
  assertNoFailOpen(aggregate, 'run4-gate job');
  validateHostContract(aggregate, 'run4-gate');
  validateExactEnvironment(aggregate.env, 'run4-gate job', undefined);
  if (aggregate.if !== RUN4_AGGREGATE_SCOPE) fail('Run 4 Gate must use always() and exact dev-phase2-run4 scope');
  sameSet(aggregate.needs, RUN4_REQUIRED_JOBS, 'Run 4 Gate needs');
  validateCheckout(aggregate, 'run4-gate');
  validateRequiredJobStepGuards(aggregate, 'run4-gate');
  validateRequiredJobSteps(aggregate, 'run4-gate');
  validateRequiredRunExecution(aggregate, 'run4-gate');
  const aggregateNode = exactStep(aggregate, 'Set up Node');
  if (aggregateNode.uses !== 'actions/setup-node@v4' || aggregateNode.with?.['node-version'] !== '20') fail('Run 4 Gate must use exact Node 20 setup');
  if (exactStep(aggregate, 'Install release-gate dependencies').run !== 'npm ci') fail('Run 4 Gate must install release-gate dependencies with exact npm ci');
  const aggregateStep = exactStep(aggregate, 'Fail unless every required dependency succeeded');
  if (aggregateStep.env?.NEEDS_JSON !== '${{ toJson(needs) }}' || aggregateStep.run !== 'node tools/run4_release_gate.mjs aggregate') fail('Run 4 Gate runtime assertion drifted');
  return workflow;
}

function gitText(git, args, options = {}) {
  return git('git', args, { cwd: repo, encoding: 'utf8', ...options });
}

const SOURCE_TEXT_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.dart', '.sql']);

/**
 * Recover one numstat row only when Git calls a historical binary base "- -" but the current
 * HEAD blob is demonstrably UTF-8 source text. Git numstat still reports a historical-NUL base
 * as binary under --text, so recovery parses one zero-context, path-scoped patch instead.
 */
function sourceTextNumstatRecovery({ row, base, head, git }) {
  const binary = /^-\t-\t([^\0]+)$/.exec(row);
  if (!binary) return null;
  const path = binary[1];
  const extension = path.slice(path.lastIndexOf('.'));
  if (!SOURCE_TEXT_EXTENSIONS.has(extension)) fail(`binary/unparsable diff row: ${row}`);
  try { gitText(git, ['cat-file', '-e', `${head}:${path}`]); } catch { fail(`binary source recovery HEAD path is absent: ${path}`); }
  const blob = git('git', ['cat-file', '-p', `${head}:${path}`], { cwd: repo, encoding: 'buffer' });
  if (!Buffer.isBuffer(blob)) fail(`binary source recovery did not return a Buffer: ${path}`);
  if (blob.includes(0)) fail(`binary source recovery HEAD blob contains NUL: ${path}`);
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(blob); } catch { fail(`binary source recovery HEAD blob is not UTF-8: ${path}`); }
  if (text.includes('\0')) fail(`binary source recovery HEAD blob contains NUL: ${path}`);
  const patch = gitText(git, ['diff', '--text', '--unified=0', '--no-color', '--no-ext-diff', '--no-textconv', '--no-renames', `${base}..${head}`, '--', path]);
  const lines = patch.split('\n');
  if (lines.at(-1) === '') lines.pop();
  if (lines.length < 5 || lines[0] !== `diff --git a/${path} b/${path}` || !/^index [0-9a-f]+\.\.[0-9a-f]+(?: \d+)?$/.test(lines[1]) || lines[2] !== `--- a/${path}` || lines[3] !== `+++ b/${path}`) fail(`binary source recovery patch headers are invalid: ${path}`);
  let added = 0; let hunks = 0; let index = 4;
  while (index < lines.length) {
    const hunk = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(?: .*)?$/.exec(lines[index++]);
    if (!hunk) fail(`binary source recovery patch hunk is invalid: ${path}`);
    hunks += 1;
    const oldCount = Number(hunk[2] ?? '1'); const newCount = Number(hunk[4] ?? '1');
    let oldSeen = 0; let newSeen = 0;
    while (index < lines.length && !lines[index].startsWith('@@ ')) {
      const line = lines[index++];
      if (line.startsWith('-')) { oldSeen += 1; continue; }
      if (line.startsWith('+')) { newSeen += 1; added += 1; continue; }
      fail(`binary source recovery patch contains context or marker: ${path}`);
    }
    if (oldSeen !== oldCount || newSeen !== newCount) fail(`binary source recovery patch hunk counts mismatch: ${path}`);
  }
  if (!hunks || !added && !patch.includes('\n-')) fail(`binary source recovery patch has no changes: ${path}`);
  return [`${added}\t0\t${path}`, String(added), '0', path];
}

function numericNumstatRow({ row, base, head, git }) {
  return /^(\d+)\t(\d+)\t([^\0]+)$/.exec(row) ?? sourceTextNumstatRecovery({ row, base, head, git });
}

export function checkLandingDelta({ base, head = 'HEAD', maxPaths, maxAdded, git = execFileSync }) {
  if (base !== RUN4_UNIT_BASE_SHA) fail(`base must equal accepted current unit SHA ${RUN4_UNIT_BASE_SHA}`);
  if (!Number.isSafeInteger(maxPaths) || maxPaths < 0 || maxPaths !== RUN4_MAX_CHANGED_PATHS) fail(`maxPaths must equal accepted cap ${RUN4_MAX_CHANGED_PATHS}`);
  if (!Number.isSafeInteger(maxAdded) || maxAdded < 0 || maxAdded !== RUN4_MAX_ADDED_LINES) fail(`maxAdded must equal accepted cap ${RUN4_MAX_ADDED_LINES}`);
  const clean = (...args) => gitText(git, args).trim();
  if (clean('rev-parse', '--is-shallow-repository') !== 'false') fail('shallow or indeterminate Git history is not acceptable');
  if (clean('cat-file', '-t', base) !== 'commit') fail(`base ${base} is unavailable or not a commit`);
  const resolvedHead = clean('rev-parse', head);
  if (!/^[0-9a-f]{40}$/i.test(resolvedHead)) fail('head did not resolve to an immutable SHA');
  if (clean('merge-base', base, resolvedHead) !== base) fail(`base ${base} is not the merge-base of landing ${resolvedHead}`);

  const nameTokens = gitText(git, ['diff', '--name-status', '-z', '--find-renames', `${base}..${resolvedHead}`]).split('\0');
  if (nameTokens.at(-1) === '') nameTokens.pop();
  const names = [];
  for (let index = 0; index < nameTokens.length;) {
    const status = nameTokens[index++];
    if (!/^[ACDMRTUXB][0-9]*$/.test(status ?? '')) fail(`unparsable name-status token: ${status ?? '<missing>'}`);
    if (/^[RC]/.test(status)) fail('rename/copy diff is ambiguous for the landing path budget');
    const path = nameTokens[index++];
    if (!path) fail('landing diff contains an empty path');
    names.push(path);
  }
  if (new Set(names).size !== names.length) fail('landing diff contains duplicate paths');

  const statRows = gitText(git, ['diff', '--numstat', '-z', `${base}..${resolvedHead}`]).split('\0');
  if (statRows.at(-1) === '') statRows.pop();
  let added = 0;
  for (const row of statRows) {
    const match = numericNumstatRow({ row, base, head: resolvedHead, git });
    if (!match) fail(`binary/unparsable diff row: ${row}`);
    const plus = Number(match[1]);
    if (!Number.isSafeInteger(plus) || !Number.isSafeInteger(added + plus)) fail('landing added-line count overflowed');
    added += plus;
  }
  if (statRows.length !== names.length) fail('name-status and numstat path counts differ');
  if (names.length > maxPaths) fail(`landing delta has ${names.length} paths; cap is ${maxPaths}`);
  if (added > maxAdded) fail(`landing delta has ${added} added lines; cap is ${maxAdded}`);
  return { base, head: resolvedHead, changedPaths: names.length, addedLines: added };
}

// ---------------------------------------------------------------------------------------------
// Immutable product cap (#183) — measurement + the enforcement path, kept unwired. See the
// constants block at the top of this file for why this measures rather than gates.
// ---------------------------------------------------------------------------------------------

function parseNameStatus(text, label) {
  const tokens = text.split('\0');
  if (tokens.at(-1) === '') tokens.pop();
  const records = [];
  for (let index = 0; index < tokens.length;) {
    const status = tokens[index++];
    if (!/^[ACDMRTUXB][0-9]*$/.test(status ?? '')) fail(`unparsable ${label} name-status token: ${status ?? '<missing>'}`);
    if (/^[RC]/.test(status)) fail(`rename/copy diff is ambiguous for ${label}`);
    const path = tokens[index++];
    if (!path) fail(`${label} diff contains an empty path`);
    records.push({ status, path });
  }
  if (new Set(records.map((record) => record.path)).size !== records.length) fail(`${label} diff contains duplicate paths`);
  return records;
}

function resolveBlob(git, commit, path, label) {
  const blob = gitText(git, ['rev-parse', `${commit}:${path}`]).trim();
  if (!/^[0-9a-f]{40}$/i.test(blob)) fail(`${label} path blob is unavailable or ambiguous: ${path}`);
  return blob;
}

/**
 * The one authorized MT4 exclusion set, bound to its provenance rather than to a hand-written
 * path list: the merge must still be the exact three-parent commit with the exact first parent,
 * both must still be rooted at the product base, and the resulting path/status/blob records must
 * still hash to RUN4_MT4_EXCLUSION_SHA256. Any drift — a re-merge, an extra path, an edited blob
 * — fails closed here rather than silently widening what the product cap forgives.
 */
export function mt4ExclusionManifest({ git = execFileSync } = {}) {
  const clean = (...args) => gitText(git, args).trim();
  for (const commit of [RUN4_PRODUCT_BASE_SHA, RUN4_MT4_PARENT_SHA, RUN4_MT4_MERGE_SHA]) {
    if (clean('cat-file', '-t', commit) !== 'commit') fail(`MT4 provenance commit is unavailable: ${commit}`);
  }
  const parents = clean('rev-list', '--parents', '-n', '1', RUN4_MT4_MERGE_SHA).split(/\s+/);
  if (parents.length !== 3 || parents[0] !== RUN4_MT4_MERGE_SHA || parents[1] !== RUN4_MT4_PARENT_SHA) fail('MT4 exclusion merge provenance drifted');
  if (clean('merge-base', RUN4_PRODUCT_BASE_SHA, RUN4_MT4_PARENT_SHA) !== RUN4_PRODUCT_BASE_SHA || clean('merge-base', RUN4_MT4_PARENT_SHA, RUN4_MT4_MERGE_SHA) !== RUN4_MT4_PARENT_SHA) fail('MT4 exclusion provenance is not rooted at the product base');
  const records = parseNameStatus(gitText(git, ['diff', '--name-status', '-z', '--find-renames', `${RUN4_MT4_PARENT_SHA}..${RUN4_MT4_MERGE_SHA}`]), 'MT4 exclusion').map(({ status, path }) => ({ status, path, blob: resolveBlob(git, RUN4_MT4_MERGE_SHA, path, 'MT4 exclusion') }));
  if (records.length !== RUN4_MT4_EXCLUSION_COUNT || sha(JSON.stringify(records)) !== RUN4_MT4_EXCLUSION_SHA256) fail('MT4 exclusion path/count/hash drifted');
  return records;
}

/**
 * Measure the immutable product union. Fails closed on every provenance/parsing ambiguity #183
 * names — moving base, shallow history, a landing that does not contain the exact MT4 merge, a
 * requested exclusion set that differs from the authorized one, an excluded path whose status or
 * blob drifted, rename/copy ambiguity, binary rows, mismatched name-status/numstat sets — and
 * reports `withinCap` rather than throwing when the union merely exceeds the cap. Cap breach is a
 * human envelope decision; everything above it is a correctness failure.
 */
export function productLandingDelta({ head = 'HEAD', excludedPaths, git = execFileSync } = {}) {
  const clean = (...args) => gitText(git, args).trim();
  if (clean('rev-parse', '--is-shallow-repository') !== 'false') fail('shallow or indeterminate Git history is not acceptable');
  if (clean('cat-file', '-t', RUN4_PRODUCT_BASE_SHA) !== 'commit') fail(`product base ${RUN4_PRODUCT_BASE_SHA} is unavailable or not a commit`);
  const resolvedHead = clean('rev-parse', head);
  if (!/^[0-9a-f]{40}$/i.test(resolvedHead)) fail('head did not resolve to an immutable SHA');
  if (clean('merge-base', RUN4_PRODUCT_BASE_SHA, resolvedHead) !== RUN4_PRODUCT_BASE_SHA) fail(`product base ${RUN4_PRODUCT_BASE_SHA} is not the merge-base of landing ${resolvedHead}`);
  if (clean('merge-base', RUN4_MT4_MERGE_SHA, resolvedHead) !== RUN4_MT4_MERGE_SHA) fail('landing does not contain the exact MT4 exclusion merge');

  const exclusions = mt4ExclusionManifest({ git });
  const exclusionPaths = exclusions.map(({ path }) => path);
  if (excludedPaths !== undefined) sameSet(excludedPaths, exclusionPaths, 'requested MT4 exclusions');

  const names = parseNameStatus(gitText(git, ['diff', '--name-status', '-z', '--find-renames', `${RUN4_PRODUCT_BASE_SHA}..${resolvedHead}`]), 'product landing');
  const namesByPath = new Map(names.map((record) => [record.path, record]));
  for (const exclusion of exclusions) {
    if (namesByPath.get(exclusion.path)?.status !== exclusion.status) fail(`MT4 excluded path status drifted: ${exclusion.path}`);
    if (resolveBlob(git, resolvedHead, exclusion.path, 'MT4 excluded') !== exclusion.blob) fail(`MT4 excluded path content drifted: ${exclusion.path}`);
  }

  const statRows = gitText(git, ['diff', '--numstat', '-z', `${RUN4_PRODUCT_BASE_SHA}..${resolvedHead}`]).split('\0');
  if (statRows.at(-1) === '') statRows.pop();
  let added = 0;
  const statPaths = [];
  for (const row of statRows) {
    const match = numericNumstatRow({ row, base: RUN4_PRODUCT_BASE_SHA, head: resolvedHead, git });
    if (!match) fail(`binary/unparsable diff row: ${row}`);
    const plus = Number(match[1]);
    if (!Number.isSafeInteger(plus) || !Number.isSafeInteger(added + plus)) fail('product landing added-line count overflowed');
    statPaths.push(match[3]);
    if (!exclusionPaths.includes(match[3])) added += plus;
  }
  if (statRows.length !== names.length || new Set(statPaths).size !== statPaths.length || statPaths.some((path) => !namesByPath.has(path))) fail('name-status and numstat path sets differ');

  const productPaths = names.filter(({ path }) => !exclusionPaths.includes(path));
  return {
    base: RUN4_PRODUCT_BASE_SHA,
    head: resolvedHead,
    changedPaths: productPaths.length,
    addedLines: added,
    excludedPaths: exclusionPaths.length,
    withinCap: productPaths.length <= RUN4_MAX_CHANGED_PATHS && added <= RUN4_MAX_ADDED_LINES,
  };
}

/**
 * The enforcement path #183 asks for, implemented and tested but deliberately not wired into the
 * workflow yet. Rejects a moving base outright so it can never be satisfied by the per-unit
 * boundary, then throws on cap breach.
 */
export function checkProductLandingDelta({ base, head = 'HEAD', maxPaths, maxAdded, excludedPaths, git = execFileSync }) {
  if (base !== RUN4_PRODUCT_BASE_SHA) fail(`base must equal immutable product SHA ${RUN4_PRODUCT_BASE_SHA}`);
  if (!Number.isSafeInteger(maxPaths) || maxPaths < 0 || maxPaths !== RUN4_MAX_CHANGED_PATHS) fail(`maxPaths must equal accepted cap ${RUN4_MAX_CHANGED_PATHS}`);
  if (!Number.isSafeInteger(maxAdded) || maxAdded < 0 || maxAdded !== RUN4_MAX_ADDED_LINES) fail(`maxAdded must equal accepted cap ${RUN4_MAX_ADDED_LINES}`);
  const delta = productLandingDelta({ head, excludedPaths, git });
  if (delta.changedPaths > maxPaths) fail(`product landing delta has ${delta.changedPaths} paths; cap is ${maxPaths}`);
  if (delta.addedLines > maxAdded) fail(`product landing delta has ${delta.addedLines} added lines; cap is ${maxAdded}`);
  const { withinCap, ...accepted } = delta;
  return accepted;
}

export function checkWorkflowProvenance({ eventPath, githubSha, git = execFileSync }) {
  if (!eventPath || !existsSync(eventPath)) fail('GITHUB_EVENT_PATH is missing');
  if (!/^[0-9a-f]{40}$/i.test(githubSha ?? '')) fail('GITHUB_SHA must be a full SHA');
  let event;
  try { event = JSON.parse(readFileSync(eventPath, 'utf8')); } catch (error) { fail(`invalid GitHub event JSON: ${error.message}`); }
  const clean = (...args) => gitText(git, args).trim();
  if (clean('rev-parse', '--is-shallow-repository') !== 'false') fail('workflow checkout is shallow or indeterminate');
  const checkedOut = clean('rev-parse', 'HEAD');
  if (checkedOut !== githubSha) fail(`checked-out HEAD ${checkedOut} differs from GITHUB_SHA ${githubSha}`);
  if (event.pull_request) {
    if (event.pull_request.base?.ref !== 'dev-phase2-run4') fail('pull_request event does not target dev-phase2-run4');
    const expectedBase = event.pull_request.base?.sha;
    const expectedHead = event.pull_request.head?.sha;
    if (![expectedBase, expectedHead].every((value) => /^[0-9a-f]{40}$/i.test(value ?? ''))) fail('pull_request event lacks immutable base/head SHAs');
    const parents = clean('rev-list', '--parents', '-n', '1', checkedOut).split(' ');
    if (parents.length !== 3 || parents[1] !== expectedBase || parents[2] !== expectedHead) fail(`synthetic merge parents do not match current event base/head: ${parents.join(' ')}`);
    return { event: 'pull_request', landingSha: checkedOut, baseSha: expectedBase, headSha: expectedHead };
  }
  if (event.ref !== 'refs/heads/dev-phase2-run4') fail('push event is not dev-phase2-run4');
  if (event.after !== checkedOut) fail('push event after SHA does not match checked-out landing SHA');
  return { event: 'push', landingSha: checkedOut, ref: event.ref };
}

function localModulePath(specifier, repoRoot) {
  if (!specifier.startsWith('file:')) return null;
  const path = fileURLToPath(specifier);
  const rel = relative(repoRoot, path);
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) {
    if (!rel) return { path, specifier: 'repo:.' };
    fail(`module graph escapes repository: ${specifier}`);
  }
  return { path, specifier: `repo:${rel.replaceAll('\\', '/')}` };
}

export function hashModuleGraph(graphText, { repoRoot = repo, readBytes = readFileSync } = {}) {
  let graph;
  try { graph = JSON.parse(graphText); } catch (error) { fail(`invalid Deno graph JSON: ${error.message}`); }
  if (!Array.isArray(graph.modules) || !graph.modules.length) fail('Deno graph has no modules');
  const modules = graph.modules.map((module) => {
    if (!isObject(module) || typeof module.specifier !== 'string' || module.error) fail('Deno graph contains an invalid/error module');
    const local = localModulePath(module.specifier, repoRoot);
    const dependencies = [];
    for (const dependency of module.dependencies ?? []) {
      for (const kind of ['code', 'type']) {
        const specifier = dependency?.[kind]?.specifier;
        if (specifier !== undefined) {
          if (typeof specifier !== 'string') fail(`Deno graph dependency lacks a valid specifier for ${module.specifier}`);
          dependencies.push({ kind, specifier: localModulePath(specifier, repoRoot)?.specifier ?? specifier });
        }
      }
      if (!dependency?.code?.specifier && !dependency?.type?.specifier && dependency?.specifier) {
        dependencies.push({ kind: 'unknown', specifier: localModulePath(dependency.specifier, repoRoot)?.specifier ?? dependency.specifier });
      }
    }
    dependencies.sort((a, b) => `${a.kind}:${a.specifier}`.localeCompare(`${b.kind}:${b.specifier}`));
    return {
      specifier: local?.specifier ?? module.specifier,
      sourceSha256: local ? hashTextEvidence(readBytes(local.path)) : null,
      dependencies,
    };
  }).sort((a, b) => a.specifier.localeCompare(b.specifier));
  if (new Set(modules.map((module) => module.specifier)).size !== modules.length) fail('Deno graph contains duplicate normalized module specifiers');
  return sha(JSON.stringify(modules));
}

function checkToolVersion(executable, expectedPattern, label, run = execFileSync) {
  if (!executable) fail(`${label} executable is required`);
  const output = run(executable, ['--version'], { cwd: repo, encoding: 'utf8' }).trim();
  if (!expectedPattern.test(output)) fail(`${label} version mismatch: ${output}`);
  return output;
}

function generateGraphs(deno, graphDir, run = execFileSync) {
  checkToolVersion(deno, /^deno 2\.8\.1(?:\s|$)/m, 'Deno', run);
  if (!graphDir) fail('graph directory is required');
  mkdirSync(graphDir, { recursive: true });
  for (const name of RUN4_FUNCTIONS) {
    const cwd = resolve(repo, 'supabase', 'functions', name);
    const output = run(deno, ['info', '--json', '--config', 'deno.json', '--lock', '../../deno.lock', '--frozen', 'index.ts'], { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    JSON.parse(output);
    writeFileSync(resolve(graphDir, `${name}.json`), output);
  }
}

export function collectCurrentFunctionEvidence(graphDir) {
  const configPath = resolve(repo, 'supabase/config.toml');
  const lockPath = resolve(repo, 'supabase/deno.lock');
  if (!existsSync(lockPath)) fail('shared supabase/deno.lock is absent');
  const configured = parseFunctionConfig(readFileSync(configPath, 'utf8'));
  sameSet(configured.map((fn) => fn.name), RUN4_FUNCTIONS, 'evidence function set');
  return {
    configSha256: hashTextEvidence(readFileSync(configPath)),
    lockSha256: hashTextEvidence(readFileSync(lockPath)),
    functions: configured.map((fn) => {
      const entrypointPath = resolve(repo, 'supabase', fn.entrypoint.slice(2));
      const importMapPath = resolve(repo, 'supabase', fn.importMap.slice(2));
      const graphPath = resolve(graphDir, `${fn.name}.json`);
      if (!existsSync(graphPath)) fail(`missing current graph for ${fn.name}`);
      return {
        name: fn.name,
        entrypoint: fn.entrypoint,
        importMap: fn.importMap,
        entrypointSha256: hashTextEvidence(readFileSync(entrypointPath)),
        importMapSha256: hashTextEvidence(readFileSync(importMapPath)),
        moduleGraphSha256: hashModuleGraph(readFileSync(graphPath, 'utf8')),
      };
    }),
  };
}

export function validateServeProbe(probe) {
  if (!isObject(probe) || probe.mode !== 'local-functions-serve' || probe.command !== RUN4_LOCAL_SERVE_COMMAND || probe.startupExitStatus !== 0 || probe.edgeRuntimeVersion !== '1.71.0' || probe.compatibleDenoVersion !== '2.1.4') fail('local runtime attestation lacks normalized local serve evidence');
  if (!Array.isArray(probe.routes)) fail('local runtime attestation has no route probes');
  if (probe.routes.some((route) => !isObject(route))) fail('local runtime attestation has malformed route evidence');
  sameSet(probe.routes.map((route) => route.name), RUN4_FUNCTIONS, 'local serve route set');
  for (const route of probe.routes) {
    if (route.path !== `/functions/v1/${route.name}` || route.handlerReached !== true || route.httpStatus !== 401 || !/^[0-9a-f]{64}$/.test(route.bodySha256 ?? '')) fail(`invalid handler-level local serve evidence for ${route.name}`);
  }
  return probe;
}

export function buildLocalAttestation({ graphDir, supabaseCli, routes, run = execFileSync } = {}) {
  const cliVersion = checkToolVersion(supabaseCli, /^2\.81\.2$/m, 'repository-local Supabase CLI', run);
  const probe = validateServeProbe({
    mode: 'local-functions-serve',
    command: RUN4_LOCAL_SERVE_COMMAND,
    startupExitStatus: 0,
    edgeRuntimeVersion: '1.71.0',
    compatibleDenoVersion: '2.1.4',
    routes,
  });
  return {
    schemaVersion: 2,
    scope: 'local-only',
    hostedDeployParityClaimed: false,
    // #183: the product union is measured against productCapBaseSha and recorded, never accepted
    // here. This flag stays false until a human decides the run's product envelope; nothing
    // downstream may read a recorded measurement as a passed cap.
    productCapAcceptanceClaimed: false,
    replayBoundary: 'CI recomputes frozen graphs and validates this local evidence, but does not replay local serve or claim hosted deploy parity.',
    generator: RUN4_ATTESTATION_GENERATOR,
    provenance: {
      unitBaseSha: RUN4_UNIT_BASE_SHA,
      productCapBaseSha: RUN4_PRODUCT_BASE_SHA,
      maxChangedPaths: RUN4_MAX_CHANGED_PATHS,
      maxAddedLines: RUN4_MAX_ADDED_LINES,
    },
    cliVersion,
    denoVersion: '2.8.1',
    ...collectCurrentFunctionEvidence(graphDir),
    serveProbe: probe,
  };
}

export function checkDeployAttestation({ manifestPath = resolve(repo, 'supabase/deploy-attestation.json'), graphDir, deno, supabaseCli, run = execFileSync } = {}) {
  if (!existsSync(manifestPath)) fail('local runtime attestation BLOCKED: manifest is absent');
  let manifest;
  try { manifest = JSON.parse(readFileSync(manifestPath, 'utf8')); } catch (error) { fail(`local runtime attestation BLOCKED: invalid manifest: ${error.message}`); }
  const configPath = resolve(repo, 'supabase/config.toml');
  const lockPath = resolve(repo, 'supabase/deno.lock');
  if (!existsSync(lockPath)) fail('local runtime attestation BLOCKED: shared supabase/deno.lock is absent');
  const cliOutput = checkToolVersion(supabaseCli, /^2\.81\.2$/m, 'repository-local Supabase CLI', run);
  if (manifest.schemaVersion !== 2 || manifest.scope !== 'local-only' || manifest.hostedDeployParityClaimed !== false || manifest.replayBoundary !== 'CI recomputes frozen graphs and validates this local evidence, but does not replay local serve or claim hosted deploy parity.' || manifest.generator !== RUN4_ATTESTATION_GENERATOR) fail('local runtime attestation must explicitly deny hosted deploy parity');
  if (manifest.productCapAcceptanceClaimed !== false) fail('local runtime attestation must explicitly deny product-cap acceptance');
  if (!isObject(manifest.provenance)) fail('local runtime attestation provenance drifted');
  sameSet(Object.keys(manifest.provenance), ['unitBaseSha', 'productCapBaseSha', 'maxChangedPaths', 'maxAddedLines'], 'local runtime attestation provenance fields');
  if (manifest.provenance.unitBaseSha !== RUN4_UNIT_BASE_SHA || manifest.provenance.productCapBaseSha !== RUN4_PRODUCT_BASE_SHA || manifest.provenance.maxChangedPaths !== RUN4_MAX_CHANGED_PATHS || manifest.provenance.maxAddedLines !== RUN4_MAX_ADDED_LINES) fail('local runtime attestation provenance drifted');
  if (manifest.cliVersion !== cliOutput || manifest.denoVersion !== '2.8.1') fail('local runtime attestation tool versions drifted');
  if (manifest.configSha256 !== hashTextEvidence(readFileSync(configPath)) || manifest.lockSha256 !== hashTextEvidence(readFileSync(lockPath))) fail('local runtime attestation config/lock hash mismatch');

  const configured = parseFunctionConfig(readFileSync(configPath, 'utf8'));
  sameSet(configured.map((fn) => fn.name), RUN4_FUNCTIONS, 'attested configured function set');
  if (!Array.isArray(manifest.functions)) fail('local runtime attestation has no function records');
  sameSet(manifest.functions.map((fn) => fn.name), RUN4_FUNCTIONS, 'attested function set');
  if (deno) generateGraphs(deno, graphDir, run);
  if (!graphDir) fail('local runtime attestation requires freshly generated graph evidence');
  for (const fn of configured) {
    const record = manifest.functions.find((item) => item.name === fn.name);
    const entrypointPath = resolve(repo, 'supabase', fn.entrypoint.slice(2));
    const importMapPath = resolve(repo, 'supabase', fn.importMap.slice(2));
    if (record.entrypoint !== fn.entrypoint || record.importMap !== fn.importMap) fail(`local runtime attestation mapping drift for ${fn.name}`);
    if (record.entrypointSha256 !== hashTextEvidence(readFileSync(entrypointPath)) || record.importMapSha256 !== hashTextEvidence(readFileSync(importMapPath))) fail(`local runtime attestation source/config drift for ${fn.name}`);
    const graphPath = resolve(graphDir, `${fn.name}.json`);
    if (!existsSync(graphPath)) fail(`local runtime attestation missing current graph for ${fn.name}`);
    if (hashModuleGraph(readFileSync(graphPath, 'utf8')) !== record.moduleGraphSha256) fail(`local runtime attestation module graph drift for ${fn.name}`);
  }

  validateServeProbe(manifest.serveProbe);
  return manifest;
}

export function checkAggregateNeeds(text) {
  let needs;
  try { needs = JSON.parse(text); } catch (error) { fail(`invalid needs JSON: ${error.message}`); }
  if (!isObject(needs)) fail('needs must be an object');
  sameSet(Object.keys(needs), RUN4_REQUIRED_JOBS, 'Run 4 Gate runtime needs');
  const bad = Object.entries(needs).filter(([, value]) => !isObject(value) || value.result !== 'success');
  if (bad.length) fail(`Run 4 Gate dependencies not successful: ${bad.map(([name, value]) => `${name}=${value?.result ?? 'missing'}`).join(', ')}`);
  return needs;
}

function parseOptions(args) {
  const options = new Map();
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (!flag?.startsWith('--') || value === undefined || value.startsWith('--')) fail(`invalid argument pair at ${flag ?? '<missing>'}`);
    const key = flag.slice(2);
    if (options.has(key)) fail(`duplicate option --${key}`);
    options.set(key, value);
  }
  return options;
}

function main() {
  const [command, ...args] = process.argv.slice(2);
  const opt = parseOptions(args);
  const workflowText = readFileSync(resolve(repo, '.github/workflows/ci.yml'), 'utf8');
  if (command === 'config') {
    validateFunctionConfig(readFileSync(resolve(repo, 'supabase/config.toml'), 'utf8'), workflowText);
    validateRun4Workflow(workflowText);
    console.log('run4 config/workflow gate: PASS');
    return;
  }
  if (command === 'provenance') { console.log(JSON.stringify(checkWorkflowProvenance({ eventPath: opt.get('event-path'), githubSha: opt.get('github-sha') }))); return; }
  if (command === 'landing') { console.log(JSON.stringify(checkLandingDelta({ base: opt.get('base'), head: opt.get('head'), maxPaths: Number(opt.get('max-paths')), maxAdded: Number(opt.get('max-added')) }))); return; }
  if (command === 'product-cap') {
    // #183 measurement. Reports the immutable product union and whether it is within the cap;
    // exits 0 either way BY DESIGN — this records, it does not gate (see the constants block).
    // Every provenance/parsing failure inside still throws and exits non-zero.
    const delta = productLandingDelta({ head: opt.get('head') ?? 'HEAD' });
    console.log(JSON.stringify(delta));
    console.log(
      `run4 product cap (RECORDED, NOT GATING): ${delta.changedPaths}/${RUN4_MAX_CHANGED_PATHS} paths, ` +
        `${delta.addedLines}/${RUN4_MAX_ADDED_LINES} added lines, ${delta.excludedPaths} MT4 paths excluded — ` +
        `${delta.withinCap ? 'WITHIN cap' : 'OVER cap; acceptance is a human envelope decision'}`
    );
    return;
  }
  if (command === 'graph-hashes') { generateGraphs(opt.get('deno'), opt.get('graph-dir')); console.log(JSON.stringify(collectCurrentFunctionEvidence(opt.get('graph-dir')), null, 2)); return; }
  if (command === 'attest') { checkDeployAttestation({ graphDir: opt.get('graph-dir'), deno: opt.get('deno'), supabaseCli: opt.get('supabase-cli') }); console.log('run4 local runtime attestation: PASS'); return; }
  if (command === 'record-attestation') {
    const routesJson = opt.get('routes-json') ?? (opt.get('routes-base64') ? Buffer.from(opt.get('routes-base64'), 'base64url').toString('utf8') : undefined);
    const manifestPath = opt.get('manifest-path');
    if (!routesJson || !manifestPath) fail('record-attestation requires --routes-json/--routes-base64 and --manifest-path');
    let routes;
    try { routes = JSON.parse(routesJson); } catch (error) { fail(`invalid route evidence JSON: ${error.message}`); }
    if (!Array.isArray(routes)) fail('route evidence must be an array');
    writeFileSync(manifestPath, `${JSON.stringify(buildLocalAttestation({ graphDir: opt.get('graph-dir'), supabaseCli: opt.get('supabase-cli'), routes }), null, 2)}\n`);
    console.log('run4 local-only attestation recorded');
    return;
  }
  if (command === 'aggregate') { checkAggregateNeeds(process.env.NEEDS_JSON ?? ''); console.log('Run 4 Gate: PASS'); return; }
  fail('usage: run4_release_gate.mjs <config|provenance|landing|product-cap|graph-hashes|attest|record-attestation|aggregate>');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
