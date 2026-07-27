---
title: Run 4 Pre-Flight Decisions and Signoff
summary: Human-owned acceptance register for the accepted Run 4 envelope and its active constraints.
type: decision-register
scope: run4-preflight
status: draft
updated: 2026-07-28
---

# Run 4 Pre-Flight Decisions and Signoff

The accepted envelope is recorded below. U0 completed through PR #161 at `66bfde5`; exact merge-SHA CI `30285010079` passed 19/19. `dev-phase2-run4` intentionally remains unprotected and CI evidence is not branch-setting enforcement.

| ID | Proposed decision | Required action | State |
| --- | --- | --- | --- |
| BRANCH | `dev-phase2-run4` at `854aa471970b61afdc59205ded0b1c8a9ab3f270` | Accepted and created | ACCEPTED |
| LOCK | Lock `R4-U0`–`R4-U3`; defer `R4-U4` | Accepted; U4 deferred for no available second shared reviewer and no waiver | ACCEPTED / DEFERRED |
| P4 | Immutable base `854aa471970b61afdc59205ded0b1c8a9ab3f270`; caps 115 paths / 8,500 added lines | Accepted for current lock; extra local fixture-backed paper-to-Biotope slice requires separate sizing/admission | ACCEPTED |
| U0 gate reconciliation | Historical Run 4 envelope/bootstrap SHA remains `854aa471970b61afdc59205ded0b1c8a9ab3f270`; earlier U0 unit base `837b7e690f92dc1669428a2476c9d8d0456020e8` is retained as superseded provenance; active U0 unit base is consolidated tip `77c98213e23ad56ae37c86201b39ef4e7543a543` | The active cap measures only `RUN4_UNIT_BASE_SHA..HEAD`; inherited Run 3/MT3 history is not recast as U0 work, while its two real CI jobs are mandatory Run 4 Gate dependencies | ACCEPTED |
| P1 | `dev-phase2-run4` protection posture | User override: intentionally unprotected; no administrator action is requested | ACCEPTED OVERRIDE |
| P1 | `Run 4 Gate` uses `if: always()` and explicit needs including `run-pipeline` | U0 stable evidence completed at exact merge SHA; it is not GitHub branch protection | COMPLETE: CI `30285010079` 19/19 |
| U0 local qualification | 719 package/gate tests plus local release evidence | Historical pre-merge qualification with then-current environment blocks; later exact merge-SHA CI completed U0 | HISTORICAL; U0 COMPLETE |
| P2 | Second shared reviewer | No available reviewer; two-reviewer rule is not waived | BLOCKED; U4 DEFERRED |
| P3 | Model training | Paused/excluded; train nothing; product excludes MT1–MT5 | ACCEPTED |
| P5 | Name-only credential posture, local-only; no hosted/deployment/key changes | Accepted constraint | ACCEPTED |
| P6 | O29 deferred; zero provider calls; OpenAI TEST-MODE | Accepted constraint | ACCEPTED |
| P7 | PR #144 closed/superseded; checks stale | Recorded only | COMPLETE (record only) |
| U0 | PR #161 merged at `66bfde53b0dc388e40af42ab0ff4737ffb2fd8aa`; exact merge-SHA CI run `30285010079` passed 19/19 | Record completed U0 evidence; preserve historical provenance and U0 gate constants | COMPLETE (evidenced) |
| CONTINUATION | Jayden instructed continuous local Run 4 completion on 2026-07-28; U1 remains separately owned and integrates only after its main workflow | Record sequencing only; no U1 implementation or merge is accepted here | RECORDED |
| U5 / pass-2 | Admit local paper-to-Biotope acceptance slice, issue #167, based on U0 merge SHA `66bfde53b0dc388e40af42ab0ff4737ffb2fd8aa` | V2 DB load ran but canonical-ID review was NO-GO; old bare-DOI projection is invalid and must be rebuilt after the uncommitted fix. No corrected DB proof; health/insight pending | IN PROGRESS; human signoff pending |
| U5/B-PL22 sentence provenance | Admit planning only inside U5; no renumbering/pipeline | Pre-plan remainder 4 / +1,216; measured plan delta 4 new-in-U5 paths / +209 / -70. Path slots exhausted, +1,007 lines unallocated. Local 14 / ~1,900 split/deferred; persisted/UI reserve 30 / ~4,500 P2-blocked. Separately O29 defers provider/model execution | PLANNING ADMITTED / IMPLEMENTATION DEFERRED |

Historical-envelope rationale: the full non-shallow Run 2 SHA is live `origin/dev-phase2-run2`; `dev-phase2` omits 169 paths / +16,992, while run3 adds 100 paths / +11,706 / -1,079 including contamination and Run 4 docs. The original bootstrap/envelope record and earlier `837b7e690f92dc1669428a2476c9d8d0456020e8` U0 unit base are retained for provenance. Neither is the active U0 cap base after consolidation; the unit begins at exact consolidated tip `77c98213e23ad56ae37c86201b39ef4e7543a543`.

BRANCH, LOCK, P1, and P4 are accepted/recorded. U0 is complete through PR #161 at `66bfde5` with exact merge-SHA CI 19/19. `Run 4 Gate` is evidence, not branch-setting enforcement. P2 alone gates shared work, so U4 remains deferred. Cap breach returns a later unit to pending.

Historical bootstrap evidence: workflow run `30267437774` self-triggered on PR #156 CI-enablement commit `f60650838428d871690d6f83358e0fb05387d0bc` targeting `dev-phase2-run4`, and all 14 jobs passed. That evidence did not test later commits; U0 later completed through PR #161 and exact merge-SHA CI `30285010079` 19/19. Any Run 4 issue, branch, PR, or merge operation targets `dev-phase2-run4` only, never `dev-phase2` or `main`.

Historical pre-merge local qualification was not completion by itself: gate 9/9, four frozen Deno checks, fresh local-only attestation verification, 23/23 shadow migrations, context/shared/package checks, and 710 package tests passed, with then-current root/Flutter environment blocks. Exact merge-SHA CI later completed U0. Hosted parity is not claimed.

U5 acceptance is deliberately staged: DOI `10.1016/j.isci.2026.116224` must yield an explicit local-agent synthesis artifact, pass deterministic checks, show visible `INTERIM` uncertain/hold verification, load canonical-ID edges locally, and only then provide later health/insight/provenance evidence. The v2 bare-DOI load is invalid under canonical-ID review and must be rebuilt after the uncommitted fix; it is not corrected DB proof. Health/insight evidence remains pending.
