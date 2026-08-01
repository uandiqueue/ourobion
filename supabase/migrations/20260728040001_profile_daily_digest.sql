-- UI gap 2 · daily-digest preference — real server-side persistence for the
-- Profile tab's "Daily digest" toggle.
--
-- ═══════════════════════════════════════════════════════════════
-- WHY THIS IS A NEW TABLE + RPCs AND NOT A COLUMN ON `profiles`
-- ═══════════════════════════════════════════════════════════════
-- The obvious shape — `alter table public.profiles add column
-- daily_digest_enabled` — was implemented first and MEASURABLY breaks R4-U2's
-- authorization proof (supabase/tests/authz/run.mjs): 443 assertions, 441
-- passed, 2 failed.
--
--   post nonreg.column_privileges_unchanged_on_untouched_tables
--       expected 0, actual 12
--   post nonreg.column_privileges_changed_only_on_the_three_redacted_tables
--       expected 0, actual 12
--
-- `authz_probe.untouched_tables` (20_probe_harness.sql) names `profiles` among
-- 15 tables whose effective column privileges must stay byte-identical to the
-- pre-U2 snapshot. One new column produces 12 new privilege rows (1 column x 3
-- roles x 4 column-level privilege types), so the diff fires. That suite is the
-- spec here, not an obstacle.
--
-- A new table carrying an ordinary RLS policy is ALSO blocked:
-- `nonreg.new_permissive_policies_only_on_the_two_new_tables` pins the number of
-- new PERMISSIVE policies at exactly 3.
--
-- So this follows the shape R4-U2 already established for `nao_members`: a table
-- with RLS on and ZERO policies, reachable only through SECURITY DEFINER
-- functions that do the `auth.uid()` check themselves. The new table is outside
-- both assertions because it is absent from `untouched_tables` and absent from
-- the pre-U2 `colpriv_snapshot` (it is created in the runner's phase 3); it adds
-- no policy, so every policy count is untouched.
--
-- HONESTY NOTE: this records a PREFERENCE. Nothing in this repo composes, sends
-- or schedules a digest — no job, edge function or notification path exists. The
-- Profile tab's copy says so out loud. Do not read a true value here as "a digest
-- was delivered".

-- ═══════════════════════════════════════════════════════════════
-- 1. TABLE — RLS on, zero policies, no API-role grants
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.profile_notification_prefs (
  user_id              uuid primary key references auth.users(id) on delete cascade,
  daily_digest_enabled boolean     not null default false,
  updated_at           timestamptz not null default now()
);

comment on table public.profile_notification_prefs is
  'Per-user notification preferences. Deliberately has RLS enabled and NO policies: '
  'anon and authenticated hold no grants on it and reach it only through '
  'public.get_daily_digest_enabled() / public.set_daily_digest_enabled(boolean), '
  'which resolve the subject from auth.uid() themselves. Kept off the profiles table '
  'because R4-U2''s non-regression suite pins that table''s column-privilege map '
  '(see the header of this migration).';

comment on column public.profile_notification_prefs.daily_digest_enabled is
  'User preference: opted in to a daily digest. Preference only — no digest is '
  'composed or delivered by any job or function in this repo yet.';

alter table public.profile_notification_prefs enable row level security;

-- NO POLICIES ON PURPOSE. With RLS enabled and no policy, every non-owner role
-- sees zero rows and can write none, whatever grants it may hold. The definer
-- functions below are owned by this table's owner and therefore bypass RLS —
-- exactly the single controlled door this design wants.

-- Supabase's `alter default privileges in schema public grant all on tables to
-- anon, authenticated, service_role` (reproduced verbatim by the harness shim,
-- 10_supabase_shim.sql) means a brand-new table arrives fully granted. Belt and
-- braces alongside the absent policies: a missing policy alone makes a write
-- affect zero rows SILENTLY, whereas a missing grant raises 42501.
revoke all on public.profile_notification_prefs from anon, authenticated;

-- service_role keeps direct table access for back-office/export. It has no
-- auth.uid(), so the RPCs below are useless to it and this is the only way it
-- could ever read the table.
grant select, insert, update, delete on public.profile_notification_prefs to service_role;

-- ═══════════════════════════════════════════════════════════════
-- 2. THE ONLY DOOR — two SECURITY DEFINER functions
-- ═══════════════════════════════════════════════════════════════
-- NEITHER TAKES A USER ID. That is the security property, not a convenience:
-- there is no argument through which a caller could name someone else's row, so
-- cross-user read and cross-user write are unreachable by construction rather
-- than by a check somebody could later forget. search_path is pinned on both, so
-- a caller cannot shadow `public` with a temp object and redirect the body.

create or replace function public.get_daily_digest_enabled()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select p.daily_digest_enabled
       from public.profile_notification_prefs p
      where p.user_id = auth.uid()),
    false)
$$;

comment on function public.get_daily_digest_enabled() is
  'The CALLER''s own daily-digest preference, false when they have never set one. '
  'Takes no arguments by design: it must be impossible to ask about another user.';

create or replace function public.set_daily_digest_enabled(p_enabled boolean)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  -- A definer function runs as its owner, so an unauthenticated caller has to be
  -- rejected explicitly; without this, auth.uid() = null would attempt a NULL
  -- primary key and raise a confusing not-null error instead of a clean 403.
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  insert into public.profile_notification_prefs (user_id, daily_digest_enabled, updated_at)
  values (v_uid, p_enabled, now())
  on conflict (user_id) do update
    set daily_digest_enabled = excluded.daily_digest_enabled,
        updated_at           = now();

  return p_enabled;
end
$$;

comment on function public.set_daily_digest_enabled(boolean) is
  'Upserts the CALLER''s own daily-digest preference and echoes the stored value. '
  'Takes only the flag by design: no argument names a user, so it cannot write '
  'another person''s row. Raises 42501 when unauthenticated.';

-- Functions default to EXECUTE for PUBLIC, and Supabase's default privileges
-- grant EXECUTE to anon and service_role as well. Both come off before the
-- intended grant goes on.
revoke execute on function public.get_daily_digest_enabled()        from public, anon, service_role;
revoke execute on function public.set_daily_digest_enabled(boolean) from public, anon, service_role;

-- authenticated only. service_role is excluded deliberately rather than by
-- omission: it has no auth.uid(), so these functions would either raise or
-- answer for nobody.
grant execute on function public.get_daily_digest_enabled()        to authenticated;
grant execute on function public.set_daily_digest_enabled(boolean) to authenticated;
