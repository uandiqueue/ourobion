---
title: "Run 4 U2 corrections — one reconciled correction path"
summary: "Combined the replacement-key correction and the truthful-control-audit correction onto the current integration tip as one canonical PR, resolving the run-pipeline overlap, the migration-ordering hazard, and a CRLF bug that had disabled a source-conformance assertion; authz 468/468, profile-prefs 34/34, attestation re-recorded from a real serve probe."
type: session
scope: shared
status: canonical
updated: 2026-07-28
---

# Run 4 U2 corrections — one reconciled correction path

Issue: #187 (reconciliation). Absorbs #181 / PR #185 and #182 / PR #186.
Branch: `fix/auth/run4-u2-corrections-combined`, cut from `dev-phase2-run4` @ `87a6364`, then merged
up to `f2c8766` as #176, #190, #217 and #225 landed during the session. PR: #214.

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

Everything below was executed on this branch at `ae568ea` (merged up to integration tip `f2c8766`).

| Check | Result |
|---|---|
| `supabase/tests/authz/run.mjs` | **468 / 468 assertions passed, 0 failed** — `RESULT: PASS` |
| `supabase/tests/profile_prefs/run.mjs` | **34 / 34 assertions passed, 0 failed** — `RESULT: PASS` |
| `apps/nao` `npx tsc --noEmit --incremental false` | exit 0, clean |
| `apps/nao` `npm test` | **tests 231 · pass 231 · fail 0** |
| `node --test supabase/functions/_shared/{internal_auth,server_keys}.test.ts` | **tests 52 · pass 52 · fail 0** |
| `node --test tools/run4_release_gate.test.mjs` | **tests 9 · pass 9 · fail 0** |
| `run4_release_gate.mjs landing --base 2749381a…` | **41 paths / 2,855 added** of 115 / 8,500 — exit 0 |
| `run4_release_gate.mjs config` | `run4 config/workflow gate: PASS` |
| `run4_release_gate.mjs attest` | `run4 local runtime attestation: PASS` |
| `node tools/context_sync.mjs --check` | passed |

**The authorization harness is 468, not 443.** 443 was the pre-correction baseline; #186 adds a new
19-assertion `post/audit_lifecycle` group plus assertions across other groups. The count grew and
nothing regressed — every one of the 21 groups reports `[ ok ]`, including `post/forged_viewer`,
`post/forged_service_role_claim`, `post/live_revocation` and `post/append_only`. Both harnesses spun
and removed their own disposable `postgres:17` container; Jayden's four `supabase_*_ourobion`
containers were never touched.

### The runtime attestation was re-recorded through the generator, on real evidence

The earlier "config/lock hash mismatch" is now resolved, not suppressed. `deno 2.8.1` is present on
this box (`C:\Users\agent-j\.deno\bin\deno.exe`), so the full chain was executable:

1. `graph-hashes --deno … ` regenerated the four frozen module graphs.
2. A real `node_modules/supabase/bin/supabase.exe functions serve --debug --no-verify-jwt` was
   started against the running local stack. Its own startup log reports
   `Using supabase-edge-runtime-1.71.0 (compatible with Deno v2.1.4)` — exactly the pair
   `validateServeProbe` demands — and loads all four functions with `verifyJWT: false`, confirming
   the `config.toml` change takes effect at runtime.
3. Each of the four routes was POSTed **without** a valid internal secret. All four returned a
   genuine **401 with body `"Unauthorized"`**, hash
   `d089c8a9fc28e4e50223eb38c9409e362521be9380a37341304fbac7a4cd9e5f`. The hashes are identical
   across all four by design — the constant denial body is what removes the
   "misconfigured versus wrong secret" oracle.
4. `record-attestation --routes-base64 … ` wrote the manifest. **The file was never hand-edited.**
5. `attest --deno … ` re-verified it from freshly regenerated graphs, as CI does: **PASS**.

The manifest still declares `scope: local-only` and `hostedDeployParityClaimed: false`, and its
provenance is bound to the new base `2749381a`. The `supabase_edge_runtime_ourobion` container the
probe created was stopped and removed.

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
- **The attestation was re-recorded only once real evidence existed.** It was deliberately left stale
  for the first part of this session, when `deno` was absent and no live serve proof could be
  produced. It was regenerated through the generator, from a real serve probe, rather than
  hand-edited — the manifest is evidence, so a hand-written hash would have been a fabrication.

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

**None remaining for this unit.** Both blockers recorded earlier in this session were cleared and are
kept here as history, because each one shaped a decision:

- ~~Landing cap exceeded by 31 lines.~~ **Cleared.** PRs #176, #190, #217 and #225 landed while this
  branch was blocked. #225 advanced `RUN4_UNIT_BASE_SHA` to `2749381a`, and the overage vanished
  exactly as predicted — it was the stale base charging this unit for other units' merged work, never
  this unit's own size. Against the new base the delta is **41 paths / 2,855 added** of 115 / 8,500.
  This session did **not** advance the base and did **not** trim content to buy the 31 lines.
- ~~Docker unavailable, so the two container harnesses could not run.~~ **Cleared.** Docker 29.4.3 is
  healthy; both harnesses ran and passed (468/468 and 34/34). They were reported as UNRUN rather than
  assumed-passing while blocked, and the numbers above are the first time either is claimed.
- ~~The attestation could not be re-recorded.~~ **Cleared** by `deno 2.8.1` becoming available; see
  "Evidence actually obtained" for the full generator chain.

Genuinely outstanding, but not this unit's work:

- The three `app.*` database settings the superseding cron migration reads
  (`app.supabase_url`, `app.supabase_publishable_key`, `app.ourobion_internal_secret`) must be set in
  the Supabase dashboard before that cron can run. Values are never committed; this is a human task.
- For the hosted demo to stop 401ing, nao's server env needs `SUPABASE_PUBLISHABLE_KEYS` (or the
  singular `SUPABASE_PUBLISHABLE_KEY`). The legacy anon fallback is gated to the exact local-CLI
  origin by design, so it will correctly refuse to serve a hosted URL.
- Merging is human-gated and deliberately not performed here.

## Note for the next session

Early in this session, before Docker recovered, a `docker desktop restart` shut Docker Desktop down
without bringing it back; it was relaunched. Docker is healthy now. Separately, this session's
worktree at `C:\wt\run4-u2-corrections-combined` was removed by an external cleanup while work was
blocked — the branch was already pushed, so nothing was lost, and work resumed in a fresh worktree at
`C:\wt\u2combined`. Junctioned `node_modules` remnants had blocked the cleanup's own deletion; they
were removed without following into the real `node_modules`.

memory: none
