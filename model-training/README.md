# model-training — Ourobion custom-model training/evaluation/release workspace

> **Two models have been trained; none of the five model plugins in *this* workspace has been.** Both
> statements are true at once, and the distinction is the whole point of this banner.
>
> - **Trained, evaluated, published.** **Zebra v1** and **Viceroy v0** were trained on **local Apple
>   Silicon** (`device: mps`, fp32) after the requested GMI GPU container did not arrive. That work ran
>   in two self-contained bundles —
>   [`zebra-training/`](../docs/development/model-training/zebra-training/) and
>   [`viceroy-training/`](../docs/development/model-training/viceroy-training/) — **not** through the
>   `JobSpec` substrate here. Their frozen reports, aggregate metrics and provenance hashes are in
>   [`evidence/publication-results/`](evidence/publication-results/); `predict` (below) scores against
>   those frozen releases offline.
> - **Not trained here.** The five `JobSpec` plugins under `src/ourobion_model_lab/models/` (MT1–MT5)
>   are still `__init__.py` placeholders. No `train` run has ever gone through `JobSpec.execute()`, so
>   for the substrate itself the honest status remains **"training code built and offline-smoke-tested;
>   training not run."** The only registered runnable JobSpec is the `self-check` reference job.
> - **GMI was never provisioned.** No GMI organization, container or GPU was allocated from here, and
>   no paid model API has been called by this workspace.
>
> Neither checkpoint is validated or authorized for product serving: both remain `validated=false`,
> `serving_ready=false`, `public_weights_cleared=false`. Evidence is not serving permission.
>
> Per-model dataset/model licence approvals, the BioREDirect data-licence question, the Yu/Li/Wang
> GPL-3.0 determination, frozen human audit-set labels, storage-retention posture, and GPU-hour/cost
> caps are tracked as **human gates** in
> [`../docs/development/model-training/human-gates.md`](../docs/development/model-training/human-gates.md),
> which is the authority on which remain open. This workspace never resolves any of them itself. What
> "fails closed" means here, concretely:

**The fail-closed gate (what the code actually does).** `JobSpec.execute()` in
[`job.py`](./src/ourobion_model_lab/job.py) is the single entry point `cli.py` uses for **every**
model-scoped subcommand — `preflight`, `dry-run`, `smoke`, `train`, `evaluate`, `build-release` — and it
runs two gates *before* dispatching to any model code:

1. **Licence approval.** A model that sets `requires_licence_approval = True` cannot run unless
   `licence_approval_path` is set and the artifact records `status: "approved"`. Separately, **any**
   config that supplies a `licence_approval_path` has it loaded and checked even if the model does not
   require one — a supplied-but-pending approval fails closed rather than being ignored.
2. **Data manifest.** A model that sets `requires_dataset_manifest = True` cannot run without a loadable
   `dataset_manifest_path`, and every file the manifest pins is SHA-256-verified. A changed digest, a
   missing pinned file, or a malformed manifest stops the job. A supplied manifest is verified even when
   the model does not require one.

A subclass declares those two flags and enforces nothing itself: `JobSpec.__init_subclass__` raises
`TypeError` if a model tries to override `execute()` or the gate methods, so a model cannot opt out by
forgetting (or choosing) to call something. Failure is a `ModelLabError` → CLI exit code **2**, before
any handler body runs and before any artifact is written.

What is *not* gated: `list-models`, and `preflight` with no `--model` (a model-agnostic environment
check that reads no config and touches no data).

## What this is, and what it is not

- A single, isolated, top-level Python workspace (`model-training/`) for ML training/evaluation/export/
  reproducibility tooling — the language and location Jayden approved, superseding the repo's former
  blanket "no Python" rule and the plans' "separate `ourobion-model-lab` repository" requirement. See
  [`AGENTS.md`](../AGENTS.md) §1/§4 and
  [`../docs/development/model-training/code-build-decisions.md`](../docs/development/model-training/code-build-decisions.md)
  (D1).
- **Not** a product-runtime dependency. Nothing here is imported by `apps/`, `supabase/`, `shared/`, or
  `tools/brain-ingest`, and nothing here changes at what any of those serve. Model-training completion
  never authorizes serving, verifier short-circuiting, prediction logging, or a contract/UI change — each
  is a later, separate product decision (see
  [`../docs/development/model-training/README.md`](../docs/development/model-training/README.md)).
- **Not** where GMI is provisioned, where real datasets are downloaded, or where any of the five models
  is actually trained. Real execution is a later, human-gated run against this same code.

## The polyglot rule (task-fit, not blanket)

- **Python** is the expected default here, for ML training, evaluation, export, and reproducibility
  tooling — and only here. It must not appear inside `apps/`, `supabase/`, `shared/`, or `tools/`.
- **TypeScript/Node** is the choice for ONNX-runtime parity checks (Leafcutter) and future
  runtime-contract verification.
- No other language enters without a concrete task-fit reason recorded as a decision.
- This does **not** weaken data-isolation, licensing, security, scientific, non-serving, or
  two-tier-truth boundaries: those are unchanged and are enforced in code (see `data_guard.py`,
  `manifests.py`) as well as in docs.

