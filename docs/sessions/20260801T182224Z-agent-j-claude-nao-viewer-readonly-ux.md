---
title: nao viewer read-only UX — disable what the server would refuse, and say so once at the top
summary: A viewer could press every corpus-changing control in nao and get a refusal back, which implies the action was plausible. Controls are now rendered inactive up front, driven by authz.ts's ROUTE_POLICY matrix rather than a hand-written list, and a read-only caller gets one plain notice under the sub-nav. Presentation only — no route, no required role, and no guardRole() call changed; a forged request is refused exactly as before.
type: session
scope: shared
status: canonical
updated: 2026-08-01
---

# nao viewer read-only UX

Branch: `feat/nao/viewer-readonly-ux`; base and exact head at branch cut: `5d2d39e` (`origin/main`);
device: `agent-j`; agent: `claude` (Opus 5, 1M context). Isolated git worktree; the main checkout was
read but never edited. Three other agents were working in `apps/nao` concurrently, so
`overview/**`, `BrainPipelinePanel.tsx`, `api/brain-pipeline/**`, `brainPipelineGithub.ts`,
`loader/**` and `LoaderPanel.tsx` were left untouched by construction.

Territory: `apps/nao/src/lib/naoAccess.ts` (new), `apps/nao/src/components/{NaoAccess,ReadOnlyBanner}.tsx`
(new), `apps/nao/src/app/(app)/layout.tsx`, `apps/nao/src/components/{IngestControlPanel,SeedsPanel,
GapsPanel,ClaimsPanel,ModelsPanel}.tsx`, `apps/nao/src/app/{shell,ingest}.css`,
`apps/nao/tests/naoAccess.test.ts` (new), this log.

## Attempted

Owner request: "patch viewer access to nao such that all the buttons that could modify corpus is
inactivated (instead of allow press then say not authorised). Also add in a viewer access at the top
of the page to tell them they can only view."

## Confirmed, before changing anything

- **`authz.ts` already holds the whole answer.** `ROUTE_POLICY` is a complete `"${METHOD} ${path}" →
  NaoRole` matrix over all 16 handlers, `satisfies()` implements the viewer < curator < admin
  ordering, and `tests/authz.test.ts` fails if a handler has no entry, if an entry has no handler, or
  if a handler guards with a role that differs from its entry. So the matrix cannot silently drift
  from the server, which is exactly the property a hand-written "buttons to disable" list would lack.
- **The tier is a fresh database read, not a claim.** `resolveNaoRole()` calls `supabase.rpc('nao_role')`
  every time and never touches `user_role`/`app_metadata` (asserted by authz.test.ts). The UI had to
  take the tier from there, server-side, not re-derive it in the browser.
- **The three sections of `IngestControlPanel` need DIFFERENT tiers.** Pause/resume and the budget
  are `POST /api/ingest-control` (**admin**); Run now is `POST /api/ingest-control/trigger`
  (**curator**). A single per-panel "can edit" flag would have been wrong on the first page it
  touched — which is why a control names its ROUTE, not a role.
- **`GET /api/seeds` requires curator.** Seeds are the one surface where READING is gated too, so a
  viewer's SeedsPanel was fetching, being refused, and rendering "Couldn't load the seed catalog. Try
  refreshing." — an invitation to retry something that can never succeed.
- **`GapsPanel`'s "Add as seed" calls no API at all** (it prefills the seeds form client-side), so it
  has no route of its own. It is gated on `POST /api/seeds`, the route the seed it hands over would
  eventually be written through.

## Changed

### `src/lib/naoAccess.ts` (new) — pure, zero I/O, the whole decision

Imports `ROUTE_POLICY`, `requiredRoleFor` and `satisfies` from `authz.ts` and exposes:

- `canUseRoute(role, key)` — literally `satisfies(role, ROUTE_POLICY[key])`, with an undeclared key
  returning `false` (the same fail-closed rule `requiredRoleFor`'s doc comment states for the
  server). A test asserts this equals the server's own arithmetic for every role × every matrix entry.
- `MUTATING_ROUTE_KEYS` — **computed** by filtering the matrix's own keys on a read-method allowlist
  (`GET`/`HEAD`/`OPTIONS`; anything else, including an unparseable key, counts as a mutation). Not
  enumerated, so a route added tomorrow is covered the day it ships.
- `isReadOnlyRole(role)` — true iff NO mutating key is satisfiable. A statement about what this
  build's routes allow, not a synonym for the string `'viewer'`.
