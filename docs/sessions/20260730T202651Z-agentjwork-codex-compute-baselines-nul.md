---
title: Compute-baselines source NUL normalization
summary: Preserved the compound-series runtime delimiter while restoring compute-baselines to ordinary text source.
type: session
scope: db
status: canonical
updated: 2026-07-30
---

# Compute-baselines source NUL normalization

Issue: #271 · branch: `fix/db/compute-baselines-nul` · base: `dev-phase2-run4` @ `3557f75c`

## Attempted

- Reconcile the exact Run 4 Edge Function sources with the hosted demo project before redeployment.
- Verify whether the one NUL byte in `compute-baselines/index.ts` was accidental or an intentional
  compound-key separator.

## Changed

- Replaced the literal source-file NUL byte with the TypeScript `\u0000` escape, preserving the
  identical runtime separator between user and metric identifiers.
- Updated the source contract test to require both ordinary text source and the escaped delimiter.
- Removed obsolete test comments describing the function source as deliberately binary.

## Decided

- Runtime use of a NUL separator remains valid; only its representation in tracked TypeScript was
  changed so tooling, diffs, line-ending handling, and deployment bundling treat the file as text.

## Left

- Deploy the exact reviewed Edge Functions to the authorized demo project after tests and PR review.
- Re-enable hosted cron separately only when owner-capable database custom settings are available.

## Blockers

- None for the source normalization.

memory: none
