---
title: Port the #268 acceptance-test coverage onto the merged implementation
summary: Added 251 tests covering the acceptance criteria #268 specified but PR #279 landed without, changing no production code — and surfaced four real defects in the merged app, including a Home card claiming every channel was captured from a score of 60.
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

Only `apps/biotope/test/**`. **No production file was modified, and none needed to be.**

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
- Citation tests use a real DOI, `10.1038/s41586-020-2649-2` (Harris et al., *Array programming with
  NumPy*, Nature 585, 2020), already committed at `tools/brain-ingest/tests/fixtures/`. That fixture
  pairs the real DOI with an unrelated placeholder title; the pairing is deliberately never
  reproduced, and the genuine title and year are used instead.

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

- The four filed defects. None is fixed here; this unit changes no production code by design.
- Commit, push and PR — none performed, per the standing instruction.

## Blockers

- None.

memory: none
