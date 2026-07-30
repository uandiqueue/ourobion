---
title: Fill the auth scaffold viewport
summary: Make BiotopeAuthScaffold expand to its viewport so positioned background layers do not end at the intrinsic auth-form height.
type: session
scope: m1
status: canonical
updated: 2026-07-30
---

# Fill the auth scaffold viewport

Issue: #257
Branch: `fix/m1/auth-scaffold-viewport-257`

## Attempted

- Reproduced the structural cause of the phone's truncated auth backdrop: the root Stack sized itself from its non-positioned scroll content while the backdrop was positioned.
- Added a focused default-font-scale 360x780 short-content regression for both auth modes, plus a separate long-body scroll-position assertion.
- The faithful narrow viewport also exposed an existing 70px overflow in the fixed-width brand-tagline Row.

## Changed

- Set `BiotopeAuthScaffold`'s root Stack to `StackFit.expand` so its background and decorative layers span the complete Scaffold body.
- Wrapped only the brand-tagline Row in `FittedBox(scaleDown)` so the existing lockup remains visible at 360px rather than overflowing.

## Decided

- Kept safe area, scrolling, keyboard behavior, backdrop, and decoration unchanged; the FittedBox is the narrow-width responsive companion required to make the real 360px viewport test truthful.

## Left

- None.

## Blockers

- None.

memory: none
