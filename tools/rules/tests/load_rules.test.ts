// Loader-behaviour tests (rules-engine-design §B3): determinism (same blueprints → same rows),
// canonical hashing, faithful flattening, and the hard-fail paths (unknown registry key, wrong
// on-disk path, diagnostic copy) exercised against throwaway blueprint trees on disk.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

// ─── A14 empty-input guard (CLI, spawned as a real subprocess) ────────────────────
// The loader must refuse to run against an EMPTY validated blueprint set — exit 1, nothing
// written, no prune — unless --allow-empty states the intent. The guard sits in the CLI before
// any DB connection, so no database is involved: reaching the SUPABASE_DB_URL complaint is
// itself proof the guard was passed.

const CLI = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'load_rules.mjs');

function runCli(args: string[]) {
  return spawnSync(process.execPath, [CLI, ...args], {
    encoding: 'utf8',
    // Never reach a real DB from these tests, whatever the developer shell exports.
    env: { ...process.env, SUPABASE_DB_URL: '' },
  });
}

/** A blueprint tree with no scope dirs at all — discoverBlueprintFiles returns [] (the A14 case). */
function emptyTree(): string {
  return mkdtempSync(path.join(tmpdir(), 'ourobion-rules-empty-'));
}

test('A14: an empty blueprint set aborts with exit 1 before any DB work, naming --allow-empty', () => {
  const dir = emptyTree();
  try {
    const out = runCli(['--rules-dir', dir]);
    assert.equal(out.status, 1);
    assert.match(out.stderr, /EMPTY/);
    assert.match(out.stderr, /--allow-empty/);
    // The guard fires BEFORE the DB URL check — no transaction, no prune, was ever possible.
    assert.doesNotMatch(out.stderr, /SUPABASE_DB_URL/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('A14: --check on an empty set fails the same way (check verdict mirrors the real run)', () => {
  const dir = emptyTree();
  try {
    const out = runCli(['--rules-dir', dir, '--check']);
    assert.equal(out.status, 1);
    assert.match(out.stderr, /EMPTY/);
    assert.match(out.stderr, /--allow-empty/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('A14: --check --allow-empty reports the emptiness and exits 0 (no DB writes in dry-run)', () => {
  const dir = emptyTree();
  try {
    const out = runCli(['--rules-dir', dir, '--check', '--allow-empty']);
    assert.equal(out.status, 0);
    assert.match(out.stdout, /0 blueprint\(s\) valid/);
    assert.match(out.stdout, /Dry run — no database writes\./);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('A14: --allow-empty proceeds past the guard on a real run (stops only at the missing DB URL here)', () => {
  const dir = emptyTree();
  try {
    const out = runCli(['--rules-dir', dir, '--allow-empty']);
    assert.equal(out.status, 1);
    assert.match(out.stderr, /SUPABASE_DB_URL/); // past the guard — this is the DB-less environment talking
    assert.doesNotMatch(out.stderr, /--allow-empty/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the guard does not touch the normal path: --check over data/rules stays green', () => {
  const out = runCli(['--check']);
  assert.equal(out.status, 0);
  assert.match(out.stdout, /blueprint\(s\) valid/);
  assert.doesNotMatch(out.stdout, /^✓ 0 blueprint/m);
});

test('#371: CLI admits only servable extracted pairs and preserves every hand-authored rule', () => {
  const edgesDir = mkdtempSync(path.join(tmpdir(), 'ourobion-rules-edges-'));
  const edgeFixtures = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
    'edge-loader',
    'tests',
    'fixtures',
    'edges',
  );
  const extractedBlueprint = (
    ruleId: string,
    metricKeys: [string, string],
    paperId: string,
  ) => ({
    blueprint: {
      ruleId,
      schemaVersion: 1,
      category: 'behaviour',
      severity: 'notice',
      scope: 'cross',
      enabledPhase: 'phase_2',
      metricKeys,
      provenance: {
        tier: 'extracted',
        sourceNote: 'CLI integration fixture',
        citation: { paperId, locator: 'Results' },
      },
      effectiveFrom: null,
      effectiveTo: null,
      status: 'active',
      deprecatedAt: null,
      cooldownDays: 7,
      expiryDays: 14,
      condition: {
        type: 'coincidence',
        metricKeys,
        both: [
          { type: 'trend', metricKey: metricKeys[0], equals: 'rising', minConfidence: 'low' },
          { type: 'trend', metricKey: metricKeys[1], equals: 'rising', minConfidence: 'low' },
        ],
        lagDays: null,
        minConfidence: 'low',
      },
      template: {
        title: 'Pattern: {{metric_a_label}} and {{metric_b_label}}',
        body: 'Your {{metric_a_label}} and {{metric_b_label}} data moved together recently.',
      },
    },
    dedupeKey: 'fixture-' + ruleId,
    paperId,
    synthesisModel: 'fixture-model',
    promptVersion: 'fixture-prompt',
    synthesisedAt: '2026-08-02T00:00:00.000Z',
  });

  try {
    for (const name of ['claims.jsonl', 'verifications.jsonl']) {
      writeFileSync(path.join(edgesDir, name), readFileSync(path.join(edgeFixtures, name)));
    }
    const accepted = extractedBlueprint(
      'extracted_sleep_hrv_cli',
      ['sleep_duration_min', 'hrv_sdnn_ms'],
      'fixture:sleep-hrv-meta-2023',
    );
    const withheld = extractedBlueprint(
      'extracted_steps_sleep_cli',
      ['step_count', 'sleep_duration_min'],
      'fixture:steps-sleep-xsect-2019',
    );
    writeFileSync(
      path.join(edgesDir, 'blueprints.jsonl'),
      [accepted, withheld].map((value) => JSON.stringify(value)).join('\n') + '\n',
    );

    const out = runCli(['--check', '--from-edges-dir', edgesDir]);
    assert.equal(out.status, 0, out.stderr);
    assert.match(out.stdout, /✓ 9 blueprint\(s\) valid/);
    assert.match(out.stdout, /8 hand-authored \+ 1 verified extracted/);
    assert.match(out.stdout, /\+ extracted extracted_sleep_hrv_cli; normalized phase_2->phase2_engine/);
    assert.match(
      out.stdout,
      /x withheld extracted_steps_sleep_cli: no-servable-verified-pair/,
    );
    assert.match(out.stdout, /- gut_form_stable /);
  } finally {
    rmSync(edgesDir, { recursive: true, force: true });
  }
});

test('an unknown argument is a usage error (exit 2), matching the edge-loader convention', () => {
  const out = runCli(['--no-such-flag']);
  assert.equal(out.status, 2);
  assert.match(out.stderr, /unknown argument '--no-such-flag'/);
});
