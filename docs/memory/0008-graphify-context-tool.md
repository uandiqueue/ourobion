# 0008 — graphify is the context tool; complementary to the deferred structural graph

**Decision (Phase 2 plan, 2026-06-09):** adopt **graphify** (github.com/safishamsi/graphify) — a semantic
knowledge-graph **skill for AI coding assistants** (turns code/docs/papers into a queryable `graph.json`,
feeds only relevant subgraphs to the model) — to manage agent **context overload** and to hold
**ingestion-pipeline context** for the analysis work.

**It is complementary to, NOT a replacement for,** the structural import-graph that
`docs/graph/README.md` marks **DEFERRED** (deferred because biotope is Dart+TS+SQL and one import tool
sees only the TS half). graphify is semantic/multi-modal; the deferred graph is structural. Both obey the
two-tier rule: a generated graph is a rebuildable projection, never hand-edited ([[0001-two-tier-truth]]).

**Usage decided (design-only this phase — not installed yet):**
- Index **biotope's own repo** as the primary graph (agent context). Index the **research-paper corpus as
  a separate graph** (ingestion context) once a paper is provided. **Never index NUSPlan** (read-once
  reference — indexing pollutes biotope's graph).
- Artifacts at `docs/graph/generated/graph.{json,html}`; **gitignore both** until a path-normalizer (port
  NUSPlan's `tools/normalize_deps_graph.mjs`) makes `graph.json` diff cleanly across machines — then
  promote `graph.json` to committed + add a regenerate/diff check to `tools/context_sync.mjs --check`.
  `graph.html` stays gitignored (heavy, regenerable).

**Dart coverage — verified empirically (2026-06-10, graphifyy 0.1.14, disposable venv probe; not
installed):** AST-only extraction (`graphify update --no-cluster`, local, no LLM) handles Dart despite
`tree-sitter-dart` not being a declared dependency — real biotope files yielded full **structure**
(classes, fields, methods incl. private, imports; e.g. `baseline_service.dart` → 23 nodes) — but **no
`calls` edges for Dart** (TS got them) and **no raw cross-language Dart↔TS linking** (shared refs like
`SupabaseClient` stay duplicate nodes; merging is presumably the semantic-LLM pass, untested). So: Dart
structure yes, call flow no — adequate for the context-substrate role above, and confirms graphify does
NOT substitute for the deferred structural import-graph on the Dart side.

Part of the next-phase plan: `docs/NEXT-PHASE-PLAN.md` (step A). See
[[0007-rules-as-data-two-tier]].
