---
title: Model training — isolated research workstreams
summary: Staging home for custom-model experiments that are operationally independent from Ourobion product build runs. Each model owns its external code, compute, budget, data, evaluation, and closeout; only frozen evaluation artifacts may cross into this repository.
type: plan
scope: model-training
status: draft
updated: 2026-07-26
---

# Model training — isolated research workstreams

Custom-model training is **not a Run-3 unit** and is not governed by a product run's unit, file, line,
provider, or sign-off envelope. It has its own issue/session, human approvals, budget, completion state,
and external execution repository. A blocked experiment remains blocked; it cannot consume a product
unit or silently become product integration work.

## Workstreams

| Model | State | Plan | Runtime posture |
|---|---|---|---|
| `zebra-nli-shadow-v0` | planned; no training or GMI provisioning performed | [`zebra-nli-shadow-v0-training-plan.md`](./zebra-nli-shadow-v0-training-plan.md) | research-only; no serving or shadow telemetry |

## Repository boundary

- Python training code, dependency locks, raw datasets, checkpoints, and weights live in the separate
  private `ourobion-model-lab` repository and approved object storage. Ourobion remains Python-free.
- This repository may retain only reviewable manifests, hashes, licences/attribution, aggregate
  evaluation outputs, a model card, spend evidence, and an external artifact pointer.
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
