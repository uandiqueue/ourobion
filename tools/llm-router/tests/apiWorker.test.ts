/**
 * API-worker adapter tests — mocked fetch, NO network, NO real keys.
 * Proves: request wire shapes for both vendors, 429 retry w/ backoff, 5xx
 * retry exhaustion, non-retryable 400, typed key-missing before any fetch,
 * and the google-family "no adapter" guard.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, rmSync } from 'node:fs';

import {
  ANTHROPIC_MESSAGES_URL,
  ANTHROPIC_VERSION,
  callApiWorker,
  canonicalizeProviderContent,
  OPENAI_CHAT_COMPLETIONS_URL,
  type FetchLike,
} from '../src/routes/apiWorker.js';
import { RouterConfigError, RouterHttpError, RouterKeyMissingError } from '../src/errors.js';
import { AttemptJournal, acceptanceJournalRepoPath, providerContentSha256 } from '../src/attemptJournal.js';
import { resolveRepoPath } from '../src/config.js';
import {
  ACCEPTANCE_RUNTIME_REPO_ROOT,
  ACCEPTANCE_MAX_INPUT_BYTES,
  ACCEPTANCE_MAX_OUTPUT_TOKENS,
} from '../src/types.js';
import type { LlmRequest } from '../src/types.js';
import {
  acceptanceContext,
  anthropicBody,
  authorizationBinding,
  jsonResponse,
  openaiBody,
  testAuthorization,
  testConfig,
} from './helpers.js';

interface RecordedCall {
  url: string;
  headers: Record<string, string>;
  body: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

/** Mock fetch returning queued responses; records every call. */
function mockFetch(responses: Response[]): { fetchFn: FetchLike; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  const queue = [...responses];
  const fetchFn: FetchLike = async (url, init) => {
    calls.push({
      url,
      headers: (init.headers ?? {}) as Record<string, string>,
      body: JSON.parse(String(init.body)),
    });
    const next = queue.shift();
    if (next === undefined) throw new Error('mockFetch: no more queued responses');
    return next;
  };
  return { fetchFn, calls };
}

const ENV = { ANTHROPIC_API_KEY: 'test-anthropic-key', OPENAI_API_KEY: 'test-openai-key' };
const noSleep = async (): Promise<void> => {};
const AUTHORIZATION = testAuthorization();
const acceptance = (runId: string, logicalCallId: string) =>
  acceptanceContext(runId, logicalCallId, AUTHORIZATION);

const synthesisReq: LlmRequest = {
  nodeId: 'synthesis',
  system: 'You synthesise relationship claims.',
  prompt: 'Propose claims for magnesium vs sleep.',
  expectJson: true,
};

test('anthropic adapter: correct wire shape, text + usage extracted', async () => {
  const config = testConfig();
  const { fetchFn, calls } = mockFetch([jsonResponse(200, anthropicBody('{"claims":[]}', 321, 42))]);

  const res = await callApiWorker(config, synthesisReq, 'claude-sonnet-5', 8000, {
    fetchFn,
    env: ENV,
    sleep: noSleep,
  });

  assert.equal(calls.length, 1);
  const call = calls[0]!;
  assert.equal(call.url, ANTHROPIC_MESSAGES_URL);
  assert.equal(call.headers['x-api-key'], 'test-anthropic-key');
  assert.equal(call.headers['anthropic-version'], ANTHROPIC_VERSION);
  assert.equal(call.headers['content-type'], 'application/json');
  assert.equal(call.body.model, 'claude-sonnet-5');
  assert.equal(call.body.max_tokens, 8000);
  assert.deepEqual(call.body.messages, [{ role: 'user', content: synthesisReq.prompt }]);
  // expectJson → the JSON instruction rides on the system prompt.
  assert.match(call.body.system, /You synthesise relationship claims\./);
  assert.match(call.body.system, /single valid JSON object/);
  // temperature not set → not sent (sonnet-5 rejects non-default sampling).
  assert.equal('temperature' in call.body, false);

  assert.equal(res.text, '{"claims":[]}');
  assert.deepEqual(res.usage, { inputTokens: 321, outputTokens: 42 });
  assert.equal(res.model, 'claude-sonnet-5');
  assert.equal(res.route, 'api_worker');
});

