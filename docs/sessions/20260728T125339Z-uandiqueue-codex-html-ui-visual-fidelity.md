---
title: HTML UI visual-fidelity integration
summary: Aligned Biotope's rendering and motion with the supplied HTML reference while retaining every existing data path, then verified and published the UI-only change set.
type: session
scope: biotope
status: canonical
updated: 2026-07-28
---

# HTML UI visual-fidelity integration

Issue: #218

Branch: `feat/m1-ui/html-visual-fidelity`

Worktree: `/tmp/ourobion-wt-html-ui`

memory: none

## Attempted

- Matched the supplied Biotope HTML reference's porcelain, gold, botanical, glass, geometry, and motion language across the working Flutter shell without changing the existing source-of-truth or derived-data paths.
- Preserved all real profile, coverage, insights, archive, scan, authentication, and preference behaviours while replacing only their visual presentation and animation.
- Ran the complete Flutter static-analysis and widget-test gates before publication.

## Changed

- Added a floating translucent five-tab navigation shell, reusable screen entrance transition, shared visual/motion geometry tokens, and the reference-style independently drifting living backdrop. Reduced-motion requests render static presentation frames.
- Rebuilt sign-in, sign-up, waking, Home, Scan, Insights, Archive, and Profile presentation around existing controls and data. Home's larger botanical hero and Profile's wide camellia identity card now use the supplied generated assets; Insights and Archive also use the accepted existing artwork.
- Matched reference timing where it is visual-only: screen entrance 480 ms, navigation/card settle 260 ms, scan sweep 1,500 ms with the matching cubic curve, completion reveal 380 ms, and ambient breathing only where reduced motion permits it.
- Added visual-fidelity regression coverage for navigation/backdrop/screen motion, Home hero geometry, and the Profile identity card.
- Corrected the new backdrop widget test to accept the test harness's additional `CustomPaint`; it now checks that a still painted frame renders under reduced motion rather than incorrectly asserting it is the only painter.

## Decided

- Kept prototype-only claims and controls out. Coverage remains labelled `/100 coverage`, no fabricated status/index is restored, the Environment row remains truthfully inert, and profile detail remains the actual loaded name/email/city/region rather than mock account text.
- Kept every existing callback and persistence path: the animation wrappers delay neither route semantics nor change what is written. The Insights card exit runs alongside the pre-existing save/dismiss callback.
- The hard data-layer audit found no changed service, model, shared-contract, Supabase, migration, query, or persistence code. The only changed diff lines that mention `ProfileService.updateProfile` and `AuthService(Supabase.instance.client)` are formatter-only reflows of existing calls in `profile_tab.dart`; no argument, target, or ordering changed.

## Left

- This is a code-level rendering/motion fidelity pass. Pixel screenshots on a physical 390×844 device and design-owner visual sign-off remain useful follow-up checks.
- Generated image blobs were intentionally not rewritten or downscaled; the existing asset test records those size checks as skipped because binary replacement requires a separate human-approved asset decision.

## Blockers

- None. `apps/biotope/.env.public` was temporarily created from the committed credential-free `.env.public.example` solely so Flutter could bundle the declared test asset, then removed before staging.

## Verification

- `flutter analyze --no-pub` → `No issues found!`
- `flutter test --no-pub` → **351 passed, 26 skipped, 0 failed**. Skips are the pre-existing generated-asset downscale checks and placeholder smoke test.
- `git diff --check` → passed.
- Explicit data audit: changed/untracked paths are Flutter UI widgets/screens/theme/tests plus this session record only; `shared/`, `supabase/`, `apps/nao/`, `tools/`, `model-training/`, all `impl/`, and all `models/` paths are unchanged.
