-- ════════════════════════════════════════════════════════════════════════════
-- ourobion · LOCAL TEST DATA SEEDER (raw rows + engagement projection)
-- ════════════════════════════════════════════════════════════════════════════
--
-- WHAT THIS IS
--   A developer convenience for *local* Supabase only. It fabricates a stretch of
--   daily logs for ONE existing user so the phone UI renders "weeks in" instantly —
--   no logging by hand for a week to test streaks, baselines and insights.
--
-- HOW IT FITS THE TWO-TIER-TRUTH MODEL (AGENTS.md §2)
--   • daily_gut_rows / wearable_daily / antibiotic_courses are TRUTH → we inject them.
--   • engagement_state is a DERIVED projection (normally rebuilt by M6 in the Flutter
--     app on every log-write). There is no edge function for it, so this script
--     RE-RUNS that computation here in SQL, mirroring engagement_service.dart. It is a
--     rebuild from the injected raw rows, NOT a hand-edited projection.
--   • baseline_snapshots and insight_cards are also projections, rebuilt by the
--     compute-baselines / generate-insights EDGE FUNCTIONS. SQL can't run TS, so the
--     PowerShell runner (seed-test-data.ps1) invokes those after this file completes.
--
-- THE RLS GOTCHA (why we need a real user)
--   Every table is `using (auth.uid() = user_id)`. Running this as the postgres
--   superuser bypasses RLS for the WRITE, but the app reads with the signed-in user's
--   JWT — so every row MUST carry that user's real UUID. We resolve it from auth.users
--   by email. ⇒ Sign up / sign in once in the app with this email BEFORE seeding.
--
-- HOW TO RUN
--   Preferred:  scripts\seed-test-data.ps1   (sets the variables below + runs edge fns)
--   Standalone: pipe this file into psql in the local db container and override vars:
--     Get-Content scripts\seed-test-data.sql -Raw |
--       docker exec -i supabase_db_ourobion psql -U postgres -d postgres `
--         -v email=you@example.com -v days=14
--   Or paste it into Supabase Studio's SQL editor (edit the defaults below first).
--
-- ════════════════════════════════════════════════════════════════════════════
-- TUNABLES — these defaults apply when run standalone; the .ps1 runner overrides
-- them via `psql -v`. (`\if :{?x}` = "only set a default if not passed on the CLI".)
-- ════════════════════════════════════════════════════════════════════════════

\if :{?email}            \else \set email            'test@ourobion.local' \endif
\if :{?days}             \else \set days             14                   \endif
\if :{?base_dqs}         \else \set base_dqs         78                   \endif
\if :{?include_wearable} \else \set include_wearable 1                    \endif
\if :{?with_antibiotics} \else \set with_antibiotics 0                    \endif
\if :{?region}           \else \set region           'SG'                 \endif
\if :{?wipe_first}       \else \set wipe_first        1                   \endif

-- Bridge the client-side psql variables into session GUCs, because psql does NOT
-- expand `:vars` inside a $$ dollar-quoted block. The DO block reads them back via
-- current_setting().
select set_config('seed.email',            :'email',            false);
select set_config('seed.days',             :'days',             false);
select set_config('seed.base_dqs',         :'base_dqs',         false);
select set_config('seed.include_wearable', :'include_wearable', false);
select set_config('seed.with_antibiotics', :'with_antibiotics', false);
select set_config('seed.region',           :'region',           false);
select set_config('seed.wipe_first',       :'wipe_first',       false);

do $$
declare
  v_email   text    := current_setting('seed.email');
  v_days    int     := current_setting('seed.days')::int;
  v_base    numeric := current_setting('seed.base_dqs')::numeric;
  v_wear    bool    := current_setting('seed.include_wearable')::int = 1;
  v_abx     bool    := current_setting('seed.with_antibiotics')::int = 1;
  v_region  text    := current_setting('seed.region');
  v_wipe    bool    := current_setting('seed.wipe_first')::int = 1;

  v_uid     uuid;
  v_today   date := current_date;
  v_day     date;
  i         int;
  v_dqs     numeric;

  -- engagement_state outputs (mirrors m6_engagement/engagement_service.dart)
  v_streak  int := 0;
  v_longest int := 0;
  v_total   int := 0;
  v_avg7    double precision;
  v_titles  text[] := '{}';
  v_active  text;
begin
  -- ── 1. Resolve the target user (RLS requires the real UUID) ────────────────
  select id into v_uid from auth.users where email = v_email;
  if v_uid is null then
    raise exception
      'No auth user with email "%". Sign in once in the app with this account, then re-run.',
      v_email;
  end if;

  -- Deterministic pseudo-randomness so repeated runs are reproducible.
  perform setseed(0.42);

  -- ── 2. Optional clean slate for this user (raw rows + projections) ─────────
  if v_wipe then
    delete from daily_gut_rows    where user_id = v_uid;
    delete from wearable_daily    where user_id = v_uid;
    delete from antibiotic_courses where user_id = v_uid;
    delete from engagement_state  where user_id = v_uid;
    delete from baseline_snapshots where user_id = v_uid;  -- edge fn will repopulate
    delete from insight_cards     where user_id = v_uid;   -- edge fn will repopulate
  end if;

  -- ── 3. Inject a contiguous block of daily logs ending today ────────────────
  --     log_completeness is set directly to a streak-worthy value (>=60) so the
  --     streak/DQS logic lights up; the app would normally compute it from filled
  --     fields, but for rendering tests setting it directly is enough.
  for i in 0 .. v_days - 1 loop
    v_day := v_today - i;
    v_dqs := round(least(100, greatest(60, v_base + (random() * 16 - 8)))::numeric, 2);

    insert into daily_gut_rows (
      user_id, log_date, region,
      urine_colour, stool_form, stool_count, stool_variability,
      outside_meals, mosquito_bites,
      energy_score, mood_score, gut_comfort_score,
      symptom_flags, notes, standing_water_present,
      on_antibiotics, gut_watch_active, log_completeness
    ) values (
      v_uid, v_day, v_region,
      1 + floor(random() * 4)::int,    -- urine_colour 1–4 (well hydrated)
      3 + floor(random() * 3)::int,    -- stool_form 3–5 (Bristol normal range)
      1 + floor(random() * 3)::int,    -- stool_count 1–3
      floor(random() * 3)::int,        -- stool_variability 0–2
      floor(random() * 3)::int,        -- outside_meals 0–2
      floor(random() * 4)::int,        -- mosquito_bites 0–3
      3 + floor(random() * 3)::int,    -- energy_score 3–5
      3 + floor(random() * 3)::int,    -- mood_score 3–5
      3 + floor(random() * 3)::int,    -- gut_comfort_score 3–5
      case when random() < 0.25 then array['bloating'] else '{}' end::text[],
      'seeded test row',
      case when random() < 0.15 then true else false end,
      false, false,
      v_dqs
    )
    on conflict (user_id, log_date) do update
      set log_completeness = excluded.log_completeness,
          updated_at       = now();

    -- Wearable signals (M3). hrv_sdnn_ms is iOS-only in reality, but harmless here.
    if v_wear then
      insert into wearable_daily (
        user_id, date,
        resting_hr_bpm, hrv_sdnn_ms, sleep_duration_min,
        spo2_pct, body_temp_c, step_count, source
      ) values (
        v_uid, v_day,
        round((58 + random() * 14)::numeric, 0),   -- resting HR 58–72 bpm
        round((40 + random() * 40)::numeric, 0),   -- HRV SDNN 40–80 ms
        (360 + random() * 120)::int,               -- sleep 6–8 h
        round((96 + random() * 3)::numeric, 0),    -- SpO2 96–99 %
        round((36.4 + random() * 0.6)::numeric, 1),-- body temp 36.4–37.0 °C
        (4000 + random() * 8000)::int,             -- steps 4k–12k
        'seed'
      )
      on conflict (user_id, date) do update
        set step_count = excluded.step_count,
            synced_at  = now();
    end if;
  end loop;

  -- ── 4. Optional antibiotic course over the most recent 5 days ──────────────
  if v_abx then
    insert into antibiotic_courses (
      user_id, drug_name, start_date, duration_days, end_date,
      completed, reminder_enabled
    ) values (
      v_uid, 'Amoxicillin (seed)', v_today - 4, 5, v_today, false, false
    );
    update daily_gut_rows
       set on_antibiotics = true, gut_watch_active = true
     where user_id = v_uid and log_date >= v_today - 4;
  end if;

  -- ── 5. Rebuild engagement_state — mirrors engagement_service.dart ──────────
  -- current_streak: consecutive streak-worthy (>=60) days, anchored on today if
  -- present else yesterday, walking backwards.
  v_day := case
             when exists (select 1 from daily_gut_rows
                          where user_id = v_uid and log_date = v_today
                            and log_completeness >= 60)
             then v_today else v_today - 1
           end;
  loop
    exit when not exists (
      select 1 from daily_gut_rows
      where user_id = v_uid and log_date = v_day and log_completeness >= 60
    );
    v_streak := v_streak + 1;
    v_day := v_day - 1;
  end loop;

  -- longest_streak: longest island of consecutive streak-worthy days (gaps-and-islands).
  select coalesce(max(run_len), 0) into v_longest
  from (
    select count(*) as run_len
    from (
      select log_date,
             log_date - (row_number() over (order by log_date))::int as grp
      from daily_gut_rows
      where user_id = v_uid and log_completeness >= 60
    ) islands
    group by grp
  ) runs;
  if v_streak > v_longest then v_longest := v_streak; end if;

  select count(*) into v_total
  from daily_gut_rows where user_id = v_uid;

  -- dqs_7day_avg: mean completeness over the last 7 calendar days (all rows).
  select avg(log_completeness) into v_avg7
  from daily_gut_rows
  where user_id = v_uid and log_date >= v_today - 6;

  -- Titles (kTitleRegistry): pioneer ≥1 log, committed ≥7 streak,
  -- consistent ≥30 streak, explorer ≥30 logs. active_title = last unlocked.
  if v_total   >= 1  then v_titles := v_titles || 'pioneer';    v_active := 'pioneer';    end if;
  if v_streak  >= 7  then v_titles := v_titles || 'committed';  v_active := 'committed';  end if;
  if v_streak  >= 30 then v_titles := v_titles || 'consistent'; v_active := 'consistent'; end if;
  if v_total   >= 30 then v_titles := v_titles || 'explorer';   v_active := 'explorer';   end if;

  insert into engagement_state (
    user_id, current_streak_days, longest_streak_days,
    dqs_7day_avg, total_logs, active_title, unlocked_titles, updated_at
  ) values (
    v_uid, v_streak, v_longest, v_avg7, v_total, v_active, v_titles, now()
  )
  on conflict (user_id) do update set
    current_streak_days = excluded.current_streak_days,
    longest_streak_days = excluded.longest_streak_days,
    dqs_7day_avg        = excluded.dqs_7day_avg,
    total_logs          = excluded.total_logs,
    active_title        = excluded.active_title,
    unlocked_titles     = excluded.unlocked_titles,
    updated_at          = now();

  raise notice 'Seeded % day(s) for % (uid %): streak=%, longest=%, total=%, 7d-avg=%, titles=%',
    v_days, v_email, v_uid, v_streak, v_longest, v_total, round(v_avg7::numeric, 1), v_titles;
  raise notice 'Next: the runner invokes compute-baselines then generate-insights to rebuild the M5 projections.';
end $$;
