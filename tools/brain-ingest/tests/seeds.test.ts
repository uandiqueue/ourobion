/**
 * Seed tests (design §3 step 1, §10.3) — node:test, via tsx. NO network.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SEEDS, SEED_TOPICS, seedByTopic } from '../src/seeds.js';

test('the six design §3 study domains are still present after the #307 rebalance', () => {
  // Asserts the six ORIGINAL domains survive, not that they are the whole pool. #307 D5 added
  // family-balanced topics, so an exact-set assertion here would fail every time the pool grows —
  // and would have been the wrong guard anyway: what matters is that the founding domains are not
  // silently dropped by a later rebalance.
  for (const topic of [
    'antibiotics',
    'dengue_vector',
    'environmental_health',
    'gut_microbiome',
    'hydration',
    'sleep_hrv',
  ]) {
    assert.ok(SEED_TOPICS.includes(topic), `${topic} must remain in the pool`);
  }
});

test('#307 D5: the pool spans every active metric family, not just gut', () => {
  // The guard that would have caught the gut monoculture: a first pass added 16 topics, ALL of them
  // gut-anchored, against a registry where only 4 of 24 active metrics are gut. Coverage is asserted
  // per FAMILY so an imbalance is a failing test rather than something a human must spot by reading
  // slugs. `spo2_pct` is deliberately excluded — broad SpO2 queries pull diagnostic literature,
  // outside Ourobion's descriptive scope.
  const tagged = new Set(SEEDS.flatMap((s) => s.topicTags));
  const GUT = ['stool_form', 'stool_count', 'stool_variability', 'gut_comfort_score'] as const;
  const families: Record<string, readonly string[]> = {
    wearable: ['resting_hr_bpm', 'hrv_sdnn_ms', 'sleep_duration_min', 'body_temp_c', 'step_count'],
    mental: ['mood_score', 'anxiety_score', 'brain_clarity_score', 'focus_score', 'energy_score'],
    social: ['social_interaction_quality_score'],
    vector: ['mosquito_bites', 'standing_water_present'],
    hydrationDiet: ['urine_colour', 'outside_meals'],
    gut: GUT,
  };
  for (const [family, metrics] of Object.entries(families)) {
    const missing = metrics.filter((m) => !tagged.has(m));
    assert.deepEqual(missing, [], `${family} has unseeded active metrics: ${missing.join(', ')}`);
  }
  // And no single family may dominate: gut is 4 of 24 active metrics, so it must not own most seeds.
  const gutSeeds = SEEDS.filter((s) => GUT.some((m) => s.topicTags.includes(m))).length;
  assert.ok(
    gutSeeds * 2 < SEEDS.length,
    `gut-anchored seeds (${gutSeeds}) must stay a minority of ${SEEDS.length} topics`,
  );
});

test('#344: symptom instruments are explicitly paired with mental-health instruments', () => {
  const requiredQueries = new Map([
    ['ibs_sss_phq9_relation', ['IBS-SSS', 'PHQ-9', 'gastrointestinal symptom severity']],
    ['gsrs_gad7_relation', ['GSRS', 'GAD-7', 'gastrointestinal symptoms']],
    ['bristol_hads_relation', ['Bristol stool', 'HADS', 'bowel symptoms']],
    ['bowel_symptom_affect_relation', ['bowel symptom diary', 'affect']],
  ]);

  for (const [topic, terms] of requiredQueries) {
    const seed = seedByTopic(topic);
    assert.ok(seed, `${topic} must remain in the seed pool`);
    for (const term of terms) assert.ok(seed.query.toLowerCase().includes(term.toLowerCase()));
  }
  assert.ok(!SEEDS.some((seed) => /log_completeness/i.test(seed.query)));
});

test('every seed has a non-empty query and carries its topic in topicTags', () => {
  for (const s of SEEDS) {
    assert.ok(s.query.trim().length > 0, `${s.topic} has a query`);
    assert.ok(s.topicTags.includes(s.topic), `${s.topic} tags include its own slug`);
  }
});

test('seedByTopic resolves a known topic and returns undefined for an unknown one', () => {
  assert.equal(seedByTopic('dengue_vector')?.topic, 'dengue_vector');
  assert.equal(seedByTopic('nope'), undefined);
});
