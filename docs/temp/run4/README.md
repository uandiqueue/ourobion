---
title: Run 4 — planning cockpit
summary: Entry point for Run 4, assembled from the 2026-07-27 independent adversarial audit of Run 3. Run 4 is candidate scope only; it holds six preconditions Run 3 cannot satisfy itself, ten new optimisation items O31-O40, and the 41 register rows plus 5 schema gaps Run 3 does not cover.
type: plan
scope: shared
status: draft
updated: 2026-07-27
---

# Run 4 — planning cockpit

Run 4 has **not** started and its scope is **not locked**. It exists because an independent audit of
Run 3 on 2026-07-27 (issue #147) found that most of the known backlog sits outside Run 3, and that
several of Run 3's own preconditions cannot be satisfied from inside Run 3.

## Documents

| Document | Role |
|---|---|
| [`run3-audit-findings.md`](./run3-audit-findings.md) | The audit: 2 blockers, 6 high, 10 medium, 3 low. Record-only — nothing was fixed |
| [`next-build-optimizations.md`](./next-build-optimizations.md) | Candidate scope: preconditions P1–P6, new items O31–O40, and the carried-forward register |

## Entry state — read this first

**Run 3 is not built.** `dev-phase2-run3` carries 18 commits: planning docs plus the model-training
workstream. **None of O24–O29 has merged.** The only Run-3 implementation is U0/O24, open as PR #144,
which this audit recommends **not** merging in its current form (two blockers).

**Run 3 is six units, U0–U5 = O24–O29.** There is no O30 and no U6 — that version survives only in the
frozen Run-2 snapshot, which `AGENTS.md` forbids building from. Docs still saying "O24–O30" are stale.

## The three things that matter most

1. **CI is not required on any working branch.** Every branch is `protected: false`; the only ruleset
   is on `main` and has no `required_status_checks`. A PR into `dev-phase2-run3` can have all 15 jobs
   red and still merge. Since the owner does not review code, the stated safety model — CI plus review
   — is currently running on one leg. **Precondition P1**, and it costs minutes.
2. **Run 3's change budget is already mostly spent**, by the MT0 merge (PR #145), which was mine. That
   merge added 59 files / 5,362 insertions after the recorded cap baseline, ~69% of both caps, on work
   the plan declares out of scope — and it broke U0's evidence and mergeability. Five more
   model-training PRs are currently aimed at the same branch. **Preconditions P3 and P4.**
3. **Two of the five remaining units cannot complete as written.** U3/U4/U5 wait on a `shared/`
   two-reviewer gate that has been unsatisfiable since Run 1 and is absent from the run's own
   human-decisions file; O29 requires a second provider family that is not provisioned, against caps
   allocated backwards for the only legal configuration. **Preconditions P2 and P6.**

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

Run 4 does **not** duplicate O24–O29 while Run 3 is live. If Run 3 is cut short — likely, since the
audit puts its remaining scope 1.7–2.1× over its file cap — its unbuilt items return to the pending
register per Run 3's own rule and become Run 4 candidates then.

Do not treat this folder as authorising work. Lock a subset first.
