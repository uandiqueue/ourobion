---
title: Biotope and Nao product explainer surfaces
summary: Added the Home "What is Biotope?" entry and a native explainer screen, a public signed-out Nao explainer at /how-it-works, and the submission-facing system connection map with per-component evidence labels.
type: session
scope: run4
status: canonical
updated: 2026-07-30
---

# Biotope and Nao product explainer surfaces

Issue: #260 · branch: `feat/m1/run4-biotope-nao-explainer-260` · base: `dev-phase2-run4` @ `ea5fc82`

## Attempted

- Build a truthful product-explanation journey across both apps: an in-app Biotope explainer, a
  public signed-out Nao explainer, and a durable architecture record that separates what is
  implemented from what is merely configured.

## Changed

- **Biotope.** New `AboutBiotopeCard` (`m1_core/ui/widgets/`) — a full-content-width GoldCard on Home,
  inserted after the System Status hero / knowledge-base block and before the Signals grid. New
  static `HowOurobionWorksScreen` (`m1_core/ui/screens/`) — five sections plus two collapsed-by-default
  disclosures and a non-diagnostic closing note. Wired with the established root-Navigator +
  `MaterialPageRoute` idiom. The Home diff is two imports and one insertion; `_SystemStatusHero`,
  its artwork, and `_CoverageCard` were deliberately not touched so #259 stays independently mergeable.
- **Nao.** New public `/how-it-works` static server component outside the `(app)` group, allow-listed
  in `isPublicPath()` *before* the env-config read, `getSession()`, `verifyAccessToken()`, and the
  `nao_role()` RPC — so a missing config cannot block it. `README.md` corrected: `/` is still gated,
  `/how-it-works` is the one public page. No other route, gate, or matcher changed.
- **Docs.** New `docs/shared/hackathon/submission/system-connection-map.md`, linked as Appendix H of
  the submission write-up, with a seven-level evidence-label scheme applied per component.
- **Tests.** Four Flutter test files (`test/m1_core/`) and one Nao test file (`tests/howItWorks.test.ts`).

## Decided

- **Satisfy the intent of the two required Home tests rather than their letter.** `HomeTab` cannot be
  pumped — it calls `Supabase.instance.client` with no injection seam, and nothing in the repo pumps
  it. Instead of adding an injection seam (a refactor far beyond this issue), the card was extracted
  into its own pumpable widget, tested in a harness reproducing Home's real constraints, plus a
  source-conformance test proving Home wires it.
- **Test against the real 22px gutter, not the issue's stated 24dp/48dp.** `home_tab.dart:258` uses
  `EdgeInsets.symmetric(horizontal: 22)` with an in-file comment explaining it is deliberately the
  390px-reference figure and distinct from `BiotopeGeometry.screenHorizontalPadding` (24.0). The test
  asserts `width == screenWidth - 44`. Changing Home's padding to make a stated number true would have
  been the wrong direction of fit.
- **"Rename Getting Started" had no referent.** That string exists in neither the app nor the visual
  reference, so the owner's later "add a card" instruction was taken as authoritative.
- **Omit the privacy/help/about links.** The issue asks for them "when available"; no privacy, help,
  or about screen exists (only `consent_screen.dart`, an onboarding gate). No link was invented.
- **Deeper technical status lives in the connection map, not in the app.** The in-app explainer keeps
  the two disclosures deliberately claim-free ("some parts are in place today and others are planned")
  because the owner's guidance forbids asserting capability availability in product copy.
- **Record, don't silently reconcile, the stale `biotope-nao-link.md` prose.** It says the middleware
  "enforces authentication only"; the R4-U2 source is stronger (tiered `viewer`/`curator`/`admin`,
  re-read from `nao_role()` on every API call, CI-enforced). Correcting a canonical doc is its own
  reviewed change, so the discrepancy is documented in the connection map §5 instead.

## Left

- Physical Android screenshots. Not capturable here: no attached device (`adb devices` empty) and no
  AVD installed; `flutter devices` sees only Linux desktop. Recommended on the issue that this pair
  with #259's device QA. The automated width/semantics/overflow assertions stand in as executable
  evidence, and are not presented as a substitute for device capture.
- `graphify update .` and `npm run graph:view:write` — graphify is not on PATH in this WSL environment
  (project-bounded to the Windows toolchain), so the semantic-graph refresh is deferred to a session
  running there.

## Blockers

- None blocking the PR.

## Verification

- Flutter (`apps/biotope`): `flutter analyze` → **No issues found**. `flutter test` → **408 passed,
  26 skipped, 0 failed** (full suite, not just the new files).
- Nao (`apps/nao`, Node v26.5.0 — the system Node 20 cannot run this project, `engines.node >= 26`):
  `npm run typecheck` clean; `npm run lint` → no warnings or errors; `npm test` → **327 tests, 326
  pass, 1 skip (pre-existing platform skip), 0 fail**; `npm run build` succeeded, with `/how-it-works`
  emitted as `○ (Static)` while `/` remains `ƒ (Dynamic)`.
- Nao runtime, signed-out, via project-bounded Playwright/Chromium at `localhost:3000`:
  `/how-it-works` returns 200 at 1440x900 and 390x844 with no redirect; no horizontal overflow at
  390px (`scrollWidth 390 == clientWidth 390`); all nine approved copy strings present; "Sign in to
  nao" navigates to `/login`; `/`, `/papers`, `/ingest`, `/loader` each redirect to
  `/login?redirectedFrom=…`; `/api/claims` returns **307** to `/login`, not 200-with-data.
- `node tools/context_sync.mjs --fix-index` run; the new doc is indexed.

memory: none
