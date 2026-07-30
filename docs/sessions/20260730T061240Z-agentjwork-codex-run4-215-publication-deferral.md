---
title: Record Zebra and Viceroy artifact-publication deferral
summary: Updates the two model-evidence status notes to defer unavailable bundle transfer and private verification to issue #250, without changing pending evidence or claiming a release.
type: session
scope: model-training
status: canonical
updated: 2026-07-30
---

# Record Zebra and Viceroy artifact-publication deferral

Issue: #215; follow-up: #250; branch: `docs/run4-215-publication-deferral`; base: `c696526ff946704398266531445672147e4ef1ec`

## Attempted

- Confirm the owner's documentation-only deferral for the Zebra v1 and Viceroy v0 bundles.
- Correct only the two evidence README report links where their former target directory no longer exists.

## Changed

- Recorded that both bundles are unavailable on this device and that transfer, private R2 upload, round-trip verification, and pending-pointer replacement are deferred to #250.
- Repointed each README to its existing report under `model-training/evidence/publication-results/`.

## Decided

- Pending JSON remains unchanged. This session makes no upload, transfer, verification, or public-release claim.

## Left

- #250 remains blocked until the owner transfers the bundles and explicitly authorizes the private target.

## Blockers

- The required bundles are on another device and are not available in this worktree.

memory: none
