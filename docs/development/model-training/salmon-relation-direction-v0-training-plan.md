---
title: Salmon Relation/Direction v0 — GMI training plan
summary: Preregistered plan for training and evaluating one biomedical relation-type + direction cross-encoder on a self-managed GMI GPU container, to cross-check the synthesis LLM's relation and direction at A10. Public-domain/CC-BY corpora only; claim-kind is split into a separate model; no_effect and confounds are explicitly out of scope for lack of supervision.
type: plan
scope: model-training
status: draft
updated: 2026-07-26
---

# Salmon Relation/Direction v0 — GMI training plan

> **Shared execution substrate.** GMI account/entitlement gates, container configuration, network and
> secret posture, durable-storage rules, the in-repo `model-training/` workspace shape, and the
> release/provenance contract are defined once in the NLI plan
> ([`zebra-nli-shadow-v0-training-plan.md`](./zebra-nli-shadow-v0-training-plan.md) §3, §4, §12). This plan does **not** restate them; it records
> only the deltas. Everything in `GMI-H1`–`GMI-H8` must be satisfied before this model provisions a GPU,
> and `GMI-H7` must be re-approved for **this model's** licence manifest, which is different.

## 1. Decision summary

`salmon-relation-direction-v0` is a biomedical relation-extraction encoder that reads a passage with two
marked metric mentions — `[E1]…[/E1]`, `[E2]…[/E2]` — and predicts two things:

1. a **relation type**, mapped onto a strict subset of the `RelationKind` contract enum;
2. a **direction** — which entity is subject — including an explicit `symmetric` outcome.

It implements the relation/direction half of model **(c)** in
[memory 0013](../../memory/0013-brain-pipeline-and-support-models-decision.md). The claim-kind half is
deliberately **not** in this model; it has different input granularity and an incompatible data licence,
and is planned separately in [`viceroy-claim-kind-v0-training-plan.md`](./viceroy-claim-kind-v0-training-plan.md).

This is a bounded research pilot on the same terms as the NLI pilot:

- **no influence** on `RelationshipClaim`, `EdgeVerification`, edge score/band, `verified_edges`, cards,
  UI, verifier routing, or spend;
- it cannot short-circuit the verifier LLM, suppress an edge, or promote an edge;
- a scientifically useful **no-go** is a valid completion;
- the serve-path determinism invariant holds unconditionally — per
  [`decisions/0003-paper-reliability.md`](../decisions/0003-paper-reliability.md), serve-time
  is a pure read over precomputed columns, so this model could only ever run **offline**, never at serve.

### 1.1 What it would eventually populate

| Contract field | Source | Role of this model |
|---|---|---|
| `EdgeVerification.directionCheck.matchesClaim` | `shared/brain/relationships.ts:203` | primary target |
| `RelationshipClaim.relation` (`RelationKind`) | `relationships.ts:147` | sanity cross-check, not authorship |
| `EdgeVerification.claimKindCheck` | `relationships.ts:205` | **not this model** — see the claim-kind plan |

Pipeline seam: **A10 · Verification with independent retrieval**
([`insight-engine-architecture.md`](../../implemented/shared/insight-engine-architecture.md) §A10), which fills the
check blocks. A secondary future seam is **A8 synthesis**, where
[`insight-engine-architecture.md` §10.2](../../implemented/shared/insight-engine-architecture.md) lists a
"Relation/direction extractor" intended to be split out of the synthesis prompt.

> **Doc discrepancy to resolve before promotion, not now.** §10.2 scopes the extractor to A8 and proposes
> training it on *in-house* A8-claim/sentence pairs; `brain-support-models-design.md` §3 scopes the same
> capability to A10 cross-checking and proposes *public* corpora. Both are defensible. v0 takes the
> public-corpus route because no in-house pairs exist yet, and targets the A10 cross-check because that
> is the field the contract actually exposes. Whoever proposes promotion must pick one seam explicitly.

## 2. Correction to an existing design doc (read this before reusing the old recipe)