test('openai adapter: correct wire shape incl. response_format + usage mapping', async () => {
  const config = testConfig();
  const { fetchFn, calls } = mockFetch([jsonResponse(200, openaiBody('{"verdict":"supported"}', 222, 33))]);

  const req: LlmRequest = {
    nodeId: 'verifier',
    system: 'You are an adversarial verifier.',
    prompt: 'Verify claim X.',
    expectJson: true,
  };
  const res = await callApiWorker(config, req, 'gpt-5', 4000, { fetchFn, env: ENV, sleep: noSleep });

  assert.equal(calls.length, 1);
  const call = calls[0]!;
  assert.equal(call.url, OPENAI_CHAT_COMPLETIONS_URL);
  assert.equal(call.headers.authorization, 'Bearer test-openai-key');
  assert.equal(call.body.model, 'gpt-5');
  assert.equal(call.body.max_completion_tokens, 4000);
  assert.deepEqual(call.body.response_format, { type: 'json_object' });
  assert.deepEqual(call.body.messages, [
    { role: 'system', content: 'You are an adversarial verifier.' },
    { role: 'user', content: 'Verify claim X.' },
  ]);

  assert.equal(res.text, '{"verdict":"supported"}');
  assert.deepEqual(res.usage, { inputTokens: 222, outputTokens: 33 });
  assert.equal(res.model, 'gpt-5');
  assert.equal(res.route, 'api_worker');
});

test('openai adapter: no response_format / no system message when not requested', async () => {
  const config = testConfig();
  const { fetchFn, calls } = mockFetch([jsonResponse(200, openaiBody('plain text'))]);
  await callApiWorker(config, { nodeId: 'verifier', prompt: 'hi' }, 'gpt-5', 100, {
    fetchFn,
    env: ENV,
    sleep: noSleep,
  });
  const call = calls[0]!;
  assert.equal('response_format' in call.body, false);
  assert.deepEqual(call.body.messages, [{ role: 'user', content: 'hi' }]);
});

test('Agnes adapter refuses any direct call without the router-owned journal before fetch', async () => {
  const config = testConfig((raw) => {
    raw.providers.push({ prefix: 'agnes-', family: 'agnes', envKey: 'AGNES_API_KEY' });
    raw.nodes.verifier.model = 'agnes-llama-3.3-70b';
    raw.prices['agnes-llama-3.3-70b'] = { inputUsdPerMTok: 0.5, outputUsdPerMTok: 0.5 };
  });
  const { fetchFn, calls } = mockFetch([]);
  await assert.rejects(
    callApiWorker(
      config,
      {
        nodeId: 'verifier',
        prompt: 'x',
        expectJson: true,
        acceptance: acceptance('run', 'leg'),
      },
      'agnes-llama-3.3-70b',
      3_072,
      { fetchFn, env: { AGNES_API_KEY: 'key' }, sleep: noSleep },
    ),
    /acceptance requires the fixed router-owned journal/,
  );
  assert.equal(calls.length, 0);
});

test('direct Anthropic acceptance rejects a forged cheap reservation before fetch', async () => {
  const config = testConfig((raw) => {
    raw.prices['claude-sonnet-5'].provisional = false;
  });
  const { fetchFn, calls } = mockFetch([]);
  await assert.rejects(
    callApiWorker(
      config,
      {
        nodeId: 'synthesis',
        prompt: 'secret prompt',
        expectJson: true,
        acceptance: acceptance('run', 'synthesis:forged'),
      },
      'claude-sonnet-5',
      3_072,
      {
        fetchFn,
        env: { ANTHROPIC_API_KEY: 'secret-key' },
        sleep: noSleep,
        attemptJournal: {
          journal: new AttemptJournal('tracked-source-file.ts'),
          input: {
            ...authorizationBinding(AUTHORIZATION),
            acceptanceRunId: 'run',
            logicalCallId: 'synthesis:forged',
            nodeId: 'synthesis',
            providerFamily: 'anthropic',
            model: 'claude-sonnet-5',
            promptHash: `sha256:${'0'.repeat(64)}`,
            inputByteCeiling: 1,
            outputTokenCeiling: 1,
            reservedUsd: 0.000001,
            price: {
              billingMode: 'metered',
              inputUsdPerMTok: 3,
              outputUsdPerMTok: 15,
              provisional: false,
              pricingProvenance: null,
            },
          },
        },
      },
    ),
    /safe-root binding/,
  );
  assert.equal(calls.length, 0);
});

