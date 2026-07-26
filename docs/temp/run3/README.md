---
title: Run 3.0 — planning cockpit and locked scope
summary: Entry point for Phase-2 Run 3.0: its seven-unit half-sized tranche, living pending-build register, detailed GMI-based NLI Shadow v0 training plan, dependencies, human setup gates, and eventual sign-off record. Planning only; Run 3 has not started.
type: plan
scope: shared
status: canonical
updated: 2026-07-26
---

# Run 3.0 — planning cockpit and locked scope

Run 3 is a **seven-unit, remediation-first** extension of Run 2. It has not started. Its scope was
locked by the [independent Run-2 audit](../run2/adversarial-audit-2026-07-26.md), subject to Jayden's
instruction that it be no more than half the size of Run 2.

## Documents

| Document | Role |
|---|---|
| [`next-build-optimizations.md`](./next-build-optimizations.md) | **Scope authority:** order, gates, caps, and locked O24–O30 definitions |
| [`pending-build-register.md`](./pending-build-register.md) | **Gap superset:** every known open gap, including work outside Run 3 |
| [`custom-model-training-plan.md`](./custom-model-training-plan.md) | **O30 execution annex:** SciFact-only NLI Shadow v0 training/evaluation on GMI |
| [`../run2/README.md`](../run2/README.md) | Run-2 build/sign-off evidence; kept in Run 2 |
| [`../run2/adversarial-audit-2026-07-26.md`](../run2/adversarial-audit-2026-07-26.md) | Run-3 promotion rationale and withheld sign-offs |

The two living planning authorities were moved from `run2/` into this folder. Compatibility pointers
remain at their old paths so immutable historical session links do not break; frozen in-tree snapshots
preserve the Run-2 evidence those links originally described. Neither pointers nor snapshots compete
with the living Run-3 authorities.

## Locked size and order

- At most **7 units**: O24 through O30, one unit each.
- At most **85 changed files** and **8,650 added lines** over the cumulative run.
- No eighth follow-up unit. A blocked unit remains blocked; it is not replaced with unrelated scope.
- Anthropic remains at or below **2 SGD** and OpenAI at or below **20 SGD** across the run.

Issue #138's planning, migration and frozen-snapshot work is pre-run administration and does **not**
consume this implementation envelope. The cap baseline is the exact commit Jayden accepts immediately
before U0 starts. Every tracked change after that baseline—including docs, session logs, generated
lockfiles and follow-up corrections—counts toward the 85-file/8,650-added-line caps.

| Unit | Item | Outcome |
|---|---|---|
| U0 | O24 | Exact cumulative-SHA CI and reproducible Deno release gate |
| U1 | O25 | nao RBAC/privacy boundary and named server-key rotation |
| U2 | O26 | Raw-truth-safe demo loading and retry-safe pipeline |
| U3 | O27 | Scientific provenance semantics and artifact trust posture |
| U4 | O28 | Plain-language, accessible client insight/provenance UI |
| U5 | O29 | Live verifier attestation and immutable release promotion |
| U6 | O30 | Train/evaluate NLI Shadow v0 on GMI, with **no serving influence**, then close out Run 3 |

## Start boundary

O24 may start as the Run-2 pre-sign-off closure unit. Do not imply that Run 2, production readiness,
scientific validation, or ordinary-user deployment has been accepted merely because Run-3 planning
exists. The detailed conditions remain in the Run-2 audit.

O30 cannot provision paid GPU resources until the human-owned GMI gates in
[`custom-model-training-plan.md`](./custom-model-training-plan.md) are recorded. It also waits for O29
to freeze the evidence-input contract and the candidate in-domain audit set.
