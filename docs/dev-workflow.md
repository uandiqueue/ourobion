# dev-workflow.md — Biotope Development Workflow
> **TEAM REFERENCE** — Written for Jayden and Alton. Human-readable, not AI context.
> Purpose: Explains the full development cycle, what AI handles, and what requires human judgment.

---

## The Cycle

```
Issue → Branch → Code → Commit → Push → CI → PR → Review → Merge
```

---

## Each Step

### 1. Issue
Someone identifies work — a bug, a feature, or a task. Open a GitHub Issue using the right template. Tag it to the relevant module (M1–M6).

| Who | What |
|---|---|
| AI can | Draft the description from a conversation or bug report. Suggest which module it belongs to. |
| Human must | Decide what to build and in what order. That is product judgment, not code. |

---

### 2. Branch
Create a branch off `dev-mvp1`. Name it following the convention below. Never work directly on `dev-mvp1`.

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

### 4. Commit
Batch all session work into a single commit. Follow the conventional commits format in `docs/commit-conventions.md`.

| Who | What |
|---|---|
| AI can | Draft the commit message from the diff. |
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
Open a PR from your branch into `dev-mvp1`. Use the PR template. Link the issue it closes.

**PR destination is always `dev-mvp1`. Never open a PR directly to `main`.**

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
Approved PR is merged into `dev-mvp1`.

| Who | What |
|---|---|
| Human must | Always. Merge is consequential and irreversible. Someone must own it. |

---

## Branch Model

```
main           ← always shippable; only receives PRs at milestone releases
  └── dev-mvp1 ← integration branch; all daily PRs target here
        ├── feat/m2-self-report/streak-counter
        ├── fix/m1-core/supabase-ip-env
        └── docs/update-workflow
```

`dev-mvp1 → main` only happens when a milestone is complete and both team members sign off on a release build.

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
4. `docs/workspace-context.md` updated with this session's work
5. Shared types changes (`shared/types/`) must have two reviewers assigned

---

## When `dev-mvp1` Merges to `main`

Only at milestone completions. Both team members must agree. Steps:
1. `dev-mvp1` is stable and CI-green
2. Both members review the milestone summary
3. Merge `dev-mvp1 → main`
4. Tag the release (e.g. `v0.1.0-mvp1`)
5. Update `docs/ARCHITECTURE-CONTEXT.md` phase status
