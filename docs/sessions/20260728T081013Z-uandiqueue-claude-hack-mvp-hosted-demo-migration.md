---
title: Hackathon MVP CLOUD lane — hosted demo migration blocked by a Postgres-protocol network block
summary: Measured the hosted demo project's real state (public schema entirely empty, zero edge functions, live nao already pointed at it), recorded Jayden's hosted-write authorization, and found that host UaNdIQueue cannot reach Supabase over the Postgres wire protocol at all, so no migration was applied; left a portable runbook and corrected the orchestrator prompt's fictional macOS device setup.
type: session
scope: shared
status: canonical
updated: 2026-07-28
---

# Hackathon MVP CLOUD lane — hosted demo migration blocked by a Postgres-protocol network block

Branch: `chore/hack-mvp-hosted-demo` (worktree `C:\project\ourobion-hack-cloud`, cut from `547280f`)

Brief: [`docs/temp/run4/hack-mvp-prompt-cloud.md`](../temp/run4/hack-mvp-prompt-cloud.md) — the CLOUD
lane of a two-session, one-hour hackathon MVP run. This lane owned the hosted backend and live nao and
was the critical path.

**Outcome: the critical path did not complete, for an environmental reason.** No hosted write of any
kind occurred. The hosted database is exactly as it was before this session.

## Attempted

- Record Jayden's hosted-write authorization before touching anything.
- Establish the hosted demo project's actual state instead of trusting B-PL19's 2026-07-26 note.
- Apply the 30 migrations in `supabase/migrations/` to `bewwvcksgpxoomyjavjp`, then deploy edge
  functions, load the brain projection, seed a demo user, and verify live nao against it.
- Correct the orchestrator prompt's macOS device setup, which describes a machine that does not exist.

## Changed

- **`docs/temp/run4/human-decisions.md`** — recorded the hackathon demo-rehearsal authorization: named
  resource `bewwvcksgpxoomyjavjp` only, the approved scope, the limits that still hold, and that it is
  a rehearsal rather than a release promotion which does not close B-PL19 or claim O29. Marked it
  explicitly **unspent**, since nothing was executed.
- **`docs/temp/run4/hosted-demo-migration-runbook.md`** (new) — the portable handoff: measured hosted
  state, ordered steps, the demo-user prerequisite, the R2 keys the projection comes from, the failure
  signature to test for, and a documented last-resort fallback with its conditions.
- **`docs/temp/run4/orchestrator-prompt.md` §6** — replaced the macOS device setup
  (`/Applications/Docker.app`, `~/Library/Android/sdk`, zsh word-splitting) with the real Windows one:
  `. .\scripts\biotope-env.ps1`, push from an activated PowerShell because Git Bash has no node and
  `.githooks/pre-push` dies, deno absent with the pinned-2.8.1 install, adb's real path, plus three
  gotchas hit live this session.
- **`docs/temp/run4/hack-mvp-prompt-app.md`, `hack-mvp-prompt-cloud.md`** — committed; they were
  untracked working-tree files and are this run's authority docs.

## Decided

- **The hosted schema is empty, so this is a clean first push — not a repair job.** B-PL19 recorded
  that "the Run-2 brain tables were absent". The measured reality is that *nothing* is there: 0 of 26
  expected tables and 0 of 4 RPCs. `profiles` returns the same `PGRST205 "not found in schema cache"`
  as a deliberately bogus table name probed as a control. Recorded prominently that a future session
  should therefore need **no `supabase migration repair` at all** — a blanket repair against an empty
  database would record migrations as applied that never ran.
- **The blocker is the network, not a credential.** Both the Postgres password and the CLI access token
  were valid and neither was ever the problem. Recorded the diagnostic signature so the next session
  can test in one step rather than rediscovering it.
- **Did not fall back to the Management API DDL path**, though it was reachable and I had a working
  script for it. Jayden chose the ledger-correct `db push` path, and once a machine with unrestricted
  Postgres access is available that path works normally; taking the fallback would have left hand-
  maintained migration history — exactly the B-PL19 gap this project has not closed — to save an hour.
  Documented it as a conditional last resort instead.
- **Did not touch the live nao Worker.** Its bundle already points at `bewwvcksgpxoomyjavjp`, so the
  brief's conditional `wrangler secret put` was unnecessary. Verified before changing anything.

## Left

- The entire hosted critical path: migrations, functions, secrets, projection load, demo user, derive,
  and the live-nao-against-hosted verification. All of it is specified in the runbook.
- **The APP lane must not flip `apps/biotope/.env.public` to `.env.public.hosted-backup`.** Hosted has
  no tables; the app would fail against an empty database and it would look like an app bug.
- **A demo auth user must be created before seeding.** `scripts/seed-test-data.sql:83` resolves the
  UUID from `auth.users` by email and raises if absent, because RLS keys on `auth.uid() = user_id`.
- The `tools/rules` clean-clone gap (`shared/rules/rule.schema.ts` imports an undeclared `zod`) is
  unfixed; still needs `npm install --no-save zod`, uncommitted.

## Blockers

- **Host `UaNdIQueue` cannot speak the Postgres wire protocol to Supabase.** TCP handshakes to
  `aws-1-ap-northeast-1.pooler.supabase.com` complete, then every TLS handshake is blackholed —
  across two independent TLS stacks (the CLI's Go stack and libpq in a `postgres:17` container), both
  pooler ports (5432 session, 6543 transaction), five distinct pooler IPs, and with
  `--dns-resolver https`. `Test-NetConnection` reports both ports reachable, so port-reachability is
  not a sufficient test. HTTPS/443 to the same project worked throughout — REST, Auth, and the CLI
  management API all responded, which is how the state above was measured. **Resume on a different
  network.**
- `psql` is not installed on this box at all, even after toolchain activation. A disposable
  `docker run --rm -i postgres:17 psql` container is the workaround and does not touch the APP lane's
  local `supabase_db_ourobion` stack.
- Two tooling permission guards intervened: a hosted-write attempt was refused before Jayden approved
  it interactively, and the first `human-decisions.md` edit was blocked transiently and succeeded on
  retry. Neither was worked around.

## Verified, not rebuilt

- `apps/nao/tests/authz.test.ts:720` — the source-conformance guard forbidding
  `SUPABASE_SERVICE_ROLE_KEY` in nao route code is real and correctly written: it strips comments
  first, so route prose documenting the var by name does not false-positive.
- Live `nao.ourobion.com` is up and correctly gates unauthenticated traffic to `/login`; its client
  bundle resolves to `https://bewwvcksgpxoomyjavjp.supabase.co`.
- The hosted `sb_publishable_…` key in `.env.public.hosted-backup` is valid.

memory: none
