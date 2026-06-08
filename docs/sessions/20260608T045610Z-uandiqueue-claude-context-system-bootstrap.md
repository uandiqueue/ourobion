# Session 20260608T045610Z — uandiqueue — claude — context-system-bootstrap

> Session log format (use for every session): **Attempted / Changed / Decided / Left / Blockers**.
> A session's FIRST step is to read the latest few files in this directory to resume context, then run
> `node tools/context_sync.mjs --session-start`.

- **Device:** uandiqueue · **Agent:** Claude Code (claude-opus-4-8[1m]) · **Branch:** dev-alton
- **Goal:** Bootstrap an enforced, multi-agent context-management system in biotope, ported from the
  NUSPlan reference implementation and adapted to biotope's Flutter + Supabase stack (no Python).

## Attempted
Stand up the full context system: a single-source-of-truth `AGENTS.md`, append-only session logs,
durable memory, a Node enforcer (`context_sync.mjs`) + worktree/claim helpers, the pre-push +
SessionStart + CI wiring, and the deferred-graph + couplings layer — while harmonizing with (not
overwriting) biotope's existing CONSTANT-LAYER / VARIABLE-LAYER docs.

## Changed
- **`AGENTS.md`** (new) — single source of truth: points to the CONSTANT-LAYER docs (PROJECT /
  ARCHITECTURE / STRUCTURE / SHARED-CONTEXT, commit-conventions, ui-context); two-tier-truth for
  biotope (raw rows + migrations + shared contracts = truth; baselines/insights/engagement =
  rebuildable projections); environment & commands (Flutter + Supabase CLI + Node enforcer); migrated
  phase timeline + team workstreams; the full §7 collaboration protocol.
- **`CLAUDE.md` / `GEMINI.md`** (new) — thin pointers to AGENTS.md.
- **`tools/context_sync.mjs`** (new) — Node-stdlib port of NUSPlan's `context_sync.py`.
  `--session-start` briefing + `--check` (session coverage / memory-index integrity / couplings guard
  existence). The deps.json check was dropped (graph deferred).
- **`tools/setup_agent_worktree.mjs`, `tools/shared_memory.mjs`** (new) — Node ports of the worktree
  isolation + task-claim helpers.
- **`docs/sessions/`** (new) — this log + a historical backfill of the old `workspace-context.md`
  change log.
- **`docs/memory/`** (new) — 6 facts (two-tier truth, shared-contract 2-reviewers, non-diagnostic
  copy, HRV-SDNN iOS-only, pg_cron prereqs, wearable best-effort) + indexed README.
- **`docs/graph/`** (new) — `couplings.yaml` (3 TS/Dart/SQL data couplings, each naming a guard test)
  + `README.md` documenting why the structural graph is deferred and how to add it later.
- **`src/test/guards/`** (new) — 3 runnable, skipped guard-test placeholders the couplings name.
- **`.githooks/pre-push`** (new) — node-only: runs `context_sync.mjs --check`.
- **`.claude/settings.json`** (new) — SessionStart hook running the briefing (existing
  `settings.local.json` left untouched).
- **`.github/workflows/ci.yml`** — replaced the `echo "Hello, world!"` stub with a `verify` job:
  context check + `flutter analyze` + `flutter test` (fetch-depth 0 for session-coverage).
- **`package.json`** — added `context:start` / `context:check` scripts.
- **`docs/workspace-context.md`** — replaced body with a pointer explaining where its content went.
- **`.gitignore`** — ignore `.agents/` (machine-local claim state).

## Decided
- **Enforcer is Node, not Python** (locked) — `.mjs`, stdlib + `git` only.
- **Harmonize, not overwrite** — AGENTS.md points to the CONSTANT-LAYER docs; `workspace-context.md`'s
  durable content migrated, not deleted.
- **Structural auto-graph deferred** — curated ARCHITECTURE-CONTEXT graph + couplings.yaml are the
  enforced relationship layer for now; README documents the path to a real graph.
- **Guard tests live in `src/test/guards/`** (Flutter requires tests inside the `src/` package), run
  by `flutter test`; the repo-root `tests/` stays for out-of-app harnesses. All guards are honest
  `status: planned` placeholders (skipped) until their assertions land in P1S2.
- **Branch scheme kept** as biotope's `feat/m<n>-<area>/<slug>` (+ `dev-<name>` personal branches).

## Left
- Fill in the 3 guard tests' real assertions (P1S2).
- Add the Gemini CLI session-start hook equivalent when Gemini is adopted.
- Add a generated structural graph later per `docs/graph/README.md`.

## Blockers / notes
- **Toolchain not installed on this machine:** no `flutter`/`dart` and no usable `node` on PATH (only
  an Adobe-bundled `node` v18). So `flutter analyze` / `flutter test` could **not** be run locally this
  session — CI is the first place they execute. `context_sync.mjs --check` / `--session-start` were
  smoke-tested with the Adobe-bundled `node`.
- `.claude/settings.local.json` contains a machine-local auth token and is gitignored — left untouched.
