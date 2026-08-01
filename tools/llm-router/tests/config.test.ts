/**
 * Config validation tests — shape, families, prices, budget sanity.
 *
 * The DECORRELATION INVARIANT itself (`family(verifier) !== family(synthesis)`)
 * has its own suite in `decorrelation.test.ts`; only the two cases that belong
 * to ordinary shape validation are duplicated here. node:test, run via tsx.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { billingModeOf, defaultConfigPath, familyOf, loadConfig, priceIsAuthoritativeAt, providerFor, validateConfig } from '../src/config.js';
import { RouterConfigError } from '../src/errors.js';
import { baseConfigObject, testConfig } from './helpers.js';

test('the shipped router.config.json loads: run-4 OpenAI + Agnes-verifier posture (C13)', () => {
  const config = loadConfig(defaultConfigPath());
  // C13 posture, revised on #307: OpenAI drives everything except the verifier, which is AGNES.
  //
  // It was Anthropic. The owner put Anthropic off-limits for this run (US$3 budget, do not use)
  // while synthesis stays on OpenAI, and the decorrelation invariant is unconditional —
  // family(verifier) !== family(synthesis) — so of the configured providers Agnes is the ONLY
  // legal verifier left. Leaving it on claude-sonnet-5 would either spend forbidden Anthropic
  // budget or fail closed at config load.
  //
  // CONSEQUENCE, ASSERTED EXPLICITLY BELOW RATHER THAN LEFT IMPLICIT: agnes-2.5-flash is priced
  // free (owner-confirmed plan), so it reserves exactly US$0 and the per-day USD ledger cannot
  // bound the verifier node at all. The 50-call Agnes ceiling is an OPERATOR cap, not a system
  // limit. That is a real reduction in automatic budget protection for this node, and it is the
  // reason the shipped config previously refused to let any node use Agnes.
  assert.equal(config.nodes.synthesis.model, 'gpt-5');
  assert.equal(config.nodes.verifier.model, 'agnes-2.5-flash');
  assert.equal(config.nodes.seeder.model, 'gpt-5-mini');
  assert.equal(config.nodes.phrasing_card.model, 'gpt-5-mini');
  assert.equal(config.nodes.extract_assist.model, 'gpt-5-mini');
  assert.equal(config.nodes.report_narrative.model, 'gpt-5-mini');
  for (const [nodeId, node] of Object.entries(config.nodes)) {
    assert.equal(node.route, 'api_worker');
    assert.equal(familyOf(config, node.model), nodeId === 'verifier' ? 'agnes' : 'openai');
  }
  // Anthropic must not drive ANY node this run, even though its provider entry and price row
  // remain configured (a future run may re-enable it).
  assert.ok(
    Object.values(config.nodes).every((node) => familyOf(config, node.model) !== 'anthropic'),
    'no node may route to Anthropic while it is off-limits',
  );
  // No test-mode escape hatch survives in the shipped file (R4-U3).
  assert.equal((config as unknown as Record<string, unknown>).testMode, undefined);
  // C7 caps. US$8/day/node, 60k output tokens/run. The day cap was US$1 until a real
  // 60-paper synthesis batch stopped after 12 papers; at ~US$0.04/paper US$1 buys ~22.
  // It is 8 and not the owner's stated US$20 account ceiling because this value applies to
  // EVERY node, and five nodes route to OpenAI — 20 each would permit ~US$100/day.
  assert.equal(config.budget.perRunOutputTokens, 60000);
  assert.equal(config.budget.perDayUsdPerNode, 8.0);
  assert.equal(config.budget.hardStopFraction, 0.95);
  const agnesPrice = config.prices['agnes-2.5-flash']!;
  assert.equal(billingModeOf(agnesPrice), 'free');
  assert.equal(agnesPrice.inputUsdPerMTok, 0);
  assert.equal(agnesPrice.outputUsdPerMTok, 0);
  assert.equal(agnesPrice.provisional, false);
  assert.match(agnesPrice.pricingProvenance ?? '', /owner-confirmed free Agnes API plan/);
  // Previously: NO node could use Agnes at all, because a free-priced model reserves US$0 and so
  // escapes USD budget accounting. #307 makes the verifier the one sanctioned exception (see the
  // posture note above). Narrowed rather than deleted, so an Agnes model creeping onto any OTHER
  // node — where it would silently escape the budget with no owner decision behind it — still fails.
  for (const [nodeId, node] of Object.entries(config.nodes)) {
    if (nodeId === 'verifier') continue;
    assert.ok(
      !node.model.startsWith('agnes-'),
      `${nodeId} must not use a free-priced Agnes model — only the verifier is sanctioned`,
    );
  }
  for (const [model, price] of Object.entries(config.prices)) {
    if (model === 'agnes-2.5-flash') continue;
    assert.equal(billingModeOf(price), 'metered');
    if (model === 'claude-sonnet-5' || model === 'gpt-5') {
      assert.equal(price.provisional, false);
      assert.equal(priceIsAuthoritativeAt(price, Date.parse('2026-07-31T12:00:00.000Z')), true);
      assert.equal(priceIsAuthoritativeAt(price, Date.parse(price.expiresAt!)), false);
      assert.match(price.pricingProvenance ?? '', /official/i);
    } else {
      assert.equal(price.provisional, true);
    }
  }
  // Every node model has a price row (budget accounting is never blind).
  for (const node of Object.values(config.nodes)) {
    assert.ok(config.prices[node.model] !== undefined, `${node.model} needs a prices[] entry`);
  }
});

test('non-provisional metered pricing requires provenance and a valid finite window', () => {
  const invalid = baseConfigObject();
  invalid.prices['gpt-5'].provisional = false;
  delete invalid.prices['gpt-5'].expiresAt;
  assert.throws(() => validateConfig(invalid), /effectiveFrom\/expiresAt window/);

  const reversed = baseConfigObject();
  reversed.prices['gpt-5'].effectiveFrom = '2027-01-01T00:00:00.000Z';
  reversed.prices['gpt-5'].expiresAt = '2026-01-01T00:00:00.000Z';
  assert.throws(() => validateConfig(reversed), /must precede expiresAt/);
});

test('free billing is explicit exact-zero non-provisional pricing with provenance', () => {
  const valid = testConfig((raw) => {
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
  assert.equal(billingModeOf(valid.prices['agnes-2.5-flash']!), 'free');

  const invalidMutations: Array<(raw: ReturnType<typeof baseConfigObject>) => void> = [
    (raw) => { raw.prices['gpt-5'] = null; },
    (raw) => { raw.prices['gpt-5'].inputUsdPerMTok = 0; },
    (raw) => { raw.prices['gpt-5'].billingMode = 'unknown'; },
    (raw) => {
      raw.prices['agnes-2.5-flash'] = {
        inputUsdPerMTok: 1,
        outputUsdPerMTok: 0,
        billingMode: 'free',
        pricingProvenance: 'owner-confirmed',
        effectiveFrom: '2026-01-01T00:00:00.000Z',
        expiresAt: '2027-01-01T00:00:00.000Z',
        provisional: false,
      };
    },
    (raw) => {
      raw.prices['agnes-2.5-flash'] = {
        inputUsdPerMTok: 0,
        outputUsdPerMTok: 0,
        billingMode: 'free',
        pricingProvenance: '   ',
        effectiveFrom: '2026-01-01T00:00:00.000Z',
        expiresAt: '2027-01-01T00:00:00.000Z',
        provisional: false,
      };
    },
    (raw) => {
      raw.prices['agnes-2.5-flash'] = {
        inputUsdPerMTok: 0,
        outputUsdPerMTok: 0,
        billingMode: 'free',
        pricingProvenance: 'owner-confirmed',
        provisional: true,
      };
    },
  ];
  for (const mutate of invalidMutations) {
    const raw = baseConfigObject();
    mutate(raw);
    assert.throws(() => validateConfig(raw), /must be an object|billingMode|metered billing|free billing|pricingProvenance/);
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

test('acceptance config is one canonical ignored runtime root', () => {
  for (const runtimeRoot of [
    '../escape.jsonl',
    'tools/llm-router/src/router.ts',
    'data/llm-router/another.jsonl',
    'C:\\tmp\\attempts.jsonl',
  ]) {
    const raw = baseConfigObject();
    raw.acceptance = { runtimeRoot };
    assert.throws(() => validateConfig(raw), /must be exactly 'data\/brain-ingest\/live-acceptance'/);
  }
});
