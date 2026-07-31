---
title: Android Gradle memory envelope
summary: Bounded the default Android Gradle/Kotlin process for the documented 16 GB Windows setup and documented serialized local verification.
type: session
scope: build
status: canonical
updated: 2026-07-31
---

# Android Gradle memory envelope

Issue: #276 · branch: `fix/build/gradle-memory-276` · base: `dev-phase2-run4` @ `3a31bf2`

## Attempted

- Replace the unbounded 8 GB Gradle heap request with the measured Run 4 debug-build envelope that fits the documented 16 GB Windows host.
- Make local Android verification explicitly serial without weakening the build or CI gates.

## Changed

- Set Gradle to a 1.5 GB heap, 768 MB metaspace, and 256 MB code cache; limited Gradle to one worker and Kotlin to the same bounded process.
- Added a source guard for those exact limits and the removal of the former 8 GB / 4 GB settings.
- Documented the Windows host envelope, serial test/build order, and a reproducible ARM64 debug-build command in the Biotope README.

## Decided

- The committed values reproduce the successful Run 4 bounded ARM64 debug build. They constrain local build tooling only and do not skip build stages or change runtime functionality.
- Heavy validation ran only after the orchestrator released the single-host build slot. The branch
  first merged `origin/dev-phase2-run4` at `a5d5953b` normally; no rebase or force operation was used.

## Verification

- Public build config was copied mechanically from the main worktree. Its only key names were
  `SUPABASE_URL` and `SUPABASE_ANON_KEY`, and `git check-ignore` confirmed `.env.public` stayed ignored;
  no value was printed or committed.
- Focused Gradle-memory guard: 1 passed, 0 failed.
- `flutter analyze --no-pub`: clean in 79.3 seconds.
- `flutter test --no-pub --concurrency=1`: 416 passed, 26 expected skips, 0 failed in 84.2 seconds wall time.
- `flutter build apk --debug --target-platform android-arm64 --no-pub`: succeeded in 282.5 seconds
  wall time (Gradle 279.2 seconds) using the committed default properties, with `GRADLE_OPTS`,
  `JAVA_OPTS`, and `JAVA_TOOL_OPTIONS` absent and no command-line JVM override.
- The spawned Gradle daemon was PID 29992. Its command line contained `-Xmx1536m`,
  `MaxMetaspaceSize=768m`, and `ReservedCodeCacheSize=256m`, and did not contain `-Xmx8G`.
- On the 16,111 MB host, free physical memory was 3,012 MB before the build; the bounded in-flight
  sample window observed a 2,535 MB minimum; immediate post-build/pre-cleanup free memory was 1,581 MB.
  After stopping only verified daemon PID 29992 and confirming it exited, free memory recovered to
  3,129 MB. These are observed snapshots, not a continuous whole-build peak measurement.
- `flutter pub get` and the build produced lock/generated-plugin drift only; those generated changes
  were discarded, leaving no dependency or platform-generated delta in the issue branch.

## Left

- Exact-head GitHub CI and review on the issue PR.

## Blockers

- None.

memory: none
