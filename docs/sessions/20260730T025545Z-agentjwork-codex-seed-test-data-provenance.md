---
title: Local test-data seeder provenance safety
summary: Registers explicit local-seed provenance and makes non-wipe replay fail closed before writes.
type: session
scope: db
status: canonical
updated: 2026-07-30
---

# Local test-data seeder provenance safety

## Attempted

- Continued issue #236 from exact `dev-phase2-run4` commit
  `46943a3b9fdd457fb051bf26572b7245d803269c` in an isolated worktree.
- Audited the local PowerShell/SQL seeder against the Run 4 provenance registry and loader guards.

## Changed

- Added a forward migration registering `seed:local-test-data` as an effective simulated marker
  owned by `scripts/seed-test-data.sql`, with `loader_writable = false`.
- Exported and mirrored that marker in Nao, and changed the drift test to compose registry seed rows
  across the original and all forward provenance migrations.
- Stamped both `daily_gut_rows.data_origin` and `wearable_daily.source` with the exact marker.
- Made non-wipe mode preflight both truth tables across the complete requested range, refusing
  NULL/real, unregistered, revoked, registered-real, and foreign provenance before any write.
- Made same-marker upserts fully deterministic and write-time guarded, and made the optional seeded
  antibiotic course idempotent.
- Added an executable disposable-Postgres regression harness; made psql failures process-fatal in
  the PowerShell runner with `ON_ERROR_STOP=1`.

## Decided

- Kept both destructive defaults unchanged: PowerShell `WipeFirst = true` and standalone SQL
  `wipe_first = 1`. The owner verdict on issue #236 was exactly `Follow recommendation`, preserving
  the default only for a dedicated, disposable local test user while non-wipe remains fail closed.
- Non-wipe mode is a replay path for this script's exact marker only; it is not a general overwrite
  path for other registered simulation writers.
- Production writers and the Nao loader's authoring permissions remain unchanged.

## Left

- Stop before commit, push, or PR so the orchestrator can assign independent review.

## Blockers

- None.

## Verification

- Focused Nao provenance/generator suite: 25/25 passed; final focused provenance + PowerShell parse
  rerun: 35/35 passed.
- Full Nao suite: 305/305 passed; `tsc --noEmit` passed.
- Seeder regression: 47/47 passed, including revocation-preserving migration reapply, registered-real
  refusal, missing/revoked marker destructive-wipe preservation, and byte-identical bystander
  isolation across all six wiped tables; disposable container removed.
- U3 database suite: 228/228 passed across all 38 migrations; disposable container removed.
- Run 4 release tests: 17/17 passed. The pre-patch `HEAD` baseline from `RUN4_UNIT_BASE_SHA` is
  52 paths / 4,150 added lines; the patch delta is 9 paths / +687/-44; the projected frozen-base
  landing is 61 paths / 4,837 added lines, within 115/8,500. Configuration/workflow and fresh local attestation gates passed.
- Harness syntax, context, and diff whitespace checks passed.
- No hosted/provider call, deployment, database reset, model training, or persistent runtime write.

memory: modified 0009
