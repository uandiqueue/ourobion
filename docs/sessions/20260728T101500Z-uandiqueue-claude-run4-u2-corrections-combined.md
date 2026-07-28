---
title: "Run 4 U2 corrections — one reconciled correction path"
summary: "Combined the replacement-key correction and the truthful-control-audit correction onto the current integration tip as one canonical PR, resolving the run-pipeline overlap, the migration-ordering hazard, and a CRLF bug that had disabled a source-conformance assertion."
type: session
scope: shared
status: canonical
updated: 2026-07-28
---

# Run 4 U2 corrections — one reconciled correction path

Issue: #187 (reconciliation). Absorbs #181 / PR #185 and #182 / PR #186.
Branch: `fix/auth/run4-u2-corrections-combined`, cut from `dev-phase2-run4` @ `87a6364`, then merged
up to `9004599` after #176 and #190 landed mid-session. PR: #214.

Cockpit step 4 of the required reconciliation order: *combine #185 and #186 from the current
integration tip, resolve the overlap, rerun the evidence, integrate ONE reconciled path.*

## Attempted

Carry both post-merge U2 corrections on one branch based on the current tip rather than their
shared stale base `ad8ef17` (the PR #177 merge), resolve every overlap in favour of the stronger
guarantee, re-measure the landing delta against the advanced gate base, and rerun the evidence that
is actually runnable on this box — without touching the CI workflow, the release-gate constants, or
the attestation record, all of which belong to the concurrent base-advance agent.

## Changed

- Cherry-picked `82b3bd4` (#185, replacement keys) then `cade71f` (#186, truthful control audits)
  onto `87a6364`. #185 applied clean; #186 conflicted in exactly one file.
- **Resolved the one real overlap** — `apps/nao/src/app/(app)/api/loader/run-pipeline/route.ts`.
  The two corrections change the same relay for different reasons: #185 replaces the
  `Authorization: Bearer <anonKey>` + `apikey: anonKey` pair with an opaque publishable key on
  `apikey` only; #186 wraps the same call in `runAuditedControlMutation` so a durable `attempted`
  row commits before the external effect. Kept **both**: #185's transport *inside* #186's lifecycle
  wrapper. #186's side of the conflict still carried the pre-#185 `anonKey` bearer, which would
  have silently reintroduced the exact hosted-401 defect #185 exists to fix.
- **Renumbered the two new migrations** from `20260728030000` / `20260728031000` to
  `20260728060000` / `20260728060001`. Both were authored against the old tip and would otherwise
  sort *before* the already-landed `20260728040000`, `20260728040001` and `20260728050000` — an
  out-of-order insert that blocks a later `supabase db push` against any already-migrated database.
  No landed migration was edited or renumbered. Updated the two tests that pin the filenames
  (`apps/nao/tests/controlAudit.test.ts`, `supabase/functions/_shared/server_keys.test.ts`).
- **Fixed a CRLF bug that had disabled a U2 source-conformance assertion.**
  `apps/nao/tests/authz.test.ts`'s "recordControlEvent … never takes an actor argument" test slices
  the module with `indexOf('export async function recordControlEvent(\n  eventOrAction')`. On a
  Windows checkout (`core.autocrlf=true`) the file is CRLF, so that lookup returned `-1` and
  `slice(0, -1)` widened the slice to the whole remainder of the module — which matches `userId`
  inside `guardRole()`. The read is now normalised to LF and the `-1` case asserts instead of
  silently widening. The assertion itself is unchanged and now genuinely evaluates.
- Documented the relay's new lifecycle in the route header so the "three exit paths" comment is no
  longer stale: the audit-error, outcome-unknown and mutation-error arms return fixed strings plus
  the operation id, never upstream payload, so the redaction contract still covers every relaying
  path.

## Evidence actually obtained

Local, on this branch:

| Check | Result |
|---|---|
| `apps/nao` `npx tsc --noEmit --incremental false` | exit 0, clean |
| `apps/nao` `npm test` | **tests 231 · pass 231 · fail 0** |
| `node --test supabase/functions/_shared/{internal_auth,server_keys}.test.ts` | **tests 52 · pass 52 · fail 0** |
| `node tools/context_sync.mjs --check` | passed |
| `node tools/context_sync.mjs --fix-index` | ran; regenerated indexes were EOL-only churn and discarded |

CI on PR #214 — **17 of 19 green**. Passing includes `nao — typecheck & test` (proving the CRLF fix
is correct on an LF checkout too), all four `Deno —` handler checks, `TypeScript — Type Check`,
`Flutter — Analyze & Test`, `Context`, all six `Node tools`, and — materially — **`Migrations —
shadow apply (postgres:17)`**, which validates the renumbered migrations against a vanilla
postgres:17 in filename order. The two red jobs are `Run 4 release evidence` and the consequential
`Run 4 Gate`; the release job fails at its landing-delta step, before reaching the attestation step.

## Decided

- **#185 is authoritative on transport, #186 on outcome semantics.** They are orthogonal
  corrections to one handler, so the reconciliation is a composition, not a choice. An independent
  cross-check supports this: an abandoned local-only branch `fix/db/run4-u2-u3-reconciliation`
  (`e759ed8`, never pushed, based on the stale `ad8ef17`) resolved the same conflict
  byte-identically.
- **`verify_jwt = false` on the four engine functions is a strengthening, not a weakening.** An
  opaque `sb_publishable_*` key is not a JWT, so the platform precheck would reject it before the
  handler ran — this is precisely why nao 401s against the migrated hosted project. Authorization
  did not move to nothing; it moved from "any valid anon JWT", which any client can mint, to the
  constant-time `X-Ourobion-Internal-Secret` verifier that runs as the handler's first authoritative
  operation. The anon key never granted anything the engine relied on.
- **The loader compatibility overload stays.** `apps/nao/src/app/(app)/api/loader/route.ts:132`
  still calls `recordControlEvent('loader.simulate', …)`, which records an honest unresolved
  `attempted` phase and never a false success. Closing it requires the atomic loader RPC that R4-U3
  / PR #184 owns (cockpit step 5), and this unit does not own `supabase/migrations` loader SQL.
  Leaving it visible in `nao_unresolved_control_operations` is the truthful state, not a gap.
- **The attestation record was not regenerated.** See Blockers — this is a deliberate stop, not an
  oversight.

## Left

- Superseded PRs #185 and #186 rather than merging either: both are based on `ad8ef17`, and #186's
  side of the conflict actively regresses #185. Both closed as superseded by this PR.
- `shared/` was NOT touched, so no two-reviewer signoff is required for this unit.
- No hosted writes, no deploy, no cron-setting change, no provider call, no model-training change.
  The three `app.*` database settings the superseding cron migration needs remain a human task.
- UI callers still do not send `X-Ourobion-Operation-Id`; a browser retry therefore cannot
  deduplicate an outcome-unknown external effect. That reconciliation belongs to the full-UI head
  (#191/#202), as #186 recorded.

## Blockers

- **The runtime attestation must be re-recorded by whoever owns it, and cannot be re-recorded on
  this box.** #185 deliberately changes `supabase/config.toml` (four `verify_jwt` flags) and all
  four function entrypoints, so `checkDeployAttestation`'s `configSha256`, `entrypointSha256` and
  `moduleGraphSha256` comparisons all drift — this is the reported #185 "config/lock hash mismatch",
  and it is a true consequence of the correction rather than a defect in it. Re-recording needs
  `deno` (absent: `deno: NOT FOUND on PATH`; the repo toolchain ships none) for the module graphs
  **and** a live `supabase functions serve` route probe returning 401 per function. Per the
  coordination constraint, `.github/workflows/ci.yml`, `tools/run4_release_gate*.mjs` and
  `supabase/deploy-attestation.json` were left untouched. The gate correctly fails closed until a
  real local serve proof exists.
- **The landing cap is exceeded by 31 lines, and the cause is other units' merged work, not this
  one.** PRs #176 and #190 merged mid-session, advancing the integration tip from `87a6364` to
  `9004599`. Measured against the accepted gate base `547280f6`:

  | Span | Paths | Added |
  |---|---:|---:|
  | gate base → integration tip `9004599` (other units) | 59 | 5,861 |
  | integration tip → this branch (**this unit alone**) | 37 | 2,670 |
  | gate base → CI's synthetic merge (**what the cap measures**) | — | **8,531** vs 8,500 |

  The gate correctly refuses a base other than the accepted SHA, so this cannot be re-measured
  around. `RUN4_UNIT_BASE_SHA` was **not** advanced here — a separate agent has that change ready.
  Per the run's constraint, this is reported and stopped at rather than worked around; no content was
  trimmed to buy 31 lines.
- **Docker is unavailable on this box, so the two container-backed harnesses could not run.** The
  machine is RAM-exhausted (1.7 GB free of 15.7 GB) with a concurrent physical-device Flutter build
  holding dart/gradle memory; `docker ps` / `docker info` / `docker version` all hang with no output
  on 60-second timeouts. Jayden's standing instruction is to leave Docker down until the running
  builds finish. `supabase/tests/authz/run.mjs` (the 443-assertion authorization harness) and
  `supabase/tests/profile_prefs/run.mjs` both spin disposable `postgres:17` containers, so their
  assertions — including #186's 144 new lines in `60_assertions.sql` and 24 in
  `70_non_regression.sql` — are **unverified at runtime in this session and are NOT claimed as
  passing**. Nothing was skipped, stubbed or weakened to manufacture a green result. Exact commands
  to run once Docker returns:

  ```
  node supabase/tests/authz/run.mjs
  node supabase/tests/profile_prefs/run.mjs
  ```

  Partial independent corroboration exists: CI's `Migrations — shadow apply (postgres:17)` job
  **passed** on this branch, which proves the two renumbered migrations apply cleanly in filename
  order against a vanilla postgres:17. That is not a substitute for the RLS/privilege assertions.
- **Housekeeping note for the next session:** a `docker desktop restart` attempted early in this
  session shut Docker Desktop down without bringing it back; it was relaunched and is running but
  still wedged, holding roughly 1.4 GB (Desktop + backend + `vmmemWSL`). Stopping it was not
  permitted from this session. Consider quitting Docker Desktop to return that RAM to the Flutter
  build, then starting it clean when the builds finish.

memory: none
