-- supabase/tests/authz/10_supabase_shim.sql
--
-- PRE-MIGRATION shim for the disposable postgres:17 RLS proof harness. Runs immediately after
-- ci/migrations-bootstrap.sql and BEFORE any file in supabase/migrations/.
--
-- WHY IT IS NEEDED. ci/migrations-bootstrap.sql exists to prove that migrations APPLY on vanilla
-- postgres; it is deliberately not a Supabase emulator, and it is out of this unit's scope to
-- edit (it is an input to the currently-green `migrations-apply` CI job). Two gaps make it unable
-- to EXECUTE policies:
--
--   1. Its auth.uid() reads only the legacy scalar GUC `request.jwt.claim.sub`. Real
--      Supabase/PostgREST sets the JSON GUC `request.jwt.claims`. Without the coalesce form below
--      auth.uid() would be NULL for every probe and every assertion would pass vacuously.
--   2. It grants NO table privileges to anon/authenticated/service_role. Without the default
--      privileges below, every probe would fail with "permission denied for table" BEFORE any
--      policy was consulted — the harness would be testing missing grants, not RLS.
--
-- WHY IT MUST RUN *BEFORE* THE MIGRATIONS. Each migration's own revoke/grant statements must land
-- LAST, exactly as they do in production, where Supabase's default privileges are already in
-- place when a migration runs. Running this file afterwards would silently re-grant what
-- 20260724152525's `revoke update` and R4-U2's column revokes take away, and the harness would
-- then be testing a configuration that exists nowhere.
--
-- `alter default privileges ... grant all on routines` is faithful too: it is why the repo's
-- migrations have to explicitly `revoke execute ... from public, anon` on definer functions.
--
-- HONEST LIMIT. This is a faithful RECONSTRUCTION of Supabase's auth helpers and default
-- privileges, not the real supabase/postgres image. A divergence in the real image's grants would
-- not be caught here. Also, ci/migrations-bootstrap.sql creates anon/authenticated/service_role
-- NOLOGIN and WITHOUT BYPASSRLS, so service_role's production BYPASSRLS is NOT reproduced; the
-- claim "the loaders/tools are unaffected" rests on every new policy being scoped
-- `to authenticated`, which the harness verifies structurally instead.

-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- 1 · auth helpers, in Supabase's real shape
-- ─────────────────────────────────────────────────────────────────────────────────────────────

-- Supabase's actual definition: prefer the legacy scalar GUC, fall back to the JSON claims blob
-- that PostgREST installs per request.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select coalesce(
           nullif(current_setting('request.jwt.claim.sub', true), ''),
           nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
         )::uuid
$$;

create or replace function auth.jwt()
returns jsonb
language sql
stable
as $$
  select coalesce(
           nullif(current_setting('request.jwt.claim', true), ''),
           nullif(current_setting('request.jwt.claims', true), '')
         )::jsonb
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(
           nullif(current_setting('request.jwt.claim.role', true), ''),
           nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
         )
$$;

-- Policies call auth.uid() as the invoking role, so the invoking role needs USAGE on the schema.
grant usage on schema auth to anon, authenticated, service_role;

-- auth.users itself stays unreadable by the API roles, exactly as in production.
revoke all on auth.users from anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- 2 · Supabase's default privileges on schema public
-- ─────────────────────────────────────────────────────────────────────────────────────────────

grant usage on schema public to anon, authenticated, service_role;

grant all on all tables    in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all routines  in schema public to anon, authenticated, service_role;

-- The migrations below run as this role, so their new objects inherit these defaults — which is
-- what makes each migration's explicit revoke meaningful.
alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on routines  to anon, authenticated, service_role;
