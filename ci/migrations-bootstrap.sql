-- ci/migrations-bootstrap.sql — supabase-shaped primitives for the CI shadow migration apply
--
-- The `migrations-apply` CI job (.github/workflows/ci.yml) applies every file in
-- supabase/migrations/*.sql, in filename order, against a VANILLA postgres:17 service
-- container (major version matches supabase/config.toml `major_version = 17`). Vanilla
-- postgres lacks the primitives the supabase image ships, so this file creates the minimal
-- honest set the checked-in migrations actually reference — nothing more:
--
--   1. Roles `anon` / `authenticated` / `service_role` — supabase's canonical trio. Today only
--      `authenticated` is referenced (`to authenticated` policies in 20260716031048), but the
--      trio is created together so a future migration granting to the others doesn't need a
--      bootstrap edit. NOLOGIN, no BYPASSRLS: apply-time never authenticates as them.
--   2. Schema `auth` with a minimal `auth.users` (the FK target `id` plus `email`, which the
--      20260313 `handle_new_user()` trigger reads) and supabase's `auth.uid()` definition
--      (RLS policies call it; policy expressions are validated at CREATE POLICY time).
--   3. Schema `extensions` (migrations do `create extension ... with schema extensions`).
--
-- pg_cron / pg_net are NOT bootstrapped here: `create extension` needs control files on the
-- server filesystem, which no SQL can fake. The job instead `docker cp`s the stub extension
-- definitions in ci/pg-extension-stubs/ into the service container before running this file.
--
-- This job COMPLEMENTS the local `npx supabase db reset` (which runs on the real supabase
-- image with real pg_cron/pg_net/auth); it does not replace it. Its value is catching SQL
-- syntax errors, ordering breaks, and constraint-name assumptions in CI, where no supabase
-- stack exists.

-- 1 · Roles
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit;

-- 2 · auth schema: FK target + uid() for RLS policy expressions
create schema auth;

create table auth.users (
  id    uuid primary key,
  email text
);

-- Supabase's definition (GoTrue puts the JWT subject in request.jwt.claim.sub). Returns NULL
-- here — nothing executes policies during the shadow apply; it only has to exist and typecheck.
create function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

-- 3 · extensions schema (create extension ... with schema extensions)
create schema extensions;
grant usage on schema extensions to anon, authenticated, service_role;
