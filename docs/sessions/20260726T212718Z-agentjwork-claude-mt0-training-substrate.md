---
title: MT0 — repository polyglot policy and shared custom-model training substrate
summary: Replaced the blanket no-Python rule with a task-fit polyglot rule scoped to an isolated model-training/ workspace, and built the shared training/evaluation/release substrate for the five planned models. No training was run. An independent evaluator found three high-severity defects that falsified acceptance-bar claims; all were fixed and re-verified.
type: session
scope: model-training
status: canonical
updated: 2026-07-26
---

# MT0 — repository polyglot policy and shared custom-model training substrate

Issue: [#142](https://github.com/uandiqueue/ourobion/issues/142)
Branch/worktree: `feat/model-training/mt0-substrate` in `C:\project\ourobion-mt0`
Task claim: `model-training-code-build-MT0` / `claude` / `agentjwork`
Governing prompt: [`../temp/run3/model-training-code-build-orchestrator-prompt.md`](../temp/run3/model-training-code-build-orchestrator-prompt.md)

**This is not a Run-3 unit.** It does not consume Run 3's units, file/line envelope, provider budget, or
sign-off state.

## Attempted

- Orchestrated MT0 per the run protocol: orchestrator sequences and evaluates, subagents write.
  Three dispatches, serialized, one writer at a time — scaffold/policy (Sonnet), then an independent
  adversarial evaluator, then a remediation pass. Model and effort recorded per dispatch in
  `code-build-log.md`.
- Assessed the machine first. Two findings shaped every later decision: there is **no Python 3.10 and
  no `uv`** locally (only 3.13 and 3.14), and installing torch/transformers would be a multi-GB
  download that collides with the offline acceptance bar.
- Verified every build-agent claim independently rather than accepting reports — which is how the
  three high-severity defects below were caught before a PR existed.

## Changed

- **Policy.** `AGENTS.md` §1 and §4 now carry a task-fit polyglot rule: Python is permitted **only**
  inside the isolated top-level `model-training/` workspace; every other surface stays Dart or
  TypeScript. Reconciled the same claim in `docs/shared/structure-context.md`,
  `docs/nao/brain-ingestion-design.md`, `docs/biotope/rules-engine-design.md`, the model-training
  `README.md`/`model-roster.md`, and all five training plans' `Code location` rows. Stated explicitly
  at each site that data-isolation, licensing, security, scientific, non-serving and two-tier-truth
  boundaries are unchanged.
- **Workspace.** New `model-training/` — `pyproject.toml`, `constraints.txt`, `README.md`,
  `src/ourobion_model_lab/` (config, environment, manifests, data_guard, splits, metrics, release,
  storage, gmi_preflight, logging_utils, job, cli, errors, self_check) plus placeholder packages for
  the five models, and a `tests/` suite of **152 stdlib `unittest` tests**.
- **CI.** Three jobs in `.github/workflows/ci.yml`: a zero-install core job, a lint/type job, and an
  ML job explicitly disabled with `if: false` and named as not-yet-enabled. Added `dev-phase2-run3`
  to the trigger branches — without it these jobs would never have run for this workstream.
- **Ignore rules.** Anchored `.gitignore` groups for datasets, credentials, virtualenvs, tool caches,
  checkpoints/weights, predictions and tracker output, each verified with `git check-ignore -v`.
- **Tracking docs** under `docs/temp/model-training/`: `code-build-log.md` (the resume point),
  `code-build-decisions.md` (D1–D11), `human-gates.md`, `code-build-unit-index.md`.

## Decided

- **D1 workspace** — one top-level `model-training/`, never inside `apps/`, `supabase/`, `shared/` or
  `tools/`.
- **D2 stdlib-only core** — ML dependencies are optional extras imported lazily; tests use `unittest`,
  not pytest. This is what makes "runs offline from a clean checkout" a fact rather than an aspiration:
  the whole suite runs with **zero installed packages**.
- **D3 Python ≥3.10**, CI pinned to 3.10 to match the GMI runtime. 3.10 can only be a CI guarantee
  here, since no 3.10 interpreter exists on this machine.
- **D4 lockfile honesty** — exact `==` pins mirrored in `constraints.txt`; the hash-pinned lock is
  recorded as a human gate rather than fabricated. Inventing hashes would be worse than the gap.
- D5–D11 (recorded by the remediation pass): centrally sealed licence gate, supplied-but-unapproved
  licences fail closed even for models that do not require one, the secret-detection heuristic and its
  explicit blind spots, a deterministic secret-free environment subset in the release manifest,
  `utf-8-sig` decoding, hardened guard matching, and `MetricInputError`.

## Verified

- `python -m unittest discover -s tests -t .` → **`Ran 152 tests` / `OK`**, with zero installed packages.
- Independently re-ran the exact scenario that was broken: `self-check` with a **pending** licence now
  exits **2** on all six subcommands (`preflight`, `dry-run`, `smoke`, `train`, `evaluate`,
  `build-release`). Before remediation, five of those six exited **0**.
- An **approved** licence still exits 0 on all four executing subcommands — the gate is not
  over-blocking.
- Stdlib-only invariant re-checked by enumerating every import in `src/`; no third-party imports.
- `git check-ignore -v` confirms `.pth`, `.h5`, `.jsonl` and the rest are ignored, while
  `constraints.txt`, `pyproject.toml` and fixtures stay trackable.
- `node tools/context_sync.mjs --check` passes; `git diff --check` clean.

## Left

- **Three high-severity defects were found by the independent evaluator and fixed.** They are recorded
  because they say something about the process, not just the code: (1) the licence gate was enforced
  nowhere in `src/` — `require_licence_approval` had zero call sites, so only `preflight` gated, and
  only for a test fixture; (2) "changed hashes fail closed" was unproven — `dataset_manifest_path` was
  parsed and never read, with no data-manifest type at all; (3) release manifests accepted secrets and
  absolute local paths, because the guard inspected keys only and the body's keys are a fixed literal
  set. All three contradicted claims already written in the README. Independent evaluation is what
  caught them.
- **`ruff` and `mypy` have never executed** — neither is installed and there is no network. The E501
  fixes rest on a character-count scan. First real signal is the first CI run.
- **No CI run has ever happened** for these jobs. The trigger fix means it now can.
- Secret detection is heuristic with documented blind spots (pure-hex values are exempt so git SHAs
  pass; short unmarked secrets rely on the marker/env layers).
- The gate proves an approval artifact exists and says approved, and that pinned digests match. It
  cannot verify the approval actually covers the dataset used — that stays a human review step.
- MT1–MT5 model packages are placeholders. They cannot start until this unit merges.

## Blockers

- **MT0 must merge into `dev-phase2-run3` before MT1–MT5 branches are cut**, and merging is
  human-gated. This unit therefore ends at a PR awaiting Jayden's authorization.
- All execution gates remain open and untouched: GMI-H1–H8, per-model licence approvals, the
  BioREDirect data licence (gates Salmon's direction head), the Yu/Li/Wang GPL-3.0 determination
  (gates Viceroy), frozen human audit labels, storage retention posture, and GPU-hour/cost caps.
- No training was run. No GPU, GMI resource, dataset, pretrained weight, paid model call, or external
  upload was involved at any point. Honest end state: **training code built and offline-smoke-tested;
  training not run.**

memory: none
