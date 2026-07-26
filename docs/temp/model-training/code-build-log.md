---
title: Model-training code build — resumable log
summary: The append-only-in-spirit resume point for the custom-model training-code build (MT0-MT5). Records unit status, issue/branch/worktree, the agent model/effort used per dispatch, commands actually run with their results, and an explicit RESUME pointer for the next agent.
type: plan
scope: model-training
status: draft
updated: 2026-07-27
---

# Model-training code build — resumable log

Companion to [`code-build-decisions.md`](./code-build-decisions.md) (why),
[`human-gates.md`](./human-gates.md) (what's blocked), and
[`code-build-unit-index.md`](./code-build-unit-index.md) (per-unit status). This file is the
chronological "what actually happened" record for the code-build workstream defined in
[`../run3/model-training-code-build-orchestrator-prompt.md`](../run3/model-training-code-build-orchestrator-prompt.md).

## RESUME: MT0 has been adversarially evaluated (2026-07-27) and the confirmed defects are fixed in the
## same worktree; the suite is 152 tests green offline. Still not PR'd. Next step is opening the MT0 PR
## into `dev-phase2-run3` for human review — do not cut an MT1-MT5 branch before that PR is merged
## (PART 3 of the orchestrator prompt: "The infrastructure PR must be merged... before the five model
## PRs are cut"). `ruff`/`mypy` still have not run anywhere: see "Still not done" at the end.

## Unit MT0 — Repository policy and shared training substrate

- **Status:** in progress → code/tests/docs complete, offline-verified; PR not yet opened.
- **Issue:** #142.
- **Branch:** `feat/model-training/mt0-substrate`.
- **Worktree:** `C:\project\ourobion-mt0` (isolated from the main checkout `C:\project\ourobion`, per
  session-isolation convention).
- **Agent/effort:** Sonnet 5 (this build session), dispatched directly as the MT0 build agent — no
  further sub-delegation was used for this unit; the work was small enough and tightly coupled
  (reconciling docs + building one cohesive substrate package) to do directly rather than fan out.

### What shipped

1. **Python prohibition reconciliation** — replaced the repo's blanket "no Python" rule and the
   plans' "separate `ourobion-model-lab` repository" requirement with the task-fit polyglot rule in
   `AGENTS.md` §1/§4 (the single source of truth), and fixed every contradicting statement found by
   grepping `no Python|Python-free|ourobion-model-lab` across the repo (excluding
   `docs/archive/**`, `docs/sessions/**`, and accepted ADRs under `docs/shared/decisions/**`, which
   are frozen/immutable — see "Not done" below).
2. **`model-training/` workspace scaffold** — `pyproject.toml` (requires-python>=3.10, exact-pinned
   `ml`/`dev` extras, ruff+mypy config), `constraints.txt` (mirrors the pins), `README.md`, and
   `src/ourobion_model_lab/` (stdlib-only core substrate: config, environment, manifests, data_guard,
   splits, metrics, release, storage, gmi_preflight, job/cli contract, self_check reference job) plus
   five `models/<name>/__init__.py` placeholders for MT1-MT5.
3. **Tests** — `model-training/tests/`, a stdlib `unittest` suite (81 tests) proving: config
   validation, fail-closed licence approval (missing/pending/malformed all fail closed), SHA-256
   verification, split-leakage detection, pure-stdlib metrics/calibration, deterministic atomic
   release-manifest construction (crash-mid-write leaves no partial destination), a local storage
   adapter, environment capture with no secret values ever logged, GMI preflight (informational vs
   `--strict-python`), and the full CLI (`preflight`/`dry-run`/`smoke`/`train`/`evaluate`/
   `build-release`/`list-models`) wired end-to-end against a `self-check` reference job plus a
   `gated-example` test-only fixture proving the licence fail-closed path.
4. **`.gitignore`** — added an anchored `/model-training/**/...` section (tool caches, raw
   datasets, checkpoints/weights, predictions, experiment trackers) with per-group comments; verified
   with dummy files that every pattern actually ignores what it should (see "Commands run" below).
   Root patterns already caught `__pycache__`/`.venv` etc. non-anchored; the new section adds
   `.mypy_cache`/`.ruff_cache`/`.pytest_cache` and the dataset/weight/prediction/tracker groups that
   were missing.
5. **`.graphifyignore`** — mirrored the tool-cache and rebuildable-data additions in the same
   non-anchored style the file already uses (its matcher does not honor anchored/leading-slash
   patterns — see the `.open-next/` note in `docs/shared/structure-context.md`).
6. **CI** — added three jobs to `.github/workflows/ci.yml`: `model-training-core` (Python 3.10, zero
   installs, runs the `unittest` suite + CLI dry-run "config validation" + CLI smoke "offline smoke"),
   `model-training-lint-type` (installs only the `dev` extra; ruff format/lint + mypy), and
   `model-training-ml` (`if: false` placeholder for MT1-MT5's ml-extra-dependent tests).
7. **Tracking docs** — this file, `code-build-decisions.md`, `human-gates.md`,
   `code-build-unit-index.md`.

### Commands run and results (verbatim key output)

```text
$ PYTHONPATH=src python -m unittest discover -s tests -v   (from model-training/, Python 3.13 locally)
...
Ran 81 tests in 0.633s
OK
```

```text
$ git check-ignore -v model-training/src/ourobion_model_lab/__pycache__/cli.cpython-313.pyc
.gitignore:22:__pycache__/	model-training/src/ourobion_model_lab/__pycache__/cli.cpython-313.pyc
```

Dummy-file gitignore proof (files created then deleted, never committed): created
`model-training/tmp_check_ignore/{model.onnx,model.safetensors,weights.pt,weights.bin,
data/dataset.csv,checkpoints/ckpt.ckpt}` and `model-training/.{mypy,ruff,pytest}_cache/foo`; every
path returned `IGNORED` from `git check-ignore -q`; `git status --porcelain model-training/` showed
only the top-level `?? model-training/` line throughout (no file inside it ever surfaced as a
separately-trackable path). All dummy files were then removed.

`git add --dry-run model-training/` (39 lines) listed only real source/test/doc files — no
`__pycache__`, no dataset, no weight, no credential.

### Not done / left for the next agent (MT0 PR review, then MT1)

- **No PR opened yet for MT0.** This log, `human-gates.md`, and `code-build-unit-index.md` must be
  reviewed by an evaluator agent per PART 6 of the orchestrator prompt before a PR is opened, and the
  orchestrator/human must authorize the PR into `dev-phase2-run3`.
- **Lint/type-check not run locally.** `ruff`/`mypy` are declared (exact-pinned) in the `dev` extra
  but could not be installed in this sandboxed session (no network for `pip install`). The
  `model-training-lint-type` CI job (GitHub-hosted runners have network) is the first real run of
  format/lint/type-check; treat its first result as unverified until it runs green.
- **`docs/sessions/` entry** — per AGENTS.md §7, this run should also get exactly one
  `docs/sessions/<timestamp>-...-mt0-substrate.md` append-only session log with a `memory:` line
  before a PR is opened; not written in this pass (out of this build agent's explicit task list) —
  the PR-opening agent must add it.
- **Residual "no Python" mentions intentionally left alone (still accurate):** `docs/sessions/**` (append-only
  historical logs — accurate for what was true when written), `docs/archive/**` (frozen, never built
  from), and the accepted ADRs `docs/shared/decisions/0001-citation-extraction.md` and
  `0002-anomaly-definition.md` (immutable once accepted — `context_sync --check` blocks editing an
  accepted decision body; their "no Python" statements are about specific serve-time
  pipelines/subsystems and remain true in that narrow sense). If a future agent wants these fully
  reconciled, the correct move is a superseding decision record, not an edit — see the memory fact
  "Accepted ADRs are immutable — record amendment intent".

## Unit MT0 — remediation pass after adversarial evaluation (2026-07-27)

- **Status:** all confirmed HIGH/MEDIUM/LOW findings fixed in the same worktree
  (`C:\project\ourobion-mt0`, branch `feat/model-training/mt0-substrate`); still no PR.
- **Trigger:** an independent adversarial evaluation of the MT0 build above. Its central finding is
  worth recording bluntly, because the previous entry in this log claimed the opposite:

> The "fails closed" claim in `README.md` and `human-gates.md` was **false**. `require_licence_approval`
> and `verify_hash` existed, were correct, and had **zero call sites in `src/`**. `cli.py` dispatched
> straight to the JobSpec method, so with a *pending* licence, `dry-run`, `smoke`, `train`, `evaluate`
> and `build-release` all exited **0**. Only `preflight` gated, and only for a test-only fixture whose
> own `preflight()` happened to call the function. The 81-test suite passed against this, because the
> fail-closed tests only ever exercised `preflight`.

The previous entry's sentence "fail-closed licence approval (missing/pending/malformed all fail closed)"
was therefore true only of `preflight`, not of the substrate. It is left in place above as the record of
what was believed at the time; this section is the correction.

### What the evaluation found, and what changed

| Sev | Finding | Fix |
|---|---|---|
| HIGH 1 | Licence approval enforced nowhere; 5 of 6 subcommands exited 0 with a pending licence | `JobSpec.execute()` is now the single gated door `cli.py` uses for every subcommand; models declare `requires_licence_approval`; `__init_subclass__` blocks overriding the gate (D5). A *supplied* but unapproved licence now fails closed even for a model that does not require one (D6) |
| HIGH 2 | `dataset_manifest_path` was parsed and never read; no data-manifest type existed; `verify_hash` had no callers | New `DataManifest`/`DataFileEntry` types + `load_data_manifest`/`require_data_manifest` in `manifests.py` (relative path → SHA-256, plus `source`/`licence`/`licence_approval_path` metadata), verified in the same central gate. Changed digest, missing pinned file, malformed or absent-but-required manifest all fail closed |
| HIGH 3 | `_assert_no_forbidden_keys` inspected keys only, and the body's keys are a fixed literal set — a secret or local path pasted into `model_version`/`git_commit`/`config_hash` was accepted and written to disk | `release.py` now scans values too: local-path patterns, credential markers, secret-shaped env-var *values*, and a longest-alphanumeric-run entropy heuristic (D7). Errors name the field and reason, never the value |
| MED | `.gitignore` missed `.pth/.h5/.gguf/.npy/.npz/.msgpack/.tflite` and raw text outside `data|datasets|raw` | Extended the anchored `/model-training/**/…` section; `constraints.txt` and `requirements*.txt` negated back in. Every extension verified with `git check-ignore -v` (below) |
| MED | CI triggers did not include `dev-phase2-run3`, the base these PRs target | Added to both the `push` and `pull_request` branch lists |
| MED | `ruff` E501 at `gmi_preflight.py:91` and `self_check.py:76` | Both rewrapped; a full scan of `src/` + `tests/` now reports **no** line over 100 chars |
| MED | `expected_calibration_error` indexed backwards on a negative confidence and raised a raw `IndexError` above 1.0 | Range-validates and raises `MetricInputError` (D11) |
| MED | `splits.py` docstring promised whitespace normalization; code was `.strip().lower()` | Now `" ".join(text.split()).casefold()`; double space, tab, newline and NBSP variants are all detected |
| MED | `data_guard.py` matched exact lowercase top-level keys and bare path substrings; 8 named bypasses passed | Case-insensitive, separator-normalized, segment-boundary path matching; recursive key *and* value scanning with camelCase/`schema.table` normalization. Roster unchanged (D10) |
| MED | `--strict-python` silently ignored when `--model` was supplied | `gmi_preflight.with_strict_python()` re-evaluates the check on the model path, so both paths agree regardless of what the JobSpec did |
| MED | A UTF-8 BOM (which this repo's PowerShell tooling emits) broke config/manifest loading opaquely | `utf-8-sig` decode in `config.py` and `manifests.py` (D9), with tests |
| LOW | Approved-licence fixture shipped a real personal email | Replaced with `example-approver@example.invalid` |
| LOW | `environment.py`, `logging_utils.py`, `storage.py` had zero call sites | Environment capture is embedded in the release manifest as a deterministic, secret-free subset (D8); `cli.py` emits JSON-line logs to stderr; `self_check.build_release` stores its manifest through `LocalFilesystemStorage` |
| LOW | `assert_disjoint_groups` no-opped on a duplicate split name or a consumed iterator | Materializes iterables and rejects duplicate names / empty contributions |
| — | False-confidence tests: a "changed hash" test that wrote `{not valid json`, a fail-closed class that only tried `preflight`, two `assertIn(code, (0, 1))` assertions, key-only release tests | Rewritten: real changed-hash coverage, every subcommand exercised for every bad-gate variant plus an assertion that the job body was **not reached**, exact exit codes with the one env-dependent input pinned via `mock.patch.dict` |

### Commands run and results (verbatim key output)

```text
$ PYTHONPATH=src python -m unittest discover -s tests -t .   (from model-training/, Python 3.13.13 locally)
Ran 152 tests in 1.284s
OK
(81 before this pass; the new tests are listed in the table above)
```

```text
$ node tools/context_sync.mjs --check                        (from the worktree root)
context_sync --check passed: sessions, memory, decisions, index, and couplings are consistent.
```

End-to-end proof that a **pending** licence now fails closed (temp config pointing at
`tests/fixtures/example_licence_approval_pending.json`; `gated-example` is the test-only fixture job
that declares `requires_licence_approval = True` and enforces nothing itself):

```text
== gated-example: model REQUIRES approval, licence_approval_path -> pending
   preflight      exit=2
   dry-run        exit=2
   smoke          exit=2
   train          exit=2
   evaluate       exit=2
   build-release  exit=2
   artifacts produced: []

== self-check: model does NOT require one, config supplies a pending file
   preflight      exit=2
   dry-run        exit=2
   smoke          exit=2
   train          exit=2
   evaluate       exit=2
   build-release  exit=2
   artifacts produced: []
```

(stderr for each: `error: licence for 'example-fixture' is not approved (status='pending'); failing
closed`. Before this pass, the last five of each block exited **0**.)

`git check-ignore -v` for every extension named in the evaluation:

```text
.gitignore:164:/model-training/**/*.pth      model-training/x.pth
.gitignore:166:/model-training/**/*.h5       model-training/x.h5
.gitignore:168:/model-training/**/*.gguf     model-training/x.gguf
.gitignore:173:/model-training/**/*.npy      model-training/x.npy
.gitignore:174:/model-training/**/*.npz      model-training/x.npz
.gitignore:172:/model-training/**/*.msgpack  model-training/models/x.msgpack
.gitignore:170:/model-training/**/*.tflite   model-training/artifacts/model.tflite
.gitignore:144:/model-training/**/*.jsonl    model-training/train.jsonl
.gitignore:148:/model-training/**/*.txt      model-training/abstracts.txt
.gitignore:146:/model-training/**/*.csv      model-training/corpus.csv
.gitignore:147:/model-training/**/*.tsv      model-training/corpus.tsv
.gitignore:151:/model-training/**/*.gz       model-training/medline.xml.gz
.gitignore:154:!/model-training/constraints.txt   model-training/constraints.txt   (negated: stays tracked)
```

`model-training/README.md`, `pyproject.toml` and `tests/fixtures/example_config.json` were re-checked
and are **not** ignored. `git diff --check` is clean.

Line-length scan (the ruff E501 finding, checked without ruff since it cannot be installed here):

```text
$ Get-ChildItem -Recurse -Include *.py -Path src,tests | ... where line length > 100
(no output)
```

### Still not done — carried forward, unchanged and still true

- **Lint/type-check still never run.** `ruff` and `mypy` are exact-pinned in the `dev` extra but cannot
  be installed in this sandbox (no network). The E501 fix above was verified with a line-length scan,
  **not** with ruff. The `model-training-lint-type` CI job remains the first real run of
  `ruff format --check` / `ruff check` / `mypy src`; treat its first result as unverified. Note the
  format check in particular has never been exercised — `ruff format --check` may still report diffs.
- **No CI run has happened at all** for any of these jobs; the workflow's branch list was only just
  corrected so that it can.
- **No PR opened**, and the `docs/sessions/` entry required by AGENTS.md §7 before a PR is still
  outstanding (the PR-opening agent must add it).
- **D4 hash-pinned lock** is still an open gate; no hashes were fabricated.
- **No training, no GMI provisioning, no dataset or weight download, no paid model call, no network I/O
  in `src/`** — unchanged, and the remediation added none.
