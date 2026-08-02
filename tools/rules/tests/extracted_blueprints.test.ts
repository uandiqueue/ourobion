import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildExtractedRows } from '../lib/extracted.mjs';

function blueprint(overrides: Record<string, unknown> = {}) {
  return {
    ruleId: 'extracted_sleep_hrv_together',
    schemaVersion: 1,
    category: 'behaviour',
    severity: 'notice',
    scope: 'cross',
    enabledPhase: 'phase2_engine',
    metricKeys: ['sleep_duration_min', 'hrv_sdnn_ms'],
    provenance: {
      tier: 'extracted',
      sourceNote: 'extracted from fixture paper',
      citation: { paperId: 'fixture:paper', locator: 'Results' },
    },
    effectiveFrom: null,
    effectiveTo: null,
    status: 'active',
    deprecatedAt: null,
    cooldownDays: 7,
    expiryDays: 14,
    condition: {
      type: 'coincidence',
      metricKeys: ['sleep_duration_min', 'hrv_sdnn_ms'],
      both: [
        { type: 'trend', metricKey: 'sleep_duration_min', equals: 'rising', minConfidence: 'low' },
        { type: 'trend', metricKey: 'hrv_sdnn_ms', equals: 'rising', minConfidence: 'low' },
      ],
      lagDays: null,
      minConfidence: 'low',
    },
    template: {
      title: 'Pattern: {{metric_a_label}} and {{metric_b_label}}',
      body: 'Your {{metric_a_label}} and {{metric_b_label}} data moved together recently.',
    },
    ...overrides,
  };
}

function record(value = blueprint(), paperId = 'fixture:paper') {
  return JSON.stringify({
    blueprint: value,
    dedupeKey: 'fixture-dedupe',
    paperId,
    synthesisModel: 'fixture-model',
    promptVersion: 'fixture-prompt',
    synthesisedAt: '2026-08-02T00:00:00.000Z',
  });
}

const claims = [
  {
    edge_id: 'sleep_duration_min|increases|hrv_sdnn_ms',
    subject: 'sleep_duration_min',
    object: 'hrv_sdnn_ms',
  },
];

function verifications(band = 'mid', status = 'active') {
  return [
    {
      edge_id: 'sleep_duration_min|increases|hrv_sdnn_ms',
      serving_band: band,
      status,
    },
  ];
}

test('#371: a servable pair promotes an extracted row and normalizes only the legacy phase literal', () => {
  const result = buildExtractedRows({
    blueprintsText: record(blueprint({ enabledPhase: 'phase_2' })),
    claimRows: claims,
    verificationRows: verifications(),
  });

  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.withheld, []);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0]!.enabled_phase, 'phase2_engine');
  assert.equal(result.rows[0]!.provenance_tier, 'extracted');
  assert.deepEqual(result.rows[0]!.source_citation.citation, {
    paperId: 'fixture:paper',
    locator: 'Results',
  });
  assert.deepEqual(result.accepted[0]!.normalizations, ['phase_2->phase2_engine']);
});

test('#371: hold, superseded, and absent verifications all withhold the extracted rule', () => {
  for (const rows of [verifications('hold'), verifications('mid', 'superseded'), []]) {
    const result = buildExtractedRows({
      blueprintsText: record(),
      claimRows: claims,
      verificationRows: rows,
    });
    assert.equal(result.rows.length, 0);
    assert.equal(result.withheld[0]!.reason, 'no-servable-verified-pair');
  }
});

test('#371: verification matching is pair-based and orientation-independent', () => {
  const result = buildExtractedRows({
    blueprintsText: record(),
    claimRows: [
      {
        edge_id: 'hrv_sdnn_ms|correlates|sleep_duration_min',
        subject: 'hrv_sdnn_ms',
        object: 'sleep_duration_min',
      },
    ],
    verificationRows: [
      {
        edge_id: 'hrv_sdnn_ms|correlates|sleep_duration_min',
        serving_band: 'high',
        status: 'active',
      },
    ],
  });
  assert.equal(result.rows.length, 1);
});

test('#371: renderer-incompatible placeholders and raw metric keys are withheld with exact reasons', () => {
  const badPlaceholder = blueprint({
    template: { title: 'Sleep pattern', body: 'Your {{sleep_duration_min}} rose recently.' },
  });
  const leakedKey = blueprint({
    ruleId: 'extracted_sleep_hrv_raw_copy',
    template: { title: 'Sleep pattern', body: 'Your sleep_duration_min was higher recently.' },
  });
  const result = buildExtractedRows({
    blueprintsText: record(badPlaceholder) + '\n' + record(leakedKey),
    claimRows: claims,
    verificationRows: verifications(),
  });

  assert.equal(result.rows.length, 0);
  assert.deepEqual(
    result.withheld.map((entry) => entry.reason),
    ['unsupported-template-placeholder', 'raw-metric-key-in-template'],
  );
});

test('#371: an extracted rule can never replace a hand-authored rule id', () => {
  const result = buildExtractedRows({
    blueprintsText: record(),
    claimRows: claims,
    verificationRows: verifications(),
    reservedRuleIds: ['extracted_sleep_hrv_together'],
  });
  assert.equal(result.rows.length, 0);
  assert.equal(result.withheld[0]!.reason, 'hand-authored-rule-id-collision');
});

test('#371: malformed JSON and paper-citation mismatch are hard errors, never silently withheld', () => {
  const result = buildExtractedRows({
    blueprintsText: '{not-json}\n' + record(blueprint(), 'fixture:different-paper'),
    claimRows: claims,
    verificationRows: verifications(),
  });
  assert.equal(result.rows.length, 0);
  assert.deepEqual(result.errors.map((entry) => entry.reason), ['invalid-json', 'citation-mismatch']);
});
