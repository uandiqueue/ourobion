-- supabase/tests/authz/40_pre_u2_probe.sql
--
-- THE PRE-U2 BASELINE. Applied after every pre-existing migration and BEFORE the three R4-U2
-- migrations. Two jobs:
--
--   1. Snapshot the authorization surface (pg_policies + effective column privileges) so that
--      "nothing pre-existing changed" is MEASURED against a capture taken in the same run, not
--      asserted from memory or from reading the diff.
--
--   2. Run the P-b probe — an ordinary Biotope user with no nao membership exercising their own
--      rows — and record every outcome under phase = 'pre'. 60_assertions.sql re-runs the
--      IDENTICAL probe under phase = 'post' and 70_non_regression.sql asserts the two agree
--      assertion-for-assertion. That is what makes P-b a measurement rather than a claim.
--
-- P-b matters as much as any security assertion in this harness. The failure it guards against is
-- silent: a restrictive policy or a revoked grant on daily_gut_rows / wearable_daily makes an
-- upsert's conflict target invisible and its UPDATE branch affect zero rows WITHOUT raising, so
-- the nao loader route would report success over an empty database. Hence the probe asserts
-- ROWS AFFECTED, not merely "no error".

-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- 1 · The P-b probe, defined once and executed in both phases so the comparison is exact.
--
-- SECURITY INVOKER (the default): every `execute` inside it, and inside the expect_* helpers it
-- calls, runs with the CALLER's role — so when it is invoked under `set local role authenticated`
-- the statements are evaluated as authenticated. A definer here would make the whole probe pass
-- vacuously as the superuser.
-- ─────────────────────────────────────────────────────────────────────────────────────────────

