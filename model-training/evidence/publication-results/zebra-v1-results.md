---
title: Zebra v1 training and evaluation results
summary: Training recipe, grouped cross-validation results, readiness-gate failures, limitations, checkpoint identity, and publication status for the Zebra v1 research checkpoint.
type: report
scope: model-training
status: canonical
updated: 2026-07-28
---

# Zebra v1 training and evaluation results

Prepared: 2026-07-28

Technical status: **trained research checkpoint**

Public weight-release status: **blocked pending model-specific licence clearance**

## Executive verdict

Zebra v1 has three-seed, four-fold grouped cross-validation evidence on its 1,007-row development
pool, but no fresh independent audit. Class weighting substantially improves contradiction recall,
but the preregistered macro-F1 and every-class-recall gates fail.

This checkpoint is research-only. Do not describe it as validated, production-ready, or as having
met its target metric.

## Intended task

Three-way scientific claim/evidence classification:

- `supported`
- `contradicted`
- `insufficient_evidence`

The selected recipe uses BiomedBERT, label-blind BM25 top-3 evidence selection, and
inverse-frequency class-weighted cross-entropy.

## Training

| Item | Result |
|---|---:|
| Development rows used for final training | 1,007 |
| Label counts | 402 supported / 207 contradicted / 398 insufficient evidence |
| Epochs | 5 |
| Learning rate | 2e-5 |
| Effective batch | 32 (physical 8, accumulation 4) |
| Device and precision | Apple MPS, fp32 |
| Per-epoch loss | 1.0264, 0.7863, 0.6284, 0.4940, 0.4492 |
| Final training time | 313.39s |

## Evaluation

The selected candidate was evaluated with four connected-component grouped folds for seeds 42, 17,
and 73. The figures below are means across the three complete out-of-fold seed evaluations.

| Metric | Zebra v1 weighted top-3 | Unweighted top-3 baseline | Change |
|---|---:|---:|---:|
| Macro F1 | **0.5991 ± 0.0081** | 0.5204 ± 0.0253 | +0.0788 |
| Balanced accuracy | **0.6005** | 0.5463 | +0.0542 |
| Accuracy | 0.6260 | **0.6346** | -0.0086 |
| ECE, lower is better | **0.0491** | 0.0888 | -0.0397 |
| Contradiction recall | **0.4670** | 0.0870 | +0.3800 |
| Minimum-seed contradiction recall | **0.4348** | 0.0386 | +0.3961 |

| Class | Precision | Recall | F1 | Minimum-seed recall |
|---|---:|---:|---:|---:|
| supported | 0.6243 | 0.6294 | 0.6259 | 0.5796 |
| contradicted | 0.4025 | 0.4670 | 0.4308 | 0.4348 |
| insufficient evidence | 0.7806 | 0.7052 | 0.7408 | 0.6910 |

## Readiness gates

| Gate | Target | Result | Verdict |
|---|---:|---:|---|
| Mean macro F1 | ≥0.70 | 0.5991 | **Fail** |
| Every-class minimum-seed recall | ≥0.60 | contradicted 0.4348; supported 0.5796 | **Fail** |
| Mean ECE | ≤0.10 | 0.0491 | Pass |

## Limitations

- The 252-row Zebra v0 holdout was already consumed and was deliberately not reused for v1.
- Zebra v1 has no fresh, dual-reviewed, Ourobion-domain audit result.
- Cross-validation selection used the development pool; the final 1,007-row checkpoint has no
  independent generalization score of its own.
- Class weighting fixes much of the contradiction collapse but reduces supported recall and does not
  meet the declared readiness criteria.
- BM25 top-5 reached the MPS safe-memory watermark at physical batches 8 and 4. The safety limit was
  preserved and no top-5 result was fabricated.

## Checkpoint

Local staging path:

```text
model/zebra-v1/v1/
```

`pytorch_model.bin` SHA-256:

```text
bc2d7a79e76b4626e90e3792902a018adb179859a86358a18cf844620e7061f7
```

## Publication and licence status

The checkpoint uses Microsoft BiomedBERT, recorded as MIT-licensed. Training uses
`allenai/scifact_entailment`, recorded locally as CC BY-NC 2.0. The current approval is limited to
the non-commercial, non-serving research pilot, excludes raw SciFact redistribution, and does not
provide a dedicated public-checkpoint release determination.

Before publishing weights, produce a Zebra-specific release decision covering the weights, tokenizer
files, model card, attribution, intended licence, non-commercial constraints, and whether evaluation
examples may be shown.

## Recommended public wording

> Research checkpoint for three-way scientific claim/evidence classification. In grouped
> development cross-validation it achieved macro F1 0.599 ± 0.008 across three seeds. It did not
> meet its preregistered readiness thresholds and has not been evaluated on a fresh independent
> domain audit set.

## Canonical source artifacts

- `model-training/zebra-training/v1/TRAINING-REPORT.md`
- `model-training/zebra-training/v1/outputs/v1-training-report.json`
- `model-training/zebra-training/v1/outputs/selection-report.json`
- `model-training/zebra-training/v1/outputs/final/train-artifact.json`

Exact machine-readable aggregate values are retained in [`results.json`](./results.json), and source
artifact hashes are retained in [`SHA256SUMS.txt`](./SHA256SUMS.txt).
