/**
 * O10 projection builder tests (publish.ts, run-2 U8): pure, offline — no
 * network, no filesystem. Proves the status/spend row shapes nao's /models
 * panel reads match the config + ledger sources of truth, including the
 * TEST-MODE flag and the (day, node) spend fan-out.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { LedgerFile } from '../src/budget.js';
import { buildStatusRows } from '../src/publish.js';
import { LLM_NODE_IDS } from '../src/types.js';
import { testConfig } from './helpers.js';

const PUBLISHED_AT = '2026-07-24T12:00:00.000Z';

function emptyLedger(): LedgerFile {
  return { version: 1, days: {}, runs: {} };
}

test('status: one row per node in LLM_NODE_IDS order, fields projected from config', () => {
  const config = testConfig();
  const { status } = buildStatusRows(config, emptyLedger(), PUBLISHED_AT);

  assert.equal(status.length, LLM_NODE_IDS.length);
  assert.deepEqual(
    status.map((r) => r.node),
    [...LLM_NODE_IDS],
  );
  const synthesis = status.find((r) => r.node === 'synthesis')!;
  assert.equal(synthesis.model_id, config.nodes.synthesis.model);
  assert.equal(synthesis.route, config.nodes.synthesis.route);
  assert.equal(synthesis.max_output_tokens, config.nodes.synthesis.maxOutputTokens);
  // Caps are the FILE values (global-per-node config projected per row).
  assert.equal(synthesis.per_day_usd_cap, config.budget.perDayUsdPerNode);
  assert.equal(synthesis.per_run_token_cap, config.budget.perRunOutputTokens);
  assert.equal(synthesis.hard_stop_fraction, config.budget.hardStopFraction);
  assert.equal(synthesis.published_at, PUBLISHED_AT);
});

test('status: test_mode is ALWAYS false now — no config can request it (R4-U3)', () => {
  // The `testMode` config block was removed with the decorrelation downgrade it
  // enabled; the projected column is retained (no migration) but pinned false.
  const { status } = buildStatusRows(testConfig(), emptyLedger(), PUBLISHED_AT);
  for (const row of status) {
    assert.equal(row.test_mode, false);
    assert.equal(row.test_mode_reason, null);
  }
});

test('spend: (day, node) fan-out, day-then-node sorted, counters mapped', () => {
  const ledger: LedgerFile = {
    version: 1,
    days: {
      '2026-07-24': {
        phrasing_card: { calls: 1, inputTokens: 13, outputTokens: 74, usd: 0.00015125 },
        verifier: { calls: 3, inputTokens: 150, outputTokens: 90, usd: 0.0010875 },
      },
      '2026-07-23': {
        synthesis: { calls: 2, inputTokens: 1000, outputTokens: 500, usd: 0.00625 },
      },
    },
    runs: { 'run-a': { startedAt: '2026-07-24T07:14:30.369Z', outputTokens: 74 } },
  };
  const { spend } = buildStatusRows(testConfig(), ledger, PUBLISHED_AT);

  // Days ascending; within a day, LLM_NODE_IDS order (verifier before phrasing_card).
  assert.deepEqual(
    spend.map((r) => `${r.day}/${r.node}`),
    ['2026-07-23/synthesis', '2026-07-24/verifier', '2026-07-24/phrasing_card'],
  );
  const pc = spend.find((r) => r.node === 'phrasing_card')!;
  assert.equal(pc.calls, 1);
  assert.equal(pc.tokens_in, 13);
  assert.equal(pc.tokens_out, 74);
  assert.equal(pc.usd, 0.00015125);
  assert.equal(pc.published_at, PUBLISHED_AT);
  // Run counters are deliberately NOT projected.
  assert.equal(spend.length, 3);
});

test('spend: empty/absent days → zero rows (config-only publish)', () => {
  const { spend } = buildStatusRows(testConfig(), emptyLedger(), PUBLISHED_AT);
  assert.equal(spend.length, 0);
  const noDays = buildStatusRows(testConfig(), { version: 1 } as LedgerFile, PUBLISHED_AT);
  assert.equal(noDays.spend.length, 0);
});
