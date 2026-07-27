---
title: Run 1 — Phase-2 build run, audit, evidence review, research-fixes (record)
summary: Index for the first long-horizon run's tracking docs — the Phase-2 build (U1–U28), the record-only audit, the evidence review against the literature, and the research-fixes remediation run. The build content is merged into dev-phase2; the unit sign-off review is NOT finished. Open items are carried in run2/carry-forward-from-run1.md. Dev aid (docs/temp), not ground truth.
type: log
scope: shared
status: canonical
updated: 2026-07-25
---

> **ARCHIVED 2026-07-26 — historical run record. Do not build from this; kept for provenance.** Current product planning: [Run 3](../../../temp/run3/README.md).

# Run 1 — Phase-2 build run (record)

Everything the **first** long-horizon run produced. This folder is the historical record: read it to
find out *what was decided and why*. It is **not** a worklist — anything Run 1 left open is listed in
[`../run2/carry-forward-from-run1.md`](../run2/carry-forward-from-run1.md).

## Status

| Lane | State |
|------|-------|
| Build (U1–U18, then catch-up U19–U28) | **Merged** into `dev-phase2` (recovery PR #72, 2026-07-18) |
| Record-only audit (27 findings, 5 medium) | **Complete** — 26 fixed via U19–U28; dispositions in [`audit/findings-register.md`](./audit/findings-register.md) |
| Evidence review vs the literature | **Complete** — [`research/decisions-evidence-review.md`](./research/decisions-evidence-review.md) |
| Research-fixes remediation (F0–F8) | **Merged** into `dev-phase2` @ `e185cf0` (PR chain #99–#115) |
| Unit sign-off review | **INCOMPLETE** — of 24 unit rows, only U1 is fully cleared; U3/U4/U9 are individually signed or provisional; the rest are pending or deferred |

## Contents

- [`orchestration-log.md`](./orchestration-log.md) — build history, unit by unit.
- [`config-decisions.md`](./config-decisions.md) — C-entries (configuration values and their basis).
- [`signoff-decisions.md`](./signoff-decisions.md) — D-entries (architecture / contract decisions).
- [`blocked-register.md`](./blocked-register.md) — B-entries: items the run stopped on because they need
  Jayden or external access. **B1 and B13 are resolved; the register still shows B13 open** (see the
  carry-forward doc).
- [`unit-index.md`](./unit-index.md) — the review cockpit: one row per shipped unit with sign-off status,
  code paths, session log, and PR.
- [`signoff-instructions.md`](./signoff-instructions.md) — the sign-off protocol and the authoritative
  per-unit ledger (§6). Still the live protocol; Run 2's own sign-off follows it.
- [`audit/`](./audit/) — record-only audit: findings register + orchestration log.
- [`research/`](./research/) — evidence review: decisions vs the literature, references, orchestration log.
- [`research-fixes/`](./research-fixes/) — the remediation run that acted on the evidence review:
  findings, config decisions, sign-off decisions, blocked register, orchestration log.

## Reading order

1. `unit-index.md` — what exists and where it stands.
2. `signoff-instructions.md` §6 — the authoritative sign-off ledger.
3. `orchestration-log.md` — how it was built.
4. `audit/findings-register.md` → `research/decisions-evidence-review.md` → `research-fixes/findings.md`
   — the critique chain and what it changed.
