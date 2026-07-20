---
title: Phase-2 Decisions — Evidence Review
summary: The accumulating cited evaluation of the Phase-2 run's empirical decisions. Appended per decision (never batched). Record-only — no decision is changed here. Dev aid (docs/temp), not ground truth. Companion to research-orchestration-log.md + references.md.
type: plan
scope: shared
status: canonical
updated: 2026-07-18
---

# Phase-2 Decisions — Evidence Review

Record-only. Sections appended **as each decision is researched** (see the resume protocol in
`research-orchestration-log.md`). Full citations collected in `references.md`.

## Triage (written in RU1)

Class **(a) empirical/scientific** = the value or method can be judged against published literature
for the n=1 daily self-tracking regime → gets an RU research unit. Class **(b) process/engineering**
= workflow, sequencing, schema, or product judgment with no external literature to test it against →
no research needed (honesty about that is the finding).

| Decision | Class | Note |
|----------|-------|------|
| C1 · `EDGE_GATES` 0.8/0.5 | **empirical** | serving thresholds on a composite score → RU2 |
| C2 · edgeScore weights 0.6/0.25/0.15 + OCEBM tiering | **empirical** | weighting scheme + evidence-hierarchy basis (ADR-0003) → RU2 |
| C3 · median+MAD anomaly, deadbandK=1.0, 28d window, minDays=14, \|M\|>3.5 | **empirical** | robust-statistics core (ADR-0002) → RU3 |
| C4 · Spearman \|ρ\|≥0.3, BH q≤0.05, Pyper–Peterman N_eff≥10, 60d window | **empirical** | the run's central inferential gate → RU4 |
| C5 · baseline confidence cutoffs 3/5/14 days | **empirical** | day-count cutoffs; doc admits "no basis either way" for 5 vs 7 → RU5 |
| C6 · model ids per node | process | model selection/routing; no scientific claim. No research needed |
| C7 · LLM budget caps | process | cost control; no research needed |
| C8 · impactTier bands (SJR Q1, h-index ≥100/≥50) | **empirical** | scientometrics literature exists (SJR vs JIF, h-index) → RU6 |
| C9 · seeding from registry + curated priors only | process | graph-hygiene policy; rationale (avoid spurious correlations) is sound engineering, no threshold to test |
| C10 · lag windows {0,1,3,7} days | **empirical** | physiological lag claims (gut transit, environmental exposure) are checkable → RU7 |
| C11 · wave sizing ~45 metrics / ceiling 100 | process | restated product decision, not new; no research needed |
| C12 · DQS weights (7 T1 metrics, sum 100) | process | product-defined completeness score; arbitrary-by-design, ratified as-is |
| D1 · stacked-PR merge policy | process | git workflow |
| D2 · no worktrees, sequential sessions | process | workflow |
| D3 · build order L0→storage→router→engine | process | sequencing |
| D4 · verifier as fixture-tested scaffold | process | build sequencing. (The underlying non-Anthropic-verifier invariant is empirical — LLM self-preference bias — but it is ADR/memory ground truth, not a run decision; one supporting citation noted in RU2 if encountered) |
| D5 · `deadbandK` semantics over `deadbandSigma` | **empirical** | robust-units deadband — folds into RU3 |
| D6 · run docs in docs/shared | process | doc taxonomy |
| D7 · discrepancy surfaced not corrected | process | integrity/process |
| D8 · required/nullable L0 fields | process | schema strictness |
| D9 · storage schema judgment calls | process | schema/RLS |
| D10 · rule-blueprint contract calls | process | contract design |
| D11 · S2/S3 calls (log_date, daily **mean** aggregation, numeric widening) | process | mostly schema; the mean-vs-median daily aggregation edge gets a side note in RU3 |
| D12 · baselineMinDays re-check after artifact rejection; 105-pair BH scope | **empirical** | splits: minDays re-check → RU3; pair scope / BH-per-run → RU4 |
| D13 · edge-store upsert+prune, hard-fail loader | process | data-engineering |
| D14 · disjoint branch rules; serve gate q≤0.05 ∧ N_eff≥10 ∧ stable | mixed | branch disjointness = process; serve-gate reuse of C4 thresholds → RU4 |
| D15 · honest end-state for L6 slice | process | integrity choice; no research needed |

**Empirical units to research:** RU2 (C1+C2), RU3 (C3+D5+D12a), RU4 (C4+D12b+D14a), RU5 (C5),
RU6 (C8), RU7 (C10). Everything else: no research needed.

## Researched decisions (RU2…)

<!-- Template per decision:
### C_ / D_ · <choice>
- **Run's rationale:** …
- **Method soundness (n=1 regime):** … [cite]
- **Value defensibility:** supported by literature / reasonable convention / arbitrary — needs calibration
- **Verdict:** keep / adjust (range) / needs calibration before trust
- **Citations:** [ref-keys → references.md]
-->

### RU2 · C1 + C2 — edge gating (`EDGE_GATES` 0.8/0.5) & edge scoring (0.6/0.25/0.15, saturation at 3, impactTier excluded)

**Researched 2026-07-17** via the deep-research harness (5 angles, 23 sources fetched, 106 claims
extracted, 25 adversarially verified 3-vote: 21 confirmed / 4 refuted). Verification-status note:
the impactTier-exclusion claims (§d below) fell below the harness's top-25 verify budget, so they are
quote-extracted from primary sources but did not get the 3-vote pass; they were instead cross-checked
against ADR-0003's own citations (the Dougherty–Horne coefficients match exactly: b = −0.822,
95% CI [−1.433, −0.255]).

**Restatement.** Shipped code (`shared/brain/index.ts:40-48`):
`edgeScore = confidence × (0.60 + 0.25·(evidenceTier/5) + 0.15·corroborationBoost)`, corroboration
saturating at 3 **raw net** sources; `servingBand` gates at 0.8 (high) / 0.5 (mid). Accepted ADR-0003
(direction, lands with A10 data) replaces the linear tier term with an OCEBM-anchored non-linear lookup
(1.00/0.80/0.55/0.35/0.15), adds RoB/imprecision/indirectness penalties, and clusters corroboration to
independent evidential roots. Run's rationale: verifier confidence is the only instrument-tested axis;
all values flagged provisional-until-calibrated.

**(a) The composite-score form itself — literature is actively hostile, not just silent.**
Jüni et al. applied 25 published quality scales to the same 17 trials and showed the "high-quality"
subset flips with the arbitrary choice of scale (pooled RRs 0.63–0.90 vs 0.52–1.13; 6 scales showed
benefit only in low-quality trials, 7 the opposite), concluding summary quality scores should not be
used — the finding that led Cochrane to abandon numeric quality scores for domain-by-domain judgment
[juni-1999]. Greenland's objections to univariate composite quality scores and the empirical failure
of stratifying by them are reviewed in [doi-2014]. GRADE itself is explicitly *not* an additive
score: domain concerns "may not equate in a one-to-one relationship to the overall certainty"
[cdc-grade-ch7], and no mathematical formula combines its factors [cochrane-ch14]. The National
Quality Forum position is that validating a composite's inputs does not validate the composite —
the weighted score needs its own validation [kara-2022]. Engineering precedent points the same
way: Knowledge Vault found a learned non-linear fusion "considerably better" than linear weighting
[knowledge-vault-2014]. **Mitigation already present in the repo:** ADR-0003's calibration plan
(fit weights against GRADE-rated Cochrane exemplars, Open-Q 1) is precisely the remedy this
literature implies; the score is also monotonic, bounded, and unit-tested, which answers the
transparency objection in [kara-2022], not the validity one.

**(b) The specific weights 0.60/0.25/0.15 — arbitrary (as the run itself admits).**
No published source supports these numbers or any resembling scheme. In a 145-study mapping of
composite health-care measures, ~91% (107/118 applicable) used equal weighting; of 16 using
differential weights, expert opinion outnumbered any empirical method [kara-2022]. Doi states weights
are "currently taken to be an equal weight across items" for lack of meta-epidemiological weighting
data [doi-2014]. Quality-scale reviews find most scales never validated [olivo-2008]. Verdict on
defensibility: **engineering judgment, uncited** — and the equal-weights "convention" is itself a
default of ignorance, not evidence the 0.60/0.25/0.15 split is wrong. The confidence-dominant
structure (multiplying by `confidence` so no structural bonus can rescue an unconfident edge) is a
coherent design property the literature neither endorses nor refutes.

