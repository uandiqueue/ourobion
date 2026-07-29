---
title: Advance Run 4 unit base after PR 231
summary: Advanced only the per-unit Run 4 landing base to the post-PR-231 integration tip and regenerated local-only attestation evidence from fresh four-route probes.
type: session
scope: run4
status: canonical
updated: 2026-07-29
---

# Advance Run 4 unit base after PR 231

Issue: #242

Branch: `ci/run4-post231-unit-base`

## Attempted

- Advance the dedicated per-unit landing base after #229 and #231 merged, retaining the immutable product base, frozen exclusions, and 115-path / 8,500-line caps.
- Regenerate the local-only deployment attestation only through the checked-in generator after fresh handler-level probes of all four configured function routes.

## Changed

- Advanced `RUN4_UNIT_BASE_SHA` in the release gate and CI together from `e975a21e8c75b6ec93ff0f90954a87bc4948c2dd` to the exact integration tip `425b6ff4633014583d329ee46d3ebe17c01601b1`.
- Regenerated `supabase/deploy-attestation.json` through `record-attestation` with fresh local 401 route evidence.

## Decided

- This is a base advance only: it neither changes product behavior nor relaxes the unit or product envelopes.
- The route probes are local-only evidence and make no hosted deployment-parity claim.

## Left

- Reconcile and assess the pending U3 and trust units against this new, unspent base after this narrow CI PR lands.

## Blockers

- None.

## Verification

- Release-gate tests, configuration validation, zero-delta pre-edit landing measurement, fresh attestation validation, context check, and focused diff review were run before push.

memory: none
