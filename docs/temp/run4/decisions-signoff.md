---
title: Run 4 Pre-Flight Decisions and Signoff
summary: Human-owned acceptance register for the proposed Run 4 integration envelope; all decisions remain pending.
type: decision-register
scope: run4-preflight
status: draft
updated: 2026-07-27
---

# Run 4 Pre-Flight Decisions and Signoff

No row is approved. Jayden must accept or edit each required decision.

| ID | Proposed decision | Required action | State |
| --- | --- | --- | --- |
| BRANCH | Create `dev-phase2-run4` | Jayden accepts/edits; owner creates/protects and proves current SHA | PENDING |
| LOCK | Lock `R4-U0`–`R4-U3`; defer `R4-U4` | Jayden accepts/edits | PENDING |
| P4 | Immutable base `854aa471970b61afdc59205ded0b1c8a9ab3f270`; caps 115 paths / 8,500 added lines | Jayden accepts/edits | PENDING |
| P1 | Require exact bootstrap check set | Owner applies after acceptance | PENDING |
| P1 | `Run 4 Gate` uses `if: always()` and explicit needs including `run-pipeline` | U0 proposes; owner switches protection only after SHA proof | PENDING |
| P2 | Alton candidate reviewer only | Jayden names available reviewer and GitHub handle | PENDING |
| P3 | Separate model-training integration target | Jayden selects target; product excludes MT1–MT5 | PENDING |
| P5 | Name-only credential posture, no hosted/deployment/key changes | No authorisation implied | PENDING |
| P6 | O29 deferred; zero provider calls; OpenAI TEST-MODE | Explicit human approval required for change | PENDING |
| P7 | PR #144 closed/superseded; checks stale | Recorded only | COMPLETE (record only) |

Candidate-base rationale: the full non-shallow Run 2 SHA is live `origin/dev-phase2-run2`; `dev-phase2` omits 169 paths / +16,992, while run3 adds 100 paths / +11,706 / -1,079 including contamination and Run 4 docs. Reject current `dev-phase2`, run3, and PR #144 head. The six Run 4 planning authority files absent from the candidate base promote byte-for-byte later and count in cap; the pre-flight tracking packet and later approval updates count too, but are not immutable byte-for-byte material.

No unit is authorised by this register. Product implementation is prohibited until BRANCH, LOCK, P1, and P4 are accepted/recorded; P2 additionally gates any shared work. Cap breach returns the unit to pending.
