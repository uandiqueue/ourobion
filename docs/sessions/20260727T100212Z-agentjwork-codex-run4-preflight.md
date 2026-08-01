# Session 20260727T100212Z — agentjwork — codex — run4-preflight

> Session log format: **Attempted / Changed / Decided / Left / Blockers**.

- **Device:** agentjwork · **Agent:** Codex (`gpt-5.6-sol`, max; primary) · **Branch:** `docs/run4-preflight-155` · **Issue:** #155
- **Type:** docs-only pre-flight packet; no product implementation.

## Attempted

- Produced the Run 4 decision packet from verified Git/GitHub evidence without self-signing.

## Changed

- Added only the allowed Run 4 orchestration, decision/signoff, human-decision, unit-signoff, JSON envelope, and session-log files.
- PR #156 is the unmerged pre-flight PR and must target `dev-phase2-run4`, never `dev-phase2`.
- Updated the packet for the accepted branch/base/lock/cap envelope, P3 pause/exclusion, P5/P6 local-only posture, and the P1 enforcement blocker.
- Added `dev-phase2-run4` to CI push and pull-request branch filters. Bootstrap PR #156 scope now includes only this minimal CI enablement plus authority/tracking docs; workflow run `30267437774` self-triggered on CI-enablement commit `f60650838428d871690d6f83358e0fb05387d0bc` targeting `dev-phase2-run4`, and all 14 jobs passed. Later evidence-recording commits are not claimed tested.

## Decided

- Recorded `dev-phase2-run4`, Run 2 immutable base, U0–U3, and 115/8,500 envelope as CANDIDATE/PENDING, not approved.
- Recorded PR #144 as closed/superseded; checks are stale evidence only. P2/P3 remain human-owned; O29 remains deferred with zero provider calls.
- Jayden accepted BRANCH/base, U0–U3 lock, and cap. `dev-phase2-run4` was created at `854aa471970b61afdc59205ded0b1c8a9ab3f270`; the six planning authorities were copied byte-for-byte and count in cap. U4 remains deferred because no second shared reviewer is available and the rule is not waived.
- P3 is paused/excluded: train nothing. P5 is local-only; P6 remains O29 deferred/zero calls. A local fixture-backed paper-to-Biotope slice needs separate sizing/admission under cap.
- Recorded the narrow bootstrap-only exception: PR #156 may merge to `dev-phase2-run4` only when all 14 checks are green on the then-current PR head; workflow run `30267437774` passed all 14 jobs on CI-enablement commit `f60650838428d871690d6f83358e0fb05387d0bc`.
- After bootstrap merge, the new push filter must produce all 14 green checks on exact merge SHA; U0/product remains frozen until that proof and ADMIN protection.

## Left

- An ADMIN-capable owner must enforce the exact 14 checks. PR #156 may merge only to `dev-phase2-run4`, never `dev-phase2`.
- No product code/settings/hosted systems/providers/PR #144 changed. No tests ran beyond read-only/source checks; adb pre-flight timed out.

## Blockers

- P1 human approval is recorded, but current GitHub token is WRITE not ADMIN and classic protection PUT returned 404; exact checks are not enforced, so product implementation remains gated. P2 has no available second shared reviewer.

memory: none