**(c) OCEBM/GRADE tier anchoring (ADR-0003 direction) — half supported, half over-claimed.**
Supported: GRADE genuinely starts RCTs at "high" and observational studies at "low," a two-level
discrete jump skipping "moderate" [cochrane-ch14, cdc-grade-ch7, lima-2023] — so ADR-0003's
non-linear 4→3 drop (0.80→0.55) encodes a real convention, and the shipped linear `evidenceTier/5`
is the *less* defensible of the two (ADR-0003 already says so). Over-claimed: OCEBM 2011 is an
explicitly non-quantitative, judgment-required search heuristic — "NOT intended to provide you with
a definitive judgment about the quality of evidence"; it contains no weights, thresholds, or
composite formula, so numeric anchoring extends the instrument beyond its authors' stated purpose
[ocebm-2011-expl, ocebm-2011-intro]. Two empirical caveats: (i) GRADE's ROBINS-I pathway lets
non-randomized studies start high, so the design gap is not a fixed rung [cdc-grade-ch7]; (ii)
meta-epidemiological studies find little-to-no *average* divergence between RCT and observational
effect estimates (ratio of ratios 1.08, 95% CI 1.01–1.15 across 47 reviews [toews-2024]; RRR 1.04,
95% CI 0.99–1.10 in nutrition [stadelmaier-2024]) — both rated low-certainty with high heterogeneity,
so this narrows but does not eliminate the case for a design gap; it does caution against making the
tier term *larger*.

**(d) impactTier exclusion — the empirically strongest choice in C1/C2** *(quote-extracted, not
3-vote verified; coefficients cross-checked against ADR-0003)*. Citation counts and journal impact
factors are weak, inconsistent, sometimes *negative* predictors of statistical-reporting accuracy,
evidential value, and replicability (higher JIF ↔ lower replication odds, b = −0.822, CI [−1.433,
−0.255]; all models R² ≤ 0.022) [dougherty-horne-2022]. Journal rank predicts unreliability and
retractions in the wrong direction [brembs-2013]; non-replicable papers are cited *more* than
replicable ones, the gap largest in Nature/Science, with no post-failure citation correction
[serra-garcia-2021]. DORA is the institutional consensus against journal-based metrics as
article-quality surrogates [dora-2013]. GRADE gives venue prestige no role in any domain
[cochrane-ch14, cdc-grade-ch7]. **Value defensibility: supported by literature.**

**(e) Corroboration saturation at 3 — concept supported, count conventional.**
Independent corroboration raising claim reliability is textbook (NASEM 2019: a consistent second
study makes a claim "more likely to represent a reliable claim to new knowledge"; non-independent
studies sharing bias propagate error — which supports ADR-0003's independence-clustering fix over
the shipped raw count) [nasem-2019]. But no source supports the count 3: GRADE mandates no minimum
study count [cochrane-ch14]; NASEM says "multiple," not a number. Precedents are conventions:
an independent research-verification system also saturates redundancy at exactly `min(flow/3, 1)`
citing diminishing returns as a design choice [platos-cave-2026]; the "three-source rule" is
intelligence-tradecraft practice, not literature. Knowledge Vault instead uses smooth √n (or
log(1+n)) damping with per-domain dedup — a soft-saturation alternative ADR-0003's Open-Q 3 already
contemplates [knowledge-vault-2014]. **Value defensibility: reasonable convention, empirically
uncited.**

**(f) Gates 0.8/0.5 (C1) — arbitrary; and gates on an uncalibrated score are semantically empty.**
No published basis for 0.8/0.5. The EBM literature warns that cutoffs "along the continuum of summary
scores may introduce bias" [olivo-2008] and Jüni shows threshold membership is scale-dependent
[juni-1999]. The strongest engineering precedent — Knowledge Vault's 0.9/0.7 confident-fact gates —
works *because* its scores are Platt-calibrated probabilities (a 0.9 gate empirically means ~90% true)
[knowledge-vault-2014]; `edgeScore` is not calibrated to anything, so 0.8 currently has no operational
meaning beyond rank order. ADR-0003's own exemplar arithmetic exposes the tension: a clean tier-4 RCT
with one corroboration clears `high` only at confidence ≳ 0.94. **Value defensibility: arbitrary —
needs calibration data** (which is exactly the run's own label: "dummy pending calibration").

**Verdicts.**
- **C1 gates 0.8/0.5: needs empirical calibration before trust.** Keep only as provisional rank-order
  bands; calibrate against a GRADE-rated exemplar set (ADR-0003 Open-Q 1–2 is the right plan) or
  against verifier-confidence calibration curves when A10 runs. Until then treat `high` vs `mid` as
  UX ordering, not a truth claim.
- **C2 weights: keep as baseline, explicitly uncited.** No literature supports these numbers or any
  alternative numbers; the literature's actual position is that fixed-weight composites should be
  validated or avoided. The run's provisional-until-calibrated framing is the honest one. Suggested
  guardrail: report the components (confidence, tier, corroboration) alongside the composite wherever
  an edge is surfaced for review, per Cochrane's domain-wise practice [juni-1999, cdc-grade-ch7].
- **C2 OCEBM/GRADE anchor: keep direction, soften the claim.** The non-linear RCT/observational gap is
  GRADE-consistent; stop short of implying OCEBM licenses numeric weights. Don't enlarge the tier term
  given [toews-2024, stadelmaier-2024].
- **C2 saturation at 3: keep as convention; prefer soft saturation (√n / log(1+n)) at calibration time.**
- **C2 impactTier exclusion: keep — supported by literature.** The one nuance from [platos-cave-2026]:
  peer-reviewed-vs-not (venue *type*) can be a legitimate credibility input even where venue *prestige*
  is excluded — the current design already captures this via evidenceTier, so no change implied.

**Citations:** [juni-1999] [olivo-2008] [doi-2014] [kara-2022] [ocebm-2011-expl] [ocebm-2011-intro]
[cdc-grade-ch7] [cochrane-ch14] [lima-2023] [toews-2024] [stadelmaier-2024] [nasem-2019]
[dougherty-horne-2022] [brembs-2013] [serra-garcia-2021] [dora-2013] [knowledge-vault-2014]
[platos-cave-2026]

### RU3 · C3 + D5 + D12a — robust anomaly baseline (median+MAD, deadbandK=1.0, 28d window, minDays=14, |M|>3.5)

**Researched 2026-07-17** via the deep-research harness (5 angles incl. one deliberately skeptical
n=1-methodology angle; 21 sources fetched, 73 claims, 25 adversarially verified 3-vote: 21 confirmed /
4 refuted). ADR-0002 is already the ground-truth source for S4 and is densely self-cited; RU3's job was
to test whether those cited methods and the values ADR-0002 marks *provisional* actually hold for the
n=1 daily regime — not to re-find the citations.

**Restatement.** Per ADR-0002 §S4 and config doc C3: robust baseline `median + MAD`,
`σ̂ = MAD/0.6745`, modified z `M = 0.6745·(x−median)/MAD`; artifact rejection `|M| > 3.5`; daily
3-state deadband `neutral := |x−median| ≤ deadbandK·σ̂` with **deadbandK = 1.0**; 28-day rolling
window; **baselineMinDays = 14**; MAD-degeneracy fallback (suppress → neutral). **D5** = shipping the
ADR-0002 `deadbandK` (robust-σ̂ units) contract field rather than the architecture doc's superseded
`deadbandSigma = 0.5` (mean/SD). **D12a** = re-checking `baselineMinDays` against *clean* days after
artifact rejection. This whole set replaces the architecture doc's original mean/SD + 0.5σ dummy.

**(a) median+MAD, the 0.6745 rescale, and |M|>3.5 — literature-supported (textbook).**
The construction is the exact Iglewicz–Hoaglin (1993) modified z-score. `0.6745 = Φ⁻¹(0.75) =
median(|Z|)` for a standard normal (independently verified numerically: 0.674489…), so `MAD/0.6745
= 1.4826·MAD` is a consistent estimator of σ under normality — placing `M` on the same scale as a
classical z-score [iglewicz-hoaglin-1993, nist-outliers, metricgate-mz]. `|M| > 3.5` is the *named*
Iglewicz–Hoaglin default, also recommended by NIST/SEMATECH [nist-outliers, statology-mz]. **One
correction to any implied rationale:** the specific claim that 3.5 was *simulation-calibrated to match
the |z|>3 false-positive rate* was **refuted 0-3** in verification — 3.5 is a literature-standard
convention/default, not a value with a verified FP-equivalence derivation. Under markedly heavy tails
it should be re-derived by simulation.

**(b) Preferring median/MAD over mean/SD — sound, and directly on-point for n=1.**
Median and MAD have a ~50% breakdown point vs 0% for mean/SD, so a single gross outlier inflates SD and
masks itself — exactly the small-sample, heavy-tailed, outlier-prone regime here (Huber; Hampel;
Rousseeuw–Croux 1993, corroborated across sources) [metricgate-mz, sd-calc-mz]. Classical z can't flag
an outlier for n<12; modified z has no such floor. **Two caveats to carry:** (i) on *clean* Gaussian
data MAD loses ~37% efficiency vs SD; (ii) **zero-MAD when >50% of in-window values tie** makes `M`
undefined — a real hazard for ordinal/low-cardinality self-tracked data, which is precisely why
ADR-0002's degeneracy fallback (§S4, Open-Q 9) is load-bearing, not optional. This vindicates the D5
choice of robust units over the superseded mean/SD `deadbandSigma`.

**(c) deadbandK = 1.0 — arbitrary; and likely mis-scaled for "anomaly" semantics.**
No source supports `k=1.0` as a fire threshold. Under a Gaussian a ±1σ̂ neutral band leaves only
~68.3% of days neutral and **fires ~31.7% of days (~15.9% up / ~15.9% down)**; under heavier tails the
fire rate is *higher* still (derivation from the normal CDF; the 3σ→0.27% SPC anchor confirmed 3-0)
[spc-3sigma]. So `k=1.0` is defensible **only if a ~1-in-3 daily 3-state nudge is the intended product
behavior**; if the intent is occasional *anomaly* alerts, ~1σ is far too tight and `k` should be
substantially larger. ADR-0002 already flags this (its own note: ≈68% neutral, fires ~1 day in 3,
provisional; sweep 0.75–1.5 in Open-Q 2). A related claim that a ~3σ *robust* limit stays low/stable
on non-normal data was **refuted 0-3**, so heavy-tailed fire behavior is genuinely uncharacterized.
**Value defensibility: arbitrary — needs calibration against a target fire/false-alarm rate.** The
gap between "anomaly" framing and a ~32% fire rate is the single most actionable finding in RU3.

**(d) 28-day rolling window — reasonable published convention; individualized baseline — strongly supported.**
Building a *personal* baseline (not a population norm) is well-grounded: intra-individual resting-HR
variability is ~an order of magnitude narrower than the 40–109 bpm between-person spread, and
demographics poorly predict individual RHR (Quer et al. 2020, PLOS ONE, N=92,457) [quer-2020]. A 28-day
sliding window is a real published convention — Stanford's RHR-Diff standardizes residuals against a
28-day sliding average [stanford-rhrdiff]. **But it is adopted by convention, not validated against
7/14/21-day alternatives**, and is metric-specific (weekly periodicity + autocorrelation argue for a
per-signal stability check). **Value defensibility: reasonable convention.**

**(e) baselineMinDays = 14 (and the D12a clean-day re-check) — arbitrary / unsupported.**
No confirmed source specifies any minimum-days rule, and the one "~2–4 week / 21-day HRV baseline"
claim that would have partially supported 14 **failed verification (split 1-2)** [sano-blog, refuted].
The individualized-baseline literature says *what* to build, not *how many days minimum*. So `14` is
engineering judgment, uncited. **D12a is directionally correct and costs nothing** — requiring 14
*clean* post-artifact-rejection days is strictly more conservative than 14 raw days, and ADR-0002 is
silent, so the conservative reading is a safe judgment call — but it inherits C3's underlying problem:
the number 14 it operates on is itself uncalibrated. **Value defensibility: arbitrary — needs
per-signal calibration.**

**(f) D11 side note — daily aggregation should be median, but the run ships mean.**
For skewed/ordinal wearable signals the **median** is the more robust daily aggregator: skew and
outliers pull the mean toward the tail, and the median is the correct central-tendency measure for
ordinal data (Rousselet & Wilcox; Laerd-mirror) [rousselet-wilcox, laerd-central]. D11 (U6) instead
aggregates the signals branch to a daily **mean** (UTC bucket), explicitly deferring per-metric
aggregation "when a real high-frequency signal lands." This is a **latent inconsistency worth
flagging**: the S4 detector is built on robust median/MAD statistics, but its *input* daily value is
formed by a non-robust mean — a single intraday spike can move the very value S4 then judges against a
robust baseline. **Caveat on the fix:** the sample median is upward-biased in *small* within-day
samples (overestimates for right-skew, worsening as n↓) [rousselet-wilcox], so "use median" is right in
principle but the aggregator choice should itself be revisited per-signal once real high-frequency data
lands — consistent with D11's own deferral. Not a defect in D11 as scoped (no high-frequency signal
exists yet), but the mean→robust-detector seam should be closed before one does.

