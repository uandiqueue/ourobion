---
title: Model-training code build — decisions
summary: The decision register for the custom-model training-code build (MT0-MT5) — D1-D4 from the orchestrator prompt plus every further decision made while building the shared substrate (linter/type-checker choice, CI layout, package naming, module boundaries).
type: plan
scope: model-training
status: draft
updated: 2026-07-27
---

# Model-training code build — decisions

One decision per entry: choice / alternatives rejected / rationale. D1-D4 are the orchestrator's
decisions (implemented, not re-litigated, per the orchestrator prompt PART 0/3); everything after D4
was decided while building MT0.

## D1 — Workspace

**Choice:** a single top-level `model-training/` directory holding all Python code for all five
models, plus the shared substrate.

**Alternatives rejected:**
- Python inside `apps/`, `supabase/`, `shared/`, or `tools/` — explicitly forbidden (D1 as handed
  down); would blur the Dart/TypeScript product boundary and make `tools/`'s "Node-stdlib enforcement"
  framing false.
- Five separate top-level directories (one per model) — rejected because the shared substrate
  (config, manifests, splits, metrics, release, CLI contract) would either duplicate five times or
  need its own sixth directory anyway; one workspace with a `models/` subpackage is simpler and
  matches "the infrastructure PR must be merged before the five model PRs are cut" (PART 3).
- Continuing to require a separate `ourobion-model-lab` repository — explicitly superseded by
  Jayden; rejected because it fragments the review/PR/context-sync machinery this repo already has
  across two repositories for no isolation benefit once `model-training/` is itself isolated.

**Rationale:** one workspace, one `pyproject.toml`, one dependency posture, one CI section, one place
for the next five build units to add a `models/<name>/` package.

## D2 — Dependency posture

