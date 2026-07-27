---
title: Run 4 Unit Signoff Index
summary: Locked Run 4 unit scope, estimates, dependencies, and current signoff state.
type: signoff-index
scope: run4-preflight
status: draft
updated: 2026-07-28
---

# Run 4 Unit Signoff Index

## 2026-07-28 current execution status

R4-U0 merged via PR #161 at `66bfde53b0dc388e40af42ab0ff4737ffb2fd8aa`; exact merge-SHA CI run `30285010079` passed 19/19. U1 is separately owned and integrates only after its main workflow.

R4-U5 / pass-2 is admitted **IN PROGRESS** under issue #167, its named branch/worktree, and base `66bfde53b0dc388e40af42ab0ff4737ffb2fd8aa`. It is local-only with no provider, hosted-write, shared, or model-training work; estimate 6 paths / ~1,900 additions. U0+U5 projects to 28 paths / ~3,609 additions against 115/8,500 and must be remeasured before merge. Acceptance requires DOI `10.1016/j.isci.2026.116224` -> local-agent synthesis artifact -> deterministic checks -> visible `INTERIM` uncertain/hold verification -> local edge load -> later health/insight/provenance evidence. Canonical paper files are absent locally and must be locally cached without hosted writes before acceptance. Human signoff remains pending.

Triplets are low / expected / high. Human signoff is pending for every row.

| Unit | Paths | Added lines | Migration/shared | Tests | Review/dependency | State |
| --- | --- | --- | --- | --- | --- | --- |
| R4-U0 | 12–15 / 17–22 / 25–31 | 550–750 / 950–1,350 / 1,700–2,500 | no migration/shared | 719 local package/gate tests passed; Flutter zero run | release/CI reviewer | IN PROGRESS; local release qualification passed with root-install/Flutter environment blocks; exact PR-head Linux CI pending |
| R4-U1 | 6–8 / 9–13 / 14–19 | 300–450 / 600–950 / 1,150–1,800 | no migration/shared | 60–120 likely min | security; after U0 current-SHA CI evidence | LOCKED |
| R4-U2 | 28 / 40 / 55 | 1,100 / 1,900 / 3,100 | 2–3 migrations; no shared expected | 25 likely min | security/privacy + RLS; P5/role policy | LOCKED |
| R4-U3 | 20 / 31 / 46 | 1,000 / 1,800 / 3,200 | 2–3 migrations; no shared unless provenance promoted | 35 likely min | raw-truth/concurrency + M2/M3; depends U2 | LOCKED |
| R4-U4 | 38 / 54 / 74 | 1,600 / 3,000 / 5,000 | 1–2 migrations; definite 5–8 shared paths | 40 likely min | two reviewers | DEFERRED: no available second shared reviewer; no waiver |

All-five union is likely 135–155 paths and 8,250–9,000 lines. Accepted U0–U3 cap is 115/8,500 inclusive of promoted Run 4 docs/tracking. A local fixture-backed paper-to-Biotope slice requires separate sizing and admission only if it fits. A breach returns the unit to pending. `dev-phase2-run4` intentionally remains unprotected; `Run 4 Gate` is exact-current-SHA CI evidence only.
