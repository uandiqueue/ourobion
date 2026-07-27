---
title: Run 4 Pre-Flight Orchestration Log
summary: Resumable pre-flight record for the proposed Run 4 integration envelope; no implementation is authorised.
type: plan
scope: run4-preflight
status: draft
updated: 2026-07-27
---

# Run 4 Pre-Flight Orchestration Log

## Control state

This is **pre-flight only**. The governing prompt permits no product implementation until Jayden accepts the exact integration branch, immutable base, caps, required checks, reviewer, and locked list. Nothing here is an approval or self-signature.

- Issue #155; claim `run4-preflight-decision-packet` by `codex@agentjwork`.
- Worktree `C:\project\ourobion-run4-preflight-155`; branch `docs/run4-preflight-155`.
- Bootstrap PR #156 must target `dev-phase2-run4`; it may merge there (never `dev-phase2`) as a bootstrap-only authority/tracking-docs plus minimal Run 4 CI branch-filter enablement exception only when parent head `792f8ad` has 14 green and the final delta is only CI filter plus tracking and passes local/context/diff validation. It remains unmerged/pre-flight-only.
- No hosted writes, provider calls, product edits, settings changes, merges, or PR #144 changes.

## 2026-07-27 human decision and operational blocker

Jayden accepted BRANCH/base, the U0–U3 lock, and the 115-path / 8,500-addition cap for the currently locked envelope. `dev-phase2-run4` was created at exact SHA `854aa471970b61afdc59205ded0b1c8a9ab3f270`. The six Run 4 planning authority files were copied byte-for-byte and count in the cap. The pre-flight tracking packet and later approval updates also count, but are not byte-for-byte authority material.

P1 has human approval, but remains an operational **BLOCKER**: the current GitHub token is WRITE rather than ADMIN, and classic protection PUT returned 404. The exact required checks are therefore not yet enforced. Product implementation, including U0, remains gated; no protection, check, merge, or implementation is recorded as complete. The sole exception is bootstrap PR #156: parent head `792f8ad` has 14 green; its final delta must be only CI filter plus tracking and pass local/context/diff validation before merge, and it installs only authority/tracking docs plus minimal Run 4 CI branch-filter enablement. The prior run does not test the final delta. The new push filter must produce all 14 green checks on the exact merge SHA; U0/product remains frozen until that exact-SHA proof and ADMIN protection.

## Verified live state

On 2026-07-27, PR #144 was **CLOSED**, not merged, at `2026-07-27T08:03:15Z`; base `dev-phase2-run3@9b41f4abc0a52e2c3ebfebb6b6fe6b375709dca3`; head `5eebdddc522d0e5c337573ab8b0224ce35f0313b`; explicit [superseded comment](https://github.com/uandiqueue/ourobion/pull/144#issuecomment-5088805906). Its 15 green checks are stale evidence only. No open PRs exist, so no model-training PR targets product.

| Ref | SHA |
| --- | --- |
| `dev-phase2` | `e185cf03b459285ec950c80d1696a656e8a045c9` |
| `dev-phase2-run2` | `854aa471970b61afdc59205ded0b1c8a9ab3f270` |
| `dev-phase2-run3` | `6869eeadb05c792bf9437bd866f03d06b297ee9d` |

`dev-phase2-run4` now exists at `854aa471970b61afdc59205ded0b1c8a9ab3f270`. The previously observed `dev-phase2` and `dev-phase2-run3` protections were false. One ruleset applies only to `main` and has no required status checks. No Run 4 protection enforcement is recorded.

## Accepted envelope, operationally blocked

| Field | Value | State |
| --- | --- | --- |
| Integration branch | `dev-phase2-run4` at `854aa471970b61afdc59205ded0b1c8a9ab3f270` | ACCEPTED / enforcement blocked |
| Immutable base | `854aa471970b61afdc59205ded0b1c8a9ab3f270` (`origin/dev-phase2-run2`) | ACCEPTED |
| Locked units | `R4-U0`, `R4-U1`, `R4-U2`, `R4-U3` | ACCEPTED |
| U4 | no available second shared reviewer; two-reviewer rule not waived | DEFERRED |
| Landing caps | `MAX_CHANGED_PATHS=115`, `MAX_ADDED_LINES=8500` | ACCEPTED for current lock |

