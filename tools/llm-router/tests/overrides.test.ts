/**
 * O10 cap-override tests (overrides.ts + BudgetLedger integration, run-2 U8):
 * offline — fetch is stubbed, ledger files live in tmp dirs.
 *
 * Proves the three locked behaviours:
 *  - PRECEDENCE: an override REPLACES the file cap for its node only; other
 *    nodes keep file caps; the per-run ceiling is resolved per calling node.
 *  - FAIL-SOFT: absent env / unreachable Supabase / non-OK / garbage responses
 *    all yield undefined (file caps) + exactly one loud warning — never a throw.
 *  - BOUNDS: rows above the migration CHECK mirrors (5.00 USD / 200000 tokens),
 *    non-positive values, and unknown nodes are ignored with a warning.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { BudgetLedger } from '../src/budget.js';
import {
  MAX_PER_DAY_USD_CAP,
  MAX_PER_RUN_TOKEN_CAP,
  effectiveCapsFor,
  fetchCapOverrides,
} from '../src/overrides.js';
import { checkConfig } from '../src/router.js';
import { testConfig } from './helpers.js';

const NOON = Date.UTC(2026, 6, 24, 12, 0, 0);

function collector(): { warnings: string[]; warn: (m: string) => void } {
  const warnings: string[] = [];
  return { warnings, warn: (m) => warnings.push(m) };
}

function okJson(rows: unknown): (url: string, init: RequestInit) => Promise<Response> {
  return async () => new Response(JSON.stringify(rows), { status: 200 });
}

const ENV = { SUPABASE_URL: 'http://127.0.0.1:54321', SUPABASE_SERVICE_ROLE_KEY: 'svc-key' };

// ── fetchCapOverrides ────────────────────────────────────────────────────────

test('fetch: happy path maps rows (numeric or string) and skips nulls', async () => {
  const { warnings, warn } = collector();
  const overrides = await fetchCapOverrides({
    env: ENV,
    warn,
    fetchFn: okJson([
      { node: 'phrasing_card', per_day_usd_cap: 0.5, per_run_token_cap: null },
      { node: 'verifier', per_day_usd_cap: '2.00', per_run_token_cap: 30000 },
    ]),
  });
  assert.deepEqual(overrides, {
    phrasing_card: { perDayUsdCap: 0.5 },
    verifier: { perDayUsdCap: 2, perRunTokenCap: 30000 },
  });
  assert.equal(warnings.length, 0);
});

test('fetch: requests the overrides table with the service key', async () => {
  let seenUrl = '';
  let seenAuth = '';
  await fetchCapOverrides({
    env: ENV,
    warn: () => {},
    fetchFn: async (url, init) => {
      seenUrl = url;
      seenAuth = (init.headers as Record<string, string>).Authorization ?? '';
      return new Response('[]', { status: 200 });
    },
  });
  assert.match(seenUrl, /\/rest\/v1\/llm_router_cap_overrides\?select=node,per_day_usd_cap,per_run_token_cap$/);
  assert.equal(seenAuth, 'Bearer svc-key');
});

test('fail-soft: absent env → undefined + one warning naming the file-caps fallback', async () => {
  const { warnings, warn } = collector();
  const overrides = await fetchCapOverrides({ env: {}, warn, fetchFn: okJson([]) });
  assert.equal(overrides, undefined);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0]!, /FILE caps only/);
});

test('fail-soft: unreachable Supabase (fetch rejects) → undefined + one warning, no throw', async () => {
  const { warnings, warn } = collector();
  const overrides = await fetchCapOverrides({
    env: ENV,
    warn,
    fetchFn: async () => {
      throw new Error('ECONNREFUSED');
    },
  });
  assert.equal(overrides, undefined);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0]!, /unreachable/);
  assert.match(warnings[0]!, /fail-soft/);
});

test('fail-soft: non-OK response and non-array body → undefined + warning', async () => {
  for (const fetchFn of [
    async () => new Response('permission denied', { status: 401 }),
    okJson({ message: 'not an array' }),
  ]) {
    const { warnings, warn } = collector();
    assert.equal(await fetchCapOverrides({ env: ENV, warn, fetchFn }), undefined);
    assert.equal(warnings.length, 1);
  }
});

test('bounds: out-of-range / non-positive values and unknown nodes are ignored with warnings', async () => {
  const { warnings, warn } = collector();
  const overrides = await fetchCapOverrides({
    env: ENV,
    warn,
    fetchFn: okJson([
      { node: 'phrasing_card', per_day_usd_cap: MAX_PER_DAY_USD_CAP + 0.01, per_run_token_cap: 500 },
      { node: 'synthesis', per_day_usd_cap: -1, per_run_token_cap: MAX_PER_RUN_TOKEN_CAP + 1 },
      { node: 'not_a_node', per_day_usd_cap: 1 },
    ]),
  });
  // phrasing_card keeps only its in-bounds token cap; synthesis has nothing valid.
  assert.deepEqual(overrides, { phrasing_card: { perRunTokenCap: 500 } });
  assert.equal(warnings.length, 4); // 5.01 usd, -1 usd, 200001 tokens, unknown node
  assert.match(warnings.join('\n'), /not_a_node/);
});

// ── effectiveCapsFor precedence ──────────────────────────────────────────────

test('precedence: override replaces file cap for its node only', () => {
  const config = testConfig(); // file: $5/day/node, 200000 tokens/run
  const overrides = { phrasing_card: { perDayUsdCap: 0.5, perRunTokenCap: 1000 } };

  const pc = effectiveCapsFor(config, overrides, 'phrasing_card');
  assert.deepEqual(pc, {
    perDayUsd: 0.5,
    perDayOverridden: true,
    perRunTokens: 1000,
    perRunOverridden: true,
  });

  const other = effectiveCapsFor(config, overrides, 'synthesis');
  assert.deepEqual(other, {
    perDayUsd: 5,
    perDayOverridden: false,
    perRunTokens: 200000,
    perRunOverridden: false,
  });

  const none = effectiveCapsFor(config, undefined, 'phrasing_card');
  assert.equal(none.perDayUsd, 5);
  assert.equal(none.perDayOverridden, false);
});

// ── BudgetLedger integration (spend-check time) ─────────────────────────────

test('ledger: a per-day USD override gates that node at ITS hard stop; others keep file caps', () => {
  const dir = mkdtempSync(join(tmpdir(), 'llm-override-'));
  try {
    const config = testConfig((raw) => {
      raw.budget.perRunOutputTokens = 100_000_000; // keep the token cap out of the way
    });
    const ledger = new BudgetLedger({
      config,
      ledgerPath: join(dir, 'ledger.json'),
      now: () => NOON,
      overrides: { phrasing_card: { perDayUsdCap: 0.5 } }, // hard stop $0.475
    });

    // haiku ($1/M in, $5/M out): 90k out = $0.45 < $0.475 → allowed…
    assert.equal(
      ledger.wouldExceed('phrasing_card', 'run-A', 'claude-haiku-4-5', { inputTokens: 0, outputTokens: 90_000 }),
      undefined,
    );
    // …but 96k out = $0.48 ≥ $0.475 → refused BY THE OVERRIDE (file cap is $5).
    assert.equal(
      ledger.wouldExceed('phrasing_card', 'run-A', 'claude-haiku-4-5', { inputTokens: 0, outputTokens: 96_000 }),
      'day_usd',
    );
    assert.throws(
      () => ledger.assertCanSpend('phrasing_card', 'run-A', 'claude-haiku-4-5', { inputTokens: 0, outputTokens: 96_000 }),
      /US\$0\.5\/day cap \(CAP OVERRIDE active/,
    );
    // The same projected spend on a NON-overridden node is fine (file cap $5).
    assert.equal(
      ledger.wouldExceed('extract_assist', 'run-A', 'claude-haiku-4-5', { inputTokens: 0, outputTokens: 96_000 }),
      undefined,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('ledger: a per-run token override applies to the overridden node, resolved per calling node', () => {
  const dir = mkdtempSync(join(tmpdir(), 'llm-override-'));
  try {
    const config = testConfig(); // file: 200000/run → hard stop 190000
    const ledger = new BudgetLedger({
      config,
      ledgerPath: join(dir, 'ledger.json'),
      now: () => NOON,
      overrides: { verifier: { perRunTokenCap: 1000 } }, // hard stop 950 for verifier calls
    });

    assert.equal(
      ledger.wouldExceed('verifier', 'run-B', 'gpt-5', { inputTokens: 0, outputTokens: 949 }),
      undefined,
    );
    assert.equal(
      ledger.wouldExceed('verifier', 'run-B', 'gpt-5', { inputTokens: 0, outputTokens: 950 }),
      'run_tokens',
    );
    // The run-wide counter is checked against the FILE ceiling for other nodes.
    assert.equal(
      ledger.wouldExceed('synthesis', 'run-B', 'claude-sonnet-5', { inputTokens: 0, outputTokens: 950 }),
      undefined,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── checkConfig visibility ───────────────────────────────────────────────────

test('checkConfig: effective caps + overridden flags appear in the operator report', () => {
  const dir = mkdtempSync(join(tmpdir(), 'llm-override-'));
  try {
    const config = testConfig();
    const report = checkConfig({
      config,
      ledgerPath: join(dir, 'ledger.json'),
      now: () => NOON,
      env: {},
      capOverrides: { phrasing_card: { perDayUsdCap: 0.5 } },
    });
    const pc = report.nodes.find((n) => n.nodeId === 'phrasing_card')!;
    assert.equal(pc.perDayUsdCap, 0.5);
    assert.equal(pc.perDayUsdCapOverridden, true);
    assert.equal(pc.perRunTokenCap, 200000);
    assert.equal(pc.perRunTokenCapOverridden, false);
    const synth = report.nodes.find((n) => n.nodeId === 'synthesis')!;
    assert.equal(synth.perDayUsdCap, 5);
    assert.equal(synth.perDayUsdCapOverridden, false);
    // Budget state carries the override map for downstream reports.
    assert.deepEqual(report.budget.capOverrides, { phrasing_card: { perDayUsdCap: 0.5 } });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
