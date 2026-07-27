---
title: "Run 4 U3 — atomic demo loader, raw-truth and retry safety (O26)"
summary: "An authorized nao developer can populate a separate registered Biotope test identity atomically, idempotently and single-flight, with explicit simulation provenance that refuses to overwrite real rows; integration is CAP-BLOCKED at 13,431 of 8,500 added lines."
type: session
scope: shared
status: canonical
updated: 2026-07-28
---

# Run 4 U3 — atomic demo loader, raw-truth and retry safety (O26)

Issue #179. Unit base `ad8ef178053c7e6514283f19ee7a4f3f0829dc0c` — the **verified U2 merge commit**, whose
exact merge-SHA suite was 19/19 green before this unit began. Branch
`feat/db/run4-u3-atomic-demo-loader` in an isolated worktree; U1 deliberately absent (not stacked).

## Attempted

Implement R4-U3 only: an authorized nao developer populates a **separate** local Biotope test user with
simulated health data and runs the local insight pipeline safely — atomic, idempotent, single-flight,
fail-closed, with explicit simulation provenance that never overwrites real rows.

## Changed

19 paths / 6,332 added lines. Migrations 1,347 · new/changed app code 1,333 · tests 2,589 ·
acceptance script 392 · attestation 2 · session record.

- **Migrations** `20260728030000..030003`: `nao_simulation_origins` + `nao_demo_targets`;
  `nao_loader_runs` / `nao_loader_run_stages` + `nao_loader_assert_target` / `nao_loader_watermark` /
  `nao_loader_plan_inputs` / `nao_loader_status`; the atomic
  `nao_loader_apply_simulated_days` RPC plus `nao_loader_release_simulated_days` and
  `nao_loader_record_pipeline`; `gap_demand_applications` + `record_gap_events_keyed`.
- **App** `apps/nao/src/lib/loaderRuns.ts` (new, pure: request-key derivation, worst-wins status fold,
  retry planning, plan/watermark parsing, response building), `simulatedHealth.ts` (registered origins,
  explicit target/requestKey/origin validation), and both loader route handlers rewritten to call the
  single atomic RPC.
- **Pipeline** `generate-insights/index.ts` — the only edge-function change: the unkeyed
  `record_gap_events` call replaced with `record_gap_events_keyed`.
- **Tests** `supabase/tests/u3/**` (184-assertion disposable-Postgres harness incl. real parallel-psql
  concurrency children) and `apps/nao/tests/**` (255 total).
- **Acceptance** `scripts/demo-dryrun-run2.ps1` extended with curator provisioning and steps M1–M7.
- `supabase/deploy-attestation.json` re-recorded (2 lines).

## Decided

- **U2 is preserved by using a path its assertions do not cover, not by weakening them.** `post/pc`
  (8 assertions × 6 invocations = 48) tests *direct table access* as `authenticated`. A
  `security definer` RPC is a distinct path, so direct writes stay denied and `post/pc` passes verbatim.
  The RPC's first statement is U2's own `nao_authorize('curator')` — no parallel authorization concept
  was invented. Verified: **U2's 443/443 still pass with U3's migrations applied** (re-run independently
  by the orchestrator, not only by the builder).
- **Four constraints were discovered by reading U2's harness, not from any document.**
  `supabase/tests/authz/run.mjs:120-132,187-198` applies later-sorting migrations in phase 3 *before*
  `60_assertions.sql`, which makes U2's suite a **live regression suite over U3's schema**. Therefore:
  no column may be added to any pre-U2 table (`70_non_regression.sql:102-121` diffs column privileges);
  no policy may be added anywhere in `public` (`:89-96` pins RESTRICTIVE = 10 and new-PERMISSIVE = 3
  globally); **a CHECK on `data_origin`/`source` is impossible** (it breaks `pb.insert_own_gut_row`,
  `pa.insert_own_gut_row` and `nonreg.pb_probe_identical_pre_and_post`); and no trigger may exist on
  either truth table. Run identity, watermarks and demand keys therefore live in **new tables only**,
  RLS-enabled with **zero policies** plus explicit `revoke all` — the revoke is required because
  `10_supabase_shim.sql:91-93` reproduces Supabase's `alter default privileges … grant all`.
- **Provenance uses a registry, not a CHECK** — settled by proof rather than preference (above). The
  existing `'simulated:run2-demo'` and `'seed:baseline'` values are preserved and still round-trip.
- **Atomicity comes from PostgREST's one-transaction-per-request shape**: advisory lock → run row →
  provenance scan → **both** upserts → completion, all in one transaction. A failure leaves no rows and
  no run row, so "partially applied" is unrepresentable.
