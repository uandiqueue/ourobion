-- supabase/tests/u3/10_seed.sql
--
-- Fixtures for the R4-U3 atomic-loader proof harness, applied as the superuser AFTER every
-- migration in supabase/migrations/ and BEFORE 20_assertions.sql.
--
-- SYNTHETIC IDENTITIES ONLY. Every uuid below is a hand-written non-random pattern and every email
-- is on the reserved `.invalid` TLD (RFC 2606), which can never resolve. There is no credential of
-- any kind here — the harness never authenticates; it ASSERTS claims exactly as PostgREST installs
-- them (see supabase/tests/authz/20_probe_harness.sql:7-22, whose primitives this harness reuses by
-- path rather than by copy).
--
--   cccccccc-…-0001  viewer      effective nao member, tier viewer      → insufficient tier
--   cccccccc-…-0002  curator     effective nao member, tier curator     → THE ACTING CALLER
--   cccccccc-…-0003  admin       effective nao member, tier admin
--   cccccccc-…-0004  suspended   nao_members row, status = 'suspended'  → denied
--   cccccccc-…-0005  revoked     nao_members row, revoked_at set        → denied
--
--   dddddddd-…-0001  demo:u3-happy        registered target, clean
--   dddddddd-…-0002  demo:u3-conflict-gut registered; ONE REAL gut row (data_origin IS NULL)
--   dddddddd-…-0003  demo:u3-conflict-wear registered; ONE REAL wearable row (source IS NULL),
--                                          and NO gut row at all — the asymmetric case
--   dddddddd-…-0004  demo:u3-rollback     registered, clean (forced second-table failure)
--   dddddddd-…-0005  demo:u3-replay       registered, clean (sequential idempotency)
--   dddddddd-…-0006  demo:u3-concurrent   registered, clean (two concurrent callers)
--   dddddddd-…-0007  demo:u3-sparse       registered; simulated gut on 07-01 and simulated
--                                          wearable on 07-02 — mismatched, half-loaded history
--   dddddddd-…-0008  demo:u3-marker       registered; wearable row bearing an UNREGISTERED marker
--   dddddddd-…-0009  demo:u3-retired      registered; gut row bearing a REGISTERED-THEN-REVOKED
--                                          marker
--   dddddddd-…-0010  demo:u3-lease        registered, clean (publication lease)
--   dddddddd-…-0011  demo:u3-gone         registered THEN revoked  → target denied
--   dddddddd-…-0012  demo:u3-toplevel     registered, clean (top-level transaction abort, driven
--                                          from run.mjs rather than from a plpgsql subtransaction)
--   dddddddd-…-0013  demo:u3-release      registered (release / repair / residue)
--   dddddddd-…-0014  demo:u3-fold         registered (derived-status fold: incomplete → failed)
--   dddddddd-…-0015  demo:u3-mixed        registered (derived-status fold: mixed)
--
--   eeeeeeee-…-0001  never registered as a demo target        → target denied
--   eeeeeeee-…-0002  registered as demo:u3-member AND holding an effective nao_members row
--                    → target denied by the MEMBERSHIP check, independently of registration
--   eeeeeeee-…-0003  biotope-only: no nao_members row         → an ordinary Biotope user

set authz_probe.phase = 'u3';

-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 1 · Identities
-- ═════════════════════════════════════════════════════════════════════════════════════════════

insert into auth.users (id, email) values
  ('cccccccc-0000-4000-8000-000000000001', 'u3-viewer@harness.invalid'),
  ('cccccccc-0000-4000-8000-000000000002', 'u3-curator@harness.invalid'),
  ('cccccccc-0000-4000-8000-000000000003', 'u3-admin@harness.invalid'),
  ('cccccccc-0000-4000-8000-000000000004', 'u3-suspended@harness.invalid'),
  ('cccccccc-0000-4000-8000-000000000005', 'u3-revoked@harness.invalid'),
  ('dddddddd-0000-4000-8000-000000000001', 'u3-happy@harness.invalid'),
  ('dddddddd-0000-4000-8000-000000000002', 'u3-conflict-gut@harness.invalid'),
  ('dddddddd-0000-4000-8000-000000000003', 'u3-conflict-wear@harness.invalid'),
  ('dddddddd-0000-4000-8000-000000000004', 'u3-rollback@harness.invalid'),
  ('dddddddd-0000-4000-8000-000000000005', 'u3-replay@harness.invalid'),
  ('dddddddd-0000-4000-8000-000000000006', 'u3-concurrent@harness.invalid'),
  ('dddddddd-0000-4000-8000-000000000007', 'u3-sparse@harness.invalid'),
  ('dddddddd-0000-4000-8000-000000000008', 'u3-marker@harness.invalid'),
  ('dddddddd-0000-4000-8000-000000000009', 'u3-retired@harness.invalid'),
  ('dddddddd-0000-4000-8000-000000000010', 'u3-lease@harness.invalid'),
  ('dddddddd-0000-4000-8000-000000000011', 'u3-gone@harness.invalid'),
  ('dddddddd-0000-4000-8000-000000000012', 'u3-toplevel@harness.invalid'),
  ('dddddddd-0000-4000-8000-000000000013', 'u3-release@harness.invalid'),
  ('dddddddd-0000-4000-8000-000000000014', 'u3-fold@harness.invalid'),
  ('dddddddd-0000-4000-8000-000000000015', 'u3-mixed@harness.invalid'),
  ('eeeeeeee-0000-4000-8000-000000000001', 'u3-unregistered@harness.invalid'),
  ('eeeeeeee-0000-4000-8000-000000000002', 'u3-member-target@harness.invalid'),
  ('eeeeeeee-0000-4000-8000-000000000003', 'u3-biotope@harness.invalid');