**Verdicts.**
- **C3 median+MAD / 0.6745 / |M|>3.5: keep — literature-supported.** Correct the record that 3.5 is a
  convention, not a simulation-calibrated FP-match. Ensure the zero-MAD degeneracy fallback is actually
  implemented and tested (Open-Q 9) — it is the sharp edge for ordinal data.
- **C3 deadbandK = 1.0: needs empirical calibration before trust**, and first **resolve the intent
  mismatch** — is this a ~1-in-3 daily 3-state nudge or an anomaly alert? A ~32% Gaussian fire rate
  (higher under heavy tails) is very likely too hot for "anomaly." Calibrate `k` to a target fire rate
  on real n=1 traces (ADR-0002 Open-Q 2 sweep 0.75–1.5 is the right plan, but may need k>1.5).
- **C3 28-day window: keep as convention;** validate against 7/14/21-day alternatives per signal when
  data accrues.
- **C3 baselineMinDays = 14 / D12a: keep provisionally, uncited;** needs per-signal stability
  calibration. D12a's clean-day reading is a sound conservative judgment call within that.
- **D5 deadbandK (robust units) over deadbandSigma (mean/SD): keep — the robust-units choice is the
  defensible one** per (a)/(b); the *value* on that axis is the open question, not the axis.
- **D11 daily mean: flag — prefer median for robust consistency, but revisit per-signal at high-frequency
  onset;** as currently scoped (no high-frequency signal) it is not yet a live defect.

**Citations:** [iglewicz-hoaglin-1993] [nist-outliers] [metricgate-mz] [statology-mz] [sd-calc-mz]
[rousseeuw-croux-1993] [spc-3sigma] [quer-2020] [stanford-rhrdiff] [rousselet-wilcox] [laerd-central]

### RU4 · C4 + D12b + D14a — n=1 evaluator gates (Spearman |ρ|≥0.3, BH q≤0.05, Pyper–Peterman N_eff≥10, 60d window, 3-window stability)

**Researched 2026-07-17** via the deep-research harness (5 angles, 25 claims verified 3-vote: 23
confirmed / 2 refuted). ADR-0002 §S5 is the ground-truth source and is already densely cited; RU4
tested whether the S5 gate holds for the n=1 regime and resolved several of ADR-0002's own open
questions. This is the run's central inferential machinery, so the verdicts here matter most.

**Restatement.** Per ADR-0002 §S5 / config C4: a metric-pair is surfaced iff **all** of `q ≤ 0.05`
(BH-FDR across all tested pairs) ∧ `N_eff ≥ 10` (Pyper–Peterman modified-Chelton) ∧ `|ρ| ≥ 0.3`
(Spearman) ∧ `sign(ρ)` stable across 3 fixed deterministic windows, over a 60-day joint series.
**D12b** = the interim pair scope: all active baselineApplicable pairs (105 = C(15,2)) with ≥14
in-window and ≥10 joint days, BH applied **once per user per run**. **D14a** = the U12 serve branch
treats a personal signal failing this gate (`q≤0.05 ∧ N_eff≥10 ∧ stable`) as *absent* — i.e. it reuses
C4's gate at serve time, so it inherits C4's verdicts wholesale.

**(a) Spearman base statistic — literature-supported (textbook consensus).**
Spearman is Pearson on ranks: monotonic-invariant, distribution-free, outlier-robust, needs no
linearity or bivariate normality — exactly the assumptions ordinal/skewed/non-linear self-tracking data
violate (Siegel & Castellan; Conover; NIST) [spearman-town, surveymonkey-corr]. Two counter-claims were
**refuted**: that Pearson is strictly *disqualified* (Spearman is preferred, not Pearson forbidden),
and that Kendall's τ should *replace* Spearman for small n (τ is a fine alternative under many ties but
doesn't undermine Spearman). Aligns with the ADR's 1-hop monotonic-only invariant. **Keep.**

**(b) |ρ| ≥ 0.3 — defensible screen, but MISLABELED "medium"; origin arbitrary.**
The most important correction in RU4. Cohen (1988) does define r=.30 as "medium," but Cohen himself
called the cutoffs arbitrary and a "last resort." Empirically .30 is *far above* medium: across 147,328
applied-psychology correlations the median |r| is .16 and Cohen's small/medium/large map to the
33rd/73rd/90th percentiles — only ~27% of published correlations exceed .30 [bosco-2015]; 708
meta-analytic correlations give 25/50/75th percentiles of .11/.19/.29, and the authors recommend
relabeling .10/.20/.30 as "relatively small/typical/relatively large" [gignac-szodorai-2016]. So
`|ρ|≥0.3` retains roughly the **top quartile** of effects — a *stringent* screen, not a lax floor.
**Critical transfer-gap caveat:** every one of these benchmarks is **between-subjects, cross-sectional**
published data — *not* within-person n=1 autocorrelated series. No cited source establishes percentile
benchmarks for within-person daily-tracking correlations, so "top quartile" is directionally
informative, not calibrated to this data. **Value defensibility: reasonable convention (conservative),
but the "medium" label in ADR-0002/C4 should be corrected to "conservative / relatively-large," and the
value needs within-person calibration.**

