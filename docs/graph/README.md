# docs/graph — code-relationship awareness

biotope tracks a change's blast radius across layers: **curate what isn't derivable, defer the
auto-generated structural graph, run a semantic context graph for agents, and enforce what we keep.**

## What lives here today

- **`couplings.yaml`** — curated **semantic / data couplings**: runtime/data contracts that static
  analysis cannot see (a `shared/` type ↔ a Supabase table's columns ↔ a Flutter model; TS↔Dart
  parity of the shared types and copy rules). Each edge names a **`guard:` test** that makes the
  coupling executable. `node tools/context_sync.mjs --check` fails if a named guard file is missing.
  Guard tests live in `src/test/guards/` and run with `flutter test`.

The curated **module dependency graph and interface rules** are not duplicated here — they live in
[`../ARCHITECTURE-CONTEXT.md`](../ARCHITECTURE-CONTEXT.md), which is the boundary reference today.

## Semantic context graph — graphify

[`graphify`](https://github.com/safishamsi/graphify) (PyPI `graphifyy`) indexes the repo into a
queryable `graph.json` so an agent pulls only the relevant subgraph instead of the whole tree. It is the
**semantic / agent-context** layer and is **complementary to — not a substitute for — the deferred
structural import-graph below** (it is multi-modal/semantic; the deferred one is a strict import graph).

- **Rebuild:** `scripts/graphify-build.ps1` (AST-only, local, no LLM, no network) — bootstraps a
  project-bounded venv in `..\biotope-toolchain\graphify-venv` on first run, and is on PATH after
  `. .\scripts\biotope-env.ps1`. graphify is **build tooling, not a repo/runtime dependency**
  (machine-local, uncommitted, never deployed).
- **Output:** repo-root **`graphify-out/`** (`graph.json` + `graph.html` + AST cache + manifest),
  **gitignored** — a rebuildable **projection**, never hand-edited ([two-tier-truth](../memory/0001-two-tier-truth.md)).
  Gitignored until a path-normalizer (port NUSPlan's `tools/normalize_deps_graph.mjs`) makes `graph.json`
  diff cleanly cross-machine — then promote it to committed + add a regenerate/diff check to
  `tools/context_sync.mjs --check`.
- **Agent integration (pre-wired, committed):** PreToolUse hooks remind the agent to query the graph
  (`graphify query|path|explain`) before grepping/reading source — for **Claude Code**
  (`.claude/settings.json` + `CLAUDE.md`), **Codex** (`.codex/hooks.json` + `AGENTS.md`), and **Gemini
  CLI** (`.gemini/settings.json` + `GEMINI.md`). Any other tool: `graphify <tool> install`, or run the
  CLI manually. AGENTS.md stays the single source of truth — its graphify lines are operational usage only.
- **No API key:** AST extraction is fully local (tree-sitter; Dart + TS + more). The cross-language
  semantic pass uses the **host Claude Code session model** when invoked inside the assistant.

Full rationale + verified coverage (680 Dart / 31 TS nodes): [`../memory/0008-graphify-context-tool.md`](../memory/0008-graphify-context-tool.md).

## Why the structural import graph is DEFERRED (not built yet)

NUSPlan (the reference project) auto-generates `docs/graph/deps.json` with **dependency-cruiser** (a
JS-only tool) and enforces import boundaries from it. biotope is **Dart + TypeScript + SQL**, where a
single import-graph tool is awkward: dependency-cruiser sees only the JS/TS side, and the bulk of the
app is Dart. Rather than ship a half-graph that lies about coverage, we defer it. **Nothing in this
repo claims a generated structural graph exists.**

## How to add a real generated graph later (TODO)

When the boundaries are worth auto-enforcing, build it per side and merge, then wire it like NUSPlan's
deps.json (regenerate + diff in the pre-push hook and CI; add a `deps.json`-style existence/validity
check to `tools/context_sync.mjs`). Treat the generated file as a **rebuildable projection — never
hand-edit it** (the two-tier-truth rule, [`../memory/0001-two-tier-truth.md`](../memory/0001-two-tier-truth.md)).

- **Dart side (`src/`):** `dart pub deps --json` + a small Node parser, **or** the
  [`import_lint`](https://pub.dev/packages/import_lint) / `layer_lint` Dart packages to declare and
  enforce layer rules directly (no JSON intermediary).
- **TypeScript side (`shared/` + `supabase/functions`):** dependency-cruiser scoped to just those
  directories, emitted as JSON and normalized for path-independence (see NUSPlan's
  `tools/normalize_deps_graph.mjs` for the baseDir-pinning trick).
- **SQL side (`supabase/migrations`):** no import graph; keep relying on `couplings.yaml` guard tests
  to tie table shapes to the contracts and models that read/write them.

Until then, `couplings.yaml` + the curated ARCHITECTURE-CONTEXT graph + `flutter analyze` are the
enforced relationship layer.
