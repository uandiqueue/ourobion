/**
 * THE DECORRELATION INVARIANT (memory 0012 / 0013 / architecture §10.1).
 *
 * One rule, stated once: `family(verifier) !== family(synthesis)`. These tests pin
 * the three properties that make it worth anything —
 *
 *  1. it is a genuine PAIRWISE comparison, not a vendor blacklist: every
 *     same-family pairing is refused (anthropic/anthropic, openai/openai,
 *     google/google) and every cross-family pairing loads, INCLUDING the ones a
 *     vendor blacklist used to forbid (openai synthesis + anthropic verifier);
 *  2. it FAILS CLOSED when a family cannot be resolved — an unmappable model id
 *     is a violation, never a pass by default;
 *  3. it has NO override. The `testMode` block that once downgraded it to a
 *     warning is gone, and a config still carrying one is refused outright.
 *
 * Plus the shipped posture itself: the checked-in router.config.json loads with
 * an AGNES verifier against OpenAI synthesis (#307 — Anthropic is off-limits for
 * this run, so Agnes is the only remaining legal verifier family), and dispatches
 * each node to its own vendor's endpoint. Point 1 above is exactly why that swap
 * needed no change to the invariant: it is a pairwise family comparison, not a
 * vendor list, so a new verifier family satisfies it without special-casing.
 * node:test via tsx — mocked fetch, NO network, NO keys.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { defaultConfigPath, familyOf, loadConfig, validateConfig } from '../src/config.js';
import { RouterConfigError } from '../src/errors.js';
import { LlmRouter } from '../src/router.js';
import {
  AGNES_CHAT_COMPLETIONS_URL,
  ANTHROPIC_MESSAGES_URL,
  OPENAI_CHAT_COMPLETIONS_URL,
  type FetchLike,
} from '../src/routes/apiWorker.js';
import { LLM_NODE_IDS } from '../src/types.js';
import { anthropicBody, baseConfigObject, jsonResponse, openaiBody } from './helpers.js';

const DAY1_NOON = Date.UTC(2026, 6, 29, 12, 0, 0);

/* eslint-disable @typescript-eslint/no-explicit-any */
/** baseConfigObject() with synthesis/verifier models set explicitly. */
function pairing(synthesis: string, verifier: string): any {
  const raw = baseConfigObject();
  raw.nodes.synthesis.model = synthesis;
  raw.nodes.verifier.model = verifier;
  raw.prices['gpt-5-mini'] = { inputUsdPerMTok: 0.25, outputUsdPerMTok: 2, provisional: true };
  raw.prices['gemini-2.5-pro'] = { inputUsdPerMTok: 1.25, outputUsdPerMTok: 10, provisional: true };
  raw.prices['gemini-2.5-flash'] = { inputUsdPerMTok: 0.3, outputUsdPerMTok: 2.5, provisional: true };
  return raw;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ── 1 · a pairwise comparison, not a vendor blacklist ────────────────────────────────────────

test('SAME family is refused, whichever vendor it is', () => {
  const sameFamilyPairs: Array<[string, string]> = [
    ['claude-sonnet-5', 'claude-haiku-4-5'], // anthropic vs anthropic
    ['gpt-5', 'gpt-5-mini'], // openai vs openai
    ['gemini-2.5-pro', 'gemini-2.5-flash'], // google vs google
  ];
  for (const [synthesis, verifier] of sameFamilyPairs) {
    assert.throws(
      () => validateConfig(pairing(synthesis, verifier)),
      (err: unknown) =>
        err instanceof RouterConfigError &&
        /decorrelation violated/.test(err.message) &&
        /SAME vendor family/.test(err.message),
      `${synthesis} + ${verifier} must be refused`,
    );
  }
});

test('DIFFERENT families load — including openai synthesis + ANTHROPIC verifier', () => {
  // This exact pairing is the one the old hardcoded `verifier !== anthropic`
  // blacklist rejected. It is perfectly decorrelated, and it is what the run ships.
  const config = validateConfig(pairing('gpt-5', 'claude-sonnet-5'));
  assert.equal(familyOf(config, config.nodes.synthesis.model), 'openai');
  assert.equal(familyOf(config, config.nodes.verifier.model), 'anthropic');
});

test('every other cross-family pairing loads too (the vendor is irrelevant)', () => {
  const crossFamilyPairs: Array<[string, string]> = [
    ['claude-sonnet-5', 'gpt-5'],
    ['claude-sonnet-5', 'gemini-2.5-pro'],
    ['gpt-5', 'gemini-2.5-pro'],
    ['gemini-2.5-pro', 'claude-sonnet-5'],
    ['gemini-2.5-pro', 'gpt-5'],
  ];
  for (const [synthesis, verifier] of crossFamilyPairs) {
    const config = validateConfig(pairing(synthesis, verifier));
    assert.notEqual(
      familyOf(config, config.nodes.synthesis.model),
      familyOf(config, config.nodes.verifier.model),
      `${synthesis} + ${verifier} must load`,
    );
  }
});

// ── 2 · fail closed on an unresolvable family ────────────────────────────────────────────────

test('FAIL CLOSED: a verifier model matching no provider prefix is refused, not waved through', () => {
  const raw = pairing('gpt-5', 'llama-3-70b');
  raw.prices['llama-3-70b'] = { inputUsdPerMTok: 1, outputUsdPerMTok: 1 };
  assert.throws(
    () => validateConfig(raw),
    (err: unknown) => err instanceof RouterConfigError && /matches no provider prefix/.test(err.message),
  );
});

test('FAIL CLOSED: dropping the verifier vendor from providers[] refuses the config', () => {
  // Two layers guard this, and the property that matters is that NEITHER lets an
  // unresolvable family through: the per-node loop rejects an unmapped model id
  // first, and the invariant's own resolver (decorrelationFamilyOrFail) refuses
  // rather than defaulting to "different, probably". Whichever fires, the outcome
  // is the same — no config, a typed error, never a silent pass.
  const config = validateConfig(pairing('gpt-5', 'claude-sonnet-5'));
  const stripped = {
    ...config,
    providers: config.providers.filter((p) => p.prefix !== 'claude-'),
  };
  assert.throws(
    () => validateConfig(stripped),
    (err: unknown) =>
      err instanceof RouterConfigError &&
      /(matches no provider prefix|decorrelation cannot be evaluated)/.test(err.message),
  );
});

// ── 3 · no override exists any more ──────────────────────────────────────────────────────────

test('a config still carrying a testMode block is REFUSED, not ignored', () => {
  const raw = pairing('gpt-5', 'gpt-5-mini'); // would have been "excused" by test mode
  raw.testMode = { reason: 'please let me run single-provider' };
  assert.throws(
    () => validateConfig(raw),
    (err: unknown) => err instanceof RouterConfigError && /testMode is no longer supported/.test(err.message),
  );
});

test('a testMode block is refused even on a perfectly decorrelated config', () => {
  const raw = pairing('gpt-5', 'claude-sonnet-5');
  raw.testMode = { reason: 'harmless, surely' };
  assert.throws(() => validateConfig(raw), /testMode is no longer supported/);
});

// ── 4 · the shipped posture ──────────────────────────────────────────────────────────────────

test('SHIPPED CONFIG LOADS: OpenAI synthesis, Agnes verifier, decorrelated', () => {
  const config = loadConfig(defaultConfigPath());
  assert.equal(config.nodes.synthesis.model, 'gpt-5');
  assert.equal(familyOf(config, config.nodes.synthesis.model), 'openai');
  // #307: Anthropic is off-limits this run, so Agnes is the only remaining legal verifier family.
  // The INVARIANT is unchanged — the verifier must not share a family with synthesis; only which
  // family satisfies it has moved.
  assert.equal(config.nodes.verifier.model, 'agnes-2.5-flash');
  assert.equal(familyOf(config, config.nodes.verifier.model), 'agnes');
  assert.notEqual(
    familyOf(config, config.nodes.synthesis.model),
    familyOf(config, config.nodes.verifier.model),
  );
});

test('SHIPPED CONFIG REFUSES to load when verifier and synthesis share a family', () => {
  // The shipped file, minimally mutated back to a single-provider posture.
  const shipped = loadConfig(defaultConfigPath());
  const sameFamily = {
    ...shipped,
    nodes: { ...shipped.nodes, verifier: { ...shipped.nodes.verifier, model: 'gpt-5' } },
  };
  assert.throws(
    () => validateConfig(sameFamily),
    (err: unknown) =>
      err instanceof RouterConfigError &&
      /decorrelation violated/.test(err.message) &&
      /SAME vendor family/.test(err.message),
  );
});

/**
 * #307 · The Agnes verifier is ACCEPTANCE-ONLY, and that is the point.
 *
 * `callApiWorker` refuses family `agnes` when `req.acceptance` is undefined
 * (`apiWorker.ts`: "Agnes is acceptance-only"), while the acceptance branch immediately below it
 * sanctions exactly `nodeId === 'verifier' && family === 'agnes'`. So Agnes-as-verifier is a
 * DESIGNED combination that must carry an acceptance context — which brings the attempt journal,
 * the validated authorization, and the per-logical-call POST cap with it.
 *
 * That matters more than usual here: Agnes is priced free, so the per-day USD ledger cannot bound
 * this node. The acceptance journal and call cap are what bound it instead. Relaxing this guard to
 * let Agnes onto the plain route would remove the journal AND the USD bound at the same time,
 * leaving the verifier completely unconstrained — so the guard stays, and this test pins it.
 */
test('shipped config: the Agnes verifier is REFUSED on the plain route, every other node hits OpenAI', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'llm-router-decorr-'));
  try {
    const config = loadConfig(defaultConfigPath());
    const calls: Array<{ url: string; model: string }> = [];
    const fetchFn: FetchLike = async (url, init) => {
      const body = JSON.parse(String(init.body)) as { model: string };
      calls.push({ url, model: body.model });
      // Agnes speaks the OpenAI chat-completions wire shape, so its response body is the
      // OpenAI-shaped one; only the URL differs.
      return url === ANTHROPIC_MESSAGES_URL
        ? jsonResponse(200, anthropicBody('ok', 100, 50))
        : jsonResponse(200, openaiBody('ok', 100, 50));
    };
    const router = new LlmRouter({
      config,
      runId: 'run-decorr',
      ledgerPath: join(dir, 'ledger.json'),
      env: {
        OPENAI_API_KEY: 'test-openai-key',
        ANTHROPIC_API_KEY: 'test-anthropic-key',
        AGNES_API_KEY: 'test-agnes-key',
      },
      fetchFn,
      now: () => DAY1_NOON,
    });

    const meteredNodes = LLM_NODE_IDS.filter((nodeId) => nodeId !== 'verifier');

    // The verifier is refused OUTRIGHT on the plain route — no fetch, no ledger entry.
    await assert.rejects(
      () => router.route({ nodeId: 'verifier', prompt: 'hello from verifier' }),
      (err: unknown) =>
        err instanceof RouterConfigError && /Agnes is acceptance-only/.test(err.message),
      'a free-priced Agnes verifier must never dispatch without an acceptance context',
    );
    assert.equal(calls.length, 0, 'the refusal happens BEFORE any HTTP call');

    for (const nodeId of meteredNodes) {
      const res = await router.route({ nodeId, prompt: `hello from ${nodeId}` });
      assert.equal(res.route, 'api_worker');
      // None of these is decorrelated from synthesis — they are all OpenAI, as is synthesis.
      assert.equal(
        res.modelIdentity.decorrelatedFromSynthesis,
        false,
        `${nodeId} decorrelation verdict`,
      );
    }

    assert.equal(calls.length, meteredNodes.length);
    for (const [i, nodeId] of meteredNodes.entries()) {
      assert.equal(calls[i]!.url, OPENAI_CHAT_COMPLETIONS_URL, `${nodeId} endpoint`);
      assert.equal(calls[i]!.model, config.nodes[nodeId].model, `${nodeId} sends its configured model`);
    }

    // Every node that DID dispatch is counted in the ledger with a positive metered cost. The
    // verifier appears nowhere, because it never dispatched.
    const state = router.budgetState();
    for (const nodeId of meteredNodes) {
      assert.equal(state.nodes[nodeId]?.calls, 1, `${nodeId} recorded in ledger`);
      assert.ok((state.nodes[nodeId]?.usd ?? 0) > 0, `${nodeId} recorded USD spend`);
    }
    assert.equal(state.nodes.verifier?.calls ?? 0, 0, 'the refused verifier call is not billed');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
