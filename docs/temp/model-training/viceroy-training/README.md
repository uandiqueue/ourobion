# Viceroy Causal-Language-Risk v0 — training bundle

## What this is

A bounded research pilot: fine-tuning a small open-source language model (BiomedBERT, 110M
parameters) on the **Yu, Li & Wang causal-language corpus** (3,061 PubMed conclusion sentences) to
classify how strong a paper's causal wording is — `no_relationship`, `direct_causal`,
`conditional_causal`, or `correlational`.

**This is non-serving.** Nothing this bundle produces feeds any production system, routing
decision, or score. A single seed, one frozen grouped split, no independent audit set — the result
is preliminary by construction. **A documented no-go is a valid, expected outcome of running
this**, not a failure of the bundle.

This model was rescoped after review: it detects **which causal language an author used**, which is
not the same question as what a claim's evidence *licenses*. It must never populate
`EdgeVerification.claimKindCheck` and is never evidence validation — see `CONTEXT.md`.

Everything this bundle needs or produces lives **inside this one folder**. See `OWNER-NOTE.md` for
a short, honest account of what this does to the machine (disk, memory, network, compute time) —
hand that to whoever owns the machine before running anything.

## Read these before drawing any conclusion

This folder is self-contained, which also means it arrives **without the project context** that
explains what the numbers mean. Three documents supply it:

| Document | Read it when |
|---|---|
| **[`CONTEXT.md`](./CONTEXT.md)** | **Before running.** What the model is for, the rescope, the four classes, the non-serving boundary, and the preregistration rule — *do not tune the recipe* |
| **[`LEAKAGE.md`](./LEAKAGE.md)** | **Before quoting any number.** What leakage this bundle controls, what it provably cannot, and why the published 0.88 anchor is not comparable |
| **[`INTERPRETING-RESULTS.md`](./INTERPRETING-RESULTS.md)** | **Before concluding anything.** How to tell a genuine result from a bug, the outcome thresholds, and what this run cannot tell you |

The single most useful heuristic: **suspicion should scale with how good the number looks.** The
published row-level anchor is 0.88 macro-F1; a *group-safe* number should land below it. A
group-safe macro F1 at or above 0.88 is far more likely to be a leakage or split bug than success.

Note also that **`eligible-for-shadow-review` is unreachable in this run by construction** — it
requires an independently labelled, dual-reviewed audit set that does not exist. The realistic
outcomes are `research-complete` or `no-go`.

## 0. One-time setup

```bash
bash setup-macos.sh
```

Creates a self-contained Python 3.10 virtualenv at `.venv` inside this folder and installs the
pinned dependencies from `requirements-macos.txt` (~130 MB download, ~550 MB installed). Verifies
MPS (Apple GPU) availability with a real matmul, not just the availability flag. Refuses to install
Python itself; if no Python 3.10 is present it stops and tells you (see Troubleshooting).

After it finishes:

```bash
source .venv/bin/activate
```

Do this once per terminal session before any of the commands below.

## 1. Licence approval (a human must do this — stricter than Zebra's)

```bash
cp licence-approval.example.json licence-approval.json
```

Then **actually read the licence terms** (URLs are in the file) and fill it in truthfully.

The corpus repository is **GPL-3.0**. Whether copyleft on a *data* repository propagates to model
weights trained on it is legally unsettled, so `"status": "approved"` alone is **not enough**: the
file must also carry a `gpl3_determination` object answering four questions in writing, with
`permits_intended_use: true`. Every gated subcommand exits 2 until it does. An unavailable,
contradictory, or negative determination **blocks this model** — that is the designed behaviour,
not an obstacle to route around. Nothing in this bundle creates or edits that file for you.

## 2. Fetch (the only step that touches the network)

```bash
python -m viceroy.cli fetch
```

Downloads the corpus CSV and the repository `LICENSE` from a **pinned commit** (`7ca243a0…`), plus
the BiomedBERT tokenizer + weights (~420 MB). The corpus is 414 KB; its SHA-256 is checked against
a value verified at authoring time, and a mismatch aborts rather than proceeding — a pinned
commit's bytes should never change. Writes `data-manifest.json` with hashes, sizes, the pinned
commit, and licences. Flags: `--data-only`, `--model-only`, `--force`.

The `LICENSE` is fetched deliberately, so the exact GPL-3.0 text at the pinned commit is reviewable
offline and hashable into the manifest.

## 3. Preflight

```bash
python -m viceroy.cli preflight
```

No network. Prints a JSON report covering Python/platform info, device selection (MPS vs CPU, with
the *reason*), config validity, the **scope-boundary check** (that `CONTRACT_MAP` still never emits
`mechanistic` and still abstains on `no_relationship`), the licence gate including the GPL-3.0
determination, and data-manifest hash verification if `fetch` has run. Exits 2 if any gate fails.

## 4. Splits — inspect the folds before spending compute

```bash
python -m viceroy.cli splits
```

**This subcommand has no counterpart in the Zebra bundle, and exists because of what went wrong
there.** It builds the grouped folds, runs every leakage check, writes
`outputs/split-artifact.json`, and prints the audit — **without training anything**.

The number to read is `leakage_audit.n_crossing_folds`: near-duplicate pairs below the grouping
threshold that still ended up in different folds. **It will not be zero** (45 on the real corpus),
and that is the honest residual, not a bug. `n_above_threshold_crossing` must be 0 — anything else
is a bug in fold assignment.

## 5. Smoke test

```bash
python -m viceroy.cli smoke
```

