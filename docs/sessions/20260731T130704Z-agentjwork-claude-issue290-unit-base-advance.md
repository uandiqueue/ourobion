---
title: Issue 290 Run 4 per-unit base advance
summary: Advanced the mutable Run 4 per-unit landing base from 42ae771c to the accepted PR #270 integration merge d880ed04, refreshed the recorded product-union snapshot, re-recorded the local-only deploy attestation through the checked-in generator, and left every cap, exclusion and non-acceptance posture unchanged.
type: session
scope: run4
status: canonical
updated: 2026-08-01
---

# Issue 290 Run 4 per-unit base advance

Issue: #290 - branch: `ci/run4/post288-unit-base` - base: `dev-phase2-run4` @ `d880ed04091f8aa920294eb70db4a20263ddae4e`

## Attempted

- Advance only the mutable per-unit landing base to the current accepted integration merge.
- Unblock the cap failure that turned the #282 acceptance-coverage branch red without any unit having
  written oversized code.
- Change nothing about the immutable product base, the MT4 exclusions, the binary allowances, or the
  explicit non-acceptance posture.

## Changed

- `tools/run4_release_gate.mjs`: `RUN4_UNIT_BASE_SHA` 42ae771c -> d880ed04, with 42ae771c retained in
  the superseded-values provenance block and the reason for the advance recorded inline.
- `.github/workflows/ci.yml`: the parsed `RUN4_UNIT_BASE_SHA` environment value, kept byte-identical to
  the source constant so the `config` gate's drift check stays meaningful.
- `tools/run4_release_gate.test.mjs`: the equality test, renamed to name the PR #270 merge it now pins,
  plus the recorded product-union snapshot refreshed to the measurement at this head.
- `supabase/deploy-attestation.json`: re-recorded through `record-attestation` only, with fresh local
  handler-level route evidence from an actual `supabase functions serve`. Never hand-edited.

## Decided

- The advance target is the current integration tip, per this file's own standing instruction to
  re-check the branch immediately before push. #290 named `c6a2ca64` (the #291 merge), but PR #270
  landed while the advance was being prepared, which would have made that target stale on arrival.
  The delta it was charging is real: from 42ae771c the #282 branch measured 8,945 added lines against
  the 8,500 cap, and 4,950 from the newer base.
- Caps stay at 115 paths / 8,500 added lines and still fail closed. This is a base advance, not a cap
  change, and it is not an acceptance of any product-envelope measurement.
- The product-union snapshot in the gate's own test is refreshed as evidence, not as a cap change.
  `productCapAcceptanceClaimed` stays `false`.

## Left

- Primary review.
- Issue #264 still owns the owner-approved product-envelope deviation record. This session makes no
  product-cap acceptance claim.
- PR #270 merged with stale green checks and therefore did not refresh the product snapshot itself,
  so the integration branch carried a stale recorded measurement until this landing.

## Blockers

- None.

## Verification

- `node tools/run4_release_gate.mjs config` - source constant and parsed workflow env agree.
- `node --test tools/run4_release_gate.test.mjs` - full gate suite.
- `node tools/run4_release_gate.mjs attest` - against the re-recorded manifest.
- Landing delta from the new base measured for every pending branch; all within 115 / 8,500.
- No provider calls, cloud writes, deployment, promotion, or device operations. `main` and
  `dev-phase2` untouched.

memory: none
