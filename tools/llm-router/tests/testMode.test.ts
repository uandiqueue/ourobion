/**
 * TEST-MODE tests (Run 2.0 single-provider posture).
 *
 * The flag's contract, proven offline:
 *  - WITHOUT `testMode`, a single-provider config still HARD-FAILS validation
 *    (both decorrelation clauses) — exactly the pre-flag behaviour;
 *  - WITH `testMode: { reason }`, the same config loads and validation emits a
 *    loud warning naming the violated invariant;
 *  - `testMode` without a non-empty reason is invalid;
 *  - the shipped router.config.json dispatches all six nodes to the OpenAI
 *    api_worker path with their configured model ids and records spend;
 *  - every route() result carries the test-mode label (TEST_MODE_LABEL).
 *
 * node:test via tsx — mocked fetch, temp ledgers, NO network, NO keys.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { defaultConfigPath, loadConfig, validateConfig } from '../src/config.js';
import { RouterConfigError } from '../src/errors.js';
import { LlmRouter } from '../src/router.js';
import { OPENAI_CHAT_COMPLETIONS_URL, type FetchLike } from '../src/routes/apiWorker.js';
import { LLM_NODE_IDS, TEST_MODE_LABEL } from '../src/types.js';
import { baseConfigObject, jsonResponse, openaiBody, testConfig } from './helpers.js';

const DAY1_NOON = Date.UTC(2026, 6, 24, 12, 0, 0);

/** Base config mutated into the single-provider posture (all-OpenAI). */
function singleProviderRaw(): any { // eslint-disable-line @typescript-eslint/no-explicit-any
  const raw = baseConfigObject();
  for (const nodeId of Object.keys(raw.nodes)) {
    raw.nodes[nodeId].model = nodeId === 'synthesis' || nodeId === 'verifier' ? 'gpt-5' : 'gpt-5-mini';
    raw.nodes[nodeId].route = 'api_worker';
  }
  raw.prices['gpt-5-mini'] = { inputUsdPerMTok: 0.25, outputUsdPerMTok: 2, provisional: true };
  return raw;
}

test('WITHOUT testMode a single-provider config still hard-fails (same-family clause)', () => {
  assert.throws(
    () => validateConfig(singleProviderRaw()),
    (err: unknown) =>
      err instanceof RouterConfigError && /decorrelation violated/.test(err.message) && /same vendor family/.test(err.message),
  );
});

test('WITHOUT testMode an Anthropic verifier still hard-fails (non-Anthropic clause)', () => {
  const raw = baseConfigObject();
  raw.nodes.verifier.model = 'claude-haiku-4-5';
  raw.nodes.synthesis.model = 'gpt-5';
  assert.throws(
    () => validateConfig(raw),
    (err: unknown) =>
      err instanceof RouterConfigError && /decorrelation violated/.test(err.message) && /non-Anthropic/.test(err.message),
  );
});

test('WITH testMode {reason} a single-provider config passes and a warning names the invariant', () => {
  const raw = singleProviderRaw();
  raw.testMode = { reason: 'unit test: single-provider posture' };
  const warnings: string[] = [];
  const config = validateConfig(raw, { warn: (m) => warnings.push(m) });
  assert.equal(config.testMode?.reason, 'unit test: single-provider posture');
  assert.equal(warnings.length, 1, 'exactly one clause is violated → exactly one warning');
  assert.match(warnings[0]!, /TEST-MODE WARNING/);
  assert.match(warnings[0]!, /family\(synthesis\) !== family\(verifier\)/, 'warning names the violated invariant');
  assert.ok(warnings[0]!.includes(TEST_MODE_LABEL), 'warning carries the downstream stamp');
});

test('WITH testMode an Anthropic-verifier config warns on BOTH clauses', () => {
  const raw = baseConfigObject();
  raw.nodes.synthesis.model = 'claude-sonnet-5';
  raw.nodes.verifier.model = 'claude-haiku-4-5'; // same family AND anthropic
  raw.testMode = { reason: 'unit test: worst case' };
  const warnings: string[] = [];
  validateConfig(raw, { warn: (m) => warnings.push(m) });
  assert.equal(warnings.length, 2);
  assert.match(warnings[0]!, /family\(synthesis\) !== family\(verifier\)/);
  assert.match(warnings[1]!, /family\(verifier\) !== 'anthropic'/);
});

