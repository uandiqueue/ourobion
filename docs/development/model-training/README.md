---
title: Model training — isolated research workstreams
summary: Staging home for custom-model experiments that are operationally independent from Ourobion product build runs. Code lives in this repository's isolated model-training/ workspace; each model owns its own compute, budget, data, evaluation, and closeout. Zebra and Viceroy were trained and evaluated on local Apple Silicon after the requested GPU container did not arrive; only code, manifests, and frozen evaluation artifacts are committed here — never weights or raw datasets.
type: plan
scope: model-training
status: draft
updated: 2026-08-02
---

# Model training — isolated research workstreams

Custom-model training is **not a Run-3 unit** and is not governed by a product run's unit, file, line,
provider, or sign-off envelope. It has its own issue/session, human approvals, budget, completion state,
and an isolated in-repo code workspace (`model-training/`; see
[`AGENTS.md`](../../../AGENTS.md) §1/§4 and
[`code-build-decisions.md`](./code-build-decisions.md) D1). A blocked experiment remains blocked; it
cannot consume a product unit or silently become product integration work.

## Workstreams

| Model | State | Plan | Runtime posture |
|---|---|---|---|
| `zebra-nli-shadow-v0` | **trained and evaluated (v1)** on local Apple Silicon; macro-F1 0.599 ± 0.008 against a pre-registered 0.70 bar — **failed its bar**, `serving_ready=false` | [`zebra-nli-shadow-v0-training-plan.md`](./zebra-nli-shadow-v0-training-plan.md) · [results](../../../model-training/evidence/publication-results/zebra-v1-results.md) | research-only; no serving or shadow telemetry |
| `giraffe-study-design-v0` | planned; dataset and licence gates remain | [`giraffe-study-design-v0-training-plan.md`](./giraffe-study-design-v0-training-plan.md) | research-only; offline evidence-tier evaluation |
| `salmon-relation-direction-v0` | planned; BioREDirect licence is unresolved | [`salmon-relation-direction-v0-training-plan.md`](./salmon-relation-direction-v0-training-plan.md) | research-only; offline relation/direction evaluation |
| `viceroy-claim-kind-v0` | **trained and evaluated (v0, rescoped)** on local Apple Silicon; macro-F1 0.866 vs 0.507 cue-lexicon baseline on one frozen fold-0 holdout, five-fold cross-validation not completed; not validated, not serving; public weight release still blocked pending GPL-3.0 clearance | [`viceroy-claim-kind-v0-training-plan.md`](./viceroy-claim-kind-v0-training-plan.md) · [results](../../../model-training/evidence/publication-results/viceroy-v0-results.md) | research-only; offline causal-language evaluation |
| `leafcutter-sentence-role-v0` | planned; CPU-first baseline precedes any GPU | [`leafcutter-sentence-role-v0-training-plan.md`](./leafcutter-sentence-role-v0-training-plan.md) | research-only; no serving or pipeline substitution |

The full train/do-not-train decision record is [`model-roster.md`](./model-roster.md). The current
execution order is set by [`run2/README.md`](./run2/README.md) — Zebra first, then rescoped
Viceroy — which supersedes the suggested order in `model-roster.md` §7 and the one-day priority
list in the review §10.2.

### Portable training bundles

Self-contained folders that can be handed to a machine without this repository. Each carries its
own setup script, pinned requirements, fail-closed licence gate, tests, and the context documents
needed to interpret a result without repo access.

| Bundle | Model | State |
|---|---|---|
| [`zebra-training/`](./zebra-training/) | `zebra-nli-shadow-v0` | training run completed on local Apple Silicon; results published |
| [`viceroy-training/`](./viceroy-training/) | `viceroy-causal-language-risk-v0` (rescoped) | training run completed on local Apple Silicon; results published; public weight release still blocked on the GPL-3.0 determination |

The Viceroy bundle's [`LEAKAGE.md`](./viceroy-training/LEAKAGE.md) records a finding that affects
the plan rather than only the bundle: the released corpus carries **no PMID**, so the plan's
"group folds by PMID" requirement is not implementable and same-paper leakage stays uncontrolled.

## Compute — where these actually trained

An NVIDIA H100 container was requested from **GMI Cloud on 27 July 2026** and did not arrive within
the challenge window. The sponsor credit also covered CPU and hosted third-party inference rather
than a custom training job, so it would not have funded this work in any case. Both checkpoints were
therefore trained **locally on Apple Silicon** (`device: mps`, fp32) — Zebra in 313 s of wall-clock
training, Viceroy on the same substrate.

Consequences to carry forward rather than re-litigate:

- Model size and training length are bounded by a laptop, not by the GPU assumptions the training
  plans were written against. [`code-build-decisions.md`](./code-build-decisions.md) D3 still pins CI
  to Python 3.10 to match the documented GMI runtime; that pin is now **defensive, not descriptive**.
- Viceroy has one frozen fold-0 holdout instead of completed five-fold cross-validation. That is a
  direct consequence of available compute, and it is stated as a limitation in the results rather
  than smoothed over.
- **Do not plan further model work around GMI provisioning** until a container is actually in hand.
  Recorded durably as [`docs/memory/0024`](../../memory/0024-training-compute-is-local.md).

## Repository boundary

- Python training/evaluation/export code lives in this repository's isolated `model-training/`
  workspace (see [`AGENTS.md`](../../../AGENTS.md) §1/§4 and
  [`code-build-decisions.md`](./code-build-decisions.md) D1) — never inside `apps/`, `supabase/`,
  `shared/`, or `tools/`. Raw datasets, checkpoints, and model weights are still never committed: they
  stay in local/ephemeral storage or an approved external object-storage bucket, excluded by
  `.gitignore` by construction.
- This repository retains the `model-training/` code itself, plus reviewable manifests, hashes,
  licences/attribution, aggregate evaluation outputs, a model card, spend evidence, and an external
  artifact pointer — never a raw dataset, a checkpoint, or a model weight.
- No personal rows, Supabase exports, production telemetry, secrets, or model weights cross into the
  training environment.
- Training completion does not authorize model serving, verifier short-circuiting, prediction logging,
  contract changes, or client UI changes. Each requires a later product decision and review.

## The only Ourobion integration seam: evaluation

Zebra and the existing LLM verifier may be compared on the **same frozen public claim/evidence
manifest**. Human-adjudicated labels remain the primary reference; LLM output is a benchmark, not
ground truth. The LLM evaluation must be blind to Zebra predictions and record the exact provider,
returned model identifier, prompt/protocol revision, token/cost ledger, output hash, and failures.

Existing compatible frozen verifier outputs should be reused. If new paid calls are required, they
belong to the model-training task and need a separate user-approved cap; they do not consume or inherit
Run 3's provider budget. Only the frozen JSONL/manifest and aggregate comparison cross the boundary—no
runtime dependency is created in either direction.

## Lifecycle

1. Approve platform, licence, reviewer, and cost gates.
2. Freeze data, splits, preprocessing, evaluation protocol, and LLM benchmark protocol.
3. Train and evaluate externally, without reading Ourobion user data.
4. Publish checksummed review artifacts and one honest outcome label.
5. Terminate compute and revoke temporary access.
6. Open a separate product proposal only if later integration is desired.
