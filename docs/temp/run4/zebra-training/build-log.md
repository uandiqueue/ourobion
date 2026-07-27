---
title: Zebra NLI Shadow v0 — training build log (resumable)
summary: Resumable state for the MT3 Zebra build. Step 0 (storage and environment survey) is complete and found a blocker: the pinned ML stack has no Python 3.13 wheels while the only local interpreters are 3.13 and 3.14. Nothing has been downloaded or installed; no compute has run.
type: plan
scope: model-training
status: draft
updated: 2026-07-27
---

# Zebra NLI Shadow v0 — training build log

Issue: [#152](https://github.com/uandiqueue/ourobion/issues/152)
Branch/worktree: `feat/model-training/mt3-zebra` in `C:\project\ourobion-mt3`
Task claim: `mt3-zebra-training` / `claude` / `agentjwork`

**▶ RESUME AT: S1 — blocked on a human decision (see "Open decision" below).**

Operating constraints for this build, set by Jayden:

- do **not** run the main compute first;
- determine local storage **before** fetching any large data;
- **stop and report** when a problem arises;
- keep the workflow resumable — this file is the resume point.

## Worklist

| Step | What | Status | Notes |
|---|---|---|---|
| S0 | Storage + environment survey | **done** | Blocker found; see below. Nothing downloaded |
| S1 | Choose interpreter + torch build; create the env | **blocked** | Needs the decision below |
| S2 | Fold Z1/Z2/Z3/Z5 into the Zebra plan | next | Docs only; independent of S1, can proceed in parallel |
| S3 | Record the SciFact licence approval artifact | queued | Substrate fails closed without it |
| S4 | Install the `ml` extra into the new env | queued | Sizes measured, see below |
| S5 | Download + hash SciFact; build the data manifest | queued | Small (~5 MB) |
| S6 | Implement the MT3 adapter and recipe | queued | The bulk of the work |
| S7 | CPU smoke on fixtures | queued | |
| S8 | Train (single seed) | queued | Main compute — deliberately last |
| S9 | Evaluate and write up | queued | |

## S0 findings — environment survey (2026-07-27)

**Hardware.** i7-11800H, 8 cores / 16 threads · 15.7 GB RAM · **18.9 GB free on C:** ·
NVIDIA GeForce RTX 3050 Ti Laptop, **4096 MiB VRAM** · `nvidia-smi` present.

**Blocker — no Python 3.13 wheels for the pinned ML stack.** Every compiled pin tops out at **cp312**:

| package | pin | cp313 win_amd64 wheel? |
|---|---|---|
| numpy | 1.26.4 | **no** (max cp312) |
| scipy | 1.13.1 | **no** |
| scikit-learn | 1.5.1 | **no** |
| torch | 2.4.1 | **no** |
| onnx | 1.16.2 | **no** |
| onnxruntime | 1.18.1 | **no** |
| transformers / datasets | 4.44.2 / 2.20.0 | pure-python, fine |

The only interpreters on this machine are **3.13.13** (graphify venv and miniconda base) and **3.14.6**
(py launcher). Neither can install the pinned set. This is not a pin error — MT0 decision **D3** targets
Python 3.10 to match the CI pin and the documented GMI runtime; the machine simply has no 3.10.

**Resolution available locally.** Miniconda 26.3.2 is installed at
`C:\project\biotope-toolchain\miniconda`, so `conda create -n zebra python=3.10` produces the exact
target interpreter with no new installer. That keeps D3 and D4 intact and exercises the same pinned set
CI does.

**Storage, measured from package metadata (nothing downloaded).**

| Path | Download | Installed (est.) | Training time, 919 rows × 5 epochs |
|---|---|---|---|
| **CPU-only torch** | **288 MB** | ~0.8–1.0 GB | ~20–45 min on 16 threads |
| **CUDA torch (cu121)** | **~2.4 GB** | ~5–6 GB | ~2–5 min on the 3050 Ti |

Both fit in 18.9 GB. The CPU path leaves ~18 GB free; the CUDA path leaves ~13 GB.

**Correction to an earlier claim.** I previously said the local GPU makes this a minutes-long job. That
holds only with the CUDA build. **PyPI's `torch==2.4.1` Windows wheel is CPU-only** — 190 MB, and its
`nvidia-*` dependencies are gated `platform_system == "Linux"`. Using the RTX 3050 Ti requires
installing explicitly from `https://download.pytorch.org/whl/cu121`, which is the 2.4 GB path.

**VRAM note if the CUDA path is chosen.** 4 GB is tight for BiomedBERT-base at 384 tokens. Batch 8 with
gradient accumulation ×4 reaches the plan's preregistered effective batch of 32 and fits; batch 32
directly would very likely OOM. FP16 rather than the plan's BF16, since this is Ampere consumer silicon.

## Open decision — CPU or CUDA

**Recommendation: CPU-only.** 919 training rows is a small job; ~20–45 minutes is well inside a one-day
budget, it costs 288 MB instead of 2.4 GB, and it avoids CUDA/driver/VRAM risk on a 4 GB laptop part
entirely. The GPU becomes worth its 5–6 GB only if the scope grows to 5-fold × 3 seeds, or Viceroy and
further models join today.

Either way the deviation from the plan's preregistered BF16-on-H100 recipe gets recorded rather than
silently applied.

## Ledger

| When | Step | What ran | Outcome |
|---|---|---|---|
| 2026-07-27 | S0 | PyPI metadata queries; `Get-CimInstance` hardware survey; `conda env list`; disk check | Blocker found. **No packages downloaded, no env created, no compute run** |

## Standing limits for whatever this produces

Single seed, one frozen split, no independent audit set — **preliminary**. Non-serving unconditionally:
no influence on `EdgeVerification`, edge score, cards, routing or spend, and no A10 short-circuit. A
documented no-go remains a valid outcome.
