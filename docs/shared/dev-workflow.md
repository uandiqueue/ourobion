# dev-workflow.md — Ourobion Development Workflow
> **TEAM REFERENCE** — Written for Jayden and Alton. Human-readable, not AI context.
> Purpose: Explains the full development cycle, what AI handles, and what requires human judgment.
>
> The cross-tool source of truth is [`AGENTS.md`](../../AGENTS.md); its §7 collaboration protocol is the
> authoritative version of this cycle. `dev-phase2` is the single working / integration branch all
> session PRs target; it is the only branch that PRs into `main`.

---

## The Cycle

```
Session start → Issue → Branch+Worktree → Code → Commit (+session log) → Push → CI → PR → Review → Merge
```

> **Session start (before anything):** run `node tools/context_sync.mjs --session-start` and read the
> latest `docs/sessions/` files to resume context.

---

## Each Step

### 1. Issue
Someone identifies work — a bug, a feature, or a task. Open a GitHub Issue using the right template. Tag it to the relevant module (M1–M6).

| Who | What |
|---|---|
| AI can | Draft the description from a conversation or bug report. Suggest which module it belongs to. |
| Human must | Decide what to build and in what order. That is product judgment, not code. |

---

### 2. Branch + Worktree
Create a branch off `dev-phase2` **in its own git worktree** so two agents on one device never collide
(`node tools/setup_agent_worktree.mjs --branch <name> --path <path>` — it cuts from `dev-phase2` by
default). Name it following the convention below. The branch is short-lived: it lives only until its PR
merges into `dev-phase2`. Never work directly on `dev-phase2`.

**Naming:**
```
feat/m{n}-{module}/{short-description}   e.g. feat/m2-self-report/streak-counter
fix/m{n}-{short-description}             e.g. fix/m1-core/supabase-ip-env
docs/{short-description}                 e.g. docs/agent-protocol
ci/{short-description}                   e.g. ci/add-flutter-analyze
```

| Who | What |
|---|---|
| AI can | Suggest the branch name from the issue title. |
| Human must | Create the branch and confirm the name is correct before pushing. |

---

### 3. Code
Write the implementation on your branch. Stay inside the module boundary you own.

| Who | What |
|---|---|
| AI can | Write the implementation (Claude Code). Draft tests. Suggest refactors. |
| Human must | Review what AI wrote before committing. You are accountable for what enters the repo. |

---

### 4. Commit (+ session log)
Batch the session's work into commits using the conventional commits format in
`docs/commit-conventions.md`. **Every session must add exactly one `docs/sessions/` log** (Attempted /
Changed / Decided / Left / Blockers) — the pre-push hook and CI fail without it.

| Who | What |
|---|---|
| AI can | Draft the commit message from the diff and write the `docs/sessions/` log. |
| Human must | Confirm the message is accurate and the right files are staged. |

---

### 5. Push
Push the branch to GitHub. If a PR is already open, CI will rerun automatically.

| Who | What |
|---|---|
| Human must | Decide when the branch is ready to push. |

---

### 6. CI — Continuous Integration
GitHub automatically runs checks on every push and on every PR. CI is the automated quality gate.

**What it checks (see `.github/workflows/ci.yml`):**
- context check — `node tools/context_sync.mjs --check` (a session log exists; memory index intact; couplings guards exist)
- `flutter analyze` — catches type errors and lint issues
- `flutter test` — runs the test suite
- TypeScript type check — validates shared types

If any step fails, the PR shows a red ✗ and cannot be merged until fixed.

| Who | What |
|---|---|
| AI can | Read the failure output and suggest a fix. |
| Human must | Fix the failure. CI does not fix itself. |

---

### 7. Pull Request
Open a PR from your branch into `dev-phase2`. Use the PR template. Link the issue it closes.

**PR destination is always `dev-phase2` (the integration line). Never open a PR directly to `main` —
only `dev-phase2` does, at phase/milestone completion.**

| Who | What |
|---|---|
| AI can | Draft the PR description from the diff. Run a prelim review (planned — checks module rules, copy, scope, common bugs) and post a summary as a PR comment before the human looks. |
| Human must | Open the PR. Write the final description. |

---

### 8. Review
A team member reads the diff and either approves or requests changes. For shared types (`shared/types/`), two reviewers are required — that is a hard convention.

| Who | What |
|---|---|
| AI can | (Planned) Post a prelim review summary catching mechanical issues so the human reviewer can focus on judgment. |
| Human must | Final approval. The reviewer is accountable for what merges. AI catches errors; humans judge correctness of approach, side effects, and product fit. |

---

### 9. Merge
Approved PR is merged into `dev-phase2`.

| Who | What |
|---|---|
| Human must | Always. Merge is consequential and irreversible. Someone must own it. |

---

## Branch Model

```
main             ← always shippable; only receives PRs from dev-phase2 at phase/milestone releases
  └── dev-phase2 ← the single working / integration branch; every session PR targets here
        ├── feat/m2-self-report/streak-counter   ← short-lived session branch; deleted after merge
        └── fix/m1-core/supabase-ip-env          ← short-lived session branch; deleted after merge
```

There are **no long-running personal branches** (`dev-<name>`). Each session cuts a fresh branch from
`dev-phase2`, opens a PR back into `dev-phase2`, and the branch is deleted once merged.

`dev-phase2 → main` only happens when a phase/milestone is complete and both team members sign off on a release build.

---

## AI vs Human — Quick Reference

| Step | AI does | Human must |
|---|---|---|
| Issue | Draft description, suggest module | Decide priority and scope |
| Branch | Suggest name | Create branch, confirm name |
| Code | Write implementation, suggest tests | Review before committing |
| Commit | Draft message | Confirm accuracy, confirm staged files |
| Push | — | Decide when ready |
| CI | Runs automatically | Fix failures |
| PR | Draft description; prelim review (planned) | Open PR, write description |
| Review | Prelim check — rules, bugs, scope (planned) | Final approval |
| Merge | — | Always human |

---

## Non-Negotiables Before Any PR

These are checked by CI and will eventually also be checked by the AI prelim reviewer. Do not wait for automation — check these yourself first.

1. `flutter analyze` passes with no issues
2. No imports from another module's `/impl` directory
3. All user-facing strings use non-diagnostic language (see `shared/constants/copy_guidelines.ts`)
4. A `docs/sessions/` log for this session is added (enforced by `node tools/context_sync.mjs --check`)
5. Shared types changes (`shared/types/`) must have two reviewers assigned

---

## When `dev-phase2` Merges to `main`

Only at phase/milestone completions. Both team members must agree. Steps:
1. `dev-phase2` is stable and CI-green
2. Both members review the milestone summary
3. Merge `dev-phase2 → main`
4. Tag the release (e.g. `v0.1.0-mvp1`)
5. Update `docs/biotope/ARCHITECTURE-CONTEXT.md` phase status
