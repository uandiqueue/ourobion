---
title: Run 4 Pre-Flight Orchestration Log
summary: Resumable Run 4 record for the accepted envelope; U0 completed through PR #161 with exact merge-SHA CI, while U5 remains in progress.
type: plan
scope: run4-preflight
status: draft
updated: 2026-07-28
---

# Run 4 Pre-Flight Orchestration Log

## 2026-07-28 execution update

R4-U0 merged through PR #161 at `66bfde53b0dc388e40af42ab0ff4737ffb2fd8aa`; exact merge-SHA CI `30285010079` passed 19/19. U1 is complete externally at `baab1536`, but PR #170 remains draft/open and unmerged, CLEAN, with 21/21 checks green.

R4-U5 / pass-2 is admitted and **IN PROGRESS** under issue #167 from its named branch/worktree, based on `66bfde53b0dc388e40af42ab0ff4737ffb2fd8aa`. It is local-only: no provider calls, hosted writes, shared-contract changes, or `/model-training` work. Its pre-plan measurement was 10 paths / +928 / -29; the U0+U5 pre-plan union was 27 / +2,634 / -126. Human signoff remains pending.

U5 canonical DB run `d3c2020a` is complete with one uncertain hold and zero servable edges. Health/insight acceptance remains pending.

## 2026-07-28 U5 local harness evidence — not acceptance

The local-only harness now has the ANSI-safe reset-success check, process-scoped local public
Supabase URL/anon environment for Nao, and redirect suppression so a protected API redirect cannot
masquerade as JSON `200`. The latest pass reached S0–S8 and M1: it loaded 5 claims / 4 verified edges;
the U5 edge remains `uncertain` / `hold`; and demo user `4483fefb-d5e5-49a9-8132-d347ad082b57` received
14 provenance-stamped simulated gut rows plus 14 wearable rows.

M2 is blocked, not a U5 code failure: its `401 Unauthorized` comes from an active local edge-runtime
container mounted from a separately owned U2 worktree, where U2 internal auth rejects the request before
the U5/base route. The compared local service-role keys agree. M2 wrote zero baseline snapshots, signals,
cards, or composed insights. Health/insight proof therefore awaits stable U2 reconciliation; this unit
must not restart or rebind the U2-owned stack. Provider and hosted calls remain zero. U2 has no open PR;
UI PR #175 exists but is deferred until the unit boundary and was neither inspected nor merged.

## U5 sentence-provenance planning update

The B-PL22 extension is planning-admitted inside U5 only. It is not a new pipeline and is
**SPLIT/DEFERRED BY CAP**. Snapshot `f2f2dac` from base `77c982` includes U1 `baab1536` + U5 `cdc16f9`,
excludes MT4 paths/session, and is 38 / +8,002 / -162, leaving 77 / +498. U2/U3 expected additions and
the minimal sentence slice (six touched, two reused, four new, ~+1,900) do not fit and require an
explicit later envelope decision. This correction is outside the snapshot; remeasure before merge.
Persisted/served/UI is P2-blocked. Separately, O29 defers provider/model execution.
If later admitted, deterministic versioned sentence/section/offset/citation/root artifacts and
frozen/mock LlmRouter `INTERIM:` seams must fail closed. Existing quote checks, U5 hold and loader
hash/idempotence remain; A4/A4b/A5/A6/A7/root collapse are not claimed implemented.

## Historical pre-flight control state

This section records the original pre-flight state. At that historical point U0 was locally authorized and in progress; PR #161 and exact merge-SHA CI later completed it. Nothing here is a self-signature.

- Issue #155; claim `run4-preflight-decision-packet` by `codex@agentjwork`.
- Worktree `C:\project\ourobion-run4-preflight-155`; branch `docs/run4-preflight-155`.
- Bootstrap PR #156 targets `dev-phase2-run4`; workflow run `30267437774` self-triggered on CI-enablement commit `f60650838428d871690d6f83358e0fb05387d0bc` and all 14 jobs passed. It may merge there, never `dev-phase2`, as the bootstrap-only authority/tracking-docs plus minimal Run 4 CI branch-filter enablement exception only when all 14 checks are green on the then-current PR head. It remains unmerged/pre-flight-only.
- No hosted writes, provider calls, product edits, settings changes, merges, or PR #144 changes.

## 2026-07-27 human decision and operational blocker

