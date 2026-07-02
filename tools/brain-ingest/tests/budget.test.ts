/**
 * Budget guard tests (design §5.1, §10.2) — node:test, run via tsx.
 *
 * Proves, with NO network and a frozen injected clock:
 *  - charging up to (but not crossing) 95% is allowed;
 *  - the charge that would cross 95% is refused (wouldExceed95 true + charge throws);
 *  - counters persist across a fresh instance pointed at the same usage.json;
 *  - a counter whose windowStart is a previous UTC day resets;
 *  - unmetered sources (NCBI/pubmed, and CORE — see below) are a no-op;
 *  - OpenAlex per-request cost model matches §5.1.
 *
 * OpenAlex is the only real metered source now (verified live 2026-07-01 — its
 * `X-RateLimit-*` response headers report exactly `Limit-USD: 1`, resetting at
 * UTC midnight). These generic hard-stop/persistence/reset tests use OpenAlex's
 * real $1.00/$0.95 scale throughout — they used to use CORE's `daily:1000`
 * scale before CORE turned out to have no real daily cap at all (see
 * `limits/budget.ts` and `retrieval/core.ts`'s docstrings) and was removed
 * from `BUDGETS` entirely.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  FileBudgetGuard,
  createBudgetGuard,
  OPENALEX_COST,
  BUDGETS,
  HARD_STOP_FRACTION,
} from '../src/limits/budget.js';

/** A fixed instant: 2026-06-29T12:00:00Z (mid-day, deterministic UTC window). */
const DAY1_NOON = Date.UTC(2026, 5, 29, 12, 0, 0);
/** The next UTC day, used to prove the window reset. */
const DAY2_NOON = Date.UTC(2026, 5, 30, 12, 0, 0);

function freshUsagePath(): { dir: string; usagePath: string } {
  const dir = mkdtempSync(join(tmpdir(), 'brain-budget-'));
  return { dir, usagePath: join(dir, 'usage.json') };
}

