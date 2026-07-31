---
title: Restore Scan inline-control interaction and reduced-motion behaviour
summary: Restored expandable GapCard collapse, removed the reduce-motion sweep wait, and made Scan's compact logging controls honour registry affordances.
type: session
scope: m2
status: canonical
updated: 2026-07-31
---

# Restore Scan inline-control interaction and reduced-motion behaviour

Issue: #287 · branch: `fix/m2/scan-collapse-reduced-motion-287` · base: `dev-phase2-run4` @ `c6a2ca6`

## Attempted

- Reconcile the Scan card re-tap, reduced-motion, and registry-affordance gaps with the documented Biotope HTML reference and the #268 acceptance record.
- Keep each inline answer on the existing targeted `saveFieldAnswer` path; no full daily-log route or whole-row write was introduced.

## Changed

- Restored the expanded GapCard tap action so its header can collapse the card unless that metric is saving; the existing one-open-at-a-time state transition remains unchanged.
- Moved Scan's 2.4-second normal-motion floor and 380ms result reveal onto `ScanGlobe` constants. Reduced motion now has no artificial floor while normal motion retains the reference timing.
- Replaced bare urine digits with named Armstrong colour swatches, bare stool digits with named shape-led Bristol rows, and the mosquito 0–20 chip wall with a 48dp stepper plus one explicit Save action.
- Added focused widget, semantics, range, collapse, explicit-save, and timing-wiring coverage that can replace the temporary #282 divergence pins when it lands.

## Decided

- The visual representations stay descriptive (colour/name and shape/name) and do not add diagnostic interpretation. Environment remains inert and no new route to the full daily log exists.
- The stepper derives its bounds from the complete options list, retaining every accepted mosquito-bite value from 0 through 20.

## Left

- Flutter tests, analyzer, device, Gradle, Docker, and emulator work were deliberately not run because this session was constrained to lightweight validation on the low-memory host. Dart formatting completed; the formatter reported the pre-existing unresolved `flutter_lints` package include in this worktree.

## Blockers

- None for implementation. Full execution evidence is intentionally deferred under the stated RAM constraint.

memory: none

## Continuation — independent-review remediation

### Attempted

- Address the independent review's NO-PASS at `88555e3`, specifically edit-state loss in the mosquito stepper, duplicated Bristol/Armstrong presentation truth, and false-pass control tests.

### Changed

- Passed `GapCard.currentValue` into the inline-control dispatcher. The mosquito stepper now starts from that value (or its lower bound), clamps it to 0–20, responds to later widget updates, and immediately guards a second Save until the parent saving cycle finishes.
- Extracted the Daily Log's complete seven-type Bristol painter into one public-within-M2 visual source used by both Daily Log and Scan. That source also owns all seven descriptive Bristol names and all eight Armstrong names/colours, eliminating the Scan copies.
- Replaced the shallow affordance tests with all-value mapping and semantics checks, exact Armstrong colour checks, seven distinct rasterised Bristol-shape signatures, lower/upper and edit-value stepper checks, no-write-before-Save and duplicate-Save guards, saving-inert checks, 48dp targets, and a 390×844 overflow check.
- Removed the source-string assertion that had overstated timing proof.

### Decided

- The shared Bristol names are appearance-only: `Separate firm pieces`, `Lumpy sausage`, `Cracked sausage`, `Smooth sausage`, `Soft blobs`, `Fluffy pieces`, and `Watery`. Existing Daily Log explanatory copy remains otherwise unchanged.
- The 2.4-second normal-motion floor and zero reduced-motion floor remain pure, tested constants. An actual `_runSweep` elapsed-time/state test is still required after rebasing with #282's injection seam; this branch does not claim that integration proof.

### Verification

- Dart formatting completed and parsed all six changed Dart files. `git diff --check` remained clean.
- Focused Flutter execution was not started: current free physical memory was 1.12 GB, below the session's safe threshold. Full Flutter analysis/suite, Gradle, Docker, emulator, and device work remain prohibited by the original constraint.

### Left

- On the #282/#287 rebase, invert the known-gap pins and add the injected `_runSweep` timing/state test covering both normal and reduced motion.
- Execute the focused Scan widget/sweep tests on a host with safe free memory, then the normal integration gates.

### Blockers

- Runtime test evidence is deferred only by the low-memory host constraint; the implementation itself is not blocked.

memory: none

## Continuation — Bristol canvas-size correction

### Changed

- Matched Scan's Bristol visual to the shared painter's original Daily Log coordinate space at exactly 52×32. The 50dp option row still has 18dp of vertical spare space around the centred visual.
- Made the distinct-shape test rasterise the shipped Scan `RepaintBoundary` and assert the actual `SizedBox` and `CustomPaint` are both 52×32, rather than painting the shared painter independently at a test-selected size.
- Updated the widget harness to use Scan's production 24dp horizontal screen padding. At 390dp width the card leaves 264dp for its inline content column; after the Bristol row's own padding, badge, gaps, and 52dp shape, 140dp remains for the longest name.

### Verification

- Kept runtime Flutter execution deferred under the already-recorded 1.12 GB free-memory constraint. Formatting, diff, and context checks remain the permitted evidence for this correction.

memory: none
