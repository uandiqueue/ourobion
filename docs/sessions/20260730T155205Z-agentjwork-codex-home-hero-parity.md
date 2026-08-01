---
title: Home hero and coverage artwork parity
summary: Restored the full-width Home status hero and bounded coverage artwork, then verified the disposable demo flow on a physical Huawei.
type: session
scope: ui
status: canonical
updated: 2026-07-30
---

# Home hero and coverage artwork parity

Issue: #259 · branch: `fix/ui/home-hero-parity-259-primary` · base: `dev-phase2-run4` @ `3a31bf2`

## Attempted

- Match the accepted Home composition at 360dp and 412dp without changing live-data semantics or
  introducing new image assets.
- Preserve the shared `GoldCard` treatment while clipping opaque artwork inside the card rather
  than clipping the card shadow.
- Run the required incremental semantic-graph refresh. `graphify update .` timed out once after 60
  seconds; no generated view step or tracked graph change followed.
- Build, install, sign in, and inspect the disposable demo flow on the connected Huawei. The first
  install was correctly rejected because the installed package used a different signing
  certificate; after the owner confirmed that its empty local sandbox could be erased, only
  `com.ourobion.app` was uninstalled and the fresh debug APK was installed.

## Changed

- Made the Home system-status hero fill the available width inside the existing 22dp gutters and
  measure exactly 244dp outside, with a 24dp outer radius.
- Moved the hero artwork and live content into an inset rounded clip while keeping the shared card
  outermost, so the opaque image cannot form a square seam and the intended card shadow survives.
- Kept live values in a separately padded foreground; made the longest real status label scale down
  on one line and made the coverage suffix responsive at narrow widths.
- Added the accepted existing flower asset to the Coverage CTA as a bounded, upper-right,
  non-semantic decorative layer behind separately padded live content.
- Added widget regressions for exact hero geometry, clip ownership/radii, accepted assets, Coverage
  behavior at 360dp and 412dp, and the longest populated hero state without overflow. Updated the
  existing source-alignment assertion for the 242dp inner / 244dp outer frame.

## Decided

- `82 /100 coverage` is not a hardcoded or diagnostic health score. Hosted read-only verification
  found `engagement_state.dqs_7day_avg = 81.83`, rounded to 82; the `Thriving` label is the existing
  UI threshold for coverage at or above 80. Its wording is a separate product-copy concern.
- The demo values are synthetic: 21 gut rows carry `simulated:hack-mvp-demo`, 21 wearable rows carry
  `seed`, the latest sleep value is 376 minutes, and the latest gut-comfort value is 5.
- The reported Archive error was not reproduced. Two physical opens rendered the stable empty
  archive and trend chart, while the exact authenticated archived/snoozed query returned HTTP 200
  with zero rows; the disposable account has one active insight.
- The owner authorized all in-app operations for the disposable test account. No Android settings,
  other apps, real health data, or provider calls were touched.

## Verification

- Focused Home analyzer: clean.
- Focused Home regressions: 19 passed.
- Full `flutter analyze --no-pub`: clean.
- Full `flutter test --no-pub`: 413 passed, 26 skipped by design.
- `git diff --check`: clean.
- Independent Sol-high adversarial review: PASS after strengthening clip ownership, 360/412
  Coverage coverage, worst-state overflow coverage, decorative semantics, and shadow preservation.
- Physical Huawei: Home, Scan, Insights, Archive, and Profile rendered without visible regression;
  sanitized full-resolution evidence is stored outside the repo under `C:\tmp\ourobion-259-*.png`.

## Left

- CI and merge of the issue branch into `dev-phase2-run4`.
- Decide separately whether the coverage-derived `Thriving` label should be replaced with wording
  that cannot be read as a health-state claim.
- Investigate Archive further only if a reproducible error message, screenshot, or authorized
  sanitized process log becomes available.
- Incremental graph refresh remains pending in an environment where `graphify update .` completes.

## Blockers

- None for #259. The Windows restricted-token `apply_patch` wrapper still fails across the ordinary
  workspace; this session used the owner-approved primary-checkout exception and Codex's own patch
  runner, never a PowerShell/Python source-write workaround.

memory: none
