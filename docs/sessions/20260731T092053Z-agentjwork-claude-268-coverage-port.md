---
title: Port and repair #268 acceptance coverage on the merged implementation
summary: The original port added 251 acceptance tests. Later repair work added real request and widget evidence, two narrow behavior-preserving production test seams, and honest citation fixtures; #284 through #287 remain filed and unfixed.
type: session
scope: ui
status: canonical
updated: 2026-07-31
---

# Port the #268 acceptance-test coverage onto the merged implementation

Issue: #282 · branch: `test/ui/run4-268-coverage-282` · base: `dev-phase2-run4` @ `42ae771`

## Attempted

- Close the gap left when #268 landed via PR #279: the implementation shipped, but the acceptance
  tests it specified did not. The merged base carried the same 57 test files as the pre-existing
  baseline and moved the suite 413 → 415, roughly +2 tests for the whole contract.
- Do it as a pure coverage unit — adapt the tests written alongside #268 to the merged
  implementation's API rather than replacing that implementation with the one they were written for.

## Changed

The original port changed `apps/biotope/test/**`. The later repair also changed
two behavior-preserving production test seams, the M3 public facade/imports,
the direct-dev dependency declaration, and this session record; the details
below supersede the original tests-only statement.

- `m2_self_report/` — `scan_globe_states_test.dart`, `inline_control_range_test.dart` and
  `scan_test_support.dart` added; `scan_sweep_test.dart` and `scan_tab_widgets_test.dart` rewritten;
  `daily_log_partial_write_test.dart` extended to all seven daily-core metrics at both range bounds.
- `m5a_baselines/` — `metric_trend_axis_test.dart`, `metric_trend_axis_widget_test.dart`.
- `m5b_insight_engine/` — `citation_link_test.dart`, `provenance_citation_link_widget_test.dart`,
  `archive_empty_state_widget_test.dart`.
- `m1_core/` — `home_completeness_copy_test.dart`, `profile_preference_truthfulness_test.dart`.

## Decided

- **Port the tests rather than re-land the implementation.** #279 was already merged and device-QA'd;
  replacing freshly merged code to suit a test suite would churn working software. The tests moved to
  the code.
- **Never weaken an assertion to make it pass.** Every agent was told that where the merged code fails
  a contract requirement, the correct output is a reported finding, not a softened test. Four such
  findings came back and are filed rather than accommodated.
- **Derive from the registry, not from hardcoded lists.** Both the inline-range guard and the axis
  guard parse `shared/metrics/registry.ts`/`.dart` plus the implementation's own key set, so drift in
  either direction fails the build instead of silently passing.
- **The known `stool_count` axis gap is pinned as explicitly non-endorsed** — the guard fails if it
  grows *or* if it is fixed, so closing that bug forces the guard to be updated rather than leaving a
  stale allowance behind.

## Verification

- `flutter analyze --no-pub`: **No issues found.**
- Full `flutter test --no-pub -j 2`: **667 passed, 26 skipped, 0 failed** — run twice, identical.
  Baseline on this branch was 416; the unit adds **251 tests**.
- Focused: `m2_self_report` 203 (from 40) · `m1_core` 111 (from 88) ·
  `m5a_baselines` + `m5b_insight_engine` 211/1 skipped.
- `scan_globe_states_test.dart` was reported as possibly flaky by a concurrent agent; run three times
  in isolation and twice inside the full suite, all green. The original failure was another agent's
  untracked file mid-compile in the shared worktree, not a flake.
- `git diff --check`: clean. `context_sync --check`: passed.
- Two false-pass traps were caught inside the new tests themselves: Flutter reuses `State` across
  `pumpWidget` calls of the same unkeyed widget, so fixture loops silently re-asserted the first case.
  Both were mutation-checked afterwards — injecting the real DOI into the hostile-input list fails the
  suite, as it must.
- Citation fixture provenance was corrected during the later repair; see the
  authoritative reconciliation below for the real DOI, accepted edge, and
  committed internal-corpus fixture now used by these tests.

## Current reconciliation (authoritative correction)

The original port recorded 251 added acceptance tests on its then-current
merged base. Later repair work is part of this same coverage unit and
supersedes any earlier statement here that it changed tests only.

- The latest verified full Flutter run is **693 passed, 26 skipped, 0 failed**.
  Do not infer a new whole-suite delta from this log: the original 251-test
  comparison and the later repair evidence were taken on different merged
  heads.
