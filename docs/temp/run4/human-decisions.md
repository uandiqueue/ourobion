---
title: Run 4 Human Decisions
summary: Decision sheet for resuming Run 4 from pre-flight without implying implementation approval.
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

## Remaining required action

P1 has human approval but is operationally blocked: the current GitHub token is WRITE rather than ADMIN and classic protection PUT returned 404. The exact 14 checks are not enforced. Product implementation remains gated; do not infer protection, a merge, checks, or implementation.

Before implementation, an ADMIN-capable owner must:

1. Enforce the exact bootstrap checks on `dev-phase2-run4` and supply proof at the current SHA.
2. Separately size the local fixture-backed paper-to-Biotope slice before admitting it under the accepted cap.

P2 remains blocked; shared work cannot start without an available second reviewer.

Not authorised: product edits, settings changes, hosted/provider calls, hosted Supabase, Cloudflare/R2 writes, deployment, key mutation/revocation, changes to PR #144, or a merge to `dev-phase2`. Bootstrap PR #156 may merge only to `dev-phase2-run4` when parent head `792f8ad` has 14 green and final delta is only CI filter plus tracking and passes local/context/diff validation; it installs authority/tracking docs plus minimal Run 4 CI branch-filter enablement only. The prior 14-green run does not test the final delta. The new push filter must produce all 14 green checks on exact merge SHA; U0 and product remain frozen until that proof and ADMIN-capable branch protection.

Name-only local credentials: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `OPENALEX_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and Nao/Biotope public Supabase variables. No values belong here. Local Nao uses process-scoped local Supabase URL/anon/service-role values, never hosted file defaults. Android adb timed out; independent connection state is unverified.

O29 remains deferred: zero provider calls and single-provider OpenAI TEST-MODE. No unit is in progress, shipped, or tested.
