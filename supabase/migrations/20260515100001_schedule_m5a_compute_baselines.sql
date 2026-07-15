-- M5a: enable pg_cron + pg_net and schedule nightly baseline computation
--
-- BEFORE APPLYING THIS MIGRATION:
-- Set these two custom settings once on your Supabase project via the dashboard:
--   Settings → Database → Configuration → Custom Config
--
--   app.supabase_url  = 'https://<your-project-ref>.supabase.co'
--   app.service_role_key = '<your-service-role-key>'
--
-- For local dev (supabase start), set them in supabase/config.toml under [db.settings]:
--   supabase_url = "http://127.0.0.1:54321"
--   service_role_key = "<local-service-role-key from supabase status>"
--
-- These settings are never stored in git — they stay in the database config only.

-- ═══════════════════════════════════════════════════════════════
-- 1. EXTENSIONS
-- ═══════════════════════════════════════════════════════════════

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net  with schema extensions;

-- ═══════════════════════════════════════════════════════════════
-- 2. NIGHTLY SCHEDULE
--    Runs at 18:00 UTC = 01:00–02:00 SGT/WIB — quiet window for
--    all ASEAN timezones, after the previous day's logs are in.
-- ═══════════════════════════════════════════════════════════════

select cron.schedule(
  'compute-baselines-nightly',
  '0 18 * * *',
  $$
  select net.http_post(
    url     := current_setting('app.supabase_url') || '/functions/v1/compute-baselines',
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer ' || current_setting('app.service_role_key')
               ),
    body    := '{}'::jsonb
  )
  $$
);
