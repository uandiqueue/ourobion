# Zebra NLI Shadow v0 — training bundle

## What this is

A bounded research pilot: fine-tuning a small open-source language model (BiomedBERT, 110M
parameters) on **SciFact** (`allenai/scifact_entailment`, 919 train / 340 dev rows) to predict
whether a retrieved evidence sentence `supports`, `contradicts`, or is `insufficient_evidence`
for a scientific claim.

**This is non-serving.** Nothing this bundle produces feeds any production system, routing
decision, or score. A single seed, one frozen split, no independent audit set — the result is
preliminary by construction. **A documented no-go (the recipe doesn't work well enough to be
useful) is a valid, expected outcome of running this**, not a failure of the bundle.

`insufficient_evidence` is a deliberate, model-native class — see the module docstring in
`src/zebra/data.py` for why it must never be renamed to `uncertain`.

Everything this bundle needs or produces lives **inside this one folder**. See `OWNER-NOTE.md`
for a short, honest account of what this does to the machine (disk, memory, network, compute
time) — hand that to whoever owns the Mac Mini before running anything.

## 0. One-time setup

```bash
bash setup-macos.sh
```

Creates a self-contained Python 3.10 virtualenv at `.venv` inside this folder and installs the
pinned dependencies from `requirements-macos.txt` (~150 MB download, ~600 MB installed). Verifies
MPS (Apple GPU) availability with a real matmul, not just the availability flag — see the script's
own output for what it found on this machine. Refuses to install Python itself; if no Python 3.10
is present it stops and tells you rather than doing anything silently (see Troubleshooting).

After it finishes:

```bash
source .venv/bin/activate
```

Do this once per terminal session before any of the commands below.

## 1. Licence approval (a human must do this)

`licence-approval.example.json` shows the expected shape. Copy it:

```bash
cp licence-approval.example.json licence-approval.json
```

Then **actually read the licence terms** for SciFact and BiomedBERT (URLs are in the file),
fill in `approved_by`, `date`, and `notes` truthfully, and only then set `"status": "approved"`.

Every subcommand below except `fetch` (which still needs the file, just not this specific check
first) fails closed — exit code 2, clear stderr message — if `licence-approval.json` is missing
or its `status` is anything other than `"approved"`. Nothing in this bundle creates or edits that
file for you; an unapproved run simply cannot proceed.

## 2. Fetch (the only step that touches the network)

```bash
python -m zebra.cli fetch
```

Downloads SciFact via the `datasets` library and the BiomedBERT tokenizer + weights via
`transformers` (~5 MB + ~420 MB). Computes a SHA-256 of every file fetched and writes
`data-manifest.json` at the bundle root. Prints exactly what it downloaded and the total bytes.
If a `data-manifest.json` already exists and its recorded hashes disagree with what's on disk now,
`fetch` refuses to silently overwrite it (pass `--force` only after you've actually understood why
they differ). Flags: `--data-only`, `--model-only`, `--force`.

You can also run `python fetch_assets.py` directly — `cli.py fetch` is a thin wrapper around it.

## 3. Preflight

```bash
python -m zebra.cli preflight
```

No network. Prints a JSON report covering: Python/platform info, device selection (MPS vs CPU,
with the *reason*, since MPS can silently fall back), config validity, the label-blind
evidence-selection signature check, the licence-approval gate, and data-manifest presence/hash
verification if `fetch` has already run. Exits 2 if either fail-closed gate fails.

Run this again any time you're unsure of the bundle's state — it's cheap and safe.

## 4. Smoke test

```bash
python -m zebra.cli smoke
```

A tiny run against the fixtures in `tests/fixtures/` — a couple of optimizer steps, proving the
training loop's wiring (batching, tokenization, gradient accumulation, the optimizer step) without
requiring the real dataset. If cached BiomedBERT weights/tokenizer are available offline (i.e.
`fetch` already ran), it uses them; otherwise it falls back to a small random-weight model and a
fully local toy tokenizer, and says so explicitly in its JSON output (`used_real_cached_weights`).
Either way this does **not** trigger a network call.

## 5. Train

```bash
python -m zebra.cli train
```

The real training job, fails closed if either gate fails. Loads `assets/scifact_entailment/train.jsonl`
(from `fetch`), builds the label-blind evidence-selected dataset (`zebra.data`), fine-tunes
BiomedBERT with the preregistered recipe (see `src/zebra/config.py`'s `ZebraConfig`: lr 2e-5,
weight decay 0.01, effective batch 32 via gradient accumulation from a physical batch of 8, 10%
linear warmup, grad clip 1.0, 5 epochs, seed 42).

