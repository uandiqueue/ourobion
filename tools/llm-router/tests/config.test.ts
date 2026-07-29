/**
 * Config validation tests — shape, families, prices, budget sanity.
 *
 * The DECORRELATION INVARIANT itself (`family(verifier) !== family(synthesis)`)
 * has its own suite in `decorrelation.test.ts`; only the two cases that belong
 * to ordinary shape validation are duplicated here. node:test, run via tsx.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { defaultConfigPath, familyOf, loadConfig, providerFor, validateConfig } from '../src/config.js';
import { RouterConfigError } from '../src/errors.js';
import { baseConfigObject, testConfig } from './helpers.js';

test('the shipped router.config.json loads: run-4 OpenAI + Anthropic-verifier posture (C13)', () => {
  const config = loadConfig(defaultConfigPath());
  // C13 posture: OpenAI drives everything except the verifier, which is Anthropic.
  assert.equal(config.nodes.synthesis.model, 'gpt-5');
  assert.equal(config.nodes.verifier.model, 'claude-sonnet-5');
  assert.equal(config.nodes.seeder.model, 'gpt-5-mini');
  assert.equal(config.nodes.phrasing_card.model, 'gpt-5-mini');
  assert.equal(config.nodes.extract_assist.model, 'gpt-5-mini');
  assert.equal(config.nodes.report_narrative.model, 'gpt-5-mini');
  for (const [nodeId, node] of Object.entries(config.nodes)) {
    assert.equal(node.route, 'api_worker');
    assert.equal(familyOf(config, node.model), nodeId === 'verifier' ? 'anthropic' : 'openai');
  }
  // No test-mode escape hatch survives in the shipped file (R4-U3).
  assert.equal((config as unknown as Record<string, unknown>).testMode, undefined);
  // C7 caps set LOW for the 20-SGD run: US$1/day/node, 60k output tokens/run.
  assert.equal(config.budget.perRunOutputTokens, 60000);
  assert.equal(config.budget.perDayUsdPerNode, 1.0);
  assert.equal(config.budget.hardStopFraction, 0.95);
  // Shipped prices are all explicitly provisional.
  for (const price of Object.values(config.prices)) {
    assert.equal(price.provisional, true);
  }
  // Every node model has a price row (budget accounting is never blind).
  for (const node of Object.values(config.nodes)) {
    assert.ok(config.prices[node.model] !== undefined, `${node.model} needs a prices[] entry`);
  }
});

test('a well-formed config validates and provider prefixes resolve families', () => {
  const config = testConfig();
  assert.equal(familyOf(config, 'claude-sonnet-5'), 'anthropic');
  assert.equal(familyOf(config, 'gpt-5'), 'openai');
  assert.equal(familyOf(config, 'gemini-2.5-pro'), 'google');
  assert.equal(providerFor(config, 'claude-haiku-4-5')?.envKey, 'ANTHROPIC_API_KEY');
});

test('DECORRELATION: synthesis and verifier in the same family is refused', () => {
  assert.throws(
    () =>
      testConfig((raw) => {
        // Both openai — must fail. (Full matrix in decorrelation.test.ts.)
        raw.nodes.synthesis.model = 'gpt-5';
        raw.prices['gpt-5'] = { inputUsdPerMTok: 1.25, outputUsdPerMTok: 10 };
      }),
    (err: unknown) => err instanceof RouterConfigError && /decorrelation/.test(err.message),
  );
});

test('DECORRELATION: a google verifier against anthropic synthesis is fine', () => {
  const config = testConfig((raw) => {
    raw.nodes.verifier.model = 'gemini-2.5-pro';
    raw.prices['gemini-2.5-pro'] = { inputUsdPerMTok: 1.25, outputUsdPerMTok: 10, provisional: true };
  });
  assert.equal(familyOf(config, config.nodes.verifier.model), 'google');
});

test('a missing node entry fails loudly', () => {
  assert.throws(
    () =>
      testConfig((raw) => {
        delete raw.nodes.report_narrative;
      }),
    /nodes\.report_narrative is missing/,
  );
});

test('an unknown node key fails loudly', () => {
  assert.throws(
    () =>
      testConfig((raw) => {
        raw.nodes.mystery_node = { model: 'gpt-5', route: 'api_worker', maxOutputTokens: 100 };
      }),
    /not a known node id/,
  );
});

test('a model with no provider prefix fails loudly', () => {
  assert.throws(
    () =>
      testConfig((raw) => {
        raw.nodes.seeder.model = 'llama-3-70b';
        raw.prices['llama-3-70b'] = { inputUsdPerMTok: 1, outputUsdPerMTok: 1 };
      }),
    /matches no provider prefix/,
  );
});

test('a node model without a price row fails loudly (budget would be blind)', () => {
  assert.throws(
    () =>
      testConfig((raw) => {
        delete raw.prices['gpt-5'];
      }),
    /no prices\[\] entry/,
  );
});

test('an invalid route fails loudly', () => {
  assert.throws(
    () =>
      testConfig((raw) => {
        raw.nodes.seeder.route = 'carrier_pigeon';
      }),
    /route 'carrier_pigeon'/,
  );
});

test('budget sanity: hardStopFraction outside (0,1] fails', () => {
  assert.throws(
    () =>
      testConfig((raw) => {
        raw.budget.hardStopFraction = 1.5;
      }),
    /hardStopFraction/,
  );
  assert.throws(
    () =>
      testConfig((raw) => {
        raw.budget.hardStopFraction = 0;
      }),
    /hardStopFraction/,
  );
});

test('validateConfig rejects non-objects and wrong versions', () => {
  assert.throws(() => validateConfig(null), /must be a JSON object/);
  assert.throws(() => validateConfig({ ...baseConfigObject(), version: 2 }), /version/);
});
