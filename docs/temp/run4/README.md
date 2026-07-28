---
title: Run 4 reviewed planning cockpit
summary: Current Run 4 entrypoint: U0 and U2 are merged, several later units are built but unmerged, and reconciliation precedes the final local paper-to-insight and UI qualification.
type: plan
scope: shared
status: canonical
updated: 2026-07-28
---

# Run 4 reviewed planning cockpit

Run 4 is active on `dev-phase2-run4`. It is no longer in initial preflight: U0 and U2 have merged,
while U1 remediation, U2 corrections, U3, U5, provider evidence, and the full UI exist on open branches.
The immediate job is reconciliation, not rebuilding. U4 is startable because Jayden and Alton are the
named shared-contract reviewers. U6 metrics and general O29 promotion remain deferred.

## Start or resume

In a fresh session, say:

`run docs\temp\run4\orchestrator-prompt.md`

The prompt runs the repository startup protocol, refreshes GitHub and ancestry, then resumes from
[`continuation-status.md`](./continuation-status.md). Do not use the old launch prompt as operational
authority.

## Current status at a glance

| Area | State |
|---|---|
| U0 release gate | merged (#161); per-unit base convention merged (#172); current base needs reconciliation before the next landing |
| U1 boundaries/secret scanning | built but unmerged; #180 remediates #170 and still has a real secret-scan failure |
| U2 auth/key boundary | merged (#177); post-merge corrections #185/#186 require one reconciled landing |
| U3 atomic loader | built on #184; full HTTP 14 + 7-day walk and current-base gate remain pending |
| U4 scientific semantics | startable; Jayden + Alton named reviewers; not built |
| U5 paper authoring | built on #176; unmerged and incomplete at sentence-provenance/full-flow level |
| Provider evidence | executed locally; accurate evidence is on stacked PR #190, not yet integrated |
| Full UI | canonical candidate is #191, which contains #175; unmerged and awaiting final data-shape/device reconciliation |
| U6 metrics | deferred; no implementation built |
| Cloud promotion | forbidden/deferred |

The complete live snapshot, check counts, dependencies, and required order are in
[`continuation-status.md`](./continuation-status.md).

## Documents

| Document | Role |
|---|---|
| [`continuation-status.md`](./continuation-status.md) | Authoritative resume snapshot: built vs merged, live PRs, blockers, reconciliation order, provider/E2E evidence |
| [`orchestrator-prompt.md`](./orchestrator-prompt.md) | Governing continuation prompt; the only prompt a new session needs to execute |
| [`unit-signoff-index.md`](./unit-signoff-index.md) | Unit delivery, evidence, review, and integration state |
| [`human-decisions.md`](./human-decisions.md) | Recorded human authority: branch, reviewers, local/device/provider limits, merge scope |
| [`run-envelope.json`](./run-envelope.json) | Machine-readable branch, gate, unit and PR snapshot |
| [`orchestration-log.md`](./orchestration-log.md) | Historical preflight evidence plus the current resume pointer |
| [`decisions-signoff.md`](./decisions-signoff.md) | Accepted decisions and remaining signoff work |
| [`next-build-optimizations.md`](./next-build-optimizations.md) | Scope/design authority and the candidate units |
| [`pending-build-register.md`](./pending-build-register.md) | Full gap superset; current overlay distinguishes delivered, open, partial and deferred work |
| [`run3-audit-findings.md`](./run3-audit-findings.md) | Historical audit explaining why Run 4 gates exist; not current status |
| [`run4-launch-prompt.md`](./run4-launch-prompt.md) | Superseded launch snapshot; retained only to route readers to the orchestrator prompt |

## Current integration facts

- Fresh GitHub and local ancestry were checked on 2026-07-28.
- The pre-refresh integration tip was `ad8ef178053c7e6514283f19ee7a4f3f0829dc0c` (PR #177).
- The checked-in landing base remained `c558c04f1b661a59c8987c96770768eeea46e0cc`.
  That stale base contributes cumulative work to several cap failures, but it is not the only red-check
  cause: #176 has synthetic-merge provenance failure, #180 also has secret findings, and #185 has an
  attestation config/lock mismatch. Read the exact failure ledger in `continuation-status.md`.
- PR #170 and UI predecessor #175 are green, but each has a later branch that contains it. Do not land
  duplicate predecessors separately: reconcile U1 through #180 and UI through #191.
- Issue #171 remains open even though PR #172 says it closes it; reconcile the issue state.

## Product and scientific boundary

The local provider test did not prove full-paper LLM synthesis. It proved full canonical extraction and
OpenAI synthesis over 12 selected passages. Anthropic performed the official verifier-only role and
correctly held the one-paper edge because no independent corroboration existed. Sentence-level
StructuredPaper/JATS/citation-root/NLI work remains B-PL22.

The separate fixed-edge flow passed 20/20 with 21 days of matched health data and rendered research
cards on physical Android. After reconciliation, the exit gate repeats both honest proofs: a traceable
real-paper held edge and a servable fixed verified edge. Never manufacture corroboration to combine them.

## Boundaries

- Local-only. Local Supabase reset and physical Android testing are authorized.
- All permitted integration work and merges affect `dev-phase2-run4` only.
- No hosted writes, deployment, model promotion, production traffic, or scientific-validation claim.
- No model training. Historical bundle merges on the branch are non-serving and outside Run 4 work.
- Shared changes require Jayden and Alton review.
- UI work comes from the canonical full UI branch and is reconciled against final data shapes rather
  than redesigned independently.
