---
title: Run 4 U5 execution check and stop handoff
summary: Passed the local API-integrity suite, proved the named U5 paper remains correctly held from insights, preserved the interrupted correction stack, and wrote the continuation record.
type: session
scope: shared
status: active
updated: 2026-07-28
---

# Run 4 U5 execution check and stop handoff

## Attempted

- Froze the active issue #187 U2/U3 reconciliation writer without discarding its working tree.
- Inspected the U5 worktree, current local Supabase status, Docker ownership, and local database state.
- Attempted to rebind the shared local stack to U5; the action was rejected because another worktree
  could be disrupted, so it was not bypassed.
- Attempted the safer direct protected-function route; extracting a runtime-owned internal credential
  was rejected, so it was not bypassed.
- After the user confirmed U3 was complete, rebound the local stack to U5, reset the local DB, and ran
  the complete zero-provider API-integrity harness.
- Resumed the exact cached DOI artifact with its recorded immutable inputs, loaded it locally, reran the
  three-stage pipeline, and queried final cards/provenance.

## Changed

- Added `docs/temp/run4/continuation-status.md` as the exact stop/resume authority.
- Linked the continuation record from the Run 4 cockpit.
- Recorded API integrity 20/20, DOI run `d3c2020a`, the final projection counts, U3 final head
  `7676702`, and the external session's audit/migration/UI preservation notes.

## Decided

- Claim API-integrity Pass 1 only: 20/20 passed with zero provider spend.
- Do not claim named-paper Pass 2: downstream projections exist, but zero cards cite the U5 edge.
- Do not disturb or probe credentials from a runtime owned by another worktree.
- Keep paper-derived serving fail-closed while the U5 edge is `uncertain` / `hold`.

## Left

- Compare final U3 head `7676702` with the interrupted issue #187 patch, execute combined SQL/runtime
  evidence, resolve the U5 hold/serving gate, integrate final UI, run Android/full-suite gates, and
  resolve the immutable cap.

## Blockers

- U5 edge is not servable.
- Issue #187 contains an interrupted, uncommitted older-U3 reconciliation patch.
- Product landing delta exceeds the accepted Run 4 cap.

memory: none
