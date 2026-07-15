---
id: "0002"
title: Anomaly & Personal-Signal Definition
summary: Defines what counts as an observation insight at serve time — a single-metric daily anomaly (S4) or an unexplained n=1 pairwise co-movement (S5) — as deterministic functions over the user's own series, with literature-justified (provisional) thresholds.
type: decision
status: accepted
decided: 2026-07-13
updated: 2026-07-13
---

# Anomaly & personal-signal definition — architecture decision
> **Status: authoritative ground truth** · Date: 2026-07-13 · Refines: S4 / S5
> Part of the insight-engine architecture — see [`../insight-engine-architecture.md`](../insight-engine-architecture.md). Contracts: [`../../../shared/brain/`](../../../shared/brain/).

# Decision 0002: Anomaly & Personal-Signal Definition for the nao Brain Pipeline (S4 single-metric signal, S5 pairwise co-movement)

**Status:** Accepted (thresholds provisional — pending calibration)
**Scope:** Doc-12 stages S4 and S5 — the deterministic serve-time detectors that decide what counts as an *observation insight* (single-metric anomaly OR unexplained personal co-movement, user-data-only, uncited).
**Relationship insights (paper-backed)** are out of scope here and continue to flow through the corroboration/trust path.

---

## Context

Doc-12 pins down the *shape* of the personal-signal path but declares every threshold a **DUMMY**:

- **S4** emits a per-metric, per-day 3-state signal (`up` / `neutral` / `down`) against the user's own baseline, with `neutral := |value − mean| ≤ deadbandSigma·std` and `deadbandSigma = 0.5`. Only a non-neutral state ("fired pattern") triggers the composer.
- **S5** is the n=1 pairwise evaluator over a 60-day joint series: Spearman ρ, Pyper–Peterman autocorrelation-adjusted effective N (`N_eff`), Benjamini–Hochberg FDR `q`, with `signal := q ≤ 0.05 AND N_eff ≥ 10 AND sign(ρ) stable across 3 runs AND |ρ| ≥ 0.3`.

Three problems make the dummies unsafe to ship:

1. **The S4 baseline uses mean/SD.** For sparse, non-normal, outlier-prone n=1 self-report/wearable data, mean and SD have a ~0% breakdown point — the very outliers we want to flag corrupt the estimator that's supposed to flag them (masking).
2. **`deadbandSigma = 0.5` is too hot.** A ±0.5σ band leaves ~62% of normal daily variation *outside* the band, so S4 fires roughly 3 days in 5 — the composer chatters on measurement noise.
3. **No minimum-baseline guard.** S4 will emit a "signal" from day 2, before any stable baseline exists.

The user explicitly asked us to pin down **"how we decide what is an anomaly."** This ADR does that: it defines an observation insight as either (a) a single-metric daily state that clears a robust deadband against an established personal baseline, or (b) a pairwise co-movement that clears a significance-AND-effect-size-AND-stability gate — both computed as pure, **deterministic** numeric functions over the user's own series, with zero LLM involvement.

---

## Options considered

### Option A — Keep mean/SD z-score + point threshold (doc-12 dummy, as-is)
- **Pros:** trivial to compute; already scaffolded.
- **Cons:** not robust (masking on the exact outliers we target); assumes normality that self-tracked data violate; `deadbandSigma = 0.5` over-fires. Rejected as the primary estimator.

### Option B — Robust modified z-score (median + MAD) with a deadband  ← chosen for S4
- **Basis:** Iglewicz & Hoaglin (1993); NIST handbook.
- **Pros:** median and MAD have a **50% breakdown point**; the `0.6745` rescale (= Φ⁻¹(0.75)) makes MAD a consistent estimator of σ for Gaussian data, so thresholds stay interpretable in "σ units"; separates two jobs cleanly — *artifact rejection* (`|M| > 3.5`) vs *daily deadband* (`|x − median| ≤ deadbandK·σ̂`).
- **Cons:** MAD degenerates when >50% of window values are identical (flat sensors); needs a fallback and a minimum-distinct-values guard. A *single symmetric* deadband reduces but does not eliminate boundary chatter — see the S4 anti-chatter note below.

