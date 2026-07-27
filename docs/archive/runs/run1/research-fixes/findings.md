---
title: Phase-2 Research-Fixes — Verify-First Findings
summary: The lane-A verify-first findings that gate the real fixes — the Pyper–Peterman formula-constant verification (A1, ADR-0002 Open-Q1) and the prewhitening/CCF confirmation (A2, RU7d). Each yields a code-grounded finding + a "no change / follow-up fix unit" disposition. Dev aid (docs/temp), not ground truth.
type: plan
scope: shared
status: canonical
updated: 2026-07-19
---

> **ARCHIVED 2026-07-26 — historical run record. Do not build from this; kept for provenance.** Current product planning: [Run 3](../../../../temp/run3/README.md).

# Phase-2 Research-Fixes — Verify-First Findings (lane A)

Verify-first units run before the fixes they gate. Each records: what the code actually does, what the
primary source / literature says, and a disposition — **no change needed** or **a follow-up fix unit**.

---

## A1 — Pyper–Peterman effective-N formula constant (ADR-0002 Open-Q1) · *blocking for S5 correctness*

**Question (ADR-0002 Open-Q1 / RU4d).** Verify the S5 effective-sample-size denominator constant —
canonical `1/N* = 1/N + (2/N)·Σ ρ_XX·ρ_YY` versus a secondary-source `1 + 4Σ/N` rendering — plus the
N/(N−j) bias correction and the N/5 lag truncation, against the primary Pyper–Peterman (1998) source,
before trusting the estimator.

**What the code actually does** (`supabase/functions/evaluate-signals/stats.ts:191-226`, verified
directly):
```
biasCorrectedAutocorr(v, j) = (n/(n−j)) · [ Σ_t (v_t−v̄)(v_{t+j}−v̄) / Σ_t (v_t−v̄)² ]
1/N* = 1/n + (2/n)·Σ_{j=1..floor(n·0.2)} biasCorrectedAutocorr(a,j)·biasCorrectedAutocorr(b,j)
N*   = clamp(1/invNStar, 2, n)      // clamp at n on independence / negative-sum
```
So the code ships: leading coefficient **2/N**; **N/(N−j)** bias correction on each sample
autocorrelation; lag sum truncated at **⌊N/5⌋** (`maxLagFraction = 0.2`, `config.ts:33`).

**Verification.** The primary Pyper–Peterman PDF (`doi:10.1139/f98-104`) and the Afyouni–Smith–Nichols
(2019) review that reproduces it are both **publisher-paywalled (HTTP 403)** — direct primary-PDF
quotation was not obtainable this run. The constant is nonetheless resolvable from the canonical
underlying result, which is textbook and was confirmed from an open source:

- The variance of a correlation between two stationary autocorrelated series is the **Bartlett (1946)
  / Bayley–Hammersley** result `Var(r) ≈ (1/N)·[1 + 2·Σ_k ρ_XX(k)·ρ_YY(k)]`, i.e.
  `1/N* = 1/N + (2/N)·Σ ρ_XX·ρ_YY`. The single-series effective sample size `N_eff = N/(1 + 2·Σ ρ)`
  (coefficient **2**) was confirmed from an open reference. Pyper–Peterman's "modified Chelton" method
  **is** this Bartlett-family estimator with the N/(N−j) small-sample bias correction and a truncated
  lag window.
- Therefore the coefficient is **2/N, not 4/N**. The `1 + 4Σ/N` rendering ADR-0002 Open-Q1 flagged is
  **non-canonical** (it double-counts the symmetric lag sum) and is **not** what the code uses.

**Disposition — NO CODE CHANGE NEEDED.** The coded estimator matches the canonical Bartlett/
Bayley–Hammersley/Pyper–Peterman form on all three points (2/N coefficient, N/(N−j) correction, N/5
truncation). ADR-0002 Open-Q1 is **resolved-confirmed on the coefficient and the bias correction**.

**Residuals (recorded, not blocking):**
- Primary-PDF quotation is paywall-blocked; the verdict rests on the canonical underlying result, which
  is unambiguous on the coefficient. Confidence: **high** on `2/N` and `N/(N−j)`.
- The **N/5 truncation** is a Pyper–Peterman-supported window choice, **not** a unique "correct"
  constant — P&P themselves document lag-window sensitivity for short series. It stays a minor
  calibration knob (a config field already), not a correctness bug. → noted for the xDF unit (F6) and
  the calibration backlog, not a fix here.
- This resolves the *formula-constant* worry only. The separate RU4d finding — that the whole
  P&P/Bartlett family is **biased for co-moving pairs** because it uses only each series' *own*
  autocorrelation — is a genuine method limitation and is the subject of the **xDF** unit (F6), not A1.