-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 2 · nao membership (R4-U2's table — the loader's gate reads THIS, not a claim)
-- ═════════════════════════════════════════════════════════════════════════════════════════════

insert into public.nao_members (user_id, role) values
  ('cccccccc-0000-4000-8000-000000000001', 'viewer'),
  ('cccccccc-0000-4000-8000-000000000002', 'curator'),
  ('cccccccc-0000-4000-8000-000000000003', 'admin'),
  -- eeeeeeee-…-0002 is BOTH a registered demo target and an effective member. It exists to prove
  -- the membership check binds on its own, so the loader can never become a door onto another
  -- dev's rows (pc_probe's subject).
  ('eeeeeeee-0000-4000-8000-000000000002', 'viewer');

insert into public.nao_members (user_id, role, status) values
  ('cccccccc-0000-4000-8000-000000000004', 'admin', 'suspended');

insert into public.nao_members (user_id, role, revoked_at) values
  ('cccccccc-0000-4000-8000-000000000005', 'admin', now());

-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 3 · Registries
-- ═════════════════════════════════════════════════════════════════════════════════════════════

-- A registered-THEN-REVOKED origin. Retiring an origin must fail CLOSED: rows bearing it become
-- protected, and it can no longer be written.
insert into public.nao_simulation_origins (origin, label, owner, revoked_at) values
  ('retired:marker', 'harness · registered then revoked', 'supabase/tests/u3/10_seed.sql', now());

insert into public.nao_demo_targets (user_id, label, note) values
  ('dddddddd-0000-4000-8000-000000000001', 'demo:u3-happy',         'harness'),
  ('dddddddd-0000-4000-8000-000000000002', 'demo:u3-conflict-gut',  'harness'),
  ('dddddddd-0000-4000-8000-000000000003', 'demo:u3-conflict-wear', 'harness'),
  ('dddddddd-0000-4000-8000-000000000004', 'demo:u3-rollback',      'harness'),
  ('dddddddd-0000-4000-8000-000000000005', 'demo:u3-replay',        'harness'),
  ('dddddddd-0000-4000-8000-000000000006', 'demo:u3-concurrent',    'harness'),
  ('dddddddd-0000-4000-8000-000000000007', 'demo:u3-sparse',        'harness'),
  ('dddddddd-0000-4000-8000-000000000008', 'demo:u3-marker',        'harness'),
  ('dddddddd-0000-4000-8000-000000000009', 'demo:u3-retired',       'harness'),
  ('dddddddd-0000-4000-8000-000000000010', 'demo:u3-lease',         'harness'),
  ('dddddddd-0000-4000-8000-000000000012', 'demo:u3-toplevel',      'harness'),
  ('dddddddd-0000-4000-8000-000000000013', 'demo:u3-release',       'harness'),
  ('dddddddd-0000-4000-8000-000000000014', 'demo:u3-fold',          'harness'),
  ('dddddddd-0000-4000-8000-000000000015', 'demo:u3-mixed',         'harness'),
  ('eeeeeeee-0000-4000-8000-000000000002', 'demo:u3-member',        'harness');

-- Registered and then revoked: still a row (audit), but not a permitted target.
insert into public.nao_demo_targets (user_id, label, note, revoked_at) values
  ('dddddddd-0000-4000-8000-000000000011', 'demo:u3-gone', 'harness', now());

-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 4 · Pre-existing raw-truth rows — the provenance cases the loader must respect
--
--     NULL provenance = REAL user-entered data (the semantics migration 20260724120000 declared).
--     Nothing here is written by the loader; these rows exist so "never overwrite real rows" is
--     actually exercised rather than merely asserted about an empty table.
-- ═════════════════════════════════════════════════════════════════════════════════════════════