create or replace function authz_probe.pb_probe(p_uid uuid, p_other uuid, p_day date)
returns void
language plpgsql
as $$
begin
  -- Reads of own rows.
  perform authz_probe.expect_value('pb.select_own_baseline_gut_rows',
    format('select count(*) from public.daily_gut_rows where data_origin = %L', 'seed:baseline'),
    '1');
  perform authz_probe.expect_value('pb.select_own_baseline_wearable',
    format('select count(*) from public.wearable_daily where source = %L', 'seed:baseline'),
    '1');
  perform authz_probe.expect_value('pb.select_own_profile',
    'select count(*) from public.profiles', '1');

  -- Writes of own rows: insert, then the SAME key again through the upsert path (the loader's real
  -- shape: `on conflict (user_id, log_date) do update`), then an update of the baseline row.
  perform authz_probe.expect_ok('pb.insert_own_gut_row',
    format('insert into public.daily_gut_rows (user_id, log_date, data_origin)
            values (%L, %L, %L)', p_uid, p_day, 'probe:pb'));
  perform authz_probe.expect_ok('pb.upsert_own_gut_row',
    format('insert into public.daily_gut_rows (user_id, log_date, data_origin)
            values (%L, %L, %L)
            on conflict (user_id, log_date) do update set data_origin = %L',
           p_uid, p_day, 'probe:pb', 'probe:pb-upserted'));
  perform authz_probe.expect_value('pb.upsert_own_gut_row_took_effect',
    format('select data_origin from public.daily_gut_rows where log_date = %L', p_day),
    'probe:pb-upserted');
  perform authz_probe.expect_rows_affected('pb.update_own_gut_row',
    format('update public.daily_gut_rows set notes = %L where log_date = %L',
           'probe', date '2026-01-01'), 1);

  perform authz_probe.expect_ok('pb.insert_own_wearable',
    format('insert into public.wearable_daily (user_id, date, resting_hr_bpm, source)
            values (%L, %L, 61, %L)', p_uid, p_day, 'probe:pb'));
  perform authz_probe.expect_ok('pb.upsert_own_wearable',
    format('insert into public.wearable_daily (user_id, date, resting_hr_bpm, source)
            values (%L, %L, 62, %L)
            on conflict (user_id, date) do update set resting_hr_bpm = 63',
           p_uid, p_day, 'probe:pb'));
  perform authz_probe.expect_value('pb.upsert_own_wearable_took_effect',
    format('select resting_hr_bpm::text from public.wearable_daily where date = %L', p_day),
    '63');
  perform authz_probe.expect_rows_affected('pb.update_own_wearable',
    format('update public.wearable_daily set step_count = 100 where date = %L',
           date '2026-01-01'), 1);

  -- Another user's rows stay invisible and unwritable, before AND after U2.
  perform authz_probe.expect_value('pb.select_other_user_gut_rows',
    format('select count(*) from public.daily_gut_rows where user_id = %L', p_other), '0');
  perform authz_probe.expect_value('pb.select_other_user_wearable',
    format('select count(*) from public.wearable_daily where user_id = %L', p_other), '0');
  perform authz_probe.expect_error('pb.insert_other_user_gut_row',
    format('insert into public.daily_gut_rows (user_id, log_date) values (%L, %L)',
           p_other, p_day + 60), '42501');
  perform authz_probe.expect_error('pb.insert_other_user_wearable',
    format('insert into public.wearable_daily (user_id, date) values (%L, %L)',
           p_other, p_day + 60), '42501');
  perform authz_probe.expect_rows_affected('pb.update_other_user_gut_row',
    format('update public.daily_gut_rows set notes = %L where user_id = %L', 'nope', p_other), 0);

  -- The shared science read surface Biotope depends on (Class A) — deliberately left open by U2.
  perform authz_probe.expect_value('pb.read_relationship_claims',
    'select count(*) from public.relationship_claims', '1');
  perform authz_probe.expect_value('pb.read_edge_verifications',
    'select count(*) from public.edge_verifications', '1');
  perform authz_probe.expect_value('pb.read_verified_edges',
    'select count(*) from public.verified_edges', '1');
  perform authz_probe.expect_value('pb.read_verified_edges_human_verdict',
    'select human_verdict from public.verified_edges limit 1', 'reject');

  -- get_insight_provenance: SECURITY INVOKER, granted to authenticated, called by Biotope
  -- (Flutter) as an ordinary user. This is the single most important don't-break-Biotope path,
  -- and it transitively reads edge_human_verdicts — the table U2 column-revokes.
  perform authz_probe.expect_value('pb.provenance_own_card_visible',
    'select case when public.get_insight_provenance(
                    (select id from public.insight_cards limit 1)) -> ''card'' is null
                 then ''null-card'' else ''card'' end', 'card');
  perform authz_probe.expect_value('pb.provenance_own_card_edge_count',
    'select jsonb_array_length(public.get_insight_provenance(
              (select id from public.insight_cards limit 1)) -> ''edges'')::text', '1');
  perform authz_probe.expect_value('pb.provenance_shows_human_verdict',
    'select public.get_insight_provenance(
              (select id from public.insight_cards limit 1))
              -> ''edges'' -> 0 ->> ''humanVerdict''', 'reject');
end
$$;

-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- 2 · Snapshot the authorization surface as it stands with ZERO R4-U2 objects present.
-- ─────────────────────────────────────────────────────────────────────────────────────────────

create table authz_probe.policy_snapshot  as select * from authz_probe.policy_state;
create table authz_probe.colpriv_snapshot as select * from authz_probe.colpriv_state;

-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- 3 · Run the baseline, in a PostgREST-shaped transaction (see 20_probe_harness.sql for why this
--     reproduces PostgREST's enforcement path).
-- ─────────────────────────────────────────────────────────────────────────────────────────────

set authz_probe.phase = 'pre';

begin;
  set local request.jwt.claims = '{"sub": "bbbbbbbb-0000-4000-8000-000000000001", "role": "authenticated"}';
  set local role authenticated;
  select authz_probe.pb_probe(
    'bbbbbbbb-0000-4000-8000-000000000001'::uuid,   -- the Biotope-only subject
    'aaaaaaaa-0000-4000-8000-000000000007'::uuid,   -- another dev's id (must stay invisible)
    date '2026-04-01');
commit;

reset authz_probe.phase;
