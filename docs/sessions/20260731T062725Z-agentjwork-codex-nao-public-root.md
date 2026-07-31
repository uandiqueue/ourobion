---
title: Make the Nao root the public Ourobion explainer
summary: Made `/` the canonical public explainer, moved the authenticated Overview to `/overview`, and preserved every operation behind the existing auth boundary.
type: session
scope: nao
status: canonical
updated: 2026-07-31
---

# Make the Nao root the public Ourobion explainer

Issue: #226 · branch: `fix/nao/public-root-explainer` · base: `dev-phase2-run4` @ `d2967a8`

## Attempted

- Make the main Nao URL explain Ourobion before asking visitors to sign in.
- Reuse the accepted `/how-it-works` composition rather than duplicating or redesigning it.
- Keep corpus, control, and API surfaces behind the existing JWT and `nao_role()` gates.
- Respect the constrained 16 GB development machine by running install, typecheck, tests, build, and
  runtime checks serially.

## Changed

- Added the canonical public `/` route and extracted the existing explainer into the reusable
  `OurobionExplainer` server component; its **Sign in to nao** control links to `/login`.
- Moved the authenticated ingestion dashboard from `/` to `/overview` without changing its D1 data
  behavior. Login default navigation, the top-bar brand action, the Overview tab, and its fallback
  now all target `/overview`.
- Kept legacy `/how-it-works` links working through a permanent redirect to `/`.
- Allow-listed only the exact root plus the existing login/static/legacy routes before any
  environment, session, JWT, or membership read. `/overview` and all other operation/API paths stay
  outside the allowlist.
- Expanded source-conformance tests for public-route ordering, privileged-import isolation, the
  legacy redirect, protected dashboard relocation, Login CTA, and authenticated-shell navigation.
- Reconciled the Nao README, canonical Nao design, and submission-facing system connection map.

## Decided

- `/overview` is the protected dashboard URL because it preserves the product's existing Overview
  vocabulary while making `/` unambiguously public.
- `/how-it-works` is a compatibility redirect, not a second copy of the page; `/` is canonical.
- This change does not close #226: real authenticated login, top-bar, protected navigation, and
  sign-out still require owner-session browser acceptance.

## Verification

- Package-local locked install: `npm ci` completed with 597 packages.
- `npm run typecheck`: clean.
- Targeted single-concurrency tests: 24/24 passed (`howItWorks.test.ts`, `brand.test.ts`).
- Full Nao single-concurrency test suite: 328/328 passed, 0 failed, 0 skipped.
- `npm run build`: passed; manifest emits `/` as static and `/overview` as dynamic. The build only
  reported expected missing-local-secret warnings and the pre-existing Supabase Edge-runtime warning.
- HTTP smoke at `http://127.0.0.1:3000`: `/` 200 with explainer and Login link;
  `/how-it-works` 308 to `/`; `/login` 200 with form; unauthenticated `/overview` 307 to
  `/login?redirectedFrom=/overview`. Root HTML contained no Overview dashboard content.
- Healthy isolated Next dev server intentionally left running for owner inspection: PID 29884,
  751.1 MiB working set at final check.
- `git diff --check`: clean.

## Left

- Drive #226's authenticated success, trusted top bar, protected navigation, failure, and sign-out
  paths in the owner's real browser session. No Browser connector or Playwright/Chrome run was used
  in this session.
- Incremental Graphify refresh remains deferred to a free heavy slot; the generated tracked graph
  view was not hand-edited.

## Blockers

- None for the public-root patch. The authenticated browser acceptance tracked by #226 remains an
  external owner-session evidence gap, so the issue and PR must remain open/unmerged.

memory: none
