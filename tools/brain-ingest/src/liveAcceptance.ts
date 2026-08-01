/** Ordered, operator-invoked provider acceptance facade. No cloud/R2/DB access. */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';

import {
  AttemptJournal,
  ACCEPTANCE_RUNTIME_REPO_ROOT,
  LlmRouter,
  acceptanceAuthorizationHash,
  acceptanceJournalRepoPath,
  logicalCallIdSha256,
  loadConfig as loadRouterConfig,
  resolveRepoPath,
  validateAcceptanceAuthorization,
  type AcceptanceAuthorization,
  type LlmRequest,
  type LlmResponse,
  type ModelIdentity,
  type RouterConfig,
} from '../../llm-router/src/index.js';
import { parseEnv } from './config.js';
import { prepareOfflineAcceptance, readFrozenFile } from './offlineAcceptance.js';
import { synthesize, type SynthesisRouter } from './synth/index.js';
import {
  loadClaimsFromFile,
  verify,
  verifierLogicalCallId,
  type VerifierRouter,
} from './verify/verifier.js';

export type LiveAcceptanceLeg =
  | 'anthropic-synthesis'
  | 'openai-synthesis'
  | 'agnes-verification';

const ORDER: readonly LiveAcceptanceLeg[] = [
  'anthropic-synthesis',
  'openai-synthesis',
  'agnes-verification',
];
const SHA256 = /^sha256:[0-9a-f]{64}$/;
const GIT_SHA = /^[0-9a-f]{40}$/;

interface CompletedLeg {
  leg: LiveAcceptanceLeg;
  logicalCallIds: string[];
  acceptedClaims: number;
  primaryArtifactPath: string | null;
  primaryArtifactSha256: string | null;
  rawSidecarPath: string;
  rawSidecarSha256: string;
  providerIdentity: ModelIdentity;
  completedAt: string;
}

interface LiveAcceptanceState {
  version: 2;
  authorizationId: string;
  authorizationBasis: string;
  authorizationHash: string;
  acceptanceRunId: string;
  sourceRevision: string;
  offlineManifestSha256: string;
  completed: CompletedLeg[];
}

interface AcceptanceRouter extends SynthesisRouter, VerifierRouter {
  config: RouterConfig;
}

export interface GitSnapshot {
  head: string;
  dirty: string[];
}

export interface LiveAcceptanceDeps {
  gitSnapshot?: () => GitSnapshot;
  routerFactory?: (leg: LiveAcceptanceLeg, runId: string, authorization: AcceptanceAuthorization) => AcceptanceRouter;
  statePath?: string;
  journalPath?: string;
  /** Test-only artifact root; production remains the repository runtime root. */
  runtimeRoot?: string;
  now?: () => number;
  /** Test seam; production validates the task-scoped hash-chained journal exactly. */
  validateJournal?: (
    runId: string,
    authorizationHash: string,
    authorizationBasis: string,
    logicalCallIds: readonly string[],
    requireExisting: boolean,
  ) => void;
}

function sha256(value: string | Buffer): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonical(object[key])}`).join(',')}}`;
  }
  const encoded = JSON.stringify(value);
  if (encoded === undefined) throw new Error('live-acceptance: cannot canonicalize undefined');
  return encoded;
}

export function gitSnapshotAt(root = resolveRepoPath('.')): GitSnapshot {
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const dirty = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], {
    cwd: root,
    encoding: 'utf8',
  }).split(/\r?\n/).filter(Boolean);
  return { head, dirty };
}

