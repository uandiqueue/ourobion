---
title: Documentation freshness audit — 2026-07-26
summary: Evidence-backed audit of active docs and root Markdown after Run 2, distinguishing durable design that remains trustworthy from implementation-status and orientation documents that materially lag the repository.
type: review
scope: repo
status: draft
updated: 2026-07-26
---

# Documentation freshness audit — 2026-07-26

## Verdict

The repository documentation is **not uniformly stale**, but the layer most likely to answer “what is
built now?” is materially stale. Durable product principles, accepted decisions, migrations, shared
contract source, and the current cross-app engine architecture remain useful. Several canonical
roadmap, nao, module-context, structure, and table-overview documents lag one or two long-horizon build
runs and should not be used as the sole orientation source.

**Operational verdict:** the docs are safe for product intent and architectural constraints when the
truth hierarchy is followed; they are **not yet safe for unattended Run-3 implementation-status
orientation**. Before a build agent acts, it must use the [Run-3 cockpit](./run3/README.md), latest
[`docs/sessions/`](../sessions/), migrations/contracts, and relevant source in addition to canonical
design docs. A bounded canonical-doc reconciliation should happen before Run 3 starts, without adding
a seventh product unit to Run 3.

This is a documentation-readiness finding. It does not invalidate the Run-2 implementation or the
six-unit Run-3 product plan.

## Scope and method

The audit covered 73 active Markdown files: 53 under `docs/`, four at repository root, and package/
module READMEs or context files. It deliberately excluded frozen archive records, append-only session
logs as documents-to-correct, and generated UI-asset working files. Evidence came from:

1. the session-start briefing, recent session logs, and commit history;
2. Graphify queries followed by targeted source inspection where broad-query ranking was noisy;
3. current migrations, app routes, tools, shared contracts, and tests compared with status claims;
4. an active Markdown-link resolution scan; and
5. `git log -1` dates for documents carrying current-status or current-roadmap responsibility.

No hosted environment was mutated, no deployment claim was inferred from source alone, and no paid
LLM/API call was made. This was a repository-truth audit, not a new scientific-literature review.

## What remains reliable

| Area | Assessment | Why |
|---|---|---|
| [`project-context.md`](../shared/project-context.md) | reliable enduring intent | One Health scope, non-diagnostic construction, privacy, raw-data principle, and graceful-degradation rules are phase-level constraints rather than a feature ledger |
| Accepted memory and ADRs | reliable decisions, subject to explicit supersession | Numbered records preserve why constraints exist; memory is living with `updated`, while accepted ADR bodies are immutable |
| Supabase migrations | authoritative schema truth | They show the actual tables/views and are reviewable, ordered source rather than prose inventory |
| `shared/` contract source | authoritative boundary truth | Type/schema source wins over prose summaries; two-reviewer constraints still apply |
| [`insight-engine-architecture.md`](../shared/insight-engine-architecture.md) | current architecture reference | Recently reconciled and explicitly authoritative across nao/biotope, provided design targets are not mistaken for hosted deployment proof |
| [`phase2-demo-runbook.md`](../shared/phase2-demo-runbook.md) and recent sessions | current evidence layer | They record exact demonstration and execution evidence near the commits that produced it |
| [`docs/INDEX.md`](../INDEX.md) | reliable routing index only | Generation catches missing/unindexed documents and stale summaries in front matter; it does not prove the body’s implementation claims are true |
| Commit conventions, agent protocol, and development workflow | reliable operating constraints | [`commit-conventions.md`](../shared/commit-conventions.md), [`agent-protocol.md`](../shared/agent-protocol.md), and [`dev-workflow.md`](../shared/dev-workflow.md) remain internally consistent with the enforced session and integration workflow |
| Package-level operational references | reliable in checked scope | `apps/biotope/README.md`, `shared/metrics/README.md`, and `tools/llm-router/README.md` matched the inspected implementation; the demo runbook remains evidence-bounded rather than claiming hosted production readiness |

## Material freshness gaps

### P0 — repair before unattended Run-3 build work