### Option C — Heavier n=1 machinery (bootstrap/randomization tests, Bayesian n-of-1, ARIMA prewhitening)
- **Basis:** AHRQ n-of-1 methods; Daza counterfactual n-of-1; Bayesian distributed-lag models.
- **Pros:** respects actual noise structure without normality assumptions; strongest inference.
- **Cons:** model-fitting cost/latency, plus non-determinism from any unseeded randomness (bootstrap resampling, MCMC), are a poor fit for a *deterministic, lightweight, per-day serve pass*. (A fixed-seed bootstrap would be reproducible, but the cost/latency objection stands.) **Belongs in the offline-authoring pipeline, not the serve path.** Rejected for serve; noted as a future offline enhancement.

### For S5 multiplicity — Bonferroni/Holm (FWER) vs BH-FDR vs Benjamini–Yekutieli
- **Bonferroni/Holm:** control the probability of *any* false positive — far too conservative for a discovery/screening task; would kill nearly every real n=1 signal given wide small-sample p-values. Rejected.
- **BH-FDR (chosen):** controls the expected *proportion* of false discoveries; the standard choice for "which of my metric-pairs co-move." Valid under independence and PRDS. Metric-pairs sharing a common metric are positively dependent; we **assume** this dependence satisfies PRDS so that BH holds — a working assumption to be verified during calibration (see open-Q5), with BY as the fallback.
- **Benjamini–Yekutieli:** the arbitrary-dependence fallback (divides by `Σ1/i`). Held in reserve if calibration reveals dependence outside PRDS.

### For S5 effective-N — Pyper–Peterman modified-Chelton (chosen) vs Afyouni–Smith–Nichols xDF
- **Pyper–Peterman (1998) modified-Chelton (chosen):** matches doc-12; shown by simulation to control Type-I error reasonably well on autocorrelated series (it can be mildly liberal for short, strongly autocorrelated series — a calibration concern, not a blocker).
- **xDF (Afyouni, Smith & Nichols 2019):** a derived (not simulation-tuned) closed-form effective-DoF estimator with better small-sample behavior — a defensible drop-in substitute, flagged as the calibration alternative.

---

## Decision

Both S4 and S5 remain **pure, deterministic numeric functions over the user's own series**, implemented **TS-native** (median/MAD via `simple-statistics`; ranking, Spearman ρ, BH-FDR, the Pyper–Peterman `N_eff` sum, and the stability gate as small inlined/custom TS helpers — `simple-statistics` does not ship a Spearman/rank-correlation function, so that piece is custom). **No Python, no sidecar, no LLM at serve time.**

### S4 — single-metric daily 3-state signal (observation-insight type A)

Replace mean/SD with a **robust baseline**:

```
median   = median(window)
MAD      = median(|x_i − median|)
σ̂        = MAD / 0.6745                        // robust scale, ~σ for Gaussian data
M_i      = 0.6745 · (x_i − median) / MAD       // modified z-score  ( = (x_i − median)/σ̂ )
```

Two distinct thresholds on the same modified-z statistic, for two distinct jobs:

1. **Artifact rejection** (exclude corrupt points from the baseline window before computing state):
   `drop x_i if |M_i| > 3.5`   *(Iglewicz–Hoaglin; provisional — pending calibration)*
2. **Daily 3-state deadband** (the actual `up`/`neutral`/`down` decision):
   `neutral := |x − median| ≤ deadbandK · σ̂`  (equivalently `|M| ≤ deadbandK`), else `up`/`down` by sign.
   `deadbandK = 1.0` in robust-σ̂ units *(raised from the 0.5 dummy; under a Gaussian approximation ≈68% of normal daily variation falls in the neutral band, firing ~1 day in 3; **provisional — pending calibration**)*.

**Anti-chatter note (was "hysteresis"):** a single symmetric deadband narrows the fire rate but does **not** prevent chatter for values hovering near `deadbandK·σ̂`. If boundary chatter proves problematic in calibration, upgrade to true hysteresis via a Schmitt-trigger design (separate `enter`/`exit` thresholds, e.g. enter `up` at `k_hi·σ̂`, return to `neutral` only below `k_lo·σ̂`) or state stickiness. *(Dual-threshold values provisional — pending calibration.)*

**Minimum-baseline guard** — emit no signal until a trustworthy baseline exists:
- `baselineMinDays = 14` before any state is emitted *(provisional — pending calibration; gray/practitioner lit)*.
- **28-day rolling window** as the working baseline *(provisional)*.
- Degeneracy fallback: if MAD = 0 or fewer than a minimum number of distinct values in-window, suppress the signal (return `neutral`) rather than divide by zero.

A fired pattern (`up`/`down`, never `neutral`) triggers the composer, exactly as doc-12 S4 specifies.

### S5 — pairwise personal co-movement (observation-insight type B)

