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

`local-bundle-sha256sums.txt` records the expected v0 demo-bundle hashes.

The transfer deferred in [#250](https://github.com/uandiqueue/ourobion/issues/250) is complete. The
bundle was uploaded to the owner-authorized private R2 bucket, independently re-downloaded into a
fresh ignored directory, and re-hashed against the manifest above; all six files matched.
[`external-artifact.json`](./external-artifact.json) now carries the verified private prefix in place
of the former pending pointer.

The release id is content-addressed: it is the SHA-256 of `local-bundle-sha256sums.txt` itself, so
the prefix in `external-artifact.json` is reproducible from tracked repository content alone:

```bash
sha256sum model-training/evidence/viceroy-v0/local-bundle-sha256sums.txt
# 751fbf1fb1a680b39b50c91f7dd4d7a0caba404417effde724564615d9849ec2
```

Private storage is **not** model acceptance. `validated=false`, `serving_ready=false`, and
`public_weights_cleared=false` are unchanged and remain governed by their own criteria.

The current training and evaluation verdict is documented in the
[Viceroy v0 results report](../publication-results/viceroy-v0-results.md).
