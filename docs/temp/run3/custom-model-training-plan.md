---
title: Run 3 O30 — GMI training plan for NLI Shadow v0
summary: Detailed, preregistered plan for training and evaluating one SciFact-only biomedical claim/evidence NLI encoder on a self-managed GMI GPU container. Covers human GMI setup, licensing, data leakage controls, fixed training recipe, in-domain audit set, calibration, reproducibility, artifacts, cost/security gates, and the hard non-serving boundary.
type: plan
scope: nao
status: canonical
updated: 2026-07-26
---

# Run 3 O30 — GMI training plan for NLI Shadow v0

## 1. Decision summary

Run 3 trains exactly one custom model: **NLI Shadow v0**, a three-way cross-encoder that reads a
scientific claim plus its retrieved evidence and predicts `supported`, `contradicted`, or `uncertain`.
It implements only model **(a)** from [memory 0013](../../memory/0013-brain-pipeline-and-support-models-decision.md).

This is a bounded research pilot, not a serving launch:

- the model has **no influence** on `RelationshipClaim`, `EdgeVerification`, edge score/band,
  `verified_edges`, cards, UI, verifier routing, or spend in Run 3;
- it cannot short-circuit the verifier LLM, suppress an edge, or promote an edge;
- Run 3 may finish O30 with a scientifically useful **no-go** result;
- any later shadow logging or serving integration needs a separate decision, privacy/security review,
  shared-contract review if applicable, and a substantially larger prospective evaluation.

The locked O30 definition remains in
[`next-build-optimizations.md`](./next-build-optimizations.md). This document is its execution annex.

## 2. Fixed pilot contract

| Decision | Run-3 choice |
|---|---|
| Task | Pair classification: `[claim] [SEP] [retrieved evidence]` → supported / contradicted / uncertain |
| Base encoder | `microsoft/BiomedNLP-BiomedBERT-base-uncased-abstract-fulltext` (MIT), exact immutable revision pinned at execution |
| Training data | SciFact only, using a pinned AllenAI entailment transform with explicit `NEI` rows after conservative licence approval; HealthVer, PUBHEALTH, SciNLI, user data, arbitrary negative relabelling, and synthetic LLM labels are excluded |
| Evaluation | Untouched SciFact dev plus a frozen, independently labelled Ourobion-domain audit set |
| Model selection | Fixed recipe and preselected seed `42`; no leaderboard-driven hyperparameter search |
| Compute | One self-managed, pay-as-you-go GMI GPU container; one GPU only |
| Code location | Separate private `ourobion-model-lab` repository; **no Python is added to this repository** |
| Durable artifacts | Private, append-only release namespace with hashes; call it immutable only if an enforced storage retention/versioning/deny-overwrite control is verified |
| Runtime posture | Non-serving for all of Run 3, regardless of scores |

Why this model: it is a small biomedical encoder, its published model artifact is MIT-licensed, and it
fits the claim/evidence cross-encoder shape already described by
[`brain-support-models-design.md`](../../nao/brain-support-models-design.md). Run 3 deliberately does
not compare several base encoders; that would turn a bounded pilot into model search.

## 3. GMI platform decision

