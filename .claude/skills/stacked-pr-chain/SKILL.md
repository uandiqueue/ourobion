---
name: stacked-pr-chain
description: "Use when building multiple dependent units while merging is human-gated, or when a stacked chain's PRs were merged but the base branch is missing their content. Run, merge, and recover stacked session-PR chains safely."
---

# Stacked PR chains — run, merge, recover

Part of the **orchestrate-build-run** skill set (see that skill for the full run loop).

Procedure for building a chain of dependent session branches when the agent cannot merge
(permission-gated `gh pr merge`) but downstream work can't wait for each merge. Covers the
correct merge procedure for the human, the failure mode to watch for, and the recovery path.
Cautionary example: this repo's Phase-2 run (see `references/phase2-reverse-cascade.md`).

## When to stack

- The merge is human-gated, but unit N+1 depends on unit N's code.
- Cut each session branch **from the previous session's tip** (not the integration branch).
- Open each PR with **base = its predecessor branch**, so every diff stays session-scoped
  and reviewable.
- Record the intended merge order in the PR bodies (e.g. "merge after #NN").
- Everything else stays per-session as usual: one issue, one branch, one PR, one session log.

## The merge procedure (human or merge-authorized agent)

Merge **bottom-up** (the PR whose base is the real integration branch first). After **every**
merge, click **"Delete branch"** — deleting the merged base branch is what makes GitHub
auto-retarget the next PR's base onto the real integration branch.

**RULE: never click merge unless the PR's base line shows the integration branch**
(e.g. `dev-phase2`). If it shows a sibling session branch instead, edit the base first —
or you are merging content into a branch nobody integrates.

**Alternative (2 clicks):** merge the bottom PR, then retarget the **tip** PR's base to the
integration branch and merge only it — each stacked branch contains all its predecessors,
so the tip carries the whole chain. Close the intermediate PRs (their content arrived via
the tip).

## The failure mode — reverse cascade

Merging each PR **as displayed** (base = parent branch), without branch deletions or
retargeting: every PR gets a "merged" badge, but each one merged **upward into its parent
branch**. All content pools in the stack's branches; the integration branch receives only
the bottom PR. It looks done. It isn't.

**Detection:**
- `git log origin/<integration>..origin/<tip-branch>` is **non-empty** after "all merged".
- Spot-check: files added by later units are absent on the integration branch.
- GitHub shows ascending merge timestamps with each PR's base = its parent branch,
  not the integration branch.

## Recovery

Do **NOT** rebase or cherry-pick — that rewrites already-reviewed history and detaches the
merged-PR record from the commits that land. Instead:

1. Open **one recovery PR**: head = the chain-tip branch (it contains everything),
   base = the integration branch. Merge that single PR.
2. Then delete the contained intermediate branches — after verifying containment:
   - `git branch -r --merged origin/<integration>` lists candidates;
   - `git cherry -v <integration> <branch>` — a branch that is only 1 merge-commit ahead
     with **zero `+` lines** from cherry is fully contained.

## Branch-cleanup safety

- Delete only verified-contained branches (both checks above).
- Locally use `git branch -d` (refuses non-merged), never `-D`.
- Keep any branch with real un-contained commits, however stale it looks.
