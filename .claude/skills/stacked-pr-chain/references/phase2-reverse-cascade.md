# The Phase-2 reverse-cascade merge (2026-07-18) — the incident behind this skill

Primary records: `docs/temp/phase2-run-orchestration-log.md` (⚠ 2026-07-18 section),
`docs/temp/phase2-run-signoff-decisions.md` (D1 amended, D20),
`docs/sessions/20260718T033750Z-agentjwork-claude-chain-recovery-docs-move.md`.

## How the chain came to exist

The Phase-2 build run (2026-07-15 →) planned one PR per session, self-merged into
`dev-phase2` (decision D1). The permission system denied `gh pr merge` for agent-authored
PRs on day one, so D1 was amended the same day: a **stacked chain** — each session branch
cut from the previous session's tip, each PR based on its predecessor branch so the diff
stays session-scoped. 15 PRs (#43–#71, units U0–U13 + U18), every gate green at each step.

## What went wrong

The human merge went **upward, not downward**: each PR was merged as-displayed into its
stacked **parent branch**, with no branch deletions and no base retargeting. Result:

- All 15 PRs showed "merged" badges.
- Only #43 (the bottom PR) actually reached `dev-phase2` (commit `81b5827`).
- The full chain content — 28 commits, U1–U13 + U18 — accumulated on
  `origin/feat/shared/l6-one-card-slice` (`f442eac`, which received #71's merge).
  That branch was the true chain tip.

Detected exactly as the skill describes: `dev-phase2` lacked files that later units had
added, and `git log origin/dev-phase2..origin/feat/shared/l6-one-card-slice` was long.

## Recovery (decision D20)

- **One recovery PR — #72**: head `feat/shared/l6-one-card-slice`, base `dev-phase2`.
  No rebase / re-cherry-pick: that would rewrite reviewed history.
- Until #72 merged, **new units stacked on the chain tip** (cut from the R1 bookkeeping
  branch sitting on the tip), NOT from `dev-phase2` — which still lacked U1–U18. Register
  entry B13 tracked the merge; CI green on `dev-phase2` proved nothing until then.
- Intermediate branches were deleted only after containment verification.

## Lessons encoded in the skill

1. "Merged" badges are not integration — verify with `git log <integration>..<tip>`.
2. The base line on the merge page is the contract; never merge a PR whose base is a
   sibling branch.
3. Deleting the base branch after each merge is what triggers GitHub's auto-retarget;
   skipping deletion silently builds the reverse cascade.
4. Recovery is one tip-to-integration PR, not history surgery.
