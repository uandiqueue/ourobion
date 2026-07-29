/**
 * R4-U4 follow-on (issue #240) · MODEL-IDENTITY PROVENANCE — mocked fetch, NO network, NO keys.
 *
 * `LlmResponse.model` alone is ambiguous by construction: it holds whatever the provider
 * returned, OR the configured id when the provider returned nothing, OR the id a mailbox
 * fulfiller wrote into a file. Downstream, `edge_verifications.attestation_attested` may be true
 * for exactly the first of those (B-BR1), so the ambiguity had to be removed at the point of
 * capture rather than guessed at later.
 *
 * These tests pin that `modelIdentity.providerAttested` is true ONLY when the provider's own
 * response body carried a model id, on every route, and that the router's config-derived members
 * (family, decorrelation) are filled without ever promoting an unattested identity.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { callApiWorker, type FetchLike } from '../src/routes/apiWorker.js';
import { LlmRouter } from '../src/router.js';
import { TEST_MODE_LABEL, type LlmRequest } from '../src/types.js';
import { anthropicBody, jsonResponse, openaiBody, testConfig } from './helpers.js';

const ENV = { ANTHROPIC_API_KEY: 'test-anthropic-key', OPENAI_API_KEY: 'test-openai-key' };

function onceFetch(body: unknown): FetchLike {
  let served = false;
  return async () => {
    if (served) throw new Error('mockFetch: only one response queued');
    served = true;
    return jsonResponse(200, body);
  };
}

const synthesisReq: LlmRequest = { nodeId: 'synthesis', prompt: 'p', expectJson: true };
const verifierReq: LlmRequest = { nodeId: 'verifier', prompt: 'p', expectJson: true };

// ── the api_worker route ────────────────────────────────────────────────────────────────────

test('api_worker/anthropic: a model id in the RESPONSE BODY is provider-attested', async () => {
  const res = await callApiWorker(testConfig(), synthesisReq, 'claude-sonnet-5', 8000, {
    fetchFn: onceFetch(anthropicBody('{}')),
    env: ENV,
  });
  assert.equal(res.modelIdentity.source, 'provider-response');
  assert.equal(res.modelIdentity.providerAttested, true);
  assert.equal(res.modelIdentity.model, 'claude-sonnet-5');
  assert.equal(res.modelIdentity.family, 'anthropic');
  assert.equal(res.model, res.modelIdentity.model, 'the legacy field mirrors the identity');
});

test('api_worker/openai: a model id in the RESPONSE BODY is provider-attested', async () => {
  const res = await callApiWorker(testConfig(), verifierReq, 'gpt-5', 8000, {
    fetchFn: onceFetch(openaiBody('{}')),
    env: ENV,
  });
  assert.equal(res.modelIdentity.source, 'provider-response');
  assert.equal(res.modelIdentity.providerAttested, true);
  assert.equal(res.modelIdentity.family, 'openai');
});

test('api_worker: NO model in the body ⇒ the configured id, NOT attested', async () => {
  const body = anthropicBody('{}') as Record<string, unknown>;
  delete body.model;
  const res = await callApiWorker(testConfig(), synthesisReq, 'claude-sonnet-5', 8000, {
    fetchFn: onceFetch(body),
    env: ENV,
  });
  assert.equal(res.modelIdentity.source, 'router-config');
  assert.equal(res.modelIdentity.providerAttested, false);
  // The string still says what we asked for — it is the PROVENANCE that changes, not the value.
  assert.equal(res.modelIdentity.model, 'claude-sonnet-5');
});

test('api_worker: a blank model in the body is not an identity either', async () => {
  const body = { ...(openaiBody('{}') as Record<string, unknown>), model: '   ' };
  const res = await callApiWorker(testConfig(), verifierReq, 'gpt-5', 8000, {
    fetchFn: onceFetch(body),
    env: ENV,
  });
  assert.equal(res.modelIdentity.providerAttested, false);
  assert.equal(res.modelIdentity.model, 'gpt-5');
});

test('api_worker: a provider that echoes a DIFFERENT resolved id attests THAT id', async () => {
  const body = { ...(openaiBody('{}') as Record<string, unknown>), model: 'gpt-5-2026-01-14' };
  const res = await callApiWorker(testConfig(), verifierReq, 'gpt-5', 8000, {
    fetchFn: onceFetch(body),
    env: ENV,
  });
  assert.equal(res.modelIdentity.model, 'gpt-5-2026-01-14');
  assert.equal(res.modelIdentity.providerAttested, true);
});

// ── the router facade: config-derived members ───────────────────────────────────────────────

test('router: fills the vendor family and the decorrelation verdict for the verifier node', async () => {
  const router = new LlmRouter({
    config: testConfig(),
    env: ENV,
    fetchFn: onceFetch(openaiBody('{}')),
    ledgerPath: `${process.env.TMPDIR ?? '/tmp'}/ourobion-modelidentity-${Date.now()}-a.json`,
  });
  const res = await router.route(verifierReq);
  assert.equal(res.modelIdentity.family, 'openai');
  // testConfig(): synthesis is anthropic, verifier is openai ⇒ decorrelated.
  assert.equal(res.modelIdentity.decorrelatedFromSynthesis, true);
  assert.equal(res.modelIdentity.providerAttested, true);
});

test('router: TEST-MODE forces decorrelated FALSE (the invariant is off by definition)', async () => {
  const config = testConfig();
  // A single-provider test-mode posture: the verifier shares the synthesis family.
  config.nodes.verifier = { ...config.nodes.verifier, model: 'claude-sonnet-5' };
  config.testMode = { reason: 'unit test' };
  const router = new LlmRouter({
    config,
    env: ENV,
    fetchFn: onceFetch(anthropicBody('{}')),
    ledgerPath: `${process.env.TMPDIR ?? '/tmp'}/ourobion-modelidentity-${Date.now()}-b.json`,
  });
  const res = await router.route(verifierReq);
  assert.equal(res.modelIdentity.decorrelatedFromSynthesis, false);
  assert.equal(res.testMode?.label, TEST_MODE_LABEL);
  // Attestation is INDEPENDENT of decorrelation: a real provider still answered for itself.
  // Keeping the two apart is the point — collapsing them would either forgive a correlated
  // verifier or discard a genuine attestation.
  assert.equal(res.modelIdentity.providerAttested, true);
});