**ADR action:** append a resolved-confirmed note to ADR-0002 Open-Q1 (do not overwrite) — carried by F6
alongside the xDF open-question, since both touch the same S5 estimator paragraph. Flagged for shared/
retro-review.

---

## A2 — Does the lag-correlation path prewhiten / deseasonalize before the CCF? (RU7d) · *flagged likely-live*

**Question (RU7d / RU7f).** The review's single most serious specific defect: rank cross-correlations
(CCFs) computed on autocorrelated ~60-day n=1 series can yield ~30%-order false positives unless the
series are **prewhitened / stationarized (and day-of-week deseasonalized)** first. Confirm whether the
pipeline does this — treat as likely-live until verified in the actual engine code.

**What the code actually does** (verified directly across `evaluate-signals/` and `generate-insights/`):

**The review's premise does not match the implementation — there is no rank-CCF in the codebase.**
Two distinct subsystems were conflated in the review:

1. **S5 pairwise evaluator** (`evaluate-signals/stats.ts` + `index.ts`) — computes a **contemporaneous
   (lag-0)** Spearman ρ per metric-pair over the 60-day joint series, with Pyper–Peterman N_eff, BH-FDR,
   and 3-window sign-stability. It computes **no cross-correlation and scans no lags.**
2. **The "lag {0,1,3,7}" path** (`generate-insights/evaluators.ts` + `index.ts`, the `coincidence` rule
   primitive, `ALLOWED_LAG_DAYS = {1,3,7}` + lag-0-as-null) — is a **boolean conjunction of baseline
   leaves evaluated at lagged windows** (`evaluateCoincidence` → `getBaseline(metricB, lag)`). It
   computes **no correlation of any kind** — no ρ, no CCF. It asks "did metric A's baseline fire on day
   d and metric B's baseline fire on day d−lag?", not "how correlated are A and B at lag k?".

A grep for `prewhiten|deseasonal|detrend|differenc|stationar|ARIMA|day-of-week|residual` across the
correlation path returns nothing. So **prewhitening/deseasonalizing is absent — but so is the rank-CCF
it would protect.** The `~30% false-positive` result [autocorr-fp-2023] is about rank CCFs on
autocorrelated series; it does **not** transfer to a boolean baseline conjunction.

**Disposition — NO PREWHITENING FIX AS THE REVIEW FRAMES IT (premise mismatch).** But three real,
narrower residuals remain, each routed rather than dropped:

- **(R1) Autocorrelation in the S5 lag-0 Spearman path is real** — and it is handled by the
  Pyper–Peterman **N_eff df-shrink**, not by prewhitening. ADR-0002 (Options C, and §"How it fits")
  **explicitly decided** that heavier n=1 machinery — "bootstrap/Bayesian/**prewhitening** approaches —
  are deliberately excluded from serve to preserve determinism and latency; if adopted later they belong
  in the offline-authoring pipeline." So *not prewhitening at serve time is a by-design accepted-ADR
  decision*, not an oversight. Per the run's "findings by-design in an accepted decision are SKIPPED,
  not re-decided" rule → **skip; do not add serve-time prewhitening.** The residual co-moving-pair bias
  in N_eff is the xDF unit (F6).
- **(R2) The lag-7 ↔ weekly-periodicity confound (RU7f)** applies to a *correlation* at lag 7. The
  coincidence path compares baseline fires 7 days apart, which is a weaker surface for the confound, but
  a day-of-week alignment can still inflate a lag-7 coincidence. This is a genuine (small) concern for
  the `coincidence` rule → routed to F5 as a **documented limitation + optional deseasonalize-before-
  lag-7 backlog item**, not a serve-path rewrite.
- **(R3) "Treat the 4 lags as ONE hypothesis, not 4 FDR entries" (RU7e)** is **moot as coded**: the 4
  lags never enter the BH family — the BH family is the S5 lag-0 pair set only (`index.ts:314`); the
  coincidence/lag path never calls `benjaminiHochberg`. There is no 4-way lag multiplicity to correct.
  → recorded in F5 as "already not a multiplicity problem"; no change.

**Net for F5.** The heavy "prewhiten + one-hypothesis" rewrite the review implied is **not warranted**
(no CCF; prewhitening by-design-offline per ADR-0002; no lag multiplicity in BH). F5 collapses to: (a)
record this premise correction, (b) the one genuinely-actionable cheap item — **consider adding lag 2**
to `ALLOWED_LAG_DAYS` (gut transit & DOMS both peak near the 1–3 day boundary the grid skips), and (c)
backlog the lag-7 deseasonalize concern (R2). F6 (xDF) carries the real autocorrelation-in-S5 residual.

**ADR action:** none required for A2 itself (ADR-0002 already documents the offline-prewhitening
decision). F5 documents the coincidence-path limitations; the correction of the review's CCF premise is
recorded here.
