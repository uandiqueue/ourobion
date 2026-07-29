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

`local-bundle-sha256sums.txt` records the downloaded v1 demo bundle currently awaiting upload.
Zebra v0 is a separate artifact trained on another device and is not present here. Replace the
pending storage pointer with a release-specific manifest only after the R2 upload has been downloaded
again and verified.

The current training and evaluation verdict is documented in the
[Zebra v1 results report](../publication-results-zebra-v1-viceroy-v0/zebra-v1-results.md).
