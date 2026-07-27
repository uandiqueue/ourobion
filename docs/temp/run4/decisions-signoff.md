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
| LOCK (historical envelope) | Lock `R4-U0`–`R4-U3`; defer `R4-U4` | Accepted then; current cap snapshot below defers U2/U3. U4's reviewer blocker was historical and is now resolved for implementation; cap admission remains separate. | HISTORICAL ACCEPTED |
| P4 | Immutable base `854aa471970b61afdc59205ded0b1c8a9ab3f270`; caps 115 paths / 8,500 added lines | Accepted for current lock; extra local fixture-backed paper-to-Biotope slice requires separate sizing/admission | ACCEPTED |
| U0 gate reconciliation | Historical Run 4 envelope/bootstrap SHA remains `854aa471970b61afdc59205ded0b1c8a9ab3f270`; earlier U0 unit base `837b7e690f92dc1669428a2476c9d8d0456020e8` is retained as superseded provenance; active U0 unit base is consolidated tip `77c98213e23ad56ae37c86201b39ef4e7543a543` | The active cap measures only `RUN4_UNIT_BASE_SHA..HEAD`; inherited Run 3/MT3 history is not recast as U0 work, while its two real CI jobs are mandatory Run 4 Gate dependencies | ACCEPTED |
| P1 | `dev-phase2-run4` protection posture | User override: intentionally unprotected; no administrator action is requested | ACCEPTED OVERRIDE |
| P1 | `Run 4 Gate` uses `if: always()` and explicit needs including `run-pipeline` | U0 stable evidence completed at exact merge SHA; it is not GitHub branch protection | COMPLETE: CI `30285010079` 19/19 |
| U0 local qualification | 719 package/gate tests plus local release evidence | Historical pre-merge qualification with then-current environment blocks; later exact merge-SHA CI completed U0 | HISTORICAL; U0 COMPLETE |
| P2 / U4 only | Named shared reviewers: Alton and Jayden | Both approve unblocking U4 implementation; any shared-contract PR still requires both actual reviews before merge. No U6 approval and no cap admission is implied. | IMPLEMENTATION UNBLOCKED; MERGE REVIEW + CAP ADMISSION STILL REQUIRED |
| P3 | Model training | Paused/excluded; train nothing; product excludes MT1–MT5 | ACCEPTED |
| P5 | Name-only credential posture, local-only; no hosted/deployment/key changes | Accepted constraint | ACCEPTED |
| P6 | O29 deferred; zero provider calls; OpenAI TEST-MODE | Accepted constraint | ACCEPTED |
| P7 | PR #144 closed/superseded; checks stale | Recorded only | COMPLETE (record only) |
| U0 | PR #161 merged at `66bfde53b0dc388e40af42ab0ff4737ffb2fd8aa`; exact merge-SHA CI run `30285010079` passed 19/19 | Record completed U0 evidence; preserve historical provenance and U0 gate constants | COMPLETE (evidenced) |
| U1 | Implementation complete externally at `baab1536`; GitHub reports 10 files / +5,060 / -0 and 21/21 green | PR #170 remains draft/open, CLEAN, and unmerged; do not claim integration | COMPLETE EXTERNALLY / UNMERGED |
| U5 / pass-2 | Corrected canonical DB run `d3c2020a` | One uncertain hold, zero servable; health/insight pending | DB LOAD COMPLETE; FLOW IN PROGRESS |
| Cap snapshot | Merge tree `f2f2dac` from base `77c982`, U1 `baab1536` + U5 `cdc16f9`, excluding MT4 paths/session | 38 / +8,002 / -162; remaining 77 / +498. U2/U3 and sentence implementation do not fit; remeasure before merge | U1 FITS; LATER UNITS CAP-DEFERRED |
| U5/B-PL22 sentence provenance | Admit planning only inside U5; no renumbering/pipeline | Minimal slice touches six, reuses two, needs four new / ~+1,900; exceeds +498. Persisted/UI P2-blocked; O29 separately deferred | PLANNING ADMITTED / IMPLEMENTATION CAP-DEFERRED |

Historical-envelope rationale: the full non-shallow Run 2 SHA is live `origin/dev-phase2-run2`; `dev-phase2` omits 169 paths / +16,992, while run3 adds 100 paths / +11,706 / -1,079 including contamination and Run 4 docs. The original bootstrap/envelope record and earlier `837b7e690f92dc1669428a2476c9d8d0456020e8` U0 unit base are retained for provenance. Neither is the active U0 cap base after consolidation; the unit begins at exact consolidated tip `77c98213e23ad56ae37c86201b39ef4e7543a543`.

BRANCH, LOCK, P1, and P4 are accepted/recorded. U0 is complete through PR #161 at `66bfde5` with exact merge-SHA CI 19/19. `Run 4 Gate` is evidence, not branch-setting enforcement. P2 reviewer availability is resolved for U4 implementation; both actual reviews remain mandatory for a shared-contract PR, and cap admission remains separate. Cap breach returns a later unit to pending.

Historical bootstrap evidence: workflow run `30267437774` self-triggered on PR #156 CI-enablement commit `f60650838428d871690d6f83358e0fb05387d0bc` targeting `dev-phase2-run4`, and all 14 jobs passed. That evidence did not test later commits; U0 later completed through PR #161 and exact merge-SHA CI `30285010079` 19/19. Any Run 4 issue, branch, PR, or merge operation targets `dev-phase2-run4` only, never `dev-phase2` or `main`.

Historical pre-merge local qualification was not completion by itself: gate 9/9, four frozen Deno checks, fresh local-only attestation verification, 23/23 shadow migrations, context/shared/package checks, and 710 package tests passed, with then-current root/Flutter environment blocks. Exact merge-SHA CI later completed U0. Hosted parity is not claimed.

U5 corrected canonical DB evidence is run `d3c2020a`: one uncertain hold and zero servable. Health/insight evidence remains pending.
