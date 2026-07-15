-- M5b: schedule nightly insight card generation
--
-- Runs 30 minutes after M5a (18:00 UTC) to ensure baseline_snapshots are
-- fully written before rules are evaluated.
--
-- Requires the same database settings as the M5a schedule:
--   app.supabase_url       = 'https://<your-project-ref>.supabase.co'
--   app.service_role_key   = '<your-service-role-key>'

select cron.schedule(
  'generate-insights-nightly',
  '30 18 * * *',
  $$
  select net.http_post(
    url     := current_setting('app.supabase_url') || '/functions/v1/generate-insights',
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer ' || current_setting('app.service_role_key')
               ),
    body    := '{}'::jsonb
  )
  $$
);
