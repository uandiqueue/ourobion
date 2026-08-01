---
title: nao Overview — contain the "By publication year" axis instead of letting it scroll the page
summary: At 21,824 corpus rows the year facet spans far more distinct years than the panel is wide. `.hist__col { flex: 1 }` could not shrink past each label's ~16.5px min-content floor, and `.panel` inherited grid `min-width: auto`, so the 1.4fr track inflated to 2024px and the whole page scrolled sideways. Added a `.hist-scroll` container, `min-width: 0` on the year panel, and a bounded 26px–44px column; re-sorted the axis newest-first at render. Every year still renders — nothing is capped or dropped. `scalarFacet`'s count-desc query contract is untouched.
type: session
scope: shared
status: canonical
updated: 2026-08-01
---

# nao Overview — "By publication year" horizontal overflow

Branch: `fix/nao/overview-year-facet-overflow`; base and exact head at branch cut: `5d2d39e`
(`origin/main`); device: `agent-j`; agent: `claude` (Opus 5, 1M context). Isolated git worktree; the
main checkout was not touched.

Territory: `apps/nao/src/app/(app)/overview/page.tsx`, `apps/nao/src/app/overview.css`, this log.

## Attempted

An owner-reported layout defect: the Overview page's **By publication year** facet overflowed
horizontally off the side of the page. Contain the overflow in its own scroll container, put the
newest year leftmost, and bound the year cells — without changing the facet's data or counts.

## Confirmed, before changing anything

I reproduced the defect against the **real** stylesheets (headless Chrome loading
`apps/nao/src/app/globals.css` over a DOM copy of the year panel), rather than inferring it:

| years rendered | page `scrollWidth` / `clientWidth` | year panel width | column width |
| --- | --- | --- | --- |
| 20 (pre-fix) | 1422 / 1422 — no overflow | 649px | 20.6px |
| 75 (pre-fix) | **2352 / 1412 — page scrolls sideways** | **2024px** | 16.5px |

That threshold is the whole story of "it was fine at 6,158 rows and broke at 21,824": the layout
holds to roughly 20–30 distinct years and fails past that.

The mechanism is two separate missing bounds, and fixing either one alone is not enough:

- **`.hist__col { flex: 1 }` is `flex: 1 1 0%`, but flex items default to `min-width: auto`.** Each
  column's min-content size is its label (`'24` is a single unbreakable token, ~16.5px at 10px mono),
  so the columns *stop shrinking* at 16.5px and the flex line overflows rather than compressing.
  This is why the bars looked squashed *and* the panel still burst.
- **Grid items also default to `min-width: auto`.** `.ov-grid-year` is `1.4fr 1fr`, which expands to
  `minmax(auto, 1.4fr)`; the `auto` minimum is floored by the item's min-content contribution, so the
  over-wide `.hist` inflated its own track to 2024px and pushed the page out. Adding a scroll
  container *without* `min-width: 0` on the panel would not have helped — the panel would simply have
  grown to fit its scroller.

## Changed

### `page.tsx` — display sort + a scroll container

- **Sorted newest-first at render, not in the query.** The line was
  `sort((a, b) => Number(a.value) - Number(b.value))` (oldest-first); it is now `b - a`. The sort is
  deliberately left on the page: `scalarFacet` is shared by **eight** facets and by `facetCounts()`,
  which the Papers-page facet UI consumes, and its documented contract is "ordered by count desc,
  value asc". Re-ordering the SQL to satisfy one chart would have silently re-ordered the Papers
  facet lists too. Query semantics and counts are byte-for-byte unchanged.
- **Wrapped `.hist` in `<div className="hist-scroll">`** carrying `role="group"`, a
  `aria-label="Papers by publication year, newest first"`, and `tabIndex={0}` so the scroll region is
  reachable by keyboard (a scrollable box with no focusable descendant is otherwise unreachable
  without a pointer). The label passes `validateCopyString` — it contains none of the gate's
  forbidden terms.

### `overview.css` — three bounds

- **`.panel--hist { min-width: 0 }`** — the load-bearing line. This is what confines the overflow to
  the scroller instead of the grid track. It is a new modifier class on the year panel only, so the
  neighbouring Format-conversion panel and every other facet are untouched.
- **`.hist-scroll { min-width: 0; overflow-x: auto; overflow-y: hidden; padding-bottom: 6px }`** —
  the same idiom `.subnav` already uses in `shell.css:165`, so this is the established pattern in
  this codebase rather than a new one. The padding keeps the 10px scrollbar off the year labels.
- **`.hist { width: max-content; min-width: 100% }`** — fills the panel when the years fit, grows to
  the axis width and scrolls when they do not.
- **`.hist__col`: `flex: 1 0 26px; width/min-width: 26px; max-width: 44px`.** Bounded at both ends —
  `flex-shrink: 0` means it scrolls instead of squishing, and `max-width` means no unbounded flex
  growth. `.hist { height: 140px }` is unchanged and still bounds the container vertically.

## Decided

- **No cap on rendered years, so nothing is hidden.** Every year in the facet is rendered as a
  column; the long tail is reached by scrolling. Verified at 120 years (4310px of scroll content,
  page still not scrolling) — a few hundred DOM nodes is not a performance concern, and a silent
  truncation of the corpus's own year range would be worse than a scrollbar.
- **The `'YY` two-digit label was kept.** It is the existing visual language and the full year is
  already on the column's `title`. Worth flagging as a *latent* issue: see Left.
