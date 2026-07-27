---
title: Fix the semantic graph view's broken Details panel and rebuild it
summary: Diagnosed docs/graph/semantic-graph.html rendering a literal backslash-n instead of line breaks; fixed the String.raw double-escape in the graph-view renderer plus the white-space rule that would have collapsed the newlines anyway, then regenerated the view from graphify-out/graph.json.
type: session
scope: shared
status: canonical
updated: 2026-07-26
---

# Fix the semantic graph view's broken Details panel and rebuild it

Branch: `dev-phase2-run3` (worked directly in `C:\project\ourobion` at Jayden's instruction — no
separate issue/worktree for this fix)

## Attempted

- Jayden reported `docs/graph/semantic-graph.html` "not working" and asked for a rebuild from the
  Graphify graph.
- Established first that it was **not stale**: `npm run graph:view:check` reported the HTML already
  matched `graphify-out/graph.json`, so a plain rebuild would have reproduced the same broken file.
  Fixed the generator before regenerating.
- Ruled out the usual causes with measurements rather than assumption: the embedded JSON parses
  (5,725 nodes / 621 communities / 406 community edges, zero dangling references), all eight
  referenced DOM ids resolve exactly once, there are no external/CDN dependencies, and the canvas has
  an explicit `height:650px` so it is not a zero-height canvas.
- Executed the page's real inline script against the real data with a stubbed DOM to catch runtime
  exceptions; it ran clean, and search / type-filter / zoom / reset / hover all worked.

## Changed

- `tools/graph-view/lib/render_graph_view.mjs` — two fixes:
  1. `CLIENT` is a `String.raw` template, so the `'\\n'` in `show()` and `find()` was emitted verbatim
     as two characters and the browser parsed it as backslash-plus-`n`. The Details panel printed a
     literal `\n` instead of breaking lines. Five sites corrected to `'\n'`.
  2. `#details` and `.meta` inherited `white-space:normal`, which collapses newlines into spaces — so
     fixing the escaping alone would have produced a space, not a line break. Added
     `white-space:pre-line` to the later, equally-specific `#details` / `.meta` rules rather than
     editing the shared rule, which a test pins verbatim.
- Regenerated `docs/graph/semantic-graph.html` via `npm run graph:view:write`.

## Decided

- Fix the generator, not the artifact. The HTML is a rebuildable projection; hand-editing it would be
  overwritten by the next `graph:view:write` and would leave the bug in place for every later rebuild.
- Override the `white-space` cascade in the later rules instead of changing the shared rule, so the
  existing test assertion on that exact CSS string keeps passing.

## Left

- Recorded for Jayden, not acted on: the current view's geometry carries no information —
  `place()` positions each community at `radius = step*sqrt(i)`, `angle = i*golden` where `i` is the
  size-rank index, so position encodes size order, not connectivity. It also draws communities only
  (never individual nodes) and caps at 96 communities, covering 2,904 of 5,725 nodes. A standard-format
  export (GEXF/GraphML) opened in a mature viewer, plus scoped mermaid for specific questions, would be
  a better human view than a bespoke canvas. Jayden deprioritized this.
- `CLAUDE.md` still tells agents to read `docs/graph/semantic-graph.md`, which this working tree
  deletes in favour of the `.html`. The instruction now points at a missing file, and the HTML is not
  readable by an agent. Flagged, not changed — it belongs to the concurrent graphify/doc-split work.

## Blockers

- None. `context_sync --check`, `graph:view:test` (6/6), and `graph:view:check` all pass.

memory: none
