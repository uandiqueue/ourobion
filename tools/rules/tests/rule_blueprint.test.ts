// Coupling guard: rules-blueprint-to-schema + rules-templates-to-copy-guidelines
// (docs/graph/couplings.yaml). The database-free blueprint gate (rules-engine-design §B5): every
// data/rules/** blueprint must parse against the shared/rules zod contract, pass the
// non-diagnostic copy gate, and reference only shared/metrics registry keys — the same pipeline
// the loader hard-fails on, run in CI without a database.
//
// status: active.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { loadBlueprints, QUARANTINE } from '../lib/blueprints.mjs';
import {
  ruleBlueprintSchema,
  validateBlueprint,
} from '../../../shared/rules/rule.schema.ts';
import { blueprintRelPath, conditionMetricKeys } from '../../../shared/rules/index.ts';
import { validateCopyString } from '../../../shared/constants/copy_guidelines.ts';
import { byKey } from '../../../shared/metrics/index.ts';

const PORTED_MVP_RULE_IDS = [
  'hydration_trending_up',
  'hydration_trending_down',
  'gut_form_stable',
  'gut_form_variable',
  'energy_trending_down',
  'gut_comfort_trending_down',
];

const { blueprints, errors } = loadBlueprints();

test('every data/rules blueprint validates with zero errors (schema + path + registry + copy)', () => {
  assert.deepEqual(errors, []);
  assert.ok(blueprints.length >= 6, `expected at least the 6 ported rules, got ${blueprints.length}`);
});

test('the 6 ported MVP rules are all present', () => {
  const ids = new Set(blueprints.map(({ blueprint }) => blueprint.ruleId));
  for (const id of PORTED_MVP_RULE_IDS) {
    assert.ok(ids.has(id), `ported MVP rule "${id}" is missing from data/rules`);
  }
});

test('every template passes the non-diagnostic copy gate (memory 0003)', () => {
  for (const { relPath, blueprint } of blueprints) {
    assert.ok(validateCopyString(blueprint.template.title), `${relPath}: title fails copy gate`);
    assert.ok(validateCopyString(blueprint.template.body), `${relPath}: body fails copy gate`);
  }
});

test('every metric key resolves in shared/metrics (active or deprecated, never unknown)', () => {
  for (const { relPath, blueprint } of blueprints) {
    const keys = new Set([...blueprint.metricKeys, ...conditionMetricKeys(blueprint.condition)]);
    for (const key of keys) {
      assert.notEqual(byKey(key), undefined, `${relPath}: metric key "${key}" not in registry`);
    }
  }
});

test('ruleIds are unique and every file sits at <scope>/<category>/<ruleId>.json', () => {
  const seen = new Set<string>();
  for (const { relPath, blueprint } of blueprints) {
    assert.ok(!seen.has(blueprint.ruleId), `duplicate ruleId ${blueprint.ruleId}`);
    seen.add(blueprint.ruleId);
    assert.equal(relPath, blueprintRelPath(blueprint));
  }
});

test('QUARANTINE is empty — no seed warts are being carried', () => {
  assert.equal(QUARANTINE.size, 0);
});

// ─── Contract rejection paths (the invariants actually bite) ─────────────────────

function base() {
  // Deep-clone a real shipped blueprint as the mutation base.
  const sample = blueprints.find(({ blueprint }) => blueprint.ruleId === 'gut_form_stable');
  assert.ok(sample);
  return structuredClone(sample.blueprint);
}

test('diagnostic language in a template is rejected by the schema itself', () => {
  const bad = base();
  bad.template.body = 'This may be a disease of the gut.';
  assert.equal(ruleBlueprintSchema.safeParse(bad).success, false);
});

test('unbalanced placeholder braces are rejected', () => {
  const bad = base();
  bad.template.body = 'Your {{metric_name} data shifted this week.';
  assert.equal(ruleBlueprintSchema.safeParse(bad).success, false);
});

test('scope/metricKeys disagreement is rejected', () => {
  const bad = base();
  bad.scope = 'cross'; // still only 1 metricKey + a non-coincidence condition
  assert.equal(ruleBlueprintSchema.safeParse(bad).success, false);
});

test('deprecated status without deprecatedAt is rejected', () => {
  const bad = base();
  bad.status = 'deprecated'; // deprecatedAt stays null
  assert.equal(ruleBlueprintSchema.safeParse(bad).success, false);
});

test('a well-formed cross/coincidence blueprint parses (the shape the first cross rule will use)', () => {
  const cross = {
    ...base(),
    ruleId: 'sleep_low_and_gut_comfort_down',
    category: 'gut',
    scope: 'cross',
    metricKeys: ['sleep_duration_min', 'gut_comfort_score'],
    condition: {
      type: 'coincidence',
      metricKeys: ['sleep_duration_min', 'gut_comfort_score'],
      both: [
        {
          type: 'trend',
          metricKey: 'sleep_duration_min',
          equals: 'falling',
          minConfidence: 'low',
        },
        {
          type: 'trend',
          metricKey: 'gut_comfort_score',
          equals: 'falling',
          minConfidence: 'low',
        },
      ],
      lagDays: null,
      minConfidence: 'low',
    },
  };
  const parsed = validateBlueprint(cross);
  assert.equal(parsed.scope, 'cross');

  // ...and its internal consistency is enforced: leaf 0 must test metricKeys[0].
  const bad = structuredClone(cross);
  bad.condition.both[0].metricKey = 'gut_comfort_score';
  assert.equal(ruleBlueprintSchema.safeParse(bad).success, false);

  // ...and the two coincidence metrics must be distinct.
  const same = structuredClone(cross);
  same.metricKeys = ['gut_comfort_score', 'gut_comfort_score'];
  same.condition.metricKeys = ['gut_comfort_score', 'gut_comfort_score'];
  same.condition.both[0].metricKey = 'gut_comfort_score';
  assert.equal(ruleBlueprintSchema.safeParse(same).success, false);
});
