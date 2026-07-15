// Loader-behaviour tests (rules-engine-design §B3): determinism (same blueprints → same rows),
// canonical hashing, faithful flattening, and the hard-fail paths (unknown registry key, wrong
// on-disk path, diagnostic copy) exercised against throwaway blueprint trees on disk.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  buildRows,
  canonicalJson,
  contentHash,
  flattenRule,
  loadBlueprints,
} from '../lib/blueprints.mjs';

test('canonicalJson is key-order independent, so content_hash is stable', () => {
  const a = { x: 1, y: [{ b: 2, a: 3 }], z: null };
  const b = { z: null, y: [{ a: 3, b: 2 }], x: 1 };
  assert.equal(canonicalJson(a), canonicalJson(b));
  assert.equal(contentHash(a), contentHash(b));
  assert.notEqual(contentHash(a), contentHash({ ...a, x: 2 }));
});

test('buildRows over data/rules is deterministic: two runs, identical rows, sorted by rule_id', () => {
  const first = buildRows();
  const second = buildRows();
  assert.deepEqual(first.errors, []);
  assert.equal(JSON.stringify(first.rows), JSON.stringify(second.rows));
  const ids = first.rows.map((r: { rule_id: string }) => r.rule_id);
  assert.deepEqual(ids, [...ids].sort());
});

test('flattenRule maps the gut_form_stable blueprint to its table row faithfully', () => {
  const { blueprints } = loadBlueprints();
  const entry = blueprints.find(
    ({ blueprint }: { blueprint: { ruleId: string } }) => blueprint.ruleId === 'gut_form_stable',
  );
  assert.ok(entry);
  const row = flattenRule(entry.blueprint);
  assert.equal(row.rule_id, 'gut_form_stable');
  assert.equal(row.scope, 'single');
  assert.deepEqual(row.metric_keys, ['stool_form']);
  assert.equal(row.condition_type, 'threshold');
  // The discriminator is lifted out of the params jsonb; the MVP semantics ride along.
  assert.deepEqual(row.condition_params, {
    metricKey: 'stool_form',
    field: 'std_dev',
    op: 'lte',
    value: 1.0,
    minConfidence: 'low',
  });
  assert.equal(row.severity, 'info');
  assert.equal(row.category, 'gut');
  assert.equal(row.enabled_phase, 'phase1_stage1');
  assert.equal(row.provenance_tier, 'hand_authored');
  assert.equal(row.status, 'active');
  assert.equal(row.expiry_days, 7);
  assert.equal(row.cooldown_days, null);
  assert.match(row.content_hash, /^[0-9a-f]{64}$/);
});

// ─── Hard-fail paths against a scratch blueprint tree ────────────────────────────

function scratchTree(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'ourobion-rules-'));
  mkdirSync(path.join(dir, 'single', 'gut'), { recursive: true });
  return dir;
}

function validBlueprint() {
  return {
    ruleId: 'gut_form_stable',
    schemaVersion: 1,
    category: 'gut',
    severity: 'info',
    scope: 'single',
    enabledPhase: 'phase1_stage1',
    metricKeys: ['stool_form'],
    provenance: { tier: 'hand_authored', sourceNote: 'test fixture', citation: null },
    effectiveFrom: null,
    effectiveTo: null,
    status: 'active',
    deprecatedAt: null,
    cooldownDays: null,
    expiryDays: 7,
    condition: {
      type: 'threshold',
      metricKey: 'stool_form',
      field: 'std_dev',
      op: 'lte',
      value: 1.0,
      minConfidence: 'low',
    },
    template: { title: 'Gut consistency pattern', body: 'Your data shows a stable pattern.' },
  };
}

function write(dir: string, relPath: string, value: unknown): void {
  writeFileSync(path.join(dir, ...relPath.split('/')), JSON.stringify(value, null, 2));
}

test('an unknown registry metric key hard-fails the load', () => {
  const dir = scratchTree();
  try {
    const bad = validBlueprint();
    bad.ruleId = 'gut_ghost_metric';
    bad.metricKeys = ['ghost_metric'];
    bad.condition.metricKey = 'ghost_metric';
    write(dir, 'single/gut/gut_ghost_metric.json', bad);
    const { errors } = loadBlueprints(dir);
    assert.equal(errors.length, 1);
    assert.match(errors[0]?.message ?? '', /"ghost_metric" is not in shared\/metrics/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a blueprint at the wrong path (scope/category/ruleId disagreement) hard-fails', () => {
  const dir = scratchTree();
  try {
    write(dir, 'single/gut/wrong_name.json', validBlueprint());
    const { errors } = loadBlueprints(dir);
    assert.equal(errors.length, 1);
    assert.match(errors[0]?.message ?? '', /file path must be single\/gut\/gut_form_stable\.json/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('diagnostic copy hard-fails the load (never reaches the table)', () => {
  const dir = scratchTree();
  try {
    const bad = validBlueprint();
    bad.template.body = 'Your data indicates an illness.';
    write(dir, 'single/gut/gut_form_stable.json', bad);
    const { errors, blueprints } = loadBlueprints(dir);
    assert.equal(blueprints.length, 0);
    assert.ok(errors.length >= 1);
    assert.match(errors.map((e: { message: string }) => e.message).join('\n'), /validateCopyString/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('invalid JSON hard-fails with the file named', () => {
  const dir = scratchTree();
  try {
    writeFileSync(path.join(dir, 'single', 'gut', 'broken.json'), '{ not json');
    const { errors } = loadBlueprints(dir);
    assert.equal(errors.length, 1);
    assert.equal(errors[0]?.relPath, 'single/gut/broken.json');
    assert.match(errors[0]?.message ?? '', /invalid JSON/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
