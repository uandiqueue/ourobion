---
title: Home signals tiles press through to a real metric detail graph
summary: Wired the four dead Home "Signals today" tiles to a new metric detail view that charts that metric's real Supabase history with explicit loading/empty/stale/error states, made the tile a real accessible button, and fixed the Home drift the design export actually shows.
type: session
scope: shared
status: canonical
updated: 2026-07-28
---

# Home signals tiles press through to a real metric detail graph

Branch: `feat/m1-ui/signals-detail` → PR into `dev-phase2-run4`

Design reference: `Biotope Biomech Botanical.dc.html` (the Claude Design export), Home
"Signals today" block, lines 195–265.

## Attempted

- Verified Home against the design export block by block and fixed the genuine drift.
- Made all four "Signals today" tiles press through to a per-metric detail view backed by
  real `metric_daily_values` / `baseline_snapshots` reads.
- Re-checked that every value Home renders traces to a Supabase read or an honest empty
  state.
- Folded in two audit cleanups inside files this unit already owns (the orphaned Home
  ticker controller, and the dead `MetricSparklineStyle.progress` branch).

## Changed

### The core ask — the tiles now lead somewhere

- **`m5a_baselines/ui/screens/metric_detail_screen.dart`** (new, 674 lines) — one metric's
  real history. Reads the trailing 30 days from `MetricSeriesService` and the snapshot from
  `BaselineService` in one `Future.wait`, and renders:
  latest reading (formatted in the metric's own units) · its recency · its provenance
  (`self_report` / `wearable` / `signal`) · the chart · the baseline's mean, range, days of
  data, confidence and direction.
  **It reuses `TrendChartPainter` — the same painter Home's and Archive's trend sections
  use — rather than adding a second charting path**, and reuses `TrendCopy` for the
  window/error/retry strings so the three surfaces cannot drift apart.
- **`home_tab.dart` `_SignalsGrid`** — every tile is built through one `_tile()` helper that
  always passes `onTap`, pushing `MetricDetailScreen` on the root navigator. There is no
  longer a code path that renders a pressable-looking tile with no destination.
- **`metric_tile.dart`** — `MetricTile` is now a real button: `Semantics(button: true)` with
  a label composed from the tile's own rendered numbers plus an explicit press hint, over
  `ExcludeSemantics` so it is one node and not four unlabelled ones; `HitTestBehavior.opaque`
  so the whole 158px cell is the target; the design's `scale(.985)` press state via
  `AnimatedScale`, **gated on `MediaQuery.disableAnimations`**, with an instantaneous border
  brightening so press feedback survives reduce-motion.

### Honest states in the detail view

Four states, never conflated:

| State | What the user sees |
|---|---|
| loading | spinner; `_loading` is cleared on every path, so it cannot hang |
| error | `TrendCopy.loadError` **plus a retry that actually re-reads** |
| no history | "No readings for this signal yet" + why, and **no chart is painted at all** |
| real history | the chart, plus how stale the newest reading is (today / yesterday / N days ago) |

A single real reading draws a single real dot with "One reading so far. A line needs at least
two days." — no line to nowhere. A baseline row is rendered only when its number genuinely
exists on the snapshot, so a snapshot with no mean shows no "Average" row rather than a `0`.

### Home drift found against the design export

| Drift | Where | Fix |
|---|---|---|
| all four tiles pressable-looking but inert | `home_tab.dart:859-890` (old) vs design line 210 | every tile wired via `_tile()` |
| grid → Coverage card gap was 20px | `home_tab.dart:325` (old) vs design line 244 (`margin-top:13px`) | 13px |
| step count rendered ungrouped (`8204`) | `home_tab.dart:886` (old) vs design line 238 (`8,204`) | `formatGroupedInt` |
| delta text coloured from the baseline's `trend`, not from the delta shown | `home_tab.dart:798-802` (old) vs design lines 213/233 | colour from the sign of the rendered delta |

### Deliberate divergences from the design (data honesty wins)

- **No `/10` gut score.** Design line 218 shows `8.4/10`. The real signal is
  `gut_comfort_score`, a 1-5 self-report ordinal — kept at `/5`, extending the decision
  already recorded at the top of `home_tab.dart`. Pinned by a test that no `SignalsCopy`
  string contains `/10`.
- **Movement keeps a sparkline, not the design's 82%-filled progress bar** (design line 240).
  A progress bar needs a goal as its denominator and there is no step-goal column in
  `shared/metrics/`, in any migration, or anywhere in the app. This is also the audit's
  second item: the dead `MetricSparklineStyle.progress` branch defaulted to
  `progressFraction ?? 0`, so the only thing it could ever have rendered was a 0%-filled bar
  — a fabricated "you achieved none of a target you never set". **Deleted the branch** and
  recorded why on the enum.
- **"Steady" stays neutral-coloured**, where design line 219 tints it green. Green reads as
  movement in a good direction; a steady signal did not move.
- **Design blocks the implementation adds, not drift:** the design's Home ends at the
  Insights teaser; the app also renders Streak, Trends and Titles between Coverage and
  Insights. Those are real M6/M5a surfaces with real data — reported, not deleted.
- **Immaterial and left alone** rather than churned: hero status word 30px vs design's 31px;
  tile border/eyebrow use `primary`/`brandGoldLight` where the design uses
  `rgba(200,168,120,…)`/`#b09c78` (changing the former means touching shared `GoldCard`
  styling for ~1 shade).

### Reuse rather than a second implementation

- **`m5a_baselines/impl/metric_value_format.dart`** (new, pure, no package imports) — the
  four registry keys plus `formatMetricValue` / `metricValueSuffix` / `formatMetricDelta` /
  `formatDurationMinutes` / `formatGroupedInt`. Home's private `_formatSleep` and its four
  private key constants are gone; the detail view and the grid now format one metric
  identically by construction. (The old `_formatSleep` also truncated hours while rounding
  minutes, so 419.7 could read `6h 60m`.)
- **`chart_math.dart` `shortDateLabel`** — the `'24 Jul'` axis label moved out of
  `metric_trend_section.dart`'s private statics so both chart surfaces label axes identically.

### Audit cleanup #1 — the orphaned Home ticker

`home_tab.dart` created an `AnimationController(seconds: 1)..repeat(reverse: true)` that no
widget read: leftover from the rotating knowledge-base ticker removed in PR #202. It repeated
forever, burning frames, and unlike `_Breathe` it had no reduce-motion gate. Deleted, with a
`home_design_alignment_test.dart` assertion that no `..repeat(` survives in the file.

## Decided

- **The detail view is the destination, and it lives in M5a, not M1.** The design defines no
  drill-down, so this is a design decision. M5a already owns the series, the baseline, the
  chart math and the painter, so the screen sits with its data; M1's Home imports it exactly
  as it already imports `metric_tile.dart`.
- **No `shared/` change.** Nothing in this unit touches `shared/`, so the two-reviewer rule
  does not apply.
- **The screen-reader label is copy.** `MetricTileCopy.openHint` goes through
  `CopyRules.validateCopyString` like every painted string — a label that is read aloud is
  user-facing.
- **The chart's y axis is labelled with the stored unit** ("minutes asleep") because the
  painter plots stored values while the headline reads `7h 12m`. Saying so beats silently
  mixing units.

## Verification actually run

Windows, `dev-phase2-run4` @ `6c44d44`, worktree `C:\project\wt-signals-detail`.

| Gate | Result |
|---|---|
| `flutter analyze` | `No issues found!` |
| `flutter test` | **317 pass / 26 skipped** (312 + 5 new-file groups; 271/26 at PR #206) |
| `insight_status_contract_test.dart` | green |
| `archive_status_widget_test.dart` | green |
| `scan_tab_copy_gate_test.dart` / `scan_tab_widgets_test.dart` | green |
| `home_design_alignment_test.dart` | green (+7 new assertions) |
| `context_sync.mjs --check` | passed |
| landing gate vs `547280f` | `{"changedPaths":25,"addedLines":3083}` against 115 / 8,500 |
| **Physical Android traversal** | **done — Huawei YAL-L21, Android 10, 1080x2340** |

New tests: `metric_detail_screen_test.dart` (11 cases incl. no-history-paints-no-chart,
stale-says-how-old, retry-recovers, never-stuck-on-a-spinner),
`metric_tile_tap_test.dart` (7 cases incl. semantics-is-a-button, whole-cell hit target,
press scales, reduce-motion drops the animation but keeps the press),
`metric_value_format_test.dart`, `signals_detail_copy_gate_test.dart`.

### On-device traversal — 1080x2340, the exact panel that exposed the 9.5px overflow

Fresh account, real local stack over `adb reverse tcp:54321 tcp:54321`. Confirmed by looking
at it, not by inference:

- The 2x2 grid renders with **no overflow**, and `adb logcat` has **no** `RenderFlex` /
  `OVERFLOW` / `EXCEPTION CAUGHT BY` line across the whole walk.
- **Movement reads `5,200`, not `5200`** — the grouping fix is visible on the tile and again
  as the detail view's headline.
- **The press is visibly rendered.** Held on the HRV tile: its border brightens to the gold
  and the tile scales down, side by side with an unpressed neighbour.
- **Sleep** → `6h 40m`, "Recorded today · 28 Jul", "From a connected wearable", and a
  **14-dot real chart** from 15 Jul to 28 Jul with the axis labelled "minutes asleep" and
  gridlines at 400/450/500.
- **Gut comfort** → `4.0 /5`, "From your own log", 14 real dots on a 2–5 axis labelled
  "comfort out of 5". No `/10` anywhere.
- **Movement** → 14 real dots on a 4000–10000 step axis.
- **HRV, the honest empty state** → "No readings for this signal yet" + why, **no chart
  painted, and no DAILY HISTORY section at all**.
- All four detail views showed "No baseline yet" plainly, because this fresh account has no
  `baseline_snapshots` row yet. The **populated** baseline card (mean / range / days /
  confidence / direction, and the no-mean-means-no-Average-row rule) is covered by
  `metric_detail_screen_test.dart`, not by this walk: invoking `compute-baselines` from here
  now returns 401, because Run 4 changed the edge-function auth boundary.

`flutter analyze` / `flutter test` were run with `--no-pub`, because a fresh git worktree
cannot run `flutter pub get` on this box: creating the desktop plugin symlinks needs
Developer Mode or elevation and this shell has neither ("Building with plugins requires
symlink support"). Pre-creating the `.plugin_symlinks` entries as NTFS **junctions** (which
do not need elevation, and which Dart reports as links) makes `flutter pub get` succeed —
worth recording as the worktree workaround.

## Left

- **The populated baseline card was not seen on the device**, only in widget tests — the
  fresh fixture account has no `baseline_snapshots` row and `compute-baselines` now 401s from
  a local invoke (Run 4 auth boundary). Worth one glance once someone can run that function.
- The tile's pre-existing 1.6x-text-scale overflow (`metric_tile_overflow_test.dart`'s
  skipped case, O28) is untouched — the new press wrapper does not change layout.
- `MetricSparklineStyle` now has two cases; if a real step goal is ever stored, the
  Movement tile can regain the design's progress bar with an explicit no-goal state.

## Blockers

- **`C:` is essentially full and needs a human.** The first `flutter build apk` died with
  `java.io.IOException: There is not enough space on the disk` at **23 MB free** of 456 GB.
  Reclaiming space needs a delete, and `Remove-Item` on build directories and `flutter clean`
  were both refused by the local permission classifier. The build only completed because the
  disk drifted back to ~4 GB on its own; a single-arch `--target-platform android-arm64`
  debug APK then fit. `apps/biotope/build` is ~1.7 GB **per worktree** and there are ~30
  worktrees on this box. Not a code problem, but the next UI session will hit it again.
- **`gh issue create` and `docker exec … psql` are refused by the local classifier**, so this
  session opened no issue and could not touch the DB directly. The branch is pushed; the PR
  against `dev-phase2-run4` needs a human `gh pr create` (or the classifier relaxed).

## Notes for whoever repeats the device walk

- **Local fixture account:** `signalsdetail@ourobion.local` / `Ourobion!2026`, display name
  Jayden. 14 backdated days of `daily_gut_rows` + `wearable_daily`, written through PostgREST
  **as that user** so RLS applied normally (the same writes the app itself makes) — the DB was
  never touched directly. **HRV is deliberately absent** (HRV SDNN is iOS-only, memory 0004)
  so one Home screen shows three tiles with real charts and one exercising the honest
  no-history state.
- The app's `SUPABASE_URL` is `http://127.0.0.1:54321`, so a physical phone needs
  `adb reverse tcp:54321 tcp:54321`.
- **A fresh worktree cannot `flutter pub get`** on this box without Developer Mode or
  elevation. Pre-creating the desktop `.plugin_symlinks` entries as NTFS **junctions**
  (`mklink /J`, no elevation needed, and Dart reports them as links so flutter skips creating
  them) makes it succeed. `--no-pub` is enough for `analyze`/`test` once
  `.dart_tool/package_config.json` exists; the worktree also needs `.env.public` copied in,
  since it is gitignored.

memory: none
