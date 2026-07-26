---
title: Zebra model-training separation, documentation audit, and semantic graph view
summary: Archived completed Run 1/2 records, separated zebra-nli-shadow-v0 from the six-unit Run-3 product tranche, audited active documentation freshness, and added a deterministic human-readable projection of the refreshed Graphify graph.
type: session
scope: shared
status: canonical
updated: 2026-07-26
---

# Zebra model-training separation, documentation audit, and semantic graph view

Issue: [#139](https://github.com/uandiqueue/ourobion/issues/139)
Branch/worktree: `docs/zebra-model-training-split` in `C:\project\ourobion-zebra-139`
Task claim: `zebra-model-training-doc-split-audit` / `codex` / `agentjwork`

## Attempted

- Followed the new-session convention: context briefing, current doc map and recent sessions, issue,
  task claim, and isolated worktree. The user explicitly requested a direct fold back into the current
  worktree after commit rather than a PR/worktree hand-off.
- Used Graphify and targeted source/commit inspection to audit current architecture, product scope,
  scientific boundaries, documentation ownership, and the blast radius of moving historical run docs.
- Delegated three independent read-only challenges: scope/link separation, graph-view determinism and
  enforcement, and documentation-freshness claims. Easier bounded reviews used `gpt-5.6-terra` at
  medium effort; routine Graphify semantic chunks used `gpt-5.6-terra` at low effort. The root
  `gpt-5.6-sol` session retained orchestration and adversarial evaluation.
- Ran the Graphify incremental semantic workflow after all content changes: deterministic AST
  extraction in the orchestrator, changed-document semantic extraction through parallel subagents,
  deletion/change pruning, clustering, manifest/hash refresh, endpoint validation, and regeneration of
  the sole tracked human view. No paid provider API key was used.
- Checked active Markdown links, Run-3 unit separation, generated graph parity/uniqueness, renderer
  determinism/malformed-input behavior, context/index integrity, and whitespace cleanliness. No app,
  backend, hosted database, GMI, or model-training operation was in scope.

## Changed

- Moved completed Run 1 and Run 2 records to `docs/archive/runs/`, added archive banners, and removed
  them from active agent context. Moved the superseded backend test brief to `docs/archive/briefs/`.
- Renamed and separated the standalone model experiment as `zebra-nli-shadow-v0` under
  `docs/temp/model-training/`. Its plan retains the SciFact-only licence gate, leakage controls,
  preregistered GMI jobs, human plus LLM evaluation, reproducibility/cost/security evidence, and hard
  non-serving boundary; training code remains outside this Python-free repository.
- Reconciled the Run-3 cockpit, optimization authority, and pending register to exactly six product
  units O24–O29. Model training is not a Run-3 unit or a spare product slot.
- Added `docs/temp/documentation-freshness-audit-2026-07-26.md`. It distinguishes stable intent and
  decision layers from stale implementation-status owners, corrects bounded false-current claims, and
  registers B-PL20 for canonical-doc reconciliation plus B-PL21 for the distinct duplicated
  `PaperRecord` shared-contract debt.
- Added `.graphifyignore`, one generated `docs/graph/semantic-graph.md`, a deterministic Node renderer
  with tests, build-wrapper integration, and local/CI parity plus uniqueness checks. The view is a
  projection of machine-local `graphify-out/graph.json`, never a replacement for curated architecture.
- Updated the Graphify memory and front-door docs to distinguish AST coverage, semantic freshness, and
  view parity; repaired all active missing Markdown targets found by the audit.

## Decided

- Run 1/2 are immutable historical evidence and never active build authorities. Links may flow from an
  archive banner to active truth, but active planning must remain self-contained and never build from
  archive bodies.
- `zebra-nli-shadow-v0` is an isolated research workstream. It cannot influence serving or close the
  broader B-BR4 product capability without a later reviewed integration decision.
- Run 3 remains six product units—half-Run-2 is a ceiling, not a requirement to fill a seventh slot.
- The generated semantic view is exactly one tracked Markdown file. Archive inputs and the generated
  view itself are excluded from Graphify to avoid historical pollution and recursive graph growth.
- A matching human view proves projection parity only. It does not prove semantic freshness when a
  local graph is absent; B-PL17 retains the stronger commit/session freshness enforcement gap.
- `PaperRecord` promotion is engineering/contract work governed by the shared two-reviewer rule, not a
  documentation edit hidden inside B-PL20.

## Left

- B-PL20: reconcile the remaining status-bearing canonical docs against the accepted integration SHA
  before unattended Run-3 implementation. B-PL21: promote `PaperRecord` through `shared/brain/` with
  parity fixtures and two reviewers. Both remain outside the locked six-unit build.
- B-PL17/B-PL18: enforce semantic graph freshness at session/commit boundaries and improve broad-query
  ranking. The new generator deliberately does not claim either gap is closed.
- The Zebra plan remains planning only. Human GMI organization/entitlement, live SKU/price, credits,
  SSH/storage, private model-lab repository, licence approval, audit labels, and cost caps are still
  required before training.
- Run 3 has not started; O24–O29 retain their documented human/external gates.

## Blockers

- None for this documentation/graph projection session.
- Hosted Supabase mutation, live LLM calls, GMI provisioning, GPU training, and model artifacts were
  neither required nor performed.

memory: modified 0008
