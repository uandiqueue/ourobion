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

R4-U0 merged via PR #161 at `66bfde53b0dc388e40af42ab0ff4737ffb2fd8aa`; exact merge-SHA CI run `30285010079` passed 19/19. U1 implementation is complete externally at `baab1536`, but PR #170 remains draft/open and unmerged; it is CLEAN with 21/21 checks green.

R4-U5 / pass-2 is admitted **IN PROGRESS** under issue #167. Corrected canonical DB run `d3c2020a` completed with one uncertain hold and zero servable edges. Health/insight acceptance and human signoff remain pending.

Latest local-only evidence is partial, not acceptance: harness S0–S8 and M1 passed after its ANSI
reset-output, public-local-env, and no-redirect hardening. It loaded 5 claims / 4 verified edges and,
for `4483fefb-d5e5-49a9-8132-d347ad082b57`, 14 simulated gut plus 14 wearable rows; the U5 edge remains
`uncertain` / `hold`. M2 returned `401 Unauthorized` before U5/base route execution because the active
edge-runtime container is mounted from a separately owned U2 worktree enforcing U2 internal auth. The
local service-role keys compare equal; M2 wrote zero baselines, signals, cards, or composed insights.
Health/insight proof awaits stable U2 reconciliation; do not restart/rebind that stack. Provider and
hosted calls remain zero. U2 PR is not open; UI PR #175 remains deferred until the unit boundary.

R4-U5/B-PL22 sentence provenance: **PLANNING ADMITTED; IMPLEMENTATION SPLIT/DEFERRED**. Snapshot
`f2f2dac` from base `77c982` includes U1 `baab1536` + U5 `cdc16f9`, excludes MT4 paths/session, and is the
historical pre-overlay 38 / +8,002 / -162 snapshot, leaving 77 / +498. The later final pre-commit overlay
(U5 docs + harness script + 44-line session) was independently audited at 40 / +8,146 / -185, leaving 75 /
+354. The minimal slice needs four new / ~+1,900 and does not fit; U2/U3 expected additions also do not fit.
Exact pre-merge remeasurement remains mandatory. Persisted/UI remains P2-blocked. It must preserve deterministic
sentence/citation/root traces; frozen/mock LlmRouter `INTERIM:` output may suggest only and all missing
provenance/evidence failures hold closed. Separately, O29 defers provider/model execution. No
implementation or acceptance is signed off.

Triplets are low / expected / high. Human signoff remains pending for non-complete rows.

| Unit | Paths | Added lines | Migration/shared | Tests | Review/dependency | State |
| --- | --- | --- | --- | --- | --- | --- |
| R4-U0 | 12–15 / 17–22 / 25–31 | 550–750 / 950–1,350 / 1,700–2,500 | no migration/shared | Historical local qualification plus exact merge-SHA CI 19/19 | release/CI reviewer | COMPLETE: PR #161 merged at `66bfde5`; CI `30285010079` passed 19/19 |
| R4-U1 | 10 actual | 5,060 actual | no migration/shared | 21/21 PR checks green | security; PR #170 draft/open, CLEAN | COMPLETE EXTERNALLY at `baab1536`; UNMERGED |
| R4-U2 | 28 / 40 / 55 | 1,100 / 1,900 / 3,100 | 2–3 migrations; no shared expected | 25 likely min | security/privacy + RLS; P5/role policy | DEFERRED BY CAP pending later envelope |
| R4-U3 | 20 / 31 / 46 | 1,000 / 1,800 / 3,200 | 2–3 migrations; no shared unless provenance promoted | 35 likely min | raw-truth/concurrency + M2/M3; depends U2 | DEFERRED BY CAP pending later envelope |
| R4-U4 | 38 / 54 / 74 | 1,600 / 3,000 / 5,000 | 1–2 migrations; definite 5–8 shared paths | 40 likely min | Alton + Jayden named reviewers; both actual reviews required before shared-contract PR merge | IMPLEMENTATION UNBLOCKED; cap admission remains separate; no U6 authority |

All-five union is likely 135–155 paths and 8,250–9,000 lines. Accepted U0–U3 cap is 115/8,500 inclusive of promoted Run 4 docs/tracking. A local fixture-backed paper-to-Biotope slice requires separate sizing and admission only if it fits. A breach returns the unit to pending. `dev-phase2-run4` intentionally remains unprotected; `Run 4 Gate` is exact-current-SHA CI evidence only.
