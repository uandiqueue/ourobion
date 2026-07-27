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
- Pre-flight PR #156 targets `dev-phase2`; it remains unmerged and pre-flight-only.
- No hosted writes, provider calls, product edits, settings changes, merges, or PR #144 changes.

## Verified live state

On 2026-07-27, PR #144 was **CLOSED**, not merged, at `2026-07-27T08:03:15Z`; base `dev-phase2-run3@9b41f4abc0a52e2c3ebfebb6b6fe6b375709dca3`; head `5eebdddc522d0e5c337573ab8b0224ce35f0313b`; explicit [superseded comment](https://github.com/uandiqueue/ourobion/pull/144#issuecomment-5088805906). Its 15 green checks are stale evidence only. No open PRs exist, so no model-training PR targets product.

| Ref | SHA |
| --- | --- |
| `dev-phase2` | `e185cf03b459285ec950c80d1696a656e8a045c9` |
| `dev-phase2-run2` | `854aa471970b61afdc59205ded0b1c8a9ab3f270` |
| `dev-phase2-run3` | `6869eeadb05c792bf9437bd866f03d06b297ee9d` |

No `dev-phase2-run4` branch exists. `dev-phase2` and `dev-phase2-run3` are protected: false. One ruleset applies only to `main` and has no required status checks.

## Candidate envelope

| Field | Value | State |
| --- | --- | --- |
| Integration branch | `dev-phase2-run4` — do not create in pre-flight | CANDIDATE / PENDING P1 |
| Immutable base | `854aa471970b61afdc59205ded0b1c8a9ab3f270` (`origin/dev-phase2-run2`) | CANDIDATE / PENDING human acceptance |
| Locked units | `R4-U0`, `R4-U1`, `R4-U2`, `R4-U3` | CANDIDATE / PENDING human acceptance |
| U4 | until P2 and later cap approval | DEFERRED |
| Landing caps | `MAX_CHANGED_PATHS=115`, `MAX_ADDED_LINES=8500` | CANDIDATE / PENDING human acceptance |

The candidate base is a full commit object and the repository is not shallow. `dev-phase2` is its ancestor and omits Run 2's 169 paths / +16,992. Run 3 adds 100 paths / +11,706 / -1,079 after Run 2, including model-training contamination and Run 4 documents. The six Run 4 planning authority files absent from the candidate base must later be promoted byte-for-byte and count in the cap. This pre-flight tracking packet and later approval updates also count, but are not immutable byte-for-byte promotion material. Current `dev-phase2`, `dev-phase2-run3`, and PR #144 head are rejected base alternatives.

Measure caps as unique paths and added lines in `RUN4_BASE_SHA..HEAD`; generated/lock/session/tracking/corrections count. Missing base, shallow history, parse, rename, or binary ambiguity fails. All-five coupling is likely 135–155 paths and 8,250–9,000 added lines, hence U0–U3 lock. The 115/8,500 cap includes promoted Run 4 docs/tracking and returns an exceeding unit to pending.

## Bootstrap gate before implementation

P1 owner must create/protect the candidate branch and require these exact checks; missing/skipped fails:

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

P2: Alton is a documented candidate second reviewer, but handle/availability are unrecorded; no shared change may start. P3: no open model PRs; exact separate model-training target is human-owned and the product candidate must not receive MT1–MT5. P7 is complete only as PR #144 closed/superseded.

P5 name-only local posture: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `OPENALEX_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and Nao/Biotope public Supabase variables. No values are recorded. `apps/nao/.env.public` is hosted-classified; `apps/biotope/.env.public` local-classified. Local Nao must use process-scoped local Supabase URL/anon/service-role values, never file defaults. Android is operator-authorized/unlocked, but adb timed out and connection state is unattested. Hosted Supabase, Cloudflare/R2 writes, deployment, and key mutation/revocation remain forbidden.

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

Provider spend is 0. RESUME: Jayden accepts/edits branch/base/caps/check set/locked list, names P2 reviewer, and selects P3 target.
