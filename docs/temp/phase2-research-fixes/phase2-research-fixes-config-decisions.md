---
title: Phase-2 Research-Fixes — Config Decisions
summary: Numeric/config values shipped or re-affirmed by the remediation run (C-entries). value shipped · alternatives considered · rationale. All provisional-until-calibrated unless marked otherwise; every value lives in a config object, never an inline literal (ADR-0002 mandate). Companion to insight-engine-architecture §11. Dev aid (docs/temp), not ground truth.
type: plan
scope: shared
status: canonical
updated: 2026-07-19
---

# Phase-2 Research-Fixes — Config Decisions

Entry format: **value shipped · alternatives considered · rationale.** All values
provisional-until-calibrated unless marked otherwise. Every value must live in a config object, never
an inline literal (ADR-0002 mandate). Companion to `docs/shared/insight-engine-architecture.md` §11.

These are *this run's* C-entries; the Phase-2 build run's originals stay in
`docs/temp/phase2-run-config-decisions.md` (context only, not ground truth here).

## Decisions

- **C5 · S3 baseline medium confidence cutoff [F2]** — **value shipped: medium cutoff `7`** in-window
  days (ladder 3 / 7 / 14, low/medium/high) · **alternatives considered:** `5` (U6's 3/5/14 — a
  regression, unsupported: no citation singles out 5, and it grants "medium" on *less* data) / a
  per-metric medium cutoff (a metric's own within-person variability sets its day-count — backlogged,
  see B1) · **rationale:** evidence-review **RU5b** — the confirmed reliability literature mildly
  *favours* 6–7 nights for a "medium/acceptable" label (7-day protocols recur; sleep needs 6–7 nights
  for ICC 0.7) and *nothing* supports 5, so the previously-deployed `7` is the better-grounded choice.
  Reverts the U6 7→5 change back to 7. Lives in `BASELINE_CONFIG.confidence.mediumMinDays`
  (`compute-baselines/index.ts`) + its mirror `WINDOWED_BASELINE_CONFIG` (`generate-insights/
  evaluators.ts`). Behaviour change (a 6-day baseline is now `low`, was `medium`); proven by the
  boundary test in `tools/rules/tests/engine_condition_coverage.test.ts`. Provisional until per-metric
  calibration (B1).

- **C2 · edgeScore weights + corroboration saturation [F3]** — **value shipped (UNCHANGED, now config):**
  `EDGE_WEIGHTS = { base 0.6, tier 0.25, corroboration 0.15, corroborationSaturation 3 }` in
  `shared/brain/index.ts` · **alternatives considered:** leave inline (rejected — violates the ADR-0002
  "values in config objects, never inline literals" mandate) / re-tune the split (out of scope, and the
  literature supports no alternative numbers either) · **rationale:** evidence-review **RU2b** — the
  0.6/0.25/0.15 split and the saturation-at-3 are **engineering judgment, uncited** (no literature
  supports these or any composite weights); the honest posture is *keep as provisional baseline* + apply
  the RU2 guardrail: **report the components (confidence, tier, corroboration) alongside the composite**
  wherever an edge is surfaced for review (Cochrane domain-wise practice). This unit is a **refactor +
  reporting change only — the composite score and serving bands are byte-identical for all inputs**
  (proven by the regression table in `tools/edge-loader/tests/edge_score_components.test.ts`, which
  checks `edgeScore` against the transcribed pre-refactor formula). The breakdown is exposed by the pure
  `edgeScoreComponents(v)` (the single source of truth `edgeScore` / `servingBand` now read) and
  surfaced in the loader's per-edge review log (`tools/edge-loader/load_edges.mjs`); persisting it is a
  shared-contract change → backlogged (B2). Weights stay provisional-until-calibrated (ADR-0003 Open-Q
  1–2; the F8 sibling).

- **C3 · S4 `deadbandK` [F4]** — **value re-affirmed (UNCHANGED): `deadbandK = 1.0`** (robust-σ̂ units)
  for all 16 baselineApplicable metrics · **mechanism:** per-metric registry field
  (`shared/metrics/registry.ts` `signal.deadbandK`), consumed via the `DEADBAND_K` map in
  `evaluate-signals/index.ts` — *not* a `config.ts` constant (deliberately per-metric) · **alternatives
  considered:** raising `k` now (e.g. to > 1.5 for an "anomaly" reading — rejected: lane C ships no
  guessed constant, and the right target depends on the unresolved product intent + real fire-rate data) ·
  **rationale:** evidence-review **RU3c** — `k = 1.0` fires ~31.7% of days under a Gaussian (more under
  heavy tails), which is defensible only if the intent is a ~1-in-3 daily 3-state nudge, not an occasional
  anomaly alert. F4 resolves nothing about the *value*: it keeps `1.0` provisional and ships **fire-rate
  instrumentation** (`fireRate` in `evaluate-signals/stats.ts`, logged per metric per run by `index.ts`,
  surfaced as `fireRates` in the handler response) so `k` can later be calibrated to a target fire rate.
  Intent = product sign-off (D3); calibration = backlog (B3). No behaviour change (measurement-only).

