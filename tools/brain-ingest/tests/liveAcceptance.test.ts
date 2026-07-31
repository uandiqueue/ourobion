import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, posix, win32 } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import {
  AttemptJournal,
  ACCEPTANCE_RUNTIME_REPO_ROOT,
  LlmRouter,
  acceptanceAuthorizationHash,
  acceptanceJournalRepoPath,
  loadConfig as loadRouterConfig,
  resolveRepoPath,
  type AcceptanceAuthorization,
  type LlmRequest,
  type LlmResponse,
} from '../../llm-router/src/index.js';
import { main } from '../src/cli.js';
import {
  gitSnapshotAt,
  loadProtectedEnv,
  runLiveAcceptance,
  runtimeRelativeIsContained,
  type LiveAcceptanceLeg,
} from '../src/liveAcceptance.js';
import { testAcceptanceAuthorization } from './acceptanceHelpers.js';

const HEAD = 'a'.repeat(40);
const NOW = Date.parse('2026-07-31T12:00:00.000Z');
const FIXTURE = fileURLToPath(new URL('../fixtures/offline-acceptance-run4/', import.meta.url));

function setup(sourceRevision = HEAD, authorization = testAcceptanceAuthorization()) {
  const dir = mkdtempSync(join(tmpdir(), 'ourobion-live-acceptance-'));
  const corpus = join(dir, 'corpus.jsonl');
  const response = join(dir, 'synthesis-response.json');
  const bundle = join(dir, 'bundle.json');
  writeFileSync(corpus, readFileSync(join(FIXTURE, 'corpus.jsonl')));
  writeFileSync(response, readFileSync(join(FIXTURE, 'synthesis-response.json')));
  writeFileSync(bundle, JSON.stringify({
    acceptanceRunId: 'run4-live-test',
    artifactRevision: 'run4/live-test',
    sourceRevision,
    acceptanceAuthorization: authorization,
    pair: ['gut_comfort_score', 'mood_score'],
    paperUids: ['fixture:run4-cited'],
    corpus: 'corpus.jsonl',
    synthesisResponse: 'synthesis-response.json',
  }));
  const taskRoot = join(dir, ACCEPTANCE_RUNTIME_REPO_ROOT, authorization.authorizationId);
  return {
    dir,
    corpus,
    response,
    bundle,
    authorization,
    taskRoot,
    statePath: join(taskRoot, 'state.json'),
    journalPath: join(dir, acceptanceJournalRepoPath(authorization.authorizationId)),
  };
}

function verifierReply(): string {
  return JSON.stringify({
    verdict: 'supported',
    sourceStances: [{ paperId: 'fixture:run4-independent', stance: 'supports' }],
    directionCheck: { matchesClaim: true },
    claimKindCheck: { matchesClaim: true, supportedKind: 'correlational' },
    scopeCheck: { mismatch: false, supportedPopulation: 'adults' },
    effectSizeCheck: { matchesClaim: true, extractedSize: null },
    evidenceTier: 3,
    confidence: 0.8,
  });
}

function responseFor(leg: LiveAcceptanceLeg): LlmResponse {
  const text = leg === 'agnes-verification'
    ? verifierReply()
    : readFileSync(join(FIXTURE, 'synthesis-response.json'), 'utf8');
  const family = leg === 'anthropic-synthesis'
    ? 'anthropic'
    : leg === 'openai-synthesis' ? 'openai' : 'agnes';
  const model = leg === 'anthropic-synthesis'
    ? 'claude-sonnet-5'
    : leg === 'openai-synthesis' ? 'gpt-5' : 'agnes-2.5-flash';
  const raw = JSON.stringify({ model, output: text });
  return {
    text,
    usage: { inputTokens: 100, outputTokens: 100 },
    model,
    modelIdentity: {
      model,
      source: 'provider-response',
      providerAttested: true,
      family,
      returnedVersion: null,
      decorrelatedFromSynthesis: leg === 'agnes-verification',
    },
    route: 'api_worker',
    rawBody: {
      body: raw,
      bytes: Buffer.byteLength(raw),
      truncated: false,
      capBytes: 262_144,
      sha256: `sha256:${createHash('sha256').update(raw).digest('hex')}`,
    },
  };
}

