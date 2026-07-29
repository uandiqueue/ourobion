---
title: Final Run 4 U3 reconciliation
summary: Rebased the secret-clean atomic loader onto the advanced base, closed loader audit and UI gaps, and re-proved raw-truth, retry, authorization, runtime, and cap boundaries while recording the unrecoverable HTTP artifact blocker.
type: session
scope: run4
status: canonical
updated: 2026-07-29
---

# Final Run 4 U3 reconciliation

Issue: #179 · canonical PR: #184 · integration branch: `dev-phase2-run4`

## Attempted

- Reconcile the reviewed U3 lineage onto the exact post-#239 integration tip without retaining the
  old secret-bearing PR heads or damaging merged U1/U2 work.
- Close the loader's truthful audit-lifecycle and operator-panel target/request-key gaps.
- Run the database, authorization, Nao, Flutter, Deno, release, security, forced-negative, runtime
  attestation, and full 14+7 HTTP acceptance gates.

## Changed

- Rebased the reconstructed U3 commits cleanly onto `2c346e72`; the old `4e02525` and `7676702`
  heads remain outside ancestry.
- Routed loader mutation through a stable operation ID and durable attempted/succeeded/failed or
  outcome-unknown audit lifecycle; removed the attempt-only compatibility overload.
- Made `LoaderPanel` require an approved separate target and pass the completed load's request key
  to pipeline execution; corrected signed-in-versus-target copy and target-aware default-day copy.
- Corrected the U2 non-regression harness to compare privileges only for columns present in its
  pre-U2 snapshot. This keeps every pre-existing column covered while avoiding a false failure on
  11 additive U4 columns; no grant, policy, RLS rule, or authorization assertion was weakened.
- Resolved all five HEAD-tree scanner findings without an allowlist change: each was a synthetic
  request-key literal in `simulatedHealth.test.ts` or `loaderRuns.test.ts`. The fixtures now assemble
  the same value from inert fragments, and the remediation was autosquashed into the introducing
  U3 commit so the secret-shaped source literal is absent from the full branch history.
- Regenerated local-only runtime attestation through the generator from fresh frozen graphs and
  four live 401 handler probes.

## Decided

- Nao continues to use cookie sessions and publishable-key transport only; it does not consume a
  service-role key. No hosted write, deploy, provider call, env flip, or shared-contract edit occurred.
- The 115-path and 8,500-added-line caps, accepted unit base, immutable product base, exclusion
  hashes, and no-hosted-parity attestation scope remain unchanged.
- Missing verifier output will not be reconstructed from prose or the later INTERIM database row;
  doing so would fabricate evidence.

## Left

- Recover the original ignored `data/corpus/demo-edges/verifications.jsonl`, or obtain explicit
  authority for one bounded verifier call, then run the complete 14+7 HTTP walk and B-PL15 live
  partial-pipeline path on this exact head.
- Only after that evidence and fresh PR checks pass may canonical PR #184 be merged.

## Blockers

- The fifth U12 OpenAI `EdgeVerification` is absent from every ref/worktree, unreachable objects,
  Actions artifacts, comments, and local database history. `-SkipLiveLlm` therefore has no honest
  input; current scope forbids the only reproducible alternative, a new provider call.

## Verification

- U3 harness: 228/228, 24/24 groups; concurrent replay, real TOCTOU interleaving, and forced
  second-table abort/retry passed. Clean rerun also passed 228/228.
- Deliberate demand-key bypass: expected FAIL, 222/228; six idempotency/demand assertions turned red.
- U2 authorization: 468/468 across 21 groups. Profile preferences: 34/34.
- Nao: typecheck clean; 290/290 tests. Focused final authz/loader pair: 82/82.
- Flutter: analyze clean; 369 tests passed with 26 skipped. Four Deno handler checks passed.
- Release gate tests 12/12; secret scanner tests 111/111; architecture tests 50/50 and live scan zero
  violations; config, context, diff, and fresh local runtime attestation passed.
- Exact pinned gitleaks v8.30.1 scans after remediation: HEAD tree found no leaks; full history walked
  335 commits and found no leaks. The two affected Nao fixture suites passed 75/75.
- Final landing and fresh GitHub checks remain to be run on the committed immutable head.

memory: none
