# 0008 — graphify is the context tool; complementary to the deferred structural graph

**Decision (Phase 2 plan, 2026-06-09):** adopt **graphify** (github.com/safishamsi/graphify, PyPI
`graphifyy`) — a semantic knowledge-graph **skill for AI coding assistants** (turns code/docs/papers into
a queryable `graph.json`, feeds only relevant subgraphs to the model) — to manage agent **context
overload** and to hold **ingestion-pipeline context** for the analysis work.

**It is complementary to, NOT a replacement for,** the structural import-graph that
`docs/graph/README.md` marks **DEFERRED** (deferred because biotope is Dart+TS+SQL and one import tool
sees only the TS half). graphify is semantic/multi-modal; the deferred graph is structural. Both obey the
two-tier rule: a generated graph is a rebuildable projection, never hand-edited ([[0001-two-tier-truth]]).

## Status: ADOPTED (2026-06-17)

Installed and indexing (was "design-only, do not install yet" through 2026-06-16). Concrete adoption,
per the repo's conventions:

- **Project-bounded install, never global.** graphify (`graphifyy` 0.8.40) lives in a venv inside the
  toolchain (`..\biotope-toolchain\graphify-venv`) — build tooling, not a repo/runtime dependency:
  machine-local, uncommitted, never deployed (same framing as the rest of the toolchain, AGENTS.md §4).
  `scripts/graphify-build.ps1` bootstraps the venv on first run and rebuilds the graph.
- **Repo-consistent wiring — `graphify install` was NOT run.** Its native installer edits `CLAUDE.md`
  and registers a PreToolUse hook; that collides with this repo's rule that `CLAUDE.md` is a thin
  pointer and **all durable guidance lives in `AGENTS.md` alone**. So no skill/hook was registered;
  graphify usage is documented in `AGENTS.md` §8 + `docs/graph/README.md` instead.
- **Semantic pass needs no API key — the local agent drives it.** AST extraction is fully local
  (tree-sitter), no key. graphify's cross-language semantic pass normally needs `ANTHROPIC_API_KEY`
  (or Gemini/OpenAI), **but when invoked inside Claude Code it uses the host session's model** — so
  we run that pass on demand via the local agent, no separate key. (Confirmed against graphify docs.)
- **Index biotope's own repo** as the primary graph (agent context). Index the **research-paper corpus
  as a separate graph** (ingestion context) once a paper is provided. **Never index NUSPlan** (read-once
  reference — indexing pollutes biotope's graph).
- **Artifacts at repo-root `graphify-out/` (graph.json + graph.html + AST cache + manifest), gitignored.**
  This **supersedes the originally-planned `docs/graph/generated/` path**: graphify 0.8.40 hard-defaults
  to `graphify-out/` and its incremental `update`/`watch`/`query` all assume that location (`update` has
  no `--out`), so fighting it would break the incremental workflow. Stays gitignored until a
  path-normalizer (port NUSPlan's `tools/normalize_deps_graph.mjs`) makes `graph.json` diff cleanly across
  machines — then promote `graph.json` to committed + add a regenerate/diff check to
  `tools/context_sync.mjs --check`. `graph.html` stays gitignored (heavy, regenerable).

**Dart coverage — re-verified on adoption (2026-06-17, `graphifyy` 0.8.40, full repo index):** the
AST-only path (`graphify update . --no-cluster`, local, no LLM) indexed **153 files → 1445 nodes / 1513
edges**, of which **680 Dart nodes / 31 TS nodes**. Unlike the original probe (0.1.14, which got Dart
**structure but no `calls` edges**), 0.8.40 now emits Dart **call/relationship edges** — the graph
includes `calls` (70), `inherits`, `extends`, `mixes_in` (Dart mixins), `implements`, `references`,
`imports`. `tree-sitter-dart` is still not a declared dependency, yet Dart parses fine. Cross-language
Dart↔TS concept merging still belongs to the semantic-LLM pass (now run via the local agent, above), not
the AST pass. This is adequate for graphify's context-substrate role and **confirms graphify does NOT
substitute for the deferred structural import-graph** — it is the complementary semantic layer.

Part of the next-phase plan: `docs/NEXT-PHASE-PLAN.md` (step A). See [[0007-rules-as-data-two-tier]].