A tiny run against `tests/fixtures/` — a couple of optimizer steps, proving the training loop's
wiring (batching, tokenization, gradient accumulation, the class-weighted loss, the optimizer
step). If cached BiomedBERT weights/tokenizer are available offline it uses them; otherwise it
falls back to a small random-weight model and a fully local toy tokenizer, and says so explicitly
(`used_real_cached_weights`). Either way this does **not** trigger a network call.

## 6. Train

```bash
python -m viceroy.cli train --fold 0
```

The real training job; fails closed if any gate fails. Trains on every fold except the held-out
one, using the preregistered recipe (`src/viceroy/config.py`: lr 2e-5, weight decay 0.01,
effective batch 16 via gradient accumulation from a physical batch of 8, 10% linear warmup, grad
clip 1.0, 5 epochs, seed 42, class-weighted loss).

Writes `outputs/model/` and `outputs/train-artifact.json`, recording: device actually used (and
why), the precision used and any deviation from the preregistered BF16-on-H100 assumption, seed,
config hash, data-manifest hash, **split hash**, the class weights actually applied, package
versions, per-epoch loss, and **wall-clock seconds for every phase**.

The split hash is there because the split is a result of *this bundle's own code*, not an inherited
given: two runs with the same data manifest but different split hashes are not comparable, and that
must be visible from the artifact alone.

## 7. Evaluate

```bash
python -m viceroy.cli evaluate --fold 0
```

Fails closed the same way. Scores the saved model on the held-out fold and writes
`outputs/eval-artifact.json` (full logits + probabilities + **group ids** per row). Compute metrics
from the artifact using `viceroy.metrics` — confusion matrix, per-class precision/recall/F1, macro
F1, balanced accuracy, the **directional causal↔correlational report**, multiclass Brier, 10-bin
equal-mass ECE + reliability data, group-resampled bootstrap 95% CIs, abstention coverage/selective
error, temperature scaling (out-of-fold logits only), and the majority-class and causal-cue-lexicon
baselines. None of this is plotting — everything comes back as plain numbers.

Group ids are in the artifact so the bootstrap resamples by group; a row-level bootstrap would
understate variance.

## Where artifacts land

```
assets/causal_language_use/   fetched corpus CSV + the repository LICENSE
.cache/                       HF cache for the BiomedBERT tokenizer + weights
data-manifest.json            hashes/sizes/licences/pinned commit of everything fetch downloaded
licence-approval.json         the human-provided approval (you create this — never fabricated)
outputs/split-artifact.json   folds, group structure, and the full leakage audit
outputs/model/                the fine-tuned model + tokenizer, after `train`
outputs/train-artifact.json   device, seed, config/manifest/split hashes, class weights,
                               per-epoch loss, wall-clock per phase
outputs/eval-artifact.json    logits, probabilities, labels, group ids, device, wall-clock
outputs/smoke/                the smoke test's tiny model + artifact (safe to delete any time)
```

## Expected wall-clock

**Estimates, not yet measured on real hardware** — treat as a budget, not a promise, until the
first real run reports its own `wallclock_seconds`:

- Setup (`setup-macos.sh` + `fetch`): 10–20 minutes, almost entirely network wait
- `splits`: about 1 second (measured on the real corpus, CPU, no ML stack needed)
- `train`: ~10 minutes if MPS is used, ~35 minutes if it falls back to CPU (2,447 rows × 5 epochs)
- `evaluate`: 1–3 minutes

This corpus is ~2.7× the size of Zebra's, and the sequences are shorter (256 vs 384 tokens), so
expect roughly 2–3× Zebra's training time. `train-artifact.json` records the real measured
wall-clock for every phase — treat those numbers, once you have them, as authoritative over
anything here.

## Tests

```bash
PYTHONPATH=src python3 -m unittest discover -s tests -t .
```

160 tests, no network, no ML stack required (2 skip without torch). The leakage tests in
`tests/test_splits.py` are the ones to read first — including
`TestResidualAuditIsHonest`, which deliberately does *not* assert the residual is zero, because a
similarity threshold cannot deliver that.

## Cleanup

```bash
rm -rf .venv assets .cache outputs data-manifest.json
```

or delete the whole folder — nothing outside it is touched. See `OWNER-NOTE.md` for the full
disk/memory/network accounting.

## Troubleshooting

**No Python 3.10.** `setup-macos.sh` stops and tells you rather than installing anything itself.
Install it (`brew install python@3.10`, or via `pyenv`/`conda`) and re-run.

**Licence gate exits 2 with "gpl3_determination is incomplete".** Working as designed — all four
questions need written answers and `permits_intended_use: true`. If the reviewer cannot resolve
the GPL-3.0 question, this model is **blocked**; that is a valid completion state.

**MPS unavailable / falls back to CPU.** `select_device()` runs a real smoke matmul, not just a
flag check, so if it reports CPU that is a genuine finding. Training still works on CPU, just
slower. The device actually used is always recorded in the run's artifact.

**Corpus hash mismatch on fetch.** Aborts by design: the pinned commit's bytes should never
change. Investigate before using `--force`.

**`GroupPolicyError` mentioning pmid.** You set `group_policy="pmid"` but the corpus has no PMID
column. This is a fail-closed refusal to silently degrade to row-level splitting. Use
`group_policy="surrogate"` and read `LEAKAGE.md` for what that does and does not guarantee.

**`InsufficientFoldSupportError`.** Unlike the Zebra bundle this should be rare — the rarest class
has 213 rows over 5 folds (~42/fold) against a minimum of 20, and folds are balanced by class, not
just by size. If it fires, group structure has distorted the split; read the emitted fold × class
table rather than lowering the minimum.

**Something else looks wrong.** `Ctrl-C` stops it; there is no cleanup step to remember and
nothing keeps running in the background. Any partial output is safe to delete.
