---
id: "0005"
title: pg_cron migrations need app config set in the Supabase dashboard first
summary: Before pushing pg_cron migrations to production, set app.supabase_url and app.service_role_key in the Supabase dashboard or the scheduled jobs are created but fail silently at run time.
type: memory
status: accepted
decided: 2026-07-13
updated: 2026-07-13
---

# pg_cron migrations need app config set in the Supabase dashboard first

**Gotcha (backend / M5a / M5b).** Migrations that schedule `pg_cron` jobs (the nightly
`compute-baselines` and `generate-insights` runs) require two database settings to exist **before** the
migration is applied to production:

- `app.supabase_url`
- `app.service_role_key`

Set them in the Supabase dashboard: **Settings → Database → Configuration**.

**Why.** The cron jobs call back into the project (edge functions) using these values; if they are
unset when the migration runs, the scheduled job is created but fails silently at run time.

**How to apply.** Before `npx supabase db push` against production, confirm both settings are present.
This is part of why the derived tables are rebuildable projections, not truth — a misconfigured cron
just means re-running the job later ([0001-two-tier-truth](0001-two-tier-truth.md)).
