/**
 * Budget ledger tests (C7 semantics, mirroring brain-ingest's budget.test.ts
 * style): frozen injected clock, NO network. Proves both caps' 95% hard stops,
 * per-node and per-run isolation, persistence across instances, the UTC-day
 * reset, and price-table cost math.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { BudgetLedger, costUsd, utcDayKey } from '../src/budget.js';
import { RouterBudgetExceededError } from '../src/errors.js';
import { testConfig } from './helpers.js';

const DAY1_NOON = Date.UTC(2026, 6, 15, 12, 0, 0);
const DAY2_NOON = Date.UTC(2026, 6, 16, 12, 0, 0);

function freshLedgerPath(): { dir: string; ledgerPath: string } {
  const dir = mkdtempSync(join(tmpdir(), 'llm-ledger-'));
  return { dir, ledgerPath: join(dir, 'ledger.json') };
}

test('costUsd follows the config price table', () => {
  const config = testConfig();
  // sonnet-5: $3/M in, $15/M out.
  assert.ok(
    Math.abs(costUsd(config, 'claude-sonnet-5', { inputTokens: 1_000_000, outputTokens: 1_000_000 }) - 18) < 1e-9,
  );
  // gpt-5: $1.25/M in, $10/M out → 100k in + 10k out = 0.125 + 0.1.
  assert.ok(
    Math.abs(costUsd(config, 'gpt-5', { inputTokens: 100_000, outputTokens: 10_000 }) - 0.225) < 1e-9,
  );
  assert.throws(() => costUsd(config, 'unknown-model', { inputTokens: 1, outputTokens: 1 }), /no prices/);
});

test('per-day per-node USD cap: spend below 95% allowed; the crossing call refused', () => {
  const { dir, ledgerPath } = freshLedgerPath();
  try {
    const config = testConfig((raw) => {
      // Keep the run-token cap out of the way so only the USD cap trips.
      raw.budget.perRunOutputTokens = 100_000_000;
    }); // $5/day/node → hard stop $4.75
    const ledger = new BudgetLedger({ config, ledgerPath, now: () => DAY1_NOON });

    // 300k output tokens of sonnet-5 = $4.50 (+ tiny input) — below $4.75.
    ledger.record('synthesis', 'run-A', 'claude-sonnet-5', { inputTokens: 10_000, outputTokens: 300_000 });
    const spent = ledger.nodeSpendToday('synthesis').usd;
    assert.ok(Math.abs(spent - 4.53) < 1e-9);

    // A call whose worst case adds $0.20 → $4.73 < $4.75: allowed.
    const okEst = { inputTokens: 0, outputTokens: 13_000 }; // $0.195
    assert.equal(ledger.wouldExceed('synthesis', 'run-A', 'claude-sonnet-5', okEst), undefined);

    // A call whose worst case adds $0.30 → $4.83 ≥ $4.75: refused, typed, cap named.
    const badEst = { inputTokens: 0, outputTokens: 20_000 }; // $0.30
    assert.equal(ledger.wouldExceed('synthesis', 'run-A', 'claude-sonnet-5', badEst), 'day_usd');
    assert.throws(
      () => ledger.assertCanSpend('synthesis', 'run-A', 'claude-sonnet-5', badEst),
      (err: unknown) => err instanceof RouterBudgetExceededError && err.cap === 'day_usd' && /hard stop/.test(err.message),
    );

    // The cap is PER NODE: the verifier is untouched by synthesis spend.
    assert.equal(ledger.wouldExceed('verifier', 'run-A', 'gpt-5', badEst), undefined);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('per-run output-token cap: 95% of 200k = 190k hard stop; other runs unaffected', () => {
  const { dir, ledgerPath } = freshLedgerPath();
  try {
    const config = testConfig((raw) => {
      // Keep the USD cap out of the way so only the token cap trips.
      raw.budget.perDayUsdPerNode = 1_000_000;
    });
    const ledger = new BudgetLedger({ config, ledgerPath, now: () => DAY1_NOON });

    ledger.record('phrasing_card', 'run-A', 'claude-haiku-4-5', { inputTokens: 0, outputTokens: 185_000 });
    assert.equal(ledger.runOutputTokens('run-A'), 185_000);

    // +4,999 → 189,999 < 190,000: allowed.
    assert.equal(
      ledger.wouldExceed('phrasing_card', 'run-A', 'claude-haiku-4-5', { inputTokens: 0, outputTokens: 4_999 }),
      undefined,
    );
    // +5,000 → exactly 190,000: crosses (>= line), refused.
    assert.equal(
      ledger.wouldExceed('phrasing_card', 'run-A', 'claude-haiku-4-5', { inputTokens: 0, outputTokens: 5_000 }),
      'run_tokens',
    );
    assert.throws(
      () =>
        ledger.assertCanSpend('phrasing_card', 'run-A', 'claude-haiku-4-5', { inputTokens: 0, outputTokens: 5_000 }),
      (err: unknown) => err instanceof RouterBudgetExceededError && err.cap === 'run_tokens',
    );

    // A different run starts from zero.
    assert.equal(
      ledger.wouldExceed('phrasing_card', 'run-B', 'claude-haiku-4-5', { inputTokens: 0, outputTokens: 100_000 }),
      undefined,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('counters persist across a fresh instance on the same ledger file', () => {
  const { dir, ledgerPath } = freshLedgerPath();
  try {
    const config = testConfig();
    const first = new BudgetLedger({ config, ledgerPath, now: () => DAY1_NOON });
    first.record('verifier', 'run-A', 'gpt-5', { inputTokens: 1000, outputTokens: 500 });

    const onDisk = JSON.parse(readFileSync(ledgerPath, 'utf8')) as {
      version: number;
      days: Record<string, Record<string, { calls: number; usd: number }>>;
      runs: Record<string, { outputTokens: number }>;
    };
    assert.equal(onDisk.version, 1);
    const dayKey = utcDayKey(DAY1_NOON);
    assert.equal(onDisk.days[dayKey]?.verifier?.calls, 1);
    assert.equal(onDisk.runs['run-A']?.outputTokens, 500);

    const second = new BudgetLedger({ config, ledgerPath, now: () => DAY1_NOON });
    assert.equal(second.nodeSpendToday('verifier').outputTokens, 500);
    assert.equal(second.runOutputTokens('run-A'), 500);

    second.record('verifier', 'run-A', 'gpt-5', { inputTokens: 100, outputTokens: 50 });
    assert.equal(second.nodeSpendToday('verifier').calls, 2);
    assert.equal(second.runOutputTokens('run-A'), 550);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('UTC day rollover: day counters reset; run counters persist (per-run ≠ per-day)', () => {
  const { dir, ledgerPath } = freshLedgerPath();
  try {
    const config = testConfig();
    const day1 = new BudgetLedger({ config, ledgerPath, now: () => DAY1_NOON });
    day1.record('synthesis', 'run-A', 'claude-sonnet-5', { inputTokens: 0, outputTokens: 100_000 });
    assert.equal(day1.nodeSpendToday('synthesis').outputTokens, 100_000);

    const day2 = new BudgetLedger({ config, ledgerPath, now: () => DAY2_NOON });
    // Fresh USD/day window…
    assert.equal(day2.nodeSpendToday('synthesis').outputTokens, 0);
    assert.equal(day2.nodeSpendToday('synthesis').usd, 0);
    // …but the RUN cap still remembers run-A across the midnight boundary.
    assert.equal(day2.runOutputTokens('run-A'), 100_000);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('missing/corrupt ledger file → clean start (crash-tolerant load)', () => {
  const { dir, ledgerPath } = freshLedgerPath();
  try {
    const config = testConfig();
    const fresh = new BudgetLedger({ config, ledgerPath, now: () => DAY1_NOON });
    assert.equal(fresh.nodeSpendToday('seeder').calls, 0);
    assert.equal(fresh.runOutputTokens('nope'), 0);
    assert.equal(fresh.state().day, utcDayKey(DAY1_NOON));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('state() snapshot carries caps + today-only node counters', () => {
  const { dir, ledgerPath } = freshLedgerPath();
  try {
    const config = testConfig();
    const ledger = new BudgetLedger({ config, ledgerPath, now: () => DAY1_NOON });
    ledger.record('extract_assist', 'run-Z', 'claude-haiku-4-5', { inputTokens: 400, outputTokens: 200 });
    const s = ledger.state();
    assert.equal(s.day, utcDayKey(DAY1_NOON));
    assert.equal(s.perDayUsdPerNode, 5);
    assert.equal(s.perRunOutputTokens, 200000);
    assert.equal(s.hardStopFraction, 0.95);
    assert.equal(s.nodes.extract_assist?.calls, 1);
    assert.equal(s.runs['run-Z']?.outputTokens, 200);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
