---
title: Zebra v1 and Viceroy v0 publication-results package
summary: Navigation page for the separate Zebra v1 and Viceroy v0 research-checkpoint reports, with shared machine-readable aggregate results and provenance hashes.
type: index
scope: model-training
status: canonical
updated: 2026-07-28
---

# Zebra v1 and Viceroy v0 publication results

Prepared: 2026-07-28

The model results are documented separately:

- [Zebra v1 results](./zebra-v1-results.md)
- [Viceroy v0 results](./viceroy-v0-results.md)

Both are trained research checkpoints. Neither is validated or serving-ready, and public weight
release remains blocked pending model-specific licence clearance.

Shared package files:

- [`results.json`](./results.json) contains the exact machine-readable aggregate results for both
  models.
- [`SHA256SUMS.txt`](./SHA256SUMS.txt) binds the reports to the canonical checkpoints and source
  result artifacts.

`SHA256SUMS.txt` is a provenance manifest, not a checksum manifest for this three-document
publication package. Its relative paths resolve against the source training workspace, and most
referenced canonical artifacts are intentionally not duplicated here.

The models solve different tasks on different datasets under different evaluation designs. Their F1
scores must not be compared as if one model were better than the other.
