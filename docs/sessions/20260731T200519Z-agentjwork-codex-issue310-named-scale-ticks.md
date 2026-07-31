---
title: Named-scale integer tick fallback
summary: Rounded Armstrong and Bristol fallback ticks before formatting so fractional inputs cannot render fractional category labels.
type: session
scope: m5a
status: canonical
updated: 2026-07-31
---

# Named-scale integer tick fallback

Issue: #310 ? parent goal: #308 ? branch: `fix/m5a/named-scale-integer-ticks` ? target: `dev-phase2-run4`.

## Attempted

- Resolve the known #285 named-scale fallback defect independently of stale-base-blocked PR #289.
- Preserve registry-driven tick placement and named endpoint wording.

## Changed

- Armstrong and Bristol fallback labels now format `tick.roundToDouble()` rather than the original fractional tick.
- Added focused regression coverage proving both named scales render `2.5` as integer label `3`.

## Decided

- The named-scale switch already selects a category with `tick.round()`, so its fallback must display that same rounded category instead of a contradictory fractional value.
- Real-device rendering is not applicable to this forced defensive input: registry `valueStep: 1` prevents fractional named ticks in normal chart generation, while the pure formatter test directly drives the fallback seam.

## Left

- Commit, exact-head landing gate, push, CI, self-merge, and manual issue closure.
- PR #289 remains untouched until Session A advances `RUN4_UNIT_BASE_SHA`, as directed by #308.

## Blockers

- The repository patch helper could not launch because `codex-windows-sandbox-setup.exe` is unavailable; reviewable edits were applied within the isolated worktree.
- The fresh worktree needed dependency resolution and a copied gitignored `.env.public` asset before Flutter tests could build; no credential value was printed or committed.

## Verification

- Focused `flutter test --no-pub test/m5a_baselines/metric_axis_policy_test.dart`: 6 passed, 0 failed.
- `flutter analyze --no-pub`: PASS, no issues.
- Full `flutter test --no-pub -j 2`: 461 passed, 26 skipped, 0 failed; includes the non-diagnostic copy gate.
- Quote gate: not applicable; no paper text, quotations, or offsets changed.
- `git diff --check`: PASS.

memory: none