Writes `outputs/model/` (the fine-tuned weights + tokenizer) and
`outputs/train-artifact.json`, which records: device actually used (and why — MPS can silently
fall back to CPU), the precision used and any deviation from the preregistered BF16-on-H100
assumption (this bundle prefers fp32 on Apple Silicon — see `src/zebra/model.py`'s module
docstring), the seed, config hash, data-manifest hash, installed package versions, per-epoch
training loss, and **wall-clock seconds for every phase** (setup, each epoch, saving).

## 6. Evaluate

```bash
python -m zebra.cli evaluate
```

Fails closed the same way. Loads `assets/scifact_entailment/dev.jsonl` and the model saved by
`train`, runs inference, and writes `outputs/eval-artifact.json` (full logits + probabilities per
row) while printing a summary (device, wall-clock) to stdout. Compute metrics from the artifact
using `zebra.metrics` — confusion matrix, per-class precision/recall/F1, macro F1, balanced
accuracy, multiclass Brier, 10-bin equal-mass ECE + reliability-diagram data, component-resampled
bootstrap 95% CIs, abstention coverage/selective error at 0.50/0.60/0.70/0.80, temperature scaling
(fit only on out-of-fold logits), and the majority-class / lexical-overlap baselines. None of this
is plotting — everything comes back as plain numbers.

## Where artifacts land

```
assets/scifact_entailment/    fetched SciFact JSONL (train.jsonl, dev.jsonl)
.cache/                       HF cache for the BiomedBERT tokenizer + weights
data-manifest.json            hashes/sizes/licences of everything fetch downloaded
licence-approval.json         the human-provided approval (you create this — never fabricated)
outputs/model/                the fine-tuned model + tokenizer, after `train`
outputs/train-artifact.json   device, seed, config hash, data-manifest hash, package versions,
                               per-epoch loss, wall-clock per phase
outputs/eval-artifact.json    logits, probabilities, labels, device, wall-clock
outputs/smoke/                the smoke test's tiny model + artifact (safe to delete any time)
```

## Expected wall-clock

**These are estimates, not yet measured on real hardware** — treat the numbers below as a budget,
not a promise, until the first real run reports its own `wallclock_seconds`:

- Setup (`setup-macos.sh` + `fetch`): 15–25 minutes, almost entirely network wait
- `train`: ~4 minutes if MPS is used, ~15 minutes if it falls back to CPU (919 rows × 5 epochs)
- `evaluate`: 2–5 minutes

`train-artifact.json` and `eval-artifact.json` record the real, measured wall-clock for every
phase of the run that actually happened — treat those numbers, once you have them, as authoritative
over anything in this README.

## Cleanup

```bash
rm -rf .venv assets .cache outputs data-manifest.json
```

or delete the whole folder — nothing outside it is touched. See `OWNER-NOTE.md` for the full
disk/memory/network accounting to hand to the machine's owner.

## Troubleshooting

**No Python 3.10.** `setup-macos.sh` stops and tells you rather than installing anything itself.
Install it (`brew install python@3.10`, or via `pyenv`/`conda`) and re-run the script.

**MPS unavailable / falls back to CPU.** `select_device()` runs a real smoke matmul, not just a
flag check, so if it reports CPU, that's a genuine finding (unsupported macOS version, no Apple
GPU, or MPS silently failed) — training still works on CPU, just slower (see wall-clock above).
The device actually used is always recorded in the run's artifact.

**Hash mismatch.** `preflight`/`train`/`evaluate` exit 2 with the specific file(s) and old/new
hash prefixes. This means something under `assets/` or `.cache/` changed since `fetch` last wrote
`data-manifest.json` — re-run `python -m zebra.cli fetch` (or `--force` only after you understand
why it changed) rather than proceeding on data you can no longer verify.

**Fold-support failure.** `zebra.splits.assert_min_class_support` raises
`InsufficientFoldSupportError` if some fold/class combination has too few rows once folds are
locked to whole claim/abstract components (`zebra.splits` never splits a shared abstract across
folds — see that module's docstring). With ~1,259 rows over 3 classes this is a real, measured
risk, not a bug: if it happens, lower `n_folds` or `min_per_class_per_fold` in `ZebraConfig`
deliberately (and record why), rather than silently working around it.

**Something else looks wrong.** `Ctrl-C` stops it; there is no cleanup step to remember and
nothing keeps running in the background. Any partial output is safe to delete (see Cleanup above).
