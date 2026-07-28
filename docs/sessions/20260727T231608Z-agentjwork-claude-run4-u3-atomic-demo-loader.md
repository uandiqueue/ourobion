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

## Corrected after independent review — a real defect, not just a cap

An earlier revision of this record claimed the unit "never overwrites real rows" and that the only
blocker was "integration only … by measurement rather than defect". **Both were false when written.**
The independent database/concurrency review returned **NO-GO** and falsified the central raw-truth
guarantee empirically:

- **F1 (HIGH).** The provenance scan was a plain `SELECT` at READ COMMITTED and **neither
  `ON CONFLICT … DO UPDATE` carried a `WHERE`**. The advisory lock serialises loader callers but cannot
  exclude the target's own RLS-governed PostgREST writes, which take no lock. A concurrent real insert
  (`data_origin IS NULL`) was invisible to the scan; the loader's insert blocked on the unique index and
  then took the **update** branch, returning `ok: true` with no `OU409` — silently replacing real
  self-reported health data and re-stamping it simulated. Neither the row-count guard nor `residueDates`
  could observe the loss.
  **Why 184 assertions missed it:** every conflict test created its real row *before* the apply call, so
  the scan always saw it. The defect only appears when a writer commits *between* scan and write.
  **Fixed at write time, not scan time:** both upserts now carry a `WHERE` requiring the *existing* row's
  provenance to be a registered, non-revoked, `is_simulated` origin; the written count comes from a
  data-modifying CTE (`returning 1`), not `get diagnostics`, which cannot distinguish the update branch;
  a shortfall re-scans and raises `OU409`. Proven by a two-process probe that is **not** a sleep race —
  the racing transaction commits only after observing an ungranted lock held by another backend, so the
  loader is provably past the pre-scan. Non-vacuity proven by injecting the pre-fix migration and
  reproducing the original failure.
- **F2** the release RPC had no lease check and deleted raw truth under an in-flight pipeline — fixed.
- **F3** `nao_loader_status()` was target-scoped, so `mixed` was unreachable in the very case it was
  built for and the returned `requestKey` was another run's — now run-scoped.
- **F4** the only CI-visible fold-drift test compared TypeScript against a SQL `--` **comment**; changing
  `then 4` to `then 2` left it green. It now parses the executable `greatest()`, verified by making that
  exact change fail.
- **F5** stage rows were last-write-wins despite the worst-wins claim, and the test meant to catch it
  re-recorded a *different* stage — both fixed.
- Also: `origin` accepted `seed:baseline` (now `loader_writable`-gated), `40001`/`40P01` returned 500
  instead of a retryable 503, the registry drift test hardcoded 3 markers against 4 seeded, and the
  relay's watermark path was dead code — now wired.

**F6, F8, F12–F15 remain unfixed** and are recorded in the review. F6 (residue anchored to the latest
run rather than the writing run) is less consequential now that the F1 overwrite cannot happen.

After remediation: **223/223** U3 assertions (was 184; none removed or weakened), **443/443** U2
regression with `post/pc` 48/48, **261** nao tests, **41** verifier tests, `attest` PASS, `config` PASS,
NUL byte intact. `supabase/functions/**` and `deploy-attestation.json` were not touched by the fix.

## Blockers

Two, and they are different in kind:

1. **`CAP-BLOCKED` (measurement).** The landing delta already exceeded the cap before remediation and the
   fix adds roughly 1,178 more lines (~480 of them proofs), so the overshoot grows. Nothing was trimmed.
2. **The unit shipped a real data-integrity defect that its own test suite could not see** (F1). It is
   fixed and independently re-reviewed, but the lesson belongs in the record: a suite can be large,
   fault-injected and still blind, when every one of its fixtures establishes state in the order the
   code expects rather than the order an adversary would choose.

memory: none
