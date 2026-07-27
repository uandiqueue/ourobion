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

// This is deliberately the U0 unit boundary, not the original Run 4 envelope/bootstrap SHA.
// The concurrent model-training session landed before U0 reconciliation and is excluded only by
// selecting the post-concurrent integration tip as the unit's explicit starting point.
export const RUN4_UNIT_BASE_SHA = '837b7e690f92dc1669428a2476c9d8d0456020e8';
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
]);
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
  const checkouts = job.steps.filter((step) => step?.uses === 'actions/checkout@v4');
  if (checkouts.length !== 1) fail(`${jobName} must use exactly one actions/checkout@v4 step`);
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
  context: ['uses:<unnamed>:actions/checkout@v4', 'uses:Set up Node:actions/setup-node@v4', 'run:Context check'],
  'run4-release': ['uses:<unnamed>:actions/checkout@v4', 'uses:<unnamed>:actions/setup-node@v4', 'uses:<unnamed>:denoland/setup-deno@v2', 'run:Install release-gate dependencies', 'run:Assert exact landing SHA and U0 unit base', 'run:Verify parsed function and workflow invariants', 'run:Recompute frozen graphs and verify local-only runtime attestation'],
  flutter: ['uses:<unnamed>:actions/checkout@v4', 'uses:Setup Flutter:subosito/flutter-action@v2', 'run:Create public env file', 'run:Install dependencies', 'run:Analyze', 'run:Test'],
  typescript: ['uses:<unnamed>:actions/checkout@v4', 'uses:Setup Node:actions/setup-node@v4', 'run:Install dependencies', 'run:Type check shared types'],
  'node-tools': ['uses:<unnamed>:actions/checkout@v4', 'uses:Set up Node:actions/setup-node@v4', 'run:Install shared contract dependencies', 'run:Install dependencies', 'run:Typecheck', 'run:Test', 'run:Drift check'],
  nao: ['uses:<unnamed>:actions/checkout@v4', 'uses:Set up Node:actions/setup-node@v4', 'run:Install dependencies', 'run:Typecheck', 'run:Test'],
  'deno-check': ['uses:<unnamed>:actions/checkout@v4', 'uses:Set up Deno:denoland/setup-deno@v2', 'run:Type check handler'],
  'migrations-apply': ['uses:<unnamed>:actions/checkout@v4', 'run:Install pg_cron/pg_net stubs into the service container', 'run:Bootstrap supabase-shaped primitives', 'run:Apply migrations in filename order'],
  'run4-gate': ['uses:<unnamed>:actions/checkout@v4', 'uses:Set up Node:actions/setup-node@v4', 'run:Install release-gate dependencies', 'run:Fail unless every required dependency succeeded'],
});

function validateWorkflowDefaults(workflow) {
  if (own(workflow, 'defaults')) fail('workflow cannot set defaults that change required execution');
}

function validateRequiredJobSteps(job, jobName) {
  if (own(job, 'defaults')) fail(`${jobName} job cannot set defaults that change required execution`);
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
  'run4-release:Assert exact landing SHA and U0 unit base': Object.freeze({ RUN4_UNIT_BASE_SHA, RUN4_MAX_CHANGED_PATHS, RUN4_MAX_ADDED_LINES }),
  'run4-gate:Fail unless every required dependency succeeded': Object.freeze({ NEEDS_JSON: '${{ toJson(needs) }}' }),
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
  const landing = exactStep(release, 'Assert exact landing SHA and U0 unit base');
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
    if (jobName !== 'run4-release' && own(job, 'if')) fail(`${jobName} job cannot set if`);
    validateCheckout(job, jobName);
    validateRequiredJobStepGuards(job, jobName);
    validateRequiredJobSteps(job, jobName);
    validateRequiredRunExecution(job, jobName);
  }

  const context = workflow.jobs.context;
  exactRun(context, 'context', 'Context check', 'node tools/context_sync.mjs --check');
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

export function checkLandingDelta({ base, head = 'HEAD', maxPaths, maxAdded, git = execFileSync }) {
  if (base !== RUN4_UNIT_BASE_SHA) fail(`base must equal accepted U0 unit SHA ${RUN4_UNIT_BASE_SHA}`);
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
    const match = /^(\d+)\t(\d+)\t([^\0]+)$/.exec(row);
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
      sourceSha256: local ? sha(readBytes(local.path)) : null,
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
    configSha256: sha(readFileSync(configPath)),
    lockSha256: sha(readFileSync(lockPath)),
    functions: configured.map((fn) => {
      const entrypointPath = resolve(repo, 'supabase', fn.entrypoint.slice(2));
      const importMapPath = resolve(repo, 'supabase', fn.importMap.slice(2));
      const graphPath = resolve(graphDir, `${fn.name}.json`);
      if (!existsSync(graphPath)) fail(`missing current graph for ${fn.name}`);
      return {
        name: fn.name,
        entrypoint: fn.entrypoint,
        importMap: fn.importMap,
        entrypointSha256: sha(readFileSync(entrypointPath)),
        importMapSha256: sha(readFileSync(importMapPath)),
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
    schemaVersion: 1,
    scope: 'local-only',
    hostedDeployParityClaimed: false,
    replayBoundary: 'CI recomputes frozen graphs and validates this local evidence, but does not replay local serve or claim hosted deploy parity.',
    generator: RUN4_ATTESTATION_GENERATOR,
    provenance: {
      unitBaseSha: RUN4_UNIT_BASE_SHA,
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
  if (manifest.schemaVersion !== 1 || manifest.scope !== 'local-only' || manifest.hostedDeployParityClaimed !== false || manifest.replayBoundary !== 'CI recomputes frozen graphs and validates this local evidence, but does not replay local serve or claim hosted deploy parity.' || manifest.generator !== RUN4_ATTESTATION_GENERATOR) fail('local runtime attestation must explicitly deny hosted deploy parity');
  if (!isObject(manifest.provenance) || manifest.provenance.unitBaseSha !== RUN4_UNIT_BASE_SHA || manifest.provenance.maxChangedPaths !== RUN4_MAX_CHANGED_PATHS || manifest.provenance.maxAddedLines !== RUN4_MAX_ADDED_LINES) fail('local runtime attestation provenance drifted');
  if (manifest.cliVersion !== cliOutput || manifest.denoVersion !== '2.8.1') fail('local runtime attestation tool versions drifted');
  if (manifest.configSha256 !== sha(readFileSync(configPath)) || manifest.lockSha256 !== sha(readFileSync(lockPath))) fail('local runtime attestation config/lock hash mismatch');

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
    if (record.entrypointSha256 !== sha(readFileSync(entrypointPath)) || record.importMapSha256 !== sha(readFileSync(importMapPath))) fail(`local runtime attestation source/config drift for ${fn.name}`);
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
  fail('usage: run4_release_gate.mjs <config|provenance|landing|graph-hashes|attest|record-attestation|aggregate>');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
