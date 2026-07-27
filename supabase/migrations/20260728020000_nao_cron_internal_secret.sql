-- R4-U2 · re-register both nightly pg_cron jobs to use the internal-secret protocol
--
-- WHAT THIS FIXES
-- The two nightly jobs registered by 20260515100001 (compute-baselines, 18:00 UTC) and
-- 20260515110001 (generate-insights, 18:30 UTC) sent `Authorization: Bearer
-- <app.service_role_key>`. The four edge functions compared that bearer against
-- SUPABASE_SERVICE_ROLE_KEY with a plain, non-timing-safe `!==`, and nao's server route sent a
-- byte-identical bearer — so cron, nao, and any admin curl were indistinguishable callers all
-- presenting the project's god-mode credential.
--
-- After R4-U2 the functions authorize on a dedicated header instead:
--   apikey / Authorization      → the PUBLISHABLE anon key. Gateway routing plus the
--                                 `verify_jwt = true` declared in supabase/config.toml for all
--                                 four functions. Grants nothing on its own.
--   X-Ourobion-Internal-Secret  → the ONLY authorization input, compared constant-time in
--                                 supabase/functions/_shared/internal_auth.ts against the
--                                 OUROBION_INTERNAL_SECRET_CURRENT / _PREVIOUS pair.
-- The service-role key leaves the request path entirely; it survives only inside each function
-- as the database credential for that function's own writes.
--
-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- BEFORE APPLYING — two NEW database settings (Dashboard → Settings → Database → Custom
-- Config; locally, supabase/config.toml `[db.settings]`):
--
--   app.supabase_anon_key        = '<project publishable anon key>'   -- public value
--   app.ourobion_internal_secret = '<the internal secret>'            -- SECRET; never in git
--
-- and one now-unused setting: `app.service_role_key` is NO LONGER READ by any cron job. Unset
-- it after this migration applies and after the first successful run of both jobs.
--
-- `app.supabase_url` is unchanged and still required.
--
-- NOTHING SECRET IS BAKED INTO THIS FILE. The secret is read with `current_setting()` INSIDE
-- the job's command string, which pg_cron stores as text and evaluates afresh at every
-- execution in a fresh backend. So the value reaches cron from database config at run time,
-- and rotating it needs no migration, no reschedule, and no restart.
--
-- `current_setting()` is called WITHOUT the `missing_ok => true` second argument on purpose: a
-- missing setting raises inside the job, `net.http_post` never runs, and no request is ever
-- sent with an empty or literal-`undefined` header. Fail-closed by construction.
-- ═══════════════════════════════════════════════════════════════════════════════════════════
--
-- ROTATION PROCEDURE AND WINDOW (no downtime, no migration, no redeploy)
--
--   1. Verifier side FIRST — both values accepted from this moment on:
--        supabase secrets set OUROBION_INTERNAL_SECRET_PREVIOUS=<old> \
--                             OUROBION_INTERNAL_SECRET_CURRENT=<new>
--   2. nao sender:  wrangler secret put OUROBION_INTERNAL_SECRET   (the new value)
--   3. cron sender: Dashboard → Settings → Database → Custom Config →
--                     app.ourobion_internal_secret = '<new>'
--      pg_cron opens a fresh backend per execution and the command string re-reads the setting
--      at run time, so the next scheduled fire picks it up. No `cron.schedule` call needed.
--   4. After BOTH nightly jobs have fired once under the new value, retire the old one:
--        supabase secrets unset OUROBION_INTERNAL_SECRET_PREVIOUS
--
-- WINDOW: step 1 strictly precedes steps 2–3, so there is never an instant when a caller sends
-- a value no verifier accepts (fail-forward, never fail-open). The jobs fire at 18:00 and 18:30
-- UTC, so step 4 becomes safe after the next 18:30 UTC run — i.e. at most ~24 h after step 3.
-- TARGET: complete step 4 within 48 h. The dual-accept window must not be left open: while
-- PREVIOUS is set, a compromised old secret is still valid.
--
-- WHY `cron.schedule` AND NEVER `cron.unschedule`
-- `cron.schedule` upserts by job name: re-registering an existing name replaces the stored
-- command in place, keeping one job per name. `cron.unschedule` is deliberately NOT used —
-- ci/pg-extension-stubs/pg_cron--1.0.sql defines ONLY
-- `cron.schedule(job_name text, schedule text, command text)`, so calling `cron.unschedule`
-- would break the `migrations-apply` CI job, and .github/workflows/ci.yml is out of scope for
-- this unit. Positional arguments are used to match that stub signature exactly.
--
-- The two 20260515 migrations are NOT edited: an applied migration is never rewritten, and the
-- CI shadow apply replays every file in filename order.

-- ═══════════════════════════════════════════════════════════════
-- 1. compute-baselines — nightly at 18:00 UTC (schedule unchanged)
-- ═══════════════════════════════════════════════════════════════

select cron.schedule(
  'compute-baselines-nightly',
  '0 18 * * *',
  $$
  select net.http_post(
    url     := current_setting('app.supabase_url') || '/functions/v1/compute-baselines',
    headers := jsonb_build_object(
                 'Content-Type',                'application/json',
                 'apikey',                      current_setting('app.supabase_anon_key'),
                 'Authorization',               'Bearer ' || current_setting('app.supabase_anon_key'),
                 'X-Ourobion-Internal-Secret',  current_setting('app.ourobion_internal_secret')
               ),
    body    := '{}'::jsonb
  )
  $$
);

-- ═══════════════════════════════════════════════════════════════
-- 2. generate-insights — nightly at 18:30 UTC (schedule unchanged)
-- ═══════════════════════════════════════════════════════════════

select cron.schedule(
  'generate-insights-nightly',
  '30 18 * * *',
  $$
  select net.http_post(
    url     := current_setting('app.supabase_url') || '/functions/v1/generate-insights',
    headers := jsonb_build_object(
                 'Content-Type',                'application/json',
                 'apikey',                      current_setting('app.supabase_anon_key'),
                 'Authorization',               'Bearer ' || current_setting('app.supabase_anon_key'),
                 'X-Ourobion-Internal-Secret',  current_setting('app.ourobion_internal_secret')
               ),
    body    := '{}'::jsonb
  )
  $$
);
