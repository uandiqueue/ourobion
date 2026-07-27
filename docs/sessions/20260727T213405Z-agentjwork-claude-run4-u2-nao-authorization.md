---
title: "Run 4 U2 — nao authorization and server-key boundary (O25)"
summary: "Provisioned nao roles enforced at both the route and database layers, redacted cross-user responses, append-only attributed control events, and a rotatable constant-time internal-secret protocol replacing four service-role bearer comparisons."
type: session
scope: shared
status: canonical
updated: 2026-07-28
---

# Run 4 U2 — nao authorization and server-key boundary (O25)

Issue #173. Unit base `b73b3de4971a341a54240dc6d4b88e5cefb1b9fe` (then-current
`origin/dev-phase2-run4`, re-verified at unit start — the *local* branch was stale at `66bfde5`, so
the worktree was cut from `origin/` explicitly). Branch `feat/auth/run4-u2-nao-authorization` in an
isolated worktree, never stacked on U1.

## Attempted

Implement R4-U2 only: explicit nao roles, two-layer enforcement, response redaction, attributed
append-only control events, and an explicit server-only internal-secret protocol.

## Changed

47 paths / 6,926 added lines measured from the gate's constant base (caps 115 / 8,500).

- **Database** — `20260728010000_nao_staff_roles.sql` (`nao_members`; `nao_role()`,
  `nao_has_role()`, `nao_authorize()`), `20260728010001_nao_control_events.sql` (append-only,
  attributed), `20260728010002_nao_redaction_grants.sql` (column revokes + 10 `AS RESTRICTIVE`
  boundary policies), `20260728020000_nao_cron_internal_secret.sql` (re-registers both pg_cron jobs).
- **nao app** — `authz.ts` (pure policy: `ROUTE_POLICY`, `satisfies`, `redactDeep`,
  `redactRelayBody`, `redactText`, `sanitizeStorageValue`), `authzServer.ts` (`resolveNaoRole`,
  `requireRole`/`guardRole`, `recordControlEvent`), `middleware.ts`, `auth.ts` (dead `role()` scaffold
  deleted), all 10 API route files, `IngestControlPanel.tsx`, `ingestControl.ts`,
  `simulatedHealth.ts`, `.env.example`.
- **Edge functions** — `_shared/internal_auth.ts` plus the four handlers; `deploy-attestation.json`
  regenerated.
- **Tests** — `supabase/tests/authz/**` (443-assertion harness + runner), `apps/nao/tests/**`
  (203 tests), `_shared/internal_auth.test.ts` (41 tests).
- **Docs** — `docs/shared/insight-slice-demo-runbook.md` (its `curl` commands were broken by the
  protocol change and now show the new header).
- **`.gitattributes`** (new, one scoped line) — forces a textual diff for
  `supabase/functions/compute-baselines/index.ts`. See the decision below.

## Decided

