---
title: Advance Run 4 trust unit base after accepted U3
summary: Advanced only the per-unit Run 4 landing base to the accepted U3 head and regenerated local-only attestation evidence from fresh four-route probes.
type: session
scope: run4
status: canonical
updated: 2026-07-29
---

# Advance Run 4 trust unit base after accepted U3

Issue: #244

Branch: `ci/run4-u3-pretrust-unit-base`

## Attempted

- Advance the dedicated trust-unit landing base after accepted U3, retaining the immutable product base, frozen exclusions, and 115-path / 8,500-line caps.
- Regenerate local-only deployment attestation only through the checked-in generator after fresh handler-level probes of all four configured routes.

## Changed

- Advanced `RUN4_UNIT_BASE_SHA` in the release gate and CI together from `425b6ff4633014583d329ee46d3ebe17c01601b1` to the exact accepted U3 head `38205d2532ef528ab3752d9013d457c2ee994314`.
- Regenerated `supabase/deploy-attestation.json` through `record-attestation` with fresh local 401 route evidence.

## Decided

- This is a base advance only: it neither changes product behavior nor relaxes any unit or product envelope.
- The route probes are local-only evidence and make no hosted deployment-parity claim.

## Left

- Reconcile the trust unit against this unspent stacked base after this narrow CI PR lands.

## Blockers

- None.

## Verification

- Release-gate tests, configuration validation, zero-delta pre-edit landing measurement, fresh attestation validation, context check, and focused diff review were run before push.

memory: none
