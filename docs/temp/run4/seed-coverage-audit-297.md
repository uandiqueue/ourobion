---
title: Brain-ingest seed coverage audit (issue #297)
summary: Audits all 24 active metrics against the implemented 33-topic balanced seed pool and three remaining metric-pair candidates; a repaired bounded-ingestion probe is in flight and measured corpus coverage remains outstanding.
type: audit
scope: run4
status: accepted
updated: 2026-08-01
---

# Brain-ingest seed coverage audit (issue #297)

This docs session performed no provider call, ingestion, seed edit, R2 write, database write, or
deployment. The initial audit used `253e0ad6db31bb2a134e47546ddaba84bf284639`; the current-state
rerun uses integration head `d97a686e461ab0aa265d11f733d724c87ea8415c`, after the balanced seed
pool, scientific-discovery exclusion, identifier conversion fixes, and D1 projection workflow landed.

## Current `seed-queries` surface

Running `npx tsx src/cli.ts seed-queries --candidates-only` in `tools/brain-ingest` produced:

```text
brain-ingest db-seeds: boundary not configured ... STATIC only
topics: 33 static + 0 db
candidates: 36 (derivedFrom=1 rule_blueprint=2 static_topic=33)
```

No `data/corpus/seed-queries.json` exists at this head. Neither the ingestion workflow nor
[`brain-pipeline.yml`](../../../.github/workflows/brain-pipeline.yml) runs `seed-queries`, so the
implemented static pool is the current reviewed discovery input; an agentic query artifact still
requires a separate generation-and-inspection step.

## Remaining generated metric pairs

[`buildCandidates`](../../../tools/brain-ingest/src/seeder/candidates.ts) now excludes `notes` and
`log_completeness` on either side of both deterministic pair sources. That removes seven
`log_completeness` pairs which asked the literature about the product's own completeness graph.

| Pair | Source | Coverage judgment |
|---|---|---|
| `stool_variability` ↔ `stool_form` | `derivedFrom` | A product derivation as well as a scientifically recognizable bowel-pattern pair; do not treat the derivation alone as evidence. |
| `gut_comfort_score` ↔ `mood_score` | `rule_blueprint` | A plausible gut-brain target. The pre-#300 zero-claim runs show that broad microbiome papers did not evidence these subjective endpoints. |
| `hrv_sdnn_ms` ↔ `sleep_duration_min` | `rule_blueprint` | A plausible direct literature target. |

Candidate count is still not a corpus-coverage result: 33 candidates are topic anchors without a
metric pair, and the three pairs above arise from product metadata rather than a measured gap report.

## Implemented 33-topic pool

PR #323 retained the six original domains and added 27 family-balanced topics, including five
relation seeds. The exact current pool is:

```text
gut_microbiome, hydration, antibiotics, sleep_hrv, dengue_vector, environmental_health,
bristol_stool_form_scale, ibs_sss, gsrs, bowel_symptom_diary, gut_brain_axis,
heart_rate_variability_stress, resting_heart_rate_recovery, sleep_duration_daytime_function,
sleep_quality_actigraphy, physical_activity_step_count, circadian_body_temperature,
mood_affect_daily_diary, anxiety_daily_functioning, cognitive_clarity_attention,
focus_attention_sleep, social_connection_wellbeing, energy_fatigue_daily,
mosquito_exposure_behaviour, standing_water_breeding_sites, vector_borne_environmental_risk,
hydration_urine_colour_status, dietary_pattern_daily_wellbeing,
sleep_hrv_recovery_relation, anxiety_autonomic_relation, activity_mood_relation,
hydration_cognition_relation, vector_environment_relation
```

The `topicTags` in [`seeds.ts`](../../../tools/brain-ingest/src/seeds.ts) map these topics to **20 of
21 seedable active metrics** across all five families. `spo2_pct` is deliberately unseeded because a
broad query would pull diagnostic literature; `body_temp_c` is limited to circadian variation.
`notes` and `log_completeness` remain registered product metrics but are excluded from scientific
discovery. The balanced-pool test fails if a family is unseeded or gut topics become a majority.

## What this does and does not prove

The original six-topic pool was structurally insufficient. That implementation gap is now closed:
the static pool exceeds the issue's ≥20-topic execution target, is balanced across metric families,
and prevents app-measuring metrics from reappearing as discovery subjects.

The first discovery pass also produced a useful, bounded seeding-doctrine result: relation topics led
the metadata yields (`activity_mood_relation` **213**, `vector_environment_relation` **170**), above
every gut instrument (`ibs_sss` 146, `gsrs` 124, `bristol_stool_form_scale` 123). Pair-focused queries
were more findable in this pass than single-instrument queries. These are discovery counts, not proof
of full-text availability, evidence quality, or a relationship.

Landing code did **not** change the corpus by itself. A subsequent discovery pass raised the remote
manifest from 1,298 to 6,158 records, but its mixed PMID/PMCID converter batches failed 138/138 times;
the synthesisable corpus stayed at 756 fetched records and 739 with full text longer than 5,000
characters. PR #327 fixed mixed identifier batching and numeric-PMID coercion. At this audit's close,
#307 is running a sequential 10-paper-per-seed probe and explicitly measuring `fetched` and >5k text,
not metadata count. There is still no durable post-expansion metric-to-paper coverage artifact, and
the current `seed-queries.json` absence means agentic candidate phrasing has not been reviewed.

## Decision and remaining execution

1. Make no seed or ingestion change in this docs session; PRs #323 and #324 own the implementation.
2. Treat the earlier 22-topic proposal as superseded by the implemented 33-topic balanced pool.
3. Generate and inspect `seed-queries.json` before using agentic queries; deterministic exclusions
   must remain in code, not depend on deleting an artifact.
4. Let #307 complete and validate its bounded post-fix probe before authorizing the larger pass, then
   publish a reproducible per-family metric-to-paper coverage artifact. Missing metrics and intended
   pairs must be explicit.
5. Re-screen synthesis candidates after ingestion; do not reuse the pre-expansion candidate count or
   the earlier US$6–10 projection without measurement.

Issue #297's audit and seed-design decision are therefore resolved at the implementation layer. The
remaining ingestion and measured-coverage work belongs to #307's separately authorized flow run.
