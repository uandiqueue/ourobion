---
title: Bundle the canonical Biotope logo
summary: Replaced the auth lockup's decorative placeholder with the canonical Biotope vector mark and removed the retired green logo from the Flutter bundle.
type: session
scope: biotope
status: canonical
updated: 2026-07-28
---

# Bundle the canonical Biotope logo

Issue: #218

Branch: `feat/m1-ui/html-visual-fidelity`

Worktree: `/tmp/ourobion-wt-html-ui`

memory: none

## Attempted

- Bundled the canonical Biotope identity mark from `assets/ourobion-biotope-logo/` without introducing a binary asset delta.
- Retired the previous green logo from the shipped Flutter asset manifest and rendered the new vector mark in the shared auth lockup.
- Opened separate issue #223 for adopting the newly supplied `assets/ourobion-nao-logo/` identity in `apps/nao`; no Nao code or assets were included in this Biotope branch.

## Changed

- Added a byte-identical, app-local copy of `biotope-mark-light.svg`, a centralized brand asset constant, and `flutter_svg` rendering support.
- Replaced the decorative auth-logo placeholder with the canonical SVG while retaining the existing 78-by-78 lockup geometry and reduced-motion behavior.
- Narrowed the direct Flutter asset declaration so `assets/images/logo.png` is no longer bundled.
- Added regression coverage that checks canonical-source byte identity, bundle inclusion, retired-logo exclusion, SVG loader wiring, and successful widget rendering.

## Decided

- Kept the retired PNG tracked but excluded from the Flutter bundle. Deleting or replacing it would introduce a binary diff that the Run 4 landing gate intentionally rejects; manifest exclusion achieves the product requirement without weakening that gate.
- Kept Nao's identity refresh as its own issue and future session because it is a separate Next.js UI surface.
- Made no service, model, shared-contract, Supabase, migration, query, persistence, auth, or other data-layer change.

## Left

- Issue #223 tracks the Nao UI identity implementation after its currently untracked source kit is committed.

## Blockers

- None.

## Verification

- `flutter analyze --no-pub` → `No issues found!`
- Focused asset and shell visual tests → **59 passed, 25 skipped, 0 failed**. Skips are the existing generated-asset downscale checks.
- `flutter test --no-pub` → **353 passed, 26 skipped, 0 failed**. Skips are the existing generated-asset downscale checks and placeholder smoke test.
- Run 4 landing gate (`547280f…HEAD`) → **75 changed paths / 8,252 added lines**, within the 115-path / 8,500-line caps and with no binary/unparsable row.
- `git diff --check` → passed.
