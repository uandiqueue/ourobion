# Issue #226 ? nao login UI and authenticated browser acceptance

memory: none

## Attempted

- Read issue #226 and every comment before resuming its UI/browser half from issue #308.
- Reused the clean dedicated fix/nao-ui/browser-acceptance-226 worktree and fast-forwarded it from
  c6a2ca6 to the verified integration head 3584d75.
- Exercised the hosted Supabase project bewwvcksgpxoomyjavjp; no Docker stack, membership grant,
  auth-row write, provider call, or remote D1 write was performed.
- Used an out-of-repo Playwright harness because the Browser plugin was not available.

## Changed

- Removed the login inputs' inline outline:none and added a visible 3px keyboard-focus ring.
- Rendered a copy-gated explanation when /login?denied=nao is reached.
- Raised the public explainer caption from the 3.91:1 muted token to the secondary text token.
- Added a compact small-screen explainer layout so its sign-in CTA is within the 390x844 first fold.
- Added four focused source-conformance regressions in apps/nao/tests/loginUx.test.ts.

## Decided

- Drove the denial path with the existing disposable non-member account from the ignored root
  environment; the authorized member email was resolved read-only by its issue-recorded UUID because
  the ignored test_credential.md email field was not email-shaped. Values were never emitted.
- Initialized only the rebuildable local D1 projection from apps/nao/src/db/schema.sql after the
  existing local database reported no such table: papers; Supabase remained hosted.
- Screenshots were taken only on empty login states or with identity/credential regions explicitly
  masked. Evidence remains outside the repository under C:\tmp.

## Left

- The exact-final-head matrix, CI result, merge SHA, and issue closure are recorded on issue #226.
- The disposable curator membership cleanup remains on Session A's Run 4 test-data cleanup ledger.

## Blockers

- The workspace image viewer could not launch because codex-windows-sandbox-setup.exe is absent.
  Browser assertions still checked geometry, contrast, focus, overflow, page identity, masks,
  framework overlays, console errors, failed requests, and HTTP errors.
- The required patch helper failed for the same missing executable; explicit git apply unified
  diffs were used as the reviewable fallback.
