---
title: Brain-ingest seed coverage audit (issue #297)
summary: Audits the current seed-query generator against all 24 active metrics and ten generated metric pairs, deciding that static seeds must not be edited before the synthesis revamp and reviewed vocabulary work.
type: audit
scope: run4
status: accepted
updated: 2026-08-01
---

# Brain-ingest seed coverage audit (issue #297)

This is an audit and decision record only. It performs no provider call, ingestion, seed edit, R2
write, database write, or deployment. Evidence was collected at
`253e0ad6db31bb2a134e47546ddaba84bf284639` and rechecked after Session A landed at
`dea055c8155c1e9c6851931f4de9816a88d66b2d`; the candidate set and decision did not change.

## What `seed-queries` actually covers

The candidate builder in
[`tools/brain-ingest/src/seeder/candidates.ts`](../../../tools/brain-ingest/src/seeder/candidates.ts)
enumerates only registry `derivedFrom` pairs, pairs co-named by a rule blueprint, and six static
topics. Running it with the real registry and blueprints produced:

```text
candidates:16 {"derivedFrom":8,"rule_blueprint":2,"static_topic":6}
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
| `gut_comfort_score` ↔ `mood_score` | `rule_blueprint` | Scientifically plausible topic, but current microbiome-heavy corpus and generic vocabulary did not yield a surviving claim. Needs instrument-aware terms after #300. |
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
metric-to-paper coverage report after the synthesis revamp.

## Vocabulary gap

The current prompt may ask an LLM for synonyms and MeSH terms, but the generator can only expand the
candidates it receives. It cannot cover omitted metrics or distinguish product-derived pairs from
scientific relationships. Candidate vocabulary for the next reviewed design includes **IBS-SSS,
GSRS, Bristol Stool Form Scale, bowel diary, PHQ-9, GAD-7, and HADS**. These are vocabulary candidates,
not adopted measures, product claims, or authorization to ingest.

## Decision

1. Do **not** edit `seeds.ts` or add static seeds in this session.
2. Do **not** run ingestion before issue #300; improving retrieval cannot repair a synthesizer that
   currently emits zero claims on well-matched papers.
3. After #300, separate product-derivation pairs from scientific candidate pairs, add reviewed
   instrument-aware vocabulary as data, generate `seed-queries.json`, and inspect it before ingest.
4. Require a coverage artifact over all active metrics and intended insight pairs. Missing metrics
   must be explicit; a total candidate count is not an adequacy result.
5. Keep `notes` and `log_completeness` out of scientific discovery unless a later design records a
   concrete, reviewed reason.

Issue #297 is therefore an audit decision, not an execution request: the current seeder is
structurally insufficient for the active registry, and execution belongs after #300.
