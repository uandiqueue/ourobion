/**
 * Config validation tests — the DECORRELATION INVARIANT is the load-bearing
 * check (memory 0013 / architecture §10.1): no config with a same-family or
 * Anthropic-family verifier can be constructed. node:test, run via tsx.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { defaultConfigPath, familyOf, loadConfig, providerFor, validateConfig } from '../src/config.js';
import { RouterConfigError } from '../src/errors.js';
import { baseConfigObject, testConfig } from './helpers.js';

test('the shipped router.config.json loads, validates, and honours decorrelation', () => {
  const config = loadConfig(defaultConfigPath());
  // C6: synthesis sonnet-5, cheap tier haiku-4-5, verifier gpt-5-family.
  assert.equal(config.nodes.synthesis.model, 'claude-sonnet-5');
  assert.equal(config.nodes.phrasing_card.model, 'claude-haiku-4-5');
  assert.equal(config.nodes.extract_assist.model, 'claude-haiku-4-5');
  assert.equal(config.nodes.report_narrative.model, 'claude-sonnet-5');
  assert.equal(familyOf(config, config.nodes.verifier.model), 'openai');
  assert.notEqual(familyOf(config, config.nodes.verifier.model), 'anthropic');
  // C7 caps: 200k output tokens/run, US$5/day/node, 95% hard stop.
  assert.equal(config.budget.perRunOutputTokens, 200000);
  assert.equal(config.budget.perDayUsdPerNode, 5.0);
  assert.equal(config.budget.hardStopFraction, 0.95);
  // Shipped prices are all explicitly provisional.
  for (const price of Object.values(config.prices)) {
    assert.equal(price.provisional, true);
  }
});

test('a well-formed config validates and provider prefixes resolve families', () => {
  const config = testConfig();
  assert.equal(familyOf(config, 'claude-sonnet-5'), 'anthropic');
  assert.equal(familyOf(config, 'gpt-5'), 'openai');
  assert.equal(familyOf(config, 'gemini-2.5-pro'), 'google');
  assert.equal(providerFor(config, 'claude-haiku-4-5')?.envKey, 'ANTHROPIC_API_KEY');
});

test('DECORRELATION: an Anthropic-family verifier is refused at load', () => {
  assert.throws(
    () =>
      testConfig((raw) => {
        raw.nodes.verifier.model = 'claude-haiku-4-5';
      }),
    (err: unknown) =>
      err instanceof RouterConfigError && /non-Anthropic|decorrelation/.test(err.message),
  );
});

test('DECORRELATION: synthesis and verifier in the same family is refused', () => {
  assert.throws(
    () =>
      testConfig((raw) => {
        // Both openai: still non-Anthropic verifier, but same-family — must fail.
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