- `controlAccess(role, key)` — `{allowed, reason}`, where `reason` is chosen by asking whether the
  caller can change anything at all, so a curator blocked by an admin-only control is **not** told
  their access is read-only.

Zero framework imports, for `authz.ts`'s reason: `node --test` imports and executes it directly, so
the availability arithmetic the UI renders is proven by execution, not by source shape.

### `src/components/NaoAccess.tsx` (new) — the client half

`NaoAccessProvider` (context, defaulting to `null` = fail closed), `useNaoRole`, `useControlAccess`,
plus two adoption shapes:

- **`useControlGate()`** returns a function, so ONE hook call covers a whole panel:
  `<button {...gate('POST /api/seeds', busy || label === '')}>`. The second argument folds in the
  panel's own reasons (busy, empty form, paused pipeline) so the spread REPLACES the existing
  `disabled=` rather than fighting it. Spread last.
- **`ControlScope routes={[...]}`** renders a native `<fieldset disabled>`, which disables every
  button/input/select inside it — including ones in components this module has never heard of. That
  is what makes it adoptable in a single line, and it is what the two concurrently-rewritten panels
  should use.

Both render the reason as VISIBLE text (`ControlNote` / the scope's own line) as well as a `title`.
The visible line is the load-bearing one: browsers do not fire hover events on a disabled control, so
a tooltip alone would be a reason nobody can read.

### The shell — `src/app/(app)/layout.tsx`

Became `async` + `export const dynamic = 'force-dynamic'`, calls `resolveNaoRole()` once per request,
renders `<ReadOnlyBanner role={role} />` between the sub-nav and the page canvas, and wraps `<main>`
in `<NaoAccessProvider role={role}>`. `force-dynamic` is required, not decorative: `/ingest`,
`/claims`, `/models` and `/brain-pipeline` were statically shelled, and prerendering them would bake
one visitor's banner state into everyone's HTML. `next build` confirms all `(app)` routes are now
`ƒ` and the four public routes (`/`, `/how-it-works`, `/login`, `/_not-found`) are still `○`.

### Panels

| Panel | Gated on | Shape |
| --- | --- | --- |
| `IngestControlPanel` | `POST /api/ingest-control` (pause, budget), `POST /api/ingest-control/trigger` (Run now) | per-control `gate(...)`, one `ControlNote` per section |
| `SeedsPanel` | `GET /api/seeds` (read), `POST /api/seeds`, `PATCH /api/seeds` | skips the fetch entirely when the read is not permitted and says so plainly |
| `GapsPanel` | `POST /api/seeds` | table stays fully live; only "Add as seed" is gated |
| `ClaimsPanel` | `POST /api/claims/reject` | cards/quotes/citations stay live; one note above the list |
| `ModelsPanel` | `POST /api/models/caps` | caps editor wrapped in `ControlScope`; every read above it stays live |

Nothing is blanket-disabled. Reads a viewer is entitled to keep working, which is the difference
between "read-only" and "broken".

### CSS

`.access-banner` in `shell.css` (cyan accent wash + hairline — informational weight, never the
amber/red reserved for something being wrong); `.control-scope` (fieldset reset to a plain flex
column so wrapping a region changes what it does, never how it looks), `.control-note`, and a
disabled treatment for inputs/selects matching the one `.ingest-btn:disabled` already had.

## Decided

- **No server-side gate was touched.** Zero changes under `src/app/(app)/api/**`, zero changes to
  `authz.ts`, `authzServer.ts` or `middleware.ts`. Every route still calls `guardRole()` as its first
  statement, `ROUTE_POLICY` is byte-identical, and all 16 handlers still pass the existing
  source-conformance tests. A browser with every control re-enabled by hand gets the same refusal it
  got before this change. Two new tests pin the boundary from both sides: no component may reference
  `guardRole`/`requireRole`, and no route file may reference `naoAccess`.
- **A control names a route, never a role.** A test asserts no component contains the literal
  `'viewer'`, `'curator'` or `'admin'` in executable code. That is the anti-drift property the whole
  design rests on: when a route's required tier moves in the matrix, the UI follows without an edit.
- **The tier is never re-derived client-side.** A test asserts `NaoAccess.tsx` references none of
  `user_role`, `app_metadata`, `user_metadata`, `getUser`, `createBrowserClient` or `document.cookie`.
  A client that lies to itself only re-enables its own buttons.
- **The banner shows for a read-only caller only**, decided by `isReadOnlyRole()`, not by comparing
  to `'viewer'`. A curator or admin sees nothing — a notice everyone sees stops being read. Copy
  (gate-checked, and separately asserted to contain no role name, table name or status code):
  > **READ-ONLY ACCESS** — You can read everything in nao — papers, claims, model spend, knowledge
  > gaps and pipeline history. Controls that would change the corpus are shown, but stay inactive.
- **Two reason strings, not one.** "Your access is read-only, so this control is inactive." for a
  caller who can change nothing; "This control is inactive at your access level." for a curator on an
  admin-only control. Telling a curator their access is read-only would be false.
- **`resolveNaoRole()` in the layout is a second `nao_role()` round-trip per page request** (the
  middleware already makes one for page paths). Accepted deliberately: the alternative is passing the
  tier from middleware in a header, which reintroduces exactly the "role travels in something other
  than a fresh database read" shape R4-U2 removed.

## Left

- **`LoaderPanel` and `BrainPipelinePanel` have NOT adopted the gate** — both are being rewritten in
  other sessions, so touching them was out of scope. They are named in `PENDING_GATE_ADOPTION` in
  `tests/naoAccess.test.ts` with this note; removing a name without wiring the panel turns that test
  red, so the exclusion cannot quietly become permanent. One line each, at the mount site:
  - `apps/nao/src/app/(app)/loader/page.tsx` — replace `<LoaderPanel />` with
    `<ControlScope routes={['POST /api/loader', 'POST /api/loader/run-pipeline']}><LoaderPanel /></ControlScope>`
    (the panel has no read-only action buttons, so wrapping the whole thing is safe).
  - `BrainPipelinePanel` — wrap only its trigger `<form>` in
    `<ControlScope routes={['POST /api/brain-pipeline']}>…</ControlScope>`, **not** the whole panel:
    its Refresh button is a `GET /api/brain-pipeline` a viewer is entitled to, and a fieldset cannot
    tell a read control from a write one.
  Both need `import { ControlScope } from '@/components/NaoAccess';` (or `'./NaoAccess'` from inside
  the panel).
- **No component-rendering test exists**, and cannot with this harness: `node --test` strips types but
  not JSX, and the components import the `@/lib/...` TS-only alias — the same F8 constraint
  authz.test.ts documents. The behavioural claims ("a viewer sees the banner and inactive controls; a
  curator/admin sees neither") are proven as executed arithmetic over the real matrix plus
  source-conformance over the real files, not by rendering. That is the repo's established seam, but
  it is a seam: a wiring mistake no regex looks for would pass.
- **`title` on a disabled control is inert in Chrome/Safari.** The visible `ControlNote` is the real
  affordance; the attribute is a convenience for assistive tech only.
- **The gaps table shows a row of inactive "Add as seed" buttons to a viewer** rather than dropping
  the column. Kept deliberately (the column header and row alignment stay stable across tiers), but
  a future pass may prefer to hide the column outright.

## Gates

- `apps/nao`: `npm run typecheck` clean; `npm test` **403/403 pass** (was 380 — 23 new); `npm run lint`
  clean ("No ESLint warnings or errors").
- `npm run build` succeeds; every `(app)` route renders `ƒ` (server-rendered on demand) and the four
  public routes stay `○`.
- `node tools/context_sync.mjs --check` passed; `git diff --check` clean.
- The pre-existing `tests/authz.test.ts` suite (16 handlers, gate-first, ROUTE_POLICY conformance)
  passes unchanged — nothing in this change touches what it guards.

## Blockers

None.

memory: nao viewer read-only UX — mutating controls are now rendered inactive up front instead of
firing and being refused, and a read-only caller gets one notice under the sub-nav. The mechanism is
`apps/nao/src/lib/naoAccess.ts` (pure) + `src/components/NaoAccess.tsx` (context/hook/`ControlScope`
fieldset), and it DERIVES everything from `authz.ts`'s `ROUTE_POLICY` + `satisfies` — a control names
the route key it calls (`'POST /api/seeds'`), never a role, and `MUTATING_ROUTE_KEYS`/`isReadOnlyRole`
are computed from the matrix's own keys, so a route whose required tier changes needs no UI edit. The
tier comes from `resolveNaoRole()` in the `(app)` layout (now `async` + `force-dynamic`) and is never
re-derived in the browser. PRESENTATION ONLY: no route, no required role and no `guardRole()` call
changed, and tests pin the boundary both ways (no component may reference `guardRole`/`requireRole`;
no route file may reference `naoAccess`). `LoaderPanel` and `BrainPipelinePanel` are listed in
`PENDING_GATE_ADOPTION` in `tests/naoAccess.test.ts` and each still needs its one-line `ControlScope`
wrap.
