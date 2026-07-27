---
title: Make the tracked graph view Markdown again and demote the HTML to a local artifact
summary: docs/graph is the layer that travels across machines, but the only tracked graph view had become a 1.3MB HTML canvas no agent can read, while GRAPH_REPORT.md and graph.json are gitignored — so a fresh clone had no graph context at all. Markdown is canonical again; the interactive HTML now generates into gitignored graphify-out/.
type: session
scope: shared
status: canonical
updated: 2026-07-26
---

# Make the tracked graph view Markdown again and demote the HTML to a local artifact

Branch: `dev-phase2-run3` (worked directly in `C:\project\ourobion`; Jayden confirmed no other agent
is active and asked for no separate session/worktree)

## Attempted

- Jayden pointed out that `GRAPH_REPORT.md` lives in `graphify-out/`, which is **gitignored**
  (`.gitignore:94`). That invalidated an earlier suggestion of mine to point agents at it as the
  fallback overview, and exposed the real problem below.
- Traced every graph affordance an agent has: `graphify query` needs `graphify-out/graph.json`,
  `GRAPH_REPORT.md` is gitignored, and the only **tracked** view had become
  `docs/graph/semantic-graph.html` — 1.3MB of embedded JSON and minified JS. On a fresh clone, or any
  session where the graph has not been rebuilt, an agent therefore had **no** readable graph context.
- Confirmed the `.md` could not simply be restored alongside the `.html`: `validateSingleHumanView`
  throws unless exactly one generated view exists in `docs/graph/`, and the pre-push hook enforces it.
  So this needed a format decision, not an additive fix.

## Changed

- **Markdown is the canonical tracked view again.** Recovered the 384-line Markdown renderer and its
  CLI/tests from `0ba0582` (they were replaced, not deleted, so nothing had to be rewritten).
  `docs/graph/semantic-graph.md` is regenerated — 937 lines with a mermaid topology map, composition
  tables, cross-community links, bridge nodes, hyperedges and interpretation limits.
- **HTML demoted to a machine-local artifact.** The interactive canvas now generates to
  `graphify-out/semantic-graph.html` (gitignored, beside `graph.json`), preserving the newline/CSS fixes
  from the previous session. `docs/graph/semantic-graph.html` is untracked and removed.
- `tools/graph-view/lib/render_graph_html.mjs` — new home for the HTML renderer, export renamed to
  `renderGraphHtml`.
- `tools/graph-view/lib/graph_hash.mjs` — new. Both renderers now share **one** `graphContentSha256`.
  The two libs had diverging implementations; kept the newer one, which sorts nodes/links/hyperedges so
  the hash is reorder-invariant, and deleted the older order-dependent copy.
- `generate_graph_view.mjs` — writes Markdown to `docs/graph/`, then the HTML companion to
  `graphify-out/`. A new guard rejects any `semantic-graph.*` in `docs/graph/` other than the canonical
  Markdown, so the HTML cannot silently reappear there.
- Aligned every reference: `AGENTS.md` §8, `CLAUDE.md`, `GEMINI.md`, `README.md`,
  `docs/graph/README.md`, `docs/shared/structure-context.md`, `.graphifyignore`, both
  `scripts/graphify-build.*` wrappers, and memory `0008`. Each now states *why* the tracked view is
  Markdown, not just which file it is.
- Test suite split into `render_graph_view.test.mjs` (Markdown) and `render_graph_html.test.mjs` (HTML);
  the `tests/*.test.mjs` glob picks up both. 9 pass.

## Decided

- **Format follows audience, not convenience.** The tracked view must be readable by the consumer that
  cannot choose otherwise — an agent on a fresh clone. Humans can open a local HTML file; an agent
  cannot read one. So Markdown is tracked and HTML is local.
- **The HTML belongs in `graphify-out/` on the repo's own terms.** It is a rebuildable projection of
  `graph.json`, which is exactly what that gitignored directory holds; committing a 1.3MB generated
  blob also made the view undiffable in review.
- Kept the single-tracked-view invariant rather than relaxing it to one-per-format. Two tracked views
  would drift, which is what the invariant exists to prevent.
- `--check` validates only the tracked Markdown. The HTML is deliberately not checked, since it is
  absent on a fresh clone and regenerated on every write.

## Left

- The interactive view's layout still encodes no connectivity — `place()` positions communities by
  size-rank on a golden-angle spiral, so proximity is meaningless, and it draws communities only
  (never nodes), capped at 96 of 621. Recorded in the previous session; Jayden deprioritized it. It now
  matters less, since the HTML is no longer the view anyone is pointed at first.
- `graphify-out/wiki/index.md` is referenced conditionally by `CLAUDE.md`/`GEMINI.md` but has never
  existed in this repo. Harmless (the reference is guarded by "if it exists"), left alone.

- Normalized memory `0008`'s `updated:` from `2026-07-27` to `2026-07-26`. The pre-push gate correctly
  refused the modified record because `updated:` had not moved, and `2026-07-27` was a local-timezone
  date inconsistent with the UTC convention every session filename in this run uses (including
  `20260726T163505Z`, the session that had set it). `2026-07-26` is the true UTC date of this edit.

## Blockers

- None. `graph:view:test` 9/9, `graph:view:check` passes, `context_sync --check` passes. The new stray-view
  guard was negative-tested: planting a `docs/graph/semantic-graph.html` makes `--check` exit 1 with a
  message naming the file, and removing it restores a pass.

memory: modified 0008