Base statistic: **Spearman's ρ** (rank-based — distribution-free, outlier-resistant, detects any monotonic relationship; aligns with the 1-hop monotonic-only invariant). Over the 60-day joint series, a pair is surfaced iff **all** hold:

```
signal :=  q ≤ 0.05                            // BH-FDR across all tested pairs
       AND N_eff ≥ 10                          // small-sample floor
       AND |ρ| ≥ 0.3                            // effect-size gate
       AND sign(ρ) unchanged across 3 deterministic rolling runs   // stability gate
```

- **Multiplicity:** Benjamini–Hochberg FDR, `q ≤ 0.05` *(provisional; `q ≤ 0.10` is a defensible screening loosening if too few relationships surface. BY fallback reserved for arbitrary-dependence.)*
- **Effective N:** Pyper–Peterman modified-Chelton estimator —
  `1/N* ≈ 1/N + (2/N)·Σ_j ρ_XX(j)·ρ_YY(j)`,
  with the **N/(N−j) bias correction** on the autocorrelations and the sum **truncated at ~N/5 lags**. **Action item: confirm the denominator constant (`1 + 2Σρ_XXρ_YY` canonical vs a secondary source's `1 + 4Σ/N`) and the lag-truncation against the primary Pyper–Peterman PDF before hardcoding.**
- **`N_eff ≥ 10`:** small-sample guard — below ~10 effective observations, ρ confidence intervals are too wide and downstream FDR operates on unreliable p-values *(provisional floor, not a literature-exact constant)*.
- **`|ρ| ≥ 0.3`:** Cohen (1988) "medium" boundary; empirically (Hemphill 2003; Gignac & Szodorai 2016) this sits at/above the top-tercile / "relatively large" real-world effect, so it is a conservative bar against spurious n=1 co-movements *(provisional)*.
- **3-run sign-stability (DETERMINISTIC):** an **engineering replication heuristic** — sign consistency of ρ across **fixed, deterministic rolling/stepped windows** as a lightweight stand-in for cross-validation. **Not a literature constant — flagged as such.** *To preserve Invariant 1 (deterministic serve path), the "runs" MUST be fixed, reproducible windows; no unseeded resampling at serve time. If any resampling is ever used it must run from a fixed seed.* *(provisional)*

---

## How it fits the architecture

- **Doc-12 stages:** this ADR fully specifies **S4** (single-metric state) and **S5** (pairwise evaluator). No new stage is introduced.
- **Deterministic vs LLM (Invariant 1 — two-tier truth):** both detectors are **pure, deterministic numeric functions over table reads** — median/MAD/deadband and Spearman/`N_eff`/BH/stability, with the stability gate constrained to fixed reproducible windows. They sit entirely in the **deterministic serve path**. The only LLM involvement anywhere downstream remains the two cached phrasing calls in the composer, which fire *after* S4/S5 have already made the deterministic fire/no-fire decision. Anomaly detection and the signal gate are 100% deterministic, as required.
- **TS-native (Invariant 4):** every method here is elementary numeric code — median, MAD, rank correlation, a lag-`j` autocorrelation sum, a BH step-up, a sign check. Implementable directly in TS (`simple-statistics` covers median/MAD; ranking + Spearman + the rest are small custom reducers). **No Python, no sidecar, no out-of-process service** — this is strictly stricter than the doc-12 A4 GROBID precedent (which is the *only* sanctioned non-TS sidecar), and does not rely on it.
- **Monotonic-only composition (Invariant 3):** Spearman is rank/monotonic by construction; the S5 signal encodes a single monotonic co-movement direction (`sign(ρ)`), consistent with 1-hop monotonic-only served relationships.
- **notability != trust (Invariant 2) & corroboration (Invariant 5) & quote-span traceability (Invariant 6):** observation insights are **user-data-only and uncited** — they carry no paper, no venue, no citation count, and therefore never touch the trust/reliability score or the impactTier. They are explicitly labeled as *personal/n=1, uncorroborated* signals so they are never confused with paper-backed relationship insights. The corroboration-by-independent-root and quote-span-traceability machinery applies only to the relationship-insight path and is unaffected.
- **Heavier n=1 inference stays offline:** bootstrap/Bayesian/prewhitening approaches (Option C) are deliberately excluded from serve to preserve determinism and latency; if adopted later they belong in the offline-authoring pipeline.

---

## Open questions / calibration plan

All numbers above are **provisional — pending calibration.** Every value ships behind a config object, not a literal, so calibration is a data change, not a code change.

1. **Verify the Pyper–Peterman formula against the primary PDF** before hardcoding: canonical `1/N* ≈ 1/N + (2/N)Σρ_XXρ_YY` vs the secondary-source `1 + 4Σ/N` rendering, plus the exact N/5 lag-truncation and the N/(N−j) bias correction. **Blocking for S5 correctness.**
2. **`deadbandK` (S4):** calibrate against each user's own **false-fire rate** — target the band where the composer fires on genuinely-abnormal days, not noise. Start at 1.0σ̂; sweep 0.75–1.5. If boundary chatter persists, evaluate the dual-threshold (Schmitt) upgrade.
3. **`baselineMinDays` / rolling-window length (S4):** the 14-day / 28-day figures rest on practitioner/gray sources, not primary physiology trials. Confirm against the actual cadence/completeness of nao's ingested metrics; add an illness/travel "reset the clock" rule.
4. **`N_eff ≥ 10` floor (S5):** validate that ρ estimates at `N_eff ≈ 10` are stable enough for downstream FDR; some single-subject guidance argues for more. Consider raising.
5. **`q` threshold & PRDS (S5):** monitor surfaced-relationship volume; loosen to `q ≤ 0.10` only if the pipeline is starved. **Verify the working PRDS assumption** against nao's real co-movement dependence structure; switch BH→BY if dependence falls outside PRDS.
6. **`|ρ| ≥ 0.3` (S5):** re-check against nao's own observed co-movement distribution once real data accrues.
7. **3-run sign-stability (S5):** define "run" precisely as a **fixed, deterministic** rolling/stepped window (never unseeded resampling — Invariant 1) and validate the count (why 3?) empirically — this is a heuristic without a canonical citation.
8. **Candidate substitution (S5):** evaluate **xDF (Afyouni–Smith–Nichols 2019)** as a closed-form replacement for Pyper–Peterman if small-sample behavior proves inadequate.
9. **MAD degeneracy (S4):** finalize the flat-sensor fallback (minimum distinct-values threshold) and confirm it can't silently suppress real signals.

---

## Sources

- Iglewicz & Hoaglin (1993), *How to Detect and Handle Outliers* (ASQC) — modified z-score / 3.5 rule: https://metricgate.com/docs/robust-z-score-modified/ · https://www.statology.org/modified-z-score/
- Benjamini & Hochberg (1995), "Controlling the false discovery rate," JRSS-B: https://rss.onlinelibrary.wiley.com/doi/10.1111/j.2517-6161.1995.tb02031.x
- FDR / Benjamini–Yekutieli dependency (PRDS) background: https://en.wikipedia.org/wiki/False_discovery_rate
- Pyper & Peterman (1998), Can. J. Fish. Aquat. Sci. 55(9):2127-2140: https://cdnsciencepub.com/doi/10.1139/f98-104 (erratum: https://cdnsciencepub.com/doi/10.1139/f98-201)
- Afyouni, Smith & Nichols (2019), "Effective degrees of freedom of Pearson's correlation under autocorrelation," NeuroImage: https://www.sciencedirect.com/science/article/pii/S1053811919303945
- Cohen correlation benchmarks (0.1/0.3/0.5): https://easystats.github.io/effectsize/reference/interpret_r.html
- Hemphill (2003), "Interpreting the Magnitudes of Correlation Coefficients," *American Psychologist* 58:78-79: https://psycnet.apa.org/record/2003-02034-011
- Gignac & Szodorai (2016), "Effect size guidelines for individual differences researchers," *Personality and Individual Differences*: https://www.sciencedirect.com/science/article/abs/pii/S0191886916308194
- Spearman robustness for non-normal/outlier/monotonic data: https://www.emergentmind.com/topics/spearman-rank-correlation-coefficient-r_s
- n-of-1 autocorrelation / serial-dependence (offline-only alternatives): https://ncbi.nlm.nih.gov/pmc/articles/PMC6087468 · https://arxiv.org/pdf/2112.13991 · https://effectivehealthcare.ahrq.gov/products/n-1-trials/research-2014-1
- Deadband / hysteresis anti-chatter rationale (DCS alarm deadband): https://zeroinstrument.com/what-is-dcs-alarm-deadband-and-its-purpose/
- Personal wearable baseline duration (gray/practitioner): https://www.sanolabs.eu/blog/reliable-wearable-baseline-21-days · https://www.aypexmove.com/post/why-wearable-data-needs-a-personal-baseline