| Document(s) | Evidence of drift | Risk / required correction |
|---|---|---|
| [`next-steps.md`](../shared/next-steps.md) | Last implementation update was 2026-07-16. It still presents the earlier L0–L6 line and a `dev-phase2` fold as the immediate state, predating the Run-2 nao/brain operations surfaces and the locked O24–O29 plan. Three dead links were also present. | Rewrite it from current commits and the Run-3 authorities. Separate “next product build” from human/external gates and independent model training. The three dead links were repaired in this session, but the roadmap body remains stale. |
| [`phase-2-plan.md`](../shared/phase-2-plan.md) | Plan authority last changed 2026-07-15, before most Run-1/Run-2 delivery commits. It mixes enduring targets with time-sensitive sequencing/status. | Preserve enduring phase gates, add an explicit current implementation matrix, and point current execution to the Run-3 cockpit. |
| `apps/biotope/lib/modules/m1_core/m1-context.md` | Last changed 2026-06-30 and says copy constants/tab-shell work is pending although those paths shipped. | Reconcile every started/pending claim against source and tests; retain only real module constraints and open work. |
| `apps/biotope/lib/modules/m2_self_report/m2-context.md` | Last changed 2026-06-30 and says controller/normalizer plus standing-water, symptom, and antibiotic work are not started. The repository contains `logging_controller.dart`, `normaliser.dart`, antibiotic service/course screen, symptom screen, standing-water UI, and tests. | Replace the old build checklist with an implemented/open matrix. This is a high-risk false orientation because agents are explicitly told to read module context. |
| [`nao-app-design.md`](../nao/nao-app-design.md) | Its older phase/build map mixes shipped foundation, desired role controls, and future production proof. In particular, internal passages still imply role-gated operations while current middleware only enforces authentication. | Reconcile the document section by section and mark every capability as shipped, designed, or externally blocked. O25/B-SEC1 remains the implementation authority for role/RLS enforcement. |

### P1 — reconcile in the same documentation-maintenance tranche

| Document(s) | Evidence of drift | Risk / required correction |
|---|---|---|
| [`architecture-context.md`](../biotope/architecture-context.md) | Its database overview is intentionally compact, but it previously pointed readers to prose rather than migrations for the complete schema. | The source-of-truth pointer was corrected in this session: migrations are authoritative and the table is now explicitly an orientation view. A generated schema inventory may still improve discoverability, but incompleteness is no longer presented as truth. |
| [`structure-context.md`](../shared/structure-context.md) | The tree predates several tools, routes, and edge functions. This session added the graph-view entries only; other omissions remain. | Reconcile the authoritative tree with `rg --files`, especially `tools/llm-router`, `tools/edge-loader`, rule/stats tooling, `evaluate-signals`, and `run-pipeline`. |
| `shared/SHARED-CONTEXT.md` | Field-level brain source evolved through EvidencePassage/derivation work, while prose still describes downstream M5b consumption as forthcoming. | Reconcile summaries to source types and clearly mark which consumers are implemented versus designed. |
| [`brain-synthesis-design.md`](../nao/brain-synthesis-design.md) | Guard/enforcement language still describes some schema/registry checks as deferred although coupling guards and edge-loader tests exist. | Add an implementation matrix and link each invariant to its current executable guard. |
| [`brain-ingestion-design.md`](../nao/brain-ingestion-design.md) | Several “not yet contract” and build-plan passages lag the implemented ingestion/synthesis/verification/loader pipeline. | Distinguish pipeline design, shipped local/demo proof, and missing production promotion/attestation. |
| [`biotope-nao-link.md`](../shared/biotope-nao-link.md) | The canonical runtime-seam document incorrectly described nao operations as already role-gated. | The headline claim was corrected here: middleware is authentication-only and O25/B-SEC1 owns role/RLS enforcement. The remaining seam should still be verified end to end during O29. |
| Rules/brain package documentation | [`rules-engine-design.md`](../biotope/rules-engine-design.md), `shared/rules/README.md`, and `shared/brain/README.md` used future-tense language for evaluators, lag behavior, edge schema, and guards that have landed. | The targeted false statements were corrected here. A later owner reconciliation should still map every design invariant to source/tests and retain Dart contract parity as open work. |
| [`hackathon-direction.md`](../shared/hackathon/hackathon-direction.md) | Its pre-build snapshot (“execution starts next”, zero edges) read like current status after Run 2. | The snapshot is now dated and labelled as the pre-build cutoff; execution is explicitly underway. |
| Root `AGENTS.md` / `README.md` and `apps/nao/README.md` | The root front door omitted nao from the repo shape, asserted Cloudflare deployment from source alone, and the nao package README retained a pre-edges route/status summary. | These specific defects were corrected here. Add a concise nao command table in a later reconciliation so the Node toolchain section is operationally complete. |

