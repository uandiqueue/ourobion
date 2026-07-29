---
title: Model training — isolated research workstreams
summary: Staging home for custom-model experiments that are operationally independent from Ourobion product build runs. Code lives in this repository's isolated model-training/ workspace; each model still owns its own compute, budget, data, evaluation, and closeout, and no training is executed here — only code, manifests, and frozen evaluation artifacts belong in this repository.
type: plan
scope: model-training
status: draft
updated: 2026-07-26
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
| `zebra-nli-shadow-v0` | planned; no training or GMI provisioning performed | [`zebra-nli-shadow-v0-training-plan.md`](./zebra-nli-shadow-v0-training-plan.md) | research-only; no serving or shadow telemetry |
| `giraffe-study-design-v0` | planned; dataset and licence gates remain | [`giraffe-study-design-v0-training-plan.md`](./giraffe-study-design-v0-training-plan.md) | research-only; offline evidence-tier evaluation |
| `salmon-relation-direction-v0` | planned; BioREDirect licence is unresolved | [`salmon-relation-direction-v0-training-plan.md`](./salmon-relation-direction-v0-training-plan.md) | research-only; offline relation/direction evaluation |
| `viceroy-claim-kind-v0` | planned; GPL-3.0 review is required | [`viceroy-claim-kind-v0-training-plan.md`](./viceroy-claim-kind-v0-training-plan.md) | research-only; offline causal-language evaluation |
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
| [`zebra-training/`](./zebra-training/) | `zebra-nli-shadow-v0` | code written; no training run |
| [`viceroy-training/`](./viceroy-training/) | `viceroy-causal-language-risk-v0` (rescoped) | code written and split pipeline verified against the real corpus; blocked on the GPL-3.0 determination; no training run |

The Viceroy bundle's [`LEAKAGE.md`](./viceroy-training/LEAKAGE.md) records a finding that affects
the plan rather than only the bundle: the released corpus carries **no PMID**, so the plan's
"group folds by PMID" requirement is not implementable and same-paper leakage stays uncontrolled.

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
