---
title: Issue 282 post-defect reconciliation
summary: Reconciled the #268 acceptance suite with the landed UI defect fixes while preserving its registry, accessibility, and link-safety guarantees.
type: session
scope: ui
status: canonical
updated: 2026-07-31
---

# Issue 282 post-defect reconciliation

Issue: #282 ? PR: #289 ? branch: `test/ui/run4-268-coverage-282` ? target:
`dev-phase2-run4`.

## Attempted

- Preserve and finish the existing uncommitted #282 reconciliation after #285?#287 landed.
- Diagnose the exact hosted Flutter failures without weakening production gates.

## Changed

- Updated the Scan acceptance harness for the Armstrong, Bristol, chip, and stepper controls now
  rendered by the merged app, including reachable bounds and explicit commit behaviour.
- Reconciled scan timing and collapse assertions with the landed reduced-motion implementation.
- Rebased trend-axis expectations on the registry-driven `valueStep` policy and removed only an
  impossible manually injected fractional tick outside the formatter contract.
- Reconciled DOI and citation-link tests with canonical case, dot-segment rejection, semantic link
  flags, ordinary-space trimming, and fail-closed control-character handling.

## Decided

- `trendAxisLabel` formats values emitted by `trendAxisTicks`; step validation remains owned by the
  registry-led tick generator and is exhaustively asserted over every emitted tick.
- Raw TAB/LF/CR wrappers remain malformed citation identifiers and are rejected before trimming;
  ordinary surrounding spaces are still tolerated.

## Left

- Commit this verified reconciliation, merge the then-current exact `origin/dev-phase2-run4` head
  without rebasing, rerun every required local gate, push, and wait for green CI before self-merge.

## Blockers

- None. GitHub aggregate log downloads timed out, but the check annotations and local exact test
  reproduction exposed the actionable failures.
- The Codex patch helper could not start because the Windows sandbox helper is unavailable; the same
  reviewable patches were applied with `git apply` inside this isolated worktree.

## Verification

- `flutter analyze --no-pub`: PASS.
- Focused axis + citation files: 43 passed.
- `flutter test --no-pub -j 2`: 738 passed, 26 skipped, 0 failed.
- `git diff --check`: PASS.

## Exact-head completion

- Re-fetched and verified `origin/dev-phase2-run4` at
  `253e0ad6db31bb2a134e47546ddaba84bf284639`; `git ls-remote` matched.
- Merged that exact tip without rebasing in `e519c0e290f366f29e83e39c5618fd072d7e40b7`.
- Post-merge `flutter analyze --no-pub`: PASS.
- Post-merge `flutter test --no-pub -j 2`: 738 passed, 26 skipped, 0 failed.
- Post-merge `node tools/context_sync.mjs --check`: PASS.
- Post-merge `git diff --check` and exact-base ancestry: PASS.

## Integration-head landing cap

- Hosted CI on `a101d6bf73d5558d18d60f990b49afa3bc042489` passed every functional job but
  failed the Run 4 landing cap at 9,581 added lines against
  `d880ed04091f8aa920294eb70db4a20263ddae4e`.
- Compacted only test presentation: comment-only and blank-only lines were removed, then
  semicolon-delimited statements were joined with a 200-character line bound. Production code,
  executable tokens, test cases, expected citation text, and exact offsets were unchanged.
- Fetched and verified current `origin/dev-phase2-run4` at
  `dea055c8155c1e9c6851931f4de9816a88d66b2d`, then merged it without rebasing in
  `90657c23eafd4d4de723e9f282c1557adfb7f850`.
- Exact head `77fcffb09f2c0311a0d06e27b5f07983467d2748`:
  - `flutter analyze --no-pub`: PASS, no issues.
  - `flutter test --no-pub -j 2`: PASS, 738 passed / 26 skipped / 0 failed.
  - `node tools/run4_release_gate.mjs landing --base d880ed04091f8aa920294eb70db4a20263ddae4e --head HEAD --max-paths 115 --max-added 8500`:
    PASS, 76 paths / 8,289 added lines / 0 binary paths.
  - `git diff --check`: PASS.

memory: none
