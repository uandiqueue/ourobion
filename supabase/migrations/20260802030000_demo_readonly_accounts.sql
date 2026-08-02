-- The shared demo account: app writes are silently discarded.
--
-- SCOPE: exactly ONE account — `test@ourobion.com`. No other user's rows can reach the trigger.
-- That is enforced structurally, not by a predicate inside the function: each trigger carries a
-- `WHEN (user_id = '<the resolved uuid>')` clause, so for every other user Postgres never fires
-- it at all. The uuid is resolved from `auth.users` at APPLY time and baked into the trigger
-- definition, so this file carries no environment-specific literal and no membership table.
--
-- WHY DISCARD RATHER THAN REJECT. The account is handed to judges, who must be able to use every
-- feature — log a day, swipe the deck, edit the profile — without seeing an error, while nothing
-- they do changes what the next judge sees. A restrictive RLS policy gives the second property
-- but not the first: a blocked write raises `42501 new row violates row-level security policy`,
-- and biotope's writes are bare `await` calls with no try/catch at the call site (see
-- logging_controller.dart:263,300 and engagement_service.dart), so the error would surface raw.
--
-- A BEFORE ... FOR EACH ROW trigger returning NULL skips the row's operation WITHOUT raising:
-- PostgREST answers 2xx, the Flutter `await` completes, the UI updates optimistically. The write
-- never lands. On the next refetch or app restart the seeded state is back, untouched — which is
-- what keeps the insight cards permanently present.
--
-- THE PIPELINE STILL WRITES. The WHEN clause also requires `auth.uid() is not null`, i.e. an
-- end-user session. `generate-insights`, `compute-baselines` and the loader connect as
-- `service_role` with no end-user JWT, so `auth.uid()` is NULL and their writes proceed normally.
-- New insight cards keep being generated for the demo user.
--
-- ⚠ NOT A SECURITY BOUNDARY. This stops a viewer spoiling shared demo state. It is not an
-- authorization control — it drops writes silently rather than refusing them, the opposite of
-- fail-loud. Never reuse this pattern to protect anything that matters; for that use the
-- restrictive-policy idiom in 20260728010002_nao_redaction_grants.sql.
--
-- ROLLBACK (releases the account, no migration needed):
--   do $$ declare t text; begin
--     foreach t in array array['daily_gut_rows','antibiotic_courses','wearable_daily',
--                              'insight_cards','engagement_state','profiles','consent_records']
--     loop
--       execute format('drop trigger if exists discard_demo_write_ins_upd on public.%I', t);
--       execute format('drop trigger if exists discard_demo_write_del on public.%I', t);
--     end loop;
--   end $$;

-- ═══════════════════════════════════════════════════════════════
-- 1. TRIGGER FUNCTION — unconditional, because the WHEN clause is the filter
-- ═══════════════════════════════════════════════════════════════
--
-- Deliberately has no logic. Every decision about WHO this applies to lives in the trigger's
-- WHEN clause, where it is visible in `\d <table>` rather than hidden in a function body. A
-- reader checking the blast radius reads the trigger definition, not this.

create or replace function public.discard_demo_write()
  returns trigger
  language plpgsql
as $$
begin
  -- NULL from a BEFORE ROW trigger = skip this row's operation, silently, no error.
  return null;
end;
$$;

comment on function public.discard_demo_write() is
  'BEFORE ROW trigger body: drops the row operation without raising. Attached ONLY via a WHEN '
  'clause pinned to a specific demo user_id — see 20260802030000.';

-- ═══════════════════════════════════════════════════════════════
-- 2. ATTACH — only to the demo account's rows, on the tables biotope writes
-- ═══════════════════════════════════════════════════════════════
--
-- Two triggers per table because a WHEN clause cannot reference NEW on DELETE or OLD on INSERT.
--
--   daily_gut_rows / antibiotic_courses / wearable_daily  the logged health data
--   insight_cards                                         swipe-to-dismiss and deck recovery —
--                                                         THIS is what keeps the cards present
--   engagement_state                                      streaks and counters
--   profiles / consent_records                            profile edits and consent toggles
--
-- All seven key their owner on `user_id uuid` (verified against each create table).
-- Trim this list to just `insight_cards` if only the deck needs protecting.

do $$
declare
  demo_id uuid;
  t       text;
begin
  select id into demo_id from auth.users where email = 'test@ourobion.com';

  if demo_id is null then
    -- No such account in this database (CI's shadow apply, a fresh local stack, any other
    -- environment). Create NOTHING: an unbound trigger here would sit in every user's write
    -- path, which is exactly what this design refuses to do.
    raise notice 'demo account test@ourobion.com not present - no triggers created';
    return;
  end if;

  foreach t in array array[
    'daily_gut_rows',
    'antibiotic_courses',
    'wearable_daily',
    'insight_cards',
    'engagement_state',
    'profiles',
    'consent_records'
  ] loop
    execute format('drop trigger if exists discard_demo_write_ins_upd on public.%I', t);
    execute format('drop trigger if exists discard_demo_write_del on public.%I', t);

    execute format(
      'create trigger discard_demo_write_ins_upd
         before insert or update on public.%I
         for each row
         when (new.user_id = %L::uuid and auth.uid() is not null)
         execute function public.discard_demo_write()', t, demo_id);

    execute format(
      'create trigger discard_demo_write_del
         before delete on public.%I
         for each row
         when (old.user_id = %L::uuid and auth.uid() is not null)
         execute function public.discard_demo_write()', t, demo_id);
  end loop;

  raise notice 'demo read-only triggers bound to user %', demo_id;
end $$;
