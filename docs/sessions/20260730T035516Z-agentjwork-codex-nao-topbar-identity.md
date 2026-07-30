---
title: Complete Nao top-bar identity
summary: Removes the hand-built top-bar wordmark so one supplied Nao mark provides the button's sole accessible name at the documented 40px floor.
type: session
scope: nao
status: canonical
updated: 2026-07-30
---

# Complete Nao top-bar identity

## Attempted

- Continued issue #223 from exact `dev-phase2-run4` commit
  `349cd8bb6e3ae99ab99075e6e010a035165ca4c6` in an isolated worktree.
- Audited the authenticated top-bar mark, its manual HTML lockup, CSS, and brand regression coverage.

## Changed

- Kept only the supplied `/brand/nao-mark-dark.svg` inside the Overview button.
- Made the image's exact `ourobion nao — Overview` alt text the button's sole accessible name,
  with no competing `aria-label`, `aria-hidden`, or reconstructed wordmark spans.
- Removed the obsolete lockup typography CSS while retaining one nonshrinking 40x40 mark rule.
- Extended brand source guards to pin the asset URL, exact alt text, single-image/no-span structure,
  absent recreated-wordmark selectors, and `width: 40px; height: 40px; flex: none`.

## Decided

- Preserve the supplied asset byte-for-byte; do not redraw, approximate, or rebuild its wordmark.
- Make no asset, backend, auth, route, API, database, or data-contract change.

## Left

- Authenticated browser traversal at 1440x900 and 390x844 remains explicitly deferred to open issue
  #226. The Browser plugin is absent, the repo has no Playwright workflow, and no authenticated test
  state was supplied; this session does not fabricate auth or weaken middleware.
- Keep #223 open and stop before commit, push, or PR for independent review.

## Blockers

- The authenticated shell cannot be rendered honestly in the current bounded environment without
  completing #226's real sign-in prerequisite.

## Verification

- Focused brand regression suite: 16/16 passed.
- Nao lint and `tsc --noEmit` passed; full Nao suite: 307/307 passed.
- Nao production build passed. Existing missing-local-env, webpack-cache, and Supabase Edge-runtime
  warnings were recorded observationally; no warning was suppressed or converted into evidence.
- Run 4 release tests: 17/17 passed; config/workflow and fresh local attestation passed.
- Frozen-base pre-patch landing: 61 paths / 4,837 added lines; direct patch: 4 paths / +100/-55;
  projected: 65 paths / 4,937 added, within 115/8,500. Product cap remains record-only/over at 375 paths / 54,128 added.
- Context and diff whitespace checks passed.

memory: none