test('testMode without a reason is invalid (missing, empty, whitespace, non-object)', () => {
  for (const bad of [{}, { reason: '' }, { reason: '   ' }, { reason: 42 }]) {
    const raw = singleProviderRaw();
    raw.testMode = bad;
    assert.throws(() => validateConfig(raw), /testMode\.reason must be a non-empty string/);
  }
  const raw = singleProviderRaw();
  raw.testMode = 'yes please';
  assert.throws(() => validateConfig(raw), /testMode must be an object/);
});

test('testMode on a NON-violating config is allowed: no warning, metadata still attached', async () => {
  const raw = baseConfigObject(); // decorrelated: synthesis anthropic, verifier openai
  raw.testMode = { reason: 'unit test: flag on, invariant intact' };
  const warnings: string[] = [];
  const config = validateConfig(raw, { warn: (m) => warnings.push(m) });
  assert.equal(warnings.length, 0, 'no violation → no warning');
  assert.equal(config.testMode?.reason, 'unit test: flag on, invariant intact');
});

test('shipped config: all six nodes dispatch to the OpenAI api_worker path and record spend', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'llm-router-tm-'));
  try {
    const warnings: string[] = [];
    const config = loadConfig(defaultConfigPath(), { warn: (m) => warnings.push(m) });
    assert.equal(warnings.length, 1, 'shipped config violates exactly the same-family clause');

    const calls: Array<{ url: string; auth: string | undefined; body: any }> = []; // eslint-disable-line @typescript-eslint/no-explicit-any
    const fetchFn: FetchLike = async (url, init) => {
      const headers = init.headers as Record<string, string>;
      calls.push({ url, auth: headers.authorization, body: JSON.parse(String(init.body)) });
      return jsonResponse(200, openaiBody('ok', 100, 50));
    };
    const router = new LlmRouter({
      config,
      runId: 'run-testmode',
      ledgerPath: join(dir, 'ledger.json'),
      env: { OPENAI_API_KEY: 'test-key' },
      fetchFn,
      now: () => DAY1_NOON,
    });

    for (const nodeId of LLM_NODE_IDS) {
      const res = await router.route({ nodeId, prompt: `hello from ${nodeId}` });
      assert.equal(res.route, 'api_worker');
      assert.equal(res.testMode?.label, TEST_MODE_LABEL, 'result metadata carries the test-mode label');
      assert.ok((res.testMode?.reason ?? '').length > 0);
    }

    assert.equal(calls.length, 6);
    for (const [i, nodeId] of LLM_NODE_IDS.entries()) {
      assert.equal(calls[i]!.url, OPENAI_CHAT_COMPLETIONS_URL, `${nodeId} hits the OpenAI endpoint`);
      assert.equal(calls[i]!.auth, 'Bearer test-key');
      assert.equal(calls[i]!.body.model, config.nodes[nodeId].model, `${nodeId} sends its configured model`);
      assert.equal(calls[i]!.body.max_completion_tokens, config.nodes[nodeId].maxOutputTokens);
    }
    // Expected wiring, pinned: heavy nodes gpt-5, cheap tier gpt-5-mini.
    assert.equal(config.nodes.synthesis.model, 'gpt-5');
    assert.equal(config.nodes.verifier.model, 'gpt-5');
    assert.equal(config.nodes.seeder.model, 'gpt-5-mini');
    assert.equal(config.nodes.phrasing_card.model, 'gpt-5-mini');
    assert.equal(config.nodes.report_narrative.model, 'gpt-5-mini');
    assert.equal(config.nodes.extract_assist.model, 'gpt-5-mini');

    // Every node's spend landed in the ledger; the run accumulated all output tokens.
    const state = router.budgetState();
    for (const nodeId of LLM_NODE_IDS) {
      assert.equal(state.nodes[nodeId]?.calls, 1, `${nodeId} recorded in ledger`);
      assert.ok((state.nodes[nodeId]?.usd ?? 0) > 0, `${nodeId} recorded USD spend`);
    }
    assert.equal(state.runs['run-testmode']?.outputTokens, 6 * 50);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('no testMode in config → route() results carry NO test-mode metadata', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'llm-router-tm-'));
  try {
    const fetchFn: FetchLike = async () => jsonResponse(200, openaiBody('plain'));
    const router = new LlmRouter({
      config: testConfig(), // decorrelated, no testMode
      runId: 'run-plain',
      ledgerPath: join(dir, 'ledger.json'),
      env: { OPENAI_API_KEY: 'k' },
      fetchFn,
      now: () => DAY1_NOON,
    });
    const res = await router.route({ nodeId: 'verifier', prompt: 'check this' });
    assert.equal(res.testMode, undefined);
    assert.equal(router.testModeState(), undefined);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