## Dependency posture (D2) — why the offline test suite needs zero installs

Everything importable as plain `ourobion_model_lab` (the top-level package and every module directly
under it — `config`, `environment`, `manifests`, `data_guard`, `splits`, `metrics`, `release`, `storage`,
`gmi_preflight`, `job`, `cli`, `self_check`) depends on the **Python standard library only**. Heavy ML
dependencies (`torch`, `transformers`, `datasets`, `scikit-learn`, `onnxruntime`, ...) are declared as
**optional extras** in `pyproject.toml` (`ml`, `dev`) and may only be imported **lazily, inside
model-specific code** under `ourobion_model_lab.models.*` (MT1–MT5 fill these in). This is what makes the
"scripts work" offline acceptance bar real: the whole core test suite below runs, and passes, with **zero
installed packages**.

### Running the offline tests (zero installs required)

From `model-training/`, with any Python **3.10** (CI pins this to match the documented GMI runtime —
CUDA 12.4 / Python 3.10.12 — per D3; local dev may run a newer 3.x, but do not write syntax newer than
3.10 anywhere under `src/` or `tests/`):

```sh
# No `pip install` step. This must work in a bare Python interpreter.
PYTHONPATH=src python -m unittest discover -s tests -v
```

On Windows PowerShell:

```powershell
$env:PYTHONPATH = "src"
python -m unittest discover -s tests -v
```

### Lint / format / type-check (needs the `dev` extra)

```sh
pip install -c constraints.txt -e ".[dev]"
ruff format --check .
ruff check .
mypy src
```

### Lockfile honesty (D4)

`uv` is not available in this environment and there is no network-enabled dependency resolve. Every
dependency above is declared with an exact `==` pin, mirrored between `pyproject.toml` and
`constraints.txt`. A hash-pinned lock (`pip install --require-hashes`) is recorded as an **open human
gate** in `human-gates.md` rather than fabricated — a made-up hash would be worse than admitting the gap.

## CLI contract

Every model registers a `ourobion_model_lab.job.JobSpec` under its own `model_name` and gets six
subcommands for free from `ourobion_model_lab.cli`:

```sh
python -m ourobion_model_lab.cli list-models
python -m ourobion_model_lab.cli preflight  [--model NAME --config path.json] [--strict-python]
python -m ourobion_model_lab.cli dry-run    --model NAME --config path.json
python -m ourobion_model_lab.cli smoke      --model NAME --config path.json
python -m ourobion_model_lab.cli train      --model NAME --config path.json
python -m ourobion_model_lab.cli evaluate   --model NAME --config path.json
python -m ourobion_model_lab.cli build-release --model NAME --config path.json
```

- `preflight` with no `--model` runs a model-agnostic environment check only (Python/CUDA-version
  expectation, GMI credential *names* present, GPU tooling observed) — it never provisions or mutates
  anything.
- `dry-run` resolves and validates the complete job without executing it.
- `smoke` runs against tiny local fixtures only — no network, no real data, no downloaded weights.
- `train` / `evaluate` / `build-release` are real command contracts; for models that are not yet
  implemented (all five, as of this build), only the shared substrate's own reference job
  (`self-check`, registered by `ourobion_model_lab/self_check.py`) is available, proving the contract
  end-to-end before MT1–MT5 land.

- `--strict-python` is honoured on **both** preflight paths: with `--model`, the model's own report has
  its `python_version` check re-evaluated in strict mode, so a `JobSpec` that builds its report without
  the flag still cannot report a passing check under `--strict-python`.

### `predict` — offline research inference (issue #266)

```sh
python -m ourobion_model_lab.cli predict --list-releases
python -m ourobion_model_lab.cli predict \
  --model zebra-v1 \
  --input-manifest inference-manifests/zebra-smoke-v1.jsonl \
  [--output predictions.jsonl]
```

`predict` is the one subcommand that does **not** route through
`JobSpec.execute()`: it trains nothing, reads no dataset and needs no
licence-approval artifact. Its fail-closed gates are the pinned release
registry and artifact verification instead.

It loads a frozen release from the private `ourobion-model-artifacts` R2
bucket through a **bucket-scoped, read-only** credential, verifies all six
files against a frozen SHA-256 manifest before importing Torch, scores a
checked-in public manifest, and deletes the model bytes on every exit path.

**This is research-only.** Nothing it produces may reach `RelationshipClaim`,
`EdgeVerification`, `verified_edges`, edge scores/bands, cards, Supabase, nao,
or biotope. Both checkpoints remain `validated=false`, `serving_ready=false`
and `public_weights_cleared=false`.

Credentials come from `model-training/.env` locally (see `.env.example`), or
from the GitHub `model-inference` environment in the manual
`model-inference.yml` workflow. Predictions carry each model's **native**
labels and are never mapped onto a product verdict:

| Model | Native labels |
|---|---|
| `zebra-v1` | `supported`, `contradicted`, `insufficient_evidence` |
| `viceroy-v0` | `no_relationship`, `direct_causal`, `conditional_causal`, `correlational` |

