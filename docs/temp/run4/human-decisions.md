---
title: Run 4 Human Decisions
summary: Decision sheet for the accepted Run 4 envelope and active operating constraints.
type: decision-sheet
scope: run4-preflight
status: draft
updated: 2026-07-27
---

# Run 4 Human Decisions

## Recorded 2026-07-27 decisions

- BRANCH/base accepted: `dev-phase2-run4` was created at `854aa471970b61afdc59205ded0b1c8a9ab3f270`.
- U0–U3 are locked. U4 is deferred because no second shared reviewer is available and the two-reviewer rule is not waived.
- The 115-path / 8,500-added-line cap is accepted for the current lock. A local fixture-backed paper-to-Biotope slice is separately sized and admitted only if it fits.
- P3 model training is paused/excluded: train nothing; MT1–MT5 do not enter product.
- P5 is local-only with no hosted writes/deploy/key changes. P6 keeps O29 deferred and provider spend at zero.
- PR #156 must target `dev-phase2-run4` and may merge there, never `dev-phase2`.

## Active operating posture

P1 is an accepted override: `dev-phase2-run4` intentionally has no branch protection, and no ADMIN or settings action is requested. `Run 4 Gate` provides CI evidence only. It must be evaluated on the exact current SHA; it does not imply GitHub branch-setting enforcement.

Before admitting the additional local fixture-backed paper-to-Biotope slice, size it separately against the accepted cap.

P2 remains blocked; shared work cannot start without an available second reviewer.

Not authorised: settings changes, hosted/provider calls, hosted Supabase, Cloudflare/R2 writes, deployment, key mutation/revocation, changes to PR #144, or a merge to `dev-phase2` or `main`. Run 4 product work is locally authorized within the locked envelope. All Run 4 issue, branch, PR, and merge operations affect `dev-phase2-run4` only. Full-suite and PR-CI evidence for the current U0 SHA remain pending.

Name-only local credentials: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `OPENALEX_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and Nao/Biotope public Supabase variables. No values belong here. Local Nao uses process-scoped local Supabase URL/anon/service-role values, never hosted file defaults. Android adb timed out; independent connection state is unverified.

O29 remains deferred: zero provider calls and single-provider OpenAI TEST-MODE. U0 is in progress; no full-suite, PR-CI, or merge result is claimed.