- **This is a layout fix only.** No neighbouring facet was restyled, no colour, spacing or typography
  token changed, and the bar gradient/`title` markup is identical.

## Left

- **`'YY` labels become ambiguous once the corpus spans two centuries.** With 21,824 rows the year
  range plausibly reaches back before 2000, and `'24` cannot distinguish 1924 from 2024. The hover
  `title` disambiguates, but hover is neither discoverable nor available on touch. I did not change
  it because it is out of scope for an overflow fix and would widen every column, but it is a real
  clarity defect that the same data growth created. A 4-digit label fits in a ~34px column if it is
  ever wanted.
- **Not verified against the live D1 corpus.** The worktree has no D1 binding, so the year range and
  distinct-year count are inferred from the row counts in the brief, not observed. The fix is
  count-independent (it bounds and scrolls at any n), so this does not gate it.
- **`opennextjs-cloudflare` deploy is manual.** Landing this does not put it live; there is no deploy
  workflow, by design.

## Gates

- `apps/nao`: `npm run typecheck` clean; `npm test` **380/380 pass**; `npm run lint` — no ESLint
  warnings or errors. (`npm ci` was needed first — a fresh worktree has no `node_modules`.)
- `node tools/context_sync.mjs --check` passed; `git diff --check` clean.
- Headless-Chrome layout verification against the real CSS, post-fix: at **75 years** the page does
  not scroll sideways (`scrollWidth` 1422 = `clientWidth` 1422) while `.hist-scroll` scrolls
  internally (2690 vs 603), all 75 columns render at exactly 26px, `.hist` is 140px, and the leftmost
  column is 2026 with 1952 rightmost. At **120 years**: still no page overflow. At **12 years**:
  no internal scroll, columns grow to 41px. At **3 years**: columns clamp at exactly 44px, proving
  the growth bound holds.

## Blockers

None.

memory: nao Overview year facet overflowed the page at 21.8k corpus rows because of TWO defaulted
`min-width: auto` bounds, not one — flex items floor at their label's min-content width (`'24` ≈
16.5px) so `flex: 1` columns stop shrinking and the line overflows, AND grid items floor the
`1.4fr` track at that same min-content contribution, so the panel inflated to 2024px and scrolled
the whole page. A scroll container alone does NOT fix it; `min-width: 0` on the grid item is the
load-bearing line. Fixed with `.hist-scroll` (`overflow-x: auto`, mirroring `.subnav` in shell.css),
`.panel--hist { min-width: 0 }`, `.hist { width: max-content; min-width: 100% }`, and a bounded
`flex: 1 0 26px` / `max-width: 44px` column. Sorted newest-first AT RENDER, not in SQL, because
`scalarFacet` is shared by 8 facets plus the Papers-page facet UI and its contract is count-desc.
No year is capped or dropped. Verified empirically with headless Chrome against the real stylesheets
(pre-fix 75 years = 2352px page vs 1412px viewport; post-fix = no page overflow at 120 years) —
worth reusing, it beats reasoning about CSS intrinsic sizing.