The accepted base is a full commit object and the repository is not shallow. `dev-phase2` is its ancestor and omits Run 2's 169 paths / +16,992. Run 3 adds 100 paths / +11,706 / -1,079 after Run 2, including model-training contamination and Run 4 documents. The six Run 4 planning authority files absent from the candidate base have been copied byte-for-byte and count in the cap. This pre-flight tracking packet and later approval updates also count, but are not immutable byte-for-byte promotion material. Current `dev-phase2`, `dev-phase2-run3`, and PR #144 head remain rejected base alternatives.

Measure caps as unique paths and added lines in `RUN4_BASE_SHA..HEAD`; generated/lock/session/tracking/corrections count. Missing base, shallow history, parse, rename, or binary ambiguity fails. All-five coupling is likely 135–155 paths and 8,250–9,000 added lines, hence U0–U3 lock. The 115/8,500 cap includes promoted Run 4 docs/tracking and returns an exceeding unit to pending. A local fixture-backed paper-to-Biotope slice must be separately sized and admitted only if it fits the accepted cap.

## Bootstrap gate before implementation

P1 human approval is recorded. An ADMIN-capable owner must enforce these exact checks; missing/skipped fails. Current WRITE-token classic protection PUT returned 404, so enforcement is blocked and implementation remains gated:

- `Context — sessions / memory / decisions / index / couplings`
- `Flutter — Analyze & Test`
- `TypeScript — Type Check`
- `Node tools — tools/brain-ingest`
- `Node tools — tools/llm-router`
- `Node tools — tools/rules`
- `Node tools — tools/edge-loader`
- `Node tools — tools/engine-stats`
- `Node tools — tools/metric-view`
- `nao — typecheck & test`
- `Deno — compute-baselines`
- `Deno — evaluate-signals`
- `Deno — generate-insights`
- `Migrations — shadow apply (postgres:17)`

U0 then proposes aggregate `Run 4 Gate` with `if: always()` and explicit `needs`, including `run-pipeline`; protection changes only after exact current-SHA proof.

## Pending posture

P2: no available second shared reviewer; the two-reviewer rule is not waived. U4 remains deferred and no shared change may start. P3: model training is paused/excluded; train nothing and the product candidate must not receive MT1–MT5. P7 is complete only as PR #144 closed/superseded.

P5 is accepted as local-only: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `OPENALEX_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and Nao/Biotope public Supabase variables remain name-only. No values are recorded. `apps/nao/.env.public` is hosted-classified; `apps/biotope/.env.public` local-classified. Local Nao must use process-scoped local Supabase URL/anon/service-role values, never file defaults. Android is operator-authorized/unlocked, but adb timed out and connection state is unattested. Hosted Supabase, Cloudflare/R2 writes, deployment, and key mutation/revocation remain forbidden.

P6 defaults to O29 deferred and zero provider calls. Anthropic key presence does not approve a second-family configuration/budget; router remains single-provider OpenAI TEST-MODE.

## Evidence ledger and resume

All material claims are source/Git/GitHub-verified. Graphify was stale/noisy and rejected as evidence. Read-only checks: `context_sync --session-start`, Git status/worktree/ref/diff/ancestry/cat-file checks, GitHub PR/branch/ruleset/PR-list reads, secret-name classification, rejected Graphify query; adb probe timed out. No tests ran.

| Work | Model | State |
| --- | --- | --- |
| GitHub audit | `gpt-5.6-terra` low | evidence collected |
| U0/U1 estimation | `gpt-5.6-terra` medium | candidate |
| U2/U3/U4 assessment | `gpt-5.6-sol` high | candidate |
| Packet writer | `gpt-5.6-terra` medium | draft complete |
| Primary orchestration | `gpt-5.6-sol` max | pending human direction |

Provider spend is 0. RESUME: an ADMIN-capable owner enforces the exact checks on `dev-phase2-run4`; separately size the local fixture-backed paper-to-Biotope slice before admitting it under cap. P2 remains unavailable and P3 remains paused/excluded.
