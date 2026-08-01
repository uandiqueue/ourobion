---
id: "0008"
title: graphify is the semantic context tool; complementary to the deferred structural graph
summary: graphify indexes the repo into a gitignored machine graph plus one generated tracked human view; project-bounded tooling, incremental semantic refresh, and explicit exclusions keep it useful without replacing curated architecture or couplings.
type: memory
status: accepted
decided: 2026-07-13
updated: 2026-07-26
---

# 0008 — graphify is the semantic context tool; complementary to the deferred structural graph

ourobion uses **graphify** (github.com/safishamsi/graphify, PyPI `graphifyy`) — a semantic
knowledge-graph tool for AI assistants that indexes code/docs into a queryable `graph.json` and feeds an
agent only the relevant subgraph, to fight **context overload** and hold **ingestion-pipeline context**
for the analysis work.

**It is complementary to, NOT a replacement for,** the structural import-graph that
`docs/graph/README.md` marks **DEFERRED** (deferred because ourobion is Dart+TS+SQL and one import tool
sees only the TS half). graphify is semantic/multi-modal; the deferred graph is structural. A generated
graph is a rebuildable projection, never hand-edited ([0001-two-tier-truth](0001-two-tier-truth.md)).

## How it's set up

- **Project-bounded, never global.** graphify lives in a venv in the toolchain
  (`..\biotope-toolchain\graphify-venv`) — build tooling, not a repo/runtime dependency (machine-local,
  uncommitted, never deployed; same framing as the rest of the toolchain, AGENTS.md §4). It is on PATH
  after `. .\scripts\biotope-env.ps1`; rebuild the graph with `scripts/graphify-build.ps1` (bootstraps
  the venv on first run).
- **Output: repo-root `graphify-out/`, gitignored** (`graph.json` + `graph.html` + `semantic-graph.html`
  + AST cache + manifest) — a rebuildable projection. Promote `graph.json` to committed + add a regenerate/diff check
  to `tools/context_sync.mjs --check` once a path-normalizer (port NUSPlan's
  `tools/normalize_deps_graph.mjs`) makes it diff cleanly cross-machine. `graph.html` stays gitignored.
- **One tracked view, and it is Markdown.** `tools/graph-view/generate_graph_view.mjs` deterministically
  renders `docs/graph/semantic-graph.md` from `graph.json`. Markdown is the tracked format because
  `docs/graph/` travels across machines while all of `graphify-out/` is machine-local, so on a fresh
  clone this file is the only graph context an agent has — and an agent cannot read an HTML canvas. The
  interactive view is generated to gitignored `graphify-out/semantic-graph.html` instead, and the
  generator refuses to run if a `semantic-graph.*` file other than the Markdown appears in
  `docs/graph/`. The Graphify build wrappers refresh it; direct
  Graphify updates must be followed by `npm run graph:view:write`. Pre-push always enforces one
  generated view and, when a local graph exists, fails if its content is stale. CI can enforce the
  single-view invariant but skips only the machine-local content comparison.
- **No feedback/history pollution.** `.graphifyignore` excludes `docs/archive/` and the generated view
  itself. Archived provenance therefore cannot outrank active truth, and the projection cannot ingest
  its own prose.
- **Agent integration (pre-wired, committed):** PreToolUse hooks remind the agent to query the graph
  before grepping/reading source for **Claude Code** (`.claude/settings.json` + `CLAUDE.md` + a
  `/graphify` skill in `.claude/skills/graphify/`), **Codex** (`.codex/hooks.json` + `AGENTS.md`), and
  **Gemini CLI** (`.gemini/settings.json` + `GEMINI.md`). Any other tool: `graphify <tool> install`, or
  run the CLI manually. The committed hook/`graphify hook-check` path relies on `graphify` being on PATH
  (toolchain activated). AGENTS.md stays the single source of truth — its graphify lines are operational
  usage only.
- **Semantic pass:** AST extraction is local/no-key. The LLM semantic pass (cross-language inferred
  edges, concept merge, doc/PDF ingest, community naming) runs via **`/graphify .` in Claude Code**
  (session model, no key), or headless **`graphify extract --backend ollama`** (local) / `--backend
  claude|gemini` (that provider's key). It is *inferred/probabilistic* — `couplings.yaml` remains the
  enforced source for cross-language data contracts.
- **No API key.** AST extraction is fully local (tree-sitter). graphify's cross-language semantic pass
  normally wants `ANTHROPIC_API_KEY` (or Gemini/OpenAI), but invoked inside Claude Code it uses the
  **host session model** — so it runs on demand via the local agent, no separate key.
- **Incremental, not repeated full batches.** `graphify update .` refreshes cheap AST/source state.
  The assistant semantic pass should then process only manifest entries whose semantic hash is absent
  or invalidated. Running it at session close prevents a large backlog; a full semantic rebuild is
  reserved for extractor/schema changes, corruption, or an intentional reset.
- **What to index:** ourobion's own repo (agent context) and, separately, the research-paper corpus
  (ingestion context) once a paper arrives. **Never index NUSPlan** — it's a read-once reference and
  indexing it would pollute ourobion's graph.

## Dart coverage

AST-only indexing covers Dart well despite `tree-sitter-dart` not being a declared dependency: a full
repo index yields ~680 Dart / ~31 TS nodes with `calls`, `inherits`, `extends`, `mixes_in` (Dart
mixins), `implements`, `references`, and `imports` edges. Cross-language Dart↔TS concept merging is the
job of the semantic pass (host session model), not the AST pass. This is adequate for the
context-substrate role and confirms graphify does **not** substitute for the deferred structural
import-graph — it is the complementary semantic layer.

Plan: graphify is workstream W6 in `docs/phase-2-plan.md`. Related: [0007-rules-as-data-two-tier](0007-rules-as-data-two-tier.md).
