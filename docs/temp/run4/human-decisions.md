---
title: Run 4 Human Decisions
summary: Decision sheet for resuming Run 4 from pre-flight without implying implementation approval.
type: decision-sheet
scope: run4-preflight
status: draft
updated: 2026-07-27
---

# Run 4 Human Decisions

Before implementation, Jayden must:

1. Accept or edit candidate branch `dev-phase2-run4` and base `854aa471970b61afdc59205ded0b1c8a9ab3f270`.
2. Accept or edit U0–U3 lock; keep U4 deferred pending P2 and later cap approval.
3. Accept or edit 115-path / 8,500-added-line cap, inclusive of generated/lock/session/tracking/corrections.
4. Name P1 owner to create/protect branch and apply every exact bootstrap check.
5. Name P2 reviewer with GitHub handle and availability. Alton is candidate only.
6. Select exact P3 model-training target; product branch excludes MT1–MT5.

Not authorised: product edits, settings changes, hosted/provider calls, hosted Supabase, Cloudflare/R2 writes, deployment, key mutation/revocation, merges, changes to PR #144, or creating the candidate branch during pre-flight.

Name-only local credentials: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `OPENALEX_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and Nao/Biotope public Supabase variables. No values belong here. Local Nao uses process-scoped local Supabase URL/anon/service-role values, never hosted file defaults. Android adb timed out; independent connection state is unverified.

O29 remains deferred: zero provider calls and single-provider OpenAI TEST-MODE. No unit is queued, in progress, shipped, or tested.
