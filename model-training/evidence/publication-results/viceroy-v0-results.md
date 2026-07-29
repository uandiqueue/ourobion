---
title: Viceroy v0 training and evaluation results
summary: Training recipe, frozen holdout results, leakage and validation limitations, checkpoint identity, and publication status for the Viceroy v0 research checkpoint.
type: report
scope: model-training
status: canonical
updated: 2026-07-28
---

# Viceroy v0 training and evaluation results

Prepared: 2026-07-28

Technical status: **trained research checkpoint**

Public weight-release status: **blocked pending model-specific licence clearance**

## Executive verdict

Viceroy v0 has one frozen 612-row surrogate-grouped holdout evaluation with group-bootstrap
confidence intervals and no independent audit. Its numerical screening gates pass on fold 0, but
this is not completed five-fold cross-validation and same-paper leakage remains uncontrolled.

The checkpoint is research-complete and promising, but not validated, evidence-validating, or
serving-ready. Its owner waiver requires a fresh determination before publication or distribution.

## Intended task

Four-way classification of the causal language used in a biomedical conclusion sentence:

- `no_relationship`
- `direct_causal`
- `conditional_causal`
- `correlational`

This describes author wording. It does not determine whether study design or evidence licenses the
causal claim and must not be represented as evidence validation.

## Training

| Item | Result |
|---|---:|
| Source rows | 3,061 |
| Conflicting-label rows removed | 2 |
| Retained rows | 3,059 |
| Fold-0 train / holdout | 2,447 / 612 |
| Epochs | 5 |
| Learning rate | 2e-5 |
| Effective batch | 16 (physical 8, accumulation 2) |
| Device and precision | Apple MPS, fp32 |
| Per-epoch loss | 1.0390, 0.3958, 0.1866, 0.1149, 0.0676 |
| Final training time | 476.77s |

## Fold-0 evaluation

| Metric | Viceroy v0 | Reference |
|---|---:|---:|
| Macro F1 | **0.8656** | cue lexicon 0.5068; majority 0.1535 |
| Group-bootstrap macro-F1 95% CI | **0.8327–0.8958** | 608 surrogate groups |
| Balanced accuracy | **0.8868** | cue lexicon 0.4945; majority 0.2500 |
| Group-bootstrap balanced-accuracy 95% CI | **0.8555–0.9167** | 608 surrogate groups |
| Accuracy | **0.8840** | majority-class accuracy 0.4428 |
| Raw 10-bin equal-mass ECE | **0.0919** | screening target ≤0.10 |
| Multiclass Brier, lower is better | **0.2068** | cue lexicon 0.8399 |

| Class | Precision | Recall | F1 | Support |
|---|---:|---:|---:|---:|
| no relationship | 0.9228 | 0.8819 | 0.9019 | 271 |
| direct causal | 0.8190 | 0.8687 | 0.8431 | 99 |
| conditional causal | 0.7500 | 0.9070 | 0.8211 | 43 |
| correlational | 0.9031 | 0.8894 | 0.8962 | 199 |

Confusion matrix; rows are true labels and columns are predictions in the order
`no_relationship`, `direct_causal`, `conditional_causal`, `correlational`:

```text
239  10   9  13
  5  86   2   6
  2   2  39   0
 13   7   2 177
```

The dangerous `correlational → causal` error is 9/199 = **4.52%**, compared with 13.57% for the cue
baseline. The opposite `causal → correlational` missed-flag rate is 6/142 = **4.23%**.

## Limitations

- Only fold 0 was trained. The 0.8656 result is a single frozen holdout score, not a five-fold
  cross-validation mean.
- The released corpus has no PMID. Lexical surrogate grouping catches exact and near duplicates but
  cannot fully prevent same-paper leakage; optimistic bias is unquantified.
- The split audit reports zero ≥0.80-similarity pairs crossing folds, but 45 residual pairs between
  the 0.60 audit threshold and 0.80 grouping threshold cross folds.
- The published 0.88 macro-F1 reference used row-level folds and is not directly comparable.
- Temperature scaling reduces apparent ECE to 0.0630, but it was fitted and described on the same
  out-of-training fold because there is no separate calibration set. It is not an independently
  validated calibrator.
- There is no independent, dual-reviewed in-domain audit set.

## Checkpoint

Expected local staging path:

```text
model/viceroy-v0/v0/
```

`pytorch_model.bin` SHA-256:

```text
4ea5915825cfe213cef62abe6231d5d92d55f980003fbfbd0c1c7f10a4ee16cc
```

## Publication and licence status

The checkpoint uses Microsoft BiomedBERT, recorded as MIT-licensed. The Yu, Li & Wang corpus
repository is marked GPL-3.0 without a separate data licence, and whether its terms propagate to
trained weights remains unresolved. Its source sentences are excerpts from PubMed abstracts, adding
a separate third-party copyright consideration.

The current owner waiver explicitly excludes publishing, distributing, or shipping the weights and
requires a fresh determination first. Before publication, produce a Viceroy-specific release decision
covering the weights, tokenizer files, model card, attribution, intended licence, corpus terms,
abstract copyright, and whether evaluation examples may be shown.

## Recommended public wording

> Research checkpoint for classifying causal wording in biomedical conclusion sentences. On one
> frozen surrogate-grouped holdout it achieved macro F1 0.866 (group-bootstrap 95% CI
> 0.833–0.896). This is not completed cross-validation, same-paper leakage remains possible, and
> the model does not assess whether evidence licenses causal interpretation.

## Canonical source artifacts

- `model-training/viceroy-training/TRAINING-REPORT.md`
- `model-training/viceroy-training/outputs/metrics-artifact.json`
- `model-training/viceroy-training/outputs/train-artifact.json`
- `model-training/viceroy-training/outputs/eval-artifact.json`
- `model-training/viceroy-training/outputs/split-artifact.json`

Exact machine-readable aggregate values are retained in [`results.json`](./results.json), and source
artifact hashes are retained in [`SHA256SUMS.txt`](./SHA256SUMS.txt).
