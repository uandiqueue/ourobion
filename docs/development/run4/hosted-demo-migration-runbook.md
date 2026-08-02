---
title: Hosted demo migration runbook — bewwvcksgpxoomyjavjp
summary: Portable, machine-independent runbook to migrate and seed the hosted ourobion-demo Supabase project, written after the 2026-07-28 attempt from host UaNdIQueue was blocked by a network-level block on the Postgres wire protocol. Records the verified hosted state, the recorded authorization and its limits, the exact ordered steps, and the traps that cost time.
type: plan
scope: run4
status: draft
updated: 2026-07-28
---

# Hosted demo migration runbook — `bewwvcksgpxoomyjavjp`

This exists because the CLOUD lane of the 2026-07-28 hackathon MVP run
([`hack-mvp-prompt-cloud.md`](./hack-mvp-prompt-cloud.md)) could not complete from host `UaNdIQueue`:
**that network blocks the Postgres wire protocol**, so `supabase db push` cannot reach the project from
there. Everything else was verified working. Resume this on a machine with unrestricted outbound
Postgres access; the state below is measured, not assumed, so you should not need to re-probe.

## 1. Authorization and limits (carry these forward)

Jayden directed this hosted demo migration for the hackathon MVP. This is the "separate approval of
named isolated rehearsal resources" that [`pending-build-register.md`](./pending-build-register.md)
B-PL19 requires, and it narrowly overrides the standing "hosted Supabase writes" prohibition in
[`human-decisions.md`](./human-decisions.md) — **for this scope only**.

- **Named resource, and only this one:** demo project `bewwvcksgpxoomyjavjp`. The clean production
  reserve `jscxvnettbvkboijczav` stays untouched.
- **Approved scope:** apply the repo's append-only migrations; deploy edge functions; set function
  secrets; load the brain serving projection from pinned R2 edge JSONL; seed one demo auth user with
  simulated backdated history; invoke `compute-baselines` then `generate-insights`.
- **Limits that still hold:** no real personal health rows (simulated only, kept flagged as
  simulated); never weaken a cap, gate, test, scanner, RLS policy or assertion to make something
  work; no live LLM/provider calls; `model-training/` untouched; no production-readiness or
  scientific-validation claim.
- **This is a demo rehearsal, not a release promotion.** It does not close B-PL19 and makes no O29
  claim. B-PL19's missing pieces — exact migration ledger, explicit release selector, immutable
  namespace/manifest, checksummed promotion, target-load provenance, rollback, and cross-environment
  verdict policy — still do not exist after this runbook completes.

> **Outstanding:** this authorization still needs appending to
> [`human-decisions.md`](./human-decisions.md) itself. The 2026-07-28 session was prevented from
> editing that file by a tooling permission guard, so the record currently lives here and on the
> handoff issue. Land it there when you can.

## 2. Verified hosted state as of 2026-07-28

Measured by read-only probe from `UaNdIQueue`. All of this is HTTPS/443 and worked fine.

| Surface | State |
|---|---|
| Auth (GoTrue) | up — `/auth/v1/health` answers |
| PostgREST | up and serving |
| `sb_publishable_…` key in `.env.public.hosted-backup` | **valid** |
| Supabase CLI management token (on that box) | **valid** — `functions list` succeeded |
| `public` schema | **completely empty — 0 of 26 expected tables, 0 of 4 RPCs** |
| Edge functions deployed | **0** |
| Live nao `nao.ourobion.com` | up, correctly gates to `/login`; bundle points at `bewwvcksgpxoomyjavjp` |
| Postgres wire protocol from that network | **BLOCKED** (see §6) |

**The empty schema is good news for risk.** B-PL19 recorded that "the Run-2 brain tables were absent";
the reality is that nothing is there at all — not even `profiles` from the very first migration. A
probe of `profiles` returns the same `PGRST205 "Could not find the table in the schema cache"` as a
deliberately bogus table name used as a control. So:

- **This is a clean first push.** There is no migration-history mismatch to reconcile.
- **You should need no `supabase migration repair` at all.** If you think you do, re-verify — a blanket
  repair on an empty database would record migrations as applied that never ran, which is worse than
  the problem it appears to solve.

Because live nao already points at this project, **nao is currently serving from an empty database**.
No `wrangler secret put` and no Worker URL change are needed — verify before changing anything.

