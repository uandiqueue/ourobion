---
id: "0003"
title: Paper-Reliability Scoring
summary: The evidence-tier ladder and reliability axis behind A5 tiering and edgeScore/EDGE_GATES — grounded in GRADE/CEBM, keeping study-design trust (evidenceTier) and venue notability (impactTier) as separate axes because notability ≠ trust.
type: decision
status: accepted
decided: 2026-07-13
updated: 2026-07-13
---

# Paper-reliability scoring — architecture decision
> **Status: authoritative ground truth** · Date: 2026-07-13 · Refines: A5 / edgeScore / U1
> Part of the insight-engine architecture — see [`../insight-engine-architecture.md`](../../implemented/insight-engine-architecture.md). Contracts: [`../../../shared/brain/`](../../../shared/brain/).

# ADR: Paper-reliability scoring — the evidence-tier ladder and the reliability axis

**Status:** Proposed · **Scope:** nao brain offline authoring pipeline (doc-12 A5 tiering + `edgeScore`/`servingBand` in `shared/brain/index.ts`) · **Date:** 2026-07-13
**Contract touched:** `shared/brain/relationships.schema.ts` (`evidenceTier`, `corroboration`, `citation.impactTier`), `shared/brain/index.ts` (`edgeScore`, `EDGE_GATES`)

---

## Context

Doc-12 (0012) fixes the *shape* of trust — `edgeScore = confidence * (0.6 + 0.25*tierWeight + 0.15*corroborationBoost)`, tiers 1–5 from a coarse keyword rubric, `impactTier` deliberately excluded, corroboration saturating at 3, gates `high=0.8 / mid=0.5` — but explicitly leaves the *substance* open. Concretely, four things are underspecified or, on inspection of the code, provably wrong:

1. **The tier rubric is a dummy keyword list** ("review→5, randomized→4, cohort→3, cross-sectional→2, in vitro→1") with no grounding and linear `tierWeight = evidenceTier/5` spacing (`index.ts:42`). Linear spacing understates the qualitative jump between randomized and observational designs.
2. **`corroborationBoost` counts raw sources, not independent ones.** `index.ts:43` computes `net = supporting − contradicting` over `corroboration.{supporting,contradicting}`, which are plain counts. Ten papers re-citing one primary source currently read as ten voices — a direct violation of invariant #5 and a known confidence-inflation error in the meta-analysis literature.
3. **There is no risk-of-bias / imprecision / indirectness term at all.** Design tier alone can't separate a well-run RCT from a fragile one; GRADE downgrades exist precisely for this.
4. **Weights are asserted, not justified.** No literature anchor, no calibration path, and the numbers read as validated when they are placeholders.

Why it matters: `edgeScore` is written once at ingestion and read forever by the serve path. A wrong reliability model is a systematic, silent bias in everything the brain surfaces — and the reliability × applicability plot the UX renders per source is only honest if the reliability axis means something defensible.

---

## Options considered

