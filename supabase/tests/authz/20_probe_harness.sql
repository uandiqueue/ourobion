-- supabase/tests/authz/20_probe_harness.sql
--
-- The assertion primitives for the RLS proof harness. Applied once, after the pre-U2 migrations
-- and before any probe, so that the SAME primitives record the pre-U2 baseline and the post-U2
-- result and a comparison between them is meaningful.
--
-- ── HOW AN ASSERTION IS EVALUATED, AND WHY THIS IS PostgREST'S REAL PATH ─────────────────────
-- Every probe below is executed inside a transaction shaped exactly like the one PostgREST opens
-- for an incoming request:
--
--     begin;
--       set local request.jwt.claims = '{"sub":"<uuid>","role":"authenticated"}';
--       set local role authenticated;
--       ... the statement under test ...
--     commit;   -- or rollback
--
-- That is not a simulation of PostgREST — it is what PostgREST does. For each request it verifies
-- the JWT signature, then in ONE transaction sets `request.jwt.claims` to the verified claim JSON
-- and SET LOCAL ROLE to the token's `role` claim, and runs the statement there. All policy
-- evaluation, all GRANT checks, and every auth.uid() read therefore happen under that role with
-- that GUC — which is precisely the decision path these migrations add. Same migration set, same
-- role, same GUC, same statements ⇒ the enforcement decision is executed, not modelled.
--
-- ── WHAT THIS HARNESS DOES NOT PROVE (stated plainly) ────────────────────────────────────────
--   * Nothing about Kong / PostgREST CONFIGURATION or routing: no real HTTP, no `apikey`
--     requirement, no CORS, and no proof that SQLSTATE 42501 is mapped to HTTP 403 (it asserts
--     the 42501, and the mapping is PostgREST's documented behaviour, not something tested here).
--   * Nothing about JWT VERIFICATION. The harness ASSERTS claims; it never validates a signature.
--     Forged-token rejection rests on Supabase's own verification and on the app's verifier.
--     What the harness does prove is the complementary half: that a *validly signed* token
--     carrying a forged `user_role` claim grants nothing, because the role is read from the table.
--   * Nothing about service_role's production BYPASSRLS (ci/migrations-bootstrap.sql creates the
--     roles without it), the edge functions, or pg_cron/pg_net (stubbed).
--   * It is a reconstruction of Supabase's auth helpers and default privileges (see 10_...sql),
--     not the real supabase/postgres image.
--
-- ── WHY THE HELPERS ARE SECURITY INVOKER ────────────────────────────────────────────────────
-- `execute p_sql` inside a SECURITY INVOKER function runs with the CALLER's role and privileges,
-- so a probe called while `set local role authenticated` is in effect is evaluated as
-- authenticated. A SECURITY DEFINER helper would silently run every assertion as the superuser
-- and the whole harness would pass vacuously. This is the single most important property here.
--
-- Each helper wraps the statement in its own plpgsql sub-block with an exception handler, so a
-- denial is RECORDED rather than aborting the run, and one failing assertion cannot mask another.

create schema if not exists authz_probe;

create table if not exists authz_probe.result (
  id       bigserial primary key,
  phase    text not null,            -- 'pre' (before the R4-U2 migrations) | 'post'
  name     text not null,
  expected text not null,
  actual   text not null,
  ok       boolean not null
);

-- The probe schema is test scaffolding, not product surface: the API roles may write their own
-- results into it. Nothing here has RLS, so it never appears in a pg_policies snapshot.
grant usage on schema authz_probe to anon, authenticated, service_role;
grant select, insert on authz_probe.result to anon, authenticated, service_role;
grant usage, select on all sequences in schema authz_probe to anon, authenticated, service_role;

create or replace function authz_probe.record(p_name text, p_expected text, p_actual text)
returns void
language plpgsql
as $$
begin
  insert into authz_probe.result (phase, name, expected, actual, ok)
  values (coalesce(current_setting('authz_probe.phase', true), '<unset>'),
          p_name, p_expected, p_actual, p_expected = p_actual);
end
$$;

-- Expect p_sql to SUCCEED.
create or replace function authz_probe.expect_ok(p_name text, p_sql text)
returns void
language plpgsql
as $$
declare
  act text;
