/**
 * Router facade tests: config-driven dispatch to both routes, pre-call budget
 * enforcement (denied BEFORE any dispatch), usage recording into the ledger,
 * per-request maxOutputTokens override, and the checkConfig operator report.
 * Mocked fetch + temp dirs — NO network, NO keys.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { checkConfig, LlmRouter } from '../src/router.js';
import { RouterBudgetExceededError } from '../src/errors.js';
import type { FetchLike } from '../src/routes/apiWorker.js';
import { anthropicBody, jsonResponse, testConfig } from './helpers.js';

const ENV = { ANTHROPIC_API_KEY: 'ak', OPENAI_API_KEY: 'ok' };
const DAY1_NOON = Date.UTC(2026, 6, 15, 12, 0, 0);

function freshDir(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
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
