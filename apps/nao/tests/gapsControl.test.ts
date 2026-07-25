/**
 * Pure-logic tests for the knowledge-gap surfacing helpers
 * (`src/lib/gapsControl.ts`, O9 demo slice run-2 U11). No live Supabase — the
 * /api/gaps route handler is IO glue over these functions (nao's
 * ingestControl/seedsControl convention).
 *
 * Asserts:
 *  - every §A1 gap_ledger status has a plain-language label, none of it
 *    diagnostic/medical, and unknown statuses fall back to the raw string;
 *  - metric-key humanization (underscores → spaces, acronym tokens);
 *  - "Add as seed" label derivation from a metric pair;
 *  - lit_candidate/completeness context strings (edge/band, orientation,
 *    completeness) and the null case;
 *  - row shaping: demand-DESC order with a deterministic pair tie-break,
 *    labels applied, page-size constant sane.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  GAP_LEDGER_STATUSES,
  GAP_STATUS_LABELS,
  GAPS_PAGE_SIZE,
  compareGapDemand,
  deriveGapSeedLabel,
  describeGapContext,
  gapStatusLabel,
  humanizeMetricKey,
  shapeGapRows,
  type GapLedgerRow,
} from '../src/lib/gapsControl.ts';

function row(overrides: Partial<GapLedgerRow>): GapLedgerRow {
  return {
    metric_a: 'gut_comfort_score',
    metric_b: 'mood_score',
    status: 'personal-null',
    demand: 1,
    completeness: null,
    lit_candidate: null,
    last_status_change: '2026-07-24T12:00:00Z',
    ...overrides,
  };
}

// ── status labels ─────────────────────────────────────────────────────────────

test('gapStatusLabel: every §A1 status is mapped to a plain description', () => {
  assert.equal(GAP_LEDGER_STATUSES.length, 8);
  for (const status of GAP_LEDGER_STATUSES) {
    const label = gapStatusLabel(status);
    assert.equal(label, GAP_STATUS_LABELS[status]);
    assert.notEqual(label, status); // an actual description, not the raw enum
    assert.ok(label.length > 10);
  }
  // The three statuses the serve path writes today, pinned verbatim.
  assert.equal(
    gapStatusLabel('personal-signal-no-edge'),
    'Personal pattern found, no research edge',
  );
  assert.equal(
    gapStatusLabel('blocked-completeness'),
    'Research context blocked on data completeness',
  );
  assert.equal(gapStatusLabel('needs-review'), 'Contradictory evidence — needs review');
});

test('gapStatusLabel: labels describe research coverage, never diagnosis', () => {
  const banned = /diagnos|disease|disorder|symptom|risk|treat|condition/i;
  for (const status of GAP_LEDGER_STATUSES) {
    assert.ok(
      !banned.test(GAP_STATUS_LABELS[status]),
      `label for ${status} must not use diagnostic/medical language`,
    );
  }
});

test('gapStatusLabel: unknown status falls back to the raw string', () => {
  assert.equal(gapStatusLabel('some-future-status'), 'some-future-status');
});

// ── metric-key humanization + seed-label derivation ──────────────────────────

test('humanizeMetricKey: underscores → spaces, acronym tokens upper-cased', () => {
  assert.equal(humanizeMetricKey('sleep_duration_min'), 'sleep duration min');
  assert.equal(humanizeMetricKey('hrv_sdnn_ms'), 'HRV SDNN ms');
  assert.equal(humanizeMetricKey('urine_colour'), 'urine colour');
  assert.equal(humanizeMetricKey('rhr_bpm'), 'RHR bpm');
});

test('deriveGapSeedLabel: pair → seed-form label', () => {
  assert.equal(
    deriveGapSeedLabel('hrv_sdnn_ms', 'sleep_duration_min'),
    'HRV SDNN ms and sleep duration min',
  );
  assert.equal(
    deriveGapSeedLabel('gut_comfort_score', 'mood_score'),
    'gut comfort score and mood score',
  );
});

// ── lit_candidate / completeness context ──────────────────────────────────────

test('describeGapContext: edge presence, band, orientation, completeness', () => {
  assert.equal(describeGapContext({ hasEdge: false }, null), 'no edge in read store');
  assert.equal(
    describeGapContext({ hasEdge: true, servingBand: 'personal' }, null),
    'edge in read store (band: personal)',
  );
  assert.equal(
    describeGapContext({ hasEdge: true, servingBand: 'personal', orientation: 'object-only' }, null),
    'edge in read store (band: personal) · orientation: object-only',
  );
  // completeness rides along whatever numeric form PostgREST returns.
  assert.equal(describeGapContext({ hasEdge: false }, 0.42), 'no edge in read store · completeness 0.42');
  assert.equal(describeGapContext(null, '0.500'), 'completeness 0.50');
});

test('describeGapContext: nothing to say → null', () => {
  assert.equal(describeGapContext(null, null), null);
  assert.equal(describeGapContext({}, null), null);
  assert.equal(describeGapContext(['not', 'an', 'object'], null), null);
});

// ── ordering + shaping ────────────────────────────────────────────────────────

test('compareGapDemand: demand DESC, then pair ascending as tie-break', () => {
  const rows: GapLedgerRow[] = [
    row({ metric_a: 'b_metric', metric_b: 'c_metric', demand: 2 }),
    row({ metric_a: 'a_metric', metric_b: 'z_metric', demand: 5 }),
    row({ metric_a: 'a_metric', metric_b: 'b_metric', demand: 2 }),
  ];
  const sorted = [...rows].sort(compareGapDemand);
  assert.deepEqual(
    sorted.map((r) => `${r.metric_a}|${r.metric_b}`),
    ['a_metric|z_metric', 'a_metric|b_metric', 'b_metric|c_metric'],
  );
});

test('shapeGapRows: sorted, labeled view rows with seed labels', () => {
  const shaped = shapeGapRows([
    row({ metric_a: 'gut_comfort_score', metric_b: 'mood_score', status: 'personal-null', demand: 3 }),
    row({
      metric_a: 'hrv_sdnn_ms',
      metric_b: 'sleep_duration_min',
      status: 'personal-signal-no-edge',
      demand: 9,
      lit_candidate: { hasEdge: false },
    }),
  ]);
  assert.equal(shaped.length, 2);
  // demand DESC: the HRV pair first.
  assert.equal(shaped[0].pairLabel, 'HRV SDNN ms × sleep duration min');
  assert.equal(shaped[0].statusLabel, 'Personal pattern found, no research edge');
  assert.equal(shaped[0].demand, 9);
  assert.equal(shaped[0].context, 'no edge in read store');
  assert.equal(shaped[0].seedLabel, 'HRV SDNN ms and sleep duration min');
  assert.equal(shaped[1].status, 'personal-null');
  assert.equal(shaped[1].context, null);
  assert.equal(shaped[1].lastStatusChange, '2026-07-24T12:00:00Z');
});

test('shapeGapRows: unknown status shapes honestly (raw status as label)', () => {
  const [shaped] = shapeGapRows([row({ status: 'retrieval-exhausted-v2' })]);
  assert.equal(shaped.statusLabel, 'retrieval-exhausted-v2');
});

test('GAPS_PAGE_SIZE: a sane, honest cap', () => {
  assert.equal(GAPS_PAGE_SIZE, 50);
});