begin
  begin
    execute p_sql;
    act := 'ok';
  exception when others then
    act := 'error:' || sqlstate;
  end;
  perform authz_probe.record(p_name, 'ok', act);
end
$$;

-- Expect p_sql to FAIL with exactly p_sqlstate. 42501 = insufficient_privilege, which covers all
-- three denial shapes this unit produces: "permission denied for table", "permission denied for
-- column", and "new row violates row-level security policy" — plus every raise from
-- public.nao_authorize and the control-event attribution trigger.
create or replace function authz_probe.expect_error(p_name text, p_sql text, p_sqlstate text)
returns void
language plpgsql
as $$
declare
  act text;
begin
  begin
    execute p_sql;
    act := 'no_error';
  exception when others then
    act := 'error:' || sqlstate;
  end;
  perform authz_probe.record(p_name, 'error:' || p_sqlstate, act);
end
$$;

-- Expect the single-value query p_sql to return p_expected (NULL renders as '<null>').
create or replace function authz_probe.expect_value(p_name text, p_sql text, p_expected text)
returns void
language plpgsql
as $$
declare
  v   text;
  act text;
begin
  begin
    execute p_sql into v;
    act := coalesce(v, '<null>');
  exception when others then
    act := 'error:' || sqlstate;
  end;
  perform authz_probe.record(p_name, p_expected, act);
end
$$;

-- Expect the DML statement p_sql to affect exactly p_rows rows. This is the assertion shape that
-- catches SILENT denial: an UPDATE that no policy permits affects ZERO rows and raises nothing, so
-- "0 rows affected" is the only observable difference between "denied" and "worked".
create or replace function authz_probe.expect_rows_affected(p_name text, p_sql text, p_rows integer)
returns void
language plpgsql
as $$
declare
  n   integer;
  act text;
begin
  begin
    execute p_sql;
    get diagnostics n = row_count;
    act := n::text;
  exception when others then
    act := 'error:' || sqlstate;
  end;
  perform authz_probe.record(p_name, p_rows::text, act);
end
$$;

-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- Snapshot tables for the non-regression proof. Both are captured BEFORE the R4-U2 migrations
-- and re-derived afterwards; the diff must be empty for every pre-existing table.
--
-- has_column_privilege() is used rather than information_schema.column_privileges because the
-- former is unambiguous about privileges that arrive via a TABLE-level grant (which is exactly
-- the case the column-revoke/column-grant pattern turns on its head).
-- ─────────────────────────────────────────────────────────────────────────────────────────────

create or replace view authz_probe.policy_state as
  select tablename::text  as tablename,
         policyname::text as policyname,
         permissive::text as permissive,
         coalesce(roles::text, '')      as roles,
         cmd::text        as cmd,
         coalesce(qual, '')             as qual,
         coalesce(with_check, '')       as with_check
  from pg_policies
  where schemaname = 'public';

create or replace view authz_probe.colpriv_state as
  select c.relname::text  as tablename,
         a.attname::text  as columnname,
         r.rolname::text  as grantee,
         p.priv           as privilege,
         has_column_privilege(r.oid, c.oid, a.attname, p.priv) as granted
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
  join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
  cross join (values ('anon'), ('authenticated'), ('service_role')) as rr(rolname)
  join pg_roles r on r.rolname = rr.rolname
  -- SELECT / INSERT / UPDATE / REFERENCES are the only column-level privilege types Postgres has
  -- (DELETE and TRUNCATE exist only at table level and are covered by has_table_privilege).
  cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('REFERENCES')) as p(priv)
  where c.relkind = 'r';

-- The 15 tables this unit is forbidden to change, by name. daily_gut_rows and wearable_daily lead
-- the list because they are the populate path's enforcement surface (design invariant P).
create or replace view authz_probe.untouched_tables as
  select unnest(array[
    'daily_gut_rows', 'wearable_daily',
    'profiles', 'consent_records', 'antibiotic_courses', 'baseline_snapshots',
    'insight_cards', 'engagement_state', 'events', 'state_bands', 'signals',
    'derived_metrics', 'rules', 'personal_signals', 'composed_insights'
  ]::text[]) as tablename;
