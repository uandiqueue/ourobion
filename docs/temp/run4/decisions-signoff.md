---
title: Run 4 Pre-Flight Decisions and Signoff
summary: Human-owned acceptance register for the accepted Run 4 envelope and its active constraints.
type: decision-register
scope: run4-preflight
status: draft
updated: 2026-07-27
---

# Run 4 Pre-Flight Decisions and Signoff

The accepted envelope is recorded below. U0 implementation is locally authorized; `dev-phase2-run4` intentionally remains unprotected and CI evidence is not branch-setting enforcement.

| ID | Proposed decision | Required action | State |
| --- | --- | --- | --- |
| BRANCH | `dev-phase2-run4` at `854aa471970b61afdc59205ded0b1c8a9ab3f270` | Accepted and created | ACCEPTED |
| LOCK | Lock `R4-U0`–`R4-U3`; defer `R4-U4` | Accepted; U4 deferred for no available second shared reviewer and no waiver | ACCEPTED / DEFERRED |
| P4 | Immutable base `854aa471970b61afdc59205ded0b1c8a9ab3f270`; caps 115 paths / 8,500 added lines | Accepted for current lock; extra local fixture-backed paper-to-Biotope slice requires separate sizing/admission | ACCEPTED |
| P1 | `dev-phase2-run4` protection posture | User override: intentionally unprotected; no administrator action is requested | ACCEPTED OVERRIDE |
| P1 | `Run 4 Gate` uses `if: always()` and explicit needs including `run-pipeline` | U0 implements stable CI evidence only; it is not GitHub branch protection | IN PROGRESS |
| U0 local qualification | 719 package/gate tests plus local release evidence | Passed locally with qualified environment blocks; exact PR-head Linux root install, Flutter, and PR CI remain pending | IN PROGRESS |
| P2 | Second shared reviewer | No available reviewer; two-reviewer rule is not waived | BLOCKED; U4 DEFERRED |
| P3 | Model training | Paused/excluded; train nothing; product excludes MT1–MT5 | ACCEPTED |
| P5 | Name-only credential posture, local-only; no hosted/deployment/key changes | Accepted constraint | ACCEPTED |
| P6 | O29 deferred; zero provider calls; OpenAI TEST-MODE | Accepted constraint | ACCEPTED |
| P7 | PR #144 closed/superseded; checks stale | Recorded only | COMPLETE (record only) |

Accepted-base rationale: the full non-shallow Run 2 SHA is live `origin/dev-phase2-run2`; `dev-phase2` omits 169 paths / +16,992, while run3 adds 100 paths / +11,706 / -1,079 including contamination and Run 4 docs. Reject current `dev-phase2`, run3, and PR #144 head. The six Run 4 planning authority files absent from the candidate base have been copied byte-for-byte and count in cap; the pre-flight tracking packet and later approval updates count too, but are not immutable byte-for-byte material.

BRANCH, LOCK, P1, and P4 are accepted/recorded. U0 implementation is authorized on the intentionally unprotected `dev-phase2-run4`; `Run 4 Gate` is exact-current-SHA CI evidence, not branch-setting enforcement. P2 alone gates shared work, so U4 remains deferred. Cap breach returns the unit to pending.

Historical bootstrap evidence: workflow run `30267437774` self-triggered on PR #156 CI-enablement commit `f60650838428d871690d6f83358e0fb05387d0bc` targeting `dev-phase2-run4`, and all 14 jobs passed. That evidence does not test later commits. Any Run 4 issue, branch, PR, or merge operation targets `dev-phase2-run4` only, never `dev-phase2` or `main`; full-suite and PR-CI evidence remain pending for the current U0 work.

Current local qualification is not completion: gate 9/9, four frozen Deno checks, fresh local-only attestation verification, 23/23 shadow migrations, context/shared/package checks, and 710 package tests passed. Root clean-install and Flutter are locally environment-blocked; exact PR-head Linux CI remains pending. Hosted parity is not claimed.