- **Single-flight = unique `request_key` AND `pg_advisory_xact_lock`.** The lock guarantees the second
  caller observes a *committed* row and returns the identical result — never a `running` state.
- **The demand key is derived from INPUTS, not emitted events** —
  `sha256("gi.v1" | day | digest(ruleRows, baselines, personalRows, edges, seriesRows))`. That is what
  makes a replay non-additive while a genuinely new run still increments `gap_ledger.demand`, which is
  deliberately additive by design (A1).
- **Status is a derived worst-wins fold with no stored column**, so conflicting stage statuses cannot
  collapse via last-write-wins. Two independent derivations (a SQL severity table and the TS fold) are
  combined worst-wins, and a drift test reads the migration's own table so they cannot diverge.
- **No new nao route file and no per-user pipeline scoping.** `authz.test.ts:537` pins
  `mutating.length === 8`; per-user scoping is an O12 locked out-of-scope decision
  (`run-pipeline/index.ts:21-24`).
- **The self-write path is retired.** Requirement 2 demands an explicit target distinct from the
  developer, so the route must never fall back to `gate.userId`.

## Left

- **INTEGRATION IS `CAP-BLOCKED`.** Measured mechanically: **62 paths / 13,431 added lines** from the
  gate's constant base against a **115 / 8,500** cap — paths fit, added lines exceed by **4,931**.
  `Run 4 release evidence` will therefore fail on this PR with `landing delta has 13431 added lines`;
  that failure **is** the cap marker, not a defect. Nothing was trimmed to fit and the reserved
  workflow was not touched. Note the run's own `unit-signoff-index.md` already recorded that the
  all-five union was "likely 135–155 paths and 8,250–9,000 lines" against this cap — the shortfall was
  anticipated at preflight. The overshoot is dominated by proofs, not features: the U3 harness alone is
  1,980 lines and the nao tests 1,191.
- **The end-to-end local acceptance sequence was NOT executed.** `scripts/demo-dryrun-run2.ps1` parses
  cleanly and every assertion was written against the migrations as they now stand, but running it
  needs a Next dev server and an LLM step; live provider calls are forbidden in this run. The
  equivalent raw-truth invariants (atomicity, conflict refusal without mutation, replay, concurrency,
  sparse/mismatched ranges, demand identity) **are** proven at SQL level by the 184-assertion harness.
  What remains unproven is the HTTP layer and the full 14 → pipeline → +7 → rerun → 21-day walk.
- **`LoaderPanel.tsx` now receives 400** from its "Load simulated days" button — it POSTs without the
  now-required `target`. `apps/nao/src/components/**` is outside U3's scope, so this is reported, not
  fixed; the field belongs to whichever unit owns nao components.
- **Simulation residue is detected and repaired, never prevented.** A Biotope write over a simulated
  date leaves a stale marker. All three prevention routes are closed: a CHECK breaks U2's assertions, a
  trigger breaks them too (and would hide a mutation of truth), and the Biotope writer is a forbidden
  path. The permanent fix belongs to a unit owning that writer.
- **The strongest proofs have no CI venue.** Nothing in `ci.yml` invokes a Docker harness and `ci.yml`
  is reserved, so the authorization, conflict, rollback, idempotency and concurrency assertions are
  recorded local evidence only. A future regression in the RPC would not be caught by a PR. One
  `node supabase/tests/u3/run.mjs` step is the whole integration — **reported, not taken**.
- **A self-reported test weakness worth keeping:** the five "one fixed denial message" probes are not
  independent of the lease refusal, which emits the same string. The shipped behaviour is correct
  (the message genuinely is uniform across all six denial reasons), but those probes are weaker than
  their names suggest; the paired `expect_error` twins and the "no truth row for any rejected target"
  assertion are what actually caught the injected fault.
- Not proven: `42501→403`, `OU409→409` and `23514→400` are PostgREST behaviour, untested here;
  `OU409` is not a PostgREST-known SQLSTATE, so a *direct* PostgREST caller sees 500 while the nao route
  maps it. `service_role` BYPASSRLS is not reproduced by the harness stub. Route handlers remain
  un-importable under `node --test` (the U2-documented `next/headers` resolution failure), so route
  wiring is proven by source-conformance plus `tsc`, not execution.

## Blockers

Integration only, and by measurement rather than defect: the landing cap. The unit itself is complete
and its evidence is recorded. `attest` PASS, `config` PASS, and the deliberate NUL byte in
`compute-baselines/index.ts` remains intact (exactly one, line 171).

memory: none
