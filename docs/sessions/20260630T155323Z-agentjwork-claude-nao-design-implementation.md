# Session 20260630T155323Z — agentjwork — claude — nao-design-implementation

> Session log format: **Attempted / Changed / Decided / Left / Blockers**.
> First step of any session: read the latest `docs/sessions/` files + run `node tools/context_sync.mjs --session-start`.

- **Device:** agentjwork · **Agent:** Claude Code (claude-opus-4-8[1m]) · **Branch:** feat/nao/v1-corpus-dashboard (PR #36) · **Issue:** #35
- **Type:** Feature. Implement the approved Claude Design mock (`Ourobion Nao.dc.html`) as the real nao v1 UI.

## Attempted
Import the design from the user's Claude Design project (via the DesignSync MCP) and translate the
three-view mock (Overview / Papers / Detail + shell) into the live Next.js app, wired to real D1/R2
data — keeping the locked architecture (OpenNext/Workers, Supabase auth gate, R2-never-serves-text,
parameterized SQL).

## Changed
- **Shell** — new `(app)` route group: `(app)/layout.tsx` + `TopBar` (mark, global search → `/papers`,
  email via browser Supabase session, sign out) + `SubNav` (Overview/Papers active state). `/login`
  stays outside the group (bare). `shell.css`.
- **Overview** (`(app)/page.tsx`, `/`) — KPI tiles, ingestion funnel, retrievability donut, OA /
  topic-seed / discovery-source bars, year histogram, format conversion, work-type / storage /
  failures, v2 graph teaser. All from a new `corpusStats()`. `overview.css`.
- **Papers** (`(app)/papers/page.tsx`, `/papers`) — 7-dimension facet rail (`Facets` rewritten,
  `lib/facets.ts`), search (`SearchBar`), sort (`SortSelect`), active chips (`ActiveChips`), restyled
  `PaperCard` (factual chips + extract label), pagination. Moved off `/`.
- **Detail** (`(app)/paper/[uid]/page.tsx`) — header, factual quick-facts, collapsible abstract
  (`CollapsibleAbstract`), identifiers, OA card, topics/concepts, pipeline-&-provenance grid, errors.
- **Data layer** — `schema.sql` + `etl.mjs`: added `discovered_via`, `full_text_extracted/method/
  char_count`, `storage_kind/size_bytes`, `fetched_at` (+ indexes). `d1.ts`: extended `PaperRow`,
  filters (`discoveredVia`, `method`), `sort`, facet dims (status/discoveredVia/method), and the new
  `corpusStats()` aggregate. `tests/d1.test.ts` updated for the new columns.
- **Theme** — `layout.tsx` fonts → **Outfit + JetBrains Mono** (matching the mock; replaces
  Manrope+Outfit); `theme.css` exact panel/teal palette + mono var; `globals.css` mono eyebrows +
  glow keyframes. New `lib/palette.ts` (factual colour maps + byte/count formatters).
- **Brand** — copied mark/lockup SVG+PNG into `public/brand/`; `app/icon.png` favicon.
- Removed `QualityBadge` (v1 has no quality/rating — factual chips only).
- **Verified:** `tsc --noEmit` clean · `next lint` clean · `next build` succeeds (5 routes) ·
  d1/etl tests **13/13**. Rebuilt local D1 (drop → schema → `npm run etl`) and queried real
  aggregates against the 190-paper corpus (7 extracted, 94 retrievable, 0 failed, 224,627 chars,
  ~0.9 MB, 6 sources) — new columns populate, `corpusStats` computes correctly.

## Decided
- Fonts switch to Outfit + JetBrains Mono because the approved design is now the source of truth for
  the nao frontend (supersedes NAO-DESIGN §7's Manrope+Outfit note).
- Facets are **single-select per dimension** (matches the D1 equality filters); multiple dimensions
  can still be active at once. Multi-value-per-dimension (IN clauses) is deferred.
- `/` = Overview, `/papers` = the list (was `/`). Shell wraps the three authed routes via `(app)`.

## Left
- **Deploy-time:** the D1 schema gained columns, so the **remote** index must be rebuilt
  (DROP tables → re-apply `schema.sql` → `npm run etl --remote`); `wrangler.jsonc` `database_id`
  is still the PR #36 placeholder. Provision a Supabase login user (no public sign-up).
- Per-paper detail reads the R2 binding → empty under local `next dev`; use `wrangler dev --remote`
  or the deployed env to exercise it.
- v2: graph + evidence (needs the synthesis pipeline + edge store).

## Blockers
- None for the build.

## Follow-up
- **Pre-existing, NOT from this work:** `tests/auth.test.ts` fails under Node 26 — `mock.module` needs
  `--experimental-test-module-mocks`, and even with it the fixture is out of sync with the
  issuer/audience-hardened `auth.ts`. Neither `auth.ts` nor `auth.test.ts` was touched this session.
