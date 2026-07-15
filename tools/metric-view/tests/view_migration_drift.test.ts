// Coupling guard: metrics-registry-to-daily-values-view (docs/graph/couplings.yaml).
// The committed metric_daily_values migration is GENERATED SQL: it must stay byte-identical
// (modulo CRLF) to what tools/metric-view renders from shared/metrics/registry.ts — the same
// assertion `gen_metric_view.mjs --check` makes in CI/pre-push. Plus shape assertions the
// architecture (§S2) requires: every baselineApplicable key appears, RLS-preserving
// security_invoker is set, and the signals long-format branch exists.
//
// status: active.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  generateViewSql,
  metricsRegistry,
  viewMetrics,
  REPO_ROOT,
  VIEW_MIGRATION_RELPATH,
} from '../lib/view.mjs';

const migrationPath = path.join(REPO_ROOT, ...VIEW_MIGRATION_RELPATH.split('/'));
const committed = readFileSync(migrationPath, 'utf8').replace(/\r\n/g, '\n');
const generated = generateViewSql();

test('committed view migration matches the registry-generated SQL (no drift)', () => {
  assert.equal(
    committed,
    generated,
    `${VIEW_MIGRATION_RELPATH} has drifted from shared/metrics/registry.ts — ` +
      'regenerate with: node tools/metric-view/gen_metric_view.mjs --write',
  );
});

test('generator is deterministic (two renders are byte-identical)', () => {
  assert.equal(generateViewSql(), generated);
});

test('every active baselineApplicable metric is covered by the view', () => {
  const baselineMetrics = metricsRegistry.METRICS.filter(
    (m: { status: string; baselineApplicable: boolean }) =>
      m.status === 'active' && m.baselineApplicable,
  );
  assert.ok(baselineMetrics.length > 0, 'registry has no baseline-applicable metrics');
  for (const m of baselineMetrics) {
    if (m.table === 'signals') continue; // covered by the generated long-format branch below
    assert.ok(
      generated.includes(`'${m.key}'::text as metric_key`),
      `baselineApplicable key "${m.key}" (${m.table}) missing from the generated view`,
    );
  }
});

test('view unpivots exactly the active numeric/ordinal metrics (no extras)', () => {
  const literalKeys = [...generated.matchAll(/'([a-z0-9_]+)'::text as metric_key/g)].map(
    (m) => m[1],
  );
  const expected = viewMetrics()
    .filter((m: { table: string }) => m.table !== 'signals')
    .map((m: { key: string }) => m.key);
  assert.deepEqual(literalKeys.sort(), [...expected].sort());
});

test('view preserves RLS via security_invoker and has the signals daily-grain branch', () => {
  assert.ok(
    generated.includes('with (security_invoker = true)'),
    'view must run as invoker so RLS on the underlying tables still applies',
  );
  assert.ok(
    generated.includes('from public.signals'),
    'signals long-format branch missing — future passive metrics must surface automatically',
  );
  assert.ok(
    generated.includes('avg(value)::double precision'),
    'signals branch must aggregate to daily grain (mean)',
  );
});
