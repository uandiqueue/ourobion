---
title: Run 4 Pre-Flight Decisions and Signoff
summary: Human-owned acceptance register for the proposed Run 4 integration envelope; all decisions remain pending.
type: decision-register
scope: run4-preflight
status: draft
updated: 2026-07-27
---

# Run 4 Pre-Flight Decisions and Signoff

The accepted envelope is recorded below, with P1 operationally blocked and P2 shared-review capacity unavailable. No protection, check, merge, or implementation is recorded as complete.

| ID | Proposed decision | Required action | State |
| --- | --- | --- | --- |
| BRANCH | `dev-phase2-run4` at `854aa471970b61afdc59205ded0b1c8a9ab3f270` | Accepted and created | ACCEPTED |
| LOCK | Lock `R4-U0`–`R4-U3`; defer `R4-U4` | Accepted; U4 deferred for no available second shared reviewer and no waiver | ACCEPTED / DEFERRED |
| P4 | Immutable base `854aa471970b61afdc59205ded0b1c8a9ab3f270`; caps 115 paths / 8,500 added lines | Accepted for current lock; extra local fixture-backed paper-to-Biotope slice requires separate sizing/admission | ACCEPTED |
| P1 | Require exact bootstrap check set | Human approval recorded; WRITE token lacks ADMIN and classic protection PUT returned 404, so checks are not enforced | BLOCKED |
| P1 | `Run 4 Gate` uses `if: always()` and explicit needs including `run-pipeline` | U0 proposes; owner switches protection only after SHA proof | PENDING |
| P2 | Second shared reviewer | No available reviewer; two-reviewer rule is not waived | BLOCKED; U4 DEFERRED |
| P3 | Model training | Paused/excluded; train nothing; product excludes MT1–MT5 | ACCEPTED |
| P5 | Name-only credential posture, local-only; no hosted/deployment/key changes | Accepted constraint | ACCEPTED |
| P6 | O29 deferred; zero provider calls; OpenAI TEST-MODE | Accepted constraint | ACCEPTED |
| P7 | PR #144 closed/superseded; checks stale | Recorded only | COMPLETE (record only) |

Accepted-base rationale: the full non-shallow Run 2 SHA is live `origin/dev-phase2-run2`; `dev-phase2` omits 169 paths / +16,992, while run3 adds 100 paths / +11,706 / -1,079 including contamination and Run 4 docs. Reject current `dev-phase2`, run3, and PR #144 head. The six Run 4 planning authority files absent from the candidate base have been copied byte-for-byte and count in cap; the pre-flight tracking packet and later approval updates count too, but are not immutable byte-for-byte material.

BRANCH, LOCK, and P4 are accepted/recorded, but no unit is authorised: P1 check enforcement is blocked. Product implementation remains prohibited until an ADMIN-capable owner enforces the exact checks. P2 additionally gates shared work. Cap breach returns the unit to pending.

Bootstrap-only exception: PR #156 may merge into `dev-phase2-run4`, never `dev-phase2`, when parent head `792f8ad` has 14 green and the final delta is only CI filter plus tracking and passes local/context/diff validation. This exception installs only authority/tracking docs plus minimal Run 4 CI branch-filter enablement; it does not authorise U0 or product implementation. The prior 14-green run does not test the final delta. After merge, the new push filter must produce all 14 green checks on the exact merge SHA; U0/product remains frozen until that exact-SHA proof and ADMIN-capable branch protection.
