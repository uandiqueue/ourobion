---
title: Run 3.0 — planning cockpit and locked product scope
summary: Entry point for Phase-2 Run 3.0: its six-unit, product-only remediation tranche, living pending-build register, dependencies, human setup gates, and eventual sign-off record. Model training is an independent workstream. Planning only; Run 3 has not started.
type: plan
scope: shared
status: canonical
updated: 2026-07-26
---

# Run 3.0 — planning cockpit and locked product scope

Run 3 is a **six-unit, remediation-first product build** extending Run 2. It has not started. The
independent Run-2 audit established a maximum seven-unit/half-Run-2 envelope; Jayden subsequently
separated custom-model training into its own workstream, leaving O24–O29 as the six product units.
The removed unit is not spare capacity and must not be replaced without a new human decision.

The completed Run-1 and Run-2 work records are frozen under `docs/archive/runs/` for provenance.
Nothing in this folder builds from those archived files: every still-actionable gap is carried directly
in the living register below.

## Documents

| Document | Role |
|---|---|
| [`next-build-optimizations.md`](./next-build-optimizations.md) | **Scope authority:** order, gates, caps, and locked O24–O29 definitions |
| [`pending-build-register.md`](./pending-build-register.md) | **Gap superset:** every known open product gap, including work outside Run 3 |
| [`orchestrator-prompt.md`](./orchestrator-prompt.md) | Paste-ready, resumable launch prompt for the six-unit Run 3 product build |
| [`model-training-code-build-orchestrator-prompt.md`](./model-training-code-build-orchestrator-prompt.md) | Paste-ready prompt for the independent five-model code-build workstream; stored here by human request, not a Run 3 unit |
| [`../model-training/README.md`](../model-training/README.md) | Separate model-training workstream; not a Run-3 unit or implementation dependency |

## Locked size and order

- Exactly **6 planned product units**: O24 through O29, one unit each.
- The earlier half-Run-2 ceilings remain **85 changed files** and **8,650 added lines** cumulatively;
  they are ceilings, not targets or permission to add a seventh item.
- No follow-up or replacement unit. A blocked unit remains blocked and returns to the register.
- Anthropic remains at or below **2 SGD** and OpenAI at or below **20 SGD** across this product run.

Issue #138's earlier planning and frozen-snapshot work is pre-run administration and does **not**
consume this implementation envelope. The cap baseline is the exact commit Jayden accepts immediately
before U0 starts. Every tracked change after that baseline—including docs, session logs, generated
lockfiles, and follow-up corrections—counts toward the file/line caps.

| Unit | Item | Outcome |
|---|---|---|
| U0 | O24 | Exact cumulative-SHA CI and reproducible Deno release gate |
| U1 | O25 | nao RBAC/privacy boundary and named server-key rotation |
| U2 | O26 | Raw-truth-safe demo loading and retry-safe pipeline |
| U3 | O27 | Scientific provenance semantics and artifact trust posture |
| U4 | O28 | Plain-language, accessible client insight/provenance UI |
| U5 | O29 | Live verifier attestation and immutable release promotion |

## Start and separation boundaries

O24 may start as the Run-2 pre-sign-off closure unit. Do not imply that Run 2, production readiness,
scientific validation, or ordinary-user deployment has been accepted merely because Run-3 planning
exists.

`zebra-nli-shadow-v0` is governed independently under `docs/temp/model-training/`. Its training code,
GMI lifecycle, cost, completion state, and evidence do not count as a Run-3 unit. The only permitted
future seam is a frozen evaluation bundle that can compare Zebra and the existing LLM verifier on the
same public claim/evidence examples. Neither workstream waits on or silently changes the other's scope.
