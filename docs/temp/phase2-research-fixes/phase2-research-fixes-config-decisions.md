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
