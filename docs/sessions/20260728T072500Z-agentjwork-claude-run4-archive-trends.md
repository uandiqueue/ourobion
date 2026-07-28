---
title: Archive tab — historical trends alongside saved insights
summary: Made Archive a real look-back surface by adding real metric trends beside the archived cards, with explicit no-history and failed-load states and a retry on the shared trend widget.
type: session
scope: shared
status: canonical
updated: 2026-07-28
---

# Archive tab — historical trends alongside saved insights

Issue: #200

Branch: `feat/m5b-archive/trends-and-insights`

## Attempted

- Made Archive preserve both of the things a user looks back at, not just one.
- Reused the existing trend infrastructure rather than building a second one.

## Changed

- `archive_tab.dart` — added a `TRENDS` section under a `SAVED INSIGHTS` eyebrow, reusing
  `MetricTrendSection` and `MetricSeriesService`. Added try/catch around the archived-cards load
  with a distinct failed state and an explicit retry, mirroring the `profile_tab.dart` fix. Added
  an injectable `seriesService` so the widget is testable without a live Supabase client.
- `metric_trend_section.dart` (shared) — its error branch was a bare sentence with no way back in.
  Added `TrendCopy.retry` and an `OutlinedButton` calling `_load`. Purely additive, error-branch
  only; Home benefits from the same fix.
- `archive_status_widget_test.dart` — the three `ArchiveTab(...)` constructions now pass an inert
  fake series service. **No assertion was changed or removed**; without the fake these pre-existing
  tests would hit an uninitialised `Supabase.instance` and crash.
- New `archive_trends_widget_test.dart` (7 tests) and `archive_tab_copy_gate_test.dart`.

## Decided

- **Real data only.** A metric with no keys renders `TrendCopy.emptyTitle`/`emptyBody`; a selected
  metric with an empty in-window series renders `TrendCopy.noValuesForMetric`. Both assert **no
  chart is painted**, so an absent series can never be mistaken for a flat one.
- **Fixed the shared widget rather than duplicating it.** The shortcut was to embed
  `MetricTrendSection` as-is, but its error state dead-ended with no retry. Duplicating the widget
  to add a button would have re-derived axis maths for no reason; adding the retry upstream is a
  smaller diff that also fixes Home.
- Both failure paths are tested for **recovery**, not just for showing an error: the retry succeeds
  and the real content appears.

## Verification actually run

- `flutter analyze` — `No issues found!`
- `flutter test` — **271 pass, 26 skipped**, independently re-run by the orchestrator.
- Pre-existing `insight_status_contract_test.dart` and `archive_status_widget_test.dart` both green,
  so the `archived` status contract and the swipe-right round trip are intact.

## Left

- Not yet exercised on the physical device.

## Blockers

- None.

memory: none