[`brain-support-models-design.md` §3](../../implemented/nao/brain-support-models-design.md) states that BioRED
encodes direction as "arg1→arg2 order". **That is incorrect and this plan does not inherit it.** The
BioRED overview states the corpus is non-directional: *"since the BioRED relations are nondirectional,
we eliminated the distinction between subject and object"*
([BC8 BioRED track overview](https://pmc.ncbi.nlm.nih.gov/articles/PMC11306928/)).

Direction supervision therefore has to come from somewhere else. The 2025 **BioREDirect** enrichment
adds 10,864 subject/object annotations over the same 1,000 BioRED abstracts, with 89.96% inter-annotator
agreement ([paper](https://pmc.ncbi.nlm.nih.gov/articles/PMC12261447/),
[repo](https://github.com/ncbi-nlp/BioREDirect)). Without it there is no usable biomedical direction
label, and the pilot reduces to relation type only.

The source doc should be corrected under its own change, not silently here.

## 3. Fixed pilot contract

| Decision | v0 choice |
|---|---|
| Task | Two heads over one shared encoder: relation type, and direction ∈ {`e1→e2`, `e2→e1`, `symmetric`} |
| Base encoder | `microsoft/BiomedNLP-BiomedBERT-base-uncased-abstract-fulltext` (MIT), immutable revision pinned at execution — same base as the NLI pilot, so the two are comparable |
| Input encoding | Typed entity markers + entity-start pooling (concatenate the two marker-start hidden states → linear heads) |
| Training data | BioRED + BioREDirect + DrugProt + ChemProt only, after licence approval |
| Excluded data | DDI-2013, GAD, EU-ADR, SemEval-2010, PubMedCausal, and every in-house/LLM-labelled source (§5.2) |
| Evaluation | Held-out BioRED/BioREDirect test split plus a frozen, independently labelled Ourobion-domain audit set |
| Model selection | Fixed recipe, preselected seed `42`; no leaderboard-driven search |
| Compute | One self-managed pay-as-you-go GMI GPU container; one GPU |
| Code location | This repository's isolated `model-training/` workspace (`ourobion_model_lab.models.salmon_relation_direction`); Python confined there per the task-fit polyglot rule, never in `apps/`/`supabase/`/`shared/`/`tools/` |
| Runtime posture | Non-serving, unconditionally |

## 4. Dataset and licence gate

### 4.1 Allowed sources

| Source | Size | What it supplies | Licence |
|---|---|---|---|
| **BioRED** ([FTP](https://ftp.ncbi.nlm.nih.gov/pub/lu/BioRED/)) | 600 abstracts / 6,502 relation pairs train; +400 / 6,034 BC8 test | relation type, `novel` flag | US Government Work / public domain per its `README.txt` — redistribution allowed |
| **BioREDirect** ([repo](https://github.com/ncbi-nlp/BioREDirect)) | 10,864 subject/object annotations over the same 1,000 abstracts | **the direction label** | paper CC-BY; **repository licence UNVERIFIED — must be resolved in the licence gate** |
| **DrugProt** ([Zenodo 5119892](https://zenodo.org/records/5119892)) | 3,500 train docs / 17,288 relations | mechanistic polarity | CC-BY-4.0 |
| **ChemProt** ([BioCreative VI](https://biocreative.bioinformatics.udel.edu/news/corpora/chemprot-corpus-biocreative-vi/)) | 1,820 abstracts | up/down-regulation polarity | Public Domain Mark 1.0 |

**Hard gate.** BioREDirect's data licence is the one genuinely unresolved item and it is also the only
source of the direction label. If it cannot be confirmed as reusable in writing, the direction head is
**blocked** and the pilot either degrades to relation-type-only or stops. Do not proceed on the
assumption that a CC-BY article implies a CC-BY dataset.

### 4.2 Explicit exclusions

- **DDI-2013** — DrugBank-derived text, redistribution unverified; symmetric pairs teach no direction.
- **GAD / EU-ADR** — binary association only, no direction, licence unverified.
- **SemEval-2010 Task 8** — direction is baked into the label and it is the cleanest direction
  supervision available, but it is general-domain and its HF card carries no licence
  ([card](https://huggingface.co/datasets/SemEvalWorkshop/sem_eval_2010_task_8)). Excluded from v0 on
  both grounds. Its relation semantics (Entity-Destination, Product-Producer) do not map to biomedicine,
  and any transfer claim would have to be measured, not assumed.
- **PubMedCausal** (2026) — 30,000 paragraphs with cause→effect spans would be highly relevant, but its
  HF release is **UNVERIFIED as of 2026-07-26**. Re-check at execution; if it has landed with a
  permissive licence, it is the first candidate for a v1 amendment, not a mid-pilot addition.
- **Ourobion personal data** — no `daily_gut_rows`, wearable/environment rows, user UUIDs, cards,
  Supabase exports, or production telemetry may enter GMI.
- **In-house A8/A10 outputs** — may be inspected as engineering examples; never training labels in v0.

### 4.3 Data manifest

Same rule as the NLI pilot: freeze `data-manifest.json` with source URLs, retrieval time, git/release
IDs, sizes, SHA-256 hashes, licences, attribution text, and an allow/deny decision, before any
preprocessing. The training command must refuse inputs whose hashes differ.

## 5. Label construction

### 5.1 Relation type → `RelationKind`

`RelationKind` is `'increases' | 'decreases' | 'modulates' | 'correlates' | 'confounds' | 'no_effect'`
(`shared/brain/relationships.ts:39-45`). Only four of the six are learnable from these corpora:

| Source label | → `RelationKind` |
|---|---|
| BioRED `Positive_Correlation` · ChemProt CPR-3 (upregulator/activator) | `increases` |
| BioRED `Negative_Correlation` · ChemProt CPR-4 (downregulator/inhibitor) | `decreases` |
| BioRED `Association` | `correlates` |
| BioRED `Bind`/`Conversion`/`Cotreatment` · ChemProt CPR-5/6/9 (agonist/antagonist/substrate) | `modulates` |
| BioRED `Drug_Interaction` | `modulates` (**not** `confounds` — see below) |

**Two enum members get no coverage and the model card must say so plainly:**

- **`confounds`** — an epistemic/statistical role, not a biomedical relation type. The earlier design
  mapped `Drug_Interaction` → `confounds`; that is a category error and this plan drops it. A
  drug–drug interaction is a mechanistic interaction, not a confound in the claim's causal structure.
- **`no_effect`** — genuinely unsourced. Every corpus's `no_relation` means *not annotated*, not
  *studied and found null*. BioRED's `novel` flag is novel-vs-background knowledge, orthogonal to null
  results. Training a `no_effect` head on `no_relation` would be a category error. The nearest real
  supervision is the `no relationship` class in Yu et al.'s causal-language corpus — which belongs to
  the claim-kind model, not this one.

A prediction of `no_effect` or `confounds` is therefore **impossible by construction** in v0. Any
downstream consumer must treat those two enum members as "this model abstains", never as "not present".

### 5.2 Direction

Three classes, from BioREDirect: `e1→e2`, `e2→e1`, and **`symmetric`**. The third is mandatory, not a
convenience: BioREDirect itself names `Association` and `Bind` as inherently undirectable. Forcing a
subject/object choice on a symmetric relation manufactures a coin-flip label and will corrupt the
`directionCheck.matchesClaim` signal that is the whole point of the model.

### 5.3 Input construction

1. normalize Unicode/whitespace without altering scientific symbols;
2. insert typed entity markers around the two mentions, preserving source offsets;
3. keep the relation at **document level over normalised concept IDs**, matching BioRED's own unit —
   do not explode to mention pairs (§8);
4. cap at 512 wordpieces; truncate context symmetrically around the two markers, never the markers;
5. every row carries `example_id`, `pmid`, concept IDs, source corpus, split, label(s), a
   preprocessing-version hash, and raw-source hashes.

## 6. Leakage-resistant splits

Merging biomedical corpora leaks across their published splits. BigBIO found **BioRED↔BC5CDR share 203
PMIDs and BioRED↔NLM-Gene share 140** ([BigBIO](https://arxiv.org/abs/2206.15076)).

- **De-duplicate by PMID across every merged corpus before splitting.** Assert zero PMID intersection
  between train and any evaluation split, and record the collision count.
- Group by PMID, never by relation instance — one abstract's relations must not straddle splits.
- Use the official BioRED/BC8 test split as the untouched held-out set; it is not consulted until the
  recipe, seed, and thresholds are frozen.
- Assert zero overlap of normalised `(concept_a, concept_b)` pairs between train and test where
  feasible, and report the residual overlap honestly if elimination would empty the test set.

## 7. Frozen Ourobion-domain audit set

Public biomedical corpora skew to chemical–gene–disease triples. Ourobion's pairs are
hydration/heat, gut, wearable/recovery, and environment/vector metrics — badly under-represented. An
in-domain audit set is the only honest read on usefulness.

Reuse the NLI pilot's construction discipline (§8 of that plan): ≥160 candidate public-paper passages,
equally sampled across the four domains, each with two marked metric mentions; two reviewers label
relation and direction independently and blind to any model output; adjudicate; freeze with a set hash.
Target ≥96 adjudicated examples, ≥20 per domain. **Direction must be labelled including `symmetric`.**
Record raw agreement, Cohen's kappa, both original labels, adjudicated label, and reason codes. Without
an independent second reviewer the result is **preliminary** and cannot support promotion.

Where the same passages already carry NLI audit labels, reuse the passages — one frozen in-domain pool
serving both models is cheaper and makes the two pilots directly comparable.

## 8. Metric definition — the thing most easily faked

Report **direction accuracy conditioned on a correct relation-type prediction** as the headline number,
separately from joint type+direction F1. That conditional number is what `directionCheck.matchesClaim`
actually needs; joint F1 conflates two failure modes and reads better than the model deserves.

Published anchors, for honest expectations rather than targets:

| Benchmark | Result |
|---|---|
| BioREx on BioRED pair-level | 79.6 F1 ([JBI 2023](https://arxiv.org/abs/2306.11189)) |
| BC8 full task (pair+type+novelty), best team | 44.41 F1 ([overview](https://pmc.ncbi.nlm.nih.gov/articles/PMC11306928/)) |
| BioREDirect, type+direction | 48.62 F1 — beating fine-tuned Llama-3.2 at 40.80 ([paper](https://pmc.ncbi.nlm.nih.gov/articles/PMC12261447/)) |
| DrugProt top systems | ~77.6 micro-F1 ([overview](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10683943/)) |

A ~110M encoder is the right tool here: it beats zero-shot GPT-4 and fine-tuned Llama-3.2 on BioRED
direction. **Type+direction F1 in the high 40s is a good outcome, not a failure** — anyone reading 48
as "broken" has misread the task difficulty.

## 9. Preregistered training recipe

| Setting | Value |
|---|---|
| Architecture | BiomedBERT base + typed entity markers + entity-start pooling + two linear heads |
| Loss | Sum of per-head cross-entropy with **per-example masking** — a corpus lacking a direction label contributes no gradient to the direction head |
| Max sequence length | 512 wordpieces |
| Optimizer / LR / decay | AdamW · `2e-5` · `0.01` |
| Effective batch size | 16 (gradient accumulation allowed) |
| Epoch ceiling | 10 (RE converges slower than pair classification) |
| Warmup / clipping | 10% of steps · 1.0 |
| Precision | BF16 on H100/H200; FP32 metric accumulation |
| Class imbalance | Class-weighted loss on the relation head; report the weighting, do not tune it per-run |
| Seeds | 17, 42, 73; **42 is the preregistered release candidate** |
| Selection metric | Macro F1 on the validation fold, relation head |
| Early stopping | Grouped train-fold jobs only: patience 2, min delta 0.002 macro F1 |

Freeze the final epoch count as the median selected fold epoch **before** any test-split result is
viewed. Record `CUBLAS_WORKSPACE_CONFIG`, CUDA, driver, GPU, PyTorch, Transformers, Datasets,
Tokenizers, NumPy, and scikit-learn versions.

### 9.1 Bounded job ledger

| Jobs | Purpose |
|---|---|
| 1 CPU/preflight | Licence, hashes, PMID de-duplication report, split assertions, class balance |
| 1 GPU smoke | 64 examples, one optimizer step, evaluation + artifact upload round-trip |
| 5 GPU fold jobs | Seed 42, grouped folds; out-of-fold metrics |
| 3 GPU final jobs | Seeds 17/42/73 at the fixed epoch count; one evaluation each on the untouched test split |
| 1 GPU ablation | **Untyped** entity markers, seed 42 — measures marker-type leakage (§10) |
| 1 clean GPU rerun | Seed 42 from an empty container/prefix |

Maximum **11 GPU jobs**, sequential, one container. A failed infrastructure job may be retried once
after its cause is recorded. A disappointing score is not an infrastructure failure.

## 10. Evaluation protocol

On the untouched test split and the frozen in-domain audit set:

- example count and class prevalence per head;
- confusion matrices, per-class precision/recall/F1, macro F1, balanced accuracy;
- **direction accuracy given correct type** (the headline, §8);
- direction performance reported **separately for symmetric vs directable** relations;
- calibration: multiclass Brier, 10-bin equal-mass ECE, reliability diagram;
- bootstrap 95% CIs resampled **by PMID**, not by relation instance;
- abstention coverage and selective error at 0.50/0.60/0.70/0.80;
- latency, throughput, peak GPU memory, wall-clock, GPU-hours;
- slices by domain, relation type, and passage length;
- coded error table: direction flip, symmetric forced to directional, type confusion within
  polarity (`increases`↔`decreases`), `correlates`↔`modulates` confusion, truncation.

Required ablation and baselines:

1. majority-class baseline per head;
2. **untyped-marker ablation** — typed markers can let the model infer the relation from entity types
   alone (chemical+gene ⇒ CPR class). Without this ablation a good score may be measuring the marker,
   not the text;
3. a deterministic argument-order baseline for direction;
4. the existing A10 verifier's already-frozen outputs on the same in-domain passages, if O29 produced
   comparable ones. Do not make new paid calls to manufacture a comparator.

## 11. Completion and outcome gates

Completion mirrors the NLI pilot's §11.1 — gates recorded, jobs within budget, audit set frozen before
predictions, metrics/uncertainty/slices/errors/costs published, clean rerun reproducible, no runtime or
shared-contract file touched, release checksummed with its true retention posture disclosed, container
terminated and credentials rotated.

Outcome label, one of:

- **`no-go`** — not credible enough to continue;
- **`research-complete`** — useful evidence, with reviewer/sample/performance limits stated;
- **`eligible-for-shadow-review`** — may later be proposed for logging with **zero serving influence**,
  only if the audit set is non-preliminary **and** direction accuracy given correct type ≥0.80 on the
  audit set, **and** relation-head macro F1 ≥0.55 over the four covered classes, **and** the
  untyped-marker ablation shows the typed-marker advantage is <0.10 macro F1, **and** no domain's
  direction accuracy is below 0.65.

These are engineering screening thresholds, not scientific validity. The `symmetric` class must not be
excluded from any reported average to flatter the numbers.

**Reproducibility rule:** across the seed-42 original and clean rerun, all input/config/code/environment
hashes match exactly; macro F1 differs by ≤0.01, per-class F1 by ≤0.02, prediction agreement ≥98%.

## 12. Cost controls

Small model, small corpora — this is cheaper than the NLI pilot. Benchmarks put a 110M encoder at
roughly 250–500 samples/s at length 512 on an H100, so ~100k instances × 10 epochs is well under two
GPU-hours.

- one GPU only;
- at most **6 GPU-hours** including the clean rerun and the ablation;
- at most **USD 20 compute** and **USD 25 all-in**;
- auto-pay off; checkpoint upload after every job;
- reserve for all remaining preregistered jobs before starting the first GPU job.

The console is the purchase authority; copy the live SKU price into the issue immediately before launch.
Data preparation and human annotation, not GPU time, are the real cost of this model.

## 13. Stop conditions

Everything in the NLI plan's §14, plus:

- **BioREDirect's data licence cannot be confirmed** — the direction head is unsupervised; stop or
  degrade to relation-type-only with Jayden's explicit approval;
- PMID de-duplication reveals train/test contamination that cannot be removed without emptying a split;
- the `symmetric` class is proposed for removal to improve headline numbers;
- someone proposes mapping `no_relation` to `no_effect`, or `Drug_Interaction` to `confounds`, to
  "cover the enum";
- the first full evaluation has been viewed and a recipe change is proposed solely to raise the score.

## 14. Execution order

1. **T0** — GMI-H1–H8 satisfied; **GMI-H7 re-approved for this licence manifest**, BioREDirect resolved.
2. **T1** — the `model-training/` workspace (`ourobion_model_lab.models.salmon_relation_direction`) pinned; unit tests for label mapping, marker insertion, PMID dedup, and
   the symmetric-direction rule pass.
3. **T2** — download, hash, de-duplicate by PMID, build grouped splits, publish class/leakage report. CPU only.
4. **T3** — freeze the in-domain audit set via blinded dual review; hash it.
5. **T4** — GMI smoke: environment recorded, 64-example run, checkpoint upload/restore, cost meter verified.
6. **T5** — the preregistered fold, seed, and ablation jobs. Nothing else.
7. **T6** — evaluate untouched test split + frozen audit set; metrics, plots, error analysis, model card.
8. **T7** — clean rerun from an empty workspace, seed 42.
9. **T8** — upload/checksum release, record spend, terminate compute, release EIP, rotate credentials,
   publish the small evidence artifacts, declare the outcome.

## 15. Deferred beyond v0

- claim-kind — separate model, [`viceroy-claim-kind-v0-training-plan.md`](./viceroy-claim-kind-v0-training-plan.md);
- `no_effect` and `confounds` coverage — unsourced, needs new annotation;
- PubMedCausal, SemEval-2010, and DDI-2013 ingestion;
- joint multi-task training with the NLI or claim-kind models — do it only after per-head baselines exist;
- training on Ourobion A8/A10 outputs or human verdicts;
- the A8-vs-A10 seam decision (§1.1) and any active routing, short-circuiting, or serving.