Jayden accepted BRANCH/base, the U0–U3 lock, and the 115-path / 8,500-addition cap for the currently locked envelope. `dev-phase2-run4` was created at exact SHA `854aa471970b61afdc59205ded0b1c8a9ab3f270`. The six Run 4 planning authority files were copied byte-for-byte and count in the cap. The pre-flight tracking packet and later approval updates also count, but are not byte-for-byte authority material.

Historical note (superseded as an operating constraint): the WRITE-token protection probe returned 404 and workflow run `30267437774` passed all 14 jobs on CI-enablement commit `f60650838428d871690d6f83358e0fb05387d0bc`. That run did not test later commits. At that time U0 was locally authorized with full-suite/PR-CI pending. U0 later completed through PR #161 at `66bfde5`; exact merge-SHA CI `30285010079` passed 19/19. `dev-phase2-run4` remains intentionally unprotected.

## Verified live state

On 2026-07-27, PR #144 was **CLOSED**, not merged, at `2026-07-27T08:03:15Z`; base `dev-phase2-run3@9b41f4abc0a52e2c3ebfebb6b6fe6b375709dca3`; head `5eebdddc522d0e5c337573ab8b0224ce35f0313b`; explicit [superseded comment](https://github.com/uandiqueue/ourobion/pull/144#issuecomment-5088805906). Its 15 green checks are stale evidence only. No open PRs exist, so no model-training PR targets product.

| Ref | SHA |
| --- | --- |
| `dev-phase2` | `e185cf03b459285ec950c80d1696a656e8a045c9` |
| `dev-phase2-run2` | `854aa471970b61afdc59205ded0b1c8a9ab3f270` |
| `dev-phase2-run3` | `6869eeadb05c792bf9437bd866f03d06b297ee9d` |

`dev-phase2-run4` now exists at `854aa471970b61afdc59205ded0b1c8a9ab3f270`. The previously observed `dev-phase2` and `dev-phase2-run3` protections were false. One ruleset applies only to `main` and has no required status checks. No Run 4 protection enforcement is recorded.

## Accepted envelope and active constraints

| Field | Value | State |
| --- | --- | --- |
| Integration branch | `dev-phase2-run4` at `854aa471970b61afdc59205ded0b1c8a9ab3f270` | ACCEPTED / intentionally unprotected |
| Historical envelope/bootstrap base | `854aa471970b61afdc59205ded0b1c8a9ab3f270` (`origin/dev-phase2-run2`) | RETAINED FOR PROVENANCE; not an active whole-run gate |
| Earlier U0 unit base | `837b7e690f92dc1669428a2476c9d8d0456020e8` | SUPERSEDED; retained for provenance |
| Active U0 unit base | `77c98213e23ad56ae37c86201b39ef4e7543a543` (consolidated Run 3/MT3 `origin/dev-phase2-run4` tip) | ACCEPTED for U0 only |
| Historical locked units | `R4-U0`, `R4-U1`, `R4-U2`, `R4-U3` | ACCEPTED THEN; U2/U3 NOW CAP-DEFERRED |
| U4 | Alton and Jayden approve implementation; both actual reviews remain required before a shared-contract PR merge | IMPLEMENTATION UNBLOCKED; cap admission separate; no U6 authority |
| U0 landing caps | `MAX_CHANGED_PATHS=115`, `MAX_ADDED_LINES=8500` | ACCEPTED for `RUN4_UNIT_BASE_SHA..HEAD` only |

The accepted base is a full commit object and the repository is not shallow. `dev-phase2` is its ancestor and omits Run 2's 169 paths / +16,992. Run 3 adds 100 paths / +11,706 / -1,079 after Run 2, including model-training contamination and Run 4 documents. The six Run 4 planning authority files absent from the candidate base have been copied byte-for-byte and count in the cap. This pre-flight tracking packet and later approval updates also count, but are not immutable byte-for-byte promotion material. Current `dev-phase2`, `dev-phase2-run3`, and PR #144 head remain rejected base alternatives.

U0 reconciliation: Run 3 and completed MT3 history were consolidated through exact `dev-phase2-run4` tip `77c98213e23ad56ae37c86201b39ef4e7543a543`. U0's active fail-closed gate measures only unique paths and added lines in `RUN4_UNIT_BASE_SHA..HEAD` from that exact unit base. Generated/lock/session/tracking/corrections still count; missing base, shallow history, parse, rename, or binary ambiguity still fails. This does not redefine the historical `854aa471970b61afdc59205ded0b1c8a9ab3f270` envelope or erase the earlier `837b7e690f92dc1669428a2476c9d8d0456020e8` unit-base record. The separately owned model-training files were not edited; their `model-training-core` and `model-training-lint-type` jobs are now mandatory aggregate dependencies. The 115/8,500 cap returns an exceeding U0 landing to pending.

