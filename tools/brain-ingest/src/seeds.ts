/**
 * Topic seeds driving discovery (design §3 step 1, §10.3).
 *
 * The corpus is built from a fixed set of biomedical / environmental-health
 * domains. Each {@link Seed} pairs a stable `topic` slug (used as the resume /
 * `--seed` selector and as a `PaperRecord.topicTags` value) with the free-text
 * `query` handed to every discovery adapter's source-specific search.
 *
 * Pure data — no I/O, no network. Imports types only (ESM / NodeNext, `.js`).
 */

import type { Seed } from './types.js';

/**
 * The six study domains from design §3 step 1:
 *   gut microbiome · hydration · antibiotics · sleep/HRV · dengue/vector ·
 *   environmental health.
 *
 * `topic` is the canonical slug; `topicTags` carries it (plus any synonyms a
 * downstream filter might want) onto every `PaperRecord` discovered for the seed.
 */
export const SEEDS: readonly Seed[] = [
  {
    topic: 'gut_microbiome',
    query: 'gut microbiome human health',
    topicTags: ['gut_microbiome'],
  },
  {
    topic: 'hydration',
    query: 'hydration water intake physiology',
    topicTags: ['hydration'],
  },
  {
    topic: 'antibiotics',
    query: 'antibiotics antimicrobial resistance',
    topicTags: ['antibiotics'],
  },
  {
    topic: 'sleep_hrv',
    query: 'sleep heart rate variability HRV',
    topicTags: ['sleep_hrv'],
  },
  {
    topic: 'dengue_vector',
    query: 'dengue Aedes mosquito vector control',
    topicTags: ['dengue_vector'],
  },
  {
    topic: 'environmental_health',
    query: 'environmental health exposure pollution',
    topicTags: ['environmental_health'],
  },
] as const;

/** Every seed `topic` slug, in declaration order (used by `--seed` validation). */
export const SEED_TOPICS: readonly string[] = SEEDS.map((s) => s.topic);

/**
 * Look up a single seed by its `topic` slug. Returns `undefined` for an unknown
 * topic so callers can report a clear error rather than silently discovering all.
 */
export function seedByTopic(topic: string): Seed | undefined {
  return SEEDS.find((s) => s.topic === topic);
}