test('direct acceptance rejects an exact canonical-path journal lacking the safe-root binding before fetch', async () => {
  const config = testConfig((raw) => {
    raw.prices['claude-sonnet-5'].provisional = false;
  });
  const { fetchFn, calls } = mockFetch([]);
  await assert.rejects(
    callApiWorker(
      config,
      {
        nodeId: 'synthesis',
        prompt: 'x',
        expectJson: true,
        acceptance: acceptance('run', 'synthesis:unbound'),
      },
      'claude-sonnet-5',
      3_072,
      {
        fetchFn,
        env: { ANTHROPIC_API_KEY: 'key' },
        sleep: noSleep,
        attemptJournal: {
          journal: new AttemptJournal(resolveRepoPath(acceptanceJournalRepoPath(AUTHORIZATION.authorizationId))),
          input: {
            ...authorizationBinding(AUTHORIZATION),
            acceptanceRunId: 'run',
            logicalCallId: 'synthesis:unbound',
            nodeId: 'synthesis',
            providerFamily: 'anthropic',
            model: 'claude-sonnet-5',
            promptHash: `sha256:${'0'.repeat(64)}`,
            inputByteCeiling: 24_000,
            outputTokenCeiling: 3_072,
            reservedUsd: 1,
            price: {
              billingMode: 'metered',
              inputUsdPerMTok: 3,
              outputUsdPerMTok: 15,
              provisional: false,
              pricingProvenance: null,
            },
          },
        },
      },
    ),
    /lacks the router-owned safe-root binding/,
  );
  assert.equal(calls.length, 0);
});

test('direct free acceptance rejects forged price provenance before fetch', async () => {
  const config = testConfig((raw) => {
    raw.providers.push({ prefix: 'agnes-', family: 'agnes', envKey: 'AGNES_API_KEY' });
    raw.acceptance = { runtimeRoot: ACCEPTANCE_RUNTIME_REPO_ROOT };
    raw.nodes.synthesis.model = 'claude-sonnet-5';
    raw.nodes.verifier.model = 'agnes-2.5-flash';
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
  });
  const root = resolveRepoPath(ACCEPTANCE_RUNTIME_REPO_ROOT);
  const journalPath = resolveRepoPath(acceptanceJournalRepoPath(AUTHORIZATION.authorizationId));
  mkdirSync(root, { recursive: true });
  rmSync(journalPath, { force: true });
  rmSync(`${journalPath}.lock`, { force: true });
  const request = {
    nodeId: 'verifier' as const,
    prompt: 'x',
    expectJson: true as const,
    acceptance: acceptance('run', 'verifier:forged-free'),
  };
  const canonical = canonicalizeProviderContent(request, 'agnes');
  const { fetchFn, calls } = mockFetch([]);
  try {
    await assert.rejects(
      callApiWorker(config, request, 'agnes-2.5-flash', ACCEPTANCE_MAX_OUTPUT_TOKENS, {
        fetchFn,
        env: { AGNES_API_KEY: 'key' },
        sleep: noSleep,
        attemptJournal: {
          journal: new AttemptJournal(journalPath, { allowedRoot: root }),
          input: {
            ...authorizationBinding(AUTHORIZATION),
            acceptanceRunId: request.acceptance.acceptanceRunId,
            logicalCallId: request.acceptance.logicalCallId,
            nodeId: 'verifier',
            providerFamily: 'agnes',
            model: 'agnes-2.5-flash',
            promptHash: providerContentSha256(canonical.serialized),
            inputByteCeiling: ACCEPTANCE_MAX_INPUT_BYTES,
            outputTokenCeiling: ACCEPTANCE_MAX_OUTPUT_TOKENS,
            reservedUsd: 0,
            price: {
              billingMode: 'free',
              inputUsdPerMTok: 0,
              outputUsdPerMTok: 0,
              provisional: false,
              pricingProvenance: 'forged source',
              effectiveFrom: '2026-01-01T00:00:00.000Z',
              expiresAt: '2027-01-01T00:00:00.000Z',
            },
          },
        },
      }),
      /acceptance requires the fixed router-owned journal, ceilings, retention, price, identity, and canonical message hash/,
    );
    assert.equal(calls.length, 0);
  } finally {
    rmSync(journalPath, { force: true });
    rmSync(`${journalPath}.lock`, { force: true });
  }
});

