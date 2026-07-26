---
id: "0017"
title: Three support-model dataset assumptions are wrong (BioRED direction, PublicationType tiers, Cochrane Crowd)
summary: Verified against primary sources — BioRED relations are non-directional (direction needs the BioREDirect enrichment, licence unverified); MEDLINE PublicationType cannot express evidenceTier 1-3 (cohort/cross-sectional are MeSH headings, tier 1 is a check tag); and Cochrane Crowd is licensed for personal use only. brain-support-models-design.md still states all three incorrectly.
type: memory
status: accepted
decided: 2026-07-26
updated: 2026-07-26
---

# 0017 — Three support-model dataset assumptions are wrong

Checked against primary sources on 2026-07-26 while planning the remaining custom models
(issue #140). [`docs/nao/brain-support-models-design.md`](../nao/brain-support-models-design.md) still
asserts all three; it was written from live samples on 2026-07-01 but these specific claims do not hold.
**Do not reuse its recipes for (b1) or (c) without applying these corrections.**

**1. BioRED does not encode direction.** The design doc says direction comes from "arg1→arg2 order".
The BC8 BioRED track overview states the opposite: *"since the BioRED relations are nondirectional, we
eliminated the distinction between subject and object"*
(https://pmc.ncbi.nlm.nih.gov/articles/PMC11306928/). Direction supervision requires the 2025
**BioREDirect** enrichment (10,864 subject/object annotations over the same 1,000 abstracts, IAA 89.96%,
https://github.com/ncbi-nlp/BioREDirect), whose **data licence is unverified** — that is now the single
gating item for any direction model. Also: `Association` and `Bind` are inherently undirectable, so a
`symmetric` class is mandatory rather than optional.

**2. MEDLINE PublicationType cannot express `evidenceTier` 1–3.** The design doc maps cohort→3 and
cross-sectional→2 from `<PublicationType>`. There is no such publication type. Cohort Studies (D015331)
and Cross-Sectional Studies (D003430) are MeSH **subject headings**, and tier 1 (animal/in-vitro) is
signalled by the `Animals` check tag without `Humans`. Only tiers 4 (D016449 RCT) and 5 (D017418
Meta-Analysis, D000078182 Systematic Review) are genuinely PT-derived — and those two are also the ones
NLM still human-QAs after its 2022 move to automated indexing. Consequence: tier 1–3 labels are weaker
supervision than tier 4–5 labels, so per-tier metrics matter more than the macro average.
The D016449 vs D016032 ("RCTs as Topic", a heading for commentary *about* trials) trap is real and is
correctly described in the existing doc.

**3. Cochrane Crowd is personal-use only.** Proposed there as the binary RCT gate; its terms grant a
royalty-free licence for personal use only and the records are Embase-derived with restricted
redistribution. Unusable. Its 7.3%-positive imbalance figure is still a fine planning input.

Full corrected recipes, licence register, and the nine researched-and-rejected candidates live in
[`docs/temp/model-training/`](../temp/model-training/model-roster.md). Extends
[0013](0013-brain-pipeline-and-support-models-decision.md) (the support-model roster).
