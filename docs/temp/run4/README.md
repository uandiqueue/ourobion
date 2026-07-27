---
title: Run 4 — reviewed planning cockpit
summary: Entry point for the active Run 4 envelope after independent audit and Codex confirmation; U0 is locally authorized while full-suite and PR-CI evidence remain pending.
type: plan
scope: shared
status: canonical
updated: 2026-07-27
---

# Run 4 — reviewed planning cockpit

Run 4 is active under its accepted envelope. U0 is locally authorized on intentionally unprotected
`dev-phase2-run4`; `Run 4 Gate` is exact-current-SHA CI evidence only, not branch-setting enforcement.
Full-suite and PR-CI evidence remain pending. P2 still defers U4; P3 excludes training; P5/P6 keep the
run local-only with no provider calls and O29 deferred.

## Documents

| Document | Role |
|---|---|
| [`run3-audit-findings.md`](./run3-audit-findings.md) | The audit: 2 blockers, 6 high, 10 medium, 3 low. Record-only — nothing was fixed |
| [`next-build-optimizations.md`](./next-build-optimizations.md) | Reviewed scope: corrected preconditions P1–P7, O31–O40, and the five-unit maximum priority tranche |
| [`pending-build-register.md`](./pending-build-register.md) | Living gap superset promoted from Run 3; O24–O29 are unfinished candidates, not accepted work |
| [`orchestrator-prompt.md`](./orchestrator-prompt.md) | Governing Run 4 prompt for the active accepted envelope |

## Independent confirmation and sign-off

**Verdict: agree with Claude's Run 3 stop / do-not-merge conclusion, with corrections incorporated
into the Run 4 prompt.** Codex rechecked the audit on 2026-07-27 at local integration commit
`fef311f` and live GitHub state:

- `dev-phase2-run3` and `dev-phase2` were both unprotected with zero required status checks; the only
  active ruleset targeted `main` and contained no required-status-check rule.
- PR #144 remained open at head `5eebddd` against stale base `9b41f4a`; its 15 green checks were from
  2026-07-26, while the current integration base had advanced and locally produced a conflict in
  `.github/workflows/ci.yml`, the file under test.
- The MT0 merge changed 59 files and added 5,362 lines after the Run 3 candidate base, confirming that
  the recorded cap baseline and the actual landing state diverged materially.
- The proposed config guard's regex omits valid TOML section forms; its matrix check does not prove the
  job is enabled or that it checks the declared entrypoint.

Corrections applied before sign-off:

1. A prompt cannot waive AGENTS.md's two-reviewer rule for `shared/`; R4-U4 remains blocked until a
   second reviewer exists.
2. Run 4 uses a fresh immutable base and an explicitly defined **landing-delta** cap. It does not
   retroactively subtract unrelated merges from an old baseline.
3. Supabase deploy/lock behavior is treated as unproven until the pinned CLI bundle path is exercised;
   the prompt does not repeat the unsupported claim that deploy "never reads" the lock.
4. `TEST_MODE_LABEL` must cross the TS↔Dart seam through generation or a parity guard, not a direct
   cross-language import.
5. Run 4 preflights at most five priority units (R4-U0–R4-U4). O28/O29 and maintenance candidates are
   deferred by default instead of silently rolling sixteen items into one run.

Technical sign-off: **Codex / issue #150 / 2026-07-27.** This signs the prompt's safety and sequencing,
not the implementation, human decisions, hosted changes, provider calls, PR merges, or Run 4 start.

## Entry state — read this first

**Run 3 is closing without an accepted unit. None of O24–O29 merged.** The only implementation attempt
is U0/O24 in PR #144; do not merge it. Its useful intent must be rebuilt and tested on the fresh Run 4
base.

**Run 3 is six units, U0–U5 = O24–O29.** There is no O30 and no U6 — that version survives only in the
frozen Run-2 snapshot, which `AGENTS.md` forbids building from. Docs still saying "O24–O30" are stale.

## The three things that matter most

1. **CI is not required on any working branch.** Every branch is `protected: false`; the only ruleset
   is on `main` and has no `required_status_checks`. A PR into `dev-phase2-run3` can have all 15 jobs
   red and still merge. Since the owner does not review code, the stated safety model — CI plus review
   — is currently running on one leg. **Precondition P1**, and it costs minutes.
2. **Run 3's change budget and landing state diverged**, because MT0 added 59 files / 5,362 insertions
   after the candidate baseline and broke U0's evidence and mergeability. Run 4 starts from a fresh
   exact base; model training must not share its integration branch. **Preconditions P3 and P4.**
3. **O27 and O29 cannot complete as written today.** O27 requires a real second `shared/` reviewer;
   O29 requires a second provider posture and release inputs that do not exist. O27 stays gated and
   O29 is deferred by default. **Preconditions P2 and P6.**

## The pattern Run 4 should attack

Run 3's *honesty scaffolding* is genuinely good — explicit "not this item" sections, refusals to claim
production or scientific validation, honest pending markers rather than fake sign-offs. What is weak is
**mechanical enforcement**:

- caps are a hand-maintained markdown table (audit A3)
- module and language boundaries are prose with no linter (O35)
- the "exact SHA gate" is a tautology that cannot fail (A6)
- the Deno coverage guard fails **open** (A7)
- CI itself is advisory (A1)

Every one of those is a stated invariant with no machine behind it. O31–O40 are aimed at that theme
rather than at new features, which is the right emphasis for a codebase whose owner reviews outcomes
rather than diffs.

## How Run 4 relates to Run 3

O24–O29 are now preserved in the promoted register. Only O24–O27 appear in the recommended Run 4
priority tranche, and even those remain conditional on preflight. O28/O29 stay visible without being
silently authorized.

## Jayden's product brief and the exit gate

Two later additions sit on top of the reviewed tranche, both in
[`next-build-optimizations.md`](./next-build-optimizations.md):

- **§3b** reconciles Jayden's six product priorities with the signed five-unit tranche, which predates
  them and covers priorities 1, 2 and part of 6 only. It adds candidate units **R4-U5** (single-paper
  ingestion with LLM stand-ins), **R4-U6a/b/c** (biotope metrics) and **R4-U7** (UX revamp), and
  records that the **real Android device and live local nao** move `B-UI2`, `B-UI5`, `B-UI6`,
  `B-UI11`, the O28 TalkBack traversal and `B10(access)` from blocked to doable.
- **§3c** is the **exit gate**: after every locked unit completes, two local passes must both be green
  before anything is promoted to the cloud demo database. Pass 1 is API integrity via
  `scripts/demo-dryrun-run2.ps1`; pass 2 is a real-paper authoring run from
  `doi:10.1016/j.isci.2026.116224`.

The gate exists because the existing harness proves **API integrity, not end-to-end authoring** — it
runs from four hand-authored relationship fixtures and simulated Biotope data, so 21/21 green says
nothing about whether a newly ingested paper becomes a relationship. That gap is register row
**`B-PL22`**.

**No model training in Run 4.** It lives in [`../model-training/`](../model-training/) with its own
units, budget and gates; Run 4 may consume a frozen artifact but never waits on one.

All Run 4 issue, branch, PR, and merge operations target `dev-phase2-run4` only, never `dev-phase2` or
`main`.
