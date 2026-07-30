---
title: Insight-engine ADRs — index
summary: Index of the granular architecture decision records that pin down rules the top-level insight-engine architecture leaves open (citation extraction, anomaly definition, paper-reliability scoring); the architecture doc stays the canonical owner of stage definitions.
type: index
scope: shared
status: canonical
updated: 2026-07-13
---
# Insight-engine architecture decisions (ADRs)
Granular decisions that pin down rules the top-level [architecture](../insight-engine-architecture.md) left open.

<!-- BEGIN GENERATED -->
- [Citation Extraction & Reference-Graph Construction](0001-citation-extraction.md) — How stage A4b detects citation style, parses reference lists, maps in-text markers to citing claims, and clusters corroboration by independent root; pins down what insight-engine-architecture.md leaves open for A4b/A4/A6.
- [Anomaly & Personal-Signal Definition](0002-anomaly-definition.md) — Defines what counts as an observation insight at serve time — a single-metric daily anomaly (S4) or an unexplained n=1 pairwise co-movement (S5) — as deterministic functions over the user's own series, with literature-justified (provisional) thresholds.
- [Paper-Reliability Scoring](0003-paper-reliability.md) — The evidence-tier ladder and reliability axis behind A5 tiering and edgeScore/EDGE_GATES — grounded in GRADE/CEBM, keeping study-design trust (evidenceTier) and venue notability (impactTier) as separate axes because notability ≠ trust.
- [Local-Day Projection for Event and State Primitives](0004-local-day-projection.md) — Defines the additive local_day_v1 calendar, raw timezone provenance, explicit per-metric reducers, one exclusive projection watermark, half-open non-overlapping state bands, and absent quiet days for S1-to-S2 daily projection.
<!-- END GENERATED -->
