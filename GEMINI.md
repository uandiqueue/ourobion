# GEMINI.md

**Read [`AGENTS.md`](./AGENTS.md) — it is the single source of truth for this repo.**

All durable instructions (architecture, commands, module boundaries, conventions, the two-tier-truth
rule, and the session / memory / task collaboration protocols) live in `AGENTS.md` alone, so the
guidance never drifts between tools. This file is only a pointer.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context. It is gitignored, so it only exists once the graph has been built on this machine.
- For a broad overview that is always present, read `docs/graph/semantic-graph.md` — the single tracked view, generated and deliberately lossy. On a fresh clone this is the only graph context available, since everything under graphify-out/ is machine-local.
- An interactive view is also generated at `graphify-out/semantic-graph.html` for humans. Do not read it: it is a ~1.3MB blob of embedded JSON and minified JS.
- After modifying code, run `graphify update .` (AST-only, no API cost), perform the incremental semantic pass for invalidated manifest entries at session close, then run `npm run graph:view:write`.
