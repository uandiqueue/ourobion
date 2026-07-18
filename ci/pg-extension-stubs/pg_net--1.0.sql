-- CI STUB for pg_net — shadow migration apply only (see ci/migrations-bootstrap.sql).
-- The migrations only reference `net.http_post` INSIDE a cron command string (never executed
-- at apply time), so this stub exists purely so `create extension pg_net` succeeds. The
-- signature mirrors the real pg_net one so a future migration that does call it at apply time
-- still parses.
\echo Use "CREATE EXTENSION pg_net" to load this file. \quit

create schema net;

create function net.http_post(
  url text,
  body jsonb default '{}'::jsonb,
  params jsonb default '{}'::jsonb,
  headers jsonb default '{"Content-Type": "application/json"}'::jsonb,
  timeout_milliseconds integer default 5000
)
returns bigint
language sql
as $$ select 1::bigint $$;