**(c) BH-FDR q ≤ 0.05 — right family of method; the PRDS assumption is NOT guaranteed here.**
BH is the correct multiplicity philosophy for a discovery/screening task (control expected *proportion*
of false discoveries) and rightly preferred over Bonferroni/Holm, which would be far too conservative
for n=1 screening — ADR-0002's reasoning is sound. But ADR-0002 explicitly *assumes* the shared-metric
positive dependence satisfies PRDS (its Open-Q 5). RU4 finds that assumption is **not safe**: PRDS/
total-positivity proofs that establish BH control for *one-sided* Gaussian statistics do **not** transfer
to *two-sided* tests (tail-folding breaks the monotone-regression argument), and BH can fail to control
FDR under correlated two-sided statistics [dobriban-2026]. **Weight this carefully:** [dobriban-2026]
is a 2026 non-peer-reviewed preprint, concerns Gaussian (not Spearman) statistics, with AI-assisted
derivations and *numerically tiny* demonstrated violations — so it is **caution, not proof of failure**
for this detector. Net: BH remains a pragmatic, defensible choice; the honest statement is that FDR
control is *not assured* in this exact two-sided/shared-metric regime, and Benjamini–Yekutieli (already
ADR-0002's reserved fallback) would *guarantee* control under arbitrary dependence at a log-factor power
cost. **Value defensibility: reasonable convention; the PRDS premise is uncalibrated and should not be
asserted as holding.** (The q=0.05 level itself is convention, loosenable to 0.10 per ADR-0002 Open-Q 5.)

**(d) Pyper–Peterman N_eff correction — sound in principle, biased in exactly the regime it's used.**
The df-adjustment is a legitimate, Monte-Carlo-validated remedy for autocorrelation-inflated correlation
inference (P&P kept Type-I error near nominal) [pyper-peterman-1998, afyouni-2019]. **But two caveats
land directly on this detector:** (1) the Pyper–Peterman/Bartlett family depends only on *each series'
own* autocorrelation (Σ ρ_XX·ρ_YY) and is "substantially biased by non-zero cross-correlation" — yet the
detector *selects pairs because they co-move*, i.e. the exact non-zero-cross-correlation failure regime;
the cross-correlation-aware **xDF** estimator (Afyouni–Smith–Nichols 2019 — already ADR-0002's Open-Q 8
candidate) is the principled fix [afyouni-2019]. (2) P&P themselves note Chelton-family N_eff for *short*
series is "consistently smaller and much more variable" — bearing directly on n=60 / N_eff≥10. The
validation used Pearson on AR(1), not Spearman on ordinal short series. `N_eff ≥ 10` is a reasonable
rule-of-thumb floor, not a derived constant. **Value defensibility: method literature-supported; N_eff≥10
uncited convention; the co-moving-pair bias is a real methodological gap — prioritize the xDF swap.**
*(ADR-0002 Open-Q 1 — verifying the P&P denominator constant `1+2Σ` vs `1+4Σ/N` and the N/5 lag
truncation against the primary PDF — was NOT resolved by this run and remains blocking for S5 correctness.)*

**(e) 3-window sign-stability — a weak, uncalibrated stand-in for cross-validation.**
ADR-0002 already flags this as an engineering heuristic "not a literature constant." RU4 confirms and
sharpens: it lacks the resampling and derived error bound that give *stability selection* its
false-discovery guarantee (Meinshausen–Bühlmann 2010: many random subsamples + an E(V) bound)
[meinshausen-buhlmann-2010], and for autocorrelated series the recommended validation is **blocked CV**
(preserves temporal contiguity; beats AIC/BIC), not fixed windows or k-fold [liu-zhou-2023]. It may still
add value as a cheap robustness filter, but **must not be presented as cross-validation or as conferring
any FDR/generalization guarantee.** **Value defensibility: arbitrary heuristic — keep only as a cheap
filter; consider a blocked-CV or subsampling-based stability score to earn an actual guarantee.**

**(f) D12b 105-pair scope & BH-once-per-run — the correct multiplicity unit.**
Applying BH **once per user per run across all 105 pairs** is the *right* family definition: the family is
the set of simultaneous tests whose false-discovery proportion you want controlled. This is a sound call,
not a gap (the C(15,2)=105 enumeration is just the full active pair set). The interim ≥14-in-window /
≥10-joint-day inclusion rule is a pragmatic data-sufficiency screen; brain-neighbour pruning replaces the
full-enumeration scope in U12 (which will *also* shrink the multiplicity burden — a side benefit worth
noting). **No change implied beyond the C4-threshold verdicts.**

**(g) D14a serve-gate reuse — inherits C4 verdicts; the "absent" treatment is a reasonable default.**
Treating a personal signal that fails `q≤0.05 ∧ N_eff≥10 ∧ stable` as *absent* at serve time is a clean,
conservative composition (no half-served signals) and introduces no *new* empirical claim — it reuses the
S5 gate verbatim, so every caveat in (b)–(e) flows through to serve. **No independent verdict; carries
C4's.**

**Verdicts.**
- **Spearman: keep — literature-supported.**
- **|ρ| ≥ 0.3: keep as a conservative screen, but correct the "medium" label** (it's ~top-quartile /
  "relatively large") and calibrate against *within-person* daily-tracking correlations, which no source
  yet benchmarks.
- **BH q ≤ 0.05: keep — pragmatic and defensible;** stop asserting PRDS holds — treat FDR control as
  *not assured* for two-sided shared-metric tests; keep BY as the ready fallback (ADR-0002 Open-Q 5).
- **Pyper–Peterman N_eff ≥ 10: keep the method, flag the bias;** the correction is biased precisely for
  co-moving pairs — **prioritize the xDF swap (Open-Q 8)**; N_eff≥10 is an uncited floor; and **resolve
  the still-open P&P formula-constant verification (Open-Q 1) — it remains blocking for correctness.**
- **3-window stability: keep only as a cheap filter, not as CV;** never claim it confers a guarantee;
  consider blocked-CV / subsampling stability at n=60.
- **D12b BH-once-per-run over 105 pairs: keep — correct multiplicity unit.**
- **D14a serve reuse: keep — inherits C4; sound conservative default.**

**Citations:** [spearman-town] [surveymonkey-corr] [bosco-2015] [gignac-szodorai-2016] [dobriban-2026]
[pyper-peterman-1998] [afyouni-2019] [meinshausen-buhlmann-2010] [liu-zhou-2023]

### RU5 · C5 — S3 baseline confidence cutoffs 3 / 5 / 14 days (low/med/high; deployed uses 3/**7**/14)

**Researched 2026-07-17** via the deep-research harness. **Partial run:** the workflow hit the session
limit mid-verification, so synthesis was skipped and 13 of 25 claims went unverified *for lack of
budget, not because they were refuted* (0 refuted). **12 claims survived a full 3-vote (or 2-vote)
pass** — enough to judge C5, since the confirmed set squarely covers the day-count question. Verdicts
below rest only on confirmed claims; unverified items are noted as leads, not evidence.

**Restatement.** S3 labels a personal baseline's *confidence* by how many days of the user's own data
underpin it: **low ≥3 days, medium ≥5, high ≥14**. The config doc (C5) notes the deployed code uses
**3/7/14** and U6 *changes the medium tier from 7 down to 5*, and candidly admits "no basis either way;
the doc value wins until calibration." RU5 tested whether the day-counts have any empirical grounding.

**(a) The ~3-day LOW floor — literature-supported for central-tendency metrics.**
Multiple independent primary sources land on ~3 days as the minimum for *acceptable* reliability of
simple mean/central-tendency estimates: generalizability theory on salivary cortisol puts mean cortisol
at a 3-day minimum (and within-person change detection at ≥3 days) [ross-2014]; pedometer step count
needs a minimum of 3 days for ICC 0.80, with "any 3 days" sufficient and a single day not acceptable
[kang-2004]; accelerometer MVPA needs 3–4 days for 80% reliability [trost-2002]. **So a 3-day floor for
a *low-confidence* label is genuinely defensible** — arguably the best-grounded cutoff in C5.

**(b) The medium tier — and the 5-vs-7 switch is the crux: the literature leans toward 7, not 5.**
This is RU5's key finding. The run is *lowering* the medium cutoff from 7 to 5, but the confirmed
evidence points the other way: a 7-day protocol is the *overall recommendation* for acceptable
reliability across energy expenditure, activity intensities, and sleep [ridgers-2016]; sleep outcomes
need 6–7 nights for ICC 0.7 [ridgers-2016]; sedentary/inactivity needs ≥7 days [trost-2002]; and
day-count requirements are strongly *metric-dependent* — more variable/derived metrics (e.g. cortisol
slope) need 5–10 days [ross-2014]. Nothing in the confirmed set singles out **5** as a threshold;
several sources put the "medium/acceptable" band at **6–7**. **So the 5-vs-7 distinction is not merely
"no basis either way" — the deployed value 7 is *better* supported than the 5 that U6 adopts.** Choosing
5 moves to *less* data for the same "medium" label with no citation behind it.

**(c) The ~14-day HIGH cutoff — reasonable conservative convention, uncited.**
No confirmed claim directly validates 14 days as a *high*-confidence threshold. But it is a sensible
conservative ceiling: it sits comfortably above the ~10-day requirement for the most variable metrics
studied [ross-2014] and matches the 14-day baseline window family used elsewhere in the run (ADR-0002
`baselineMinDays`, RU3). A 14-day EMA-baseline claim was among the *unverified* (limit-errored) leads,
so it's a candidate corroboration, not evidence. **Value defensibility: reasonable convention.**

**(d) Cross-cutting caveats.** All the confirmed day-counts come from **group/between-person reliability
(ICC, generalizability theory)**, not strictly within-person n=1 confidence — the same transfer gap
flagged in RU3/RU4. They are also **metric-specific** (cortisol, steps, sleep, activity), so a *single*
3/5/14 ladder applied to every metric is a simplification: the honest reading of the literature is that
the right cutoff depends on the metric's within-person variability. And "days needed for reliability"
is not identical to "days needed before we *label* a baseline low/med/high," though they are close
enough that the reliability literature is the right yardstick.

**Verdicts.**
- **3-day LOW floor: keep — literature-supported** (best-grounded cutoff in C5) for central-tendency
  metrics; still worth per-metric calibration for high-variability signals.
- **Medium cutoff: reconsider the 7→5 change.** The run's own "no basis either way" understates it —
  the confirmed evidence mildly *favors 7* (6–7 nights / 7-day protocols recur; nothing supports 5).
  Recommend **keeping the deployed 7**, or better, making the medium cutoff **metric-dependent** rather
  than a single global number. At minimum, don't treat 5 as equivalent to 7 — it is the weaker choice.
- **14-day HIGH cutoff: keep — reasonable conservative convention;** validate per-metric when data
  accrues.
- **Overall: the single global 3/5/14 ladder is a defensible provisional scaffold but should become
  per-metric;** its weakest specific choice is the 5-day medium tier.

**Citations:** [ross-2014] [kang-2004] [trost-2002] [ridgers-2016] [heijden-hrv-2012]
*(partial run — 12/25 claims verified; 13 unverified due to session-limit budget exhaustion, 0 refuted)*

### RU6 · C8 — venue `impactTier` bands (SJR Q1/Q2 OR OpenAlex h-index ≥100/≥50; preprint class; JIF rejected)

**Researched 2026-07-18** via the deep-research harness (6 angles, 28 sources fetched, 114 claims
extracted, **25 adversarially verified 3-vote: 25 confirmed / 0 refuted**). Two sub-topics fell below
the 25-claim verify budget and are **quote-extracted from primary sources but not 3-vote verified**
(handled as in RU2's §d): the preprint-concordance evidence (§h) and the composite-indicator critique
(§f) — flagged inline. The prior RU6 runs (`wf_4498a4cc-973`) failed twice on a transient platform
issue and wrote nothing; this is the clean re-run (`wf_08dfe058-deb`). Shipped values verified against
ADR-0003 §5 and `tools/brain-ingest/src/venue/banding.ts` before writing verdicts.

**Restatement.** Shipped code (`banding.ts:67-74`, `IMPACT_BANDS_C8`): `high` = SJR **Q1** OR OpenAlex
venue h-index **≥ 100**; `moderate` = SJR **Q2** OR h-index **≥ 50**; `low` = any other *resolvable*
venue; `preprint` = unreviewed servers (OpenAlex source `type: repository` OR name matches
`rxiv/ssrn/research square/preprint/osf preprints`). An **unresolvable** venue is a typed `unknown`
outcome, never silently `low`. SJR has no in-repo dataset, so the quartile is an optional caller input
and the OpenAlex h-index path is the functional default. Journal Impact Factor (JIF/JCR) was
**deliberately rejected** (paid; IF-vs-quality empirically weak per ADR-0003). Crucially, `impactTier`
is a **notability axis only** — ADR-0003 excludes it from `edgeScore`/reliability *and* from the UX
applicability axis; it feeds ranking/discovery alone. Run's rationale: provisional, explicitly
uncalibrated, "flag any surprises."

**(a) Preferring SJR over JIF — defensible and well-grounded.**
SJR is a Scopus-based, **prestige-weighted eigenvector** metric (PageRank-like: citations are weighted
by the citing source's own prestige, "all citations are not created equal") with field normalization —
a genuine methodological improvement over JIF's raw citations-per-citable-item arithmetic mean
[gonzalez-pereira-2010, scimago-help]. It is not a cosmetic swap: journal indicators (JIF, h, SJR,
SNIP, Eigenfactor) *appear* correlated yet produce materially different venue rankings, so the choice
of indicator changes which venues land top-tier [mingers-yang-2017]. For a notability/discovery-only
signal, choosing the prestige-weighted, field-normalized, harder-to-game metric over JIF is the
**better-supported choice**. **Value defensibility: supported by literature (as a notability metric).**

**(b) SJR quartiles as bands — sound, standard method; but boundary instability is an unaddressed risk.**
Banding by SJR quartile is the **metric provider's own documented method**: SCImago ranks journals
within a Scopus subject category by SJR and splits them into four equal groups, Q1 = top 25%
[scimago-help]. So the design's Q1→`high` / Q2→`moderate` mapping is aligned with standard practice.
**Gap flagged honestly:** none of the surviving claims addressed the sub-question's specific concerns —
quartile-boundary instability near the Q1/Q2 cutoff, field-size effects, or year-to-year churn — so
these remain **uncharacterized open risks**. A venue oscillating across the Q1/Q2 line will flip
`high`↔`moderate` year to year; the design has no hysteresis or multi-year averaging to dampen it.
**Value defensibility: reasonable convention (standard), boundary-stability uncalibrated.**

**(c) Venue/journal h-index — a valid notability measure, with documented flaws that bias toward big/old venues.**
The journal h-index is canonical: Braun, Glänzel & Schubert (2006) transplanted Hirsch's author index
to journals and explicitly proposed it as "a robust alternative indicator advantageously *supplementing*
journal impact factors" — i.e. its own originators framed it as an **impact/notability** measure, never
a reliability one [braun-2006]. This *supports* the run's notability/trust separation. But the flaws are
well-documented and land on this design: (i) Schubert & Glänzel (2007) show journal h is a near-
deterministic function of publication count and average citation rate (h ≈ c·n^(2/3)·m^(1/3)), so it
**conflates venue size/volume with citation intensity** — large, old, high-volume venues score high
regardless of per-paper quality [schubert-glanzel-2007]; (ii) it is **field-incomparable** without
normalization (citation base rates differ several-fold across fields); (iii) among six h-type indices
it has the **weakest discriminatory power**, and all are "more susceptible to the number of publications
than to the frequency of citations" [bihari-2020]; Mingers & Yang likewise note h "includes the
productivity of a journal" [mingers-yang-2017]. For n=1 notability ranking these biases toward
large/old/high-volume venues are **tolerable for discovery, not for a quality judgment** — which is
exactly the axis separation ADR-0003 enforces. **Value defensibility: valid notability metric with
known size/field biases.**

**(d) The specific cutoffs h-index ≥ 100 (high) / ≥ 50 (moderate) — NO literature grounding; arbitrary.**
The single most actionable RU6 finding. Across all surviving claims and underlying sources there is
**no literature establishing 100 or 50 (or any global integer) as a meaningful venue-h-index
threshold.** Worse, it is *unjustifiable by construction*: because journal h is field- and size-
dependent and explicitly **not cross-field comparable** [schubert-glanzel-2007, bihari-2020], a single
global integer cutoff necessarily mis-ranks across fields — a Q1-equivalent mathematics or CS venue can
have a far lower h than a mid-tier biomedical journal, so `≥100` systematically over-promotes
high-citation-base fields (biomed, life sciences) and under-promotes math/CS/humanities. Stated plainly
per the ground rules: **100/50 are engineering judgment, uncited** — they should be documented as such
(the config already marks them provisional/uncalibrated, which is the honest framing) or replaced with a
**field-normalized or percentile rule** (or a field-normalized indicator like SNIP / Journal Citation
Indicator, which Mingers & Yang rate well for cross-field comparability [mingers-yang-2017]). **Value
defensibility: arbitrary — needs field-normalization or a percentile basis.**

**(e) OpenAlex as the h-index data source — viable and broad, but noisier than SJR, and it "runs hot."**
OpenAlex is a defensible source: on a shared 16.8M-record 2015–2022 corpus its internal reference
coverage (83.2–83.6%) sits *between* Web of Science (81.6%) and Scopus (87.6%) [culbert-2025]; it indexes
far more venues than either (e.g. 3,862 vs 638 vs 190 nursing journals) spanning journals **and**
repositories (~124k venues in 2022, now ~260k sources — useful for the `preprint` detection)
[mezquita-2025, openalex-wp-2022]. **Two real cautions:** (1) OpenAlex's own creators and independent
scientometricians "recommend caution when utilising OpenAlex for scientometric studies due to the
volatility and data quality issues," and a 2025 analysis reports a large share of records with **zero
references** (undercounting incoming citations, biasing a venue h-index *downward* for under-covered
venues) [culbert-2025, openalex-limits-2025] *(the zero-references claim verified 2-1, not 3-0 — treat
as directional)*; (2) OpenAlex captures **higher** average citation counts than Scopus/WoS (e.g. 23.2 vs
19.9 vs 17.7 mean) [mezquita-2025], so an **OpenAlex-derived h-index runs hotter than the Scopus-derived
SJR** it is OR'd against. For n=1 discovery this is acceptable, but the h-index leg is the noisier of the
two. **Value defensibility: viable source, explicitly flagged volatile by its own maintainers.**

**(f) The OR-combination (SJR quartile OR OpenAlex h-index) — the design's weakest methodological seam.**
This mixes **non-commensurable metrics computed on non-commensurable databases**: a prestige-weighted,
field-normalized quartile (Scopus) OR a raw, size-driven, field-*un*normalized integer count (OpenAlex).
No fetched source directly evaluates *this exact* combination, so the verdict is **inferential**, but two
established facts make the seam real: the two metric families produce materially different rankings
[mingers-yang-2017], and the OpenAlex h leg runs hotter (§e) [mezquita-2025] — so the OR is **asymmetric**:
the h-index leg will promote venues the SJR leg would not, using a different and broader database, and
because it is OR (not AND) the *more permissive* leg always wins. The general scientometric caution
against mechanically combining distinct indicators into one banding rule without validation is on record
[composite-indicator-2024, leiden-manifesto-2015] *(quote-extracted, not 3-vote verified)*. Because
`impactTier` feeds **discovery/ranking only, never trust**, the failure mode is bounded — occasionally
over-ranking large/high-volume venues — an acceptable, **recall-favoring** choice for n=1, but it should
be documented as a deliberate design tradeoff, not presented as metrically principled. **Value
defensibility: pragmatic recall-favoring heuristic; not metrically principled — document as such.**

**(g) Rejecting JIF & keeping notability strictly separate from trust — the empirically strongest choice in C8.**
The literature *directly validates* the run's core architectural decision. Journal citation
distributions are **highly skewed**, so the mean-based JIF is unrepresentative of the typical article and
a weak predictor of any individual paper's impact: "the average citation impact of a journal is only a
weak predictor of the citation impact of individual publications" [zhang-rousseau-sivertsen-2017,
seglen-1997]; citations per paper within a journal span **2–3 orders of magnitude** with heavy
inter-journal overlap, and the citation performance of individual papers "cannot be inferred from the
JIF" [lariviere-2016]. JIF was created as a **librarian's purchasing tool**, not a quality measure, and
DORA's foremost recommendation is explicit: "Do not use journal-based metrics, such as Journal Impact
Factors, as a surrogate measure of the quality of individual research articles" [dora-2013]. Journal rank
is if anything *perversely* related to reliability — retraction index correlates **positively** with JIF
(Fang & Casadevall, P<0.0001) and journal rank tracks retraction rate (R²≈0.77) [fang-casadevall-2011,
brembs-2013] *(these two quote-extracted here; the same journal-rank↔retraction facts were 3-vote
confirmed in RU2)*. So both **rejecting JIF as a banding input** AND **excluding `impactTier` from the
reliability/applicability axes** are squarely supported. **Value defensibility: supported by literature —
the strongest choice in C8.**

**(h) Preprint tier — treating unreviewed servers as a distinct class is justified; concordance is high** *(quote-extracted, not 3-vote verified)*.
Classifying arXiv/bioRxiv/medRxiv/SSRN as a separate `preprint` band is defensible as a *provenance/
review-status* signal (not a quality verdict). The peer-review-vs-preprint quality gap is **real but
small**: peer-reviewed biomedical articles score ~1 reporting item higher (out of ~26) than their
preprints [carneiro-2020], and preprint→publication **concordance is high** — across 72,644 DOI-matched
bioRxiv pairs (2018–2025) the primary claim was unchanged in 39.9% and only minorly revised in 50.0%
(~90% substantively concordant) [biorxiv-concordance-2026]; 93% of non-COVID life-sciences preprints'
main conclusions did not change to publication [brierley-2022]; medRxiv study interpretations were
concordant with the published version in 98% (45/46) of clinical pairs [medrxiv-concordance-2021]. **The
correct reading for this design:** a distinct `preprint` band is justified as an honest "not yet
peer-reviewed" *provenance* flag, but the evidence does **not** support treating preprints as
substantially *less reliable* content — which is consistent with the run's decision to keep `impactTier`
(preprint included) **out of the reliability axis** entirely. The one real design caveat is *detection*,
not the tier: relying on OpenAlex `type: repository` + name heuristics will mis-slot preprints hosted on
journal-typed sources or catch repository-hosted reviewed content. **Value defensibility: the tier is
justified as provenance; empirically preprints are near-concordant, so the notability/trust separation
is again vindicated.**

**Verdicts.**
- **SJR over JIF: keep — supported by literature.** Prestige-weighted, field-normalized, harder to game;
  the right notability metric of the two.
- **SJR Q1/Q2 bands: keep — standard method;** but **characterize boundary stability** (Q1/Q2 churn,
  field-size effects) and consider hysteresis / multi-year averaging before trusting year-to-year bands.
- **Venue h-index as a notability input: keep — valid but size/field-biased;** never let it leak toward
  a quality/trust judgment (ADR-0003 already forbids this).
- **h-index cutoffs 100 / 50: needs recalibration — arbitrary, uncited, and unjustifiable as a global
  integer** given field-incomparability. Replace with a **field-normalized or percentile** rule (or a
  field-normalized indicator such as SNIP/JCI), or document explicitly as an uncalibrated engineering
  default. This is C8's weakest specific choice.
- **OpenAlex as source: keep — viable and broad;** note the maintainers' own volatility caution and that
  the OpenAlex h-index **runs hotter** than the Scopus SJR it is combined with.
- **OR-combination of SJR quartile ∨ h-index: keep only as a deliberate recall-favoring heuristic**, not
  as a principled metric; document the asymmetry (the hotter, field-unnormalized h leg wins under OR).
  Bounded-risk because notability never feeds trust.
- **Reject JIF / notability⊥trust separation: keep — the strongest, best-supported decision in C8.**
- **Preprint tier: keep — justified as a provenance flag;** the concordance evidence confirms it should
  stay out of the reliability axis (as it does). Watch the *detection* heuristic, not the tier itself.

**Citations:** [gonzalez-pereira-2010] [scimago-help] [mingers-yang-2017] [braun-2006]
[schubert-glanzel-2007] [bihari-2020] [culbert-2025] [mezquita-2025] [openalex-wp-2022]
[openalex-limits-2025] [zhang-rousseau-sivertsen-2017] [seglen-1997] [lariviere-2016] [dora-2013]
[fang-casadevall-2011] [brembs-2013] [composite-indicator-2024] [leiden-manifesto-2015] [carneiro-2020]
[biorxiv-concordance-2026] [brierley-2022] [medrxiv-concordance-2021]

### RU7 · C10 — correlation lag windows {0, 1, 3, 7} days over brain-neighbour pairs

**Researched 2026-07-18** via the deep-research harness (6 angles, 23 sources fetched, 93 claims
extracted, **25 adversarially verified 3-vote: 19 confirmed / 6 refuted**). The high refutation count
is a quality signal — several attractive-but-wrong specifics were killed (see below) and are *not*
asserted here. Shipped values verified against code before writing verdicts.

**Restatement.** Shipped code: `ALLOWED_LAG_DAYS = new Set([1, 3, 7])` with lag 0 encoded as
`lagDays: null` (the blueprint schema forbids literal 0), giving the effective C10 set **{0, 1, 3, 7}**
(`supabase/functions/generate-insights/evaluators.ts:79`, `index.ts:319-320`). Coincidence rules are
**brain-neighbour scoped** — evaluated only when a servable 1-hop knowledge-graph edge connects the
pair (`index.ts:509`; the gate lives in the composer join, not the evaluator), with directional lag
semantics (`both[1]` trails `both[0]` by `lagDays`). Run's rationale (C10): a continuous lag scan is
infeasible on sparse n=1 daily data; a `{0,1}`-only set would miss gut-transit and environmental-
exposure delays, the product's headline pairings. Provisional.

**(a) Gut-transit delay (1–3 days) — physiologically supported; {1,3} bracket it.**
Whole-gut transit in healthy adults has a **median ~28h (~1.2d)** with a wide IQR of 4–50h (MRI
marker-capsule study, n=21) [whole-gut-mri-2015]; in adults with functional-GI symptoms baseline
whole-gut transit was **43–60h (~1.8–2.5d)** [waller-2011]. So a diet→gut-outcome delay is a
**multi-day, not same-day** process sitting firmly in the ~1–3 day band, which lags {1,3} bracket. The
omitted lag 2 costs resolution but the ~1-day-wide between-subject IQR already smears the true delay,
so the band is not *missed*. **This establishes physiological *plausibility* of the 1–3 day window, not
that {1,3} optimally samples it.** *(A refuted claim of a ~3.75h orocecal-transit median was killed
1-2 and is not used — orocecal ≠ whole-gut, and it would have argued for a same-day lag the whole-gut
evidence contradicts.)* **Value defensibility: physiologically plausible; not empirically calibrated.**

**(b) Environmental-exposure delay (0–7 days) — DLNM-standard window; {0,1,3,7} samples it, but a 7-day cap truncates slow exposures.**
Distributed-lag non-linear models (DLNM) are the standard environmental-epidemiology tool for
sub-weekly exposure→outcome delays. A PM2.5→ICU-pneumonia DLNM **capped lag at 7 days**, effect null
at day 0 (RR 1.06), peaking ~day 3 (RR 1.40), back to baseline by day 6 [pm25-dlnm-2017]; a pollen
study fit distributed-lag models over 24–96h (1–4d) lags [pollen-epochal-2024]; heat-mortality effects
are acute (~lag 0–5) [temp-mortality-2012]. So 0–7 days is a well-established short-exposure window and
{0,1,3,7} samples it reasonably. **Two caveats:** (i) **cold-mortality effects persist ~12 days**
[temp-mortality-2012], so the 7-day maximum *truncates* cold and any similarly slow exposure — the grid
is scoped to fast exposures; (ii) the PM2.5 day-3 peak was partly an *admission* delay, not a pure
exposure→symptom lag, so the exact peak location does not transfer to n=1 symptom tracking. *(Refuted
and excluded: the specific "plateau at 3–4d, null by 6–7d" curve shape [1-2], and a strict pollen
"≤60h / 0–4d only" bound [0-3] — the pollen upper bound is genuinely uncertain, so I do not claim 7d is
outside it.)* **Value defensibility: window span supported by literature; the 7-day cap is a
fast-exposure design choice, not a universal.**

**(c) Other headline pairings — exercise→soreness (1–2d) covered; the HRV-recovery lag is NOT established; alcohol/sleep/caffeine unsourced here.**
DOMS onsets ~8h post-exercise, **peaks 1–2 days, resolves within 7 days** [doms-review-2024], and
velocity-loss resistance training produced soreness significant at 24h persisting to 48h
[resistance-doms-2025] — so exercise→soreness sits at lag 1 (edging into the skipped lag 2), with lag 3
catching the tail; {0,1,3,7} covers it. **Important honesty flag:** the intuitive **exercise→HRV-
recovery ~1-day lag was REFUTED (1-2)** and is *not* asserted — the HRV-recovery lag is uncharacterized
here. Likewise the other listed pairings (alcohol→same-night sleep = lag 0, sleep-debt→next-day mood =
lag 1, caffeine→sleep) were **not independently sourced** in surviving claims, so their lag coverage is
*expected* but unverified in this run. **Value defensibility: DOMS pairing covered & supported; HRV /
sleep / alcohol pairings not verified.**

**(d) The dominant risk is statistical, not physiological — autocorrelation inflates false positives, and the ~60-day window is not large enough to be safe.**
The single most actionable RU7 finding, and it is *not* about the lag values. Rank cross-correlations
computed **directly on autocorrelated daily series** have severely inflated Type-I error: positive
within-series autocorrelation inflates the CCF test-statistic variance, so autocorrelation is mistaken
for genuine cross-metric dependence [dean-dunsmuir-2016]. Quantitatively, a bivariate VAR(1) with
AR(1)=0.8 and **no true cross-dependence produced ~31% false rejections at α=0.05** (n=50)
[autocorr-fp-2023] — and daily n=1 tracker metrics are exactly the autocorrelated series this
literature flags. The sample CCF only attains its ±2/√n null band when at least one series is white
noise (Bartlett's formula); otherwise the band is wrong [bartlett-ccf]. The defensible workflow is the
**Box–Jenkins remedy: establish stationarity, PREWHITEN each input (apply its inverse-ARIMA operator),
then read the CCF at the candidate lags** — never read raw CCF values. Critically, **even the corrected
rank-CCF test stays somewhat inflated at n≈40 under strong autocorrelation**, decaying only as n grows
— and C10 operates on ~60-day windows. So the lag *values* are fine; the exposure is entirely in
**whether the pipeline whitens/stationarizes before correlating** (the current implementation's
prewhitening step is not something this review can confirm — see Open-Q). This mirrors and reinforces
RU4's Pyper–Peterman N_eff finding (autocorrelation correction is load-bearing for this detector).
**Value defensibility: the lag grid is not the risk — uncorrected autocorrelation is, and it is a
likely-live defect unless the series are prewhitened.**

**(e) Lag-scan multiplicity — the 4 lags should be ONE hypothesis, not four FDR entries.**
Testing 4 lags per pair multiplies the tests per metric-pair. The principled handling: a constrained
distributed-lag model can be tested as a **single unified hypothesis** (the whole lag function at once)
via a variance-component score test, rather than as separate per-lag tests [dlm-score-test-2018]. So
the lag scan should be **one test per metric-pair** (max-over-lags with an appropriate correction, or a
joint lag-function test), not 4 independent entries inflating the BH family from RU4. The
**brain-neighbour restriction already shrinks the hypothesis family** to curated edges, making this
confirmatory-ish rather than an unrestricted fishing expedition — a genuine mitigation. **Honest gap:**
a claim about the exact DLM degrees-of-freedom accounting (`L+1−p`) was **REFUTED (0-3)**, so the
precise df/correction mechanism for a *discrete* 4-lag grid is unresolved — only the general principle
(the lag function is one hypothesis) survives. **Value defensibility: principle supported; the exact
multiplicity accounting for the discrete grid needs to be pinned down (and reconciled with RU4's
BH-per-run family).**

**(f) The specific grid {0,1,3,7} and skipping 2/4/5/6 — no literature support; and lag-7 is confounded with weekly periodicity.**
No surviving claim provides any literature basis for the exact values {0,1,3,7} or for deliberately
skipping lags 2, 4–6. The grid is best described as a **roughly log-/dyadic-spaced engineering
heuristic that happens to bracket the physiologically supported windows** (gut 1–3d, short exposures
0–7d, DOMS 1–2d) — it should be presented as *physiologically plausible coverage*, **not empirically
calibrated**. Separately, the **7-day lag is materially confounded with weekly periodicity**: daily
human health/behaviour series carry strong day-of-week structure (e.g. GP consultations peak Monday,
fall through the week, negligible at weekends) [dayofweek-2017], so a raw lag-7 cross-correlation can
reflect **weekly calendar rhythm, not a physiological 7-day delay**. Disambiguation requires removing
day-of-week structure (as part of the same prewhitening/deseasonalizing step §d demands) before any
lag-7 signal is trusted. **Value defensibility: the grid is a reasonable uncalibrated heuristic; lag-7
specifically must be deseasonalized before it means anything.**

**Verdicts.**
- **{0,1,3,7} physiological coverage: keep — plausible, not calibrated.** The 0–7 day span is
  well-matched to the headline delay classes (gut 1–3d, short environmental exposures 0–7d, DOMS 1–2d).
  Label it "physiologically plausible," never "calibrated."
- **Consider adding lag 2:** both gut transit (median ~28h; functional-GI 43–60h) and DOMS (24–48h)
  peak *near the 1–3 day boundary*, and lag 2 sits in that physiologically dense zone the grid skips —
  the resolution loss is most likely to bite the two headline pairings. Low-cost to add.
- **7-day cap: keep for fast exposures, but document the truncation** — cold and similarly slow
  exposures (~12d) fall outside it; C10 is implicitly a *fast-exposure* grid.
- **Autocorrelation handling: the real priority — prewhiten/stationarize (and deseasonalize) before
  computing rank CCFs.** Without it, ~60-day n=1 series risk ~30%-order false positives; even corrected
  tests are not fully safe at n≈40–60. Gate reporting on a minimum window length / effect size. This is
  the single most important RU7 action, and it dovetails with RU4's N_eff correction.
- **Lag multiplicity: treat the 4 lags as one hypothesis per pair** (max-over-lags or joint lag-function
  test), not 4 BH entries; reconcile with RU4's BH-once-per-run family. Exact df accounting unresolved.
- **lag-7 signals: deseasonalize day-of-week before trusting them** — otherwise weekly rhythm
  masquerades as a physiological 7-day delay.
- **Brain-neighbour scoping: keep — a real mitigation.** Restricting lag tests to curated-edge pairs
  makes this confirmatory-ish and materially limits the multiplicity/spurious-correlation burden.

**Citations:** [whole-gut-mri-2015] [waller-2011] [pm25-dlnm-2017] [pollen-epochal-2024]
[temp-mortality-2012] [doms-review-2024] [resistance-doms-2025] [dean-dunsmuir-2016] [autocorr-fp-2023]
[bartlett-ccf] [dlm-score-test-2018] [dayofweek-2017]

## Executive summary

_Ranked: well-grounded → weakest / most in need of calibration or reconsideration._ Synthesis of
RU2–RU7 (C1, C2, C3, C4, C5, C8, C10 + the folded D-items). Record-only: this ranks the evidence, it
does not change any decision.

**One-line finding.** The Phase-2 run's *architectural* choices — what to exclude, which axis to
separate, which estimator family to use — are consistently well-grounded in the literature; its
*specific numbers* — every gate, weight, cutoff, and grid value — are almost all uncited engineering
judgment, which the run itself honestly labels "provisional-until-calibrated." The two genuinely
*systemic* risks are not any single number but (i) uncorrected **autocorrelation** in the n=1
inferential path and (ii) the **between-subjects → within-person transfer gap** underlying nearly
every borrowed threshold.

### Tier 1 — Well-grounded (keep; literature-supported)

1. **`impactTier` excluded from `edgeScore`/reliability + JIF rejected + notability⊥trust separation**
   (RU2d, RU6g). The single strongest decision cluster in the whole review — backed by a deep,
   convergent literature (Seglen; Larivière; Zhang–Rousseau–Sivertsen; Dougherty–Horne; DORA; and the
   *perverse* journal-rank↔retraction relationship). The run got the most consequential call right.
2. **Robust anomaly baseline: median + MAD, σ̂ = MAD/0.6745, |M|>3.5** (RU3a) — textbook
   Iglewicz–Hoaglin; and **preferring median/MAD over mean/SD** for outlier-prone n=1 data (RU3b),
   with **D5's robust-units `deadbandK`** the defensible axis choice.
3. **Spearman as the base statistic** (RU4a) — correct distribution-free/monotonic choice for
   ordinal, non-normal, non-linear self-tracking data; Pearson rightly rejected.
4. **SJR over JIF, and SJR-quartile banding** (RU6a,b) — prestige-weighted, field-normalized,
   harder-to-game; quartiles are the metric provider's own standard method.
5. **3-day LOW confidence floor** (RU5a) — the best-grounded cutoff in C5 (cortisol, steps, MVPA
   reliability literature all land near 3 days).
6. **BH-FDR as the multiplicity *philosophy*, BH-once-per-run over the 105-pair family, and
   brain-neighbour scoping of lag tests** (RU4c,f, RU7) — right family unit, right screening method,
   and a genuine spurious-correlation mitigation.
7. **Preprint tier as a provenance flag** (RU6h) and **the 0–7 day lag *span*** (RU7a,b,c) — both
   physiologically/scientometrically plausible coverage for the headline pairings.

### Tier 2 — Reasonable conventions (keep provisionally; uncited, calibrate when data allows)

- **Corroboration saturation at 3** (RU2e) — concept supported (independent replication raises
  reliability), count is convention; prefer soft √n/log saturation at calibration.
- **28-day rolling baseline window** (RU3d) and **14-day HIGH confidence cutoff** (RU5c) — sensible
  conventions, unvalidated against alternatives; should become per-metric.
- **OCEBM/GRADE tier-anchor direction** (RU2c) — keep the non-linear RCT/observational drop; stop
  short of implying OCEBM licenses numeric weights; don't enlarge the tier term.
- **q ≤ 0.05 level** (RU4c) and **OpenAlex as h-index source** (RU6e) — defensible, with caveats
  (BY fallback ready; OpenAlex maintainer-flagged volatile and "runs hotter" than SJR).

### Tier 3 — Weakest / needs reconsideration or calibration before trust

Ranked most-actionable first:

1. **Uncorrected autocorrelation in the lag-correlation path** (RU7d) — *the most serious specific
   defect surfaced*. Rank CCFs on autocorrelated ~60-day n=1 series can yield ~30%-order false
   positives; the series must be **prewhitened/stationarized (and day-of-week deseasonalized) before
   correlating**. Whether the pipeline does this is unconfirmed — treat as likely-live until verified.
2. **`deadbandK = 1.0`** (RU3c) — arbitrary *and* an intent mismatch: a ±1σ̂ band fires ~32% of days
   under Gaussian (more under heavy tails), which contradicts "anomaly" framing. Resolve the intent,
   then calibrate `k` to a target fire rate (likely k > 1.5).
3. **Pyper–Peterman N_eff correction** (RU4d) — biased *precisely* for co-moving pairs (the ones the
   detector selects); prioritize the **xDF swap**. And **the P&P formula-constant verification
   (ADR-0002 Open-Q1) remains unresolved and blocking for S5 correctness.**
4. **`|ρ| ≥ 0.3` mislabeled "medium"** (RU4b) — it is really ~top-quartile ("relatively large");
   correct the label and calibrate against *within-person* daily correlations (which no source yet
   benchmarks).
5. **C5 medium cutoff 7→5** (RU5b) — the run *lowers* a cutoff the literature mildly *raises* (6–7);
   nothing supports 5. Keep the deployed 7, or make it per-metric. The weakest choice in C5.
6. **Venue h-index cutoffs 100/50** (RU6d) — arbitrary, uncited, and unjustifiable as *global*
   integers given field-incomparability; use a field-normalized/percentile rule. Weakest in C8.
7. **The OR-combination SJR-quartile ∨ h-index** (RU6f) — non-commensurable metrics on
   non-commensurable databases; keep only as a documented recall-favoring heuristic.
8. **C1 gates 0.8/0.5 + C2 weights 0.60/0.25/0.15** (RU2a,b,f) — the composite-score *form* is
   literature-hostile (Jüni; Cochrane's move to domain-wise judgment), the weights are uncited, and
   gates on an uncalibrated score are semantically empty. Report components alongside the composite;
   calibrate against GRADE-rated exemplars.
9. **`baselineMinDays = 14`** (RU3e), **3-window sign-stability** (RU4e), **the exact {0,1,3,7} grid /
   skipping lag 2** (RU7e,f) — all uncited heuristics: keep as scaffolding, never present as
   validated; 3-window stability must not be called cross-validation; consider adding lag 2 (gut and
   DOMS both peak near the 1–3 day boundary); deseasonalize before trusting lag-7.

### Cross-cutting themes (the real story)

- **Autocorrelation is the deepest systemic issue.** It surfaces independently in RU4 (Pyper–Peterman
  biased for co-moving pairs) and RU7 (uncorrected CCF false positives) — the same failure mode from
  two directions. Getting the effective-N/prewhitening right matters more than any threshold value.
- **The transfer gap is pervasive and under-acknowledged.** RU3, RU4, and RU5 all rest on
  **between-subjects / group-reliability** evidence (ICC, generalizability theory, published-effect
  percentiles), not within-person n=1. Every borrowed cutoff is directionally informative but not
  calibrated to the actual data regime. This is the honest ceiling on all "supported" verdicts.
- **Architecture right, magic numbers unproven.** The exclusions and axis-separations are principled
  and cited; the specific gates/weights/day-counts/cutoffs/grids are engineering judgment. The run's
  own "provisional-until-calibrated" framing is accurate — the review's job was to say *which* numbers
  the literature actually backs (few) versus merely tolerates (most).
- **A recurring fix template:** replace global constants with **per-metric / percentile /
  field-normalized** rules, and **calibrate against real data** (GRADE exemplars for edges; per-user
  false-fire rates for anomalies; within-person correlations for the evaluator). This is exactly the
  calibration backlog the ADRs already name — the review corroborates its priority, and sharpens the
  order.

### Most urgent, in priority order

1. **Verify the Pyper–Peterman formula-constant** (ADR-0002 Open-Q1) — *blocking for S5 correctness*.
2. **Confirm/append prewhitening + day-of-week deseasonalizing before lag CCFs** (RU7) — likely-live
   false-positive risk in the correlation engine.
3. **Resolve the `deadbandK` intent mismatch** (RU3) — a ~32% daily fire rate is almost certainly too
   hot for "anomaly."
4. **Correct the `|ρ|≥0.3` "medium" label** and the C5 **7→5** regression (RU4, RU5) — cheap doc/config
   fixes that stop over- or under-stating what the numbers mean.
5. **Prioritize the xDF swap** over Pyper–Peterman for the co-moving-pair regime (RU4).