-- (a) A REAL gut row in the middle of the range the loader will request.
insert into public.daily_gut_rows
  (user_id, log_date, region, energy_score, mood_score, gut_comfort_score, notes, data_origin)
values
  ('dddddddd-0000-4000-8000-000000000002', date '2026-07-03', 'real-region', 5, 5, 5,
   'a real self-report', null);

-- (b) A REAL wearable row, with NO gut row for that user at all. Provenance is checked per table,
--     so the ABSENCE of a gut row must not excuse the protected wearable row.
insert into public.wearable_daily (user_id, date, resting_hr_bpm, hrv_sdnn_ms, source)
values ('dddddddd-0000-4000-8000-000000000003', date '2026-07-04', 58, 71, null);

-- (c) Half-loaded, mismatched simulated history: gut on one date, wearable on ANOTHER. Both bear a
--     registered simulated marker, so both are overwritable — this is how a pre-U3 partially
--     applied day heals.
insert into public.daily_gut_rows (user_id, log_date, region, data_origin)
values ('dddddddd-0000-4000-8000-000000000007', date '2026-07-01', '', 'simulated:run2-demo');
insert into public.wearable_daily (user_id, date, resting_hr_bpm, source)
values ('dddddddd-0000-4000-8000-000000000007', date '2026-07-02', 62, 'simulated:run2-demo');

-- (d) An UNREGISTERED marker — a real provider value. Unregistered ⇒ treated as real ⇒ protected.
insert into public.wearable_daily (user_id, date, resting_hr_bpm, source)
values ('dddddddd-0000-4000-8000-000000000008', date '2026-07-05', 55, 'provider:oura');

-- (e) A REGISTERED-THEN-REVOKED marker. Revocation fails closed: the row is protected.
insert into public.daily_gut_rows (user_id, log_date, region, data_origin)
values ('dddddddd-0000-4000-8000-000000000009', date '2026-07-06', '', 'retired:marker');

-- (f) A REAL gut row for the release target, on a date OUTSIDE the load range, so the release path
--     can be shown to refuse removing it.
insert into public.daily_gut_rows
  (user_id, log_date, region, energy_score, notes, data_origin)
values ('dddddddd-0000-4000-8000-000000000013', date '2026-08-20', 'real-region', 4,
        'real, must survive release', null);

-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 5 · Byte-identity baselines for the "reject WITHOUT mutation" assertions
--
--     md5 over the whole row's text form, so ANY column moving — including updated_at / synced_at,
--     which is what a stray upsert would touch — changes the digest.
-- ═════════════════════════════════════════════════════════════════════════════════════════════

create table if not exists authz_probe.u3_baseline (
  tag    text primary key,
  digest text not null
);

insert into authz_probe.u3_baseline (tag, digest)
select 'real_gut_conflict', md5(g::text) from public.daily_gut_rows g
 where g.user_id = 'dddddddd-0000-4000-8000-000000000002' and g.log_date = date '2026-07-03';

insert into authz_probe.u3_baseline (tag, digest)
select 'real_wearable_conflict', md5(w::text) from public.wearable_daily w
 where w.user_id = 'dddddddd-0000-4000-8000-000000000003' and w.date = date '2026-07-04';

insert into authz_probe.u3_baseline (tag, digest)
select 'unregistered_marker', md5(w::text) from public.wearable_daily w
 where w.user_id = 'dddddddd-0000-4000-8000-000000000008' and w.date = date '2026-07-05';

insert into authz_probe.u3_baseline (tag, digest)
select 'retired_marker', md5(g::text) from public.daily_gut_rows g
 where g.user_id = 'dddddddd-0000-4000-8000-000000000009' and g.log_date = date '2026-07-06';

insert into authz_probe.u3_baseline (tag, digest)
select 'release_real_gut', md5(g::text) from public.daily_gut_rows g
 where g.user_id = 'dddddddd-0000-4000-8000-000000000013' and g.log_date = date '2026-08-20';

-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 6 · Harness helpers. All SECURITY INVOKER, so every statement they execute is evaluated as the
--     session's current role — a definer here would make the whole suite pass vacuously
--     (20_probe_harness.sql:37-41).
-- ═════════════════════════════════════════════════════════════════════════════════════════════

-- Record the MESSAGE of a denial, not just its SQLSTATE. This is what proves the loader is not an
-- oracle: five different denial reasons must be indistinguishable in the text a caller sees.
create or replace function authz_probe.u3_expect_message(p_name text, p_sql text, p_expected text)
returns void
language plpgsql
as $$
declare
  act text;
begin
  begin
    execute p_sql;
    act := '<no error>';
  exception when others then
    act := sqlerrm;
  end;
  perform authz_probe.record(p_name, p_expected, act);
end
$$;

