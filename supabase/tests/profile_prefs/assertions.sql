-- supabase/tests/profile_prefs/assertions.sql
--
-- The security proof for UI gap 2's daily-digest preference
-- (migration 20260728040001_profile_daily_digest.sql).
--
-- The preference lives in `public.profile_notification_prefs`: RLS on, ZERO
-- policies, no grants for anon/authenticated. The only way in is two SECURITY
-- DEFINER functions that resolve the subject from auth.uid() themselves and take
-- NO user-id argument.
--
-- A definer function bypasses RLS. That is the point, and it is also the risk:
-- if either function ever accepted a user id, or leaked one, every user's
-- preference would be readable and writable by everyone. So these assertions are
-- run as two DIFFERENT authenticated subjects in PostgREST-shaped transactions
-- (`set local request.jwt.claims` + `set local role authenticated`), exactly the
-- way supabase/tests/authz/ runs its probes — not as the superuser, which would
-- pass vacuously.

create schema if not exists prefs_probe;

create table if not exists prefs_probe.result (
  id       bigint generated always as identity primary key,
  name     text    not null,
  expected text    not null,
  actual   text    not null,
  ok       boolean not null
);

create or replace function prefs_probe.expect_value(p_name text, p_sql text, p_expected text)
returns void language plpgsql as $$
declare v_actual text;
begin
  begin
    execute p_sql into v_actual;
  exception when others then
    v_actual := 'ERROR ' || sqlstate;
  end;
  v_actual := coalesce(v_actual, '<null>');
  insert into prefs_probe.result (name, expected, actual, ok)
  values (p_name, p_expected, v_actual, v_actual = p_expected);
end $$;

create or replace function prefs_probe.expect_error(p_name text, p_sql text, p_sqlstate text)
returns void language plpgsql as $$
declare v_actual text;
begin
  begin
    execute p_sql;
    v_actual := 'no error';
  exception when others then
    v_actual := sqlstate;
  end;
  insert into prefs_probe.result (name, expected, actual, ok)
  values (p_name, p_sqlstate, v_actual, v_actual = p_sqlstate);
end $$;

-- The probe helpers are SECURITY INVOKER, so every `execute` inside them runs as
-- the CALLER — which is exactly what makes the `set local role authenticated`
-- sections below meaningful. That in turn means the probe roles need reach into
-- this schema (recording a result, nothing more).
grant usage on schema prefs_probe to anon, authenticated, service_role;
grant select, insert on prefs_probe.result to anon, authenticated, service_role;
grant usage, select on all sequences in schema prefs_probe
  to anon, authenticated, service_role;
grant execute on function prefs_probe.expect_value(text, text, text)
  to anon, authenticated, service_role;
grant execute on function prefs_probe.expect_error(text, text, text)
  to anon, authenticated, service_role;

-- Two real subjects. Both exist in auth.users so the FK holds.
insert into auth.users (id, email) values
  ('cccccccc-0000-4000-8000-000000000001', 'alice@example.test'),
  ('cccccccc-0000-4000-8000-000000000002', 'mallory@example.test')
on conflict (id) do nothing;

-- ═════════════════════════════════════════════════════════════════════════════
-- 1 · OBJECT SHAPE — the properties the isolation rests on
-- ═════════════════════════════════════════════════════════════════════════════