test('public callApiWorker validates forged path and price configs before fetch', async () => {
  let calls = 0;
  const fetchFn: FetchLike = async () => { calls++; return jsonResponse(200, anthropicBody('{}')); };
  for (const mutate of [
    (raw: any) => { raw.acceptance.runtimeRoot = '../fresh'; }, // eslint-disable-line @typescript-eslint/no-explicit-any
    (raw: any) => { raw.prices['claude-sonnet-5'].outputUsdPerMTok = -1; }, // eslint-disable-line @typescript-eslint/no-explicit-any
  ]) {
    const config = testConfig() as unknown as Record<string, unknown>;
    config.acceptance = { runtimeRoot: ACCEPTANCE_RUNTIME_REPO_ROOT };
    mutate(config);
    await assert.rejects(
      callApiWorker(
        config as never,
        { nodeId: 'synthesis', prompt: 'x' },
        'claude-sonnet-5',
        100,
        { fetchFn, env: ENV, sleep: noSleep },
      ),
      /acceptance\.runtimeRoot must be exactly|must carry positive inputUsdPerMTok\/outputUsdPerMTok/,
    );
  }
  assert.equal(calls, 0);
});

test('429 retries with exponential backoff, then succeeds', async () => {
  const config = testConfig();
  const { fetchFn, calls } = mockFetch([
    jsonResponse(429, { error: { type: 'rate_limit_error' } }),
    jsonResponse(429, { error: { type: 'rate_limit_error' } }),
    jsonResponse(200, anthropicBody('ok after retries')),
  ]);
  const sleeps: number[] = [];
  const res = await callApiWorker(config, synthesisReq, 'claude-sonnet-5', 1000, {
    fetchFn,
    env: ENV,
    maxAttempts: 3,
    baseDelayMs: 100,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
  });
  assert.equal(calls.length, 3);
  assert.deepEqual(sleeps, [100, 200], 'backoff doubles per retry');
  assert.equal(res.text, 'ok after retries');
});

test('5xx: retries exhaust into a typed RouterHttpError carrying the status', async () => {
  const config = testConfig();
  const { fetchFn, calls } = mockFetch([
    jsonResponse(500, { error: 'boom' }),
    jsonResponse(503, { error: 'still boom' }),
    jsonResponse(500, { error: 'boom again' }),
  ]);
  await assert.rejects(
    callApiWorker(config, synthesisReq, 'claude-sonnet-5', 1000, {
      fetchFn,
      env: ENV,
      maxAttempts: 3,
      sleep: noSleep,
    }),
    (err: unknown) => err instanceof RouterHttpError && err.status === 500 && /after 3 attempts/.test(err.message),
  );
  assert.equal(calls.length, 3);
});

