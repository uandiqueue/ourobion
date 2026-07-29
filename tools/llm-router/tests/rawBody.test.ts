/**
 * R4-U3 · RAW PROVIDER-BODY RETENTION — mocked fetch, NO network, NO keys.
 *
 * The defect this closes: the adapters parsed the provider JSON, kept text +
 * usage + model, and dropped the body. Everything else the provider said — stop
 * reasons, refusal metadata, request ids, the exact bytes — was gone at the point
 * of capture, and a previous run lost its evidence permanently that way.
 *
 * Pinned here: retention is ON BY DEFAULT on both vendor paths, the retained body
 * is byte-identical to what the provider sent, truncation is capped AND recorded
 * (never silent), and the hash always identifies the FULL original body even when
 * the stored copy was cut.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { captureRawBody } from '../src/raw.js';
import { LlmRouter } from '../src/router.js';
import { callApiWorker, type FetchLike } from '../src/routes/apiWorker.js';
import { DEFAULT_RAW_BODY_CAP_BYTES, type LlmRequest } from '../src/types.js';
import { anthropicBody, jsonResponse, openaiBody, testConfig } from './helpers.js';

const ENV = { ANTHROPIC_API_KEY: 'test-anthropic-key', OPENAI_API_KEY: 'test-openai-key' };
const synthesisReq: LlmRequest = { nodeId: 'synthesis', prompt: 'p' };
const verifierReq: LlmRequest = { nodeId: 'verifier', prompt: 'p' };

/** Serve one response built from `body`, recording the exact text sent. */
function onceFetch(body: unknown): { fetchFn: FetchLike; sentText: string } {
  const sentText = JSON.stringify(body);
  let served = false;
  return {
    sentText,
    fetchFn: async () => {
      if (served) throw new Error('mockFetch: only one response queued');
      served = true;
      return new Response(sentText, { status: 200, headers: { 'content-type': 'application/json' } });
    },
  };
}

function sha256Of(text: string): string {
  return `sha256:${createHash('sha256').update(Buffer.from(text, 'utf8')).digest('hex')}`;
}

// ── the capture primitive ────────────────────────────────────────────────────────────────────

test('captureRawBody: an under-cap body is retained verbatim and marked untruncated', () => {
  const raw = captureRawBody('{"hello":"world"}');
  assert.equal(raw.body, '{"hello":"world"}');
  assert.equal(raw.truncated, false);
  assert.equal(raw.bytes, 17);
  assert.equal(raw.capBytes, DEFAULT_RAW_BODY_CAP_BYTES);
  assert.equal(raw.sha256, sha256Of('{"hello":"world"}'));
});

test('captureRawBody: an OVER-cap body is cut, and the cut is RECORDED not silent', () => {
  const huge = 'x'.repeat(5000);
  const raw = captureRawBody(huge, 1000);
  assert.equal(raw.truncated, true, 'truncation is flagged');
  assert.equal(raw.capBytes, 1000, 'the cap that was applied is recorded');
  assert.equal(raw.bytes, 5000, 'the ORIGINAL size is recorded, not the stored size');
  assert.equal(Buffer.byteLength(raw.body, 'utf8'), 1000);
  // The hash covers the FULL body, so a cut copy still names the response it came from.
  assert.equal(raw.sha256, sha256Of(huge));
  assert.notEqual(raw.sha256, sha256Of(raw.body));
});

test('captureRawBody: the cap bounds BYTES, not characters (multi-byte safe)', () => {
  const multibyte = '„'.repeat(100); // 3 bytes each
  const raw = captureRawBody(multibyte, 50);
  assert.equal(raw.bytes, 300);
  assert.equal(raw.truncated, true);
  assert.ok(Buffer.byteLength(raw.body, 'utf8') <= 50, 'the byte cap is a real bound');
});

test('captureRawBody: capBytes <= 0 means no cap', () => {
  const raw = captureRawBody('x'.repeat(5000), 0);
  assert.equal(raw.truncated, false);
  assert.equal(raw.body.length, 5000);
});

// ── the adapters: retention is ON by default, on BOTH vendors ────────────────────────────────

test('anthropic adapter: the raw body is retained BY DEFAULT, byte-identical', async () => {
  const { fetchFn, sentText } = onceFetch(anthropicBody('{"claims":[]}'));
  const res = await callApiWorker(testConfig(), synthesisReq, 'claude-sonnet-5', 8000, {
    fetchFn,
    env: ENV,
  });
  assert.ok(res.rawBody !== undefined, 'retention must not require opting in');
  assert.equal(res.rawBody.body, sentText);
  assert.equal(res.rawBody.truncated, false);
  assert.equal(res.rawBody.sha256, sha256Of(sentText));
  // The fields the parser DROPS are exactly what the raw body preserves.
  const reparsed = JSON.parse(res.rawBody.body) as Record<string, unknown>;
  assert.equal(reparsed.stop_reason, 'end_turn');
  assert.equal(reparsed.id, 'msg_test');
});

test('openai adapter: same treatment — symmetric by design', async () => {
  const { fetchFn, sentText } = onceFetch(openaiBody('ok'));
  const res = await callApiWorker(testConfig(), verifierReq, 'gpt-5', 8000, { fetchFn, env: ENV });
  assert.ok(res.rawBody !== undefined);
  assert.equal(res.rawBody.body, sentText);
  const reparsed = JSON.parse(res.rawBody.body) as { choices: Array<{ finish_reason: string }> };
  assert.equal(reparsed.choices[0]!.finish_reason, 'stop');
});

test('adapters: retention can be switched OFF explicitly, and only explicitly', async () => {
  const { fetchFn } = onceFetch(openaiBody('ok'));
  const res = await callApiWorker(testConfig(), verifierReq, 'gpt-5', 8000, {
    fetchFn,
    env: ENV,
    retainRawBody: false,
  });
  assert.equal(res.rawBody, undefined);
});

test('adapters: an oversized provider body is capped, flagged, and still hash-identified', async () => {
  const { fetchFn, sentText } = onceFetch(openaiBody('y'.repeat(4000)));
  const res = await callApiWorker(testConfig(), verifierReq, 'gpt-5', 8000, {
    fetchFn,
    env: ENV,
    rawBodyCapBytes: 500,
  });
  assert.equal(res.rawBody?.truncated, true);
  assert.equal(res.rawBody?.capBytes, 500);
  assert.equal(res.rawBody?.bytes, Buffer.byteLength(sentText, 'utf8'));
  assert.equal(res.rawBody?.sha256, sha256Of(sentText));
});

// ── the router facade carries it through ─────────────────────────────────────────────────────

test('router.route(): the raw body survives the facade, defaulted on', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'llm-router-raw-'));
  try {
    const { fetchFn, sentText } = onceFetch(openaiBody('verdict'));
    const router = new LlmRouter({
      config: testConfig(),
      env: ENV,
      fetchFn,
      ledgerPath: join(dir, 'ledger.json'),
    });
    const res = await router.route(verifierReq);
    assert.equal(res.rawBody?.body, sentText);
    assert.equal(res.rawBody?.truncated, false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('local_agent route: NO raw body — there is no provider response to retain', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'llm-router-raw-mailbox-'));
  try {
    const config = testConfig((raw) => {
      raw.nodes.verifier.route = 'local_agent';
    });
    const router = new LlmRouter({
      config,
      env: ENV,
      mailboxDir: join(dir, 'mailbox'),
      ledgerPath: join(dir, 'ledger.json'),
      localAgentTimeoutMs: 50,
      localAgentPollIntervalMs: 5,
    });
    await assert.rejects(() => router.route(verifierReq));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
