# agent-protocol.md — AI Agent Navigation Protocol
> **CONSTANT LAYER** — Changes only at phase transitions or full team agreement.
> Written for: AI agents (Claude Code sessions, automated reviewers)
>
> **[`AGENTS.md`](../../AGENTS.md) is the cross-tool single source of truth.** This file is the detailed
> AI **routing table + truth hierarchy + PR review checklist** that AGENTS.md §3/§7 point to. The
> variable layer (what happened / what's next) lives in append-only `docs/sessions/` logs +
> `docs/memory/` facts (see AGENTS.md §7).

---

## How to Use This File

If you are an AI agent starting work on this repo, read in this order:
1. [`AGENTS.md`](../../AGENTS.md) — the single source of truth (architecture, commands, protocol)
2. This file — orientation and routing
3. The latest few `docs/sessions/` files (run `node tools/context_sync.mjs --session-start`) —
   current team state: what was done last session, what is next
4. The specific files indicated in the routing table for your task

Do not read every context file. Read only what your task requires.

---

## Reading Routing Table

| Task | Files to read |
|---|---|
| Starting any session | `node tools/context_sync.mjs --session-start`, then the latest `docs/sessions/` files + `AGENTS.md` §6 (phase + workstreams) + `docs/phase-2-plan.md` |
| Working on M1 | `apps/biotope/lib/modules/m1_core/m1-context.md` + `docs/biotope/architecture-context.md` |
| Working on M2 | `apps/biotope/lib/modules/m2_self_report/m2-context.md` + `shared/SHARED-CONTEXT.md` |
| Touching `shared/types/` | `shared/SHARED-CONTEXT.md` — requires 2-reviewer PR |
| Writing user-facing strings | `shared/constants/copy_guidelines.ts` + `shared/constants/copy_guidelines.dart` |
| Reviewing a PR | This file `§ PR Review Checklist` + module context for the PR scope |
| CI or workflow changes | `docs/structure-context.md` |
| Phase transition work | `docs/biotope/architecture-context.md` + `docs/project-context.md` |
| Understanding data shapes | `shared/SHARED-CONTEXT.md` |
| Understanding project goals and principles | `docs/project-context.md` |

---

## Truth Hierarchy

When files appear to contradict each other, trust in this order:

1. The latest `docs/sessions/` files + `docs/memory/` facts — most recent session state and durable decisions
2. `apps/biotope/lib/modules/m*/m*-context.md` — module-level state (may lag the latest session)
3. `shared/SHARED-CONTEXT.md` — shared types (locked contract, authoritative for interfaces)
4. `docs/biotope/architecture-context.md` — system structure
5. `docs/project-context.md` — product principles (most stable, least likely to change)

Module context files (`m1-context.md`, `m2-context.md`) can fall behind the newest `docs/sessions/`
entry between sessions. Always read the most recent `docs/sessions/` files for work done since the
module file was last updated before assuming module context reflects current state.

---

## Non-Negotiables

Check every one of these before finishing any session or review. No exceptions.

**Copy rules — any user-facing string:**
- Never use: `diagnosed`, `condition`, `disease`, `illness`, `treatment`, `symptom` (as label), `alert`, `warning`
- Always use: `pattern`, `signal`, `observation`, `your data shows`, `you may notice`
- Severity labels allowed: `info`, `notice`, `watch` only
- For any `InsightCard` body text: call `M1.validateCopyString()` before persisting

**Module boundary rules:**
- No module imports from another module's `/impl` directory — public `index` exports only
- Only M2 writes to `daily_gut_rows` — all other modules read only
- M6 never reads `insight_cards` table directly — it only responds to `InsightFiredEvent`
- All modules use M1's public interface for auth and copy enforcement

**Shared type rules:**
- Any change to `shared/types/` requires a PR with 2 human reviewers
- Add optional fields with defaults — never remove or rename without a migration plan
- `region` field must be present on all daily row types (required for M7 community aggregation at query time)

**Session rules:**
- Write exactly one `docs/sessions/<UTC-timestamp>-<device>-<agent>-<slug>.md` log per session
  (Attempted / Changed / Decided / Left / Blockers) — **enforced** by `context_sync --check` (pre-push + CI)
- One issue + branch + git worktree per session (AGENTS.md §7); use `tools/setup_agent_worktree.mjs`
- `flutter analyze` must pass with no issues before committing

---

## PR Review Checklist

Used when reviewing a PR. Each item is pass / fail / not-applicable.

**Scope**
- [ ] PR targets `dev-phase2` (the single integration branch), not `main`
- [ ] Changes are within current phase scope (Phase 2 — see [`docs/phase-2-plan.md`](phase-2-plan.md))
- [ ] Work maps to a Phase 2 workstream/track in `phase-2-plan.md` (not pulled forward from Phase 3)

**Code quality**
- [ ] No imports from another module's `/impl` directory
- [ ] No direct writes to `daily_gut_rows` from outside M2
- [ ] CI analyze job passes (green ✓ on PR)

**Data integrity**
- [ ] No shared type fields removed or renamed without a migration note
- [ ] Any new daily row type includes `region` field
- [ ] `symptom_flags` treated as presence-only — absence not inferred

**Copy (check only if user-facing strings are in the diff)**
- [ ] No diagnostic language (see banned words above)
- [ ] Severity labels use `info` / `notice` / `watch` — not `alert` or `warning`

**Process**
- [ ] A `docs/sessions/` entry is present (session was logged — enforced by `context_sync --check`)
- [ ] If `shared/types/` changed: 2 reviewers required — flag if only 1 is assigned
- [ ] Commit message follows conventional commits format (`docs/commit-conventions.md`)

---

## Branch and PR Conventions

**Branch naming:**
```
feat/m{n}-{module-name}/{short-description}
fix/m{n}-{short-description}
docs/{short-description}
ci/{short-description}
refactor/m{n}-{short-description}
```

**PR destination:** Always `dev-phase2` (the integration branch)
**Merge to `main`:** Only `dev-phase2` merges to `main`, at phase/milestone completions — both team members must approve

**Commit format:** `type(scope): subject` — full spec in `docs/commit-conventions.md`

---

## Module Status

The live phase timeline + per-module status and ownership are maintained in **[`AGENTS.md`](../../AGENTS.md) §6**
(kept in one place to avoid drift). For detailed per-module state, read the respective `m*-context.md`
and cross-check with the latest `docs/sessions/` files.
