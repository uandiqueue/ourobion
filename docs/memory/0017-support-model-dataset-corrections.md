---
id: "0017"
title: Support-model dataset corrections
summary: BioRED does not supervise direction, MEDLINE PublicationType cannot label evidence tiers 1–3 by itself, and Cochrane Crowd's terms do not support the proposed training use; do not restore those recipes.
type: memory
status: accepted
decided: 2026-07-26
updated: 2026-08-02
verified_by: Jayden
verified_at: 2026-08-02T22:08:41Z
---

# Support-model dataset corrections

Three attractive dataset shortcuts were rejected after primary-source review. Preserve the negative
knowledge so future model planning does not silently restore them.

1. **BioRED does not encode direction.** Its relations are non-directional; argument order is not
   subject-to-object supervision. A direction model needs an independently licensed directional
   enrichment such as BioREDirect, and symmetric relations still require a symmetric/abstain outcome.
2. **MEDLINE `PublicationType` cannot express evidence tiers 1–3 by itself.** Cohort and
   cross-sectional study types are MeSH subject headings, while animal-only evidence uses check tags.
   Publication type can support higher-tier RCT, meta-analysis, and systematic-review labels but is
   not the claimed complete five-tier label source.
3. **Cochrane Crowd is not an available training shortcut.** Its personal-use terms and
   Embase-derived records do not support the proposed RCT-gate training/redistribution posture.

Do not list BioRED as a direction-training dataset or broaden Zebra beyond its approved SciFact-only
programme. Corrected plans, citations, licence gates, and rejected alternatives belong in
[`docs/development/model-training/`](../development/model-training/).
