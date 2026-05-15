# AGENT-PROTOCOL.md — AI Agent Navigation Protocol
> **CONSTANT LAYER** — Changes only at phase transitions or full team agreement.
> Last updated: Phase 1 Stage 1 (MVP)
> Written for: AI agents (Claude Code sessions, automated reviewers)

---

## How to Use This File

If you are an AI agent starting work on this repo, read in this order:
1. This file — orientation and routing
2. `docs/workspace-context.md` — current team state (what was done last session, what is next)
3. The specific files indicated in the routing table for your task

Do not read every context file. Read only what your task requires.

---

## Reading Routing Table

| Task | Files to read |
|---|---|
| Starting any session | `docs/workspace-context.md` → `[team-state]` + `[phase-status]` sections |
| Working on M1 | `src/lib/modules/m1_core/m1-context.md` + `docs/ARCHITECTURE-CONTEXT.md` |
| Working on M2 | `src/lib/modules/m2_self_report/m2-context.md` + `shared/SHARED-CONTEXT.md` |
| Touching `shared/types/` | `shared/SHARED-CONTEXT.md` — requires 2-reviewer PR |
| Writing user-facing strings | `shared/constants/copy_guidelines.ts` + `shared/constants/copy_guidelines.dart` |
| Reviewing a PR | This file `§ PR Review Checklist` + module context for the PR scope |
| CI or workflow changes | `docs/STRUCTURE-CONTEXT.md` |
| Phase transition work | `docs/ARCHITECTURE-CONTEXT.md` + `docs/PROJECT-CONTEXT.md` |
| Understanding data shapes | `shared/SHARED-CONTEXT.md` |
| Understanding project goals and principles | `docs/PROJECT-CONTEXT.md` |

---

## Truth Hierarchy

When files appear to contradict each other, trust in this order:

1. `docs/workspace-context.md` — most recent session state
2. `src/lib/modules/m*/m*-context.md` — module-level state (may lag workspace-context)
3. `shared/SHARED-CONTEXT.md` — shared types (locked contract, authoritative for interfaces)
4. `docs/ARCHITECTURE-CONTEXT.md` — system structure
5. `docs/PROJECT-CONTEXT.md` — product principles (most stable, least likely to change)

Module context files (`m1-context.md`, `m2-context.md`) can fall behind `workspace-context.md` between sessions. Always check `workspace-context.md → [change-log]` for work done since the module file was last updated before assuming module context reflects current state.

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
- `region` field must be present on all daily row types (required for future M7 aggregation at query time)

**Session rules:**
- `docs/workspace-context.md` must be updated at the end of every session
- One commit per session — batch all changes
- `flutter analyze` must pass with no issues before committing

---

## PR Review Checklist

Used when reviewing a PR. Each item is pass / fail / not-applicable.

**Scope**
- [ ] PR targets `dev-mvp1`, not `main`
- [ ] Changes are within current phase scope (Phase 1 Stage 1 — see `docs/PROJECT-CONTEXT.md § Current Scope`)
- [ ] No deferred module work (M3, M4, M7) has been activated without a phase decision

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
- [ ] `docs/workspace-context.md` diff is present (session was logged)
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

**PR destination:** Always `dev-mvp1`
**Merge to `main`:** Only at milestone completions — both team members must approve

**Commit format:** `type(scope): subject` — full spec in `docs/commit-conventions.md`

---

## Module Status (Phase 1 Stage 1)

| Module | Status | Owner |
|---|---|---|
| M1 Core & Compliance | In Progress | Jayden |
| M2 Self-Report | In Progress | Alton |
| M5a Baselines & Pipeline | Pending | TBD |
| M5b Insight Engine | Pending | TBD |
| M6 Engagement | Pending | TBD |
| M3 Passive Health | Deferred — Phase 1 Stage 2 | TBD |
| M4 Environmental | Deferred — Phase 1 Stage 3 | TBD |
| M7 Community | Dormant — Phase 3 | TBD |

For detailed per-module state, read the respective `m*-context.md` and cross-check with `docs/workspace-context.md → [change-log]`.