**Choice:** the core substrate (`ourobion_model_lab` top-level package and its direct submodules —
`config`, `environment`, `logging_utils`, `manifests`, `data_guard`, `splits`, `metrics`, `release`,
`storage`, `gmi_preflight`, `job`, `cli`, `self_check`) imports the Python standard library only.
Heavy ML dependencies (`torch`, `transformers`, `datasets`, `scikit-learn`, `onnxruntime`, `onnx`,
`numpy`, `scipy`) are declared as optional extras (`ml` in `pyproject.toml`) and may only be imported
lazily, inside model-specific code under `ourobion_model_lab.models.*` (MT1-MT5's job). Tests use the
stdlib `unittest` module, not pytest.

**Alternatives rejected:**
- pytest — rejected per the brief: it is itself a dependency, which would mean "zero installs" is
  never literally true. `unittest` ships with every Python 3.10+ interpreter.
- Declaring `numpy` (or similar) as a core (non-optional) dependency "because everyone has it
  anyway" — rejected: it would silently make the D2 zero-install claim false. `metrics.py` instead
  ships pure-Python reference implementations of accuracy/macro-F1/ECE, which both prove the offline
  test suite works with nothing installed and give MT1-MT5 an always-available fallback to check a
  faster `sklearn`-based implementation against.

**Rationale:** this is what makes the PART 4 "scripts work" acceptance bar real rather than
aspirational — the offline test suite must pass with nothing installed, on a clean checkout, and it
does (152/152 after the 2026-07-27 remediation pass; 81/81 before it — see `code-build-log.md`).

## D3 — Python version

**Choice:** `requires-python = ">=3.10"` in `pyproject.toml`; CI's `model-training-core` and
`model-training-lint-type` jobs pin Python **3.10** exactly, matching the documented GMI runtime
(`gmicloud-jupyterlab` template: CUDA 12.4, Python 3.10.12 — see
[`zebra-nli-shadow-v0-training-plan.md`](./zebra-nli-shadow-v0-training-plan.md) §3.2). Local dev may
run a newer 3.x (this session used 3.13); code under `src/`/`tests/` must not use syntax newer than
3.10.

**Alternatives rejected:**
- Pinning `==3.10.*` even for local dev — rejected: the documented local toolchain
  (`scripts/biotope-env.ps1`) provisions Python 3.13, and forcing a second local Python install for
  this one workspace is disproportionate friction for a code-build with no real training happening
  yet.
- Targeting 3.11+ syntax (e.g. `tomllib`, `except*`) — rejected outright by D3; `ruff`'s
  `target-version = "py310"` (in `pyproject.toml`) makes this a checked constraint, not just a
  convention.

**Rationale:** the GMI runtime is the eventual execution target; CI should catch a 3.10 incompatibility
before an execution run ever provisions a real GPU container against it.

## D4 — Lockfile honesty

**Choice:** exact `==` pins for every declared dependency in `pyproject.toml`'s `ml`/`dev` extras,
mirrored verbatim in `model-training/constraints.txt`. No hash-pinned lockfile
(`pip install --require-hashes`) is fabricated; its absence is recorded as an open item in
`human-gates.md` instead.

**Alternatives rejected:**
- Fabricating plausible-looking `--hash=` lines — explicitly rejected by the brief ("a fabricated
  hash is worse than admitting the gap") and by this build: a hash that was never actually computed
  from a resolved wheel is worse than no hash, because it would look verified when it is not.
  `constraints.txt` says so in its header comment.
- Using `uv.lock` as the earlier Zebra plan assumed — unavailable in this environment (no `uv`, no
  network-enabled resolve); the plan's own directory-shape example has been updated to reflect this
  (see the Zebra plan §4 edit in this build).

**Rationale:** an honest "pending a network-enabled resolve" gate is auditable and fixable later; a
fake lockfile would look done and actually be a silent supply-chain risk.

## Further decisions made while building MT0

### Linter / formatter / type-checker

**Choice:** `ruff` (lint + format, one tool, one config block) and `mypy`, both exact-pinned in the
`dev` extra (`ruff==0.6.9`, `mypy==1.11.2`).

**Alternatives rejected:** `black` + `flake8` + `isort` as three separate tools — rejected in favor of
`ruff`, which replaces all three with one faster tool and one `[tool.ruff]` config block; `pyright` in
place of `mypy` — no strong reason to prefer it here, and `mypy` is the more commonly expected default
for a `pyproject.toml`-driven Python package.

### CI layout

**Choice:** three separate jobs — `model-training-core` (zero installs; stdlib `unittest` + CLI
dry-run "config validation" + CLI smoke "offline smoke"), `model-training-lint-type` (installs only
the `dev` extra), and `model-training-ml` (`if: false` placeholder for MT1-MT5's future ml-dependent
tests) — rather than one combined job.

**Alternatives rejected:** one job doing lint+type+test together — rejected because it would blur the
D2 zero-install claim (the job installing `ruff`/`mypy` would *also* be the job proving zero-install
tests pass, so the claim "these tests need nothing installed" would no longer be independently
checkable from the CI structure itself). Enabling the `ml` job unconditionally — rejected because
there is nothing ml-dependent to test yet (no model has landed) and GitHub-hosted runners installing
`torch` on every push for a job with no assertions would be pure cost; `if: false` documents the
placeholder without paying for it.

### Package naming

**Choice:** the importable package is `ourobion_model_lab` (distribution name `ourobion-model-lab` in
`pyproject.toml`), living at `model-training/src/ourobion_model_lab/`.

**Rationale:** the orchestrator prompt's own task list names this exact path
(`model-training/src/ourobion_model_lab/__init__.py`); keeping the distribution name recognizable
(`ourobion-model-lab`) while the actual directory is `model-training/` avoids the earlier plans'
implication that a same-named separate repository still exists — it doesn't; it's this package, in
this repository.

### Module boundaries inside the substrate

**Choice:** one small module per concern (`config`, `environment`, `manifests`, `data_guard`,
`splits`, `metrics`, `release`, `storage`, `gmi_preflight`, `logging_utils`), a `job.py` defining the
`JobSpec` abstract contract + registry, a thin `cli.py` dispatcher, and one `self_check.py` reference
implementation (registered as `self-check`, explicitly not one of the five real models) that proves
the whole CLI contract end-to-end before MT1-MT5 exist.

**Alternatives rejected:** one large `core.py` — rejected for testability and for MT1-MT5's ability to
import only what they need; a fake/mock "model 0" using one of the five real codenames — rejected
because it would risk being mistaken for real coverage of that model later; `self-check` is
deliberately not a codename from the roster.

## Decisions made in the 2026-07-27 remediation pass

These answer judgement calls raised by the adversarial evaluation of MT0 (see
[`code-build-log.md`](./code-build-log.md) for the findings themselves).

### D5 — The licence/data gate is central and sealed, not per-model

**Choice:** `JobSpec.execute(command)` is the only entry point `cli.py` uses for every model-scoped
subcommand. It runs `run_gates()` (licence approval + data-manifest verification) *before* dispatching
to `preflight()`/`dry_run()`/`smoke()`/`train()`/`evaluate()`/`build_release()`. A model opts in by
setting the class attributes `requires_licence_approval` / `requires_dataset_manifest`, and
`JobSpec.__init_subclass__` raises `TypeError` if a subclass tries to define `execute`, `run_gates`,
`_gate_licence` or `_gate_data_manifest`.

**Alternatives rejected:**
- *A `require_licence_approval()` call at the top of each model's own methods* — this is what the
  original code implied and it is exactly what failed: the call existed in one test fixture's
  `preflight()` and nowhere else, so five of six subcommands ran with a pending licence. Any design
  where "the model remembers to call the gate" is one forgetful subclass away from being off.
- *A decorator on each contract method* — still opt-in per method, and a subclass that overrides the
  method without the decorator silently loses the gate.
- *Enforcing in `cli.py` only* — would leave `JobSpec` usable, ungated, by any future non-CLI caller
  (a notebook, an orchestrator script). Enforcing in `JobSpec` and having `cli.py` route through it
  means both callers get the gate.

**Rationale:** the acceptance-bar claim is "fails closed when an approval or an expected hash is
absent". That claim can only be true if skipping the gate requires deliberate, blocked effort rather
than an omission.

### D6 — A supplied-but-unapproved artifact fails closed even when not required

**Choice:** if a config supplies `licence_approval_path` or `dataset_manifest_path`, the gate checks it
regardless of whether the model declares that it needs one.

**Alternatives rejected:** *ignore it unless the model requires it* — rejected because a config that
names a pending approval and then proceeds reads to a reviewer as "the gate ran and passed", which is
strictly worse than having no gate at all. The cost is that a model which does not need a licence
cannot carry a "for reference" pointer to a pending one; the fix there is to leave the field null.

### D7 — Secret detection scans values, and how it trades off false positives

**Choice:** `release.py` scans every string value in the (nested) manifest body, not just keys, in four
layers: absolute/local path patterns; credential-marker regexes (`sk_live_`, `ghp_`, `AKIA`, JWT, PEM
private-key header, `Bearer …`, `service_role`, …); a comparison against the *values* of environment
variables whose **names** are secret-shaped (`*KEY*`, `*SECRET*`, `*TOKEN*`, …); and an entropy
heuristic. The error names the field and the reason and never echoes the offending value.

**The entropy heuristic is measured over the longest unbroken alphanumeric *run*, not the whole
string.** Scoring the whole string was tried first and false-positived on real reproducibility
metadata: `"Windows-11-10.0.26200-SP0"` scores 3.64 bits/char and a typical Linux `platform.platform()`
string scores higher still, which would have failed a legitimate release build (and CI) outright.
Randomness in real key material is contiguous, so the longest-run measure separates
`Zk3PmQ9xLv2RtY8wAe4UbN6cJd0FgHs1` (one 32-char run) from `Linux-6.5.0-1025-azure-x86_64-with-glibc2.39`
(longest run: 6).

**Accepted false negatives, stated plainly:**
- a purely hexadecimal run is exempt, because git SHAs and SHA-256 digests are exactly that shape — so a
  hex-only secret would pass the entropy layer (the key-name, marker and env-value layers remain);
- the env-value comparison only sees the environment of the machine building the release;
- a short (<24-character) secret with no recognizable prefix will not be caught by entropy alone.

**Accepted false positives:** any value legitimately containing a home-directory path or a 24+ character
mixed-case-alphanumeric run is rejected. Release manifests are meant to be portable and publishable, so
this is the correct direction to be wrong in.

### D8 — Reproducibility metadata in the release manifest is a *deterministic subset*

**Choice:** `build_release_manifest(..., environment=…)` embeds only
`EnvironmentSnapshot.to_release_fields()`: short interpreter version, platform string, and presence
flags. `captured_at` is dropped (wall-clock time would break "identical inputs → identical bytes") and
`git_commit` is dropped (the manifest already has a top-level field for it). Presence is a sorted list
of `{name, present}` records rather than a name-keyed mapping, because a key named `GMI_API_KEY` would
trip the manifest's own forbidden-key guard — carrying the name as a value keeps that guard strict
instead of carving an exemption into it.

### D9 — Decode config/manifest JSON as `utf-8-sig`

**Choice:** `config.py` and `manifests.py` read with `encoding="utf-8-sig"`.

**Rationale:** this repo's own PowerShell tooling writes UTF-8 *with* a BOM by default (see
`windows-toolchain-gotchas`). Decoded as plain `utf-8`, the BOM survives as U+FEFF and `json.loads`
fails with an opaque "Expecting value: line 1 column 1" — a confusing failure for a correct file.
`utf-8-sig` reads BOM-less files identically, so there is no downside. Note this is a *decode*-side
change only; nothing in this workspace writes a BOM.

### D10 — Guard matching is hardened; the forbidden roster is unchanged

**Choice:** `data_guard.py` now matches case-insensitively, normalizes path separators, matches path
*segments* (with `-`/`_`/`.`/`+` suffixes, so `apps/biotope-export` is caught and a trailing slash is not
required), recurses into nested structures, checks values as well as keys, and normalizes
camelCase/`schema.qualified` identifiers before a token-boundary match. `FORBIDDEN_COLUMN_NAMES` and the
set of forbidden locations are **not** widened.

**Deliberate non-change:** whitespace is *not* normalized to `_` when matching schema names, so the
prose "the user id was never collected" is not read as the `user_id` column, while `user-id`, `User_Id`,
`userId` and `userID` all are. Token boundaries mean `superuser_identity` is not a hit.

### D11 — Metric input validation raises a `ModelLabError` that is also a `ValueError`

**Choice:** `MetricInputError(ModelLabError, ValueError)`. `expected_calibration_error` rejects
confidences outside [0, 1] with it.

**Rationale:** an out-of-range confidence used to either index the bins backwards (a negative value
silently produced a plausible-looking number from the wrong bucket) or raise a raw `IndexError`, which
`cli.py` does not catch — a stack trace instead of a fail-closed exit. Passing logits where
probabilities are expected is the single most likely MT1-MT5 mistake. Multiple inheritance keeps existing
`except ValueError` callers working while making the CLI's `ModelLabError` handler catch it.
