---
title: Run-3 GMI custom-model training plan and document consolidation
summary: Planned O30's SciFact-only, non-serving NLI Shadow v0 training/evaluation on a self-managed GMI GPU container; moved the living Run-3 backlog/register into docs/temp/run3; reconciled historical links and corrected the broader support-model design's licensing/sequencing posture.
type: session
scope: shared
status: canonical
updated: 2026-07-26
---

# Run-3 GMI custom-model training plan and document consolidation

Issue: [#138](https://github.com/uandiqueue/ourobion/issues/138)
Branch/worktree: `docs/run3-gmi-training-plan` in `C:\project\ourobion-run3-138`
Task claim: `run3-gmi-training-plan` / `codex` / `agentjwork`

## Attempted

- Followed the new-session convention: context briefing, docs index, latest Run-2 sessions, issue,
  task claim, and isolated worktree from `dev-phase2-run2`.
- Used Graphify first to locate O30, B-BR4 and the GMI blocker. The first CLI invocation stalled because
  `scripts/biotope-env.ps1` runs `flutter.bat --version` before Graphify and that probe hung; invoking the
  Graphify executable directly succeeded. No graph defect caused the stall.
- Delegated bounded primary-source GMI research to `gpt-5.6-terra`/medium and Run-3 doc/link inventory
  to `gpt-5.6-terra`/low. Reused the pre-existing Mencius thread for a bounded ML/science review because
  it already occupied the fourth thread slot.
- Reviewed current O30/B-BR4, memory 0013, the support-model design, active docs and all inbound links.
- Researched current GMI account/organization, product entitlement, GPU containers, templates, access,
  SSH, networking, storage, billing, lifecycle, API and pricing from official documentation. Researched
  SciFact and BiomedBERT licences from the publishers' official repositories/model card.
- Ran an independent adversarial QA pass over the completed training plan. It found and prompted fixes
  for dev-set early-stopping leakage, undefined neutral labels, unsupported WORM/Jupyter-proxy/image-
  digest assumptions, and budget-reserve logic.
- Verified 7/7 locked Run-3 units, 56/56 unique pending-gap IDs, exact normalized content in both frozen
  Run-2 snapshots, all changed-document relative links, `git diff --check`, and
  `tools/context_sync.mjs --check`. No app/backend test suite was run because this session changes only
  planning and historical documentation.

## Changed

- Created `docs/temp/run3/README.md` as the Run-3 planning cockpit.
- Moved the living `next-build-optimizations.md` and `pending-build-register.md` authorities from
  `docs/temp/run2/` to `docs/temp/run3/`; left short superseded compatibility pointers at the old paths
  so historical append-only session/prompt links keep resolving.
- Added frozen in-tree Run-2 snapshots for both moved documents, so audit evidence does not depend on
  later edits to the living Run-3 authorities.
- Added `docs/temp/run3/custom-model-training-plan.md`, fixing the NLI Shadow v0 task, SciFact-only data
  and licence boundary, BiomedBERT base, grouped splits, blinded in-domain audit set, preregistered
  training jobs, calibration/metrics, reproducibility, artifacts, security/cost/stop gates, GMI setup,
  and hard non-serving boundary.
- Updated the temp run-folder map plus active Run-1/Run-2 links to the living Run-3 authorities.
- Updated `docs/nao/brain-support-models-design.md` to reject unconfirmed licences and state that Run 3
  trains only model (a); HealthVer and models (b1)/(c) remain deferred.

## Decided

- GMI's managed Fine-Tuning product is still documented as coming soon. O30 uses one self-managed,
  pay-as-you-go GPU container, not managed fine-tuning, bare metal, GMI Studio or Kubernetes.
- Training code lives in a separate private `ourobion-model-lab` repository because Ourobion remains
  Python-free. This repository receives only small manifests, licence/evaluation evidence and an
  external artifact pointer—never raw data, secrets or model weights.
- The pilot uses the pinned AllenAI SciFact entailment transform only after the upstream component
  licences plus its conservative CC-BY-NC metadata are approved. Arbitrary non-gold documents are not
  relabelled `uncertain`; HealthVer remains excluded.
- The model cannot affect serving in Run 3. A weak model can complete O30 as a documented no-go;
  performance is not tuned repeatedly until it passes.
- Object releases are called immutable only if an actual retention/versioning/deny-overwrite control is
  verified. Otherwise they are disclosed as checksummed but mutable.
- Issue #138 is pre-run planning and does not consume the Run-3 implementation envelope; its cap
  baseline is the exact commit Jayden accepts immediately before U0, after which every tracked change
  counts.

## Left

- Jayden must complete/approve GMI-H1–H8: organization/members, credits and auto-pay posture, Container
  entitlement, live SKU/region/price, SSH key, durable storage, separate model-lab repository, licence
  review, and exact GPU-hour/total-cost caps.
- O29 must freeze the evidence-input contract and public-paper in-domain audit candidate pool before O30.
- O30 execution, GMI provisioning, dataset download, human labels, Python model-lab implementation,
  GPU training and model artifacts are future work; none was performed in this planning session.
- Active NLI routing, short-circuiting, model serving, other support models and HealthVer stay beyond
  Run 3.

## Blockers

- GMI Container/Cold-Storage entitlements and the exact live SKU are organization-specific and require
  console/support confirmation.
- O30 remains human-gated on credits/cost authorization, dataset licence approval and independent audit
  reviewers. The managed GMI Fine-Tuning UI cannot currently be the assumed execution route.
- No paid GPU or Anthropic/OpenAI call was made in this session.

memory: none