function readOptionalEnv(path: string): Record<string, string> {
  try {
    return parseEnv(readFileSync(path, 'utf8'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    return {};
  }
}

/** Deterministic secret precedence: repo root < tool-local < explicit process env. */
export function loadProtectedEnv(
  root = resolveRepoPath('.'),
  explicit: Record<string, string | undefined> = process.env,
): Record<string, string | undefined> {
  const rootEnv = readOptionalEnv(resolve(root, '.env'));
  const toolEnv = readOptionalEnv(resolve(root, 'tools', 'brain-ingest', '.env'));
  const explicitDefined = Object.fromEntries(
    Object.entries(explicit).filter((entry): entry is [string, string] => entry[1] !== undefined),
  );
  return { ...rootEnv, ...toolEnv, ...explicitDefined };
}

function configForLeg(leg: LiveAcceptanceLeg): RouterConfig {
  const config = structuredClone(loadRouterConfig());
  if (leg === 'anthropic-synthesis') {
    config.nodes.synthesis = { ...config.nodes.synthesis, model: 'claude-sonnet-5', route: 'api_worker' };
    config.nodes.verifier = { ...config.nodes.verifier, model: 'gpt-5', route: 'api_worker' };
  } else if (leg === 'openai-synthesis') {
    config.nodes.synthesis = { ...config.nodes.synthesis, model: 'gpt-5', route: 'api_worker' };
    config.nodes.verifier = { ...config.nodes.verifier, model: 'claude-sonnet-5', route: 'api_worker' };
  } else {
    config.nodes.synthesis = { ...config.nodes.synthesis, model: 'gpt-5', route: 'api_worker' };
    config.nodes.verifier = { ...config.nodes.verifier, model: 'agnes-2.5-flash', route: 'api_worker' };
  }
  return config;
}

function defaultRouterFactory(
  leg: LiveAcceptanceLeg,
  runId: string,
  _authorization: AcceptanceAuthorization,
): AcceptanceRouter {
  return new LlmRouter({
    config: configForLeg(leg),
    runId,
    env: loadProtectedEnv(),
  });
}

function validateCompleted(value: unknown, index: number): CompletedLeg {
  const expected = ORDER[index];
  if (typeof value !== 'object' || value === null || expected === undefined) {
    throw new Error('live-acceptance: state completed sequence is invalid');
  }
  const item = value as CompletedLeg;
  const expectedFamily = expected === 'anthropic-synthesis'
    ? 'anthropic'
    : expected === 'openai-synthesis' ? 'openai' : 'agnes';
  const identity = item.providerIdentity;
  if (
    item.leg !== expected ||
    !Array.isArray(item.logicalCallIds) || item.logicalCallIds.length === 0 ||
    item.logicalCallIds.some((id) => typeof id !== 'string' || id.length === 0) ||
    !Number.isInteger(item.acceptedClaims) || item.acceptedClaims < 0 ||
    typeof item.rawSidecarPath !== 'string' || !SHA256.test(item.rawSidecarSha256) ||
    typeof identity !== 'object' || identity === null ||
    typeof identity.model !== 'string' || identity.model.length === 0 ||
    identity.source !== 'provider-response' || identity.providerAttested !== true ||
    identity.family !== expectedFamily ||
    !(identity.returnedVersion === null || typeof identity.returnedVersion === 'string') ||
    !(identity.decorrelatedFromSynthesis === null || typeof identity.decorrelatedFromSynthesis === 'boolean') ||
    (expected === 'agnes-verification' && identity.decorrelatedFromSynthesis !== true) ||
    Number.isNaN(Date.parse(item.completedAt)) ||
    !((item.primaryArtifactPath === null && item.primaryArtifactSha256 === null) ||
      (typeof item.primaryArtifactPath === 'string' && typeof item.primaryArtifactSha256 === 'string' && SHA256.test(item.primaryArtifactSha256)))
  ) {
    throw new Error('live-acceptance: state completed sequence is corrupt');
  }
  return item;
}

function normalizedPath(value: string): string {
  const resolved = resolve(value).replace(/^\\\\\?\\/, '');
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function pathEntryExists(path: string): boolean {
  try {
    lstatSync(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

function taskRelativePath(taskRoot: string, path: string, label: string): string {
  const rel = relative(taskRoot, resolve(path));
  if (!runtimeRelativeIsContained(rel)) {
    throw new Error(`live-acceptance: ${label} escaped the authorization task root`);
  }
  return rel;
}

function assertCanonicalDirectory(root: string, target: string, create: boolean): void {
  const absoluteRoot = resolve(root);
  const absoluteTarget = resolve(target);
  const rel = absoluteTarget === absoluteRoot ? '' : taskRelativePath(absoluteRoot, absoluteTarget, 'runtime directory');
  const rootStat = lstatSync(absoluteRoot);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink() || normalizedPath(realpathSync(absoluteRoot)) !== normalizedPath(absoluteRoot)) {
    throw new Error('live-acceptance: runtime root must be a canonical ordinary directory');
  }
  let current = absoluteRoot;
  for (const component of rel.split(/[\\/]+/).filter(Boolean)) {
    current = resolve(current, component);
    if (!existsSync(current)) {
      if (!create) throw new Error('live-acceptance: runtime parent directory is missing');
      mkdirSync(current);
    }
    const stat = lstatSync(current);
    if (!stat.isDirectory() || stat.isSymbolicLink() || normalizedPath(realpathSync(current)) !== normalizedPath(current)) {
      throw new Error('live-acceptance: runtime path uses a symlink, junction, or non-canonical directory');
    }
  }
}

function assertOrdinaryTaskFile(taskRoot: string, path: string, label: string): void {
  taskRelativePath(taskRoot, path, label);
  assertCanonicalDirectory(taskRoot, dirname(path), false);
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink() || normalizedPath(realpathSync(path)) !== normalizedPath(path)) {
    throw new Error(`live-acceptance: ${label} must be a canonical ordinary non-symlink file`);
  }
}

function assertSafeWriteTarget(taskRoot: string, path: string, label: string): void {
  taskRelativePath(taskRoot, path, label);
  assertCanonicalDirectory(taskRoot, dirname(path), true);
  if (pathEntryExists(path)) assertOrdinaryTaskFile(taskRoot, path, label);
}

function readState(taskRoot: string, path: string): LiveAcceptanceState | null {
  if (!pathEntryExists(path)) return null;
  assertOrdinaryTaskFile(taskRoot, path, 'state');
  let raw: unknown;
  try { raw = JSON.parse(readFileSync(path, 'utf8')); } catch { throw new Error('live-acceptance: state is corrupt JSON'); }
  if (typeof raw !== 'object' || raw === null) throw new Error('live-acceptance: state is invalid');
  const value = raw as LiveAcceptanceState;
  if (
    value.version !== 2 || typeof value.acceptanceRunId !== 'string' ||
    typeof value.authorizationId !== 'string' ||
    typeof value.authorizationBasis !== 'string' || value.authorizationBasis.trim().length === 0 ||
    !SHA256.test(value.authorizationHash) ||
    !GIT_SHA.test(value.sourceRevision) || !SHA256.test(value.offlineManifestSha256) ||
    !Array.isArray(value.completed) || value.completed.length > ORDER.length
  ) throw new Error('live-acceptance: state is invalid');
  value.completed = value.completed.map(validateCompleted);
  return value;
}

function writeState(taskRoot: string, path: string, state: LiveAcceptanceState): void {
  assertSafeWriteTarget(taskRoot, path, 'state');
  const temp = `${path}.tmp-${process.pid}`;
  assertSafeWriteTarget(taskRoot, temp, 'temporary state');
  writeFileSync(temp, `${JSON.stringify(state, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  assertOrdinaryTaskFile(taskRoot, temp, 'temporary state');
  renameSync(temp, path);
  assertOrdinaryTaskFile(taskRoot, path, 'state');
}

function hashArtifact(taskRoot: string, path: string, label: string): string {
  assertOrdinaryTaskFile(taskRoot, path, label);
  return sha256(readFrozenFile(path, label).bytes);
}

function defaultValidateJournal(
  journalPath: string,
  runId: string,
  authorizationHash: string,
  authorizationBasis: string,
  logicalCallIds: readonly string[],
  requireExisting: boolean,
  taskRoot: string,
): void {
  if (!pathEntryExists(journalPath)) {
    if (requireExisting) throw new Error('live-acceptance: expected attempt journal is missing');
    return;
  }
  assertOrdinaryTaskFile(taskRoot, journalPath, 'attempt journal');
  const events = new AttemptJournal(journalPath, { allowedRoot: taskRoot }).readEvents();
  if (events.some((event) =>
    event.acceptanceRunId !== runId ||
    event.authorizationHash !== authorizationHash ||
    event.authorizationBasis !== authorizationBasis
  )) {
    throw new Error('live-acceptance: journal belongs to another run/authorization; manual reconciliation required');
  }
  const expected = [...new Set(logicalCallIds)].sort();
  const actual = [...new Set(events.map((event) => event.logicalCallId))].sort();
  if (canonical(actual) !== canonical(expected)) {
    throw new Error('live-acceptance: journal logical-call set is not exactly represented by state; manual reconciliation required');
  }
  for (const logicalCallId of logicalCallIds) {
    const logicalEvents = events.filter((event) => event.logicalCallId === logicalCallId);
    const attempts = [...new Set(logicalEvents.map((event) => event.attempt))];
    for (const attempt of attempts) {
      const attemptEvents = logicalEvents.filter((event) => event.attempt === attempt);
      const reserved = attemptEvents.filter((event) => event.kind === 'reserved').length;
      const started = attemptEvents.filter((event) => event.kind === 'started').length;
      const terminal = attemptEvents.filter((event) => ['response', 'failed', 'unknown'].includes(event.kind)).length;
      if (reserved !== 1 || started !== 1 || terminal !== 1) {
        throw new Error(`live-acceptance: journal attempt ${logicalCallId}#${attempt} lacks exactly one terminal outcome`);
      }
    }
  }
}

function requireProviderIdentity(
  leg: LiveAcceptanceLeg,
  identities: readonly (ModelIdentity | undefined)[],
): ModelIdentity {
  const expectedFamily = leg === 'anthropic-synthesis'
    ? 'anthropic'
    : leg === 'openai-synthesis' ? 'openai' : 'agnes';
  if (identities.length === 0 || identities.some((identity) => identity === undefined)) {
    throw new Error(`live-acceptance: ${leg} lacks provider response identity`);
  }
  const resolved = identities as readonly ModelIdentity[];
  const first = resolved[0]!;
  if (
    first.source !== 'provider-response' ||
    first.providerAttested !== true ||
    first.family !== expectedFamily ||
    (leg === 'agnes-verification' && first.decorrelatedFromSynthesis !== true)
  ) {
    throw new Error(`live-acceptance: ${leg} provider response identity is invalid`);
  }
  if (resolved.some((identity) => canonical(identity) !== canonical(first))) {
    throw new Error(`live-acceptance: ${leg} returned inconsistent provider identities`);
  }
  return structuredClone(first);
}

function runtimeDir(taskRoot: string, runId: string, leg: LiveAcceptanceLeg): string {
  return resolve(taskRoot, 'artifacts', runId, leg);
}

export function runtimeRelativeIsContained(
  value: string,
  absoluteCheck: (path: string) => boolean = isAbsolute,
): boolean {
  return value !== '' && !value.startsWith('..') && !absoluteCheck(value);
}

function relativeRuntimePath(taskRoot: string, path: string): string {
  const rel = relative(taskRoot, path);
  if (!runtimeRelativeIsContained(rel)) {
    throw new Error('live-acceptance: artifact escaped the authorization task root');
  }
  return rel.replaceAll('\\', '/');
}

function absoluteRuntimePath(taskRoot: string, path: string): string {
  const absolute = resolve(taskRoot, path);
  const rel = relative(taskRoot, absolute);
  if (!runtimeRelativeIsContained(rel)) {
    throw new Error('live-acceptance: state artifact escaped the authorization task root');
  }
  return absolute;
}

function validateCompletedArtifacts(
  taskRoot: string,
  completed: readonly CompletedLeg[],
  pairId: string,
): void {
  for (const item of completed) {
    const rawPath = absoluteRuntimePath(taskRoot, item.rawSidecarPath);
    if (hashArtifact(taskRoot, rawPath, `${item.leg} raw sidecar`) !== item.rawSidecarSha256) {
      throw new Error(`live-acceptance: ${item.leg} raw sidecar drift`);
    }
    if (item.primaryArtifactPath !== null) {
      const primaryPath = absoluteRuntimePath(taskRoot, item.primaryArtifactPath);
      if (hashArtifact(taskRoot, primaryPath, `${item.leg} primary artifact`) !== item.primaryArtifactSha256) {
        throw new Error(`live-acceptance: ${item.leg} primary artifact drift`);
      }
    }
    if (item.leg === 'anthropic-synthesis' || item.leg === 'openai-synthesis') {
      const expected = logicalCallIdSha256(item.leg, pairId);
      if (item.logicalCallIds.length !== 1 || item.logicalCallIds[0] !== expected) {
        throw new Error(`live-acceptance: ${item.leg} logical-call binding drift`);
      }
    }
  }

  const verification = completed.find((item) => item.leg === 'agnes-verification');
  const openai = completed.find((item) => item.leg === 'openai-synthesis');
  if (verification !== undefined) {
    if (openai?.primaryArtifactPath === null || openai === undefined) {
      throw new Error('live-acceptance: Agnes state lacks its OpenAI claims source');
    }
    const claimsPath = absoluteRuntimePath(taskRoot, openai.primaryArtifactPath);
    assertOrdinaryTaskFile(taskRoot, claimsPath, 'OpenAI claims artifact');
    const claims = loadClaimsFromFile(claimsPath);
    // #307: use the SHARED derivation. This was a second copy of the edgeId-only formula, so the
    // collision fix in verifier.ts would otherwise have desynchronised the two and surfaced as
    // "Agnes logical-call binding drift" — exactly the drift the exported helper exists to prevent.
    const expected = claims.map((claim) => verifierLogicalCallId(claim));
    if (canonical(verification.logicalCallIds) !== canonical(expected)) {
      throw new Error('live-acceptance: Agnes logical-call binding drift');
    }
  }
}

/** Execute exactly one authorized leg; each invocation re-runs the offline preflight first. */
export async function runLiveAcceptance(
  bundlePath: string,
  leg: LiveAcceptanceLeg,
  deps: LiveAcceptanceDeps = {},
): Promise<Record<string, unknown>> {
  const prepared = await prepareOfflineAcceptance(bundlePath);
  const bundle = prepared.bundle;
  const now = deps.now ?? Date.now;
  if (bundle.sourceRevision === undefined || !GIT_SHA.test(bundle.sourceRevision)) {
    throw new Error('live-acceptance: bundle.sourceRevision must be the exact 40-character Git head');
  }
  const authorization = validateAcceptanceAuthorization(bundle.acceptanceAuthorization, now());
  const authorizationHash = acceptanceAuthorizationHash(authorization);
  const snapshot = deps.gitSnapshot ?? (() => gitSnapshotAt());
  const git = snapshot();
  if (git.head !== bundle.sourceRevision) throw new Error('live-acceptance: source revision drift');
  if (git.dirty.length > 0) throw new Error(`live-acceptance: dirty worktree (${git.dirty[0]})`);

  const offlineManifestSha256 = sha256(canonical(prepared.manifest));
  const artifactRoot = resolve(deps.runtimeRoot ?? resolveRepoPath('.'));
  const taskRoot = resolve(artifactRoot, ACCEPTANCE_RUNTIME_REPO_ROOT, authorization.authorizationId);
  assertCanonicalDirectory(artifactRoot, taskRoot, true);
  const statePath = deps.statePath ?? resolve(taskRoot, 'state.json');
  const journalPath = deps.journalPath ?? resolve(artifactRoot, acceptanceJournalRepoPath(authorization.authorizationId));
  taskRelativePath(taskRoot, statePath, 'state');
  taskRelativePath(taskRoot, journalPath, 'attempt journal');
  assertSafeWriteTarget(taskRoot, journalPath, 'attempt journal');
  const state = readState(taskRoot, statePath);
  if (state === null && pathEntryExists(journalPath)) {
    throw new Error('live-acceptance: pre-existing journal without state; manual reconciliation required');
  }
  if (state !== null && (
    state.authorizationId !== authorization.authorizationId ||
    state.authorizationBasis !== authorization.authorizationBasis ||
    state.authorizationHash !== authorizationHash ||
    state.acceptanceRunId !== bundle.acceptanceRunId ||
    state.sourceRevision !== bundle.sourceRevision ||
    state.offlineManifestSha256 !== offlineManifestSha256
  )) throw new Error('live-acceptance: state does not match the frozen bundle/source');

  const completed = state?.completed ?? [];
  validateCompletedArtifacts(taskRoot, completed, prepared.pair.id);
  const expected = ORDER[completed.length];
  if (expected === undefined) throw new Error('live-acceptance: all legs are already complete');
  if (leg !== expected) throw new Error(`live-acceptance: next leg is '${expected}', not '${leg}'`);
  const priorIds = completed.flatMap((item) => item.logicalCallIds);
  const validateJournal = deps.validateJournal ?? ((runId, authHash, authBasis, ids, required) =>
    defaultValidateJournal(journalPath, runId, authHash, authBasis, ids, required, taskRoot));
  validateJournal(bundle.acceptanceRunId, authorizationHash, authorization.authorizationBasis, priorIds, completed.length > 0);

  const router = (deps.routerFactory ?? defaultRouterFactory)(leg, bundle.acceptanceRunId, authorization);
  const edgesDir = runtimeDir(taskRoot, bundle.acceptanceRunId, leg);
  assertCanonicalDirectory(taskRoot, edgesDir, true);
  for (const basename of leg === 'agnes-verification'
    ? ['verifications.jsonl', 'verification-raw.jsonl']
    : ['claims.jsonl', 'synthesis-raw.jsonl']) {
    assertSafeWriteTarget(taskRoot, resolve(edgesDir, basename), `${leg} artifact target`);
  }
  let completedLeg: CompletedLeg;

  if (leg === 'anthropic-synthesis' || leg === 'openai-synthesis') {
    const result = await synthesize({
      pairs: [prepared.pair],
      paperUids: bundle.paperUids,
      textLoader: async (paperUid) => prepared.texts.get(paperUid) ?? null,
      paperMetadata: prepared.paperMetadata,
      router,
      edgesDir,
      activeMetricKeys: new Set(bundle.pair),
      acceptance: { acceptanceRunId: bundle.acceptanceRunId, authorization },
      logicalCallScope: leg,
      maxAttempts: 3,
      now,
    });
    const logicalCallId = logicalCallIdSha256(leg, prepared.pair.id);
    validateJournal(bundle.acceptanceRunId, authorizationHash, authorization.authorizationBasis, [...priorIds, logicalCallId], true);
    if (result.evidence === undefined) throw new Error('live-acceptance: synthesis raw sidecar was not written');
    const claimsPath = result.write?.path ?? null;
    completedLeg = {
      leg,
      logicalCallIds: [logicalCallId],
      acceptedClaims: result.accepted.length,
      primaryArtifactPath: claimsPath === null ? null : relativeRuntimePath(taskRoot, claimsPath),
      primaryArtifactSha256: claimsPath === null ? null : hashArtifact(taskRoot, claimsPath, 'claims artifact'),
      rawSidecarPath: relativeRuntimePath(taskRoot, result.evidence.path),
      rawSidecarSha256: hashArtifact(taskRoot, result.evidence.path, 'synthesis raw sidecar'),
      providerIdentity: requireProviderIdentity(leg, result.outcomes.map((outcome) => outcome.response?.modelIdentity)),
      completedAt: new Date(now()).toISOString(),
    };
  } else {
    const source = completed.find((item) => item.leg === 'openai-synthesis');
    if (source?.acceptedClaims === 0 || source?.primaryArtifactPath === null || source === undefined) {
      throw new Error('live-acceptance: OpenAI synthesis produced no quote-valid claim for Agnes');
    }
    const claimsPath = absoluteRuntimePath(taskRoot, source.primaryArtifactPath);
    if (hashArtifact(taskRoot, claimsPath, 'OpenAI claims artifact') !== source.primaryArtifactSha256) {
      throw new Error('live-acceptance: OpenAI claims artifact drift');
    }
    assertOrdinaryTaskFile(taskRoot, claimsPath, 'OpenAI claims artifact');
    const claims = loadClaimsFromFile(claimsPath);
    const result = await verify({
      claims,
      edgesDir,
      router,
      verifierModel: `config:${router.config.nodes.verifier.model}`,
      artifactRevision: bundle.artifactRevision,
      texts: prepared.texts,
      retrieve: { corpus: prepared.corpus },
      acceptance: { acceptanceRunId: bundle.acceptanceRunId, authorization },
      maxAttempts: 2,
      now,
    });
    // #307 · the SHARED derivation. This was the fourth copy of the edgeId-only formula, and the one
    // that produced `journal logical-call set is not exactly represented by state` once the other
    // three moved: the journal held paper-discriminated ids while this expectation was still built
    // from edgeIds alone.
    const logicalCallIds = claims.map((claim) => verifierLogicalCallId(claim));
    validateJournal(bundle.acceptanceRunId, authorizationHash, authorization.authorizationBasis, [...priorIds, ...logicalCallIds], true);
    if (result.write?.raw === undefined) throw new Error('live-acceptance: Agnes raw sidecar was not written');
    completedLeg = {
      leg,
      logicalCallIds,
      acceptedClaims: result.records.length,
      primaryArtifactPath: relativeRuntimePath(taskRoot, result.write.path),
      primaryArtifactSha256: hashArtifact(taskRoot, result.write.path, 'verification artifact'),
      rawSidecarPath: relativeRuntimePath(taskRoot, result.write.raw.path),
      rawSidecarSha256: hashArtifact(taskRoot, result.write.raw.path, 'verification raw sidecar'),
      providerIdentity: requireProviderIdentity(leg, result.results.map((item) => item.response?.modelIdentity)),
      completedAt: new Date(now()).toISOString(),
    };
  }

  const nextState: LiveAcceptanceState = {
    version: 2,
    authorizationId: authorization.authorizationId,
    authorizationBasis: authorization.authorizationBasis,
    authorizationHash,
    acceptanceRunId: bundle.acceptanceRunId,
    sourceRevision: bundle.sourceRevision,
    offlineManifestSha256,
    completed: [...completed, completedLeg],
  };
  const finalGit = snapshot();
  if (finalGit.head !== bundle.sourceRevision) throw new Error('live-acceptance: source revision drift before state finalization');
  if (finalGit.dirty.length > 0) {
    throw new Error(`live-acceptance: dirty worktree before state finalization (${finalGit.dirty[0]})`);
  }
  writeState(taskRoot, statePath, nextState);
  return {
    schema: 'ourobion.live-acceptance.v1',
    acceptanceRunId: bundle.acceptanceRunId,
    leg,
    sourceRevision: bundle.sourceRevision,
    authorizationId: authorization.authorizationId,
    authorizationBasis: authorization.authorizationBasis,
    authorizationHash,
    offlineManifestSha256,
    completedLegs: nextState.completed.map((item) => item.leg),
    providerModel: leg === 'agnes-verification'
      ? router.config.nodes.verifier.model
      : router.config.nodes.synthesis.model,
    acceptedRecords: completedLeg.acceptedClaims,
    providerIdentity: completedLeg.providerIdentity,
    artifacts: {
      primarySha256: completedLeg.primaryArtifactSha256,
      rawSidecarSha256: completedLeg.rawSidecarSha256,
    },
  };
}
