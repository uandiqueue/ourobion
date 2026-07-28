-- R4-U2 correction: supersede the already-applied cron definitions with the replacement
-- publishable-key wire protocol. Do not edit the historical 20260515 or 20260728020000 files.
--
-- Required database settings (Dashboard Custom Config; never commit values):
--   app.supabase_url              = 'https://<project-ref>.supabase.co'
--   app.supabase_publishable_key  = 'sb_publishable_...'
--   app.ourobion_internal_secret  = '<43-char base64url internal secret>'
--
-- current_setting deliberately has no `missing_ok`: an unset value aborts the job before any
-- request is emitted. `apikey` is the only API-key transport header. The Edge Functions have
-- verify_jwt=false and their first authoritative operation is the internal-secret verifier.

select cron.schedule(
  'compute-baselines-nightly',
  '0 18 * * *',
  $$
  select net.http_post(
    url     := current_setting('app.supabase_url') || '/functions/v1/compute-baselines',
    headers := jsonb_build_object(
                 'Content-Type',               'application/json',
                 'apikey',                     current_setting('app.supabase_publishable_key'),
                 'X-Ourobion-Internal-Secret', current_setting('app.ourobion_internal_secret')
               ),
    body    := '{}'::jsonb
  )
  $$
);

select cron.schedule(
  'generate-insights-nightly',
  '30 18 * * *',
  $$
  select net.http_post(
    url     := current_setting('app.supabase_url') || '/functions/v1/generate-insights',
    headers := jsonb_build_object(
                 'Content-Type',               'application/json',
                 'apikey',                     current_setting('app.supabase_publishable_key'),
                 'X-Ourobion-Internal-Secret', current_setting('app.ourobion_internal_secret')
               ),
    body    := '{}'::jsonb
  )
  $$
);
