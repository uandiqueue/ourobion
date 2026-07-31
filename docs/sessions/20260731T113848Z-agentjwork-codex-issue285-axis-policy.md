---
title: Registry-driven M5a trend-axis policy
summary: Replaced hardcoded trend-axis metric keys with a public Dart registry package and explicit cross-language value-step metadata.
type: session
scope: m5a
status: canonical
updated: 2026-07-31
---

# Registry-driven M5a trend-axis policy

Issue: #285 · branch: `fix/m5a/registry-axis-policy-285` · base: `dev-phase2-run4` @ `c6a2ca6`

## Attempted

- Remove the M5a trend chart's hardcoded discrete-metric key switches so new whole-step metrics
  cannot silently receive fractional gridlines.
- Make the Flutter app consume the shared Dart registry through a real local package and public
  barrel, without a cross-module private implementation import or a generated duplicate registry.
- Keep validation within the low-memory constraint: lightweight Node typechecks/tests only; no
  Flutter suite, Gradle, Docker, emulator, or device process.

## Changed

- Added optional-with-default `valueStep` to the TypeScript interface, Zod schema, Dart mirror,
  parity parser, and registry documentation. Declared step 1 on the 13 existing ordinal/UI-step
  metrics plus `stool_variability`, `log_completeness`, and `step_count`.
- Converted the Dart mirror into local package `ourobion_metrics`: private
  `lib/src/registry.dart`, public `lib/ourobion_metrics.dart`, package manifest, and Biotope path
  dependency/lock entry.
- Replaced the trend tick and bounds key switches with `metricByKey`, `valueStep`, and `scale`
  policy. Ordinal tick selection and numeric stepped ticks now stay on the declared value grid;
  continuous metrics retain `niceTicks`.
- Added schema, exact-policy, TS↔Dart parity, public-package boundary, pure tick-math, and
  registry-to-axis regression coverage, including `stool_count` over 1–2.
- Updated the canonical registry design/readme and added an active registry-to-trend-axis
  coupling guard.

## Decided

- `valueStep` is top-level rather than nested under `scale`: `step_count` is discrete but
  intentionally has no bounded scale. Absence normalizes to null so existing and continuous
  metric definitions stay backward-compatible.
- `type` and `ui.inputType` are not axis policy. They expose 13 obvious whole-step metrics but
  cannot classify derived or sensor metrics that have no UI input.
- Metric-specific label wording remains separate from axis discreteness; only tick placement and
  bounds became registry-driven.
- No ADR or durable-memory record is needed: this implements the already-canonical
  registry-as-truth architecture and the issue's specified package boundary.

## Verification

- Shared TypeScript contract typecheck: clean.
- Metric-view TypeScript typecheck: clean.
- Metric-view lightweight Node suite: 20 passed, 0 failed.
- `git diff --check`: clean.

## Left

- Run focused/full Flutter analyze and tests when the owner confirms memory is safe.
- When #282 lands and this branch is rebased, remove its explicit `stool_count` known-gap
  expectation and point the guard at registry `valueStep`; #282's guard file is absent from this
  exact base, so it was not fabricated here.
- Incremental graphify refresh is deferred under the same low-memory restriction.
- PR review/CI, push, issue comment, and PR creation remain with the parent orchestrator.

## Blockers

- No implementation blocker. Flutter execution is intentionally deferred due to the reported
  approximately 2.1 GB free RAM.

memory: none
