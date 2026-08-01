---
session: 20260801T092733Z-agent-j-claude-run4-branch-refs-dev-phase2-run4
agent: agent-j (Claude, orchestrator-dispatched doc agent)
date: 2026-08-01
scope: AGENTS.md, docs/shared/dev-workflow.md
---

# Repo instructions pointed contributors at a dead branch

## What was wrong

The root contributor instructions told everyone to branch from and PR into `dev-phase2`. That branch has been dead since PR #115. Verified rather than assumed:

```
git merge-base origin/dev-phase2 origin/dev-phase2-run4  ->  e185cf0
origin/dev-phase2 tip                                    ->  e185cf0
```

`dev-phase2` is a strict abandoned ancestor of `dev-phase2-run4`. Anyone following `AGENTS.md` literally would branch off dead code and open a PR against a branch nobody merges. `apps/nao/README.md:68` already hardcoded `GH_ACTIONS_REF=dev-phase2-run4` — the app-level doc knew the truth while the root process doc did not.

Found by a documentation audit run for the hackathon submission (goal item 4, "repo instructions").

## What changed

Every **present-tense instruction** naming `dev-phase2` now names `dev-phase2-run4`:

- `AGENTS.md` — branch convention (:194), PR integration seam (:200-202), worktree step (:248-255), and the `gh pr create --base` example (:263-269).
- `docs/shared/dev-workflow.md` — :15, :44-48, :114-118, :137, the branch-model diagram at :147-157, and the "merges to main" section at :189-195.

Two `dev-phase2` mentions were **deliberately left in place**: `AGENTS.md:254` and `dev-workflow.md:46` describe `tools/setup_agent_worktree.mjs`'s own still-stale default, and exist to explain why the reader must now pass `--base dev-phase2-run4` explicitly. Rewriting those strings would misrepresent what the tool actually does.

## Known-remaining, not fixed here

`tools/setup_agent_worktree.mjs` still defaults its base to `dev-phase2` in four places (:10 comment, :39 help text, :67 `args.base || "dev-phase2"`, :73 comment). That file belongs to another session's territory in this run, so it was inspected and reported, not edited. The two docs route around it with an explicit `--base`; the root cause is still live and should be fixed by whoever owns `tools/**` next.

## Gates

- `node tools/context_sync.mjs --check` — passed.
- `git diff --check` — passed.

Docs-only. No provider calls, no code, no schema change.

memory: repo instructions named the dead `dev-phase2` branch for months while `apps/nao/README.md` already had the right one — when a process doc and a component doc disagree about infrastructure, the component doc is usually the fresher of the two.

Refs #336, #328
