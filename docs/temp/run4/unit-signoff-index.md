---
title: Run 4 Unit Signoff Index
summary: Current Run 4 unit delivery, PR, evidence, reviewer, reconciliation, and integration state.
type: signoff-index
scope: run4
status: draft
updated: 2026-07-28
---

# Run 4 Unit Signoff Index

`Built`, `merged`, and `done` are distinct. Check GitHub again before changing any row.

| Unit | Scope | Delivery / PR | Evidence at refresh | Review / dependency | State |
|---|---|---|---|---|---|
| R4-U0 | O24 + O31-O34 release gate | PR #161 merged; PR #172 base convention merged | #161 19/19; #172 19/19 | Current gate base still predates merged U2 | `merged`; gate-base/tracking reconciliation required before next landing |
| R4-U1 | O35 + O36 boundaries and secret scanning | #170 original; #180 stacked remediation | #170 21/21; #180 18/21, with five history secret findings and 14,131 additions > 8,500 | #180 must replace/absorb #170; independent bypass review | `built`, `open-unmerged`, `reconciliation-required` |
| R4-U2 | O25 authorization/key boundary | #177 merged; corrections #185 + #186 open | #177 19/19; #185 attestation config/lock mismatch; #186 8,565 additions > 8,500 | Combine siblings; rerun 443 auth assertions + nao/internal-auth | `merged`; corrections `open-unmerged`, `reconciliation-required` |
| R4-U3 | O26 atomic demo loader/retry safety | #184 open draft | 17/19; 15,001 additions > 8,500; aggregate gate consequentially red; local U3 and U2-regression evidence recorded | Reconcile gate base; LoaderPanel target; full HTTP 14 + 7-day walk | `built`, `open-unmerged`, `reconciliation-required` |
| R4-U4 | O27 + O38 scientific semantics/trust | no accepted PR | no implementation evidence | Jayden + Alton named reviewers; follows U1/U2/base reconciliation | `startable` |
| R4-U5 | single-paper authoring | #176 open draft; #190 evidence stacked on it | both 17/19; #176 synthetic-merge provenance failure; #190 8,840 additions > 8,500; provider/fixed-flow evidence local | Follows U3/U4; B-PL22 sentence provenance remains | `built`, `open-unmerged`, `reconciliation-required` |
| R4-U6a/b/c | metric expansion | no current PR | none | Admit only after core closeout | `deferred` |
| R4-U7 | full biomechanical-botanical UI | #191 canonical; contains #175 | #191 17/19 with 13,449 additions > 8,500; #175 predecessor 19/19 | Rebase after data/contract seam; Jayden + Alton for shared; Flutter/U2/device tests | `built`, `open-unmerged`, `reconciliation-required` |

## Gate and cap note

The original locked-core cap is 115 changed paths / 8,500 added lines, measured per unit from the exact
`RUN4_UNIT_BASE_SHA`. The checked-in base at refresh was `c558c04f...`, while integration had advanced to
`ad8ef178...`; that drift contributes to several composite cap measurements but does not explain every
red check. Use the per-PR failures above, advance and test the base mechanically, and never waive the gate.

The owner directed that the full UI scope is not to be trimmed merely to fit the original product-unit
cap. That is a unit-envelope exception requiring explicit machine-gate reconciliation and evidence; it
is not permission to disable the gate globally.
