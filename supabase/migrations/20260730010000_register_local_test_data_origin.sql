-- Local-only test-data seeder provenance.
--
-- The seeder writes directly as postgres inside a local Supabase database; it does not
-- use the Nao loader RPC. Its marker is therefore registered as simulated so non-wipe
-- replays can distinguish it from real/provider data, but loader_writable stays false
-- so the production loader can never author this script-owned provenance.
insert into public.nao_simulation_origins
  (origin, label, is_simulated, loader_writable, owner)
values
  ('seed:local-test-data', 'Local test-data seeder', true, false,
   'scripts/seed-test-data.sql')
on conflict (origin) do update set
  label           = excluded.label,
  is_simulated    = excluded.is_simulated,
  loader_writable = excluded.loader_writable,
  owner           = excluded.owner;
