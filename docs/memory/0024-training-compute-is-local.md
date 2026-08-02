---
id: "0024"
title: Training compute is local Apple Silicon, not sponsor GPU
summary: The requested GMI Cloud H100 container never arrived and the sponsor credit did not cover custom training, so both trained checkpoints ran on local Apple Silicon — plan model work against a laptop budget until a GPU container is actually in hand.
type: memory
status: accepted
decided: 2026-08-02
updated: 2026-08-02
verified_by: Jayden
verified_at: 2026-08-02T09:21:34Z
---

# Training compute is local Apple Silicon, not sponsor GPU

An NVIDIA H100 container was requested from GMI Cloud on 27 July 2026 and did not arrive within the
Launchpad challenge window. Separately, the sponsor credit covered CPU and hosted third-party
inference rather than a custom training job, so it would not have funded the training regardless of
timing. Both Zebra and Viceroy were trained on local Apple Silicon (`device: mps`, fp32).

Plan model work against that budget, not against the GPU assumptions written into the training
plans. Two consequences are already visible in the published results: model size and training length
are laptop-bounded, and Viceroy carries one frozen fold-0 holdout instead of completed five-fold
cross-validation. CI still pins Python 3.10 to match the documented GMI runtime — that pin is
defensive, not a statement that GMI is the execution target.

Do not re-plan around GMI provisioning until a container is actually in hand. This is an external
supply constraint, not a mistake of ours, so it belongs here and in
[`model-training/README.md`](../development/model-training/README.md) rather than in
[what-we-got-wrong.md](../development/what-we-got-wrong.md). Related:
[0010](0010-ios-build-needs-mac-and-paid-account.md) records the comparable Apple hardware
constraint, and [0013](0013-brain-pipeline-and-support-models-decision.md) is the decision these
models serve.
