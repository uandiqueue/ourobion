---
name: record-only-audit
description: "Use when auditing a completed build phase on this repo without changing it — resumable AU-unit worklist, gate baseline, findings-register discipline, severity/confidence conventions, synthesis. Findings feed a later fix run; nothing is fixed in-audit."
---

# Record-only audit run

Part of the **orchestrate-build-run** skill set (see that skill for the full run loop).

Read-audit of completed work: **find and record issues, never fix them.** Proven instance:
the Phase-2 audit (2026-07-17, units AU0–AU9, 27 findings A1–A27) whose register drove the
audit-fix phase (R1 + U19–U28) that dispositioned all 27. Sibling skills:
**orchestrate-build-run** (the build/fix runs an audit sits between) and
**windows-toolchain-gotchas** (environment); this skill assumes both.

## 0. Ground rules (non-negotiable)

- **Record only.** No code edits, no migrations, no "quick fixes". The ONLY files written
  are the two audit docs. Do not commit or push.
- **A documented decision is not a bug.** Check the run's D-/C-entries and blocked register
  (B-entries) first; flag only when code contradicts its *own* stated decision. Known
  blockers are cross-referenced, never re-reported.
- **Never guess a pass.** A check needing infra you don't have (Docker DB, API keys, R2)
  goes under "Coverage gaps" as *not exercised* — this distinction is the audit's honesty.
- Read-only commands are fine (`node tools/context_sync.mjs --check` yes; **never**
  `--fix-index`). Activate the toolchain per shell: `. .\scripts\biotope-env.ps1`.

## 1. Scaffold (unit AU0)

Create an audit dir under `docs/temp/` (index-exempt dev-aid tier) holding exactly two docs:

1. **`audit-orchestration-log.md`** — resume protocol, ground rules, worklist
   (`AU# | Unit | Status | Notes`, statuses `done/in-progress/next/queued/blocked`), a
   `▶ RESUME AT: AU#` pointer, and a session ledger (`When | Unit | What ran / covered | Outcome`).
2. **`audit-findings-register.md`** — findings table
   (`ID | Sev | Status | Unit | Summary | Location | Confidence`), per-finding detail
   sections, plus three fixed sections: **Not bugs — by design (verify with human)**,
   **Coverage gaps (not exercised)**, **Summary (written last)**.

Unit decomposition (adapt to scope) — Phase-2's layout was: AU1 gate run → AU2 shared contracts →
AU3/AU4 tool packages → AU5 DB migrations → AU6 engine functions → AU7 CI → AU8 integration
seams (the app/serve boundary) → AU9 synthesis, always last.

## 2. Resume protocol (what makes a killed session cheap)

1. One unit at a time — never start the next before closing the current.
2. Set the unit `in-progress` in the log **before** starting it.
3. Append findings to the register **as you find them**, never batched "at the end" — a
   killed session must lose at most one in-flight unit.
4. Close a unit: status `done` + ledger row + move the ▶ RESUME pointer — then and only
   then start the next.
5. `in-progress` found on resume = the prior session died mid-unit → redo that whole unit;
   dedup register entries by (file, line, summary).

**Gotcha:** when appending a ledger row via Edit, anchor on the *previous* row and insert
BELOW it — anchoring on the table header inserts rows above earlier ones and scrambles
chronology (happened repeatedly in the proven run).

## 3. AU1 — the gate baseline

Run and record raw pass/fail + counts (background the long ones):

- `apps\biotope`: `flutter analyze`, then `flutter test` (sequentially — concurrent runs
  contend on the pub cache).
- `node tools/context_sync.mjs --check`.
- Every node package in `tools/*` with a package.json: `npx tsc --noEmit` + `npm test --silent`.

An all-green baseline is itself a finding-shaper: everything discovered afterwards is a
seam/lifecycle/contract gap the suites don't reach, not broken logic — say so in synthesis.

## 4. Finding conventions

- IDs `A1..An`, severity `blocker/high/medium/low/nit`, confidence **"confirmed by
  reading/running"** vs **"suspected from reading"** (never conflate).
- Every finding carries: exact `file:line` location, *What's wrong*, a **concrete failure
  scenario** (inputs/state → wrong output), and a *Cross-ref* (D/C/B entry or related
  finding). No failure scenario you can state = probably not a finding.
- Deliberate-looking code that contradicts nothing documented but needs human confirmation
  goes under **"Not bugs — by design (verify with human)"**, not the findings table.
- Where to look first: `references/finding-hotspots.md` — the four clusters that produced
  nearly all medium findings in the proven run.

## 5. AU9 — synthesis (always last)

Dedup the register, tally severities, write: top-5 concerns (ranked), cross-cutting
observations (name the *pattern*, cite the finding IDs), and the coverage-gaps list with
what infra each gap would take. Update the phase-run memory file with a one-paragraph
audit outcome + register path. The register then becomes the input worklist for a fix run
under **orchestrate-build-run** (findings marked by-design in an accepted decision are
skipped there, not re-decided).
