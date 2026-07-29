---
title: Scan tab scanning-motion restyle
summary: Restyled the Scan surface around a real scanning sweep over the channels that can report, gated on the OS reduce-motion setting, without touching the logging path or making the unbuilt environment channel look operable.
type: session
scope: shared
status: canonical
updated: 2026-07-28
---

# Scan tab scanning-motion restyle

Issue: #201

Branch: `feat/m2-scan/scanning-motion`

## Attempted

- Built the design's `scanSweep` motion as a real Flutter animation over the channel list.
- Kept every existing logging interaction identical.

## Changed

- `scan_tab.dart` — added `ChannelScanSweep`, an `AnimationController`-driven translucent gold band
  translating down through the channel rows (`Alignment(0, -1.2 + t * 3.4)`, matching the design's
  `translateY(-120%) → translateY(220%)`). Wrapped the two channels that can actually report
  (`WearableSyncRow`, `_SelfReportRow`) and extended channel-row visibility from `idle` to
  `idle || scanning` so there is something for the sweep to travel across.
- New `test/m2_self_report/scan_sweep_test.dart` — 7 tests.

## Decided

- **`EnvironmentRow` sits OUTSIDE the sweep, deliberately.** It reports `NOT BUILT`, so sweeping it
  would imply it is being scanned when it cannot report anything. It is rendered as a sibling rather
  than a descendant, and a test asserts it is never a descendant of `ChannelScanSweep` — a
  structural guarantee rather than a visual convention. The row itself was not modified at all: no
  `onTap`, no `GestureDetector`, doc comment intact.
- **Reduce-motion is read on every build, not once in `initState`.** A perpetual ambient loop is
  exactly what that OS setting exists to stop, and reading it once would miss a mid-session change.
  The pre-existing orb bloom highlight was brought under the same gate.
- The band is wrapped in `IgnorePointer` so a decorative overlay can never intercept a tap meant for
  a channel row.

## Verification actually run

- `flutter analyze` — `No issues found!`
- `flutter test` — **270 pass, 26 skipped**, independently re-run by the orchestrator.
- `test/m2_self_report/` — all pass, including the pre-existing
  `scan_tab_widgets_test.dart`, `scan_tab_copy_gate_test.dart` and
  `daily_log_partial_write_test.dart`.
- The reduce-motion test is a real negative: it asserts the band is *absent* under
  `MediaQueryData(disableAnimations: true)`, which is precisely what regresses if the gate is
  dropped.

## Left

- Not yet exercised on the physical device; the animation is covered by widget tests only.

## Blockers

- None.

memory: none
