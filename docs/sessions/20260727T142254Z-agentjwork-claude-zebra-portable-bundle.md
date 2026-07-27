---
title: Complete the portable Zebra training bundle for the Mac Mini
summary: Finished the self-contained zebra-training folder — config, label-blind data pipeline, grouped splits, metrics, model, CLI, fetch, tests and runbook. 82 tests pass offline, fail-closed gates verified, and Z1 label-invariance proven behaviourally as well as by signature. No training run; nothing downloaded.
type: session
scope: model-training
status: canonical
updated: 2026-07-27
---

# Complete the portable Zebra training bundle

Issue: [#152](https://github.com/uandiqueue/ourobion/issues/152)
Branch/worktree: `feat/model-training/mt3-zebra` in `C:\project\ourobion-mt3`
Task claim: `mt3-zebra-training` / `claude` / `agentjwork`

The bundle is `docs/temp/model-training/zebra-training/`, designed to be **sent whole** to an Apple
Silicon Mac Mini and run there without the Ourobion repo.

## Why it is portable rather than in-repo

Training on the Windows laptop would contend with the concurrent Run 4 build. Measured: **2.4 GB RAM
free of 15.7 GB, commit charge 43.1 GB** against 15.7 GB physical (heavy paging), WSL uncapped.
Training needs 3–5 GB host RAM on top. GPU VRAM is separate and was never the constraint — host RAM
and disk are.

The Mac Mini also removes three problems at once: it is a different machine so interference is
structurally zero; the arm64 torch wheel is 59 MB with Metal built in versus 190 MB plus a ~2.4 GB CUDA
payload on Windows; and it sidesteps the Python 3.13 wheel blocker entirely.

## Changed

Bundle contents, all self-contained (no import from the repo):

| File | Role |
|---|---|
| `README.md` | Runbook: setup → licence → fetch → preflight → smoke → train → evaluate, plus troubleshooting |
| `OWNER-NOTE.md` | Resource disclosure for the machine's owner |
| `setup-macos.sh` | Creates `.venv` in-folder, installs pins, verifies MPS with a real matmul |
| `requirements-macos.txt` | arm64 pins matching `model-training/constraints.txt` |
| `src/zebra/{config,data,splits,metrics,model,cli}.py` | The package |
| `fetch_assets.py` | The only networked script; hashes everything into `data-manifest.json` |
| `licence-approval.example.json` | Expected shape; a human must produce the real one |
| `tests/` + `tests/fixtures/toy_scifact.jsonl` | 82 stdlib `unittest` tests, offline |

## Verified independently

Not taken from the subagent reports — re-run by me:

- `python -m unittest discover -s tests` → **`Ran 82 tests` / `OK`**, offline.
- **Fail-closed licence gate**: `preflight` and `dry-run` both exit **2** with no `licence-approval.json`.
- **Z1 by signature**: `select_evidence_sentences(claim_text, abstract_sentences, config)` — three
  positional parameters, no `**kwargs`; `preflight_check_label_blind` accepts the real selector and
  rejects a rigged variant taking `label=None` with `TypeError`.
- **Z1 behaviourally**, which is the stronger proof: the same claim and abstract built three times with
  verdicts `SUPPORT` / `CONTRADICT` / `NEI` produce **byte-identical `source_sentence_ids` and
  `evidence_text`**; only `label` differs.

## Decided

- **Z1 is enforced structurally, not by convention.** The selector cannot receive a label — `config` is
  a frozen dataset-wide recipe with no per-row field, and `build_example` calls the selector first,
  attaching the label afterwards through a separate function. The oracle-rationale path is a separate
  function, default off. This was the defect that would otherwise have inflated the headline number.
- **The third class stays `insufficient_evidence`**, never `uncertain`. The contract separates "no
  evidence found" from "could not be grounded"; SciFact `NEI` is neither, so the class is model-native
  and fills no contract state.
- **Recipe deviations are recorded, not silently applied.** The plan's BF16 assumes H100; on Apple
  Silicon the default is fp32, written into `train-artifact.json` as `precision_deviation` whenever the
  device is `mps`. Device selection does a real smoke matmul rather than trusting the availability
  flag, because MPS can silently fall back.
- **Every artifact records wall-clock per phase.** The timings quoted to the machine's owner are
  unverified estimates; the first real run replaces them with measurements.
- `setup-macos.sh` **refuses to install Python** and exits with guidance — it is someone else's machine.

## Left — what is unverified, and it is a lot

Nothing here has touched the network, real SciFact, a real Hugging Face tokenizer, or Apple Silicon.
Unverified by construction, to be checked on the first Mac run:

- `fetch_assets.py` actually downloading SciFact and BiomedBERT.
- `train`/`evaluate` exercising real `torch`/`transformers` end to end — the 82 tests cover pure-Python
  logic and a toy tokenizer, not a real training step.
- MPS selection and the practical impact of the fp32 deviation.
- The data-hash-mismatch gate firing against a real manifest (verified by inspection and by symmetry
  with the licence gate, which does fire).
- **Whether real SciFact clears `min_per_class_per_fold`.** That assertion exists precisely because
  ~1,259 rows over three classes cannot be assumed to give viable per-class support in every fold. It
  may well fire on first contact, and that would be the check working.
- Real wall-clock. The ~4 min MPS / ~15 min CPU figures remain estimates.

Also outstanding: the human must produce a real `licence-approval.json` before anything runs — the
gates are fail-closed and will refuse otherwise.

## Blockers

- No training was run, nothing was downloaded, no GPU was used, no compute was provisioned.

memory: none