test('OpenAlex: charges up to <95% allowed; the charge crossing 95% is refused', () => {
  const { dir, usagePath } = freshUsagePath();
  try {
    const g = new FileBudgetGuard({ usagePath, now: () => DAY1_NOON });
    // OpenAlex daily = $1.00 → hard stop = $0.95.
    const hardStop = BUDGETS.openalex!.daily * HARD_STOP_FRACTION;
    assert.equal(hardStop, 0.95);

    // Charge $0.90 → total $0.90, below $0.95: allowed.
    assert.equal(g.wouldExceed95('openalex', 0.9), false);
    g.charge('openalex', 0.9);
    assert.equal(g.spent('openalex'), 0.9);

    // Next $0.049 → total $0.949 (< $0.95): still allowed.
    assert.equal(g.wouldExceed95('openalex', 0.049), false);
    g.charge('openalex', 0.049);
    assert.ok(Math.abs(g.spent('openalex') - 0.949) < 1e-9);

    // Next $0.001 → total $0.95 == hard stop: this CROSSES the line → refused.
    assert.equal(g.wouldExceed95('openalex', 0.001), true);
    assert.throws(() => g.charge('openalex', 0.001), /95% hard stop/);
    // Spend unchanged after a denied charge.
    assert.ok(Math.abs(g.spent('openalex') - 0.949) < 1e-9);

    // A larger charge that overshoots is also refused.
    assert.equal(g.wouldExceed95('openalex', 0.1), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('boundary: charge landing just below hard stop is allowed', () => {
  const { dir, usagePath } = freshUsagePath();
  try {
    const g = new FileBudgetGuard({ usagePath, now: () => DAY1_NOON });
    // 0.949999 < 0.95 → allowed; 0.95 → refused.
    assert.equal(g.wouldExceed95('openalex', 0.949999), false);
    g.charge('openalex', 0.949999);
    assert.equal(g.wouldExceed95('openalex', 0.000001), true); // 0.95 crosses
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('CORE is intentionally unmetered (no confirmed daily cap — see limits/budget.ts)', () => {
  const { dir, usagePath } = freshUsagePath();
  try {
    assert.equal(BUDGETS.core, undefined, 'CORE must not be in BUDGETS');
    const g = new FileBudgetGuard({ usagePath, now: () => DAY1_NOON });
    // Even an enormous charge never blocks or gets tracked.
    assert.equal(g.wouldExceed95('core', 1e9), false);
    assert.doesNotThrow(() => g.charge('core', 1e9));
    assert.equal(g.spent('core'), 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('counters persist across a fresh instance on the same usage.json', () => {
  const { dir, usagePath } = freshUsagePath();
  try {
    const first = new FileBudgetGuard({ usagePath, now: () => DAY1_NOON });
    first.charge('openalex', OPENALEX_COST.search); // 0.001
    first.charge('openalex', OPENALEX_COST.list); // 0.0001
    const expected = 0.001 + 0.0001;
    assert.ok(Math.abs(first.spent('openalex') - expected) < 1e-12);

    // The file must exist on disk after charging.
    const onDisk = JSON.parse(readFileSync(usagePath, 'utf8')) as {
      counters: { openalex?: { spent: number } };
    };
    assert.ok(Math.abs((onDisk.counters.openalex?.spent ?? 0) - expected) < 1e-12);

    // A brand-new instance (simulated restart) re-reads the same spend.
    const second = createBudgetGuard({ usagePath, now: () => DAY1_NOON });
    assert.ok(Math.abs(second.spent('openalex') - expected) < 1e-12);

    // Continuing to charge accumulates on top of the persisted value.
    second.charge('openalex', OPENALEX_COST.search);
    assert.ok(Math.abs(second.spent('openalex') - (expected + 0.001)) < 1e-12);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a windowStart in a previous UTC day resets the counter', () => {
  const { dir, usagePath } = freshUsagePath();
  try {
    // Hand-write a usage.json whose window is DAY1 with a near-cap spend.
    mkdirSync(dir, { recursive: true });
    const day1Window = new Date(DAY1_NOON);
    const day1Iso = new Date(
      Date.UTC(day1Window.getUTCFullYear(), day1Window.getUTCMonth(), day1Window.getUTCDate()),
    ).toISOString();
    writeFileSync(
      usagePath,
      JSON.stringify({
        version: 1,
        counters: { openalex: { windowStart: day1Iso, spent: 0.94 } },
      }),
      'utf8',
    );

    // Open the guard "the next day" → counter must reset to 0 for the new window.
    const g = new FileBudgetGuard({ usagePath, now: () => DAY2_NOON });
    assert.equal(g.spent('openalex'), 0);
    // And so a full charge is allowed again in the new window.
    assert.equal(g.wouldExceed95('openalex', 0.9), false);
    g.charge('openalex', 0.9);
    assert.equal(g.spent('openalex'), 0.9);

    // The persisted window now reflects DAY2.
    const onDisk = JSON.parse(readFileSync(usagePath, 'utf8')) as {
      counters: { openalex?: { windowStart: string; spent: number } };
    };
    const day2Iso = new Date(Date.UTC(2026, 5, 30)).toISOString();
    assert.equal(onDisk.counters.openalex?.windowStart, day2Iso);
    assert.equal(onDisk.counters.openalex?.spent, 0.9);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('same-UTC-day at a different time keeps the counter (no spurious reset)', () => {
  const { dir, usagePath } = freshUsagePath();
  try {
    const morning = Date.UTC(2026, 5, 29, 1, 0, 0);
    const evening = Date.UTC(2026, 5, 29, 23, 59, 0);
    const g1 = new FileBudgetGuard({ usagePath, now: () => morning });
    g1.charge('openalex', 0.5);
    const g2 = new FileBudgetGuard({ usagePath, now: () => evening });
    assert.equal(g2.spent('openalex'), 0.5); // same UTC day → not reset
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('unmetered sources are a no-op (NCBI/pubmed never blocks)', () => {
  const { dir, usagePath } = freshUsagePath();
  try {
    const g = new FileBudgetGuard({ usagePath, now: () => DAY1_NOON });
    assert.equal(g.wouldExceed95('pubmed', 1e9), false);
    assert.doesNotThrow(() => g.charge('pubmed', 1e9));
    assert.equal(g.spent('pubmed'), 0);
    // Unmetered sources are not even written to the file.
    assert.doesNotThrow(() => g.charge('crossref', 5));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('OpenAlex per-request cost model matches §5.1', () => {
  assert.equal(OPENALEX_COST.singleton, 0);
  assert.equal(OPENALEX_COST.list, 0.0001);
  assert.equal(OPENALEX_COST.filter, 0.0001);
  assert.equal(OPENALEX_COST.search, 0.001);
  assert.equal(OPENALEX_COST.semantic, 0.01);
  assert.equal(OPENALEX_COST.content, 0.01);
  assert.equal(OPENALEX_COST.text, 0.01);

  const { dir, usagePath } = freshUsagePath();
  try {
    const g = new FileBudgetGuard({ usagePath, now: () => DAY1_NOON });
    // Singleton is free → charging it many times never moves the needle.
    for (let i = 0; i < 1000; i++) g.charge('openalex', OPENALEX_COST.singleton);
    assert.equal(g.spent('openalex'), 0);
    // 40 batched list calls ≈ the whole-corpus $0.004 figure from §5.1.
    for (let i = 0; i < 40; i++) g.charge('openalex', OPENALEX_COST.list);
    assert.ok(Math.abs(g.spent('openalex') - 0.004) < 1e-9);
    // Nowhere near the $0.95 hard stop.
    assert.equal(g.wouldExceed95('openalex', OPENALEX_COST.list), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
