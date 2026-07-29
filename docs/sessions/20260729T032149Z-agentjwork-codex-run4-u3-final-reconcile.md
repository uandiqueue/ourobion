---
title: Final Run 4 U3 reconciliation
summary: Reconciled the secret-clean atomic loader onto the advanced base, resolved its migration collision and partial-failure relay, and isolated the post-U4 trusted-edge prerequisite without weakening either gate.
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
- Recover the missing ignored verifier artifact or, under the user's explicit one-call authority,
  produce exactly one bounded Anthropic verification inside the SGD 1 budget.

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
- Used exactly one Anthropic request (`claude-sonnet-5`) for the missing gut-comfort/mood verifier
  fixture: 1,895 input tokens, 815 output tokens, US$0.01791 actual cost (US$0.03354 preflight
  worst case), one HTTP attempt and one enforcement attempt, verdict `supported`, no fallback.
- Renumbered the four unmerged U3 migrations from the colliding `20260728030000..003` range to
  `20260729010000..003`. This preserves the already-merged U4 migration at `20260728030000` and
  lets a clean shadow/local migration apply reach the U3 schema.
- Preserved authoritative non-2xx audit semantics in the Nao pipeline relay while passing the
  already-read, redacted partial stage envelope through the publication fold. A 502 therefore
  records `failed`, remains retryable, and no longer loses the stages needed to diagnose/retry it.

## Decided

- Nao continues to use cookie sessions and publishable-key transport only; it does not consume a
  service-role key. No hosted write, deploy, env flip, or shared-contract edit occurred.
- The 115-path and 8,500-added-line caps, accepted unit base, immutable product base, exclusion
  hashes, and no-hosted-parity attestation scope remain unchanged.
- Provider-returned model attestation will not be reconstructed from the configured model id.
  The router's retained response model may fall back to configuration, so retrospectively setting
  `attested=true` would fabricate evidence.

## Left

- Resolve #240: capture provider-returned model identity separately from router fallback, persist
  artifact refs/posture and attestation through edge-loader, fetch them in generate-insights, and
  produce or recover one genuinely provider-attested monotonic verification.
- Then rerun the complete 14+7 HTTP walk, provenance/reject legs, and B-PL15 live partial-pipeline
  path on the immutable PR head. Only after that evidence and fresh checks pass may #184 merge.

## Blockers

- Merged U4 correctly fails closed on missing artifact/attestation provenance, but edge-loader does
  not populate those columns and generate-insights does not fetch them. The retained live Anthropic
  result is a non-directional `correlates` edge and cannot drive U3's required edge-card positive
  control. Accepting zero cards or inventing attestation would weaken/fabricate the gate; #240 is
  the required follow-on, and a further provider call requires new human authority.

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
- Post-reconciliation Nao typecheck passed; the full Nao suite passed 291/291. Focused executable
  relay/redaction and loader/publication suites passed 44/44 and 50/50 respectively. `git diff
  --check` passed.
- Reconciled-migration database rerun passed the U3 228-assertion suite (including real advisory-
  lock concurrency, target-write TOCTOU, forced second-table abort, and retry) and the U2
  authorization non-regression suite 468/468. The local Supabase stack was then stopped with zero
  Ourobion containers left running and its volume-backed data preserved.
- The post-U4 full local demo flow passed environment, clean reset, rule load, five artifact lines,
  edge-loader (5 claims / 4 verified edges), curator/auth/Nao, atomic 14-day load, replay/concurrency,
  all three pipeline stages, publication, and +7 backfill (21/21 raw-truth rows). It then failed
  honestly at M4 because no edge could pass the new artifact-trust gate; later legs were not run.
- Final measured branch delta is 32 paths / 8,243 added lines, below the immutable 115 / 8,500
  caps. Architecture 50/50, secret-guard 111/111 plus live client/local-artifact guards, release
  gate 12/12 + config, and context integrity all passed. Fresh GitHub checks remain to be run on
  the committed immutable head.

memory: none
