---
title: nao Data loader — replace the unusable form with an honest coming-soon state
summary: The loader form could never succeed (POST /api/loader requires an approved demo target that no row satisfies), so it read as a broken feature rather than an unbuilt one. Replaced LoaderPanel's three interactive panels with a single static "Coming soon" panel in the existing empty-state pattern; the route and its nav entry stay. Server-side authorisation under api/loader/** was not touched — the capability is preserved, just not offered.
type: session
scope: nao
status: canonical
updated: 2026-08-01
---

# nao Data loader → coming-soon state

Branch: `feat/nao/loader-coming-soon`; base and exact head at branch cut: `5d2d39e`
(`origin/main`); device: `agent-j`; agent: `claude` (Opus 5, 1M context). Isolated git worktree; the
main checkout was not touched (two other agents were working in `apps/nao` at the time).

Territory: `apps/nao/src/app/(app)/loader/page.tsx`, `apps/nao/src/components/LoaderPanel.tsx`,
`apps/nao/tests/loaderRuns.test.ts`, `apps/nao/tests/brainPipelineCopy.test.ts`, this log.

## Attempted

Stop presenting a data-loader form that cannot succeed, without removing the loader capability or
weakening the guard that makes it unusable today.

## Confirmed, before changing anything

- `POST /api/loader` gates on `guardRole('curator')` and then on
  `validateLoaderTarget(body.target, gate.userId)` — the target must be a registered demo target
  distinct from the caller. With no such row, every submission from the form is refused, and
  "Run analysis" was hard-disabled behind `loadResult === null`, so it was unreachable by
  construction.
- The empty-state idiom already exists and did not need inventing: `ModelsPanel` and `ClaimsPanel`
  both render a bare `div.panel.ingest-panel` with an `eyebrow panel__label` and `p.fmt__cap`
  prose. `ingest.css` is loaded globally via `globals.css`, so no style change was needed.
- The panel had no reason to stay a Client Component once the state, the fetches and the controls
  were gone.

## Changed

### `LoaderPanel.tsx` — a static unavailable state

The three panels (current range, load-days form, run-analysis) are replaced by one panel. Removed:
the `Approved demo target ID` input, the days / scenario / seed controls, the **Load days** submit,
the **Run analysis** button, both `fetch` call sites (`/api/loader`, `/api/loader/run-pipeline`),
all seven `useState` hooks, the `useEffect` refresh, and the stage/range formatters. `'use client'`
and the `@/lib/simulatedHealth` import are gone with them; the file is now a Server Component.

The controls are **removed, not disabled** — a disabled button a visitor can hover and click at is
still an invitation to a feature that does not work.

Shipped copy, verbatim:

> **Coming soon**
>
> Loading demo health data and running the analysis pipeline isn't available yet.
>
> When it arrives, this page will load a stretch of simulated, provenance-flagged days for a demo
> account and take them through the serve pipeline — baselines, then signals, then insights — so the
> overview, claims and gap surfaces have a real run to read.

### `loader/page.tsx` — metadata only

The route, the `Feed the engine` eyebrow and the `Data loader` heading are unchanged, and the
`/loader` entry in `SubNav` is untouched. Only the `metadata.description` moved, from a promise the
page no longer makes to `Loading demo health data and running the analysis pipeline is coming soon.`

### Tests

- `loaderRuns.test.ts` — the source-conformance test `LoaderPanel requires an approved target and
  scopes analysis to the loader request key` asserted the removed form (the required target input,
  the request-key body, the `disabled={busy || loadResult === null}` guard). It is replaced by
  `the loader UI offers no interactive surface at all, while the server side stays gated`, which
  asserts the **removal** (no `<form>`/`<button>`/`<input>`/`<select>`/`onClick`/`onSubmit`/
  `useState`/`fetch(`/`'/api/loader`/`'use client'`) *and* that both handlers still carry
  `guardRole('curator')` and both `ROUTE_POLICY` entries are still `curator`. Nothing else in the
  file changed; its 40-odd other tests over the fold, the request key, the SQL parity and the
  response shape are untouched and still pass.
- `brainPipelineCopy.test.ts` — appended `LOADER_COPY_FILES` and a third gate test so the new prose
  runs through `validateCopyString` like the brain-pipeline and provenance surfaces do. Appended
  rather than merged into the existing arrays, to keep the diff off lines another agent might be
  editing.

## Decided

- **The server side was deliberately left exactly as it is.** Nothing under `apps/nao/src/app/(app)/api/`
  was opened for edit; `git status` lists four files and none is a route handler. The
  `nao_demo_targets` check is a real guard on a production write path (it writes `daily_gut_rows`
  and `wearable_daily` and relays to the hosted `run-pipeline`), and no type change was needed to
  compile without the UI, so there was no reason to go near it. Removing the UI while leaving the
  endpoints gated preserves the capability for when a demo target is registered.
- **The copy says what the feature will do, never why it is blocked.** No table name, no UUID, no
  HTTP status, no mention of approval or gating reaches the screen. A visitor learns the feature is
  coming, not that they failed a check.
- **The route and its nav entry stay.** `howItWorks.test.ts` asserts `/loader` is never
  allow-listed as public in `middleware.ts`, so the surface remains an authenticated one; deleting
  the page would have changed a gated-surface inventory for a UI decision.

## Left

- **`GapsPanel.tsx` still points at the loader**: its empty state reads "Load data and run the
  analysis (Data Loader) — pairs the engine evaluates without a servable edge land here." That is
  now a pointer to a coming-soon page. It is outside this session's territory (two other agents were
  in `apps/nao`), so it was not touched; it wants a one-line follow-up.
- The loader stays unusable until a demo target row exists. That is the pre-existing situation, not
  something this change created or resolved.

## Gates

- `apps/nao`: `npm run typecheck` clean; `npm test` **381/381 pass** (including the two new tests);
  `npm run lint` — no ESLint warnings or errors. (`npm ci` was run first — the worktree had no
  `apps/nao/node_modules`; `package-lock.json` is unchanged.)
- `node tools/context_sync.mjs --check` passed; `git diff --check` clean.

## Blockers

None.

memory: none
