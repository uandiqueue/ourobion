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
