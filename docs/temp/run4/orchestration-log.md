---
title: Run 4 Pre-Flight Orchestration Log
summary: Resumable Run 4 record for the accepted envelope and qualified local U0 evidence; U0 remains in progress pending exact PR-head Linux CI.
type: plan
scope: run4-preflight
status: draft
updated: 2026-07-28
---

# Run 4 Pre-Flight Orchestration Log

## 2026-07-28 execution update

R4-U0 merged through PR #161 at `66bfde53b0dc388e40af42ab0ff4737ffb2fd8aa`. Exact merge-SHA CI workflow run `30285010079` passed 19/19. Jayden instructed continuous local Run 4 completion on 2026-07-28. R4-U1 is separately owned and integrates only after its main workflow; this record does not claim its implementation or merge.

R4-U5 / pass-2 is admitted and **IN PROGRESS** under issue #167 from its named branch/worktree, based on `66bfde53b0dc388e40af42ab0ff4737ffb2fd8aa`. It is local-only: no provider calls, hosted writes, shared-contract changes, or `/model-training` work. Estimate: 6 paths / about 1,900 additions; the U0+U5 projection is 28 paths / about 3,609 additions against 115 / 8,500 and must be remeasured before merge. Human signoff remains pending.

U5 acceptance chain is: DOI `10.1016/j.isci.2026.116224` -> explicit local-agent synthesis artifact -> deterministic checks -> visible `INTERIM` uncertain/hold verification -> local edge load -> later health/insight/provenance evidence. Canonical paper files are absent locally and must first be locally cached without hosted writes; no acceptance is claimed before that condition and the chain are evidenced.

## Historical pre-flight control state

This section records the original pre-flight state. The later accepted envelope supersedes its product-implementation freeze; U0 is locally authorized and remains in progress. Nothing here is a self-signature.

- Issue #155; claim `run4-preflight-decision-packet` by `codex@agentjwork`.
- Worktree `C:\project\ourobion-run4-preflight-155`; branch `docs/run4-preflight-155`.
- Bootstrap PR #156 targets `dev-phase2-run4`; workflow run `30267437774` self-triggered on CI-enablement commit `f60650838428d871690d6f83358e0fb05387d0bc` and all 14 jobs passed. It may merge there, never `dev-phase2`, as the bootstrap-only authority/tracking-docs plus minimal Run 4 CI branch-filter enablement exception only when all 14 checks are green on the then-current PR head. It remains unmerged/pre-flight-only.
- No hosted writes, provider calls, product edits, settings changes, merges, or PR #144 changes.

## 2026-07-27 human decision and operational blocker

Jayden accepted BRANCH/base, the U0–U3 lock, and the 115-path / 8,500-addition cap for the currently locked envelope. `dev-phase2-run4` was created at exact SHA `854aa471970b61afdc59205ded0b1c8a9ab3f270`. The six Run 4 planning authority files were copied byte-for-byte and count in the cap. The pre-flight tracking packet and later approval updates also count, but are not byte-for-byte authority material.

Historical note (superseded as an operating constraint): the WRITE-token protection probe returned 404 and workflow run `30267437774` passed all 14 jobs on CI-enablement commit `f60650838428d871690d6f83358e0fb05387d0bc`. That run does not test later commits. The current user-approved posture is that `dev-phase2-run4` intentionally remains unprotected; no ADMIN or settings action is requested. U0 is locally authorized, and `Run 4 Gate` is exact-current-SHA CI evidence only. Full-suite and PR-CI evidence remain pending.

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
| Locked units | `R4-U0`, `R4-U1`, `R4-U2`, `R4-U3` | ACCEPTED |
| U4 | no available second shared reviewer; two-reviewer rule not waived | DEFERRED |
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

P2: no available second shared reviewer; the two-reviewer rule is not waived. U4 remains deferred and no shared change may start. P3: model training is paused/excluded; train nothing and the product candidate must not receive MT1–MT5. P7 is complete only as PR #144 closed/superseded.

P5 is accepted as local-only: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `OPENALEX_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and Nao/Biotope public Supabase variables remain name-only. No values are recorded. `apps/nao/.env.public` is hosted-classified; `apps/biotope/.env.public` local-classified. Local Nao must use process-scoped local Supabase URL/anon/service-role values, never file defaults. Android is operator-authorized/unlocked, but adb timed out and connection state is unattested. Hosted Supabase, Cloudflare/R2 writes, deployment, and key mutation/revocation remain forbidden.

P6 defaults to O29 deferred and zero provider calls. Anthropic key presence does not approve a second-family configuration/budget; router remains single-provider OpenAI TEST-MODE.

## U0 local qualification evidence

- Gate tests 9/9, config/workflow validation, four frozen Deno checks, fresh graph plus local-only attestation verification, `context_sync --check`, shared TypeScript, all named package typechecks, and rules/metric drift checks passed.
- Supabase CLI 2.81.2 and Deno 2.8.1 were used for the local release path. A disposable Postgres 17 shadow applied 23/23 migrations and was removed.
- 710 package tests passed: brain-ingest 353, llm-router 71, rules 82, edge-loader 56, engine-stats 49, metric-view 5, and nao 94. Including the gate tests, the total is 719.
- All package-scoped `npm ci` operations succeeded after scoped Windows EPERM escalation. Root `npm ci` is locally blocked because the sandbox cannot replace root `node_modules`; clean root install remains pending Linux CI.
- Flutter is locally blocked, not failed. With Windows Developer Mode off, isolated-worktree `pub get` cannot create plugin symlinks; the analyze dependency cascade is invalid evidence and zero Flutter tests ran. Cache reuse was refused because the other workspace's inputs were not byte-identical. Exact PR-head Linux Flutter analyze/test remain pending.
- Audit notices are recorded without remediation: shared 1 high; brain-ingest 1 moderate, 2 high, 1 critical; nao 6 high.
- The previously recorded four-route local serve probe reached handler-level 401 responses and was stopped. It used no secrets, hosted resources, or provider calls. Hosted parity is explicitly not claimed.

This local result does not complete U0 and does not claim PR CI green.

## Evidence ledger and resume

The historical pre-flight claims were source/Git/GitHub-verified. Current local U0 qualification is recorded above with its environment limits; no hosted or provider operation ran.

| Work | Model | State |
| --- | --- | --- |
| GitHub audit | `gpt-5.6-terra` low | evidence collected |
| U0/U1 estimation | `gpt-5.6-terra` medium | candidate |
| U2/U3/U4 assessment | `gpt-5.6-sol` high | candidate |
| Packet writer | `gpt-5.6-terra` medium | draft complete |
| Primary orchestration | `gpt-5.6-sol` max | pending human direction |

Provider spend is 0. RESUME: obtain clean root install, exact PR-head Linux Flutter analyze/test, and full PR-CI evidence; do not mark U0 complete before those results and review. Separately size the local fixture-backed paper-to-Biotope slice before admitting it under cap. P2 remains unavailable and P3 remains paused/excluded. All Run 4 issue, branch, PR, and merge operations target `dev-phase2-run4` only.
