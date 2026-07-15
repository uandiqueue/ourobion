-- M5a: baseline_snapshots table
--
-- One row per (user_id, metric_key). The nightly compute-baselines edge function
-- upserts into this table, overwriting the previous snapshot for each metric.
-- computed_at tracks when the snapshot was last refreshed.
--
-- RLS: users read their own rows. The edge function runs as service_role,
-- which bypasses RLS, so no write policy is needed here.

-- ═══════════════════════════════════════════════════════════════
-- 1. BASELINE_SNAPSHOTS
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.baseline_snapshots (
  id              bigint generated always as identity primary key,
  user_id         uuid not null references auth.users(id) on delete cascade,
  metric_key      text not null,                    -- e.g. 'urine_colour', 'energy_score'

  computed_at     timestamptz not null default now(),
  days_of_data    smallint not null default 0,      -- how many of the 7 days had a non-null value

  -- Rolling 7-day statistics (null when days_of_data < 1)
  mean            numeric(6,3),
  std_dev         numeric(6,3),
  min             numeric(6,3),
  max             numeric(6,3),

  -- 'rising' / 'falling' / 'stable' / null (null when days_of_data < 3)
  trend           text check (trend in ('rising', 'falling', 'stable')),

  -- 'insufficient' (<3 days), 'low' (3–6), 'medium' (7–13), 'high' (14+)
  confidence      text not null check (confidence in ('insufficient', 'low', 'medium', 'high')),

  -- MVP always ['self_report']. Stage 2/3 adds 'wearable' and 'env'.
  data_sources    text[] not null default '{self_report}',

  unique (user_id, metric_key)
);

create index if not exists baseline_snapshots_user_id_idx
  on public.baseline_snapshots (user_id);

alter table public.baseline_snapshots enable row level security;

create policy "Users can read own baseline snapshots"
  on public.baseline_snapshots for select
  using (auth.uid() = user_id);
