---
title: Reconcile Run 4 Zebra and Viceroy evidence package
summary: Rebased PR 216 onto the current Run 4 tip, verified its research-only boundaries and hashes, and removed an MT4-excluded convenience link that correctly failed release evidence.
type: session
scope: model-training
status: canonical
updated: 2026-07-29
---

# Reconcile Run 4 Zebra and Viceroy evidence package

Issue: #215

PR: #216

## Attempted

- Reconcile the evidence-only branch onto the integration tip after PRs #224, #230 and #213.
- Validate the tracked aggregate results, external-pointer metadata, bundle manifests, ignored
  checkpoint boundary and Run 4 landing caps before deciding whether the draft could land.
- Diagnose the fresh `Run 4 release evidence` failure from its GitHub Actions log.

## Changed

- Removed the convenience link added to `docs/temp/model-training/README.md`; that path belongs to
  the frozen MT4 exclusion set and its content is intentionally hash-bound by the release gate.
- Kept the canonical package link in `model-training/README.md` and all small evidence files.
- Added this session record after the pre-push context guard correctly rejected a commit without
  session coverage.

## Decided

- Run 4 may consume this as a frozen research-evidence package only. Neither checkpoint is
  validated, serving-ready or cleared for public distribution.
- No gate, exclusion hash, cap, attestation or test was changed to make the branch pass.
- No checkpoint binary belongs in Git; the ignored root `model/` boundary remains in force.

## Left

- Public checkpoint distribution remains blocked on model-specific licence clearance.
- Private R2 upload and replacement of the pending pointers remain separate, unperformed work.

## Blockers

- None for landing the small evidence package under the research-only posture.

## Verification

- Zebra and Viceroy weight hashes matched aggregate JSON, pending-pointer JSON and tracked bundle
  manifests.
- Both aggregate records remained `serving_ready: false`, `validated: false`, and
  `public_weights_cleared: false`.
- Combined landing before the focused correction: 47 paths / 7,540 additions, with no binary rows.
- `node --test tools/run4_release_gate.test.mjs`: 12 passed, 0 failed after the correction.
- `node tools/run4_release_gate.mjs config`: PASS.
- `node tools/context_sync.mjs --check`: PASS before the correction commit; rerun before push.
- `git diff --check`: PASS.

memory: none
