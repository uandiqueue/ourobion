---
title: Run 4 continuation status
summary: Exact stop-state, open evidence gates, branch heads, and restart order for Run 4.
type: plan
scope: shared
status: active
updated: 2026-07-28
---

# Run 4 continuation status

This is the resume authority for the 2026-07-28 stop. It records execution state, not acceptance.
All work remains local-only and targets `dev-phase2-run4`; there were no hosted writes, deployments,
provider calls, model-training actions, or final-UI integration in this session.

## Branch and PR snapshot

| Work | Exact state | Disposition |
|---|---|---|
| Integration line | `origin/dev-phase2-run4` = `ad8ef178053c7e6514283f19ee7a4f3f0829dc0c` | Contains original U2; not the correction stack |
| U1 + immutable cap correction | draft PR #180, head `2a77533` | Functional/security jobs green; release/cap red by design. Repository-wide secret scan is also red while U3's old `4e02525` remains reachable |
| U2 replacement keys | draft PR #185, source `82b3bd4` | Functional CI green; local runtime attestation pending |
| U2 truthful control audit | draft PR #186, source `cade71f` | Functional CI green, including migration shadow apply and Nao; local Postgres authz execution pending |
| U3 atomic loader | draft PR #184, final external-session head `7676702` | External session reports done; PR remains draft/unstable and cap-blocked. Re-review against #185/#186 remains pending |
| U5 paper authoring | draft PR #176, implementation head `f9bed99` plus this handoff commit | API integrity is green; named-paper insight remains fail-closed |
| Combined correction stack | issue #187, `fix/db/run4-u2-u3-reconciliation`, head `e759ed8` | U2 corrections committed locally; U3 is an interrupted, uncommitted reconciliation patch |

The issue #187 worktree is `C:\project\ourobion-run4-integration-187`. Its exact interrupted state is:

- committed U2 corrections: `b8ceadd` then `e759ed8`;
- U3 commit `4e02525` applied with `--no-commit`, so its leak-bearing commit is not an ancestor;
- `loader/run-pipeline/route.ts` remains `UU` while the sole writer was interrupted;
- U3 migrations are being moved from duplicate versions `20260728030000`-`30003` to unique
  `20260728032000`-`32003` files; both deleted-index and untracked-new paths are present;
- do not abort, stage, commit, or discard this worktree before reviewing the current patch.

The external U3 session later reported completion at `7676702`. It also reported an N1 approach that
sanitises audit detail/target, validates the boundary, and logs swallowed insert failures; a Gap 4
migration that recreates the `insight_cards.status` check with `archived`; and preservation of honest
bucketed confidence badges and labelled gaps. Record these as incoming evidence, not reconciled truth.
In particular, #186 intentionally replaces swallowed audit persistence failure with durable
attempt/outcome semantics. A later reconciliation should preserve U3's storage sanitisation and boundary
validation while keeping #186 fail-closed; it must also run the claimed 443 SQL assertions against the
new `archived` migration. No new reconciliation was started after receiving this report.

## Unit status

| Unit | Status | What remains |
|---|---|---|
| R4-U0 | Complete/merged | Preserve exact merge-SHA evidence |
| R4-U1 | Corrected in draft PR #180 | Clear cross-branch U3 Gitleaks history; cap still fail-closed |
| R4-U2 | Original landed; corrections ready in #185/#186 | Reconcile both corrections with U3, execute local Postgres authz/runtime proof, record a fresh attestation |
| R4-U3 | External implementation complete at `7676702`; integration still NO-GO | Compare the final U3 delta with the interrupted issue #187 patch, then retain raw-truth TOCTOU, atomic audit, replacement-key transport, unique migrations, retry/RLS/concurrency proof |
| R4-U4 | Human implementation approval recorded from Alton and Jayden; cap-pending | Actual shared-contract PR still requires two reviews; no silent cap admission |
| R4-U5 | API integrity green; named-paper insight NO-GO | Current U5 artifact is `uncertain`/`hold`; legitimately advance evidence or retain the negative no-serving result |
| R4-U6a/b/c | Not admitted / cap-deferred | Storage primitives, EASY metrics, then MEDIUM metrics; shared-contract review applies |
| R4-U7 | Externally owned UI, frozen here | Wait for the user to declare the complete final UI head stable, then reconcile data shapes and operation IDs |
| B-PL22 sentence provenance | Planning admitted; implementation cap-deferred | Deterministic sentence/citation trace and negative fixtures remain unimplemented |

