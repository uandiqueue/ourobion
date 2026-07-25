---
title: Run 2.0 — Phase-2 demo-slice build (record + live carry-forward)
summary: Index for Run 2.0 — the demo-slice build that executed O9–O20 across units U0–U13 (PRs #123–#136). Holds the run's tracking docs plus the still-live forward surfaces (next-build backlog, pending-build register, carry-forward from Run 1). Built and DoD-met; every unit sign-off is still pending Jayden. Dev aid (docs/temp), not ground truth.
type: log
scope: shared
status: canonical
updated: 2026-07-25
---

# Run 2.0 — demo-slice build (record + live carry-forward)

Run 2.0 executed the demo-scoped backlog (O9–O20) over 14 unit rows, **U0–U13**, as the stacked PR chain
**#123–#136**. This folder holds both the run's own record *and* the forward-looking surfaces that are
still live — so the open work is in one place rather than scattered across closed runs.

## Status

| | |
|---|---|
| Units | U0–U13 (14 rows), PRs #123–#136 |
| Definition of done | **Met** — scripted e2e dry-run 21/21 + runbook [`docs/shared/phase2-demo-runbook.md`](../../shared/phase2-demo-runbook.md) |
| Sign-off | **All units `pending`** — the orchestrator never self-signs; Jayden's review has not run |
| Branch state | merged into `dev-phase2-run2` (2026-07-25) |

## Run record

- [`orchestration-log.md`](./orchestration-log.md) — build history, unit by unit.
- [`unit-signoff-index.md`](./unit-signoff-index.md) — **the audit surface.** One row per unit: what it
  built, O-items closed, gate status, what was live-verified, and — honestly — what was *not*.
- [`decisions-signoff.md`](./decisions-signoff.md) — D-entries for this run.
- [`human-decisions.md`](./human-decisions.md) — Jayden's in-run rulings (H-items).
- [`orchestrator-prompt.md`](./orchestrator-prompt.md) — the launch prompt the run was dispatched from.
- [`assets/`](./assets/) — U12 emulator screenshots (visual evidence for the demo check).

## Live forward surfaces (not closed by this run)

- [`carry-forward-from-run1.md`](./carry-forward-from-run1.md) — what Run 1 left open and who owns it.
- [`next-build-optimizations.md`](./next-build-optimizations.md) — the decision-locked backlog, O1–O22.
  O9–O20 were executed by this run; **O1–O8 remain open**, and **O21/O22 are proposals pending Jayden's
  review** (they were renumbered from O9/O10 on merge — see the note in the doc).
- [`pending-build-register.md`](./pending-build-register.md) — the standing map of known gaps across the
  project. A gap *record*, not a worklist; items graduate into a run only when Jayden locks a decision.
- [`backend-adversarial-verdict-2026-07-22.md`](./backend-adversarial-verdict-2026-07-22.md) — the
  adversarial backend review whose verdicts B1–B3 / H1–H3 became O15–O20 and drove this run's scope.

## Reading order

1. `unit-signoff-index.md` — what shipped and what is genuinely proven.
2. `carry-forward-from-run1.md` + `next-build-optimizations.md` — what is still open.
3. `pending-build-register.md` — the wider gap map, for scoping a Run 3.