### P2 — monitor, do not churn without evidence

The UI design system, metrics catalog/design, product context, accepted decisions, and scientific
design rationale are mostly enduring references. They should be reverified at phase transitions or
when the owning contract changes, not rewritten merely because their commit date is old. Age is a
signal; contradiction with truth-tier source is the defect.

## Structural defects found and corrected in this session

- Repaired four active dead links: two in `docs/shared/next-steps.md`, one in
  `docs/shared/insight-slice-demo-runbook.md`, and one obsolete config-decision pointer in
  `tools/llm-router/README.md`.
- Removed completed Run 1/2 records from active `docs/temp/` and placed them under
  `docs/archive/runs/` with 30 required forward-link banners. Active Run-3 debt rows are
  self-contained; archived paths are provenance text, not active execution links.
- Separated `zebra-nli-shadow-v0` into [its own workstream](./model-training/README.md), eliminating the
  misleading Run-3/O30 coupling.
- Corrected the clearest false nao/root status headlines and the AGENTS repo-shape omission.
- Corrected false-current statements in the cross-app seam, rules/brain package documentation, the
  architecture schema pointer, and the time-bounded hackathon snapshot.
- Added `.graphifyignore` so archive material and the generated graph view cannot pollute semantic
  orientation.
- Added the one generated [human-readable semantic graph](../graph/semantic-graph.html) plus a local
  parity/uniqueness gate. This gate detects drift between an available machine graph and its human
  projection; it does not prove semantic freshness. B-PL17 remains the semantic-freshness gap.

## Why existing automation did not catch this

`context_sync --check` is strong at structural integrity: front matter, generated indexes, dangling
links, memory/decision rules, session coverage, and coupling-guard existence. Structural correctness is
not semantic freshness. A canonical document can be indexed, linked, correctly formatted, and still
say “not started” after the code shipped. Likewise, a Graphify AST update proves source coverage, not
that every manifest entry received a semantic pass or that broad-query ranking is relevant.

## Recommended bounded follow-up

Run one bounded reconciliation before Run 3, with no product feature added:

1. Reconcile `next-steps`, `phase-2-plan`, M1/M2 context, nao design, and nao README against the exact
   integration commit.
2. Reconcile the architecture table, structure tree, shared-context brain section, and brain design
   implementation matrices.
3. Run the active-link scan, `context_sync --fix-index`, `context_sync --check`, and targeted contract/
   guard tests.
4. Record a single “verified against commit” value in status-bearing canonical docs, and require every
   long-horizon run closeout to update those owners before its run folder is archived.
5. Extend `context_sync` with an active Markdown-link check and a status-doc freshness warning (for
   example, truth-tier files changed after the document’s recorded verification commit). Keep it a
   warning unless the owning doc explicitly declares itself an implementation ledger.

The prose reconciliation is not sufficient for `PaperRecord`. The type is independently defined in
`tools/brain-ingest/src/types.ts` and `apps/nao/src/lib/types.ts`, while nao consumes the ingestion
manifest. That is cross-boundary implementation debt, not merely stale documentation. B-PL21 records
promotion into `shared/brain/`, parity tests, and the required two-reviewer shared-contract process;
it remains outside the six locked Run-3 units.

Track the documentation work as B-PL20 and the distinct contract debt as B-PL21 in the
[pending-build register](./run3/pending-build-register.md). Both remain outside the six locked Run-3
product units: B-PL20 is documentation/agent-safety work, while B-PL21 is shared-contract engineering.
Moving model training out of Run 3 does not create a spare feature slot for either.