test('400 is non-retryable: fails immediately after one attempt', async () => {
  const config = testConfig();
  const { fetchFn, calls } = mockFetch([
    jsonResponse(400, { error: { type: 'invalid_request_error', message: 'bad params' } }),
  ]);
  await assert.rejects(
    callApiWorker(config, synthesisReq, 'claude-sonnet-5', 1000, { fetchFn, env: ENV, sleep: noSleep }),
    (err: unknown) => err instanceof RouterHttpError && err.status === 400 && /non-retryable/.test(err.message),
  );
  assert.equal(calls.length, 1);
});

test('provider and network diagnostics never echo prompt or key material', async () => {
  const prompt = 'PROMPT_MUST_NOT_ESCAPE';
  const key = 'KEY_MUST_NOT_ESCAPE';
  const config = testConfig();
  for (const fetchFn of [
    async () => jsonResponse(400, { error: `${prompt} ${key}` }),
    async () => { throw new Error(`${prompt} ${key}`); },
  ] satisfies FetchLike[]) {
    let caught: RouterHttpError | undefined;
    try {
      await callApiWorker(
        config,
        { nodeId: 'synthesis', prompt },
        'claude-sonnet-5',
        100,
        { fetchFn, env: { ANTHROPIC_API_KEY: key }, maxAttempts: 1, sleep: noSleep },
      );
    } catch (error) {
      assert.ok(error instanceof RouterHttpError);
      caught = error;
    }
    assert.ok(caught !== undefined);
    assert.doesNotMatch(caught.message, /PROMPT_MUST_NOT_ESCAPE|KEY_MUST_NOT_ESCAPE/);
    assert.doesNotMatch(caught.body, /PROMPT_MUST_NOT_ESCAPE|KEY_MUST_NOT_ESCAPE/);
  }
});

test('missing key: typed RouterKeyMissingError naming the env var, BEFORE any fetch', async () => {
  const config = testConfig();
  const { fetchFn, calls } = mockFetch([]);
  await assert.rejects(
    callApiWorker(config, { nodeId: 'verifier', prompt: 'x' }, 'gpt-5', 100, {
      fetchFn,
      env: { ANTHROPIC_API_KEY: 'present-but-irrelevant' }, // OPENAI_API_KEY absent
      sleep: noSleep,
    }),
    (err: unknown) =>
      err instanceof RouterKeyMissingError && err.envVar === 'OPENAI_API_KEY' && err.model === 'gpt-5',
  );
  assert.equal(calls.length, 0, 'no network attempt without a key');
});

test('empty-string key counts as missing', async () => {
  const config = testConfig();
  const { fetchFn, calls } = mockFetch([]);
  await assert.rejects(
    callApiWorker(config, synthesisReq, 'claude-sonnet-5', 100, {
      fetchFn,
      env: { ANTHROPIC_API_KEY: '' },
      sleep: noSleep,
    }),
    (err: unknown) => err instanceof RouterKeyMissingError && err.envVar === 'ANTHROPIC_API_KEY',
  );
  assert.equal(calls.length, 0);
});

test('google family: clear "no adapter yet" config error', async () => {
  const config = testConfig((raw) => {
    raw.nodes.verifier.model = 'gemini-2.5-pro';
    raw.prices['gemini-2.5-pro'] = { inputUsdPerMTok: 1, outputUsdPerMTok: 5 };
  });
  const { fetchFn } = mockFetch([]);
  await assert.rejects(
    callApiWorker(config, { nodeId: 'verifier', prompt: 'x' }, 'gemini-2.5-pro', 100, {
      fetchFn,
      env: { GOOGLE_API_KEY: 'gk' },
      sleep: noSleep,
    }),
    (err: unknown) => err instanceof RouterConfigError && /no Google adapter/.test(err.message),
  );
});

test('temperature passes through when explicitly set', async () => {
  const config = testConfig();
  const { fetchFn, calls } = mockFetch([jsonResponse(200, anthropicBody('t'))]);
  await callApiWorker(
    config,
    { nodeId: 'phrasing_card', prompt: 'phrase it', temperature: 0.7 },
    'claude-haiku-4-5',
    500,
    { fetchFn, env: ENV, sleep: noSleep },
  );
  assert.equal(calls[0]!.body.temperature, 0.7);
});