function providerHttpResponse(leg: LiveAcceptanceLeg): Response {
  const text = leg === 'agnes-verification'
    ? verifierReply()
    : readFileSync(join(FIXTURE, 'synthesis-response.json'), 'utf8');
  const model = leg === 'anthropic-synthesis'
    ? 'claude-sonnet-5'
    : leg === 'openai-synthesis' ? 'gpt-5' : 'agnes-2.5-flash';
  const body = leg === 'anthropic-synthesis'
    ? {
        id: 'msg_test', type: 'message', role: 'assistant', model,
        content: [{ type: 'text', text }],
        usage: { input_tokens: 100, output_tokens: 100 },
      }
    : {
        id: 'chatcmpl_test', model,
        choices: [{ message: { role: 'assistant', content: text } }],
        usage: { prompt_tokens: 100, completion_tokens: 100 },
      };
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function deps(paths: ReturnType<typeof setup>, calls: LlmRequest[]) {
  return {
    statePath: paths.statePath,
    journalPath: paths.journalPath,
    runtimeRoot: paths.dir,
    now: () => NOW,
    gitSnapshot: () => ({ head: JSON.parse(readFileSync(paths.bundle, 'utf8')).sourceRevision as string, dirty: [] }),
    validateJournal: () => {},
    routerFactory: (leg: LiveAcceptanceLeg) => {
      const config = structuredClone(loadRouterConfig());
      config.nodes.synthesis.model = leg === 'anthropic-synthesis' ? 'claude-sonnet-5' : 'gpt-5';
      config.nodes.verifier.model = leg === 'agnes-verification' ? 'agnes-2.5-flash' : 'gpt-5';
      return {
        config,
        async route(request: LlmRequest) {
          calls.push(request);
          return responseFor(leg);
        },
      };
    },
  };
}

function appendJournalAttempt(
  paths: ReturnType<typeof setup>,
  logicalCallId: string,
  terminal = true,
): void {
  mkdirSync(dirname(paths.journalPath), { recursive: true });
  const journal = new AttemptJournal(paths.journalPath, {
    allowedRoot: dirname(paths.journalPath),
    now: () => NOW,
  });
  const authorization = paths.authorization;
  const reservation = journal.reserveAndStart({
    authorization,
    authorizationId: authorization.authorizationId,
    authorizationHash: acceptanceAuthorizationHash(authorization),
    authorizationBasis: authorization.authorizationBasis,
    acceptanceRunId: 'run4-live-test',
    logicalCallId,
    nodeId: 'synthesis',
    providerFamily: 'anthropic',
    model: 'claude-sonnet-5',
    promptHash: `sha256:${'c'.repeat(64)}`,
    inputByteCeiling: 24_000,
    outputTokenCeiling: 3_072,
    reservedUsd: 0.01,
    price: {
      billingMode: 'metered',
      inputUsdPerMTok: 1,
      outputUsdPerMTok: 1,
      provisional: false,
      pricingProvenance: 'live acceptance test fixture',
      effectiveFrom: '2026-01-01T00:00:00.000Z',
      expiresAt: '2027-01-01T00:00:00.000Z',
    },
  });
  if (terminal) journal.record(reservation, 'response');
}

test('real LlmRouter + mocked HTTP completes all three journaled legs and refuses a fourth dispatch', async () => {
  const authorization = testAcceptanceAuthorization((value) => {
    value.authorizationId = 'brain-real-router-proof';
  });
  const paths = setup(HEAD, authorization);
  const repositoryRoot = resolveRepoPath('.');
  const routerRoot = join(repositoryRoot, ACCEPTANCE_RUNTIME_REPO_ROOT);
  const taskRoot = join(routerRoot, authorization.authorizationId);
  const statePath = join(taskRoot, 'state.json');
  const journalPath = join(repositoryRoot, acceptanceJournalRepoPath(authorization.authorizationId));
  const dispatches: Array<{ leg: LiveAcceptanceLeg; url: string; method: string | undefined }> = [];
  rmSync(taskRoot, { recursive: true, force: true });
  const realDeps = {
    runtimeRoot: repositoryRoot,
    now: () => NOW,
    gitSnapshot: () => ({ head: HEAD, dirty: [] }),
    routerFactory: (leg: LiveAcceptanceLeg, runId: string) => {
      const config = structuredClone(loadRouterConfig());
      if (leg === 'anthropic-synthesis') {
        config.nodes.synthesis = { ...config.nodes.synthesis, model: 'claude-sonnet-5', route: 'api_worker' as const };
        config.nodes.verifier = { ...config.nodes.verifier, model: 'gpt-5', route: 'api_worker' as const };
      } else if (leg === 'openai-synthesis') {
        config.nodes.synthesis = { ...config.nodes.synthesis, model: 'gpt-5', route: 'api_worker' as const };
        config.nodes.verifier = { ...config.nodes.verifier, model: 'claude-sonnet-5', route: 'api_worker' as const };
      } else {
        config.nodes.synthesis = { ...config.nodes.synthesis, model: 'gpt-5', route: 'api_worker' as const };
        config.nodes.verifier = { ...config.nodes.verifier, model: 'agnes-2.5-flash', route: 'api_worker' as const };
      }
      return new LlmRouter({
        config,
        runId,
        ledgerPath: join(paths.dir, `${leg}-ledger.json`),
        env: { ANTHROPIC_API_KEY: 'test-anthropic', OPENAI_API_KEY: 'test-openai', AGNES_API_KEY: 'test-agnes' },
        fetchFn: async (url, init) => {
          dispatches.push({ leg, url, method: init.method });
          return providerHttpResponse(leg);
        },
        now: () => NOW,
        sleep: async () => {},
        maxAttempts: 1,
      });
    },
  };
  try {
    await assert.rejects(
      () => runLiveAcceptance(paths.bundle, 'openai-synthesis', realDeps),
      /next leg is 'anthropic-synthesis'/,
    );
    const first = await runLiveAcceptance(paths.bundle, 'anthropic-synthesis', realDeps);
    assert.deepEqual(first.completedLegs, ['anthropic-synthesis']);

    await assert.rejects(
      () => runLiveAcceptance(paths.bundle, 'agnes-verification', realDeps),
      /next leg is 'openai-synthesis'/,
    );
    const second = await runLiveAcceptance(paths.bundle, 'openai-synthesis', realDeps);
    assert.deepEqual(second.completedLegs, ['anthropic-synthesis', 'openai-synthesis']);

    const third = await runLiveAcceptance(paths.bundle, 'agnes-verification', realDeps);
    assert.deepEqual(third.completedLegs, ['anthropic-synthesis', 'openai-synthesis', 'agnes-verification']);
    assert.equal(third.acceptedRecords, 1);
    assert.deepEqual(third.providerIdentity, {
      model: 'agnes-2.5-flash',
      source: 'provider-response',
      providerAttested: true,
      family: 'agnes',
      returnedVersion: null,
      decorrelatedFromSynthesis: true,
    });
    assert.equal(dispatches.length, 3);
    assert.deepEqual(dispatches.map((item) => item.leg), [
      'anthropic-synthesis', 'openai-synthesis', 'agnes-verification',
    ]);
    assert.ok(dispatches.every((item) => item.method === 'POST'));

    const state = JSON.parse(readFileSync(statePath, 'utf8')) as Record<string, any>;
    assert.equal(state.authorizationBasis, paths.authorization.authorizationBasis);
    assert.match(state.offlineManifestSha256, /^sha256:[0-9a-f]{64}$/);
    assert.deepEqual(state.completed[2].providerIdentity, third.providerIdentity);
    assert.ok(state.completed.every((item: Record<string, unknown>) =>
      typeof item.rawSidecarPath === 'string' && !String(item.rawSidecarPath).startsWith('data/')));
    assert.ok(state.completed.every((item: Record<string, unknown>) =>
      typeof item.rawSidecarSha256 === 'string'));

    const events = new AttemptJournal(journalPath, { allowedRoot: routerRoot }).readEvents();
    assert.equal(events.length, 9);
    for (const logicalCallId of new Set(events.map((event) => event.logicalCallId))) {
      const lifecycle = events.filter((event) => event.logicalCallId === logicalCallId);
      assert.deepEqual(lifecycle.map((event) => event.kind), ['reserved', 'started', 'response']);
      assert.equal(lifecycle.filter((event) => ['response', 'failed', 'unknown'].includes(event.kind)).length, 1);
    }
    assert.ok(events.every((event) =>
      event.authorizationHash === acceptanceAuthorizationHash(authorization) &&
      event.authorizationBasis === authorization.authorizationBasis));
    assert.deepEqual(events.slice(-3).map((event) => event.providerFamily), ['agnes', 'agnes', 'agnes']);

    const agnesRawPath = join(taskRoot, state.completed[2].rawSidecarPath as string);
    const agnesRaw = JSON.parse(readFileSync(agnesRawPath, 'utf8').trim()) as Record<string, any>;
    assert.equal(agnesRaw.attested, true);
    assert.equal(agnesRaw.attestedModel, 'agnes-2.5-flash');
    assert.equal(JSON.parse(agnesRaw.raw.body as string).model, 'agnes-2.5-flash');
    assert.equal(
      agnesRaw.raw.sha256,
      `sha256:${createHash('sha256').update(agnesRaw.raw.body as string).digest('hex')}`,
    );
    await assert.rejects(
      () => runLiveAcceptance(paths.bundle, 'agnes-verification', realDeps),
      /all legs are already complete/,
    );
    assert.equal(dispatches.length, 3, 'fourth invocation performs no HTTP dispatch');
  } finally {
    rmSync(taskRoot, { recursive: true, force: true });
    rmSync(paths.dir, { recursive: true, force: true });
  }
});

test('protected env precedence is root then tool-local then explicit process env, with missing files accepted', () => {
  const root = mkdtempSync(join(tmpdir(), 'ourobion-env-'));
  try {
    mkdirSync(join(root, 'tools', 'brain-ingest'), { recursive: true });
    writeFileSync(join(root, '.env'), 'SHARED=root\nROOT_ONLY=root-only\n');
    writeFileSync(join(root, 'tools', 'brain-ingest', '.env'), 'SHARED=tool\nTOOL_ONLY=tool-only\n');
    const loaded = loadProtectedEnv(root, { SHARED: 'process', PROCESS_ONLY: 'process-only', OMITTED: undefined });
    assert.deepEqual(loaded, {
      SHARED: 'process',
      ROOT_ONLY: 'root-only',
      TOOL_ONLY: 'tool-only',
      PROCESS_ONLY: 'process-only',
    });
    rmSync(join(root, '.env'));
    rmSync(join(root, 'tools', 'brain-ingest', '.env'));
    assert.deepEqual(loadProtectedEnv(root, { PROCESS_ONLY: 'process-only' }), { PROCESS_ONLY: 'process-only' });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('runtime containment rejects POSIX, drive-absolute, and parent traversal paths', () => {
  assert.equal(runtimeRelativeIsContained('nested/artifact.jsonl'), true);
  assert.equal(runtimeRelativeIsContained('../escape.jsonl'), false);
  assert.equal(runtimeRelativeIsContained('/absolute/escape', posix.isAbsolute), false);
  assert.equal(runtimeRelativeIsContained('D:\\absolute\\escape', win32.isAbsolute), false);
});

test('completed artifact paths and state overrides cannot enter a sibling authorization root', async () => {
  const paths = setup();
  try {
    await assert.rejects(
      () => runLiveAcceptance(paths.bundle, 'anthropic-synthesis', {
        ...deps(paths, []),
        statePath: join(dirname(paths.taskRoot), 'sibling-authorization', 'state.json'),
      }),
      /state escaped the authorization task root/,
    );

    await runLiveAcceptance(paths.bundle, 'anthropic-synthesis', deps(paths, []));
    const state = JSON.parse(readFileSync(paths.statePath, 'utf8')) as Record<string, any>;
    state.completed[0].rawSidecarPath = '../sibling-authorization/synthesis-raw.jsonl';
    writeFileSync(paths.statePath, `${JSON.stringify(state)}\n`);
    await assert.rejects(
      () => runLiveAcceptance(paths.bundle, 'openai-synthesis', deps(paths, [])),
      /state artifact escaped the authorization task root/,
    );
  } finally {
    rmSync(paths.dir, { recursive: true, force: true });
  }
});

test('a junction in the next leg artifact directory is rejected before dispatch', async (t) => {
  const paths = setup();
  const calls: LlmRequest[] = [];
  const outside = mkdtempSync(join(tmpdir(), 'ourobion-live-junction-target-'));
  const junction = join(paths.taskRoot, 'artifacts', 'run4-live-test', 'openai-synthesis');
  try {
    await runLiveAcceptance(paths.bundle, 'anthropic-synthesis', deps(paths, calls));
    try {
      symlinkSync(outside, junction, process.platform === 'win32' ? 'junction' : 'dir');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EPERM') {
        t.skip('host does not permit creating a junction/symlink');
        return;
      }
      throw error;
    }
    await assert.rejects(
      () => runLiveAcceptance(paths.bundle, 'openai-synthesis', deps(paths, calls)),
      /symlink, junction, or non-canonical directory/,
    );
    assert.equal(calls.length, 1, 'junction is rejected before a second dispatch');
  } finally {
    rmSync(junction, { force: true });
    rmSync(outside, { recursive: true, force: true });
    rmSync(paths.dir, { recursive: true, force: true });
  }
});

test('live facade rejects revision, dirty-tree, frozen-input, state, and journal preexistence drift', async () => {
  const paths = setup();
  const calls: LlmRequest[] = [];
  try {
    await assert.rejects(
      () => runLiveAcceptance(paths.bundle, 'anthropic-synthesis', {
        ...deps(paths, calls), gitSnapshot: () => ({ head: 'b'.repeat(40), dirty: [] }),
      }),
      /source revision drift/,
    );
    await assert.rejects(
      () => runLiveAcceptance(paths.bundle, 'anthropic-synthesis', {
        ...deps(paths, calls), gitSnapshot: () => ({ head: HEAD, dirty: [' M source.ts'] }),
      }),
      /dirty worktree/,
    );

    mkdirSync(dirname(paths.journalPath), { recursive: true });
    writeFileSync(paths.journalPath, 'preexisting\n');
    await assert.rejects(
      () => runLiveAcceptance(paths.bundle, 'anthropic-synthesis', deps(paths, calls)),
      /pre-existing journal without state/,
    );
    rmSync(paths.journalPath);

    await runLiveAcceptance(paths.bundle, 'anthropic-synthesis', deps(paths, calls));
    const state = JSON.parse(readFileSync(paths.statePath, 'utf8')) as Record<string, any>;
    const rawPath = join(paths.taskRoot, state.completed[0].rawSidecarPath as string);
    const rawOriginal = readFileSync(rawPath);
    appendFileSync(rawPath, '\n');
    await assert.rejects(
      () => runLiveAcceptance(paths.bundle, 'openai-synthesis', deps(paths, calls)),
      /anthropic-synthesis raw sidecar drift/,
    );
    writeFileSync(rawPath, rawOriginal);

    appendFileSync(paths.response, '\n');
    await assert.rejects(
      () => runLiveAcceptance(paths.bundle, 'openai-synthesis', deps(paths, calls)),
      /state does not match the frozen bundle/,
    );

    writeFileSync(paths.statePath, '{broken');
    await assert.rejects(
      () => runLiveAcceptance(paths.bundle, 'openai-synthesis', deps(paths, calls)),
      /state is corrupt JSON/,
    );
  } finally {
    rmSync(paths.dir, { recursive: true, force: true });
  }
});

test('crash after provider response without state requires manual reconciliation', async () => {
  const paths = setup();
  try {
    appendJournalAttempt(paths, 'anthropic-synthesis:crash-after-response');
    const normal = deps(paths, []);
    const { validateJournal: _testSeam, ...defaultValidation } = normal;
    await assert.rejects(
      () => runLiveAcceptance(paths.bundle, 'anthropic-synthesis', defaultValidation),
      /pre-existing journal without state; manual reconciliation required/,
    );
  } finally {
    rmSync(paths.dir, { recursive: true, force: true });
  }
});

test('exact journal reconciliation rejects an extra logical id and an incomplete retry of an allowed id', async () => {
  for (const scenario of ['extra-id', 'incomplete-retry'] as const) {
    const paths = setup();
    try {
      await runLiveAcceptance(paths.bundle, 'anthropic-synthesis', deps(paths, []));
      const state = JSON.parse(readFileSync(paths.statePath, 'utf8')) as Record<string, any>;
      const priorId = state.completed[0].logicalCallIds[0] as string;
      appendJournalAttempt(paths, priorId);
      if (scenario === 'extra-id') appendJournalAttempt(paths, 'synthesis:extra-logical-id');
      else appendJournalAttempt(paths, priorId, false);
      const normal = deps(paths, []);
      const { validateJournal: _testSeam, ...defaultValidation } = normal;
      await assert.rejects(
        () => runLiveAcceptance(paths.bundle, 'openai-synthesis', defaultValidation),
        scenario === 'extra-id' ? /logical-call set is not exactly represented/ : /lacks exactly one terminal outcome/,
      );
    } finally {
      rmSync(paths.dir, { recursive: true, force: true });
    }
  }
});

test('a final exact-head/dirty recheck happens before state write', async () => {
  const paths = setup();
  let snapshots = 0;
  try {
    await assert.rejects(
      () => runLiveAcceptance(paths.bundle, 'anthropic-synthesis', {
        ...deps(paths, []),
        gitSnapshot: () => ({ head: HEAD, dirty: snapshots++ === 0 ? [] : [' M changed-during-call.ts'] }),
      }),
      /dirty worktree before state finalization/,
    );
    assert.equal(existsSync(paths.statePath), false);
  } finally {
    rmSync(paths.dir, { recursive: true, force: true });
  }
});

test('exact live-acceptance ignore keeps a real Git worktree clean through leg two', async () => {
  const repo = mkdtempSync(join(tmpdir(), 'ourobion-live-git-'));
  const paths = setup();
  try {
    writeFileSync(join(repo, '.gitignore'), 'data/brain-ingest/live-acceptance/\n');
    execFileSync('git', ['init'], { cwd: repo });
    execFileSync('git', ['config', 'user.email', 'test@ourobion.invalid'], { cwd: repo });
    execFileSync('git', ['config', 'user.name', 'Ourobion Test'], { cwd: repo });
    execFileSync('git', ['add', '.gitignore'], { cwd: repo });
    execFileSync('git', ['commit', '-m', 'test: freeze live acceptance root'], { cwd: repo });
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim();
    const frozen = JSON.parse(readFileSync(paths.bundle, 'utf8')) as Record<string, unknown>;
    frozen.sourceRevision = head;
    writeFileSync(paths.bundle, JSON.stringify(frozen));
    const base = deps(paths, []);
    const realDeps = {
      ...base,
      runtimeRoot: repo,
      gitSnapshot: () => gitSnapshotAt(repo),
      statePath: undefined,
      journalPath: undefined,
    };
    await runLiveAcceptance(paths.bundle, 'anthropic-synthesis', realDeps);
    assert.deepEqual(gitSnapshotAt(repo), { head, dirty: [] });
    await runLiveAcceptance(paths.bundle, 'openai-synthesis', realDeps);
    assert.deepEqual(gitSnapshotAt(repo), { head, dirty: [] });
  } finally {
    rmSync(repo, { recursive: true, force: true });
    rmSync(paths.dir, { recursive: true, force: true });
  }
});

test('live CLI cannot dispatch without explicit --execute', async () => {
  const paths = setup();
  try {
    assert.equal(await main(['live-acceptance', '--bundle', paths.bundle, '--leg', 'anthropic-synthesis']), 2);
  } finally {
    rmSync(paths.dir, { recursive: true, force: true });
  }
});
