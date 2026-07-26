---
title: Run-2 independent adversarial sign-off audit and Run-3 scope lock
summary: Cross-platform Codex audit of the Run-2 sign-off package, including architecture/security/privacy/raw-truth, UX/accessibility, scientific semantics, model readiness, GitHub check evidence, graph freshness, register reconciliation, and a seven-unit half-sized Run-3 tranche.
type: session
scope: shared
status: canonical
updated: 2026-07-26
---

# Run-2 independent adversarial sign-off audit and Run-3 scope lock

Issue: [#137](https://github.com/uandiqueue/ourobion/issues/137)
Branch/worktree: `docs/run2-adversarial-audit` in `C:\project\ourobion-audit-137`
Task claim: `run2-adversarial-signoff-audit` / `codex` / `agentjwork`

## Attempted

- Followed session-start convention: context briefing, latest Run-2 session logs, doc routing,
  issue/task claim, isolated worktree, and current commit/branch verification.
- Read the Run-2 README/sign-off cockpit, unit ledger, pending register, next-build backlog, architecture,
  product, nao/brain/UI designs, shared decisions, relevant migrations/source/tests, and U12 screenshots.
- Delegated three independent read-only passes: graph freshness, architecture/security/privacy/data
  integrity, and UX/science/custom-model readiness. Re-checked material findings directly in source.
- Queried GitHub PR #123–#136 check rollups and CI configuration; reviewed exact Run-2 diff size.
- Checked current Supabase RBAC/RLS, W3C/Flutter accessibility, Cochrane evidence-certainty, SciFact,
  SciFact-Open, SciFact licence, and HealthVer primary sources.
- Ran offline typechecks/tests for brain-ingest, llm-router, edge-loader, rules, engine-stats, and nao.
  No Anthropic/OpenAI request was made (audit spend: 0 SGD).
- Refreshed graphify's deterministic AST/Markdown projection through Run-2 HEAD, then completed the
  user-requested full host-model semantic pass with no paid API/key/network use. Final semantic
  validation is recorded below.

## Changed

- Added [`docs/temp/run2/adversarial-audit-2026-07-26.md`](../temp/run2/adversarial-audit-2026-07-26.md)
  with a conditional sign-off verdict, evidence matrix, P0–P2 findings, model advice, and Run-3 order.
- Updated [`docs/temp/run2/README.md`](../temp/run2/README.md) to surface the independent verdict without
  changing Jayden's pending per-unit sign-offs.
- Reconciled [`docs/temp/run2/pending-build-register.md`](../temp/run2/pending-build-register.md): 54
  unique canonical row definitions, no duplicate definitions, explicit ownership boundaries, existing
  rows expanded where root causes overlapped, and new security/data/science/cost/platform rows only
  where distinct.
- Promoted O24–O30 into [`docs/temp/run2/next-build-optimizations.md`](../temp/run2/next-build-optimizations.md)
  as a locked seven-unit tranche with an 85-file / 8,650-added-line cumulative ceiling.
- Added no production code, migration, memory/ADR record, model artifact, dataset, or repo-local skill.
- Updated `AGENTS.md` so a Sol-Max primary is reserved for orchestration/analysis/evaluation and
  delegates bounded search, routine implementation, extraction, and test execution to appropriately
  chosen lower-cost model/effort tiers, with primary validation and narrow documented exceptions.

## Decided

- Do **not** sign the present Run-2 tip. Authorize Run-3 U0/O24 as the closure unit; after exact-tip CI,
  an explicit internal-demo-only acceptance statement, and B8 second review/scoped waiver, accept Run 2
  only as an isolated simulated/fixture-backed engineering demo and continue U1–U6.
- Production, privacy/security, accessibility, scientific-validation, and independent-verification
  sign-offs remain withheld.
- Run 3 is hard-capped at seven units (half Run 2's fourteen) and approximately half its file/addition
  surface. It is remediation-first: CI; RBAC/privacy; raw-truth/pipeline safety; scientific provenance;
  client language/accessibility; live retrieval/attestation; one NLI training/evaluation pilot.
- NLI Shadow v0 has no serving influence in Run 3. Training remains outside this Python-free repo;
  HealthVer is excluded until a licence is documented; active model routing is a later decision.
- A new audit skill would currently duplicate changing policy across AGENTS/session/report/register/
  backlog surfaces. Reconsider extraction only after a second audit demonstrates a stable reusable core.
- Sol-Max orchestration is now durable repo policy: choose subagent model/effort per bounded task,
  minimise total token/latency cost, and retain final verification at the primary.

## Left

- Every U0–U13 sign-off remains pending for Jayden; this audit does not sign on the human's behalf.
- Execute O24 and attach exact cumulative SHA/check URLs before accepting Run 2.
- Execute or explicitly waive the B8 shared-contract second-review requirement.
- Keep nao undeployed to ordinary accounts and keep the simulated loader away from real/valued data
  until O25/O26 pass.
- O1–O8, O21–O23, O2/MPR, B-COST1, production hosting, visual reskinning, metric expansion, active
  support-model integration, and the full autonomous research loop remain outside Run 3.

## Blockers

- Independent Flutter analysis could not be completed: the isolated worktree lacked untracked package
  metadata; the dependency-resolved original checkout's Flutter process then stalled and was terminated.
- Deno is unavailable locally. This is why O24's exact-tip CI proof is a sign-off gate.
- Run-3 O29 live work remains provider-budget bounded (Anthropic ≤2 SGD, OpenAI ≤20 SGD); O30 remains
  gated by GMI access and dataset-licence review.

## Graphify semantic completion

- Completed the one-time semantic bootstrap at Run-2 HEAD `b55ce292`: 882/882 AST hashes and 882/882
  semantic hashes; zero pending/deleted AST or semantic inputs; `built_at_commit == HEAD`.
- Run-2 baseline projection: 6,872 nodes, 8,905 links, 83 hyperedges, and 716 communities, with zero
  schema or pair-edge issues under the initial validator. The cache covers all 446 assigned semantic
  sources: 311 documents/paper sources and 135/135 visually inspected images.
- Five SVGs that the image viewer could not render were rasterized directly from the SVG sources with
  the repo's local Sharp/libvips and then visually inspected. No filename-counterpart inference was
  accepted. HTML was intentionally skipped because the graph exceeds Graphify's 5,000-node safety cap.
- Exact-node explanation and source navigation passed representative Run-2 checks. Broad natural-
  language ranking still overweights generic AST nodes; B-PL18 records that distinct quality gap.
- After the first audit commit was folded at `e6a2676`, an incremental six-document refresh reached
  884/884 AST + semantic hashes, zero pending/deleted inputs, and exact-source QA for the verdict,
  B-PL18/F12, and Sol-Max policy. A stricter endpoint audit found 11 retained hyperedges referencing 31
  removed/deduplicated node IDs; the derived merge removed five stale changed-source and six
  pre-existing dangling groups, leaving zero pair-edge or hyperedge endpoint issues. B-PL17 now owns
  that integrity gate as well as freshness.
- The first semantic workers inherited the root session model/effort; later workers used
  `gpt-5.6-terra` at medium effort to bound latency. Host-subagent token telemetry was unavailable, so
  Graphify's zero token fields are not interpreted as zero compute. Paid API/network spend remained
  0 SGD. The evidence-correction commit is followed by one final changed-document semantic restamp;
  final HEAD/hash evidence is recorded on issue #137.

memory: none
