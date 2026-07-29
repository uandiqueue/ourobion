---
title: Run 4 #229 review deviation and #215 retention record
summary: Recorded the owner-authorized shared-metric review exception for #229 and corrected the stale instruction to close #215, which remains live for R2 and licence follow-on work.
type: session
scope: run4
status: canonical
updated: 2026-07-29
---

# Run 4 #229 review deviation and #215 retention record

## Attempted

- Create an isolated #229 documentation worktree from the preserved local
  `feat/m5/u6a-projection-scaffold` head and record the two owner decisions without changing product
  code or GitHub issue state.
- Prepare the documentation commit locally only; #229 is intentionally not pushed in this session.

## Changed

- Appended `D-229-REVIEW-DEVIATION` to `docs/temp/run4/decisions-signoff.md`, including the Alton
  GitHub review permalink and the distinction between `COMMENTED` intent and a formal approval.
- Appended `D-215-ISSUE-RETENTION` to correct the stale close instruction: #215 remains open for
  private-R2 upload/pointer replacement and licence-blocked distribution.
- Bumped the decision register's front-matter `updated` date to 2026-07-29.

## Decided

- The owner-authorized exception for #229 is specific and documented; it does not change the normal
  two-reviewer rule in memory 0002.
- #215 must remain open until its live follow-on work is complete, regardless of PR #216 being merged.

## Left

- #229 is not pushed, merged, or otherwise changed remotely by this session.
- The stacked PR for `feat/brain/run4-u3-trust-plumbing` is an orchestration action after this local
  documentation commit; provider, Docker, deployment, and model-training actions remain out of scope.

## Blockers

- None for this documentation record. The underlying private-R2 and licence work tracked by #215 is
  intentionally still pending.

memory: none
