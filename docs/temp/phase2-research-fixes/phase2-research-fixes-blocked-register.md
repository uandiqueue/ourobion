---
title: Phase-2 Research-Fixes — Blocked Register
summary: Human-gated / data-blocked items for the remediation run (B-entries). Where it stopped · what is needed · what it gates. Lane-C calibration items whose "right number" needs data we don't have live here as backlog, with the shipped mechanism referenced. Dev aid (docs/temp), not ground truth.
type: plan
scope: shared
status: canonical
updated: 2026-07-19
---

# Phase-2 Research-Fixes — Blocked Register

Format: **where it stopped · what is needed from Jayden (or what data) · what it gates.** Numbered
`B1, B2, …`; closed items stay in place marked DONE/CLOSED with a resolution note. The run skips these
and keeps building; when one unblocks, the orchestrator picks it up from here.

Lane-C rule: where a "right" value needs data we don't have, the unit ships the **mechanism +
instrumentation** and records the **calibration** here as a backlog item — never a guessed constant.

## Open

- **B1 · Per-metric medium confidence cutoff (from F2 / RU5b)** — *where it stopped:* F2 reverted the
  S3 medium cutoff to the single global `7` in-window days. RU5b's stronger recommendation is to make
  the cutoff **metric-dependent** (the right day-count depends on a metric's within-person variability —
  cortisol slope needs 5–10 days, steps ~3, sleep 6–7), but that is a lane-C *mechanism* change, not a
  value tweak. *What is needed:* per-metric within-person variability / reliability data (day-count for
  target ICC per signal), plus a mechanism to carry a per-metric cutoff (analogous to the per-metric
  `deadbandK` registry field) — neither exists yet. *What it gates:* nothing — the global `7` is a safe
  provisional and blocks no other unit; unblock when per-metric reliability data lands.

- **B2 · Persist the edgeScore component breakdown to the edge read store (from F3 / RU2b)** — *where
  it stopped:* F3 shipped the pure `edgeScoreComponents(v)` and surfaces the breakdown (confidence ·
  tier · corroboration · contributions · multiplier · composite · band) in the loader's per-edge review
  log — the cheap, non-persisted guardrail. Persisting it alongside `edge_score` / `serving_band` in the
  `edge_verifications` projection (so a UI/reviewer reads it from the DB, not just loader stdout) would
  need a **new column / migration on a git-tracked truth-tier contract** (`shared/brain` + the S6 table
  schema), which is a 2-reviewer shared-contract change (docs/memory/0002) — out of lane B's additive/
  non-schema scope. *What is needed:* a shared-contract PR adding the column(s) + migration + the
  ts↔db parity guard, gated on 2-reviewer sign-off; and a decision on whether to store the full
  breakdown or recompute-on-read (it is a pure function of the already-stored `verification` jsonb, so
  recompute-on-read is viable and may make persistence unnecessary). *What it gates:* nothing — the pure
  function + loader review log already satisfy the RU2 guardrail without a truth-tier change; unblock if
  a DB-backed reviewer UI needs the components server-side.

## Closed

_(none yet.)_