## 3. Preconditions

- A machine with **unrestricted outbound Postgres** (test with §6 before anything else).
- The repo at `dev-phase2-run4` tip (`547280f` or later) — 30 migrations in `supabase/migrations/`,
  `20260313_…` through `20260728050000_knowledge_base_stats_rpc`.
- Supabase CLI: repo-local `node_modules/.bin/supabase` (2.81.2).
- The hosted **Postgres password** (Dashboard → Settings → Database) and a **CLI login**
  (`supabase login`, or `SUPABASE_ACCESS_TOKEN`).
- **A real `psql` client**, or Docker. `psql` was absent entirely on `UaNdIQueue`; a disposable
  `docker run --rm -i postgres:17 psql …` container works and does *not* touch the local
  `supabase_db_ourobion` stack.
- On Windows, activate the toolchain first (`. .\scripts\biotope-env.ps1`) — nothing is on the base
  PATH. See [`orchestrator-prompt.md`](./orchestrator-prompt.md) §6.

## 4. Ordered steps

```bash
# 0. connectivity gate -- do this FIRST, it is what stopped the last attempt
#    (see §6 for the exact failure signature to compare against)

# 1. link
node_modules/.bin/supabase link --project-ref bewwvcksgpxoomyjavjp

# 2. confirm the remote ledger really is empty before writing anything
node_modules/.bin/supabase migration list --linked

# 3. snapshot, so you can retreat. On a truly empty schema there is nothing to lose,
#    but confirm step 2 said so before skipping this.
node_modules/.bin/supabase db dump --linked -f hosted-pre-migration.sql

# 4. apply all 30 migrations
node_modules/.bin/supabase db push --linked

# 5. reload PostgREST, or new RPCs 404 even though the SQL exists.
#    Skipping this is exactly what would silently break the #202 Home knowledge-base
#    counts (get_knowledge_base_stats) and look like a UI bug.
#    Run against the hosted connection string:
#      notify pgrst, 'reload schema';
```

Then verify remotely, do not assume — confirm the surfaces biotope actually calls:
`get_knowledge_base_stats`, the insight-card tables including the `archived` status, baseline
snapshots, profile prefs / daily digest, and the brain edge/serving projection tables. A quick
read-only sweep is `GET /rest/v1/<table>?select=*&limit=0` per table plus `POST /rest/v1/rpc/<fn>`
with `{}` — `404` + `PGRST205` means missing, anything else means present.

### 4a. Edge functions and secrets

```bash
node_modules/.bin/supabase functions deploy compute-baselines  --project-ref bewwvcksgpxoomyjavjp
node_modules/.bin/supabase functions deploy generate-insights  --project-ref bewwvcksgpxoomyjavjp
# plus evaluate-signals / run-pipeline if the demo path uses them

node_modules/.bin/supabase secrets set OUROBION_INTERNAL_SECRET_CURRENT=<43-char base64url>
```

These functions **require** the header `X-Ourobion-Internal-Secret`. A plain service-role key returns
**401 by design** — that is the O25 boundary working. Never relax the check to make a call succeed.

Any LLM key belongs in Supabase function secrets or the existing GitHub Actions repo secrets — **not**
in Cloudflare env, which cannot reach a Supabase edge function. Live provider calls remain outside
Run 4 authority: use the deterministic rule engine plus already-loaded brain edges, and say so on stage.

### 4b. Data

1. **Create the demo auth user FIRST.** `scripts/seed-test-data.sql` resolves the user's UUID from
   `auth.users` by email and **raises if absent** (`scripts/seed-test-data.sql:83`) — every row must
   carry the real UUID because RLS keys on `auth.uid() = user_id`. So sign up once in the app against
   hosted, or create the user via the Auth admin API, **before** seeding.
