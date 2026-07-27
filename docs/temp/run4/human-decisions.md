---
title: Run 4 Human Decisions
summary: Decision sheet for the accepted Run 4 envelope and active operating constraints.
type: decision-sheet
scope: run4-preflight
status: draft
updated: 2026-07-28
---

# Run 4 Human Decisions

## Recorded 2026-07-27 decisions

- BRANCH/base accepted: `dev-phase2-run4` was created at `854aa471970b61afdc59205ded0b1c8a9ab3f270`.
- U0–U3 are locked. U4 was deferred because no second shared reviewer was available; that historical blocker is resolved for U4 implementation by the named reviewers below.
- The 115-path / 8,500-added-line cap is accepted for the current lock. A local fixture-backed paper-to-Biotope slice is separately sized and admitted only if it fits.
- The original Run 4 envelope/bootstrap provenance remains `854aa471970b61afdc59205ded0b1c8a9ab3f270`, and earlier U0 unit base `837b7e690f92dc1669428a2476c9d8d0456020e8` is retained as superseded provenance. For U0 only, the active gate starts at consolidated Run 3/MT3 tip `77c98213e23ad56ae37c86201b39ef4e7543a543` and measures `RUN4_UNIT_BASE_SHA..HEAD` against the same 115 / 8,500 caps. The separately owned model-training files remain untouched; their two existing CI jobs are required gate evidence.
- P3 model training is paused/excluded: train nothing; MT1–MT5 do not enter product.
- P5 is local-only with no hosted writes/deploy/key changes. P6 keeps O29 deferred and provider spend at zero.
- PR #156 must target `dev-phase2-run4` and may merge there, never `dev-phase2`.

## Recorded 2026-07-28 direction

- R4-U0 merged via PR #161 at `66bfde53b0dc388e40af42ab0ff4737ffb2fd8aa`; exact merge-SHA CI run `30285010079` passed 19/19. Historical provenance and U0 gate constants remain unchanged.
- Jayden reports U1 complete; PR #170 is still draft/open and unmerged at `baab1536`, CLEAN, with 21/21 checks green and GitHub reporting 10 files / +5,060 / -0.
- R4-U5 / pass-2 is admitted in progress under issue #167, its named branch/worktree, and base `66bfde53b0dc388e40af42ab0ff4737ffb2fd8aa`. It remains local-only: no provider calls, hosted writes, shared changes, or `/model-training` work. Its pre-plan measurement was 10 paths / +928 / -29; the U0+U5 pre-plan union was 27 / +2,634 / -126. Human signoff remains pending.
- U5 canonical DB run `d3c2020a` is complete with one uncertain hold and zero servable edges. Health/insight acceptance remains pending.

## U5 sentence-provenance planning record

Inside existing R4-U5/B-PL22 only, planning is **ADMITTED** while implementation is **SPLIT/DEFERRED**.
Historical pre-overlay combined product snapshot `f2f2dac` from base `77c982` includes U1 `baab1536` and
U5 `cdc16f9`, excludes MT4 paths/session, and measures 38 / +8,002 / -162, leaving 77 / +498. The later
final pre-commit overlay (U5 docs + harness script + 44-line session) was independently audited at 40 /
+8,156 / -195, leaving 75 / +344. U1 fits. U2/U3
expected additions and the minimal sentence slice (six touched, two reused, four new, ~+1,900) do not
fit and are cap-deferred pending an explicit later envelope decision. Exact pre-merge remeasurement is
outside the snapshot; remeasure before merge. No cap expansion is authorized.
Persisted/served/UI scope (reserve 30 / ~4,500) is
P2-blocked. Future local artifacts must be versioned StructuredPaper/JATS-or-frozen-GROBID sentence,
citation/root and deterministic trace gates; frozen/mock LlmRouter adapters visibly emit `INTERIM:`
metadata but never decide serving. Separately, provider/model execution remains O29-deferred; no training/runtime
import is authorized. This is neither implementation nor acceptance.

## Active operating posture

P1 is an accepted override: `dev-phase2-run4` intentionally has no branch protection, and no ADMIN or settings action is requested. `Run 4 Gate` provides CI evidence only. It must be evaluated on the exact current SHA; it does not imply GitHub branch-setting enforcement.

Before admitting the additional local fixture-backed paper-to-Biotope slice, size it separately against the accepted cap.

Alton and Jayden are the named reviewers and both approve unblocking **R4-U4 implementation**. This does not waive the two-reviewer rule: any U4 shared-contract PR still requires both actual reviews before merge. Current cap admission fails (+344 remains versus U4 low +1,600), so U4 is NO-GO/pending under this envelope; no U6 authority follows.

Not authorised: settings changes, hosted/provider calls, hosted Supabase, Cloudflare/R2 writes, deployment, key mutation/revocation, changes to PR #144, or a merge to `dev-phase2` or `main`. Run 4 product work is locally authorized within the locked envelope. All Run 4 issue, branch, PR, and merge operations affect `dev-phase2-run4` only. U0 is complete through PR #161 at `66bfde5`; exact merge-SHA CI run `30285010079` passed 19/19.

Name-only local credentials: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `OPENALEX_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and Nao/Biotope public Supabase variables. No values belong here. Local Nao uses process-scoped local Supabase URL/anon/service-role values, never hosted file defaults. Android adb timed out; independent connection state is unverified.

O29 remains deferred: zero provider calls. U0 is complete with PR #161 exact merge-SHA CI 19/19. U1 is complete externally but PR #170 is draft/open and unmerged. U5 canonical DB load is complete; health/insight remains pending.
