---
title: How Ourobion is built — development cycle and engineering practice
summary: The working method behind the project — AI-agent collaboration with machine-enforced context, session logs as an append-only record, executable cross-language contracts, the two-reviewer rule for shared contracts, and the CI gates that enforce all of it.
type: reference
scope: repo
status: canonical
updated: 2026-08-02
---

# How Ourobion is Built

This project demonstrates a development cycle built to handle AI coding agents alongside human builders, where no single tool or agent retains memory across sessions. The organising principle: **treat context as version-controlled**, enforce it in code, and let automation catch what drifts.

## Context as Version Control

Ourobion runs on AI agents (Claude Code sessions) that start with zero memory. Rather than rely on agent recall or tool-specific settings, the repo itself carries all durable context:

- **AGENTS.md** — the cross-tool single source of truth. It names every instruction, convention, module boundary, and phase gate. CLAUDE.md and GEMINI.md are ~20-line pointers to it. When guidance changes, it changes in one place.
- **docs/sessions/** — one append-only log per session (264 at the time of writing), timestamped and device-tagged, recording what attempted, changed, decided, and why. No shared mutable status files; parallel agents cannot collide.
- **docs/memory/** — numbered durable facts and gotchas, indexed, immutable once filed.
- **docs/development/decisions/** — numbered ADRs for cross-app architecture, indexed, immutable once accepted (new decisions supersede old ones).

Session logs matter because the *why* is unreconstructable from the diff. A future agent reading the git log sees `chore: bump Flutter version`, but only the session log says `needed for Health Connect parity on Android 14` or `discovered HealthKit SDNN unavailable on simulator, iOS-only`.

## One Source of Truth

**No guidance drifts between Claude Code, Codex, or future agents.** AGENTS.md is the authority for architecture, commands, protocol, and boundaries. Tool-specific setup files (`CLAUDE.md`, `GEMINI.md`) point to it. When a subagent or human reads tool-local settings, they find "see AGENTS.md §X" — a thin redirection, never duplication.

Result: updating protocol happens once. A bot could auto-sync the tool files, but humans don't need to remember which file lives where.

## Machine-Enforced Context

**`tools/context_sync.mjs`** runs as a pre-push hook (skippable) and in CI (non-bypassable). It enforces:

1. **Session coverage** — every push carries a `docs/sessions/` log with a `memory:` line
2. **Memory index integrity** — every memory file is indexed in `docs/memory/README.md`
3. **Couplings exist** — every `docs/graph/couplings.yaml` guard test file exists on disk
4. **Front-matter valid** — memory and decision records carry correct id/title/status/updated headers
5. **Supersede chains resolve** — if status is `superseded`, a `superseded_by` link exists with no cycles
6. **Index freshness** — generated sections in `docs/INDEX.md` and memory/decision readmes match what `--fix-index` would produce
7. **Edit honesty** — edited files bump `updated:`; accepted decisions are immutable (supersede instead)
8. **Session memory delta** — if the push changes memory or decisions, the session logs must declare a `memory:` line
9. **Active doc coverage** — every active doc (under `docs/implemented`, `docs/development`, `docs/hackathon`) is linked in `docs/INDEX.md`
10. **Archive containment** — no active doc links into `docs/archive/` (links flow archive → active only)

If any check fails, the push is blocked. Documentation rot fails a gate, not discovered months later.

## Executable Cross-Language Contracts

The system is Dart (mobile) + TypeScript (backend) + SQL. Contracts crossing the boundary live in `shared/`:

- `shared/types/` — the interface every API and database operation honors
- `shared/brain/` — the relationship graph structure (TS and Dart both implement)
- `shared/metrics/` — the metrics registry used by baselines and insights

**The two-reviewer rule:** any change to a `shared/` type requires two human reviewers. Fields are added optional-with-default. Nothing is removed or renamed without a migration plan. The coupling enforcement layer is **guard tests**: a test in `apps/biotope/test/guards/` declares that a Dart model's fields match a TypeScript contract's fields and a Postgres column's type. If they drift, `flutter test` fails.

Result: Dart↔TypeScript skew reaches a test failure, not production.

This has real teeth: PR #199 touched nine `shared/` files and was blocked because "no agent can supply them; Jayden and Alton must both be recorded as reviewers. Test evidence does not substitute for review" (`session: 20260728`). The rule forces human eyes on shared contracts before they ship.

## Two-Tier Truth

The repo treats data into two tiers:

**TRUTH** (git-tracked, user-authored, unreconstructable):
- Supabase migrations (`supabase/migrations/`)
- Raw logged rows (`daily_gut_rows`, `antibiotic_courses`, later wearable/env rows)
- Shared contract types (`shared/`)

**DERIVED PROJECTION** (rebuildable, never hand-edited):
- `baseline_snapshots` — recomputed by edge functions
- `insight_cards` — regenerated by the insight pipeline
- The knowledge graph (AST and semantic) — rebuilt from source

To change a derived value, fix the input and re-run the pipeline. Never hand-edit a projection; the next job run overwrites it. This makes the system auditable: there is one source per derived output, and it is traceable.

## Semantic Context Graph

**graphify** indexes the repo into a queryable semantic graph so an agent can pull a relevant subgraph instead of grepping the whole tree. It is built locally (AST only, no LLM, no network), machine-local, and gitignored. A single **tracked Markdown view** (`docs/graph/semantic-graph.md`) is version-controlled so an agent on a fresh clone has orientation even if the interactive graph is absent.

An interactive HTML view (`graphify-out/semantic-graph.html`) is generated for humans but never shown to agents — it is a ~1.3MB blob of embedded JSON and minified JS.

The structural import graph (Dart + TypeScript + SQL) is intentionally **deferred** because no single tool spans all three. When boundaries are worth auto-enforcing, it will be generated per side, merged, and treated as a rebuildable projection (never hand-edited).

## Issue and PR Coordination

Work is isolated by **session**: one GitHub issue + one branch + one git worktree per session. Parallel agents on the same device never share mutable files. Agents coordinate through GitHub issues and PR comments using **Conventional Commits** (type/scope/subject format). PRs target `main`, which is the single integration line. (Through Run 4 an intermediate `dev-phase2-run4` branch sat between session branches and `main`; it was promoted into `main` and deleted, so older session logs describing that two-tier flow are records of what was true then.)

The hard lesson: three agents writing the same branch caused one agent's worktree to go "stale within the hour", causing it to report a file absent that actually existed (`session: 20260727`). The rule that came out of it: **read-only subagents may run in parallel; writers must run strictly serial**. Concurrent writers in one worktree corrupt each other. Fetch before touching shared planning docs, not just at session start.

## CI Gates

Every push and PR runs the CI pipeline. Ten of its jobs are the day-to-day gates (the workflow defines thirteen in total, the remainder being release-evidence jobs that run conditionally):

1. **context** — session coverage, memory integrity, couplings, front-matter, index freshness, archive containment
2. **flutter** — `flutter analyze` + `flutter test`
3. **typescript** — `tsc --noEmit` over shared contracts
4. **node-tools** (matrix) — six packages (brain-ingest, llm-router, rules, edge-loader, engine-stats, metric-view): npm ci, typecheck, test, and drift guards
5. **nao** — typecheck + node:test suites (no build — needs Cloudflare bindings)
6. **deno-check** — four edge functions (compute-baselines, generate-insights, run-pipeline, evaluate-signals)
7. **migrations-apply** — shadow-apply all supabase migrations in order against vanilla postgres:17
8. **model-training** — core (stdlib-only unit tests) + lint/format/type-check (ruff + mypy)
9. **arch-boundaries** — module /impl guard + model-training isolation
10. **secret-scan** — gitleaks history + working tree, client-surface leak guard

A **run-4 gate** aggregates: if any stage fails, the PR is red and cannot merge. The run4 release gate adds provenance checks and frozen-graph attestation for phase completions.

The gates catch what humans miss. Two concurrent budget-ledger writers could lose one call's accounting (last-write-wins); both ledgers now merge element-wise on every write, with the hard stop firing on merged totals (`session: 20260718`). Attestation proved its value when a regenerated graph differed from the recorded one by exactly two lines—both under one function, with every other hash byte-identical—independent evidence that only that function changed (`session: 20260728`).

## The Cycle

1. Open issue (`gh issue create`)
2. Create branch in isolated worktree (`node tools/setup_agent_worktree.mjs`)
3. Code inside the worktree
4. Stage, commit with Conventional Commits, and write a session log (`docs/sessions/`)
5. Push — pre-push hook runs `context_sync.mjs --check`
6. CI runs automatically, shows results on the PR
7. PR review (two reviewers for shared changes)
8. Merge into `main`

The session log and the issue summary are the durable record. The diff is searchable; the *why* is in the log.

## Where the process caught us

The mechanisms above are only worth describing if they actually catch things. They do, and the record
is kept separately: **[What we got wrong, and what caught it](development/what-we-got-wrong.md)** — a
running list of reversed decisions, disproved assumptions and defects caught before shipping,
organised by *the mechanism that caught each*, with a session-log citation for every entry.

Two examples give the flavour.

A design document stated that the CORE API allowed "1000 tokens/day, hard-stop 950", and the rate
limiter was built to match. On the first real ingestion run, the live `X-RateLimit-*` headers showed
the truth — roughly a ten-request bucket refilling after sixty seconds. The documented model was
invented. It had been written confidently, propagated into code, and survived review, because nobody
had asked the API (`session: 20260703`).

A request to ship a hand-rolled implementation of the xDF effective-sample-size method was refused by
a deliberate throw rather than an approximation: *"must not ship unverified"*. An approximate version
would have produced confident-looking statistics with nothing behind them (`session: 20260719`).

Read down that document's headings — live verification, independent review, literature, automated
gates, humans — and you are reading the defence in depth. Each layer catches a different class of
error and none catches all of them.

## Scale and Cadence

The system operates at a measurable scale: 264 session logs spanning 2026-06 to 2026-08-02; roughly 32 in June, 194 in July, 38 in the first two days of August. Multiple distinct agent identities appear (`uandiqueue-claude`, `uandiqueue-codex`, `agentjwork-claude`, `agentjwork-codex`, `agent-j-claude`), plus occasional collaborator machines. One build was orchestrated across many parallel agents producing 22 source files, 24 test files, and 22 fixtures. The session log itself is the append-only ledger of what each agent attempted, changed, decided, and why.

---

**Craft is in the constraints.** These tools and rules exist because working with memory-free AI agents required them. The result is a repo where context never silently rots, contracts are enforced across languages, decisions are recorded and indexed, and the next agent (or the next human) can resume without guessing.
