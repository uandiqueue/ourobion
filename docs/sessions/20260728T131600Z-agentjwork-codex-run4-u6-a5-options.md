---
title: Run 4 U6 A5 daily-log options brief
summary: Added a decision-neutral storage-options brief; no schema, code, shared contract, or hosted change was made.
type: session
scope: shared
status: canonical
updated: 2026-07-28
---

# Run 4 U6 A5 daily-log options brief

Issue: #220
Branch: `docs/run4-u6a/daily-log-options`
Worktree: `C:\project\ourobion-wt-u6-a5-options`

## Attempted

- Started from the required current `origin/dev-phase2-run4` base: the setup helper initially
  cut the worktree at `6c44d44`; I fast-forwarded it cleanly to
  `900459924bb45fcc883a1a4a86858887931bf7cf` before editing.
- Read the current A5 register and U6 scope, the legacy daily-row migration, continuity-primitives
  migration, joint-series view, M2 writer, and DQS normaliser.
- Wrote a documentation-only decision brief; no hosted resource, schema, app code, shared contract,
  release-gate file, asset, or model-training file was touched.

## Changed

- Added `docs/temp/run4/u6-a5-daily-log-options.md`, comparing four possible A5 designs without
  recommendation: defer/add legacy columns; long-form values beside the grandfathered row;
  header/value pair; and rename/recast with compatibility.
- Each option covers raw-truth/RLS ownership, old-row compatibility, partial writes, DQS,
  migration/backfill/rollback, review cost, and the cost of deferral.

## Decided

- No A5 implementation choice is made here. Jayden must record the product/storage decision
  before U6b metric authoring starts.
- Any later `shared/metrics` change requires actual Jayden and Alton PR reviews.

## Left

- Record Jayden's option decision and only then plan the implementation slice and its required
  compatibility/DQS tests.
- A4 events/state-band view work is distinct from A5 and remains outside this documentation slice.

## Blockers

- A5 is intentionally decision-gated; no technical defect was claimed or altered.

memory: none
