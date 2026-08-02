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

**▶ RESUME AT: S6 — write the Python training code into `src/zebra/`.**

S0–S2 are done. The bundle is now being made **portable for an Apple Silicon Mac Mini**, because
training on the Windows laptop would contend with the concurrent Run 4 build. Measured on 2026-07-27:
**2.4 GB RAM free of 15.7 GB, commit charge 43.1 GB** (heavy paging), WSL uncapped with no
`.wslconfig`. Training needs 3–5 GB host RAM on top of that, so it would degrade both workloads.

### Portable bundle status (2026-07-27)

| File | State |
|---|---|
| `OWNER-NOTE.md` | **done** — resource disclosure to hand the machine's owner |
| `requirements-macos.txt` | **done** — arm64 pins matching `model-training/constraints.txt` |
| `setup-macos.sh` | **done** — creates `.venv`, installs pins, verifies MPS with a real matmul; refuses to install Python itself and exits with guidance instead |
| `src/zebra/**` | **not written** — two agent dispatches hit API 529 Overloaded (server-side, unrelated to local RAM) |
| `tests/**` | **not written** |
| `fetch_assets.py` | **not written** |
| `licence-approval.example.json` | **not written** |

Sizes measured for the owner note: mac arm64 wheels **121 MB** total (torch is 59 MB with Metal built
in, vs 190 MB on Windows); BiomedBERT `pytorch_model.bin` **420 MB** — the repo totals 838 MB but the
418 MB Flax copy is not fetched.

Nothing has been downloaded, installed, or trained on any machine.

Operating constraints for this build, set by Jayden:

- do **not** run the main compute first;
- determine local storage **before** fetching any large data;
- **stop and report** when a problem arises;
- keep the workflow resumable — this file is the resume point.

## Worklist

| Step | What | Status | Notes |
|---|---|---|---|
| S0 | Storage + environment survey | **done** | Blocker found; see below. Nothing downloaded |
| S1 | Create the env; install the pinned stack | **done** | Python 3.10.20 + full `ml` extra, CPU torch. See S1 below |
| S2 | Fold Z1/Z2/Z3/Z5 into the Zebra plan | **next** | Docs only. Z1 decides whether the result means anything |
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

## S1 findings — environment built (2026-07-27)

**Interpreter blocker resolved, and a licensing trap avoided.** `conda create` against the bundled
Miniconda failed with `CondaToSNonInteractiveError`: Anaconda's default channels
(`repo.anaconda.com/pkgs/main`, `/r`, `/msys2`) now require accepting their **Terms of Service**. That
is a licensing decision, not a technical one, so it was not accepted on Jayden's behalf — particularly
in a workstream this careful about licences.

**Miniforge** (already installed at `C:\Users\agent-j\miniforge3`) defaults to **conda-forge**, which
carries no such gate. The env was created from conda-forge only, with `--override-channels`, and placed
**project-bounded** per AGENTS.md §4 rather than in the user profile:

```
C:\project\biotope-toolchain\zebra-env     Python 3.10.20
```

3.10 is the D3 target — it matches the CI pin and the documented GMI runtime, so this env exercises
exactly the pinned set CI does.

**Installed, all exact pins matching `model-training/constraints.txt`:**

| package | installed |
|---|---|
| torch | 2.4.1**+cpu** |
| numpy · scipy · scikit-learn | 1.26.4 · 1.13.1 · 1.5.1 |
| transformers · datasets | 4.44.2 · 2.20.0 |
| onnx · onnxruntime | 1.16.2 · 1.18.1 |

`torch.get_num_threads() = 8`. CUDA unavailable by design (CPU wheel). Total footprint is the ~288 MB
download measured in S0, well inside headroom.

**CPU training time remains an estimate (~20–45 min for 919 rows × 5 epochs), not a measurement.** A
throughput probe was prepared but not run, so this figure is unverified and should be treated as such
until the first real run reports wall-clock.

## GMI inference — viable today, and not blocked by the container ticket

Researched because container entitlement may be delayed. Findings:

- **Serverless inference is not gated by the container entitlement.** GMI's Cluster Engine docs state
  plainly that "Bare Metal and Container access is gated per organization", while the Inference Engine
  quick start documents only: sign in → Settings → API Keys → call. The gating language is scoped to
  Cluster Engine alone. (Inferred from explicit gating on one product and its absence on the other; no
  page affirmatively states inference is ungated.)
- **OpenAI-compatible**: `https://api.gmi-serving.com/v1/chat/completions`, `Bearer <key>`, JSON mode
  via `response_format`, function calling via `tools`.
- **Rate limit**: fresh accounts are Tier 1 at 1,000,000 TPM — ample here. Note **voucher/sponsor credit
  redemptions do not count toward tier upgrades**; only purchased credits do. Sponsor credits therefore
  leave the account at Tier 1.
- **Candidate models** (open-weight, $/1M in→out, third-party aggregate — console is authoritative):
  `deepseek-ai/DeepSeek-V3.2` $0.28/$0.40 (163K ctx), `zai-org/GLM-4.7-FP8` $0.40/$2.00 (202K ctx),
  `moonshotai/Kimi-K2-Thinking` $0.80/$1.20, `meta-llama/Llama-3.3-70B-Instruct`.
- **Managed fine-tuning still does not exist** on GMI — unchanged since 2026-07-26. "My Models" only
  *registers* models trained elsewhere. So GMI could not train these for us even with entitlement;
  local training is the only training path today.

**Implication for the deferred models.** Giraffe, Salmon and Leafcutter can have their *function*
stood up today via prompted GMI inference, but that is **an LLM call, not a custom model** — it serves
neither the token-reduction purpose nor the "our own model" framing. Its honest uses are: a comparator
baseline, a teacher for later distillation, and — most valuably — a **second provider family**, which is
what O29's decorrelation invariant and blocker B5 actually need.

## Ledger

| When | Step | What ran | Outcome |
|---|---|---|---|
| 2026-07-27 | S0 | PyPI metadata queries; `Get-CimInstance` hardware survey; `conda env list`; disk check | Blocker found. **No packages downloaded, no env created, no compute run** |
| 2026-07-27 | S0b | Disk drill-down: `AppData\Local` subdirs, `docker system df`, `wsl -l -v` | Docker 18.7 GB + WSL 18.3 GB dominate, not the toolchain. ~8.5 GB reclaimable at zero risk (`docker system prune` 5.2 GB · Temp 2.6 GB · installer archives 2.0 GB). Advised **against** `prune -a`/`volume prune` — local Supabase state lives there |
| 2026-07-27 | S1 | `miniforge conda create -p ...zebra-env python=3.10 -c conda-forge --override-channels`; `pip install` pinned `ml` set | Env built, all eight pins verified. Anaconda ToS declined and routed around. **No training data fetched, no compute run** |

## Standing limits for whatever this produces

Single seed, one frozen split, no independent audit set — **preliminary**. Non-serving unconditionally:
no influence on `EdgeVerification`, edge score, cards, routing or spend, and no A10 short-circuit. A
documented no-go remains a valid outcome.
