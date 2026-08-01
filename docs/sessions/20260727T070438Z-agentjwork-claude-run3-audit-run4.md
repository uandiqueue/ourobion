---
title: Independent adversarial audit of Run 3, and Run 4 candidate scope
summary: Record-only audit found Run 3 is not built (only U0/O24 exists, as an unmerged PR). Two blockers — CI is not required on any working branch, and U0's exact-SHA evidence is stale — plus six high findings. Created docs/temp/run4/ holding the findings register, six preconditions, ten new items O31-O40, and the 41 register rows Run 3 does not cover.
type: session
scope: shared
status: canonical
updated: 2026-07-27
---

# Independent adversarial audit of Run 3, and Run 4 candidate scope

Issue: [#147](https://github.com/uandiqueue/ourobion/issues/147)
Branch/worktree: `docs/run3-audit-run4-147` in `C:\project\ourobion-audit-147`
Task claim: `run3-audit-and-run4` / `claude` / `agentjwork`

Requested as an **independent adversarial check**, explicitly because Jayden is not reviewing code
directly. Record-only for existing code: findings are recorded, nothing was fixed. The Run 4 docs are
the only new authored artifacts.

## Attempted

- Followed the record-only-audit protocol: issue, task claim, isolated worktree cut from
  `dev-phase2-run3`, findings recorded as found.
- **Corrected the premise before doing the work.** The request assumed Run 3 was built by codex. It is
  not: `dev-phase2-run3` carries planning docs plus the model-training workstream, and none of O24–O29
  has merged. Adapted scope to what exists — the one implemented unit, the plan itself, and the
  register's coverage claims.
- **Corrected the scope a second time.** Run 3 is six units, U0–U5 = O24–O29. There is no O30 and no
  U6; that version exists only in the frozen Run-2 snapshot. I had stated "seven units, O24–O30" twice
  from a superseded README revision before the subagents caught it.
- Three parallel read-only analyses: adversarial review of PR #144, coverage analysis of the pending
  register against Run 3's scope, and a quality audit of the Run-3 plan.
- Verified findings independently where cheap — branch-protection state, the merge conflict, the cap
  arithmetic — rather than relying on agent reports.
- Did not enter or modify `C:\project\ourobion-run3-u0-143` or `C:\project\ourobion-review-146`;
  other agents are active in both.

## Changed

- Added `docs/temp/run4/run3-audit-findings.md` — findings register A1–A21 with severity, location and
  confidence, plus "not bugs — by design", coverage gaps, and synthesis.
- Added `docs/temp/run4/next-build-optimizations.md` — preconditions P1–P6, new items O31–O40, and the
  carried-forward register (41 rows + 5 schema gaps), with an ID-hygiene section.
- Added `docs/temp/run4/README.md` — cockpit and entry state.
- Posted the full adversarial review as a comment on PR #144, and a post-merge damage note on PR #145.

## Decided

- **Do not merge PR #144.** Jayden authorised merging into `dev-phase2-run3` "after verification";
  verification failed. Two blockers and two high findings, all reproduced by running commands.
- **Run 4 does not duplicate O24–O29** while Run 3 is live. If Run 3 is cut short, its unbuilt items
  return to the pending register per Run 3's own rule and become Run 4 candidates then.
- **Run 4 numbering starts at O31.** `O30` is dead in `docs/temp/` and live in the archive; reusing it
  would be ambiguous.
- **Original register IDs are preserved, not renumbered**, so the trail back to Runs 1 and 2 survives —
  with an explicit warning that `B1`–`B13` is two colliding namespaces and that §I's "56 unique IDs"
  self-audit is wrong (there are 58).
- Run 4's emphasis is **mechanical enforcement, not features**, because every blocker and most highs
  are the same pattern: a stated invariant with no machine behind it.

## Findings — the two blockers

1. **CI is not required on any working branch.** `dev-phase2-run3` and `dev-phase2` are both
   `protected: false`; the only ruleset is on `main` and contains `deletion`, `non_fast_forward`,
   `pull_request` — no `required_status_checks`. Any PR can merge with all 15 jobs red. `ci.yml:3` and
   `AGENTS.md:356` both call CI "the non-bypassable backstop"; that is false today. Since Jayden does
   not review code, the stated safety model is running on one leg. Recorded as precondition P1 — it is
   a settings change, not a build.
2. **U0's exact-SHA evidence is stale and its landing state has never been tested.** The evidence run
   was green on a synthetic merge whose base has since moved three commits; GitHub cannot recompute
   `refs/pull/144/merge` while conflicted, so the evidence looks green indefinitely. The conflicted
   file is the workflow under test.

Also high: the "assert exact checked SHA" step has no reachable failure path (`test X = X` after
`checkout` with no `ref`); the Deno coverage guard fails **open** on TOML-legal
`[functions.x] # comment` and `[functions."x"]` forms, proven by executing the branch's own tool; the
cap baseline is blown; B8 blocks 60% of the tranche; O29's central clause is unexecutable; and the
declared caps are 1.7–2.1× under the remaining scope.

## My own error, recorded

**The MT0 merge (PR #145) was mine and it damaged Run 3.** It added 59 files / 5,362 insertions after
the recorded cap baseline — ~69% of both caps — on work Run 3 declares out of scope, and it changed
`.github/workflows/ci.yml` +111/−3 including the `on:` triggers, which is the exact artifact O24 owns.
That is the cause of PR #144's conflict and of its stale evidence. Five more model-training PRs are
currently aimed at the same branch, so it will recur without precondition P3 (a separate integration
base). Noted on #145 and in the audit as A3.

## Left

- P1–P6 are all Jayden's or the orchestrator's, and P1/P2/P6 block Run 3 continuing, not just Run 4.
- The highest-value unexercised check before any #144 rework: whether the Supabase CLI tolerates the
  new `"lock"` key in files it parses as import maps. It touches production config on four functions
  with zero automated coverage.
- Classic branch protection on `main` could not be read (non-admin token), so a legacy protection
  object there cannot be ruled out. `dev-phase2-run3` is confirmed unprotected.
- Run 4 is candidate scope. Nothing is locked or sequenced.

## Blockers

- PR #144 should not merge until the two blockers are addressed and a fresh cumulative run exists.
- No code was changed, no gate was bypassed, no unit was signed off.

memory: none