select prefs_probe.expect_value('shape.getter_takes_no_arguments',
  'select pronargs::text from pg_proc
     where oid = ''public.get_daily_digest_enabled()''::regprocedure', '0');

-- The setter takes the flag and NOTHING else. If a uuid argument is ever added,
-- this fails before any behavioural test gets a chance to.
select prefs_probe.expect_value('shape.setter_takes_only_a_boolean',
  'select pg_get_function_identity_arguments(
            ''public.set_daily_digest_enabled(boolean)''::regprocedure)', 'p_enabled boolean');

select prefs_probe.expect_value('shape.no_overload_accepts_a_uuid',
  'select count(*)::text from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace and n.nspname = ''public''
    where p.proname in (''get_daily_digest_enabled'', ''set_daily_digest_enabled'')
      and ''uuid''::regtype = any(p.proargtypes::oid[])', '0');

select prefs_probe.expect_value('shape.getter_is_security_definer',
  'select prosecdef::text from pg_proc
     where oid = ''public.get_daily_digest_enabled()''::regprocedure', 'true');
select prefs_probe.expect_value('shape.setter_is_security_definer',
  'select prosecdef::text from pg_proc
     where oid = ''public.set_daily_digest_enabled(boolean)''::regprocedure', 'true');

select prefs_probe.expect_value('shape.getter_search_path_is_pinned',
  'select array_to_string(proconfig, '','') from pg_proc
     where oid = ''public.get_daily_digest_enabled()''::regprocedure',
  'search_path=public, pg_temp');
select prefs_probe.expect_value('shape.setter_search_path_is_pinned',
  'select array_to_string(proconfig, '','') from pg_proc
     where oid = ''public.set_daily_digest_enabled(boolean)''::regprocedure',
  'search_path=public, pg_temp');

-- ═════════════════════════════════════════════════════════════════════════════
-- 2 · THE TABLE IS SEALED — RLS on, zero policies, no API-role grants
-- ═════════════════════════════════════════════════════════════════════════════

select prefs_probe.expect_value('sealed.rls_is_enabled',
  'select relrowsecurity::text from pg_class
     where oid = ''public.profile_notification_prefs''::regclass', 'true');

-- The constraint that keeps R4-U2's nonreg policy counts intact, asserted here
-- so it cannot be "fixed" by adding a policy without this failing.
select prefs_probe.expect_value('sealed.zero_policies',
  'select count(*)::text from pg_policies
     where schemaname = ''public'' and tablename = ''profile_notification_prefs''', '0');

select prefs_probe.expect_value('sealed.authenticated_has_no_table_privilege',
  'select count(*)::text from unnest(array[''SELECT'', ''INSERT'', ''UPDATE'', ''DELETE'']) p
    where has_table_privilege(''authenticated'',
                              ''public.profile_notification_prefs'', p)', '0');
select prefs_probe.expect_value('sealed.anon_has_no_table_privilege',
  'select count(*)::text from unnest(array[''SELECT'', ''INSERT'', ''UPDATE'', ''DELETE'']) p
    where has_table_privilege(''anon'', ''public.profile_notification_prefs'', p)', '0');

select prefs_probe.expect_value('sealed.anon_cannot_execute_getter',
  'select has_function_privilege(''anon'',
     ''public.get_daily_digest_enabled()'', ''EXECUTE'')::text', 'false');
select prefs_probe.expect_value('sealed.anon_cannot_execute_setter',
  'select has_function_privilege(''anon'',
     ''public.set_daily_digest_enabled(boolean)'', ''EXECUTE'')::text', 'false');
select prefs_probe.expect_value('sealed.authenticated_can_execute_getter',
  'select has_function_privilege(''authenticated'',
     ''public.get_daily_digest_enabled()'', ''EXECUTE'')::text', 'true');
select prefs_probe.expect_value('sealed.authenticated_can_execute_setter',
  'select has_function_privilege(''authenticated'',
     ''public.set_daily_digest_enabled(boolean)'', ''EXECUTE'')::text', 'true');

-- ═════════════════════════════════════════════════════════════════════════════
-- 3 · `profiles` WAS NOT TOUCHED — the reason this design exists
-- ═════════════════════════════════════════════════════════════════════════════

select prefs_probe.expect_value('profiles.has_no_digest_column',
  'select count(*)::text from information_schema.columns
    where table_schema = ''public'' and table_name = ''profiles''
      and column_name like ''%digest%''', '0');

select prefs_probe.expect_value('profiles.column_count_is_unchanged',
  'select count(*)::text from information_schema.columns
    where table_schema = ''public'' and table_name = ''profiles''', '8');

-- ═════════════════════════════════════════════════════════════════════════════
-- 4 · CROSS-USER ISOLATION, exercised as two real authenticated subjects
-- ═════════════════════════════════════════════════════════════════════════════

-- Alice opts in.
begin;
  set local request.jwt.claims = '{"sub": "cccccccc-0000-4000-8000-000000000001", "role": "authenticated"}';
  set local role authenticated;
  select prefs_probe.expect_value('alice.default_is_false_before_any_write',
    'select public.get_daily_digest_enabled()::text', 'false');
  select prefs_probe.expect_value('alice.setter_echoes_the_stored_value',
    'select public.set_daily_digest_enabled(true)::text', 'true');
  select prefs_probe.expect_value('alice.reads_back_her_own_true',
    'select public.get_daily_digest_enabled()::text', 'true');
commit;

-- Mallory, a different authenticated user, must not see Alice's value...
begin;
  set local request.jwt.claims = '{"sub": "cccccccc-0000-4000-8000-000000000002", "role": "authenticated"}';
  set local role authenticated;

  select prefs_probe.expect_value('mallory.getter_cannot_read_alices_preference',
    'select public.get_daily_digest_enabled()::text', 'false');

  -- ...and has no table-level route to it either. Both locks are checked: the
  -- grant (42501) is what raises; the absent policy alone would have returned an
  -- empty result silently.
  select prefs_probe.expect_error('mallory.direct_table_select_is_refused',
    'select count(*) from public.profile_notification_prefs', '42501');
  select prefs_probe.expect_error('mallory.direct_table_update_is_refused',
    'update public.profile_notification_prefs set daily_digest_enabled = false', '42501');
  select prefs_probe.expect_error('mallory.direct_table_insert_is_refused',
    'insert into public.profile_notification_prefs (user_id, daily_digest_enabled)
       values (''cccccccc-0000-4000-8000-000000000001'', false)', '42501');

  -- The setter writes MALLORY's row, never Alice's — there is no argument with
  -- which to aim it at anyone else.
  select prefs_probe.expect_value('mallory.setter_writes_only_her_own_row',
    'select public.set_daily_digest_enabled(false)::text', 'false');
commit;

-- Alice's value survived Mallory's write untouched.
begin;
  set local request.jwt.claims = '{"sub": "cccccccc-0000-4000-8000-000000000001", "role": "authenticated"}';
  set local role authenticated;
  select prefs_probe.expect_value('alice.preference_survived_the_other_users_write',
    'select public.get_daily_digest_enabled()::text', 'true');
commit;

-- Two distinct rows exist: the write really did land per-subject, so the
-- isolation above is not just "nothing was written anywhere".
select prefs_probe.expect_value('storage.one_row_per_subject',
  'select count(*)::text from public.profile_notification_prefs
    where user_id in (''cccccccc-0000-4000-8000-000000000001'',
                      ''cccccccc-0000-4000-8000-000000000002'')', '2');
select prefs_probe.expect_value('storage.alice_row_is_true',
  'select daily_digest_enabled::text from public.profile_notification_prefs
    where user_id = ''cccccccc-0000-4000-8000-000000000001''', 'true');
select prefs_probe.expect_value('storage.mallory_row_is_false',
  'select daily_digest_enabled::text from public.profile_notification_prefs
    where user_id = ''cccccccc-0000-4000-8000-000000000002''', 'false');

-- ═════════════════════════════════════════════════════════════════════════════
-- 5 · UNAUTHENTICATED CALLERS
-- ═════════════════════════════════════════════════════════════════════════════

-- No JWT claim at all: auth.uid() is null. The setter must refuse rather than
-- upsert a null primary key, and the getter must answer false rather than leak
-- an arbitrary row.
begin;
  set local role authenticated;
  select prefs_probe.expect_error('nojwt.setter_refuses',
    'select public.set_daily_digest_enabled(true)', '42501');
  select prefs_probe.expect_value('nojwt.getter_answers_false',
    'select public.get_daily_digest_enabled()::text', 'false');
commit;

-- The anon role cannot even reach the functions (grant layer, not logic layer).
begin;
  set local role anon;
  select prefs_probe.expect_error('anon.cannot_call_getter',
    'select public.get_daily_digest_enabled()', '42501');
  select prefs_probe.expect_error('anon.cannot_call_setter',
    'select public.set_daily_digest_enabled(true)', '42501');
commit;

-- Nothing leaked into a third row along the way.
select prefs_probe.expect_value('storage.no_stray_rows',
  'select count(*)::text from public.profile_notification_prefs', '2');
