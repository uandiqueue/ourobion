---
title: Documentation freshness audit — 2026-08-01
summary: Reports stale and mixed-state documentation across shared, nao, biotope, and temp surfaces without mass-rewriting historical or architecture files.
type: audit
scope: repo
status: accepted
updated: 2026-08-01
---

# Documentation freshness audit — 2026-08-01

This sweep reports defects; it does not make historical snapshots silently current. It was initially
performed against `253e0ad6db31bb2a134e47546ddaba84bf284639`, refreshed for Session A's merge at
`dea055c8155c1e9c6851931f4de9816a88d66b2d`, and rerun after #300 at
`abcba95f8386d31c49f62f20f4b623de180e29c0`. Code, executable output, machine artifacts, and current
GitHub state outrank all documents listed here.

## Submission surfaces

| Document | Freshness defect | Disposition |
|---|---|---|
| [`writeup.txt`](../../hackathon/the_launchpad_challenge/submission/writeup.txt) (was `writeup.md` when audited; rebuilt and renamed 2026-08-02) | Mixes older provider roles/costs with current acceptance; calls a held uncertain edge an end-to-end result; says Agnes was unused; describes 12-passage synthesis as current; carries contradictory support-model claims; cites prose/logs for evaluation. | `blocked`; warning updated. Post-#300 synthesis is measured, but rewrite only after #307 reports grounded verification, projection, and cards; exclude model claims pending #277. |
| [`system-connection-map.md`](../../hackathon/the_launchpad_challenge/plan/system-connection-map.md) | 39 migrations / 2 workflows is now 41 / 5; real-verifier, corpus, provider-role, synthesis-result, support-model, and built/planned labels are stale. | `blocked`; warning added. Regenerate labels/counts at final head. |
| [`hackathon-direction.md`](../../hackathon/the_launchpad_challenge/plan/hackathon-direction.md) | Strategy snapshot from 2026-07-26 includes then-current status, 1,200-corpus target, model/pricing assumptions, unbuilt delta/evaluation, old commit counts, and immediate actions. | Keep as strategy history, not current-state or evidence authority. |
| [`hackathon-rules.md`](../../hackathon/the_launchpad_challenge/plan/hackathon-rules.md) | Raw event rules remain a reference, but their presence does not prove implementation, eligibility, or current sponsor/model availability. | Retain; validate externally at final submission time. |

## Brain and insight architecture

| Document | Freshness defect | Disposition |
|---|---|---|
| [`insight-engine-architecture.md`](../../implemented/shared/insight-engine-architecture.md) | Present-tense A2/A3/A4/A4b/A6 prose blurs planned and built components. `METRIC_TERMS` and `StructuredPaper` remain unimplemented as named; #300 instead added a separate paper-scoped whole-text path and optional `mechanism:` quote span. | Add a built/planned overlay in the owning architecture session; submission must not quote it as code evidence. |
| [`brain-synthesis-design.md`](../../implemented/nao/brain-synthesis-design.md) | Says graph persistence/app rendering and guards are deferred even though later migrations/loaders/provenance UI exist; it omits #300's whole-text batch path and #322's fence handling, paper-bound verifier call identity, pathway declaration/demotion, prompt provenance bump, and strengthened blueprint ask; provider assignments are historical. The measured batch also disproves the assumed 3–5-blueprint-per-paper yield, while verifier-side mechanism judgement remains planned. | Refresh after #307 completes the new flow; retain design rationale separately from runtime status. |
| [`brain-ingestion-design.md`](../../implemented/nao/brain-ingestion-design.md) | Describes the cloud pipeline operationally although the workflow has never executed; planned browser capture/build sequence and implemented paths are mixed; old open-items say synthesis/verifier are deferred. | Mark workflow “defined, never run” and recut the implementation matrix. |
| [`brain-support-models-design.md`](../../implemented/nao/brain-support-models-design.md) | “No model trained” / three-model framing conflicts with later repository history and known dataset-assumption defects. | Do not repair inside submission work. Route all model/evaluation truth through #277. |
| [`biotope-nao-link.md`](../../implemented/shared/biotope-nao-link.md) | Calls nao auth the only blocker although role gating later landed; planned gap-ledger/runtime writers are described too broadly as current. | Re-audit the actual runtime seam before reuse. |

## Plans, indexes, and Run 4 temp records

| Document group | Freshness defect | Disposition |
|---|---|---|
| [`next-steps.md`](../next-steps.md) | 2026-07-16 actions include an obsolete direct fold toward `main`, an old verifier-key blocker, and old support-model state. | Do not execute; phase/run branch and current issues govern. |
| [`phase-2-plan.md`](../phase-2-plan.md) | Mixes intended scope with shipped state; intended metric breadth exceeds the 24 active registry entries. | Preserve as plan authority but require current-state qualifiers. |
| `docs/development/run4/README.md`, `continuation-status.md`, `unit-signoff-index.md`, `decisions-signoff.md`, `pending-build-register.md`, `orchestrator-prompt.md` | Old bases, open-PR ledgers, merge states, and blockers are historical after hundreds of later commits. | Treat as point-in-time coordination records, not live GitHub status. Do not mass rewrite. |
| [`provider-e2e-status.md`](./provider-e2e-status.md) | Records the older #190 provider run, not the 2026-08-01 live acceptance. | Keep historical; do not copy its roles/costs into final prose. |
| [`hack-submission-277.md`](./hack-submission-277.md) | Model-heavy draft is gate-blocked and carries the pre-revamp provider/synthesis story. | Never use as final prose until #277 resolves and #307 supplies grounded verified-card evidence. |
| [`documentation-freshness-audit-2026-07-26.md`](../documentation-freshness-audit-2026-07-26.md) | Its “reliable/current” conclusions predate the subsequent implementation wave. | Superseded as a current-state sweep by this report; retain historically. |
| [`docs/INDEX.md`](../../INDEX.md) | Generated summaries can faithfully reproduce stale front-matter language; generation proves index consistency, not factual freshness. | Run `--fix-index`, but still repair source front matter when an owning session updates a doc. |

Memory 0016 remains valid as a bounded historical L6 statement; the defect is downstream prose that
generalizes “no real decorrelated verdict in that slice” into “a real verifier has never run.”

## Required follow-up order

1. Keep the submission and map blocked; synthesis has a measured batch outcome, but the full flow does not.
2. Wait for #307 to complete grounded Agnes verification, projection, and cards, including any
   remaining zero-result stages.
3. Resolve #277 or remove all model-performance material.
4. Re-run inventories, tests, provider/corpus artifact checks, lineage checks, and cost aggregation.
5. Rewrite the submission and connection map from those outputs, then run one final stale-claim sweep.
