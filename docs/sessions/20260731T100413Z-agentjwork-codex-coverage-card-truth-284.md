---
title: Coverage card truthfulness
summary: Gated Home’s exact all-channel completion statement on canonical daily DQS 100 while retaining the established high-coverage treatment from 60 upward.
type: session
scope: m1
status: canonical
updated: 2026-07-31
---

# Coverage card truthfulness

Issue: #284 · branch: `fix/m1/coverage-card-truth-284` · base: `dev-phase2-run4` @ `f82a7038`

## Attempted

- Correct the Home CoverageCard’s distinction between qualifying coverage (the existing 60-point visual treatment) and complete daily channel capture.
- Add focused executable coverage for the exact values identified by the issue.

## Changed

- Kept the existing `dqs >= 60` visual high-coverage state and disabled-card behavior.
- Made `Every channel captured today` and its matching detail render only when canonical `dqs == 100`.
- Rendered the factual 60–99 state as `Coverage recorded today` with its score out of 100 and a prompt to run a sweep.
- Preserved the established below-60 `Coverage in progress` and null/not-swept states exactly.
- Added independent CoverageCard widget tests for 0, 59, 60, 70, 80, 85, 99, 100, and null, including lower-state tap behavior, plus replacement-copy validation through the shared non-diagnostic gate.

## Decided

- High coverage is a UI threshold distinct from fully captured daily channels; the exact completion assertion must not be inferred from the 60-point streak threshold.

## Verification

- Initial focused widget test before the review-driven lower/null guards: 7 passed.
- The expanded focused suite requires a fresh run once the device memory constraint clears.
- `flutter analyze --no-pub`: clean.
- Copy-guideline parity guard: 4 passed.
- `node tools/context_sync.mjs --check`: passed.
- `git diff --check`: clean.

## Left

- Local commit only, per owner instruction; no push or PR was created.

## Blockers

- The standard `apply_patch` helper could not launch (`codex-windows-sandbox-setup.exe` missing). After two no-write failures, used the owner-approved direct Codex patch-engine fallback only; no shell or Python source-write workaround was used.
- The fresh worktree initially lacked Flutter package resolution and its required untracked `.env.public` asset. `flutter pub get` and a local copy of the checked-in `.env.public.example` restored verification; generated plugin and lockfile drift was restored to its exact pre-command HEAD state before tests. The local `.env.public` remains untracked and is not part of this change.

memory: none
