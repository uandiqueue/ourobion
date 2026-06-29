/**
 * Seed tests (design §3 step 1, §10.3) — node:test, via tsx. NO network.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SEEDS, SEED_TOPICS, seedByTopic } from '../src/seeds.js';

test('the six design §3 study domains are present', () => {
  assert.deepEqual(
    [...SEED_TOPICS].sort(),
    [
      'antibiotics',
      'dengue_vector',
      'environmental_health',
      'gut_microbiome',
      'hydration',
      'sleep_hrv',
    ].sort(),
  );
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
