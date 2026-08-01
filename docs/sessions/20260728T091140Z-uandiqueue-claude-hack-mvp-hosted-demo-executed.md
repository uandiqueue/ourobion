---
title: "Hackathon MVP hosted demo migration — executed on bewwvcksgpxoomyjavjp"
summary: "The 2026-07-28 network block was gone on this host, so the approved demo rehearsal ran end to end: 30 migrations, 4 edge functions, the internal secret, a demo auth user, 8 rules, 21 simulated days, and derived projections — with the brain projection still unloaded."
type: session
scope: shared
status: canonical
updated: 2026-07-28
---

# Hackathon MVP hosted demo migration — executed

Issue #207. Branch `chore/hack-mvp-hosted-demo` (from `ad3fe99`), isolated worktree.
Continues [`20260728T081013Z-…-hack-mvp-hosted-demo-migration.md`](./20260728T081013Z-uandiqueue-claude-hack-mvp-hosted-demo-migration.md),
which measured everything and was stopped before any hosted write.

**Scope check:** demo project `bewwvcksgpxoomyjavjp` only. The clean reserve
`jscxvnettbvkboijczav` was never contacted. This is the rehearsal authorized in
[`human-decisions.md`](../temp/run4/human-decisions.md) → "Hackathon MVP demo rehearsal". It is
**not** a release promotion, does **not** close B-PL19, and makes **no** O29 or
production-readiness claim.

## Attempted

Execute [`hosted-demo-migration-runbook.md`](../temp/run4/hosted-demo-migration-runbook.md) §4 in
order, after re-running the §3 connectivity gate.

## Changed

### The blocker from the previous session is gone

The §6 signature was: TCP connects, **TLS is blackholed**, `tls error … i/o timeout`. On this host
TLS completed and the Postgres wire protocol worked throughout — `migration list`, `db push`, and a
real `psql` all connected. The previous session's diagnosis (network, not credential) was correct,
and the network is now different.

### Hosted state, verified remotely

| Surface | Before | After |
|---|---|---|
| Migrations applied | 0 / 30 | **30 / 30** |
| `public` base tables | 0 / 26 | **26 / 26** |
| Views | 0 | 2 |
| App RPCs | 0 / 4 | **4 / 4** |
| Edge functions | 0 | **4** |
| `rules` rows | 0 | **8** |
| `daily_gut_rows` | 0 | **21** (2026-07-08 → 2026-07-28) |
| `wearable_daily` | 0 | **21** |
| `baseline_snapshots` | 0 | **16** |
| `insight_cards` | 0 | **1** |
| `engagement_state` | 0 | **1** |
| `profiles` | 0 | **1** |
| `relationship_claims` / `edge_verifications` | 0 | **0 — not loaded** |

Demo auth user `demo@ourobion.com` → `d9b5bc39-0d8c-4d0f-9cb3-a8b527994879`, created **before**
seeding (the seeder resolves the UUID from `auth.users` and raises if absent; RLS keys on
`auth.uid() = user_id`). Credentials are in the machine-local gitignored `.env`, not in the repo.

`notify pgrst, 'reload schema'` was sent after the push, which is why `get_knowledge_base_stats`
resolves instead of returning `PGRST205`.

## Decided

- **No `supabase migration repair` was used, and none was needed.** `migration list --linked`
  showed 0 of 30 applied remotely before the push, so this was a clean first push and the ledger is
  maintained by `db push` itself. A blanket repair here would have recorded migrations as applied
  that never ran.
- **The pre-migration `db dump` snapshot was skipped**, deliberately and only after step 2 confirmed
  an empty remote ledger — the runbook sanctions this on a truly empty schema. It could not have run
  anyway: `db dump` shells out to `pg_dump` in Docker, which is unavailable here.
- **`psql` was obtained rather than worked around.** The runbook requires a real client and none
  existed; `conda create -n ourobion-psql -c conda-forge postgresql` gave psql 18.4 in an isolated
  env without touching the base environment or the repo.
