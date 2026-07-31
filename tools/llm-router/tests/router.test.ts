/**
 * Router facade tests: config-driven dispatch to both routes, pre-call budget
 * enforcement (denied BEFORE any dispatch), usage recording into the ledger,
 * per-request maxOutputTokens override, and the checkConfig operator report.
 * Mocked fetch + temp dirs — NO network, NO keys.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { checkConfig, LlmRouter } from '../src/router.js';
import { resolveRepoPath } from '../src/config.js';
import { acceptanceJournalRepoPath, providerContentSha256 } from '../src/attemptJournal.js';
import { costUsd } from '../src/budget.js';
import { RouterAttemptJournalError, RouterBudgetExceededError, RouterHttpError } from '../src/errors.js';
import {
  AGNES_CHAT_COMPLETIONS_URL,
  canonicalizeProviderContent,
  type FetchLike,
} from '../src/routes/apiWorker.js';
import { ACCEPTANCE_RUNTIME_REPO_ROOT, DEFAULT_RAW_BODY_CAP_BYTES } from '../src/types.js';
import { acceptanceContext, anthropicBody, jsonResponse, openaiBody, testAuthorization, testConfig } from './helpers.js';

const ENV = { ANTHROPIC_API_KEY: 'ak', OPENAI_API_KEY: 'ok' };
const DAY1_NOON = Date.UTC(2026, 6, 15, 12, 0, 0);

function freshDir(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

const AUTHORIZATION = testAuthorization();
const ACCEPTANCE_JOURNAL = resolveRepoPath(acceptanceJournalRepoPath(AUTHORIZATION.authorizationId));
const acceptance = (runId: string, logicalCallId: string) =>
  acceptanceContext(runId, logicalCallId, AUTHORIZATION);
function cleanAcceptanceJournal(): void {
  rmSync(ACCEPTANCE_JOURNAL, { force: true });
  rmSync(`${ACCEPTANCE_JOURNAL}.lock`, { force: true });
}

function acceptanceConfig() {
  return testConfig((raw) => {
    raw.providers.push({ prefix: 'agnes-', family: 'agnes', envKey: 'AGNES_API_KEY' });
    raw.acceptance = { runtimeRoot: ACCEPTANCE_RUNTIME_REPO_ROOT };
    raw.nodes.synthesis = { model: 'claude-sonnet-5', route: 'api_worker', maxOutputTokens: 8000 };
    raw.nodes.verifier = { model: 'agnes-2.5-flash', route: 'api_worker', maxOutputTokens: 8000 };
    raw.prices['claude-sonnet-5'].provisional = false;
    raw.prices['agnes-2.5-flash'] = {
      inputUsdPerMTok: 0,
      outputUsdPerMTok: 0,
      billingMode: 'free',
      pricingProvenance: 'owner-confirmed free plan',
      effectiveFrom: '2026-01-01T00:00:00.000Z',
      expiresAt: '2027-01-01T00:00:00.000Z',
      provisional: false,
    };
    raw.budget.perDayUsdPerNode = 100;
    raw.budget.perRunOutputTokens = 1_000_000;
  });
}

function agnesBody(text: string, promptTokens = 100, completionTokens = 50): unknown {
  return {
    id: 'agnes_test',
    object: 'chat.completion',
    model: 'agnes-2.5-flash',
    choices: [{ index: 0, message: { role: 'assistant', content: text }, finish_reason: 'stop' }],
    usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens },
  };
}

test('api_worker dispatch: resolves node model/route from config, records usage', async () => {
  const dir = freshDir('llm-router-');
  try {
    const calls: Array<{ url: string; body: any }> = []; // eslint-disable-line @typescript-eslint/no-explicit-any
    const fetchFn: FetchLike = async (url, init) => {
      calls.push({ url, body: JSON.parse(String(init.body)) });
      return jsonResponse(200, anthropicBody('synthesised', 111, 222));
    };
    const router = new LlmRouter({
      config: testConfig(),
      runId: 'run-facade',
      ledgerPath: join(dir, 'ledger.json'),
      env: ENV,
      fetchFn,
      now: () => DAY1_NOON,
    });

    const res = await router.route({ nodeId: 'synthesis', prompt: 'claims please' });

    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.body.model, 'claude-sonnet-5', 'model comes from config, not the caller');
    assert.equal(calls[0]!.body.max_tokens, 8000, "node's configured maxOutputTokens is the default ceiling");
    assert.equal(res.route, 'api_worker');
    assert.deepEqual(res.usage, { inputTokens: 111, outputTokens: 222 });

    // Actual usage landed in the ledger under the node + run.
    const state = router.budgetState();
    assert.equal(state.nodes.synthesis?.calls, 1);
    assert.equal(state.nodes.synthesis?.outputTokens, 222);
    assert.equal(state.runs['run-facade']?.outputTokens, 222);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('per-request maxOutputTokens overrides the node default', async () => {
  const dir = freshDir('llm-router-');
  try {
    const bodies: any[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any
    const fetchFn: FetchLike = async (_url, init) => {
      bodies.push(JSON.parse(String(init.body)));
      return jsonResponse(200, anthropicBody('x'));
    };
    const router = new LlmRouter({
      config: testConfig(),
      runId: 'run-max',
      ledgerPath: join(dir, 'ledger.json'),
      env: ENV,
      fetchFn,
      now: () => DAY1_NOON,
    });
    await router.route({ nodeId: 'synthesis', prompt: 'short one', maxOutputTokens: 123 });
    assert.equal(bodies[0].max_tokens, 123);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('acceptance facade: canonical messages are exactly bounded/hashed and Agnes uses its exact POST wire', async () => {
  const dir = freshDir('llm-acceptance-');
  cleanAcceptanceJournal();
  try {
    const calls: Array<{ url: string; method: string | undefined; body: any }> = []; // eslint-disable-line @typescript-eslint/no-explicit-any
    const fetchFn: FetchLike = async (url, init) => {
      calls.push({ url, method: init.method, body: JSON.parse(String(init.body)) });
      return url === AGNES_CHAT_COMPLETIONS_URL
        ? jsonResponse(200, agnesBody('{"verdict":"unsupported"}'))
        : jsonResponse(200, anthropicBody('{"claims":[]}'));
    };
    const router = new LlmRouter({
      config: acceptanceConfig(),
      ledgerPath: join(dir, 'ledger.json'),
      env: { ANTHROPIC_API_KEY: 'ak', AGNES_API_KEY: 'agk' },
      fetchFn,
      now: () => DAY1_NOON,
    });
    const acceptanceCall = acceptance('acceptance-facade', 'synthesis:edge-1');
    const baseline = canonicalizeProviderContent(
      { nodeId: 'synthesis', prompt: '', expectJson: true },
      'anthropic',
    );
    const prompt = 'x'.repeat(24_000 - baseline.inputBytes);
    const exactReq = { nodeId: 'synthesis' as const, prompt, expectJson: true as const, acceptance: acceptanceCall };
    const canonical = canonicalizeProviderContent(exactReq, 'anthropic');
    assert.equal(canonical.inputBytes, 24_000);
    await router.route(exactReq);
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.method, 'POST');
    assert.equal(calls[0]!.body.max_tokens, 3_072);
    assert.equal(calls.some((call) => /\/models(?:\?|$)/.test(call.url)), false);
    assert.deepEqual(
      calls[0]!.body.messages,
      canonical.messages.filter((message) => message.role === 'user'),
    );
    assert.equal(calls[0]!.body.system, canonical.system);

    await router.route({
      nodeId: 'verifier',
      system: 'Adversarially verify.',
      prompt: 'Evidence may refute this.',
      expectJson: true,
      acceptance: acceptance('acceptance-second-run', 'verifier:edge-1'),
    });
    assert.equal(calls[1]!.url, AGNES_CHAT_COMPLETIONS_URL);
    assert.equal(calls[1]!.method, 'POST');
    assert.equal(calls[1]!.body.max_tokens, 3_072);
    assert.equal('response_format' in calls[1]!.body, false);
    assert.match(calls[1]!.body.messages[0].content, /single valid JSON object/);

    await assert.rejects(
      router.route({ nodeId: 'synthesis', prompt: 'x', expectJson: true, maxOutputTokens: 3_073, acceptance: acceptance('acceptance-facade', 'synthesis:edge-2') }),
      /maxOutputTokens is fixed at 3072/,
    );
    await assert.rejects(
      router.route({ nodeId: 'synthesis', prompt: `${prompt}x`, expectJson: true, acceptance: acceptance('acceptance-facade', 'synthesis:edge-3') }),
      /ceiling is 24000/,
    );
    assert.equal(calls.length, 2, 'both ceiling violations stop before dispatch');
    const events = readFileSync(ACCEPTANCE_JOURNAL, 'utf8')
      .trim().split(/\r?\n/).map((line) => JSON.parse(line) as Record<string, unknown>);
    const reservations = events.filter((event) => event.kind === 'reserved');
    assert.equal(reservations.length, 2);
    assert.equal(reservations[0]!.promptHash, providerContentSha256(canonical.serialized));
    assert.equal(
      reservations[0]!.reservedUsd,
      costUsd(acceptanceConfig(), 'claude-sonnet-5', {
        inputTokens: canonical.inputBytes,
        outputTokens: 3_072,
      }),
      'the exact 24,000-byte canonical unit is conservatively reserved at one token per byte',
    );
    assert.deepEqual(
      new Set(reservations.map((event) => event.acceptanceRunId)),
      new Set(['acceptance-facade', 'acceptance-second-run']),
      'distinct acceptance runs share one journal and one global exposure total',
    );
    assert.equal(reservations[1]!.reservedUsd, 0);
    assert.deepEqual(reservations[1]!.price, {
      billingMode: 'free',
      inputUsdPerMTok: 0,
      outputUsdPerMTok: 0,
      provisional: false,
      pricingProvenance: 'owner-confirmed free plan',
      effectiveFrom: '2026-01-01T00:00:00.000Z',
      expiresAt: '2027-01-01T00:00:00.000Z',
    });
  } finally {
    cleanAcceptanceJournal();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('acceptance facade: provisional pricing and provider-identity mismatch fail closed', async () => {
  const dir = freshDir('llm-acceptance-');
  cleanAcceptanceJournal();
  try {
    let calls = 0;
    const provisional = acceptanceConfig();
    provisional.prices['claude-sonnet-5']!.provisional = true;
    const provisionalRouter = new LlmRouter({
      config: provisional,
      ledgerPath: join(dir, 'provisional-ledger.json'),
      env: { ANTHROPIC_API_KEY: 'ak' },
      fetchFn: async () => { calls++; return jsonResponse(200, anthropicBody('{}')); },
    });
    await assert.rejects(
      provisionalRouter.route({
        nodeId: 'synthesis',
        prompt: 'x',
        expectJson: true,
        acceptance: acceptance('run-p', 'synthesis:p'),
      }),
      /lacks an authoritative non-provisional price/,
    );
    assert.equal(calls, 0);

    const expiredRouter = new LlmRouter({
      config: acceptanceConfig(),
      ledgerPath: join(dir, 'expired-ledger.json'),
      env: { ANTHROPIC_API_KEY: 'ak' },
      now: () => Date.parse('2027-01-01T00:00:00.000Z'),
      fetchFn: async () => { calls++; return jsonResponse(200, anthropicBody('{}')); },
    });
    await assert.rejects(
      expiredRouter.route({
        nodeId: 'synthesis',
        prompt: 'x',
        expectJson: true,
        acceptance: acceptanceContext(
          'run-expired',
          'synthesis:expired',
          testAuthorization((value) => { value.expiresAt = '2028-01-01T00:00:00.000Z'; }),
        ),
      }),
      /lacks an authoritative non-provisional price/,
    );
    assert.equal(calls, 0);

    const mismatchRouter = new LlmRouter({
      config: acceptanceConfig(),
      ledgerPath: join(dir, 'mismatch-ledger.json'),
      env: { AGNES_API_KEY: 'agk' },
      fetchFn: async () => {
        calls++;
        const body = agnesBody('{"verdict":"unsupported"}') as Record<string, unknown>;
        return jsonResponse(200, { ...body, model: 'gpt-5' });
      },
    });
    await assert.rejects(
      mismatchRouter.route({
        nodeId: 'verifier',
        prompt: 'adverse is valid',
        expectJson: true,
        acceptance: acceptance('run-m', 'verifier:m'),
      }),
      (error: unknown) => error instanceof RouterAttemptJournalError && /mismatched/.test(error.message),
    );
    assert.equal(calls, 1);
  } finally {
    cleanAcceptanceJournal();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('acceptance facade: OpenAI synthesis is provider-attested and hash-journaled', async () => {
  const dir = freshDir('llm-openai-acceptance-');
  cleanAcceptanceJournal();
  try {
    const config = testConfig((raw) => {
      raw.acceptance = { runtimeRoot: ACCEPTANCE_RUNTIME_REPO_ROOT };
      raw.nodes.synthesis = { model: 'gpt-5', route: 'api_worker', maxOutputTokens: 8000 };
      raw.nodes.verifier = { model: 'claude-sonnet-5', route: 'api_worker', maxOutputTokens: 8000 };
      raw.prices['gpt-5'].provisional = false;
      raw.budget.perDayUsdPerNode = 100;
      raw.budget.perRunOutputTokens = 1_000_000;
    });
    let calls = 0;
    const router = new LlmRouter({
      config,
      ledgerPath: join(dir, 'ledger.json'),
      env: { OPENAI_API_KEY: 'ok' },
      now: () => Date.parse('2026-07-31T12:00:00.000Z'),
      fetchFn: async () => {
        calls++;
        return jsonResponse(200, openaiBody('{"claims":[]}'));
      },
    });
    const response = await router.route({
      nodeId: 'synthesis',
      prompt: 'adverse-empty is valid',
      expectJson: true,
      acceptance: acceptance('run-openai', 'openai-synthesis:edge'),
    });
    assert.equal(calls, 1);
    assert.equal(response.modelIdentity.family, 'openai');
    assert.equal(response.modelIdentity.providerAttested, true);
    assert.ok(response.rawBody && !response.rawBody.truncated);
    const events = readFileSync(ACCEPTANCE_JOURNAL, 'utf8')
      .trim().split(/\r?\n/).map((line) => JSON.parse(line) as Record<string, unknown>);
    assert.ok(events.some((event) => event.kind === 'reserved' && event.providerFamily === 'openai'));
    assert.ok(events.some((event) => event.kind === 'response'));
  } finally {
    cleanAcceptanceJournal();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('acceptance facade rejects caller paths and unsafe raw retention before reservation/fetch', async () => {
  const dir = freshDir('llm-acceptance-options-');
  cleanAcceptanceJournal();
  try {
    let calls = 0;
    const base = {
      config: acceptanceConfig(),
      ledgerPath: join(dir, 'ledger.json'),
      env: { ANTHROPIC_API_KEY: 'ak' },
      fetchFn: async () => { calls++; return jsonResponse(200, anthropicBody('{}')); },
    };
    for (const journalPath of ['../escape.jsonl', 'tools/llm-router/src/router.ts', join(dir, 'fresh.jsonl')]) {
      const router = new LlmRouter(base);
      await assert.rejects(
        router.route({
          nodeId: 'synthesis',
          prompt: 'x',
          expectJson: true,
          acceptance: {
            ...acceptance('run', 'synthesis:path'),
            acceptanceRunId: 'run',
            logicalCallId: 'synthesis:path',
            journalPath,
          } as never,
        }),
        /cannot select or override/,
      );
    }
    for (const options of [
      { retainRawBody: false },
      { rawBodyCapBytes: DEFAULT_RAW_BODY_CAP_BYTES - 1 },
    ]) {
      const router = new LlmRouter({ ...base, ...options });
      await assert.rejects(
        router.route({
          nodeId: 'synthesis',
          prompt: 'x',
          expectJson: true,
          acceptance: acceptance('run', 'synthesis:retention'),
        }),
        /retention cannot be disabled|raw body cap is fixed/,
      );
    }
    const unboundRouter = new LlmRouter({ ...base, config: testConfig() });
    await assert.rejects(
      unboundRouter.route({
        nodeId: 'synthesis',
        prompt: 'x',
        expectJson: true,
        acceptance: acceptance('run', 'synthesis:unbound-config'),
      }),
      /config must bind the fixed router-owned runtime root/,
    );
    assert.equal(calls, 0);
    assert.throws(() => readFileSync(ACCEPTANCE_JOURNAL), /ENOENT/);
  } finally {
    cleanAcceptanceJournal();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('LlmRouter validates and clones injected config before any acceptance dispatch', () => {
  let calls = 0;
  const baseOptions = {
    env: { ANTHROPIC_API_KEY: 'ak' },
    fetchFn: async () => { calls++; return jsonResponse(200, anthropicBody('{}')); },
  };
  const badPath = acceptanceConfig() as unknown as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  badPath.acceptance.runtimeRoot = 'tools/llm-router/src/router.ts';
  assert.throws(
    () => new LlmRouter({ ...baseOptions, config: badPath as never }),
    /acceptance\.runtimeRoot must be exactly/,
  );
  const badPrice = acceptanceConfig() as unknown as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  badPrice.prices['claude-sonnet-5'].inputUsdPerMTok = -1;
  assert.throws(
    () => new LlmRouter({ ...baseOptions, config: badPrice as never }),
    /must carry positive inputUsdPerMTok\/outputUsdPerMTok/,
  );
  assert.equal(calls, 0);

  const original = acceptanceConfig();
  const router = new LlmRouter({ ...baseOptions, config: original });
  (original.acceptance as unknown as { runtimeRoot: string }).runtimeRoot = '../mutated-after-construction';
  assert.equal(router.config.acceptance?.runtimeRoot, ACCEPTANCE_RUNTIME_REPO_ROOT);
});

test('acceptance response-stream failure stays charged, records unknown, and redacts secrets', async () => {
  const dir = freshDir('llm-acceptance-stream-');
  cleanAcceptanceJournal();
  try {
    const secretPrompt = 'PROMPT_MUST_NOT_ESCAPE';
    const secretKey = 'KEY_MUST_NOT_ESCAPE';
    const router = new LlmRouter({
      config: acceptanceConfig(),
      ledgerPath: join(dir, 'ledger.json'),
      env: { ANTHROPIC_API_KEY: secretKey },
      maxAttempts: 1,
      fetchFn: async () => ({
        ok: true,
        status: 200,
        text: async () => { throw new Error(`stream failed ${secretPrompt} ${secretKey}`); },
      } as unknown as Response),
    });
    let caught: RouterHttpError | undefined;
    try {
      await router.route({
        nodeId: 'synthesis',
        prompt: secretPrompt,
        expectJson: true,
        acceptance: acceptance('stream-run', 'synthesis:stream'),
      });
    } catch (error) {
      assert.ok(error instanceof RouterHttpError);
      caught = error;
    }
    assert.ok(caught !== undefined);
    assert.doesNotMatch(caught.message, /PROMPT_MUST_NOT_ESCAPE|KEY_MUST_NOT_ESCAPE/);
    assert.doesNotMatch(caught.body, /PROMPT_MUST_NOT_ESCAPE|KEY_MUST_NOT_ESCAPE/);
    const events = readFileSync(ACCEPTANCE_JOURNAL, 'utf8')
      .trim().split(/\r?\n/).map((line) => JSON.parse(line) as { kind: string; errorClass?: string });
    assert.deepEqual(events.map((event) => event.kind), ['reserved', 'started', 'unknown']);
    assert.equal(events[2]!.errorClass, 'ResponseBodyReadError');
  } finally {
    cleanAcceptanceJournal();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('local_agent dispatch: goes through the mailbox, records estimated usage', async () => {
  const dir = freshDir('llm-router-');
  const mailboxDir = freshDir('llm-mailbox-');
  try {
    // Injected sleep plays the fulfilling agent session.
    const sleep = async (): Promise<void> => {
      const reqFile = readdirSync(mailboxDir).find((f) => f.endsWith('.request.json'));
      assert.ok(reqFile !== undefined, 'a request file must appear in the mailbox');
      const id = reqFile.replace('.request.json', '');
      writeFileSync(
        join(mailboxDir, `${id}.response.json`),
        JSON.stringify({ id, status: 'ok', text: 'seeded queries' }),
        'utf8',
      );
    };
    const router = new LlmRouter({
      config: testConfig(), // seeder is routed local_agent in the test config
      runId: 'run-mailbox',
      ledgerPath: join(dir, 'ledger.json'),
      mailboxDir,
      sleep,
      localAgentPollIntervalMs: 1,
      localAgentTimeoutMs: 5000,
      env: {}, // NO keys anywhere — the keyless route must work
    });

    const res = await router.route({ nodeId: 'seeder', prompt: 'seed hrv queries' });
    assert.equal(res.route, 'local_agent');
    assert.equal(res.text, 'seeded queries');
    assert.ok(res.usage.outputTokens > 0, 'estimated usage still feeds the ledger');
    assert.equal(router.budgetState().nodes.seeder?.calls, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(mailboxDir, { recursive: true, force: true });
  }
});

test('budget hard stop: the call is denied BEFORE any dispatch', async () => {
  const dir = freshDir('llm-router-');
  try {
    let fetched = 0;
    const fetchFn: FetchLike = async () => {
      fetched += 1;
      return jsonResponse(200, anthropicBody('should never happen'));
    };
    const config = testConfig((raw) => {
      raw.budget.perDayUsdPerNode = 0.01; // hard stop $0.0095
    });
    const router = new LlmRouter({
      config,
      runId: 'run-broke',
      ledgerPath: join(dir, 'ledger.json'),
      env: ENV,
      fetchFn,
      now: () => DAY1_NOON,
    });

    // Worst case for synthesis: 8000 output tokens × $15/M = $0.12 ≥ $0.0095.
    await assert.rejects(
      router.route({ nodeId: 'synthesis', prompt: 'expensive' }),
      (err: unknown) => err instanceof RouterBudgetExceededError && err.cap === 'day_usd',
    );
    assert.equal(fetched, 0, 'no dispatch happened after the budget denial');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('run-token hard stop across sequential calls on the same runId', async () => {
  const dir = freshDir('llm-router-');
  try {
    const fetchFn: FetchLike = async () =>
      jsonResponse(200, anthropicBody('big answer', 10, 100_000));
    const config = testConfig((raw) => {
      raw.budget.perDayUsdPerNode = 1_000_000; // USD cap out of the way
    });
    const router = new LlmRouter({
      config,
      runId: 'run-tokens',
      ledgerPath: join(dir, 'ledger.json'),
      env: ENV,
      fetchFn,
      now: () => DAY1_NOON,
    });

    // Two calls land 200k actual output tokens on the run (100k each).
    await router.route({ nodeId: 'synthesis', prompt: 'p1' });
    assert.equal(router.budgetState().runs['run-tokens']?.outputTokens, 100_000);
    // Next pre-check: 100k spent + 8k worst case < 190k — allowed; lands 200k.
    await router.route({ nodeId: 'synthesis', prompt: 'p2' });
    // Now 200k ≥ 190k hard stop before adding anything — third call refused.
    await assert.rejects(
      router.route({ nodeId: 'synthesis', prompt: 'p3' }),
      (err: unknown) => err instanceof RouterBudgetExceededError && err.cap === 'run_tokens',
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('checkConfig: report carries models, families, decorrelation, keys y/n, budget', () => {
  const dir = freshDir('llm-router-');
  try {
    const report = checkConfig({
      config: testConfig(),
      env: { ANTHROPIC_API_KEY: 'present', OPENAI_API_KEY: undefined },
      ledgerPath: join(dir, 'ledger.json'),
      now: () => DAY1_NOON,
    });

    assert.equal(report.nodes.length, 6);
    const verifier = report.nodes.find((n) => n.nodeId === 'verifier')!;
    assert.equal(verifier.model, 'gpt-5');
    assert.equal(verifier.family, 'openai');
    assert.equal(verifier.keyEnvVar, 'OPENAI_API_KEY');
    assert.equal(verifier.keyPresent, false, 'no key on this machine → reported, not fatal');
    assert.equal(verifier.priceProvisional, true);

    const synthesis = report.nodes.find((n) => n.nodeId === 'synthesis')!;
    assert.equal(synthesis.keyPresent, true);

    assert.equal(report.decorrelation.ok, true);
    assert.equal(report.decorrelation.synthesisFamily, 'anthropic');
    assert.equal(report.decorrelation.verifierFamily, 'openai');
    assert.equal(report.keys.ANTHROPIC_API_KEY, true);
    assert.equal(report.keys.OPENAI_API_KEY, false);
    assert.equal(report.keys.GOOGLE_API_KEY, false);
    assert.equal(report.budget.perDayUsdPerNode, 5);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('constructing a router requires NO keys and NO network (keyless import guarantee)', () => {
  const dir = freshDir('llm-router-');
  try {
    const router = new LlmRouter({
      config: testConfig(),
      ledgerPath: join(dir, 'ledger.json'),
      env: {},
      now: () => DAY1_NOON,
    });
    assert.ok(router.runId.length > 0, 'a runId is generated when not supplied');
    assert.equal(router.budgetState().nodes.synthesis, undefined);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
