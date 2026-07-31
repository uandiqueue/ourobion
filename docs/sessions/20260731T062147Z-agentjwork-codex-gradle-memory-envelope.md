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
- Heavy validation remains intentionally deferred until the orchestrator releases the single-host build slot.

## Left

- Clean Windows ARM64 debug-build evidence, including observed available memory, on this exact branch.
- Full Flutter analyze/test and PR CI after the heavy-validation slot is released.

## Blockers

- The shared 16 GB host is currently reserved for higher-priority UI/device acceptance; no Gradle, Flutter, emulator, Docker, or package-install process was started by this session.

memory: none