- **Two auth scopes, per the owner.** A Biotope user (Biotope only, plus what nao feeds it) and an
  ourobion dev (both apps; nao can populate that dev's own Biotope account). A `nao_members` row *is*
  the dev scope; viewer/curator/admin are capability tiers **within** it, not three kinds of person.
- **Enforcement is genuinely two-layer.** Routes call `guardRole` as their literal first statement
  (conformance-asserted, and asserted to precede any `req` read so there is no 400-vs-403 schema
  oracle), and the database independently denies via `AS RESTRICTIVE` policies plus column grants.
  Middleware is a first line only.
- **Zero `drop policy`; no existing policy body edited.** Restrictive policies AND-combine with the
  existing permissive ones, which is the mechanically checkable "don't break Biotope" guarantee.
- **`daily_gut_rows` and `wearable_daily` are untouched by design.** The nao loader populates the
  acting dev's OWN rows under their own session, enforced by the existing `auth.uid() = user_id`
  policies. A restrictive policy there would fail **silently** — the upsert's conflict target goes
  invisible and the update affects zero rows without raising — so the route would report success over
  an empty database. Proven by fault injection: injecting that policy broke 11 assertions, and the
  member-write group still *passed*, which is exactly why the non-member probe and the pre/post
  policy diff are the load-bearing assertions.
- **Role is read from the table on every request, never from a JWT claim.** A claim is stale for the
  token's lifetime; a forged `user_role` claim grants nothing (asserted).
- **Internal-secret protocol**: dedicated `X-Ourobion-Internal-Secret` header (Authorization stays a
  JWT because `verify_jwt = true`), `OUROBION_INTERNAL_SECRET_CURRENT`/`_PREVIOUS` rotation pair,
  SHA-256-then-XOR fixed-trip comparison. No timing-safe comparison of any kind existed in this repo
  before this change.
- **Every denial is a byte-identical 401, never 500.** This is load-bearing twice: it removes an
  oracle distinguishing "misconfigured" from "wrong secret", and `run4_release_gate.mjs:535` requires
  the recorded serve probe to observe `httpStatus == 401` — a 500 would make the attestation
  unrecordable and hard-block the unit.
- **The attestation was re-recorded from a real probe**, not carried forward. U2 rewrote the exact
  code path the probe observes, so a fresh `functions serve` run from this worktree was used
  (edge runtime 1.71.0 / Deno 2.1.4); all four routes observed 401 with body `Unauthorized`
  (`sha256 d089c8a9…`, matching the attested value).
- **Redaction is deny-by-shape, not deny-by-known-field.** Key matching is separator- and
  case-insensitive (`user_id`/`userId`/`USER_ID`/`user-id` all fold to one entry), and relayed
  payloads get small-cohort collapse (k=5) *before* keys are stripped — because stripping `userId`
  alone still leaves a cohort of one with its two health metrics named.
- **The base was deliberately NOT advanced.** Advancing `RUN4_UNIT_BASE_SHA` requires editing
  `ci.yml`, which is reserved after U1. U2 fits without it, so the reservation was honoured.
- **A `.gitattributes` line was required to make the landing gate measurable.**
  `compute-baselines/index.ts` carries a deliberate NUL byte, so git classifies it as binary and
  `git diff --numstat` reports `-  -  <path>`. `checkLandingDelta` fails closed on exactly that row
  ("binary/unparsable diff row"), which is right for a real binary but a false positive on a
  TypeScript source file — and it blocks **any** unit that edits that file. U2 is the first to do so.
  Fixed with `-text diff` scoped to that single path: `-text` keeps the bytes byte-identical (the
  attestation pins this file's `entrypointSha256`, so an EOL rewrite would invalidate it) and `diff`
  restores line counting. Verified: numstat `-  -` → `27  8`; zero binary rows remain in the landing
  delta; NUL still at line 171; blob hash unchanged at `a8032c14…`. The gate's own `landing`
  subcommand then passed locally at **49 paths / 7,102 added lines**.
  Note this masked a measurement error of my own: an `awk`-summed estimate read the binary row as 0
  and under-reported the total by 176 lines. The gate's own command is the authority, not hand
  arithmetic.

## Left

- **N1 follow-up is CLOSED, not deferred.** An authorized actor could suppress their own audit row on
  2 of 8 actions by putting a NUL escape into `detail` (jsonb insert fails, the write is swallowed,
  and the R2 effect still succeeds). Closed at three layers: `sanitizeStorageValue` makes the insert
  unfailable on content, boundary validation type-checks `paused` and charset-checks `seed`, and the
  swallow log now names the action and target. The swallow itself is retained so a bookkeeping error
  cannot roll back a completed mutation.
- **The pg_cron path is unexercised.** No Deno, no pg_net locally, and the CI stub only *stores* the
  command string. That the new header reaches the function from cron is established by construction
  and code reading only. **Both new DB settings must be created before the migration is applied, or
  both nightly jobs will raise** (fail-closed, but the nightly pipeline stops until an operator acts).
- **36 of 41 verifier assertions run in no CI job** originally; the nao bridge now executes 33 cases
  including the constant-time and oracle-equivalence properties. `deno-check` still only walks the
  four entrypoints, so `_shared/*.test.ts` is not itself a CI target.
- **RLS/PostgREST tests cannot run in CI** without a `ci.yml` job, which is reserved. The harness is
  CI-ready; adding one `node supabase/tests/authz/run.mjs` step is the whole integration.
- **Accepted limit:** `relationship_claims`, `edge_verifications`, `edge_human_verdicts` keep open
  reads because `get_insight_provenance` is SECURITY INVOKER and Biotope calls it. Identity columns
  are revoked and writes are curator-gated; the rows are not membership-scoped.
- **Residual LOW findings** (recorded, not fixed): `identityCohortSize` over-collapses an array whose
  rows carry a denied key holding a non-string (fail-closed; no current payload has that shape).
- **UI consequence:** the ingest-control panel now shows "Last changed by [redacted]" rather than a
  staff email, which is the honest consequence of identity living only in the admin-only audit log.
- **Not verified:** no end-to-end HTTP through Kong; the `42501 → 403` mapping is PostgREST's
  documented behaviour, not tested; `service_role` BYPASSRLS is not reproduced by the harness stub;
  the harness shim reconstructs Supabase's auth helpers rather than using the real image.

## Blockers

None. Independent security review returned **NO-GO** first (a live cross-user identity leak: the
run-pipeline relay returned raw `auth.users` UUIDs and per-user metric context to the browser), then
**GO** after remediation. The re-review verified the fix against real response shapes with its own
harness and found the deny-by-shape approach also closed a wider leak it had missed in round one —
`evaluate-signals`' per-user `metricSignals`/`firedPatterns` carrying `userId`, `metricKey`, `state`
and `zScore`.

memory: none
