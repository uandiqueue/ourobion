/**
 * Budget guard tests (design §5.1, §10.2) — node:test, run via tsx.
 *
 * Proves, with NO network and a frozen injected clock:
 *  - charging up to (but not crossing) 95% is allowed;
 *  - the charge that would cross 95% is refused (wouldExceed95 true + charge throws);
 *  - counters persist across a fresh instance pointed at the same usage.json;
 *  - a counter whose windowStart is a previous UTC day resets;
 *  - unmetered sources (NCBI/pubmed) are a no-op;
 *  - OpenAlex per-request cost model matches §5.1.
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

test('CORE: charges up to <95% allowed; the charge crossing 95% is refused', () => {
  const { dir, usagePath } = freshUsagePath();
  try {
    const g = new FileBudgetGuard({ usagePath, now: () => DAY1_NOON });
    // CORE daily = 1000 tokens → hard stop = 950.
    const hardStop = BUDGETS.core!.daily * HARD_STOP_FRACTION;
    assert.equal(hardStop, 950);

    // Charge 900 → total 900, below 950: allowed.
    assert.equal(g.wouldExceed95('core', 900), false);
    g.charge('core', 900);
    assert.equal(g.spent('core'), 900);

    // Next 49 → total 949 (< 950): still allowed.
    assert.equal(g.wouldExceed95('core', 49), false);
    g.charge('core', 49);
    assert.equal(g.spent('core'), 949);

    // Next 1 → total 950 == hard stop: this CROSSES the line → refused.
    assert.equal(g.wouldExceed95('core', 1), true);
    assert.throws(() => g.charge('core', 1), /95% hard stop/);
    // Spend unchanged after a denied charge.
    assert.equal(g.spent('core'), 949);

    // A larger charge that overshoots is also refused.
    assert.equal(g.wouldExceed95('core', 100), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('boundary: charge landing just below hard stop is allowed', () => {
  const { dir, usagePath } = freshUsagePath();
  try {
    const g = new FileBudgetGuard({ usagePath, now: () => DAY1_NOON });
    // 949.999 < 950 → allowed; 950 → refused.
    assert.equal(g.wouldExceed95('core', 949.999), false);
    g.charge('core', 949.999);
    assert.equal(g.wouldExceed95('core', 0.001), true); // 950.0 crosses
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
        counters: { core: { windowStart: day1Iso, spent: 940 } },
      }),
      'utf8',
    );

    // Open the guard "the next day" → counter must reset to 0 for the new window.
    const g = new FileBudgetGuard({ usagePath, now: () => DAY2_NOON });
    assert.equal(g.spent('core'), 0);
    // And so a full charge is allowed again in the new window.
    assert.equal(g.wouldExceed95('core', 900), false);
    g.charge('core', 900);
    assert.equal(g.spent('core'), 900);

    // The persisted window now reflects DAY2.
    const onDisk = JSON.parse(readFileSync(usagePath, 'utf8')) as {
      counters: { core?: { windowStart: string; spent: number } };
    };
    const day2Iso = new Date(Date.UTC(2026, 5, 30)).toISOString();
    assert.equal(onDisk.counters.core?.windowStart, day2Iso);
    assert.equal(onDisk.counters.core?.spent, 900);
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
    g1.charge('core', 500);
    const g2 = new FileBudgetGuard({ usagePath, now: () => evening });
    assert.equal(g2.spent('core'), 500); // same UTC day → not reset
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