Both label spaces were read from the shipped checkpoints' own `id2label`. Note
that Viceroy v0 has **no `mechanistic` class**, despite issue #266 describing
one; the runner resolves class order by name and fails closed rather than
assuming positional order, which is what surfaced the discrepancy.

Release identity is content-addressed: each `release_id` is the SHA-256 of that
model's `evidence/<model>/local-bundle-sha256sums.txt`, and `releases.py`
re-derives it before any download. Editing a pinned digest changes the manifest
hash, which no longer matches the release id, which is a hard stop.

Release-manifest construction (`release.py`) writes atomically (temp file + `os.replace`) so an
interrupted build can never be mistaken for a complete release, and hashes its own canonicalized body so
repeated builds from identical inputs are deterministic. It refuses to build when either:

- a manifest **key** looks like a secret or local-path field (`api_key`, `secret`, `password`, `token`,
  `service_role_key`, `local_path`); or
- a manifest **value** looks like an absolute local path (Windows drive letters, `/home`/`/Users`/`~`,
  UNC, `$HOME`), a credential token (`sk-…`, `sk_live_…`, `ghp_…`, `AKIA…`, JWTs, PEM private-key
  headers, `Bearer …`, `service_role`, …), the value of a secret-shaped environment variable, or a long
  high-entropy run of key-shaped characters.

Hex digests, semantic versions, UUIDs, slugs, prose and platform strings are deliberately *not* flagged;
the error names the offending field and the reason but never echoes the value. Release manifests also
carry reproducibility metadata from `environment.py` — interpreter version, platform, and which
credential env vars were *present* (names and booleans only, never values, and never `captured_at`,
which would break byte-for-byte determinism).

## Layout

```text
model-training/
  pyproject.toml            # metadata, requires-python>=3.10, pinned optional extras, tool config
  constraints.txt           # mirrors the exact pins above
  README.md                 # this file
  src/ourobion_model_lab/
    __init__.py              # stdlib-only re-export surface; registers the self-check reference job
    errors.py                 # shared fail-closed exception hierarchy
    config.py                 # typed JobConfig + seed control (stdlib random only)
    environment.py             # reproducibility/environment capture (no secret values, ever)
    logging_utils.py            # structured (JSON-line) logging
    manifests.py                # licence-approval loading + SHA-256 verification, fail-closed
    data_guard.py                # rejects Ourobion personal-data/Supabase-export schemas & paths
    splits.py                     # grouped-split / duplicate-text leakage assertions
    metrics.py                     # accuracy/macro-F1/ECE + EvaluationReport (pure stdlib reference)
    release.py                      # deterministic, atomic release-manifest construction
    storage.py                       # StorageAdapter interface + a local-filesystem adapter
    gmi_preflight.py                  # validates expected GMI runtime; never provisions/mutates
    job.py                              # JobSpec contract + registry (preflight/dry-run/smoke/...)
    self_check.py                        # reference JobSpec proving the contract; not a real model
    inference/                            # issue #266 -- offline research inference, research-only
      releases.py                          # pinned, content-addressed release registry
      r2.py                                 # stdlib SigV4 read-only S3/R2 client (GET + LIST only)
      acquire.py                             # fail-closed download + full-manifest verification
      schemas.py                              # strict JSONL row schemas; model-native labels only
      predict.py                               # orchestration; network-free checks run first
      runners/                                  # Torch/Transformers imported INSIDE functions only
    models/
      leafcutter_sentence_role/           # MT1 -- placeholder, see the training plan
      giraffe_study_design/                # MT2 -- placeholder
      zebra_nli_shadow/                     # MT3 -- placeholder
      salmon_relation_direction/             # MT4 -- placeholder
      viceroy_claim_kind/                     # MT5 -- placeholder
  inference-manifests/                         # frozen public JSONL inputs; individually un-ignored
  tests/                                       # stdlib `unittest` suite (zero installs required)
    fixtures/                                    # tiny JSON fixtures only; never a real dataset
  .env.example                                 # the four MODEL_R2_* names; never a filled copy
```

## Where the authoritative specs live

- [`evidence/publication-results/`](evidence/publication-results/) —
  canonical Zebra v1 and Viceroy v0 training/evaluation reports, aggregate results, and provenance
  hashes
- [`../docs/development/model-training/README.md`](../docs/development/model-training/README.md) — workstream overview
- [`../docs/development/model-training/model-roster.md`](../docs/development/model-training/model-roster.md) — what we
  train, what we don't, and why
- `../docs/development/model-training/*-training-plan.md` — one preregistered plan per model
- [`../docs/development/model-training/code-build-decisions.md`](../docs/development/model-training/code-build-decisions.md) —
  D1–D4 and every decision this workspace's shape encodes
- [`../docs/development/model-training/human-gates.md`](../docs/development/model-training/human-gates.md) — every
  unresolved approval gating real execution
- [`../docs/development/model-training/code-build-unit-index.md`](../docs/development/model-training/code-build-unit-index.md) —
  per-unit status; `training status` is always `not run`