- **C4 · Coincidence-rule lag grid [F5]** — **value shipped: `ALLOWED_LAG_DAYS = {1, 2, 3, 7}`**
  (effective cross-metric grid **{0, 1, 2, 3, 7}** days; lag 0 encoded as `lagDays: null`) — **added lag
  2** to the prior C10 set {0,1,3,7} · **alternatives considered:** leave the grid at {0,1,3,7} (rejected —
  it skips the dense 1–3 day physiological zone) / a continuous lag scan (rejected — n=1 ~60-day data
  can't support it, and this path is a boolean baseline conjunction, not a scan) · **rationale:**
  evidence-review **RU7** (RU7a,e,f) — gut transit (median ~28h; functional-GI 43–60h) and DOMS (peak
  24–48h) both peak **near the 1–3 day boundary** the old grid skipped; lag 2 is a low-cost fill of that
  zone. The set is **physiologically-plausible coverage, NOT calibrated** (gut 1–3d, DOMS 1–2d, short
  env-exposures 0–7d). Lives in `ALLOWED_LAG_DAYS` (`generate-insights/evaluators.ts`) + the load-time gate
  (`generate-insights/index.ts`). **Widen-only, no behaviour change:** adding 2 only widens what an author
  may specify — lag 2 is **inert until a blueprint opts into it** (verified: the two shipped coincidence
  blueprints each name a single `lagDays` — `hrv_rise_after_sleep_rise`=1, `gut_comfort_mood_comove`=null;
  no rule auto-expands across the allowed set). Proven by the added lag-2-accepted / lag-4-rejected gate
  test + lagDays:2 evaluation test in `tools/rules/tests/engine_condition_coverage.test.ts`.
  **Coincidence-path limitations recorded (A2 reframing — this is NOT the review's CCF rewrite):** this
  lag path is a **boolean conjunction of baseline leaves at lagged windows, not a rank cross-correlation**
  (`phase2-research-fixes-findings.md` §A2), so (a) **serve-time prewhitening/deseasonalizing stays
  by-design offline per ADR-0002** — none added; (b) **"treat the 4 lags as one hypothesis" (RU7e) is moot
  as coded** — the lag path never enters the BH/FDR family (that family is the S5 lag-0 Spearman pair set
  only), so there is no lag multiplicity to correct; (c) **lag-7 ↔ weekly-periodicity (day-of-week)
  confound** is a genuine small concern → deseasonalize-before-lag-7 backlogged (**B4**). Provisional until
  physiological calibration. §11 records no lag grid → no accepted-doc change needed (grid lives in code +
  dev-aid C10; this run's amendment is C4 here).

- **C6 · S5 effective-N method toggle [F6]** — **value shipped: `nEffMethod = 'pyper-peterman'`** (default,
  behaviour UNCHANGED) · **alternatives considered:** `'xdf'` — the cross-correlation-aware Afyouni–Smith–
  Nichols (2019) estimator, the principled fix for the co-moving-pair bias (**INTERIM**: `effectiveN`
  **throws** on it; faithful port + reference-vector verification backlogged **B5**) / hand-rolling xDF now
  (rejected — exact Afyouni equations not accessibly available; FFT + Tukey-taper/adaptive-truncation
  complexity; unverified science violates the run's honesty invariant, D4) / no toggle at all (rejected —
  RU4d is a real bias; the swappable mechanism should exist now, science later) · **rationale:** evidence-
  review **RU4d** — the Pyper–Peterman/Bartlett effective-N uses only each series' OWN autocorrelation
  (`Σ ρ_XX·ρ_YY`) and is "substantially biased by non-zero cross-correlation", the exact regime the detector
  operates in (it selects pairs *because* they co-move). F6 ships the **mechanism, not the science**:
  `effectiveN` dispatches on `PAIR_CONFIG.nEffMethod` (optional, absent ⇒ `'pyper-peterman'`), with the P&P
  path extracted verbatim into `effectiveNPyperPeterman` — **byte-identical** for the default (regression-
  proven in `tools/engine-stats/tests/s5_pairwise.test.ts`: default reproduces the existing N_eff vectors
  exactly; explicit `'pyper-peterman'` equals the default; `'xdf'` throws the documented INTERIM error).
  Lives in `PAIR_CONFIG.nEffMethod` (`evaluate-signals/config.ts`) + the `NEffMethod` type / optional
  `PairConfig.nEffMethod` (`evaluate-signals/stats.ts`). ADR-0002 Open-Q1 (resolved-confirmed) + Open-Q8
  (xDF seam) amendment intent recorded in **D4** (accepted-ADR immutability — retro-review). Provisional
  until the faithful xDF lands + the P&P→xDF switch is calibrated (B5).
