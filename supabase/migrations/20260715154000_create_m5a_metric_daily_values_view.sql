-- S2 · metric_daily_values — the metric joint-series projection
-- (docs/shared/insight-engine-architecture.md §S2).
--
-- ▒▒ GENERATED FILE — DO NOT EDIT BY HAND ▒▒
-- Rendered from shared/metrics/registry.ts by tools/metric-view/gen_metric_view.mjs.
--   regenerate : node tools/metric-view/gen_metric_view.mjs --write
--   drift guard: node tools/metric-view/gen_metric_view.mjs --check (npm run view:check)
--
-- One canonical long-format read surface over the per-day truth tables: one row per
-- (user, metric, day) that HAS a non-null value. Two-tier truth (docs/memory/0001): a
-- zero-copy live VIEW over raw rows — never materialized, never hand-edited.
--
-- security_invoker (Postgres 15+): the view runs with the CALLER's privileges, so the
-- underlying tables' RLS still applies to app reads; the engine's service_role bypasses
-- RLS here exactly as it does on the tables themselves.

create or replace view public.metric_daily_values
  with (security_invoker = true) as
-- ── daily_gut_rows (wide legacy) — one unpivot branch per active numeric/ordinal key ──
select user_id,
       log_date,
       'urine_colour'::text as metric_key,
       urine_colour::double precision as value,
       'self_report'::text as source
  from public.daily_gut_rows
 where urine_colour is not null
union all
select user_id,
       log_date,
       'stool_form'::text as metric_key,
       stool_form::double precision as value,
       'self_report'::text as source
  from public.daily_gut_rows
 where stool_form is not null
union all
select user_id,
       log_date,
       'stool_count'::text as metric_key,
       stool_count::double precision as value,
       'self_report'::text as source
  from public.daily_gut_rows
 where stool_count is not null
union all
select user_id,
       log_date,
       'stool_variability'::text as metric_key,
       stool_variability::double precision as value,
       'self_report'::text as source
  from public.daily_gut_rows
 where stool_variability is not null
union all
select user_id,
       log_date,
       'outside_meals'::text as metric_key,
       outside_meals::double precision as value,
       'self_report'::text as source
  from public.daily_gut_rows
 where outside_meals is not null
union all
select user_id,
       log_date,
       'mosquito_bites'::text as metric_key,
       mosquito_bites::double precision as value,
       'self_report'::text as source
  from public.daily_gut_rows
 where mosquito_bites is not null
union all
select user_id,
       log_date,
       'energy_score'::text as metric_key,
       energy_score::double precision as value,
       'self_report'::text as source
  from public.daily_gut_rows
 where energy_score is not null
union all
select user_id,
       log_date,
       'mood_score'::text as metric_key,
       mood_score::double precision as value,
       'self_report'::text as source
  from public.daily_gut_rows
 where mood_score is not null
union all
select user_id,
       log_date,
       'gut_comfort_score'::text as metric_key,
       gut_comfort_score::double precision as value,
       'self_report'::text as source
  from public.daily_gut_rows
 where gut_comfort_score is not null
union all
select user_id,
       log_date,
       'log_completeness'::text as metric_key,
       log_completeness::double precision as value,
       'self_report'::text as source
  from public.daily_gut_rows
 where log_completeness is not null
union all
-- ── wearable_daily (wide legacy) — one unpivot branch per active numeric/ordinal key ──
select user_id,
       date as log_date,
       'resting_hr_bpm'::text as metric_key,
       resting_hr_bpm::double precision as value,
       'wearable'::text as source
  from public.wearable_daily
 where resting_hr_bpm is not null
union all
select user_id,
       date as log_date,
       'hrv_sdnn_ms'::text as metric_key,
       hrv_sdnn_ms::double precision as value,
       'wearable'::text as source
  from public.wearable_daily
 where hrv_sdnn_ms is not null
union all
select user_id,
       date as log_date,
       'sleep_duration_min'::text as metric_key,
       sleep_duration_min::double precision as value,
       'wearable'::text as source
  from public.wearable_daily
 where sleep_duration_min is not null
union all
select user_id,
       date as log_date,
       'spo2_pct'::text as metric_key,
       spo2_pct::double precision as value,
       'wearable'::text as source
  from public.wearable_daily
 where spo2_pct is not null
union all
select user_id,
       date as log_date,
       'body_temp_c'::text as metric_key,
       body_temp_c::double precision as value,
       'wearable'::text as source
  from public.wearable_daily
 where body_temp_c is not null
union all
select user_id,
       date as log_date,
       'step_count'::text as metric_key,
       step_count::double precision as value,
       'wearable'::text as source
  from public.wearable_daily
 where step_count is not null
union all
-- ── signals (long-format primitive) — daily-grain MEAN; future passive metrics appear
-- automatically (no per-key branch; see tools/metric-view/lib/view.mjs) ──
select user_id,
       (ts at time zone 'utc')::date as log_date,
       metric_key,
       avg(value)::double precision as value,
       'signal'::text as source
  from public.signals
 group by user_id, metric_key, (ts at time zone 'utc')::date
;

comment on view public.metric_daily_values is
  'S2 joint-series projection: one row per (user, metric, day) with a non-null value. GENERATED from shared/metrics/registry.ts by tools/metric-view/gen_metric_view.mjs — do not edit by hand.';
