# Zebra v1 — demo release evidence

This directory is the Git-tracked evidence home for Zebra releases.

The model bundle itself is staged locally under `/model/` and uploaded to approved private object
storage. Model weights, checkpoints, raw datasets, credentials, and signed download URLs must not be
committed here.

For each promoted release, add a release-specific directory containing:

- `release-manifest.json`
- `external-artifact.json` with the private bucket and object prefix, but no credentials
- `sha256sums.txt`
- `model-card.md`
- licence and attribution evidence
- aggregate evaluation results
- the promotion decision

`local-bundle-sha256sums.txt` records the expected v1 demo-bundle hashes. The bundle is unavailable
on this device: the owner deferred its transfer, private R2 upload, round-trip verification, and
pending-pointer replacement to [#250](https://github.com/uandiqueue/ourobion/issues/250). Zebra v0
is a separate artifact trained on another device and is not present here. The pending storage pointer
remains unchanged until that follow-up completes its verified private-artifact workflow.

The current training and evaluation verdict is documented in the
[Zebra v1 results report](../publication-results/zebra-v1-results.md).
