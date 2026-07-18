-- CI STUB for pg_cron — shadow migration apply only (see ci/migrations-bootstrap.sql).
-- Provides just enough surface for the checked-in migrations: `cron.schedule(name, cron, sql)`
-- is CALLED at migration time (20260515100001, 20260515110001), so it must exist and return a
-- job id. Nothing is actually scheduled; the command string is never executed here.
\echo Use "CREATE EXTENSION pg_cron" to load this file. \quit

create schema cron;

create function cron.schedule(job_name text, schedule text, command text)
returns bigint
language sql
as $$ select 1::bigint $$;