- **Node 26 was installed via nvm.** `tools/rules/load_rules.mjs` fails on this box's Node 20.20 with
  `ERR_REQUIRE_CYCLE_MODULE` from `shared/rules/rule.schema.ts` — a pre-existing Node-version issue,
  not a code defect (CI runs Node 26 and passes). Installing the matching runtime was the honest fix.
- **`sslmode=no-verify` for the rules loader only.** `node-postgres` verifies the chain where
  libpq's `sslmode=require` does not, and Supabase's published CA URL now 404s. This matches the
  trust level `psql` already used for the seed; it weakens no repo gate, cap, policy or assertion.
  Worth replacing with a pinned CA later.
- **Edge functions were deployed with `--use-api`** (server-side bundling), since Docker is
  unavailable. All four deployed: `compute-baselines`, `generate-insights`, `evaluate-signals`,
  `run-pipeline`.

## Left

- **The brain projection is NOT loaded** — `relationship_claims` and `edge_verifications` are both
  0, so `get_knowledge_base_stats` returns `{studiesIndexed: 0, edgesVerified: 0,
  lastIndexedAt: null}` and the #202 Home knowledge-base panel will render zeros. This needs the four
  `R2_*` credentials, which were not supplied. **This is unloaded data, not a UI bug** — worth
  saying out loud before anyone debugs the panel.
- **Only 1 insight card exists**, and that is honest rather than broken. 4 patterns fired; the two
  cross-metric coincidence rules (`gut_comfort_mood_comove`, `hrv_rise_after_sleep_rise`) were
  correctly skipped by `brainScopeSkips`, because C10 requires a servable brain edge connecting the
  pair and no edges are loaded. Loading the projection is what would light those up. Nothing was
  relaxed to manufacture cards.
- **pg_cron jobs are scheduled but will not fire usefully.** Per
  [memory 0005](../memory/0005-pgcron-config-prereqs.md), `app.supabase_url` and
  `app.service_role_key` must be set in the dashboard first. Irrelevant for a demo where the
  functions are invoked directly, but it is not "scheduled and working".
- `evaluate-signals` and `run-pipeline` are deployed but were not exercised.
- nao was not verified against this project (runbook §5 second half).

## Blockers

- **A defect in the seeding path, found and fixed.** `scripts/seed-test-data.sql` never sets
  `daily_gut_rows.data_origin`, and that column's contract is explicit: **`NULL` = real
  user-entered data**. So the 21 seeded rows initially looked like genuine self-report, which
  violates the authorization's "simulated only, kept flagged as simulated" limit. They were stamped
  `data_origin = 'simulated:hack-mvp-demo'` and re-verified (21/21). `wearable_daily` was already
  distinguishable via `source = 'seed'`. **The seeder itself is still unfixed** — anyone seeding a
  hosted project from this script will reproduce the same unflagged state. That fix belongs in
  `scripts/seed-test-data.sql`, not in a one-off UPDATE.
- Docker unavailable (blocks `db dump`, forced `--use-api` for function deploys); the published
  Supabase CA download 404s.
- Mid-session the `.env` `SUPABASE_DB_PASSWORD` was replaced with a 91-character non-password value,
  which broke both `psql` and the CLI until it was restored. Recorded only because it cost time and
  briefly looked like a client bug.

## Verification actually run

All counts above were read back from the hosted database via the Management API `database/query`
endpoint after the writes — not inferred from command output.

```
migration list --linked   -> local 30 / remote-applied 30
information_schema        -> 26 base tables, 2 views, 4 app RPCs present
compute-baselines         -> {"ok":true,"users":1,"snapshots":16}
generate-insights         -> {"ok":true,"rules":{"loaded":8},"firedPatterns":4,
                              "cards":{"upserted":1,"byProducer":{"rules":1}}}
get_knowledge_base_stats  -> {"edgesVerified":0,"studiesIndexed":0,"lastIndexedAt":null}
daily_gut_rows            -> 21 rows, all data_origin='simulated:hack-mvp-demo'
```

## Handoff

Not yet `HOSTED READY` in the runbook §5 sense. The app can log in and will render 21 days of
history, 16 baselines and 1 card, but the knowledge-base panel will show zeros until the brain
projection is loaded. The APP lane should decide whether that is acceptable for the demo before
flipping `.env.public`.

memory: none