As checked on 2026-07-26, GMI's managed [Fine-Tuning](https://docs.gmicloud.ai/cluster-engine/fine-tuning)
surface is explicitly **coming soon** and requires early access. O30 therefore uses GMI
[GPU Compute](https://docs.gmicloud.ai/cluster-engine): a self-managed container, not the managed
fine-tuning product, GMI Studio, a bare-metal lease, or a Kubernetes cluster.

The container choice is proportionate because GMI describes containers as the option for short jobs
and notebooks. Bare metal is for full OS/driver control and persistent local NVMe; managed clusters
are unnecessary for this approximately 110M-parameter model. Container and bare-metal products are
organization-gated, so entitlement must be confirmed before O30 is scheduled.

### 3.1 Human-owned GMI setup checklist

No paid GPU may be provisioned until every `GMI-H` row is recorded in the O30 issue/session.

| Gate | Human setup/action | Evidence to record |
|---|---|---|
| GMI-H1 | Create or select a dedicated Ourobion GMI organization; verify the account and require 2FA where the identity flow supports it | organization UUID; owner; approved members; no credential values |
| GMI-H2 | In **Credits & Coupons**, redeem the sponsor/credit code or add only the approved balance. Keep automatic credit reload **off** unless Jayden explicitly sets a reload limit | starting credit balance; auto-pay state; approved total USD cap |
| GMI-H3 | Contact GMI Support from the console and request **Container** entitlement (and Cold Storage if used). Ask for one-GPU H100 availability, region, billing granularity, product ID, and any minimum rental | support ticket/reference; enabled products; region; live console price |
| GMI-H4 | Import a project-specific Ed25519 public key under organization SSH Keys. Keep the private key outside git and outside shared chat | SSH key name/fingerprint; owner; rotation date |
| GMI-H5 | Choose durable storage: GMI S3-compatible Cold Storage or an approved private Cloudflare R2 prefix. Create a narrowly scoped read/write credential for only the model-lab prefix | bucket/prefix; region/endpoint; credential owner and expiry; never the secret |
| GMI-H6 | Approve a separate private `ourobion-model-lab` Git repository for Python training code and grant only the people/agent identity needed for O30 | repository URL; default branch protections; owner |
| GMI-H7 | Approve the frozen SciFact licence manifest and confirm that the pilot remains non-serving/non-production | reviewer, date, approved uses, attribution location |
| GMI-H8 | Approve the GPU-hour and total-cost stop limits after viewing the live console estimate | SKU; hourly price; GPU-hour cap; compute cap; all-in cap |

GMI supports account/organization management, [credits and coupons](https://docs.gmicloud.ai/cluster-engine/user-management/credits-coupons),
[billing](https://docs.gmicloud.ai/cluster-engine/user-management/billing), and
[SSH-key import or generation](https://docs.gmicloud.ai/cluster-engine/user-management/ssh-keys).
The full value of a generated private key is shown only once; importing an existing project key is
preferred so custody is explicit.

### 3.2 Container configuration

Use the smallest one-GPU pay-as-you-go SKU visible in the approved region that satisfies the job. The
current public catalog advertises H100 from USD 2.00/GPU-hour and H200 from USD 2.60/GPU-hour, but
GMI says the console's SKU/region price is authoritative; record that price immediately before
provisioning. Prefer one H100. Do not reserve B200/GB200 capacity for this pilot.

Launch from GMI's official `gmicloud-jupyterlab` template, currently documented as CUDA 12.4,
Python 3.10.12, JupyterLab, and OpenSSH with ports 8888 and 22. Record the actual template ID and
documented runtime. Record an image digest only if the console/API exposes it or it can be captured
inside the container; otherwise record `digest unavailable from platform` and retain the exact
template metadata plus installed-package/environment manifest. The authoritative run is a CLI job
checked out from `ourobion-model-lab`; a notebook may inspect data but is not the training source of
truth.

Security defaults:

- prefer the built-in browser shell when practical and allocate no public IP;
- if SSH is needed, attach an Elastic IP and then a custom firewall allowing TCP 22 only from the
  operator's current fixed IP/CIDR;
- never attach GMI's documented **All Open** (`0.0.0.0/0`) firewall;
- do not assume the console's documented Jupyter link is a private proxy. Before upload, verify whether
  it works without an EIP and what authentication/network boundary it uses. If that cannot be verified,
  keep Jupyter disabled and use the browser shell or an SSH tunnel through a source-restricted EIP;
- do not create a GMI API key for a manual console run. Create a named, revocable API key only if
  O30 explicitly automates provisioning through the documented REST API.

GMI documents [SSH, Jupyter, and web-shell access](https://docs.gmicloud.ai/cluster-engine/resources/containers),
[firewall source/port rules](https://docs.gmicloud.ai/cluster-engine/resources/firewalls), and the order
for attaching an [Elastic IP](https://docs.gmicloud.ai/cluster-engine/resources/elastic-ip) then a
firewall. GMI also warns that reconfiguring a container permanently loses its in-container data.
Therefore every checkpoint and final artifact must be uploaded to durable storage before restart,
reconfiguration, or termination.

### 3.3 Storage and secrets

GMI documents [Cold Storage](https://docs.gmicloud.ai/migration/s3-to-vast-migration) as S3-compatible
and usable through `rclone`, AWS CLI, NFS, SMB, or an S3 SDK. It does not document a generic persistent
volume attached to a container. Treat the container filesystem as disposable scratch.

Use a new release prefix such as:

```text
models/nli-shadow-v0/releases/<UTC-date>-<model-lab-git-sha>/
```

Treat the prefix as immutable only after verifying an enforceable control such as object retention/
lock, versioning plus deny-overwrite/delete policy, or an approved equivalent. If GMI Cold Storage or
the selected R2 bucket cannot provide/prove that control, describe the release honestly as
**checksummed but mutable**, retain version history where available, and do not claim WORM semantics.

Container creation accepts environment variables, but the reviewed GMI documentation does not expose
a dedicated compute secret manager. Inject only short-lived, prefix-scoped object-storage credentials
at launch, do not put them in the image/notebook/shell history, rotate them after the run, and never
upload Supabase, Anthropic, OpenAI, production R2, or personal-data credentials.

## 4. Training-code source of truth

Ourobion's main repository remains Dart/TypeScript/SQL only. Create a separate private repository with
this minimum shape:

```text
ourobion-model-lab/
  README.md
  pyproject.toml
  uv.lock                         # or an equivalently fully pinned lockfile
  Dockerfile                     # optional; base image pinned by digest
  configs/nli-shadow-v0.yaml
  src/model_lab/data_scifact.py
  src/model_lab/train_nli.py
  src/model_lab/evaluate_nli.py
  src/model_lab/build_release.py
  tests/test_label_mapping.py
  tests/test_group_splits.py
  tests/test_evidence_windows.py
  tests/test_manifest_hashes.py
  licences/
  manifests/
```

The external repository commit SHA, lockfile hash, template ID/runtime metadata, available image digest
(or an explicit unavailable marker), environment manifest, and training-config hash are mandatory
inputs to the release manifest. A notebook cannot substitute for those files.

## 5. Dataset and licence gate

### 5.1 Allowed source

Use the official [AllenAI SciFact repository](https://github.com/allenai/scifact) and pin both its git
commit and downloaded release SHA-256. Its official licence file separates the rights:

- claims and evidence annotations: **CC BY 4.0**;
- corpus abstracts (from S2ORC): **ODC-By 1.0**;
- repository code: **Apache 2.0**.

The base [BiomedBERT model artifact](https://huggingface.co/microsoft/BiomedNLP-BiomedBERT-base-uncased-abstract-fulltext/blob/main/LICENSE.md)
is MIT-licensed. Pin its immutable Hugging Face revision and retain its licence/attribution in the
release.

The three-way pilot also needs explicit `NEI` pairs. Pin the AllenAI
`allenai/scifact_entailment` conversion revision and record its current `cc-by-nc-2.0` card metadata as
an additional conservative restriction alongside the upstream component licences. The licence reviewer
must approve that combined manifest before training. If this written resolution is unavailable, O30
blocks; do not create an `uncertain` class by treating arbitrary unannotated documents as negative.
Do not assume weights trained under that conservative non-commercial restriction can later be used in
a commercial/production product; that requires fresh legal review or retraining from an approved data
construction.

### 5.2 Explicit exclusions

- **HealthVer:** excluded until reusable permission/licence is documented.
- **PUBHEALTH and SciNLI:** excluded to avoid expanding label harmonization and licence surface.
- **LLM-generated labels:** excluded from train, validation, calibration, and the in-domain audit set.
- **Ourobion personal data:** no `daily_gut_rows`, wearable/environment rows, user UUIDs, cards,
  Supabase exports, or production telemetry may enter GMI.
- **Run-2 fixture verdicts:** may be inspected as engineering examples but are not training labels.

### 5.3 Data manifest

Before preprocessing, freeze `data-manifest.json` with source URLs, retrieval time, git/release IDs,
file sizes, SHA-256 hashes, licences, attribution text, and an allow/deny decision. The training command
must refuse inputs whose hashes differ. Raw third-party data stays in private object storage and is not
committed to either repository.

## 6. Label and input construction

Map SciFact labels exactly:

| SciFact | NLI Shadow v0 |
|---|---|
| `SUPPORT` | `supported` |
| `CONTRADICT` | `contradicted` |
| explicit `NEI` row in the pinned AllenAI SciFact entailment transform | `uncertain` |

Use only the pinned transform's explicit relation label to assign `uncertain`. Do not add or relabel
arbitrary BM25/non-gold claim-document pairs. Because an `NEI` relation can still reflect incomplete
annotation rather than demonstrated absence of evidence, measure and state that limitation.

Build evidence text to resemble O29's retrieved evidence contract:

1. normalize Unicode and whitespace without changing scientific symbols;
2. for supported/contradicted rows, include annotated rationale sentences plus adjacent context;
3. only after an explicit `NEI` pair is fixed, select the same number of claim-relevant sentences from
   that row's paired abstract with deterministic BM25; BM25 never assigns the label;
4. preserve source sentence order and identifiers;
5. cap the pair at 384 wordpiece tokens, truncating evidence rather than the claim;
6. report evidence-token-length distributions by label to detect a length shortcut.

Every processed row carries `example_id`, `claim_id`, `abstract_id`, source split, source sentence IDs,
label, preprocessing-version hash, and raw-source hashes. No free-text row may exist without lineage.

## 7. Leakage-resistant splits

The public SciFact dev split remains untouched until the recipe, seed, and calibration method are
frozen. For cross-validation inside SciFact train:

- form a bipartite graph of `claim_id ↔ abstract_id`;
- assign whole connected components to one of five folds;
- keep every negative derived from a claim/document inside that component's fold;
- deduplicate normalized claims and document IDs before assigning folds;
- assert zero claim, abstract, connected-component, or exact normalized-text overlap across folds.

Use five training folds only to estimate variance and produce out-of-fold calibration logits. Do not
select a best fold or a best seed.

## 8. Frozen Ourobion-domain audit set

O29 must freeze the evidence-input contract first. Before any trained-model prediction is viewed,
create a candidate pool of at least 160 public-paper claim/evidence pairs, equally sampled from:

- gut health;
- hydration/heat;
- wearables/recovery;
- environment/vector exposure.

No user data is involved. Two reviewers independently label each pair using only the claim, retrieved
evidence, source locator, and this rubric; they do not see the synthesis/verifier/model verdict:

- `supported`: the evidence directly supports every material predicate, population/context qualifier,
  and direction in the claim;
- `contradicted`: the evidence directly conflicts with a material predicate or direction;
- `uncertain`: evidence is missing, indirect, mixed, partial, or insufficient for either decision.

Freeze all eligible adjudicated examples, targeting at least 96 total and at least 20 per domain. Do
not drop examples after predictions are known to improve balance. Record raw agreement, Cohen's kappa,
both original labels, adjudicated label, adjudicator, reason code, and the immutable set hash. If there
is no independent second reviewer/adjudicator, results must be labelled **preliminary** and cannot make
the model eligible even for a later shadow proposal.

This is a deliberately enriched audit/challenge set, not a prevalence sample. Report its observed
label mix; do not extrapolate class prevalence to production.

## 9. Preregistered training recipe

No broad hyperparameter sweep is allowed. Freeze this recipe before the first full GPU run:

| Setting | Value |
|---|---|
| Architecture | BiomedBERT base + three-class linear classification head |
| Max sequence length | 384 wordpieces |
| Optimizer | AdamW |
| Learning rate | `2e-5` |
| Weight decay | `0.01` |
| Effective batch size | 32 (gradient accumulation allowed) |
| Epoch ceiling | 5 |
| Warmup | 10% of optimizer steps |
| Gradient clipping | 1.0 |
| Precision | BF16 on H100/H200; FP32 metric accumulation |
| Selection metric | macro F1 on the fold validation partition |
| Early stopping | grouped train-fold jobs only: patience 2; minimum delta 0.002 macro F1 |
| Seeds | 17, 42, 73; seed 42 is the preregistered release candidate |
| Calibration | one scalar temperature fitted on seed-42 out-of-fold train logits only |

Enable deterministic algorithms where supported and record `CUBLAS_WORKSPACE_CONFIG`, CUDA, driver,
GPU, PyTorch, Transformers, Datasets, Tokenizers, NumPy, and scikit-learn versions. A deterministic
flag is evidence, not proof; the clean rerun gate below measures actual reproducibility.

After the five grouped fold jobs, freeze the final epoch count as the median selected fold epoch before
any SciFact dev result is viewed. Train all three final seeds and the clean rerun for exactly that epoch
count. SciFact dev is evaluation-only: it cannot select an epoch, checkpoint, seed, threshold, or
recipe change.

### 9.1 Bounded job ledger

| Jobs | Purpose |
|---|---|
| 1 CPU/preflight | Licence, source hashes, split/dedup assertions, class/length report |
| 1 GPU smoke | 64 examples, one optimizer step, evaluation and artifact upload round-trip |
| 5 GPU fold jobs | Seed 42, one per grouped fold; out-of-fold metrics/calibration logits |
| 3 GPU final jobs | Seeds 17/42/73 on the official training split for the fixed median-fold epoch count; each receives one evaluation on untouched SciFact dev |
| 1 GPU ablation | Seed 42 with whole-abstract evidence to quantify the evidence-window decision |
| 1 clean GPU rerun | Seed 42 from an empty container/object-prefix for reproducibility |

That is a maximum of **11 GPU jobs**, not 11 GPU instances. Run them sequentially on one container.
No extra run may be added merely to chase a better score. A failed infrastructure job may be retried
once after its cause is recorded; a scientifically disappointing result is not an infrastructure
failure.

## 10. Evaluation protocol

Evaluate the preregistered seed-42 candidate and show the other seeds as variance, not as alternatives
from which to cherry-pick.

Required outputs on untouched SciFact dev and the frozen Ourobion audit set:

- example count and class prevalence;
- confusion matrix;
- per-class precision, recall, and F1;
- macro F1, balanced accuracy, and ordinary accuracy;
- multiclass Brier score and 10-bin equal-mass expected calibration error;
- reliability diagram;
- bootstrap 95% confidence intervals, resampled by claim/document component rather than row;
- abstention coverage and selective error at confidence thresholds 0.50, 0.60, 0.70, 0.80;
- batch-1 and batch-32 latency, throughput, peak GPU memory, wall-clock time, and GPU-hours;
- slices by domain, label, evidence length quartile, claim kind when available, and source/study tier;
- a coded error table for negation, direction reversal, population mismatch, numerical mismatch,
  insufficient evidence, mixed evidence, and truncation.

Baselines/comparators:

1. majority-class baseline;
2. deterministic lexical-overlap baseline from the frozen preprocessing pipeline;
3. whole-abstract ablation;
4. the current verifier's **already frozen O29 outputs** on the same in-domain examples.

Do not make new Anthropic/OpenAI calls for O30. If O29 did not produce comparable frozen outputs,
record the comparison as unavailable rather than spending to manufacture it.

## 11. Completion, outcome, and future-promotion gates

### 11.1 O30 completion gate

O30 is complete when all of these are true, even if the outcome is `no-go`:

- GMI-H1–H8 and all licence/data lineage fields are recorded;
- the fixed jobs ran within the authorized budget or an honest blocker is recorded;
- the audit set was frozen before model predictions and reviewer independence is disclosed;
- required metrics, uncertainty, slices, errors, costs, and limitations are published;
- the clean rerun meets the reproducibility rule below;
- no runtime/serving file or shared contract was changed to consume the model;
- the object release is checksummed, its actual retention/versioning/overwrite control is disclosed,
  and the model card says `non-serving`;
- the container is terminated, any EIP is released, scratch data is removed, and temporary secrets are
  revoked/rotated;
- O24's cumulative exact-SHA gate is rerun for Run-3 closeout.

Poor performance produces a completed `no-go` experiment, not endless tuning. Licence failure,
unavailable GMI entitlement/credits, missing independent audit labels, or inability to reproduce the
run blocks O30.

### 11.2 Reproducibility rule

Across the seed-42 original and clean-container rerun:

- source, processed-data, split, config, code, environment, and evaluation-set hashes must match
  exactly;
- the rerun receives its own immutable model hash; do not pretend two nondeterministic weight files
  can be “within tolerance” by hash;
- macro F1 must differ by at most 0.01, every class F1 by at most 0.02, and prediction agreement must
  be at least 98%; otherwise investigate and report the run as non-reproducible.

### 11.3 Outcome label

The model card records one of:

- `no-go`: the model is not credible enough for further integration;
- `research-complete`: useful evidence was produced, but reviewer/sample/performance limitations remain;
- `eligible-for-shadow-review`: may be proposed later for prediction logging with **zero serving
  influence**, only if the independently labelled audit set is non-preliminary, macro F1 ≥0.70,
  every class recall ≥0.60, ECE ≤0.10, improvement over the majority baseline is ≥0.10 macro F1,
  and no domain macro F1 is below 0.55.

These are engineering screening thresholds, not proof of scientific or clinical validity. None allows
active short-circuiting. Active use would require a later prospective, naturally sampled evaluation
with at least 500 independently labelled examples, high-precision class-specific safety gates, drift
monitoring, rollback, and explicit product/science/privacy approval.

## 12. Artifact and provenance contract

The private object release contains:

```text
release-manifest.json
data-manifest.json
split-manifest.json
licences-and-attribution.md
environment.json
training-config.yaml
training-log.jsonl
cost-ledger.json
model/model.safetensors
model/config.json
model/tokenizer/**
evaluation/scifact/**
evaluation/ourobion-audit/**
evaluation/predictions.jsonl
evaluation/error-analysis.csv
evaluation/calibration.json
model-card.md
sha256sums.txt
```

`release-manifest.json` binds the model-lab git SHA, main Ourobion git SHA, O29 science-release ID,
GMI organization/region/product/template/runtime identifiers, image digest or unavailable marker,
start/end time, GPU-hours, source/split/
config/environment hashes, artifact hashes, operator, reviewers, and outcome label.

The main Ourobion repository later receives only small reviewable artifacts under a Run-3 evidence
folder: the model card, licences/attribution, manifests/hashes, aggregate evaluation tables/plots,
external object pointer, spend receipt, and promotion decision. Do not commit raw SciFact text,
individual unpublished reviewer notes, secrets, container images, or model weights.

Under Ourobion's two-tier truth rule, source licences, immutable data/split/config manifests, training
code revision, human audit labels, and evaluation protocol are truth. Model weights, predictions,
plots, and aggregate metrics are rebuildable projections; change inputs/code and rerun rather than
hand-editing them.

## 13. Cost controls

Immediately before launch, copy the live console SKU price and estimated monthly/period cost into the
O30 issue. Recommended pilot bounds, subject to Jayden's explicit approval:

- one GPU only;
- at most **6 GPU-hours** including the clean rerun;
- at most **USD 20 compute** and **USD 25 all-in** including storage/EIP;
- auto-pay off;
- checkpoint upload after every job;
- before the first GPU job, reserve a conservative amount for every remaining preregistered job,
  checkpoint storage, and any EIP; stop when actual spend plus that remaining-work reserve reaches the
  approved cap. The 80% warning triggers a reforecast, not an automatic stop when the reserved work
  still fits.

At the current public “from” rates, six H100 hours is USD 12 and six H200 hours is USD 15.60 before
storage, networking, region, discounts, taxes, or minimums. These are planning estimates only; the
console is the purchase authority. Record actual credits, invoice usage, GPU-hours, and any EIP/storage
charges. Terminating a pay-as-you-go container and **releasing**, not merely disassociating, its EIP is
part of closeout.

## 14. Stop conditions

Stop without improvising when any of these occurs:

- GMI container entitlement, approved credits, storage, or exact price is unavailable;
- an input/model licence is missing, contradictory, or not approved;
- a source, split, or code hash differs from the manifest;
- train/dev or audit-set leakage is detected;
- personal/user data or an unrelated production secret is found in the workspace;
- independent labelling is unavailable and Jayden does not accept a preliminary no-promotion result;
- smoke training produces NaN/Inf, cannot upload a checkpoint, or cannot be restored in a clean process;
- the forecast no longer leaves enough authorized compute plus storage/network reserve for every
  remaining preregistered job, especially the clean rerun;
- the first full evaluation has been viewed and someone proposes changing the recipe solely to improve
  the reported score;
- any implementation tries to wire predictions into Run-3 serving.

Record the exact blocker in [`pending-build-register.md`](./pending-build-register.md) under B-BR4/B6;
do not replace O30 with a different model or an eighth Run-3 feature.

## 15. Run-3 execution order for O30

1. **T0 — human/platform gate:** finish GMI-H1–H8; freeze cost and access evidence.
2. **T1 — external repo gate:** create/pin `ourobion-model-lab`, lock dependencies, pass unit tests.
3. **T2 — licence/data gate:** download official inputs, hash them, build grouped splits, publish the
   class/length/leakage report without using a GPU.
4. **T3 — audit-set gate:** freeze O29-derived candidate pool, complete blinded dual review and
   adjudication, hash the final set.
5. **T4 — GMI smoke:** launch one container, record environment, run 64-example smoke, upload/restore
   one checkpoint, then verify the cost meter.
6. **T5 — bounded training:** execute the preregistered 5-fold, 3-seed, and one-ablation jobs only.
7. **T6 — evaluation:** fit temperature from OOF logits, evaluate untouched SciFact dev and the frozen
   audit set, create metrics/plots/error analysis/model card.
8. **T7 — clean rerun:** start from an empty workspace using only immutable inputs and execute seed 42.
9. **T8 — archive and close:** upload/checksum release, record spend, terminate compute/release EIP,
   rotate temporary credentials, publish small evidence artifacts, declare outcome, and run cumulative
   Run-3 CI/sign-off reconciliation.

## 16. Work explicitly deferred beyond Run 3

- HealthVer licensing/permission and COVID-domain analysis;
- models (b1) study-design and (c) relation/direction/claim-kind;
- active NLI routing or verifier short-circuiting;
- model serving, endpoints, quantization, mobile deployment, or latency SLOs;
- training on Ourobion human verdicts;
- autonomous retraining, drift-triggered retraining, or model registry automation;
- any claim that this model scientifically validates Ourobion's knowledge graph.
