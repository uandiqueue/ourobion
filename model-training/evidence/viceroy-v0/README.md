# Viceroy v0 — demo release evidence

This directory is the Git-tracked evidence home for Viceroy v0.

The complete model bundle is staged locally under `/model/` and uploaded to approved private object
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

`local-bundle-sha256sums.txt` records the downloaded v0 demo bundle currently awaiting upload.
Replace the pending storage pointer with a release-specific manifest only after the R2 upload has
been downloaded again and verified.

The current training and evaluation verdict is documented in the
[Viceroy v0 results report](../publication-results-zebra-v1-viceroy-v0/viceroy-v0-results.md).
