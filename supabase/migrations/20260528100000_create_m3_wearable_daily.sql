-- M3: wearable_daily — one row per user per day of wearable-sourced signals.
-- All signal columns nullable: a missing value means the platform did not supply data.
-- Upserted by WearableService on DailyLogScreen open; last write wins for the day.

create table public.wearable_daily (
  user_id            uuid        not null references auth.users(id) on delete cascade,
  date               date        not null,
  resting_hr_bpm     numeric,
  hrv_sdnn_ms        numeric,
  sleep_duration_min integer,
  spo2_pct           numeric,
  body_temp_c        numeric,
  step_count         integer,
  source             text,
  synced_at          timestamptz not null default now(),
  primary key (user_id, date)
);

alter table public.wearable_daily enable row level security;

create policy "users can select own wearable data"
  on public.wearable_daily for select
  using (auth.uid() = user_id);

create policy "users can insert own wearable data"
  on public.wearable_daily for insert
  with check (auth.uid() = user_id);

create policy "users can update own wearable data"
  on public.wearable_daily for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
