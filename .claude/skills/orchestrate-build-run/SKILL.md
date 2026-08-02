---
name: orchestrate-build-run
description: "Use when running an autonomous multi-unit build/fix run on this repo (a 'phase run') — orchestrator + subagent protocol, tracking docs, dispatch briefs, unit lifecycle, and recovery."
---

# Orchestrate a build run

The operating loop for an autonomous multi-unit run (the Phase-2 run is the proven
instance — see `references/phase2-run-example.md`). Member skills:
**stacked-pr-chain** (chain mechanics + reverse-cascade recovery),
**windows-toolchain-gotchas** (environment traps), **record-only-audit** (the
read-only audit run between build and fix phases), and **evidence-review-run** (the
record-only literature review of a run's decisions) — read them; this skill assumes them.

## 1. Roles

- **The orchestrator only orchestrates.** It never edits code itself — it keeps its own
  context lean for sequencing, decisions, and bookkeeping. All code changes go through
  dispatched build agents.
- **Exactly ONE writer subagent at a time** in the shared checkout. No worktrees on solo
  runs (Jayden's standing waiver of AGENTS.md §7 isolation — see memory + run decision D2);
  plain session branches suffice.
- **Read-only Explore agents may run in parallel** — assessment, triage, diagnosis fan out
  freely; only writes are serialized.

## 2. Startup checklist (fresh orchestrator session)

1. Activate the toolchain per shell: `. .\scripts\biotope-env.ps1` (see
   windows-toolchain-gotchas).
2. `node tools/context_sync.mjs --session-start`; read the latest `docs/sessions/` logs.
3. Read this run's tracking docs under `docs/development/<run-slug>-*.md` (naming convention in
   `references/tracking-docs.md`) — the **orchestration log is the resume point** (read
   top-to-bottom, then the blocked register, then continue at the first `next` unit).
4. **Verify git/chain state against the ledger** — branches, open PRs, and whether the
   integration branch REALLY contains what "merged" claims. Run
   `git log origin/<integration>..origin/<tip>`; a non-empty result after "all merged"
   means the reverse cascade happened — switch to the stacked-pr-chain skill's recovery.
5. Refresh the knowledge graph if stale (`graphify update .`).

## 3. Assessment before dispatch

Before any writer starts: fan out parallel read-only agents to map current state vs the
plan/spec (the Phase-2 run opened with 4 Explore agents). Product: a **verified baseline**
("already shipped — do not rebuild") plus a sequenced, batched unit worklist with a
dependency spine. Only then dispatch unit 1.

## 4. Unit lifecycle (every unit, no exceptions)

1. **Branch** cut from the current chain tip — or from `<integration-branch>` (the run's
   integration branch; Phase-2 used `dev-phase2`) when nothing is stacked.
2. **Build agent implements** from a dispatch brief
   (`references/dispatch-brief-template.md`).
3. **Full gate green before any PR**: `flutter analyze` + `flutter test` +
   `node tools/context_sync.mjs --check` + every touched package's own suite
   (`tsc --noEmit`, `npm test`, …). Behavior changes additionally need **live proof on the
   local stack** — SQL/HTTP evidence recorded in the session log, not claims.
4. **One commit** (conventional message + Co-Authored-By), session log in
   `docs/sessions/` with a `memory:` line.
5. **Push** (from activated PowerShell — the pre-push hook needs node), then
   `gh issue create` + `gh pr create` — stacked base rules per the stacked-pr-chain skill.
6. **NEVER merge** — merging is human-gated. Never touch `main`.
7. **Update the orchestration log** (worklist row status + notes, ledger row) in the same
   or next commit. The run must be resumable from the docs alone at any point.

## 5. Decisions and blockers

- **Never halt on a human-gated item.** Record it in the blocked register — where it
  stopped · what is needed · what it gates — skip it, and keep building what's unblocked.
- **Every non-trivial judgment call becomes a D-entry** in the sign-off decisions doc:
  choice, alternatives rejected, why. Amendments append (e.g. D1 AMENDED), never rewrite.
- **Numeric/config values** (thresholds, model ids, gates) get C-entries in the
  config-decisions doc: value shipped · alternatives considered · rationale; values live
  in config objects, never inline literals.
- Findings marked **by-design in an accepted decision are SKIPPED, not re-decided**
  (precedent in `references/phase2-run-example.md`).

## 6. Honesty invariants

- Interim/mock artifacts carry unmistakable provenance strings — e.g.
  `INTERIM:pending-real-<thing> (<why>, register B#)`,
  `MOCK:mock-router (NOT a real verifier verdict)` — and **never persist as truth-tier
  data** (gitignored/scratch dirs only, or clearly-marked DB fields).
- Report what **actually ran** vs what was only statically checked (the Phase-2 audit's
  whole coverage-gaps section exists because this distinction was kept).
- Prefer the honest end-state over demo shine — ship the weaker-but-true artifact with
  its interim marker rather than faking a verified one (worked example in
  `references/phase2-run-example.md`).

## 7. Dispatching a build agent

Every writer gets a self-contained brief — it must work for an agent with no memory of the
run. Anatomy and a filled sketch: `references/dispatch-brief-template.md`. The agent's
final message is orchestrator data: require a report format in the brief.
