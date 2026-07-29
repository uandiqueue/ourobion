---
title: Publish Zebra v1 and Viceroy v0 results and artifact evidence
summary: Added canonical per-model research reports, verified local checkpoint manifests, and pending private-R2 pointers for externally trained Zebra v1 and Viceroy v0 demo artifacts.
type: session
scope: model-training
status: canonical
updated: 2026-07-28
---

# Publish Zebra v1 and Viceroy v0 results and artifact evidence

Issue: #215

Branch: `docs/model-training/publish-zebra-viceroy-results`

PR base: `dev-phase2-run4`

## Attempted

- Transfer the trained Zebra v1 and Viceroy v0 model bundles from the source Mac to this device.
- Verify both downloaded checkpoints before organizing them for private object-storage upload.
- Promote the supplied consolidated results package out of `docs/temp/` into the formal,
  Git-tracked model-training evidence layer.
- Prepare a reviewable session branch and PR without adding either 419 MiB checkpoint to Git.

## Changed

- Added the ignored root `model/` staging convention for complete externally hosted model bundles.
- Added tracked evidence directories for Zebra v1 and Viceroy v0 with full-bundle SHA-256 manifests
  and pending private Cloudflare R2 pointers.
- Added separate canonical Zebra v1 and Viceroy v0 training/evaluation reports, a small navigation
  page, machine-readable aggregate results, and the source-artifact provenance hash manifest under
  `model-training/evidence/publication-results/`.
- Linked the formal evidence package from the model-training workspace and the temporary workstream
  overview.

## Decided

- **Training provenance is external to this session.** Zebra v1 and Viceroy v0 were trained on
  another device (the source Mac) before this Codex session. This session did not train, retrain,
  tune, select, or evaluate either checkpoint; it transferred supplied artifacts, verified hashes,
  organized storage metadata, and documented supplied results.
- Both checkpoint bundles stay under the ignored root `model/` staging directory and are intended
  for a private R2 bucket. Git retains only small reviewable evidence, hashes, aggregate results, and
  storage pointers.
- The PR targets `dev-phase2-run4`, confirmed by the user, because that branch contains the
  model-training workspace on which these evidence files depend.
- Zebra v1 and Viceroy v0 retain separate reports because they solve different tasks under different
  evaluation designs; their F1 scores are not directly comparable.
- Both artifacts remain research/demo-only, not validated or serving-ready, and public weight
  distribution remains blocked pending model-specific licence clearance.

## Left

- Upload the ignored local model bundles to their final private R2 release prefixes.
- Replace each `external-artifact.pending.json` placeholder with the final release ID/object prefix
  only after downloading from R2 and re-verifying the bundle hashes.
- Produce model-specific publication/licence decisions before distributing either checkpoint.

## Blockers

- No blocker to documenting or privately storing the research artifacts.
- Public checkpoint distribution remains blocked on the licence determinations recorded in the
  reports.

memory: none