### Option A — Keep doc-12's keyword tiers, just calibrate the weights
- **Pros:** zero schema change; fully deterministic already; smallest diff.
- **Cons:** inherits the raw-count corroboration bug (breaks invariant #5); no bias/precision adjustment, so a p-hacked RCT and a pre-registered one score identically; the linear ladder mis-ranks observational vs randomized. Calibrating bad structure just fits noise. **Rejected** — it can't represent the thing GRADE says reliability *is*.

### Option B — Full GRADE engine, LLM-driven at author time (GRADEpro-style)
Reproduce GRADE end-to-end: certainty bands, all five downgrade + three upgrade domains, judged by an LLM per edge.
- **Pros:** gold-standard fidelity; maps to the framework professionals actually use (GRADE Handbook; Guyatt et al. *J Clin Epidemiol* 2011 #1–15).
- **Cons:** GRADE certainty is a *body-of-evidence, per-outcome* judgment requiring a meta-analytic dataset — heavier than our 1-hop per-edge model needs (invariant #3). Full LLM judgment of every domain is expensive and non-reproducible if it ever leaked toward serve time. **Rejected as-is** — too heavy, wrong granularity — but its *domains and baselines* are borrowed wholesale in the Decision.

### Option C (CHOSEN) — OCEBM design ladder + GRADE-derived deterministic adjustments, independence-clustered corroboration
Anchor the 1–5 tiers to the **Oxford CEBM 2011 Levels of Evidence** (which map ~1:1 onto doc-12's ladder and were built as a deterministic "short-cut for busy clinicians"), re-space `tierWeight` to mirror GRADE's RCT/observational discontinuity, add **RoB2/ROBINS-I-derived** bias plus imprecision/indirectness as *offline-populated table columns* that serve-time reads and sums, and replace raw corroboration counts with **net independent evidential roots** (one voice per cluster).
- **Pros:** every term traces to a canonical source; serve path stays a pure weighted read/sum (invariant #1); fixes the independence bug (invariant #5); keeps `impactTier` out (invariant #2); LLM used only offline and only when rules are inconclusive.
- **Cons:** requires new offline table columns and a schema addition (`netIndependentRoots`, RoB/imprecision/indirectness flags); needs calibration before the numbers are trustworthy. Accepted — the cost is offline-only and bounded.

### Option D — ML-learned reliability regressor
Train a model to predict reliability from paper features.
- **Cons:** no labeled trust corpus exists; opaque and non-reproducible; high risk of smuggling citation/venue features back in and re-coupling notability to trust (invariant #2). **Rejected.**

---

## Decision

Adopt **Option C**. Reliability is a **design baseline (OCEBM) − risk-of-bias/imprecision/indirectness + independent corroboration** axis. Popularity never appears.

### 1. Tier ladder — deterministic rules first, OCEBM-anchored (extends doc-12 A5)

`evidenceTier` (1–5, unchanged type in `relationships.schema.ts:40`) is assigned by keyword/`workType` rules; the LLM assigns a tier **only when rules are inconclusive** (unchanged from A5). Grounding and provisional weights:

| Tier | Design (rule keywords) | OCEBM / GRADE grounding | `tierWeight` *(provisional — pending calibration)* |
|---|---|---|---|
| 5 | systematic review / meta-analysis of RCTs | OCEBM L1; GRADE "High" baseline | **1.00** |
| 4 | individual RCT (`randomized`, `randomised`, `placebo-controlled trial`) | OCEBM L2 | **0.80** |
| 3 | controlled cohort / prospective follow-up (`cohort`, `prospective`, `longitudinal`) | OCEBM L3; GRADE observational baseline "Low" | **0.55** |
| 2 | case-control / cross-sectional / case series | OCEBM L4 | **0.35** |
| 1 | in vitro / mechanism / bench / expert opinion | OCEBM L5 | **0.15** |

The **non-linear drop at the 4→3 boundary** (0.80→0.55) is intentional: it encodes GRADE's discontinuity (RCTs start High, observational start Low). This replaces `index.ts:42`'s linear `evidenceTier/5` with a lookup table.

### 2. Reliability formula — same skeleton, GRADE-anchored deterministic modifiers

Keep confidence-dominant structure; fold GRADE's downgrade domains in as precomputed columns:

```
baseFromTier      = tierWeight[evidenceTier]                       // §1 table
reliability       = confidence
                  * ( 0.60
                    + 0.25 * baseFromTier
                    − 0.10 * riskOfBiasPenalty        // 0..1, from RoB2/ROBINS-I domain count
                    − 0.05 * imprecisionPenalty       // CI width / n below threshold
                    − 0.05 * indirectnessPenalty      // population/outcome mismatch flag
                    + 0.15 * corroborationBoost )      // §3, independence-clustered
reliability       = clamp(reliability, 0, 1)
```

- **`riskOfBiasPenalty`** = normalized count of flagged domains from the design-appropriate tool — **RoB 2** (5 domains: randomization; deviations; missing outcome data; outcome measurement; selective reporting) for tiers 4–5, **ROBINS-I** (7 domains: confounding; selection; classification; deviations; missing data; measurement; selective reporting) for tiers 1–3. Weight kept larger than imprecision/indirectness because bias is GRADE's dominant downgrade domain.
- **`imprecisionPenalty`** derived from the already-extracted `effect.ci` (`relationshipClaim`, `relationships.schema.ts:77`) and sample size — flag when the CI crosses the decision-relevant threshold (GRADE guideline #6, imprecision).
- **`indirectnessPenalty`** = the existing `scopeCheck.mismatch` signal (`relationships.schema.ts:131`), reused.
- All four penalty/boost inputs are **table columns written by the offline authoring pipeline**; serve-time is a pure weighted sum.
- **Multiplier range check:** the bracketed multiplier is bounded in `[0.4375, 1.00]` (min at tier-1 with all penalties=1; max at tier-5, full corroboration, zero penalties), so `reliability ≤ confidence ≤ 1` and, being a strictly-positive multiple of `confidence`, is monotonic increasing in `confidence`.
- **Penalties scale with `confidence` (deliberate, flag for calibration):** because the downgrade terms sit inside the `confidence` multiplier, their *absolute* effect shrinks for low-confidence edges — unlike GRADE, where risk-of-bias downgrades unconditionally. This preserves doc-12's confidence-dominant skeleton; whether penalties should instead be applied additively/outside the multiplier is an open calibration question (§Open-Q 7).
- `impactTier` is **not** an input. It remains a separate **notability** axis feeding **ranking / discovery only**. It does **not** feed the reliability axis and it does **not** feed the *applicability* axis of the UX plot — applicability (does this evidence apply to the user's context?) is driven by directness/population match, i.e. the `indirectnessPenalty`/`scopeCheck` signal, never by citation counts or venue prestige.

### 3. Corroboration — count independent evidential roots, not papers (fixes invariant #5)

Replace `net = corroboration.supporting − corroboration.contradicting` with:

```
N_ind = supportingClusters − contradictingClusters       // independent evidential roots
corroborationBoost = N_ind <= 0 ? 0 : min(N_ind, 3) / 3    // saturates at 3
```

Two sources are **the same voice** (collapsed to one cluster) if they share **any** of: authors, institution, dataset/cohort identifier, or a common cited primary source. Clustering is one-effect-per-cluster (the tractable, literature-sanctioned remedy from Cheung 2019 / Van den Noortgate 2013). Counting is **deterministic offline**; the LLM is used only to *identify shared-source lineage* during authoring. The offline pipeline writes **`corroboration.supportingClusters: int`** and **`corroboration.contradictingClusters: int`**, and exposes the derived **`corroboration.netIndependentRoots: int` = `supportingClusters − contradictingClusters`** that `edgeScore` reads. The 0.15 weight stays below design's 0.25 — corroboration of weak evidence must not manufacture high trust (GRADE treats consistency as a modifier, not a baseline).

### 4. Gates (`EDGE_GATES`, provisional — pending calibration)

Keep `high = 0.80`, `mid = 0.50`, but **define them by exemplar behavior rather than assertion**: a tier-4 RCT at low risk-of-bias with ≥1 independent corroboration should clear `high`; a single tier-2 cross-sectional study must **not**. These are **calibration targets, not properties of the current numbers** — note that under the §2 provisional weights the tier-4/low-RoB/1-corroboration case yields a multiplier of `0.60 + 0.25·0.80 + 0.15·(1/3) = 0.85`, so it clears `0.80` only when `confidence ≳ 0.94`. Calibration (§Open-Q 2) must either confirm that confidence band is realistic for clean RCTs or adjust the weights/gate so the exemplar holds. Verified against the calibration set, not asserted.

### 5. Excluding `impactTier` is empirically justified, not just ideological

Citation counts and journal impact factor are **weak-to-negative** predictors of research quality and replicability. Dougherty & Horne 2022 report impact factor **negatively** associated with replication success (`b = −0.822`, 95% CI −1.433 to −0.255) and citation count essentially unrelated to reporting accuracy (`b = −0.008`, strong support for the null), concluding that neither metric is meaningfully related to research quality. DORA (2013) and Aksnes et al. (2019) give the institutional and theoretical backing. Fusing `impactTier` into `edgeScore` would import a signal that is *sometimes anti-correlated* with reliability — so it stays on the notability axis only.

---

## How it fits the architecture

- **Stage:** all logic lives in **doc-12 A5** (offline tiering) and the offline verifier that populates `EdgeVerification`. `edgeScore`/`servingBand`/`EDGE_GATES` in `shared/brain/index.ts` gain the §1 lookup table and §3 independent-root read; the formula stays a **pure, unit-testable function**.
- **Deterministic vs LLM:** serve-time reliability is a **pure weighted read/sum over precomputed columns** — no LLM, no agentic work at serve (invariant #1). The LLM acts **only offline**, and only to (a) assign a tier when design rules are inconclusive, (b) fill RoB/indirectness flags, (c) identify shared-source lineage for clustering. Anomaly/reliability scoring at serve time is fully deterministic.
- **TS-native / sidecars:** the scoring, clustering, and gate logic are **pure TS** in `shared/brain/`. No Python. Two optional out-of-process sidecars, both following doc-12 A4's GROBID precedent and **flagged as non-TS services**: (i) **GROBID** (already precedented in doc-12 A4) for structured section/stats extraction feeding the imprecision inputs; (ii) any RoB-domain classifier, if adopted, is a *new* non-TS sidecar invoked over CLI/HTTP, never imported into the serve path, and permitted only as an out-of-process service per invariant #4. Neither is required — rules + LLM-assist suffice, and RoB flags are LLM-populated offline by default.
- **Invariants upheld:** #1 (serve deterministic), #2 (`impactTier` excluded from both the reliability score *and* the applicability axis; empirically defended), #3 (per-edge 1-hop, monotonic — penalties only subtract, corroboration only adds, all bounded), #5 (independence clustering), #6 (unchanged — every tier/flag traces to cited papers with `quoteSpan` char-verifiable spans), #7 (all numbers marked provisional).
- **1-hop monotonicity note:** every term is a bounded per-edge quantity with a fixed sign — design/corroboration add, bias/imprecision/indirectness subtract — the multiplier stays strictly positive, so per-edge reliability is monotonic in `confidence` and no cross-edge propagation is introduced.

---

## Open questions / calibration plan

All weights and gates above are **provisional — pending calibration**. Nothing here is validated.

1. **Anchor to GRADE-rated exemplars.** Assemble a small gold set of claims already GRADE-rated (High/Moderate/Low/Very-low) in published Cochrane reviews; fit the weight vector so `reliability` bins reproduce the human GRADE band. Objective: ordinal agreement / weighted κ against the GRADE label. This borrows GRADE's own labels as ground truth.
2. **Set gates against that set** (§Decision 4): confirm the tier-4-clears-high / single-tier-2-cannot property empirically — including whether the provisional weights admit the tier-4 exemplar at a realistic `confidence` — before trusting `0.80`/`0.50`.
3. **Corroboration cap of 3** has no magic-number basis (NASEM says "multiple independent replications," not a count) — calibrate whether 3 or a soft saturation curve better matches human confidence.
4. **`tierWeight` spacing** (esp. the 0.80/0.55 gap) is a judgment call encoding GRADE's discontinuity — validate against the exemplar set rather than assert.
5. **Independence signals:** shared-cited-source detection is the hardest to compute reliably; decide the LLM prompt contract vs. citation-graph heuristic, and add `corroboration.supportingClusters` / `contradictingClusters` (with derived `netIndependentRoots`) to `relationships.schema.ts` with a superRefine tying the clusters to the supporting/contradicting source counts (clusters ≤ raw counts).
6. **Schema work required:** add `riskOfBias`, `imprecision`, `indirectness` flag columns and the cluster fields to `edgeVerificationSchema`; these are TRUTH-contract changes (2-reviewer per doc-0002).
7. **Penalty placement:** decide whether risk-of-bias/imprecision/indirectness should remain inside the `confidence` multiplier (absolute effect scales with confidence) or be applied unconditionally as GRADE does; test both against the exemplar set.

---

## Sources

- GRADE Handbook (certainty bands, RCT/observational baselines, up/downgrade thresholds): https://gdt.gradepro.org/app/handbook/handbook.html · https://gradepro.org/handbook/
- Cochrane Handbook 12.2.1, The GRADE approach: https://handbook-5-1.cochrane.org/chapter_12/12_2_1_the_grade_approach.htm
- Guyatt et al. 2011, GRADE guideline 9 (rating up): https://www.jclinepi.com/article/S0895-4356(11)00184-3/fulltext · https://pubmed.ncbi.nlm.nih.gov/21802902/
- GRADE guideline 6, Imprecision: https://pubmed.ncbi.nlm.nih.gov/21839614/
- CDC/ACIP GRADE Handbook Ch.7 (downgrade) & Ch.9 (upgrade): https://www.cdc.gov/acip-grade-handbook/hcp/chapter-7-grade-criteria-determining-certainty-of-evidence/index.html · https://www.cdc.gov/acip-grade-handbook/hcp/chapter-9-domains-increasing-ones-certainty-in-the-evidence/index.html
- OCEBM 2011 Levels of Evidence: https://www.cebm.ox.ac.uk/resources/levels-of-evidence/ocebm-levels-of-evidence · https://www.cebm.ox.ac.uk/resources/levels-of-evidence/explanation-of-the-2011-ocebm-levels-of-evidence · https://www.cebm.net/wp-content/uploads/2014/06/CEBM-Levels-of-Evidence-2.1.pdf
- Dougherty & Horne 2022 (citations/IF ≠ quality; IF↔replication b = −0.822, CI −1.433 to −0.255), *R. Soc. Open Sci.*: https://royalsocietypublishing.org/rsos/article/9/8/220334/96861 · https://pmc.ncbi.nlm.nih.gov/articles/PMC9382220/
- DORA — San Francisco Declaration on Research Assessment: https://sfdora.org/read/
- Aksnes, Langfeldt & Wouters 2019, *SAGE Open*: https://journals.sagepub.com/doi/10.1177/2158244019829575
- NASEM 2019, *Reproducibility and Replicability in Science*: https://www.ncbi.nlm.nih.gov/books/NBK547546/ · https://www.nationalacademies.org/read/25303/chapter/8
- Cheung 2019, Meta-analysis with non-independent effect sizes, *Neuropsychol. Rev.*: https://pmc.ncbi.nlm.nih.gov/articles/PMC6892772/
- Van den Noortgate et al. 2013, Three-level meta-analysis, *Behav. Res. Methods*: https://link.springer.com/article/10.3758/s13428-012-0261-6
- Cochrane risk-of-bias tools — RoB 2 & ROBINS-I domains: https://methods.cochrane.org/bias/risk-bias-non-randomized-studies-interventions · https://www.riskofbias.info/welcome/robins-i-v2