2. **Brain projection.** Load the pinned R2 edge JSONL into the hosted serving projection:
   `node tools/edge-loader/load_edges.mjs --from-r2`, with `SUPABASE_DB_URL` pointing at hosted and
   `R2_ENDPOINT` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET` set (names as in
   `tools/brain-ingest/.env`).
   **Record which keys you loaded** — B-PL19 notes these are *mutable* R2 keys with no exact migration
   ledger. As of 2026-07-28 the loader reads, from bucket `ourobion-corpus`:
   - `edges/claims.jsonl`
   - `edges/verifications.jsonl`
   (constants `R2_CLAIMS_KEY` / `R2_VERIFICATIONS_KEY` in `tools/edge-loader/lib/artifacts.mjs`.)
   Acceptable for a demo, but it is why this is a rehearsal and not a promotion.
3. **Seed simulated history** — you cannot `docker exec` into hosted, so pipe through psql against the
   hosted connection string with the same variables the local path uses:
   `-v email=<demo user> -v days=21`.
4. **Derive:** invoke `compute-baselines`, then `generate-insights`, against hosted.
5. **Verify rows exist** and record the counts before telling anyone it is ready.

**Do not hand-edit derived baseline / insight / engagement / brain rows.** Raw user rows are truth —
fix the input or the logic and re-run ([`AGENTS.md`](../../../AGENTS.md) §2). A hand-edited projection
is a fabricated demo.

### 4c. Known gap

`tools/rules` cannot run on a clean clone — `shared/rules/rule.schema.ts` imports `zod`, declared
neither in `tools/rules/package.json` nor at the repo root. Work around with `npm install --no-save
zod` at the repo root. **Do not commit that.**

## 5. Handing off to the app

Only once §4b's counts are real: tell the APP lane
`HOSTED READY — bewwvcksgpxoomyjavjp, demo user <email>, N insight cards, M baselines`. It then swaps
`apps/biotope/.env.public` for `.env.public.hosted-backup` and runs on the phone.

**Until then the APP lane must NOT flip `.env.public`** — hosted has no tables, so the app would fail
against an empty database and look like an app bug.

Then verify live nao against the same project: staff login and the JWKS cookie session; the
membership/role boundary (a non-member sees nothing, global-job responses stay redacted — merged
U2 #177 behaviour); Overview reflecting the data you just loaded; and the Models panel, which is a
**read-only projection** of `tools/llm-router/router.config.json` plus the budget ledger, published by
`tools/llm-router npx tsx scripts/publish-status.ts`. nao does **not** write router config today — if
the numbers look stale, republish the projection rather than inventing a write path. For Run-now
dispatch, nao calls `brain-ingest.yml`'s `workflow_dispatch` via `GH_ACTIONS_TOKEN`; B-UI6 records that
the Run-now dropdown ignores db seeds, a deliberate deferral, so do not present it as fully wired.

## 6. The blocker that stopped 2026-07-28 — how to tell if you have it too

From `UaNdIQueue`, TCP handshakes to the pooler **completed** but every TLS handshake was blackholed.
Two independent TLS stacks, both pooler ports, five different pooler IPs:

| Attempt | Result |
|---|---|
| CLI (Go TLS), `aws-1-ap-northeast-1.pooler.supabase.com:5432` session mode | `tls error (read tcp …:5432: i/o timeout)` |
| CLI, 5432 + `--dns-resolver https` | same, different resolved IP |
| CLI, 6543 transaction mode | same |
| `docker run postgres:17 psql`, 5432 | `server closed the connection unexpectedly` |
| `docker run postgres:17 psql`, 6543 | `timeout expired` across all 5 IPs |

`Test-NetConnection` reported **both ports reachable** — the TCP layer is fine, so a port-reachability
test is *not* a sufficient check. The signature is: TCP connects, then TLS stalls. HTTPS/443 to the
same project worked perfectly throughout (REST, Auth, and the CLI management API all responded), which
is how the state in §2 was measured.

If you see this signature, the fix is a different network, not a different credential — the password
and token were both valid and never the problem.

### Fallback if no unblocked network is available

The Supabase **Management API** (`POST https://api.supabase.com/v1/projects/{ref}/database/query`) runs
DDL over HTTPS/443 and is reachable where the Postgres wire protocol is not. It is a viable last
resort, with two non-negotiable conditions:

- **Send each migration file whole.** Never split on semicolons — these migrations contain `$$`-quoted
  function bodies and `DO` blocks that naive splitting corrupts.
- **Maintain the ledger yourself.** Create `supabase_migrations.schema_migrations`
  (`version text primary key, statements text[], name text`) and insert each version as it succeeds,
  or a later `db push` from an unblocked network will try to re-apply everything.

Prefer `db push` on a working network. The API path leaves you hand-maintaining migration history,
which is precisely the B-PL19 gap this project has not closed.
