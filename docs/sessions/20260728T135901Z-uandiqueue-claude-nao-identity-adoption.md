---
title: nao identity adoption (issue #223) + un-issued nao-UI gap triage
summary: Adopted the Ourobion Nao identity kit across the nao operator UI (top bar, login, favicons, tokens), added a narrow recorded exception letting the Run 4 landing gate accept allowlisted brand-asset binary rows, drove the /login click-path in real Chromium, and opened tracking issues for the three nao-UI register gaps that had none.
type: session
scope: nao
status: canonical
updated: 2026-07-28
---

# nao identity adoption (issue #223)

Issue: #223 (`feat(nao-ui): adopt the new Ourobion Nao identity`)
Issues opened this session: #226 (B-UI5), #227 (B-UI7), #228 (B-UI6)
Worktree: `/home/uandiqueue/project/ourobion-wt-nao-identity`
Branch: `feat/nao-ui/nao-identity`, cut from `dev-phase2-run4`

Orchestrated session: six bounded subagents (Sonnet) owned asset/UI implementation, token
reconciliation, the release-gate exception, browser evidence, regression tests, and docs; the
orchestrator reviewed every diff, made the design and gate decisions, and applied the fidelity
corrections listed under Changed.

## Attempted

- Adopt the supplied `assets/ourobion-nao-logo/` identity across the nao operator UI without
  redrawing any artwork, preserving routes, auth, search, dashboard behaviour and every data/API layer.
- Establish, rather than assume, how Next 15 resolves favicons when file-convention icons and an
  explicit `metadata.icons` both exist.
- Find every nao-UI item in the Run 4 pending-build register with no GitHub issue, and advance the
  ones that were advanceable in this environment.

## Changed

**Identity kit committed.** `assets/ourobion-nao-logo/` (DESIGN.md, README, `color/colors.{css,json}`,
4 logo SVGs, 8 PNGs, favicon set) landed as the source of truth. `apps/nao/public/brand/` carries
byte-identical copies of the 5 SVGs + 3 favicon rasters.

**Top bar** (`TopBar.tsx`, `shell.css`) — the supplied `nao-mark-dark.svg` at a fixed 40px, the kit's
documented legibility floor; bar height 62→68px with the sticky `.subnav` offset moved in lockstep.
The hand-built wordmark is restacked as kicker-over-name to mirror the lockup, in lowercase Outfit
300/200, both lines in the kit's `--nao-wordmark` teal. Divider pipe removed. The mark is `alt=""
aria-hidden` because the adjacent visible wordmark already names the button; the button carries
`aria-label="ourobion nao — Overview"`.

**Login** (`login/page.tsx`) — the full vertical lockup at 240px, on the page canvas **above** the
card rather than inside it. Two corrections the first screenshot round forced: at 180px the
`ourobion` kicker was not readable (the lockup must be sized for the wordmark, not just the 40px mark
floor), and the card surface `--surface` (#102832) is *lighter* than the `#0B1D24` floor the kit
specifies for the dark artwork — `--bg` is exactly #0B1D24, so the canvas is the only surface on that
screen the dark variant is specified for.

**Favicons** — both icons are served from `public/brand/` and pinned through `metadata.icons`;
`src/app/` deliberately contains **no** `icon.*` files, and the stale generic `src/app/icon.png` is
deleted.

**Tokens** (`theme.css`, `palette.ts`) — the kit's brand-role tokens (`--nao-bg/-ring/-coil-1..5/
-node/-envelope/-wordmark`) added verbatim, plus the kit's light palette under its own
`.nao-light` / `[data-theme="light"]` scope. No light mode was introduced; `:root` stays
`color-scheme: dark`. Semantic state colours (`--state-mid` amber, `--state-hold`) are deliberately
kept out of the coil ramp because they communicate status, not brand. `palette.ts` had no drift —
its ramp already matched the kit; only its source-of-truth comment changed. The legacy `--wordmark:
#e7f1f3` was left untouched (nothing reads it) rather than silently repointed.

**Release gate** (`tools/run4_release_gate.mjs`) — see Decided.

**Tests** — `apps/nao/tests/brand.test.ts` (14 tests): sha256 byte-identity for all 8 copied
asset pairs, `metadata.icons` URLs resolve under `public/`, `src/app/` holds no `icon.*` files, no
`/brand/ourobion-` references remain in `src/`, and every `/brand/...` string in source resolves to a
real file. Each was negative-controlled (tamper, then confirm the intended failure, then restore).
`tools/run4_release_gate.test.mjs` gained coverage for the new gate branch.

**Docs** — `docs/nao/nao-app-design.md` §7/§8 reconciled to the new kit (shared ring, distinct
nucleus, dark-primary, 40px floor, clear space); `apps/nao/README.md` gained a Brand assets section
and the copies-not-originals rule. The design doc's "Manrope for UI/body" claim was **wrong** — the
app has only ever loaded Outfit + JetBrains Mono; the doc was corrected to match the code.

## Decided

- **The Run 4 landing gate accepts allowlisted binary asset rows (Jayden, this session).**
  `checkLandingDelta` failed closed on any `-\t-\tpath` numstat row, which made it structurally
  impossible to land an identity kit — verified: both adding a PNG and *deleting* `icon.png` produce
  that row. Jayden's call was that an asset PR is a legitimate special case. Implemented as narrowly
  as possible: an explicit path allowlist (`assets/ourobion-nao-logo/`, `apps/nao/public/brand/`,
  `apps/nao/src/app/icon.png`) plus a path-count cap (24) and a byte cap (2 MB), both failing closed.
  A non-allowlisted binary row still fails with the original message. Allowlisted rows contribute 0
  added lines but still count toward the changed-path cap. **Widening the allowlist is a per-asset-PR
  human decision, not a routine edit.**
- **`RUN4_UNIT_BASE_SHA` was deliberately NOT advanced.** Advancing it fails
  `checkDeployAttestation` with "provenance drifted", and re-recording the attestation needs a local
  Supabase serve probe — Docker is not running on this machine. Headroom against the existing base
  `547280f` was ample (59/115 paths, 5,861/8,500 lines consumed before this unit).
- **A deleted binary measures 0 bytes because of its `D` name-status letter, never because
  `cat-file` failed.** The first implementation caught any git error and returned 0, which would let
  a real large blob past the byte cap on a transient failure. Corrected, with a test asserting an
  *added* path whose `cat-file` fails must throw.
- **One favicon mechanism, not two.** Evidence (Next 15.5.4 `resolve-metadata.js` source +
  build-output inspection): an explicit `metadata.icons` *overrides* file-convention icons entirely
  rather than merging — setting only `icons.icon` made the file-convention apple-touch-icon link
  disappear even though the file still built its own route. A file left in `src/app/` therefore looks
  load-bearing while contributing nothing, which is precisely how a stale mark survives a rebrand.
- **The unused master-brand files in `public/brand/` (`ourobion-mark-dark.svg`, `-512.png`,
  `ourobion-lockup-dark.svg`) were left in place.** They are the master Ourobion brand, not nao's, and
  no acceptance criterion asks for their removal; the no-stale-references test guards the real risk.
- **B-UI6 stays deferred and out of this PR** — see Left.

## Left

- **B-UI5 (#226) — partially closed.** The unauthenticated half of the `/login` click-path is now
  driven for real in headless Chromium: `/` → 307 → `/login?redirectedFrom=%2F` through the actual
  middleware, keyboard tab order email→password→submit, brand SVG 200, and a bogus-credential submit
  producing a real `role="alert"` with no navigation and no uncaught exception. Both `<link>` icon
  URLs were fetched from the browser and returned 200. Screenshots at 1440×900, 1024×768, 768×1024
  and 390×844. **Not proven: authenticated sign-in, and the top bar in the authenticated shell** —
  every non-login route is middleware-gated, so the branded top bar has not been seen in a browser.
- **B-UI7 (#227) — partially closed.** Local production build evidence recorded on this branch; a
  green local build is *not* deployment evidence and Worker-secret delivery remains untested.
- **B-UI6 (#228) — deferred, with its true cost now written down.** The dropdown is not the blocker:
  `ingestControl.ts` rejects any seed outside the static `INGEST_SEED_TOPICS` before dispatch, so
  wiring db seeds is an authz'd control-plane contract change (read `ingestion_seeds` under
  `guardRole('curator')`, preserve static-wins-on-collision, confirm the workflow input accepts
  arbitrary slugs) that deserves its own review surface.
- At 390×844 the login composition is the tightest of any width tested — fine, but worth re-checking
  if a shorter mobile viewport ever becomes a real target.
- The two-reviewer rule does not apply here: no `shared/` contract type was touched.

## Blockers

- **Docker is not running**, so there is no local Supabase. Authenticated browser traversal and any
  attestation re-record are blocked on it. Hosted projects remain out of bounds (B-PL19).
- Chromium needed shared libraries absent from this WSL2 image and there is no sudo; it was run by
  pointing `LD_LIBRARY_PATH` at an unrelated conda env that already had them. Nothing was installed
  and no repo dependency changed — but this is a machine-local workaround, not a reproducible CI path.
- Playwright was deliberately kept **out of the repo** (an out-of-repo harness under the scratchpad):
  adding it would put a lockfile diff into the landing budget.

memory: none
