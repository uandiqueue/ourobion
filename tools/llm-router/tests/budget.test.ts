/**
 * Budget ledger tests (C7 semantics, mirroring brain-ingest's budget.test.ts
 * style): frozen injected clock, NO network. Proves both caps' 95% hard stops,
 * per-node and per-run isolation, persistence across instances, the UTC-day
 * reset, and price-table cost math.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { BudgetLedger, DEFAULT_RETENTION_DAYS, costUsd, utcDayKey } from '../src/budget.js';
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

test('missing ledger starts clean; corrupt historical ledger fails closed', () => {
  const { dir, ledgerPath } = freshLedgerPath();
  try {
    const config = testConfig();
    const fresh = new BudgetLedger({ config, ledgerPath, now: () => DAY1_NOON });
    assert.equal(fresh.nodeSpendToday('seeder').calls, 0);
    assert.equal(fresh.runOutputTokens('nope'), 0);
    assert.equal(fresh.state().day, utcDayKey(DAY1_NOON));

    writeFileSync(ledgerPath, '{"version":1,"days":', 'utf8');
    assert.throws(
      () => new BudgetLedger({ config, ledgerPath, now: () => DAY1_NOON }),
      /cannot (?:load|parse) existing ledger.*refusing to reset spend/i,
    );
    writeFileSync(
      ledgerPath,
      JSON.stringify({
        version: 1,
        days: { '2026-07-15': { synthesis: { calls: -1, inputTokens: 0, outputTokens: 0, usd: 0 } } },
        runs: {},
      }),
      'utf8',
    );
    assert.throws(
      () => new BudgetLedger({ config, ledgerPath, now: () => DAY1_NOON }),
      /malformed counter/,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// A11 — retention pruning
// ---------------------------------------------------------------------------

const MS_PER_DAY = 86_400_000;

test('A11: an old ledger file (pre-retention format, missing runs map) loads fine and gets pruned', () => {
  const { dir, ledgerPath } = freshLedgerPath();
  try {
    // A version-1 file with no `runs` key at all — the shape an older/hand-
    // edited ledger might carry. Must load without error.
    writeFileSync(
      ledgerPath,
      JSON.stringify({
        version: 1,
        days: {
          [utcDayKey(DAY1_NOON - 40 * MS_PER_DAY)]: { synthesis: { calls: 9, inputTokens: 9, outputTokens: 9, usd: 9 } },
          [utcDayKey(DAY1_NOON)]: { synthesis: { calls: 1, inputTokens: 10, outputTokens: 20, usd: 0.3 } },
        },
      }),
      'utf8',
    );

    const ledger = new BudgetLedger({ config: testConfig(), ledgerPath, now: () => DAY1_NOON });
    // Today's counter survived; the 40-day-old day is already gone in memory.
    assert.equal(ledger.nodeSpendToday('synthesis').calls, 1);
    assert.deepEqual(Object.keys(ledger.state().nodes), ['synthesis']);

    // A record persists the pruned state: the old day is gone ON DISK too.
    ledger.record('verifier', 'run-A', 'gpt-5', { inputTokens: 1, outputTokens: 1 });
    const onDisk = JSON.parse(readFileSync(ledgerPath, 'utf8')) as {
      days: Record<string, unknown>;
      runs: Record<string, unknown>;
    };
    assert.deepEqual(Object.keys(onDisk.days).sort(), [utcDayKey(DAY1_NOON)]);
    assert.deepEqual(Object.keys(onDisk.runs), ['run-A']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('A11: retention boundary — the day exactly retentionDays ago is KEPT, one older is dropped; same for runs', () => {
  const { dir, ledgerPath } = freshLedgerPath();
  try {
    const boundaryMs = DAY1_NOON - DEFAULT_RETENTION_DAYS * MS_PER_DAY;
    const tooOldMs = boundaryMs - MS_PER_DAY;
    const counter = { calls: 1, inputTokens: 1, outputTokens: 1, usd: 0.01 };
    writeFileSync(
      ledgerPath,
      JSON.stringify({
        version: 1,
        days: {
          [utcDayKey(tooOldMs)]: { synthesis: counter },
          [utcDayKey(boundaryMs)]: { synthesis: counter },
          [utcDayKey(DAY1_NOON)]: { synthesis: counter },
        },
        runs: {
          'run-too-old': { startedAt: new Date(tooOldMs).toISOString(), outputTokens: 10 },
          'run-boundary': { startedAt: new Date(boundaryMs).toISOString(), outputTokens: 20 },
        },
      }),
      'utf8',
    );

    const ledger = new BudgetLedger({ config: testConfig(), ledgerPath, now: () => DAY1_NOON });
    ledger.record('synthesis', 'run-new', 'claude-sonnet-5', { inputTokens: 1, outputTokens: 1 });

    const onDisk = JSON.parse(readFileSync(ledgerPath, 'utf8')) as {
      days: Record<string, unknown>;
      runs: Record<string, { outputTokens: number }>;
    };
    assert.deepEqual(Object.keys(onDisk.days).sort(), [utcDayKey(boundaryMs), utcDayKey(DAY1_NOON)].sort());
    // Boundary run retained; strictly-older run pruned. Malformed history is
    // covered separately and fails closed rather than being silently erased.
    assert.deepEqual(Object.keys(onDisk.runs).sort(), ['run-boundary', 'run-new']);
    assert.equal(onDisk.runs['run-boundary']?.outputTokens, 20);
    // state() lists only retained runs (bounded report).
    assert.deepEqual(Object.keys(ledger.state().runs).sort(), ['run-boundary', 'run-new']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('A11: budget.retentionDays overrides the 30-day default', () => {
  const { dir, ledgerPath } = freshLedgerPath();
  try {
    const config = testConfig((raw) => {
      raw.budget.retentionDays = 7;
    });
    const keptMs = DAY1_NOON - 7 * MS_PER_DAY;
    const droppedMs = DAY1_NOON - 8 * MS_PER_DAY;
    const counter = { calls: 1, inputTokens: 1, outputTokens: 1, usd: 0.01 };
    writeFileSync(
      ledgerPath,
      JSON.stringify({
        version: 1,
        days: { [utcDayKey(keptMs)]: { seeder: counter }, [utcDayKey(droppedMs)]: { seeder: counter } },
        runs: {},
      }),
      'utf8',
    );

    const ledger = new BudgetLedger({ config, ledgerPath, now: () => DAY1_NOON });
    ledger.record('seeder', 'run-A', 'claude-sonnet-5', { inputTokens: 1, outputTokens: 1 });
    const onDisk = JSON.parse(readFileSync(ledgerPath, 'utf8')) as { days: Record<string, unknown> };
    assert.deepEqual(Object.keys(onDisk.days).sort(), [utcDayKey(keptMs), utcDayKey(DAY1_NOON)].sort());
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// A10 — concurrent writers merge instead of last-write-wins
// ---------------------------------------------------------------------------

test('A10: two interleaved writers on one ledger file — totals sum, no lost updates', () => {
  const { dir, ledgerPath } = freshLedgerPath();
  try {
    const config = testConfig();
    // Both constructed BEFORE any spend — the classic last-write-wins setup.
    const p1 = new BudgetLedger({ config, ledgerPath, now: () => DAY1_NOON });
    const p2 = new BudgetLedger({ config, ledgerPath, now: () => DAY1_NOON });

    // sonnet-5 = $3/M in, $15/M out → each of these records costs $0.45.
    p1.record('synthesis', 'run-A', 'claude-sonnet-5', { inputTokens: 100_000, outputTokens: 10_000 });
    p2.record('synthesis', 'run-A', 'claude-sonnet-5', { inputTokens: 100_000, outputTokens: 10_000 });
    p1.record('synthesis', 'run-B', 'claude-sonnet-5', { inputTokens: 0, outputTokens: 20_000 }); // $0.30

    // On disk: the SUM of all three records — nothing dropped.
    const onDisk = JSON.parse(readFileSync(ledgerPath, 'utf8')) as {
      days: Record<string, Record<string, { calls: number; inputTokens: number; outputTokens: number; usd: number }>>;
      runs: Record<string, { outputTokens: number }>;
    };
    const day = onDisk.days[utcDayKey(DAY1_NOON)]?.synthesis;
    assert.equal(day?.calls, 3);
    assert.equal(day?.inputTokens, 200_000);
    assert.equal(day?.outputTokens, 40_000);
    assert.ok(Math.abs((day?.usd ?? 0) - 1.2) < 1e-9);
    // run-A unions BOTH writers' tokens; run-B is p1-only.
    assert.equal(onDisk.runs['run-A']?.outputTokens, 20_000);
    assert.equal(onDisk.runs['run-B']?.outputTokens, 20_000);

    // Each instance's own view reflects the merged totals after its last record.
    assert.equal(p1.nodeSpendToday('synthesis').calls, 3);
    assert.equal(p1.runOutputTokens('run-A'), 20_000);
    assert.equal(p2.nodeSpendToday('synthesis').calls, 2); // p2 hasn't re-merged since its record
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('A10 boundary: the day-USD hard stop fires on MERGED totals no single writer reached alone', () => {
  const { dir, ledgerPath } = freshLedgerPath();
  try {
    const config = testConfig((raw) => {
      raw.budget.perRunOutputTokens = 100_000_000; // token cap out of the way
    }); // $5/day/node → hard stop $4.75
    const p1 = new BudgetLedger({ config, ledgerPath, now: () => DAY1_NOON });
    const p2 = new BudgetLedger({ config, ledgerPath, now: () => DAY1_NOON });

    // Each writer alone spends $2.40 — comfortably under $4.75…
    p1.record('synthesis', 'run-1', 'claude-sonnet-5', { inputTokens: 0, outputTokens: 160_000 });
    p2.record('synthesis', 'run-2', 'claude-sonnet-5', { inputTokens: 0, outputTokens: 160_000 });
    // …but p2 merged p1's spend during its record: combined $4.80 ≥ $4.75.
    assert.ok(Math.abs(p2.nodeSpendToday('synthesis').usd - 4.8) < 1e-9);
    assert.equal(
      p2.wouldExceed('synthesis', 'run-2', 'claude-sonnet-5', { inputTokens: 0, outputTokens: 1 }),
      'day_usd',
    );
    assert.throws(
      () => p2.assertCanSpend('synthesis', 'run-2', 'claude-sonnet-5', { inputTokens: 0, outputTokens: 1 }),
      (err: unknown) => err instanceof RouterBudgetExceededError && err.cap === 'day_usd',
    );

    // p1's view is one record stale ($2.40); its NEXT record merges and its
    // gate then refuses too.
    p1.record('synthesis', 'run-1', 'claude-sonnet-5', { inputTokens: 0, outputTokens: 100 });
    assert.equal(
      p1.wouldExceed('synthesis', 'run-1', 'claude-sonnet-5', { inputTokens: 0, outputTokens: 1 }),
      'day_usd',
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('A10 boundary: the per-run token hard stop fires on run tokens merged across writers', () => {
  const { dir, ledgerPath } = freshLedgerPath();
  try {
    const config = testConfig((raw) => {
      raw.budget.perDayUsdPerNode = 1_000_000; // USD cap out of the way
    }); // 200k/run → hard stop 190k
    const p1 = new BudgetLedger({ config, ledgerPath, now: () => DAY1_NOON });
    const p2 = new BudgetLedger({ config, ledgerPath, now: () => DAY1_NOON });

    p1.record('phrasing_card', 'run-A', 'claude-haiku-4-5', { inputTokens: 0, outputTokens: 100_000 });
    p2.record('phrasing_card', 'run-A', 'claude-haiku-4-5', { inputTokens: 0, outputTokens: 85_000 });

    // p2 sees the merged 185k for run-A: +5,000 hits the 190k line → refused.
    assert.equal(p2.runOutputTokens('run-A'), 185_000);
    assert.equal(
      p2.wouldExceed('phrasing_card', 'run-A', 'claude-haiku-4-5', { inputTokens: 0, outputTokens: 5_000 }),
      'run_tokens',
    );
    // +4,999 → 189,999 < 190,000: still allowed (boundary intact post-merge).
    assert.equal(
      p2.wouldExceed('phrasing_card', 'run-A', 'claude-haiku-4-5', { inputTokens: 0, outputTokens: 4_999 }),
      undefined,
    );
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
