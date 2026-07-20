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

## Closed

_(none yet.)_
