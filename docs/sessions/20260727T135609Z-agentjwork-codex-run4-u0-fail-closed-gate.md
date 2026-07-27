---
title: Rebuild Run 4 U0 fail-closed release gate
summary: Recorded qualified local U0 evidence: 719 package/gate tests and the local release checks passed, while root clean-install, Flutter, and exact PR-head Linux CI remain pending or environment-blocked.
type: session
scope: shared
status: canonical
updated: 2026-07-27
---

# Rebuild Run 4 U0 fail-closed release gate

Issue: #157
Branch: `ci/run4-u0-fail-closed-gate` targeting `dev-phase2-run4`

## Attempted

Rebuilt O24 and O31-O34 from current source without merging or cherry-picking PR #144, then reconciled the active Run 4 records to the accepted U0 authorization and exact-current-SHA CI-evidence posture.

## Changed

- Added a Node-stdlib release gate for immutable-base landing caps and TOML-aware configured-function/CI-matrix validation.
- Added fixtures covering quoted/dotted/trailing-comment, duplicate, missing, disabled/no-op, extra, and exact-entrypoint failures.
- Wired exact Deno 2.8.1, frozen per-function lock configuration, run-pipeline matrix coverage, and an `if: always()` aggregate CI evidence job.
- Made deploy reproducibility explicitly fail closed until a non-hosted Supabase CLI serve/bundle attestation with matching config/lock/module-graph hashes exists.
- Updated Run 4 tracking so `dev-phase2-run4` is intentionally unprotected by user override; CI evidence is not claimed as branch protection.
- Removed active wording that froze U0/product work pending branch protection, while retaining clearly labelled historical audit evidence.

## Local qualification evidence

- Release gate tests passed 9/9; config/workflow validation passed.
- All four frozen Deno checks passed with project-local Deno 2.8.1.
- Fresh graph generation and local-only attestation verification passed with Supabase CLI 2.81.2 and Deno 2.8.1. Hosted parity is not claimed.
- A disposable Postgres 17 shadow applied all 23 migrations and was removed.
- `context_sync --check`, shared TypeScript compilation, all named package typechecks, and the rules/metric drift checks passed.
- Package tests passed: brain-ingest 353, llm-router 71, rules 82, edge-loader 56, engine-stats 49, metric-view 5, and nao 94. That is 710 package tests, or 719 including the 9 release-gate tests.
- Every package-scoped `npm ci` succeeded after scoped escalation for Windows EPERM. Root `npm ci` remained locally blocked because the sandbox could not replace root `node_modules`; a clean root install is pending Linux CI.
- Flutter was locally blocked, not failed: isolated-worktree `pub get` could not create plugin symlinks because Windows Developer Mode is off. The resulting analyze dependency cascade is invalid evidence and zero Flutter tests ran. Reusing another workspace's cache was refused because its inputs were not byte-identical. Exact PR-head Linux Flutter analyze/test remain pending.
- Existing audit notices were recorded without remediation: shared 1 high; brain-ingest 1 moderate, 2 high, 1 critical; nao 6 high.
- The earlier four-route local serve probe reached handler-level 401 responses; the server was stopped. It used no secrets, hosted resources, or provider calls and does not establish hosted parity.

## Decided

The fresh graph and local-only attestation verification support the pinned local path, but do not establish hosted deploy parity. Keep hosted parity fail-closed and unclaimed.

`dev-phase2-run4` intentionally remains unprotected; no ADMIN or settings action is requested. `Run 4 Gate` is exact-current-SHA CI evidence only. P2 remains unwaived and defers U4; P3 excludes training; O29 remains deferred with zero provider calls.

After the separately owned model-training session landed on `dev-phase2-run4`, its exact tip
`837b7e690f92dc1669428a2476c9d8d0456020e8` became the active U0 unit base. The original
`854aa471970b61afdc59205ded0b1c8a9ab3f270` remains recorded only as Run 4 envelope/bootstrap
provenance. The gate uses `RUN4_UNIT_BASE_SHA` so the already-landed separate-session delta is not
misrepresented as U0 work; it retains the same 115-path / 8,500-added-line cap and all fail-closed
path, rename, binary, and provenance checks.

The first reconciled PR CI run rejected the stale `baseSha` field in the tracked local-only deployment
attestation, as intended. The artifact provenance was corrected to the exact `unitBaseSha`; this is
the attestation schema emitted by the renamed gate and leaves its source, graph, route, and local-only
evidence unchanged.

## Left

- Run a clean root install plus exact PR-head Linux Flutter analyze/test and full PR CI.
- Human review, PR, and merge remain pending; U0 is not complete.

## Blockers

Root `npm ci` is locally blocked because the sandbox cannot replace root `node_modules`. Flutter is locally blocked because Windows Developer Mode is off and the isolated worktree cannot create plugin symlinks. These are environment blocks, not test failures. Exact PR-head Linux clean-install, Flutter, and PR-CI evidence remain pending and are not claimed green. No hosted or provider operation was performed.

memory: none