## CI evidence posture

P1 is an accepted user override: no branch protection or ADMIN/settings action is requested. Missing or skipped checks fail the local/CI evidence gate, which must be evaluated on the exact current SHA:

- `Run 4 release evidence`
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
- `Deno — run-pipeline`
- `Migrations — shadow apply (postgres:17)`
- `model-training — core (stdlib only, zero installs)`
- `model-training — lint / format / type-check`
- `Run 4 Gate`

U0 provides aggregate `Run 4 Gate` evidence with `if: always()` and explicit `needs`, including `run-pipeline`. It does not configure or imply branch protection; a base advance, workflow edit, or different head invalidates older evidence.

## Pending posture

P2 reviewer availability is resolved for U4 implementation only: Alton and Jayden approve it, while both actual reviews remain mandatory before any U4 shared-contract PR merge. U4 cap admission is separate and no U6 authority follows. Other P2-blocked shared/persisted/served scopes remain blocked. P3: model training is paused/excluded; train nothing and the product candidate must not receive MT1–MT5. P7 is complete only as PR #144 closed/superseded.

P5 is accepted as local-only: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `OPENALEX_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and Nao/Biotope public Supabase variables remain name-only. No values are recorded. `apps/nao/.env.public` is hosted-classified; `apps/biotope/.env.public` local-classified. Local Nao must use process-scoped local Supabase URL/anon/service-role values, never file defaults. Android is operator-authorized/unlocked, but adb timed out and connection state is unattested. Hosted Supabase, Cloudflare/R2 writes, deployment, and key mutation/revocation remain forbidden.

P6 defaults to O29 deferred and zero provider calls. Anthropic key presence does not approve a second-family configuration/budget; router remains single-provider OpenAI TEST-MODE.

## Historical U0 local qualification evidence

- Gate tests 9/9, config/workflow validation, four frozen Deno checks, fresh graph plus local-only attestation verification, `context_sync --check`, shared TypeScript, all named package typechecks, and rules/metric drift checks passed.
- Supabase CLI 2.81.2 and Deno 2.8.1 were used for the local release path. A disposable Postgres 17 shadow applied 23/23 migrations and was removed.
- 710 package tests passed: brain-ingest 353, llm-router 71, rules 82, edge-loader 56, engine-stats 49, metric-view 5, and nao 94. Including the gate tests, the total is 719.
- All package-scoped `npm ci` operations succeeded after scoped Windows EPERM escalation. Root `npm ci` is locally blocked because the sandbox cannot replace root `node_modules`; clean root install remains pending Linux CI.
- Flutter is locally blocked, not failed. With Windows Developer Mode off, isolated-worktree `pub get` cannot create plugin symlinks; the analyze dependency cascade is invalid evidence and zero Flutter tests ran. Cache reuse was refused because the other workspace's inputs were not byte-identical. Exact PR-head Linux Flutter analyze/test remain pending.
- Audit notices are recorded without remediation: shared 1 high; brain-ingest 1 moderate, 2 high, 1 critical; nao 6 high.
- The previously recorded four-route local serve probe reached handler-level 401 responses and was stopped. It used no secrets, hosted resources, or provider calls. Hosted parity is explicitly not claimed.

This local result did not complete U0 at that time. Later PR #161 merge evidence and exact merge-SHA CI 19/19 completed U0.

## Evidence ledger and resume

The historical pre-flight claims were source/Git/GitHub-verified. Historical local U0 qualification is recorded above with its then-current environment limits; no hosted or provider operation ran.

| Work | Model | State |
| --- | --- | --- |
| GitHub audit | `gpt-5.6-terra` low | evidence collected |
| U0/U1 estimation | `gpt-5.6-terra` medium | candidate |
| U2/U3/U4 assessment | `gpt-5.6-sol` high | candidate |
| Packet writer | `gpt-5.6-terra` medium | draft complete |
| Primary orchestration | `gpt-5.6-sol` max | pending human direction |

Provider spend is 0. RESUME: U1 is complete externally but PR #170 remains draft/unmerged; U2/U3 and sentence implementation are cap-deferred. U5 canonical DB run is complete; obtain health/insight evidence next. U4 implementation is unblocked under the named-reviewer constraint, while its cap admission remains separate; O29 is deferred and P3 paused/excluded. All Run 4 integration targets `dev-phase2-run4` only.