- The repair added two narrow, behavior-preserving production test seams:
  `ProfileTab` accepts an optional `ProfileService` and user id, and `ScanTab`
  accepts optional deterministic load/sync/save/engagement callbacks plus a
  sweep-floor duration. Production construction supplies none of them and
  continues to use its existing Supabase-backed paths.
- `http: ^1.6.0` is a direct development dependency only. An offline
  `http.BaseClient` now drives the real `DailyLogService.saveFieldAnswer` path,
  proving the existing-row PATCH predicates/payload and absent-row INSERT,
  rather than only modeling those writes in a pure helper.
- The Scan coverage now pumps the actual injected `ScanTab` state machine for
  success and failure sequencing. The direct-component and mirror coverage is
  retained as supplemental coverage, not presented as proof of the actual tab.
  The sweep test and production `ScanTab` use the M3 public facade; that facade
  now explicitly exports the legitimately public `WearableSyncRow`.
- Citation fixtures use the real iScience DOI
  `10.1016/j.isci.2026.116224`, title *Unraveling the gut microbiota-brain
  axis: Mechanisms, pathophysiology, and therapeutic opportunities.*, year
  2026. The fully cited edge copies the recorded accepted A8 artifact:
  `gut_comfort_score|correlates|mood_score`, population `IBS patients comorbid
  with anxiety and depression`, evidence tier 4, high impact, supports, and
  its recorded quote spans/locators. It does not invent verification, serving,
  score, direction, or a second citation. The unavailable-link fixture uses
  the committed internal record `corpus:gut-mood-cohort-2024`, *Gut comfort and
  mood in a longitudinal cohort* (2024), never a fabricated corpus record.
- False-pass repairs are explicit: widget loops use distinct keys so Flutter
  cannot reuse the first fixture's State; real tab/service tests complement
  source mirrors and pure payload models; DOI/title metadata is paired only
  with its recorded paper; and #286's HTTP, dot-segment, case, and semantics
  weaknesses remain named known-gap tests, not accepted behavior.
- The current coverage branch merged `dev-phase2-run4` at
  `c6a2ca64298998205a09451f78a6bfc63afa1a03`. This is test and documentation
  evidence only; it does **not** claim strict exact-head release evidence or a
  completed Run 4 promotion.

## Defects found in the merged implementation (filed, not fixed)

- **#284 — Home `CoverageCard` claims "Every channel captured today" from a score of 60.**
  `streakWorthy = (dqs ?? 0) >= 60`; with weights 25/25/20/10/7/7/6 a 60 is urine + stool + bites,
  leaving four of seven channels unlogged. #268 fixed the hero labels and missed this card on the same
  screen. The most user-visible of the four — Home is the demo's landing page.
- **#285 — `stool_count` renders fractional trend ticks.** `trendAxisTicks` is a hardcoded switch over
  seven keys; `stool_count` is an active, `baselineApplicable`, `stepper_0_10` whole count that is not
  among them, so a 1–2/day series draws a gridline at `1.5`. Its sibling `mosquito_bites` is covered.
- **#286 — citation link hardening.** `paperUri` is safe (scheme/host invariant holds under hostile
  input), but `10.1234/../../evil` normalises to `https://doi.org/evil` — a mis-resolution rather than
  a rejection; case is not canonicalised, diverging from the pipeline's `normalizeDoi()`; and the
  control is not flagged `isLink` with no destination exposed to assistive tech.
- **#287 — Scan.** An expanded gap card has no tap target (`onTap: expanded || saving ? null`), making
  the existing collapse branch dead and leaving a lone card impossible to close without answering it.
  Separately, the 2.4 s sweep floor is not gated on reduce-motion, so those users wait for an
  animation they cannot see.

Also recorded: #268 required user-facing copy explaining the exact score and bucket semantics, and no
such surface exists in the merged app — `HowOurobionWorksScreen` is gate-tested to contain no digits
and no "coverage"/"score"/"%" wording, so it structurally cannot carry it.

## Left

- The four filed defects, #284 through #287. They remain filed and are not
  fixed by the original coverage port or its repair.
- No push, PR edit, or issue comment was made by the repair. Local commits add
  the narrow production test seams/facade cleanup and evidence corrections
  described above.

## Blockers

- None.

memory: none
