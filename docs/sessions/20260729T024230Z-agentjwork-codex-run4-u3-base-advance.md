---
title: Advance Run 4 unit base for final U3 landing
summary: Advanced only the per-unit release-gate base to the current integration tip and regenerated local-only attestation provenance without changing caps or hosted claims.
type: session
scope: run4
status: canonical
updated: 2026-07-29
---

# Advance Run 4 unit base for final U3 landing

Issue: #238

Integration branch: `dev-phase2-run4`

## Attempted

- Advance the single-writer Run 4 unit base after the reconciled U1/U2/U4 and closeout landings, so
  the final U3 unit is measured from the exact current integration tip.
- Rebuild local function graphs, probe every release-attested function route, and regenerate the
  local-only attestation through the checked-in generator.

## Changed

- Advanced `RUN4_UNIT_BASE_SHA` in the release gate and CI from `789e6a0` to the exact integration
  tip `e975a21e8c75b6ec93ff0f90954a87bc4948c2dd`.
- Regenerated `supabase/deploy-attestation.json`; only its unit-base provenance changed because the
  function graphs, tool versions, and four 401 handler probes matched the existing evidence.

## Decided

- The immutable product base, frozen exclusion hashes, 115-path cap, and 8,500-added-line cap remain
  unchanged. No hosted deploy or hosted-parity claim was made.
- U3 will be reconciled only after this dedicated base-advance PR is green and merged.

## Left

- Rebase the reconstructed, secret-clean U3 lineage onto the advanced base, repair the remaining
  loader audit/UI gaps, and run final U3 acceptance on the exact PR head.

## Blockers

- None for the base advance. U3's 14+7 HTTP walk still requires recovery of its frozen five-claim
  verifier artifact or separate authority for a bounded live-provider run.

## Verification

- Release-gate tests: 12 passed, 0 failed.
- Release-gate config and fresh local runtime attestation: PASS.
- Base landing measurement before commit: 0 changed paths / 0 added lines.
- Context check: PASS.

memory: none