## U5 execution evidence at stop

The requested local paper -> relationship -> Biotope data -> insight run executed through the
downstream engine, but the **named-paper insight acceptance did not pass**.

- Canonical authoring run `d3c2020a` still proves the named paper and relationship artifacts reached
  the local database, with one U5 verification at `uncertain` / `hold` and zero U5 servable edges.
- After the user confirmed the U3 session had ended, Supabase was rebound to U5. The old CLI twice
  failed on nonessential Studio/Vector health; the verified disposable Vector orphan was removed, and
  the supported minimal Postgres/Auth/REST/gateway/Edge stack started successfully.
- `scripts/demo-dryrun-run2.ps1 -SkipLiveLlm` reset the local DB and passed **20/20**: 8 rules,
  5 claims / 4 verified edges, 21 simulated health days, 16 baselines, 120 personal signals,
  5 fired patterns, rule and edge cards, provenance, rejection, seeds, gaps, and zero provider spend.
  This is Pass 1 API-integrity evidence; its paper citations are fixtures.
- The exact cached DOI artifact was then resumed with its recorded pair and terms and loaded through
  the hash-bound edge loader. Run `d3c2020a` returned `resumed=true`, one claim, `uncertain` / `hold`,
  `nonServableHold=true`, and local DB-load success.
- A post-load `run-pipeline` returned HTTP 200 with all three stages green. Final local projection:
  16 baseline snapshots, 120 personal signals, 6 insight cards, and 2 composed insights.
- The U5 edge `gut_comfort_score|correlates|mood_score` remained score 0 / `hold`; zero cards cite it.
  The two edge cards cite other fixture edges. This is correct fail-closed behavior, but it means the
  named DOI did not return a Biotope insight.

Exit gate status: **Pass 1 API integrity GREEN (20/20)**; **Pass 2 named-paper insight NO-GO** because
the paper edge is non-servable. Cloud promotion remains forbidden.

## Resume order

1. Confirm no new external session has taken ownership of the shared Supabase/Docker stack. At this
   stop, the minimal stack is mounted from U5, the local DB contains the evidence above, and Nao is stopped.
2. Before resuming issue #187, compare final U3 head `7676702` with its interrupted patch; do not
   blindly continue or discard either. Finish the U3 conflict, migration move,
   TOCTOU correction, atomic audit lifecycle, replacement-key transport, and synthetic-fixture cleanup.
3. Independently review issue #187, then stage/commit only after all conflict markers and old migration
   paths are gone. Run Nao, TypeScript, Deno, Gitleaks, context, and migration-shadow checks.
4. With exclusive local-stack ownership, rebind Supabase to the combined worktree and perform the
   already approved local database reset. Run U2 authz plus U3 RLS/concurrency SQL harnesses.
5. Run real local `functions serve` probes and regenerate deploy attestation only from that execution.
6. Resolve the Pass 2 semantic gate: legitimately produce non-INTERIM evidence that can advance the
   DOI edge, or formally accept the current held-paper/no-paper-insight result. Never force a hold to serve.
7. After integration changes, rerun both the now-green zero-provider API-integrity pass and the exact
   DOI author/load/pipeline/provenance path.
8. After the user declares the full UI head stable, reconcile UI operation IDs/data shapes, run Flutter
   analyze/tests, and perform the Android user flow.
9. Remeasure the immutable product landing delta. Current work cannot merge while the 8,500-addition
   cap is exceeded; reduce/defer scope or explicitly revise the envelope. Never move the base silently.
10. Only after all gates are green, update the Run 4 signoff files and fast-forward the VS Code
    `dev-phase2-run4` worktree to the accepted integration head.

## Decisions still required

- Product cap: reduce/defer the landing or explicitly revise the Run 4 envelope.
- Final UI: user must identify the complete stable external UI head before integration.
- Shared contracts: two actual PR reviewers remain mandatory for U4/U6/shared changes.
- Hosted demo promotion: remains a separate human action after both local exit passes are green.
