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

  // ---------------------------------------------------------------------------
  // #297 / #307 D5 - FAMILY-BALANCED SEEDS
  //
  // WHY THESE EXIST. The six topics above were written for the original
  // ~19-metric registry and never followed the catalogue to ~100 (memory 0014),
  // so ingestion kept deepening a microbiome/environmental corpus while the
  // registry grew self-report and wearable metrics that corpus cannot evidence.
  // Measured: two live runs on gut_comfort_score x mood_score emitted ZERO
  // claims, and the model was right to decline - those papers measure microbiome
  // COMPOSITION while gut_comfort_score is a SUBJECTIVE SELF-REPORT.
  //
  // WHY THEY ARE BALANCED BY FAMILY, not aimed at gut. A first pass added 16
  // topics of which all 16 were gut-anchored - including ones that looked like
  // other families (phq9_gastrointestinal, cognitive_function_gut_brain) but
  // routed a non-gut metric THROUGH a gut lens. Against the real registry that
  // is backwards: of 24 active metrics only FOUR are gut, while six are wearable
  // physiology, seven mental/cognitive/social and two vector. Ourobion is a One
  // Health monitor - human physiology, daily behaviour AND environmental context
  // - not a gut-health app.
  //
  // It is also the likeliest lever on BLUEPRINT YIELD. A blueprint needs a pair
  // of ACTIVE metrics, so a corpus that can only evidence gut pairs can only
  // yield gut blueprints - which is what 1 blueprint per 15 papers looks like
  // when 20 of 24 metrics are not gut. Broadening costs runner time, not
  // provider budget.
  //
  // Verified insufficient on its own: seed-queries generates 16 candidates at
  // this registry, but EIGHT of its ten metric pairs are product
  // derivation/completeness relationships, so it asks the literature about our
  // own derivation graph. Candidate count is not coverage.
  //
  // BOUNDARIES HELD:
  //  - notes and log_completeness are absent by design: they measure the APP,
  //    not the person. Same reason the gap ledger is not a selection input
  //    (15 of its 29 rows pair something against log_completeness).
  //  - spo2_pct is deliberately LEFT UNSEEDED. Broad SpO2 queries pull
  //    diagnostic literature, outside Ourobion's descriptive scope.
  //  - body_temp_c is seeded ONLY through the narrow, descriptive
  //    circadian_body_temperature, never as "body temperature".
  //  - Every query is phrased around MEASUREMENT and ASSOCIATION, never
  //    diagnosis or treatment efficacy.
  //  - These slugs are SEED IDENTIFIERS, not product metrics. Nothing here
  //    registers a metric or touches shared/metrics.
  // ---------------------------------------------------------------------------

  // -- gut instruments (4 active metrics) - kept, no longer dominant ----------
  {
    topic: 'bristol_stool_form_scale',
    query: 'Bristol stool form scale stool consistency self-report',
    topicTags: ['bristol_stool_form_scale', 'stool_form', 'stool_variability'],
  },
  {
    topic: 'ibs_sss',
    query: 'IBS-SSS irritable bowel syndrome severity scoring system symptom score',
    topicTags: ['ibs_sss', 'gut_comfort_score'],
  },
  {
    topic: 'gsrs',
    query: 'GSRS gastrointestinal symptom rating scale',
    topicTags: ['gsrs', 'gut_comfort_score'],
  },
  {
    topic: 'bowel_symptom_diary',
    query: 'bowel symptom diary daily stool frequency and consistency recording',
    topicTags: ['bowel_symptom_diary', 'stool_count', 'stool_variability'],
  },
  {
    topic: 'gut_brain_axis',
    query: 'gut brain axis gastrointestinal symptoms psychological symptoms association',
    topicTags: ['gut_brain_axis', 'gut_comfort_score', 'mood_score'],
  },

  // -- wearable physiology (6 active metrics, previously 0 seeds) -------------
  {
    topic: 'heart_rate_variability_stress',
    query: 'heart rate variability HRV daily stress association',
    topicTags: ['heart_rate_variability_stress', 'hrv_sdnn_ms'],
  },
  {
    topic: 'resting_heart_rate_recovery',
    query: 'resting heart rate day-to-day variation recovery association',
    topicTags: ['resting_heart_rate_recovery', 'resting_hr_bpm'],
  },
  {
    topic: 'sleep_duration_daytime_function',
    query: 'sleep duration daytime functioning association',
    topicTags: ['sleep_duration_daytime_function', 'sleep_duration_min'],
  },
  {
    topic: 'sleep_quality_actigraphy',
    query: 'actigraphy wearable sleep measurement quality association',
    topicTags: ['sleep_quality_actigraphy', 'sleep_duration_min'],
  },
  {
    topic: 'physical_activity_step_count',
    query: 'daily step count physical activity measurement association',
    topicTags: ['physical_activity_step_count', 'step_count'],
  },
  {
    topic: 'circadian_body_temperature',
    query: 'circadian body temperature rhythm daily variation',
    topicTags: ['circadian_body_temperature', 'body_temp_c'],
  },

  // -- mental / cognitive / social (7 active metrics, previously 0 standalone) -
  {
    topic: 'mood_affect_daily_diary',
    query: 'daily mood affect diary ecological momentary assessment',
    topicTags: ['mood_affect_daily_diary', 'mood_score'],
  },
  {
    topic: 'anxiety_daily_functioning',
    query: 'anxiety symptoms daily functioning self-report association',
    topicTags: ['anxiety_daily_functioning', 'anxiety_score'],
  },
  {
    topic: 'cognitive_clarity_attention',
    query: 'subjective cognitive clarity mental fatigue self-report',
    topicTags: ['cognitive_clarity_attention', 'brain_clarity_score'],
  },
  {
    topic: 'focus_attention_sleep',
    query: 'attention focus sleep association daily measurement',
    topicTags: ['focus_attention_sleep', 'focus_score', 'sleep_duration_min'],
  },
  {
    topic: 'social_connection_wellbeing',
    query: 'social connection interaction quality wellbeing association',
    topicTags: ['social_connection_wellbeing', 'social_interaction_quality_score'],
  },
  {
    topic: 'energy_fatigue_daily',
    query: 'daily energy fatigue self-report association',
    topicTags: ['energy_fatigue_daily', 'energy_score', 'appetite_score'],
  },

  // -- vector / One Health (2 active metrics) - a differentiator ---------------
  {
    topic: 'mosquito_exposure_behaviour',
    query: 'mosquito bite exposure human behaviour association',
    topicTags: ['mosquito_exposure_behaviour', 'mosquito_bites'],
  },
  {
    topic: 'standing_water_breeding_sites',
    query: 'standing water container breeding sites Aedes larval habitat',
    topicTags: ['standing_water_breeding_sites', 'standing_water_present'],
  },
  {
    topic: 'vector_borne_environmental_risk',
    query: 'vector borne disease environmental risk factors rainfall temperature',
    topicTags: ['vector_borne_environmental_risk', 'standing_water_present', 'mosquito_bites'],
  },

  // -- hydration / diet (2 active metrics) -----------------------------------
  {
    topic: 'hydration_urine_colour_status',
    query: 'urine colour specific gravity hydration status assessment',
    topicTags: ['hydration_urine_colour_status', 'urine_colour'],
  },
  {
    topic: 'dietary_pattern_daily_wellbeing',
    query: 'dietary pattern eating out daily wellbeing association',
    topicTags: ['dietary_pattern_daily_wellbeing', 'outside_meals'],
  },

  // -- RELATION / EDGE seeds (#307) ------------------------------------------
  //
  // The seeds above are mostly SINGLE-metric: they deepen coverage of one metric
  // each. But a claim needs BOTH endpoints to be active metrics, and a blueprint
  // needs a PAIR - so single-metric coverage does not directly feed the thing the
  // demo is counted in. These five target literature about two measures TOGETHER.
  //
  // Chosen by MEASURED co-occurrence in the existing corpus (title+abstract naming
  // two active metric concepts), not by guesswork:
  //   hrv_sdnn_ms x resting_hr_bpm  70 papers
  //   anxiety_score x mood_score    30
  //   focus_score x mood_score      30
  //   anxiety_score x hrv_sdnn_ms   25
  //   energy_score x mood_score     12
  // and deliberately spread ACROSS families rather than within one, so they widen
  // the reachable pair surface instead of deepening a corner of it.
  //
  // Same boundaries as above: association and measurement framing only, never
  // diagnosis or treatment efficacy; spo2_pct still unseeded.
  {
    topic: 'sleep_hrv_recovery_relation',
    query: 'sleep duration heart rate variability overnight recovery relationship',
    topicTags: ['sleep_hrv_recovery_relation', 'sleep_duration_min', 'hrv_sdnn_ms'],
  },
  {
    topic: 'anxiety_autonomic_relation',
    query: 'anxiety symptoms heart rate variability autonomic association',
    topicTags: ['anxiety_autonomic_relation', 'anxiety_score', 'hrv_sdnn_ms'],
  },
  {
    topic: 'activity_mood_relation',
    query: 'daily physical activity step count mood association',
    topicTags: ['activity_mood_relation', 'step_count', 'mood_score'],
  },
  {
    topic: 'hydration_cognition_relation',
    query: 'hydration status cognitive performance alertness association',
    topicTags: ['hydration_cognition_relation', 'urine_colour', 'brain_clarity_score'],
  },
  {
    topic: 'vector_environment_relation',
    query: 'mosquito biting exposure standing water household environment association',
    topicTags: ['vector_environment_relation', 'mosquito_bites', 'standing_water_present'],
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