-- Capture a jsonb-returning statement's value (or its failure) so a LATER file, running as the
-- superuser, can compare it against the ledger. Used by the concurrency children, which run in
-- their own psql sessions.
create table if not exists authz_probe.u3_capture (
  key   text primary key,
  value jsonb
);
grant select, insert, update on authz_probe.u3_capture to anon, authenticated, service_role;

create or replace function authz_probe.u3_capture_jsonb(p_key text, p_sql text)
returns void
language plpgsql
as $$
declare
  v jsonb;
begin
  begin
    execute p_sql into v;
  exception when others then
    v := jsonb_build_object('sqlstate', sqlstate, 'message', sqlerrm);
  end;
  insert into authz_probe.u3_capture (key, value) values (p_key, v)
    on conflict (key) do update set value = excluded.value;
end
$$;

-- ── Payload builders. The real payload is generated in TypeScript (the seeded generator is the one
--    truth for row content); these produce a payload of the SAME SHAPE so the RPC's validation,
--    provenance and atomicity behaviour is exercised without duplicating the generator.

create or replace function authz_probe.u3_gut(p_date date)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'log_date', p_date::text, 'region', 'harness',
    'urine_colour', 3, 'stool_form', 4, 'stool_count', 1, 'stool_variability', 0,
    'outside_meals', 1, 'mosquito_bites', 0,
    'energy_score', 3, 'mood_score', 3, 'gut_comfort_score', 3,
    'symptom_flags', jsonb_build_array(), 'notes', 'harness day',
    'standing_water_present', false, 'on_antibiotics', false, 'gut_watch_active', false,
    'log_completeness', 100,
    -- Deliberately present and deliberately IGNORED: the RPC's insert select list never reads a
    -- caller-supplied user_id, id or provenance.
    'user_id', 'ffffffff-0000-4000-8000-00000000ffff',
    'data_origin', 'simulated:not-this-one')
$$;

create or replace function authz_probe.u3_wear(p_date date)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'date', p_date::text, 'resting_hr_bpm', 60, 'hrv_sdnn_ms', 45,
    'sleep_duration_min', 420, 'spo2_pct', 97, 'body_temp_c', 36.6, 'step_count', 8000,
    'user_id', 'ffffffff-0000-4000-8000-00000000ffff',
    'source', 'simulated:not-this-one')
$$;

-- A contiguous run of p_days days from p_start, with either or both channels.
create or replace function authz_probe.u3_days(
  p_start date, p_days integer, p_gut boolean default true, p_wear boolean default true)
returns jsonb
language sql
immutable
as $$
  select coalesce(jsonb_agg(
           jsonb_build_object('date', (p_start + i)::text)
           || case when p_gut  then jsonb_build_object('gut',  authz_probe.u3_gut(p_start + i))
                   else '{}'::jsonb end
           || case when p_wear then jsonb_build_object('wearable', authz_probe.u3_wear(p_start + i))
                   else '{}'::jsonb end
           order by i), '[]'::jsonb)
    from generate_series(0, p_days - 1) i
$$;

-- One explicit day, either channel — for sparse/mismatched payloads assembled by hand.
create or replace function authz_probe.u3_day(
  p_date date, p_gut boolean, p_wear boolean)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object('date', p_date::text)
         || case when p_gut  then jsonb_build_object('gut',  authz_probe.u3_gut(p_date))
                 else '{}'::jsonb end
         || case when p_wear then jsonb_build_object('wearable', authz_probe.u3_wear(p_date))
                 else '{}'::jsonb end
$$;

-- The apply call as a text statement, so expect_ok / expect_error / u3_expect_message can execute it
-- under the caller's own role.
create or replace function authz_probe.u3_apply_sql(
  p_target text, p_key text, p_days jsonb, p_origin text default 'simulated:run4-demo')
returns text
language sql
immutable
as $$
  select format(
    'select public.nao_loader_apply_simulated_days(%s, %L, %L, %L::jsonb, %L::jsonb)',
    case when p_target is null then 'null::uuid' else quote_literal(p_target) || '::uuid' end,
    p_key, p_origin, '{"scenario":"steady","seed":"harness","anchorDate":"2026-07-14"}',
    p_days::text)
$$;

-- Three pipeline stages, all ok — the shape apps/nao passes to nao_loader_record_pipeline.
create or replace function authz_probe.u3_stages_ok()
returns jsonb
language sql
immutable
as $$
  select jsonb_build_array(
    jsonb_build_object('stage', 'compute-baselines',  'httpStatus', 200, 'ok', true),
    jsonb_build_object('stage', 'evaluate-signals',   'httpStatus', 200, 'ok', true),
    jsonb_build_object('stage', 'generate-insights',  'httpStatus', 200, 'ok', true))
$$;
