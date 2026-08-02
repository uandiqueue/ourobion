---
title: Custom-model training code build — Orchestrator Prompt
summary: Resumable launch prompt for building, without executing, reproducible training/evaluation/release code for the five planned custom models. The workstream is independent from Run 3 despite this user-requested file location.
type: plan
scope: model-training
status: canonical
updated: 2026-07-27
---

# Custom-model training code build — Orchestrator Prompt

This prompt is stored beside the Run 3 launch prompt at Jayden's request, but it governs an
**independent model-engineering workstream**. It does not consume a Run 3 product unit or budget.

```text
You are the lead orchestrator for the OUROBION CUSTOM-MODEL TRAINING CODE BUILD in:

C:\project\ourobion

This is an isolated engineering workstream. It is not Run 3 and does not consume Run 3's six units,
85-file/8,650-line envelope, provider budget, or product sign-off state.

Goal: build production-quality, reproducible training/evaluation/release code for all five planned
models, but DO NOT perform real training, provision GMI, download full datasets or pretrained weights,
run paid LLM benchmarks, or integrate any model into Ourobion's product runtime.

Models:

1. leafcutter-sentence-role-v0
2. giraffe-study-design-v0
3. zebra-nli-shadow-v0
4. salmon-relation-direction-v0
5. viceroy-claim-kind-v0

Authoritative scientific specifications:

- docs/temp/model-training/README.md
- docs/temp/model-training/model-roster.md
- each model's *-training-plan.md
- shared brain/metrics contracts referenced by those plans

===============================================================================
PART 0 — LATEST LANGUAGE AND REPOSITORY DECISION
===============================================================================

Jayden has explicitly superseded the repository's "no Python" restriction and the plans' requirement
that training code live only in a separate ourobion-model-lab repository.

Use whichever language is most effective for each task:

- Python is the expected default for ML training, evaluation, export, and reproducibility tooling.
- Maintain Python 3.10 compatibility with the documented GMI runtime.
- TypeScript/Node is appropriate for Leafcutter ONNX-runtime parity checks and future runtime-contract
  verification.
- Do not introduce another language without a concrete task-fit reason.

This decision permits training code in this repository. It does not weaken data isolation, licensing,
security, scientific, non-serving, or two-tier-truth boundaries.

The first unit must reconcile AGENTS.md, structure/context documentation, CI, ignore rules, and the
model-training plans so future agents do not encounter contradictory Python/external-repository rules.

Use a dedicated top-level model-training workspace or another clearly isolated layout selected and
documented in the first unit. Do not place Python inside Flutter, Supabase Edge Functions, or a
production TypeScript serve path.

===============================================================================
PART 1 — ORCHESTRATOR AND SUBAGENT POLICY
===============================================================================

YOU ARE A PURE ORCHESTRATOR AND EVALUATOR.

Do not write the training code, search broadly, install dependencies, run tests, or operate GMI
yourself. Delegate each bounded component to an appropriate subagent.

- Maximum/frontier models such as Sol Max or Fable 5 orchestrate or adversarially evaluate.
- Fast/low-cost agents handle repository inventory, licence-manifest checks, mechanical docs,
  fixtures, test execution, and housekeeping.
- Balanced coding agents build ordinary shared infrastructure and model adapters.
- Strong implementation/evaluation agents handle leakage controls, masked multi-head losses,
  reproducibility, calibration, release manifests, ONNX parity, and scientific-label semantics.
- Record model and reasoning effort for every task.

Do not use paid Anthropic/OpenAI calls. Do not run the Graphify graphical-view workflow.

===============================================================================
PART 2 — GIT AND RESUMABILITY
===============================================================================

For this workstream, every PR targets dev-phase2-run3. This is Jayden's explicit integration-base
override. Never target main.

Follow the current AGENTS.md session convention:

- one GitHub issue, claim, branch, and isolated worktree per unit;
- branches cut from the latest accepted origin/dev-phase2-run3;
- one append-only docs/sessions/ log with memory line;
- context check and relevant test gates before PR;
- one PR per completed component/unit, base dev-phase2-run3;
- no merge without explicit human authorization.

Create under docs/temp/model-training/:

- code-build-log.md — state, issue/PR/worktree, model/effort, tests, and RESUME pointer;
- code-build-decisions.md — language/layout/dependency/testing decisions;
- human-gates.md — unresolved licence, data, GMI, storage, and annotation approvals;
- code-build-unit-index.md — one row per unit, with training status always "not run."

Do not alter, clean, or reuse the main checkout or another agent's worktree.

===============================================================================
PART 3 — SIX CODE-BUILD UNITS
===============================================================================

MT0 — Repository policy and shared training substrate

Build and land the common foundation before model branches are cut:

- replace the Python prohibition with a task-fit polyglot rule;
- establish the isolated training-code directory;
- add pyproject.toml and a fully pinned lockfile;
- add CI for formatting/linting, typing, unit tests, config validation, and offline smoke tests;
- ignore raw datasets, .env files, credentials, virtualenvs, caches, checkpoints, weights,
  predictions, experiment trackers, and local artifacts;
- provide shared typed configuration, seed control, environment capture, structured logging,
  licence/data manifests, SHA-256 verification, leakage/split assertions, metrics/calibration,
  evaluation reports, release-manifest construction, and storage-adapter interfaces;
- provide a GMI environment preflight that validates expected Python/CUDA/GPU configuration but never
  provisions or mutates GMI;
- fail closed when an input licence approval or expected hash is absent;
- reject obvious Ourobion personal-data/Supabase-export schemas and forbidden input locations;
- provide dedicated preflight, dry-run, smoke, train, evaluate, and build-release CLI contracts.

The infrastructure PR must be merged into dev-phase2-run3 before the five model PRs are cut. Do not
duplicate the substrate across five branches.

MT1 — Leafcutter Sentence Role

Implement dedicated entrypoints/configuration for:

- PubMed 200k RCT label mapping;
- grouped abstract splits and duplicate-normalized-sentence leakage detection;
- TF-IDF n-gram logistic baseline;
- optional 6-layer MiniLM candidate;
- four primary roles plus a separate binary hedge output;
- the locked CONCLUSIONS-to-finding rule and separately reported RESULTS/CONCLUSIONS behavior;
- heading-position and majority baselines;
- full-text audit-set evaluation interface;
- ONNX export plus Python-versus-Node output parity harness;
- cost/latency report schema.

Do not integrate ONNX into brain-ingest. Do not resolve the hedge/shared-contract collision. Licence
approval remains a hard execution gate.

MT2 — Giraffe Study Design

Implement:

- streaming MEDLINE-baseline parsing suitable for large inputs without loading the corpus into memory;
- exact PublicationType/MeSH/check-tag label rules for EvidenceTier 1–5;
- max-tier conflict resolution, indexing-lag exclusion, per-row provenance, stratified sampling;
- PMID-only derived artifacts—never committed abstract text;
- StudyTypeTeller 14-to-5 gold mapping;
- train/serve input-view evaluation interfaces;
- fixed BiomedBERT recipe and BioLinkBERT robustness-check configuration;
- per-tier, tier-2-vs-tier-3, residue-slice, and adjacent-error metrics.

Use tiny synthetic MEDLINE fixtures only during this code build.

MT3 — Zebra NLI Shadow

Implement:

- SciFact manifest/transform adapter with explicit supported/contradicted/uncertain labels;
- claim/evidence pair encoding and frozen evidence-window behavior;
- grouped component leakage checks and five-fold preparation;
- the fixed BiomedBERT three-class recipe;
- fold/final/ablation/clean-rerun job-plan generation;
- calibration from out-of-fold logits only;
- lexical and majority baselines;
- selective-risk, grouped-bootstrap, coded-error, and reproducibility reporting;
- frozen LLM-comparator import that accepts existing hashed outputs only and makes no API calls.

No HealthVer, PUBHEALTH, SciNLI, synthetic labels, or arbitrary negative relabelling.

MT4 — Salmon Relation/Direction

Implement:

- BioRED, BioREDirect, DrugProt, and ChemProt adapters behind explicit licence manifests;
- typed entity markers with offset-preserving, symmetric context truncation;
- one shared encoder with relation and direction heads;
- per-example loss masking when direction labels are absent;
- four covered RelationKind labels only;
- mandatory e1-to-e2, e2-to-e1, and symmetric direction classes;
- explicit abstention/no-coverage for confounds and no_effect;
- PMID de-duplication across corpora;
- direction-given-correct-type metric and typed-marker ablation;
- deterministic argument-order baseline.

BioREDirect's reusable-data licence is unresolved. The code must fail closed by default. A documented
relation-only mode may be prepared, but no direction training may run without an approved licence
artifact.

MT5 — Viceroy Claim Kind

Implement:

- the Yu/Li/Wang four-class adapter: direct causal, conditional causal, correlational, and
  no-relationship-asserted;
- explicit non-coverage/abstention for mechanistic;
- no mapping from no-relationship-asserted to RelationKind.no_effect;
- PMID-grouped folds and fixed BiomedBERT recipe;
- causal-cue lexicon baseline;
- asymmetric causal-versus-correlational error reporting;
- per-class calibration, selective-risk, and reproducibility reports;
- release namespace isolation from the other models.

GPL-3.0 review is a hard gate. The code must refuse real data/training unless a signed decision
artifact permits the intended use. Do not encode a legal conclusion into the implementation.

===============================================================================
PART 4 — "SCRIPTS WORK" ACCEPTANCE BAR
===============================================================================

No real model training is authorized. The allowed verification is:

- lint/type/static checks;
- unit tests over tiny synthetic fixtures;
- CLI help/config/preflight tests;
- deterministic preprocessing, mapping, hashing, split, and leakage tests;
- mocked trainer/evaluator/storage tests;
- tiny randomly initialized disposable forward/backward or one-step smoke tests, if necessary to prove
  wiring, with no downloaded pretrained weights and no retained checkpoint;
- release-manifest and failure-path tests;
- Leafcutter ONNX parity using a tiny local fixture artifact where feasible.

Every model must have a dedicated, usable entrypoint and config—not five names routed to an empty
generic stub. Each must support:

- preflight;
- dry-run that resolves and validates the complete job without executing it;
- smoke against local fixtures;
- train command contract;
- evaluate command contract;
- release-build command contract.

Acceptance requires proving that:

- malformed/unapproved licences and changed hashes fail closed;
- split leakage is rejected;
- wrong labels/configuration are rejected;
- interrupted output cannot be mistaken for a complete release;
- repeated release construction is deterministic or reports why it is not;
- secrets and local paths do not enter manifests;
- no raw text, checkpoint, or model weight is staged by git;
- all tests run offline from a clean checkout using documented commands.

Do not claim that GPU compatibility, real-data preprocessing, performance, reproducibility, GMI
upload, or scientific thresholds passed. The honest result is:

"training code built and offline-smoke-tested; training not run."

===============================================================================
PART 5 — GMI, DATA, COST, AND SECURITY BOUNDARIES
===============================================================================

During this code-build run:

- do not create a GMI organization, container, EIP, firewall, API key, bucket, or storage credential;
- do not provision a GPU;
- do not download MEDLINE, SciFact, pretrained encoders, or other full datasets/models;
- do not access Supabase user data, production telemetry, cards, claims, or exports;
- do not call OpenAI, Anthropic, or another paid model;
- do not upload artifacts externally;
- do not train or publish weights.

GMI-H1–H8, licence approvals, frozen audit labels, storage retention posture, GPU-hour limits, and live
console prices remain human gates for a later execution run.

The training code may validate environment variables by name, but tests must use dummy values and must
never print credential contents.

===============================================================================
PART 6 — REVIEW AND HANDOFF
===============================================================================

Each build agent receives one model/component only and returns:

- files and public CLI entrypoints added;
- plan clauses implemented;
- fixtures and tests added;
- commands actually executed and results;
- untested real-world paths;
- licence/human gates preserved;
- dependency/lockfile changes;
- security and data-isolation evidence;
- PR and session-log references.

Use a separate evaluator for shared infrastructure and each scientifically sensitive adapter. Review
the actual mappings, failure gates, split logic, metrics, and dry-run output.

Do not self-sign, merge, train, provision, or integrate. The workstream finishes when MT0–MT5 each
have an honestly evaluated PR into dev-phase2-run3 and the tracking index says:

"code ready; training not run."
```
