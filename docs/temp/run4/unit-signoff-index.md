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

R4-U5 / pass-2 is admitted **IN PROGRESS** under issue #167, its named branch/worktree, and base `66bfde53b0dc388e40af42ab0ff4737ffb2fd8aa`. It is local-only with no provider, hosted-write, shared, or model-training work. The v2 local DB load ran, but canonical-ID review returned NO-GO: the old bare-DOI projection is invalid and must be rebuilt after the uncommitted canonical fix. This is not corrected DB proof; health/insight acceptance and human signoff remain pending.

R4-U5/B-PL22 sentence provenance: **PLANNING ADMITTED; IMPLEMENTATION SPLIT/DEFERRED**. Before this
plan, expected U1-U3 reserve left 4 paths / +1,216. The plan measured 4 new-in-U5 paths / +209 / -70:
path slots are exhausted, while +1,007 lines remain unallocated. A future local tool tranche is 14 / ~1,900; full
persisted/UI is 27 / ~4,000 (reserve 30 / ~4,500) and P2-blocked. It must preserve deterministic
sentence/citation/root traces; frozen/mock LlmRouter `INTERIM:` output may suggest only and all missing
provenance/evidence failures hold closed. Separately, O29 defers provider/model execution. No
implementation or acceptance is signed off.

Triplets are low / expected / high. Human signoff remains pending for non-complete rows.

| Unit | Paths | Added lines | Migration/shared | Tests | Review/dependency | State |
| --- | --- | --- | --- | --- | --- | --- |
| R4-U0 | 12–15 / 17–22 / 25–31 | 550–750 / 950–1,350 / 1,700–2,500 | no migration/shared | Historical local qualification plus exact merge-SHA CI 19/19 | release/CI reviewer | COMPLETE: PR #161 merged at `66bfde5`; CI `30285010079` passed 19/19 |
| R4-U1 | 6–8 / 9–13 / 14–19 | 300–450 / 600–950 / 1,150–1,800 | no migration/shared | 60–120 likely min | security; after U0 current-SHA CI evidence | LOCKED |
| R4-U2 | 28 / 40 / 55 | 1,100 / 1,900 / 3,100 | 2–3 migrations; no shared expected | 25 likely min | security/privacy + RLS; P5/role policy | LOCKED |
| R4-U3 | 20 / 31 / 46 | 1,000 / 1,800 / 3,200 | 2–3 migrations; no shared unless provenance promoted | 35 likely min | raw-truth/concurrency + M2/M3; depends U2 | LOCKED |
| R4-U4 | 38 / 54 / 74 | 1,600 / 3,000 / 5,000 | 1–2 migrations; definite 5–8 shared paths | 40 likely min | two reviewers | DEFERRED: no available second shared reviewer; no waiver |

All-five union is likely 135–155 paths and 8,250–9,000 lines. Accepted U0–U3 cap is 115/8,500 inclusive of promoted Run 4 docs/tracking. A local fixture-backed paper-to-Biotope slice requires separate sizing and admission only if it fits. A breach returns the unit to pending. `dev-phase2-run4` intentionally remains unprotected; `Run 4 Gate` is exact-current-SHA CI evidence only.
