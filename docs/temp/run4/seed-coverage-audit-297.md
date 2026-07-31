---
title: Brain-ingest seed coverage audit (issue #297)
summary: Audits seed-query generation against all 24 active metrics, finds only two scientifically useful generated pairs, and hands Session A a reviewed 22-topic expansion decision without editing seeds or running ingestion.
type: audit
scope: run4
status: accepted
updated: 2026-08-01
---

# Brain-ingest seed coverage audit (issue #297)

This is an audit and decision record only. It performs no provider call, ingestion, seed edit, R2
write, database write, or deployment. Evidence was collected at
`253e0ad6db31bb2a134e47546ddaba84bf284639` and rechecked after Session A landed at
`dea055c8155c1e9c6851931f4de9816a88d66b2d`, then rerun at post-#300 head
`abcba95f8386d31c49f62f20f4b623de180e29c0`; the candidate set did not change.

## What `seed-queries` actually covers

The candidate builder in
[`tools/brain-ingest/src/seeder/candidates.ts`](../../../tools/brain-ingest/src/seeder/candidates.ts)
enumerates only registry `derivedFrom` pairs, pairs co-named by a rule blueprint, and six static
topics. Running it with the real registry and blueprints produced:

```text
topics: 6 static + 0 db (db seeds unavailable — static only)
candidates: 16 (derivedFrom=8 rule_blueprint=2 static_topic=6)
```

That is ten metric-pair candidates plus six domain anchors. The result agrees with the real-data
assertion in [`tools/brain-ingest/tests/seeder.test.ts`](../../../tools/brain-ingest/tests/seeder.test.ts).
No `data/corpus/seed-queries.json` exists at the refreshed head. Neither the ingestion workflow nor
the new [brain pipeline](../../../.github/workflows/brain-pipeline.yml) runs `seed-queries`, so cloud
execution cannot silently fill this gap. Ingest therefore falls back to the static/manual seed path
unless a reviewed artifact is generated separately.

## All generated metric pairs

| Pair | Source | Coverage judgment |
|---|---|---|
| `stool_variability` ↔ `stool_form` | `derivedFrom` | Deterministic product derivation, not itself a scientific relationship to retrieve. |
| `log_completeness` ↔ `urine_colour` | `derivedFrom` | Product completeness math; should not become a literature edge. |
| `log_completeness` ↔ `stool_form` | `derivedFrom` | Product completeness math; should not become a literature edge. |
| `log_completeness` ↔ `outside_meals` | `derivedFrom` | Product completeness math; should not become a literature edge. |
| `log_completeness` ↔ `mosquito_bites` | `derivedFrom` | Product completeness math; should not become a literature edge. |
| `log_completeness` ↔ `energy_score` | `derivedFrom` | Product completeness math; should not become a literature edge. |
| `log_completeness` ↔ `mood_score` | `derivedFrom` | Product completeness math; should not become a literature edge. |
| `log_completeness` ↔ `gut_comfort_score` | `derivedFrom` | Product completeness math; should not become a literature edge. |
| `gut_comfort_score` ↔ `mood_score` | `rule_blueprint` | Scientifically plausible topic, but current microbiome-heavy corpus and generic vocabulary did not yield a surviving pre-#300 claim. Needs instrument-aware retrieval terms; whole-paper synthesis does not repair corpus coverage. |
| `hrv_sdnn_ms` ↔ `sleep_duration_min` | `rule_blueprint` | Plausible direct literature target and the strongest current generated metric pair. |

Eight of ten pairs are therefore implementation/provenance relationships, not useful discovery
questions. Candidate count is not coverage.

## Active-metric coverage

The active registry was loaded from [`shared/metrics/registry.ts`](../../../shared/metrics/registry.ts)
and filtered by `status === 'active'` → **24 metrics**.

| Coverage class | Active metrics | Reason |
|---|---|---|
| Plausible direct current anchor | `urine_colour`, `mosquito_bites`, `standing_water_present`, `resting_hr_bpm`, `hrv_sdnn_ms`, `sleep_duration_min` | Hydration, dengue/vector, and sleep/HRV anchors can name these concepts without inventing a symptom instrument. This is retrieval plausibility, not proof of corpus support. |
| Weak or indirect current anchor | `stool_form`, `stool_count`, `stool_variability`, `outside_meals`, `energy_score`, `mood_score`, `gut_comfort_score`, `appetite_score`, `anxiety_score`, `brain_clarity_score`, `focus_score`, `social_interaction_quality_score`, `symptom_flags`, `spo2_pct`, `body_temp_c`, `step_count` | A general gut-microbiome or health anchor is too broad to guarantee the instrument, construct, population, or pair. The current corpus is microbiome-heavy and lacks an established subjective-symptom instrument layer. |
| Do not seed as a scientific variable | `notes`, `log_completeness` | Free text and product completeness metadata are not literature endpoints. Their product semantics should stay outside relationship discovery. |

The direct class is only a query-plausibility judgment. This audit does **not** assert that the
1,298-paper corpus contains usable evidence for those metrics; that requires a reproducible
metric-to-paper coverage report after the seed expansion and bounded ingestion.

## Vocabulary gap

The current prompt may ask an LLM for synonyms and MeSH terms, but the generator can only expand the
candidates it receives. It cannot cover omitted metrics or distinguish product-derived pairs from
scientific relationships. Candidate vocabulary for the next reviewed design includes **IBS-SSS,
GSRS, Bristol Stool Form Scale, bowel diary, PHQ-9, GAD-7, and HADS**. These are vocabulary candidates,
not adopted measures or product claims.

## Reviewed topic expansion for Session A

`seed-queries` is **not suitable on its own**: eight of its ten pairs describe product derivation,
and six broad anchors do not cover the subjective instruments or several active endpoints. The
following 22-topic pool is the #297 decision handed to Session A for its separate implementation and
bounded-ingestion session. Slugs are proposed data identifiers, not new product metrics.

| Proposed topic | Query focus | Active coverage intent |
|---|---|---|
| `gut_microbiome` | gut microbiome human health | retain existing broad anchor |
| `hydration` | hydration water intake urine colour physiology | `urine_colour` |
| `antibiotics` | antibiotics microbiome recovery | corpus balance / context |
| `sleep_hrv` | sleep duration HRV SDNN resting heart rate | `sleep_duration_min`, `hrv_sdnn_ms`, `resting_hr_bpm` |
| `dengue_vector` | Aedes bites standing water dengue exposure | `mosquito_bites`, `standing_water_present` |
| `environmental_health` | environmental and heat exposure health | environmental context, `body_temp_c` scope screening |
| `bristol_stool_form_scale` | Bristol Stool Form Scale validation | `stool_form` |
| `bowel_movement_frequency` | bowel movement frequency diary | `stool_count` |
| `bowel_habit_variability` | day-to-day bowel habit variability | `stool_variability` |
| `ibs_sss` | IBS Severity Scoring System abdominal pain bloating bowel habit | `gut_comfort_score`, `symptom_flags` |
| `gsrs` | Gastrointestinal Symptom Rating Scale | `gut_comfort_score`, `symptom_flags` |
| `bowel_symptom_diary` | bowel symptom diary validation | stool metrics, `symptom_flags` |
| `gut_brain_axis` | gastrointestinal symptoms mood gut-brain axis | `gut_comfort_score`, `mood_score` |
| `phq9_gastrointestinal` | PHQ-9 depressive symptoms gastrointestinal | `mood_score`, `energy_score` |
| `gad7_gastrointestinal` | GAD-7 anxiety gastrointestinal symptoms | `anxiety_score`, `gut_comfort_score` |
| `hads_gastrointestinal` | HADS anxiety depression gastrointestinal | `anxiety_score`, `mood_score`, gut comfort |
| `appetite_gut_symptoms` | appetite change gastrointestinal symptoms | `appetite_score` |
| `fatigue_energy_gut` | fatigue energy gastrointestinal symptoms | `energy_score` |
| `cognitive_function_gut_brain` | cognition focus brain fog gut-brain | `brain_clarity_score`, `focus_score` |
| `social_functioning_gut_symptoms` | social functioning gastrointestinal symptom burden | `social_interaction_quality_score` |
| `food_away_from_home_diet` | food away from home diet quality gastrointestinal | `outside_meals` as context, not a causal endpoint |
| `physical_activity_gut_mood` | step count physical activity gut symptoms mood | `step_count`, mood/gut pairs |

`notes` and `log_completeness` stay excluded. `spo2_pct` and standalone `body_temp_c` need a narrower
product/research question before receiving dedicated seeds; broad medical queries would invite
diagnostic literature unrelated to Ourobion's descriptive scope.

## Decision

1. Do **not** edit `seeds.ts` or add static seeds in this session.
2. #300 has landed. Session A may now implement the reviewed topic pool and bounded ingestion as its
   MVP goal 1; this docs session still makes no seed edit, provider call, or ingestion run.
3. Separate product-derivation pairs from scientific candidate pairs, add instrument-aware vocabulary
   as versioned seed data, generate `seed-queries.json`, and inspect it before ingest.
4. Require a coverage artifact over all active metrics and intended insight pairs. Missing metrics
   must be explicit; a total candidate count is not an adequacy result.
5. Keep `notes` and `log_completeness` out of scientific discovery unless a later design records a
   concrete, reviewed reason.

Issue #297 is therefore an audit decision, not an execution request: the current seeder is
structurally insufficient for the active registry, and the 22-topic handoff above is ready for
Session A's separately authorized execution.
