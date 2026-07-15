-- Continuity-based storage primitives (phase-2-plan §"The metric platform" property 3, W0).
--
-- Storage follows a metric's *continuity*, not its body system. Four generalized tables:
--   events          — episodic typed events (frequency/timing/transit DERIVED from timestamps, never asked)
--   state_bands     — start/end spans (antibiotics, fasting, illness, travel; open band = active)
--   signals         — tall/narrow passive time-series (the wide-passive-layer workhorse)
--   derived_metrics — rebuildable projection (two-tier truth: NEVER truth-tier)
--
-- Legacy tables STAY UNTOUCHED — they are grandfathered first instances of these primitives
-- (no rewrite, no data migration):
--   daily_gut_rows     -> first instance of daily_log (the thin continuous spine)
--   antibiotic_courses -> first instance of state_bands
--   wearable_daily     -> first instance of signals
--   baseline_snapshots -> first instance of derived_metrics
--
-- metric_key on every table is a shared/metrics/registry.ts key; the
-- metrics-registry-to-schema guard ties these tables to the registry.

-- ═══════════════════════════════════════════════════════════════
-- 1. EVENTS
--    Episodic typed events: Bristol tap, insect bite, meal photo, symptom.
--    One row per occurrence. value is the typed payload (shape per registry
--    metric type); null for pure-occurrence events where the timestamp is
--    the datum. logged_at records entry lag vs occurred_at.
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.events (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  metric_key   text not null,
  occurred_at  timestamptz not null,
  value        jsonb,
  source       text,
  logged_at    timestamptz not null default now()
);

create index if not exists events_user_metric_occurred_idx
  on public.events (user_id, metric_key, occurred_at);

alter table public.events enable row level security;

create policy "Users can select own events"
  on public.events for select
  using (auth.uid() = user_id);

create policy "Users can insert own events"
  on public.events for insert
  with check (auth.uid() = user_id);

create policy "Users can update own events"
  on public.events for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own events"
  on public.events for delete
  using (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════
-- 2. STATE_BANDS
--    Toggled start/end spans: antibiotics, fasting, illness, travel,
--    pregnancy. ended_at null = open band (state currently active).
--    value optionally qualifies the band (e.g. drug name, destination).
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.state_bands (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  metric_key   text not null,
  started_at   timestamptz not null,
  ended_at     timestamptz,                       -- null = open band (active)
  value        jsonb,
  source       text,
  check (ended_at is null or ended_at >= started_at)
);

create index if not exists state_bands_user_metric_started_idx
  on public.state_bands (user_id, metric_key, started_at);

alter table public.state_bands enable row level security;

create policy "Users can select own state bands"
  on public.state_bands for select
  using (auth.uid() = user_id);

create policy "Users can insert own state bands"
  on public.state_bands for insert
  with check (auth.uid() = user_id);

create policy "Users can update own state bands"
  on public.state_bands for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own state bands"
  on public.state_bands for delete
  using (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════
-- 3. SIGNALS
--    Tall/narrow passive time-series (steps, HR, AQI, weather) —
--    high row count by design. Numeric-only value; non-numeric passive
--    data belongs in events (jsonb payload). The composite primary key
--    both dedupes one reading per (user, metric, instant, source) and
--    is the covering index for per-metric time-range scans.
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.signals (
  user_id      uuid not null references auth.users(id) on delete cascade,
  metric_key   text not null,
  ts           timestamptz not null,
  value        double precision not null,
  source       text not null,
  device       text,
  primary key (user_id, metric_key, ts, source)
);

alter table public.signals enable row level security;

create policy "Users can select own signals"
  on public.signals for select
  using (auth.uid() = user_id);

create policy "Users can insert own signals"
  on public.signals for insert
  with check (auth.uid() = user_id);

create policy "Users can update own signals"
  on public.signals for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own signals"
  on public.signals for delete
  using (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════
-- 4. DERIVED_METRICS
--    Rebuildable projection (hydration, transit, regularity). Upsert on
--    (user_id, metric_key, as_of). Two-tier truth (docs/memory/0001):
--    NEVER truth-tier — always recomputable from raw rows, never hand-edited.
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.derived_metrics (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  metric_key   text not null,
  as_of        date not null,
  value        jsonb not null,
  computed_at  timestamptz not null default now(),
  unique (user_id, metric_key, as_of)
);

comment on table public.derived_metrics is
  'Rebuildable projection of derived metric values (two-tier truth, docs/memory/0001): always recomputable from raw rows (events / state_bands / signals / daily logs), never hand-edited, never truth-tier.';

alter table public.derived_metrics enable row level security;

create policy "Users can select own derived metrics"
  on public.derived_metrics for select
  using (auth.uid() = user_id);

create policy "Users can insert own derived metrics"
  on public.derived_metrics for insert
  with check (auth.uid() = user_id);

create policy "Users can update own derived metrics"
  on public.derived_metrics for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own derived metrics"
  on public.derived_metrics for delete
  using (auth.uid() = user_id);
