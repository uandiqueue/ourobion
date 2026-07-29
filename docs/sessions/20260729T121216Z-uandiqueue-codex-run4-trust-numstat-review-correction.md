---
title: Run 4 trust numstat final review correction
summary: Closed the remaining hunk-header NUL path and replaced overstated numstat recovery coverage with an executable adversarial matrix.
type: session
scope: run4
status: canonical
updated: 2026-07-29
---

# Run 4 trust numstat final review correction

PR: #241 · branch: `feat/brain/run4-u3-trust-plumbing`

## Attempted

- Address the two remaining medium review gaps on exact pushed head
  `343191f7852b42c11693860f84e8de2451ae1698`: raw NUL acceptance in a hunk-header suffix and
  insufficient executable coverage for the exceptional source-text numstat recovery.

## Changed

- Reject a raw NUL before parsing every hunk header. File headers and added bodies remain NUL-free;
  a removed historical body line remains the only raw-NUL exception.
- Replaced the stateful recovery test with a fresh-fixture factory that retains Buffers and cannot
  leak mutations between vectors.
- Added executable positives for omitted counts and multi-hunk zero-count summation; direct
  `checkLandingDelta` wiring; and an actual `productLandingDelta` assertion proving
  `tools/brain-ingest/src/verify/artifact.ts` used the recovery path.
- Added executable rejection vectors for invalid UTF-8 and NUL-bearing HEAD blobs, absent HEAD
  paths, non-modified status, traversal/space/image paths, non-Buffer patches, binary markers,
  second patch/path material, malformed file and hunk headers, count mismatch, context,
  no-newline markers, zero changes, NUL-bearing hunk headers, and NUL-bearing added bodies.
- Added an executable acceptance assertion for a raw NUL in a removed body line only.

## Decided

- Appended the second amendment to `D-241-SOURCE-TEXT-NUMSTAT-RECOVERY`: the narrow recovery stays
  byte-oriented and fail-closed, with removed historical content as its sole raw-NUL allowance.
- The previous session's statement that adversarial patch coverage existed was overstated. The
  pushed suite then contained only one positive plus image and HEAD-NUL negatives; this correction
  records and closes that evidence gap rather than treating prose as coverage.

## Left

- PR #241 remains open for review and CI. This session does not merge it or close issue #240.

## Blockers

- None.

## Verification

- Node v26.5.0.
- `node --test tools/run4_release_gate.test.mjs`: 15/15 passed, including every vector listed
  above.

memory: none
