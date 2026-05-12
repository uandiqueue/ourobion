-- M2: daily_gut_rows & antibiotic_courses tables with RLS

-- ═══════════════════════════════════════════════════════════════
-- 1. DAILY_GUT_ROWS
--    One row per user per day. Upsert on (user_id, log_date).
--    region included now so M7 aggregation is a query, not a backfill.
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.daily_gut_rows (
  id                    bigint generated always as identity primary key,
  user_id               uuid not null references auth.users(id) on delete cascade,
  log_date              date not null,
  region                text not null default '',          -- copied from profile at log time

  -- Core logging fields (Armstrong / Bristol)
  urine_colour          smallint check (urine_colour between 1 and 8),
  stool_form            smallint check (stool_form between 1 and 7),
  stool_count           smallint check (stool_count between 0 and 10),
  stool_variability     smallint not null default 0,       -- derived: max_bristol - min_bristol

  -- Behaviour fields
  outside_meals         smallint check (outside_meals between 0 and 3),
  mosquito_bites        smallint check (mosquito_bites between 0 and 20),

  -- Daily check-in
  energy_score          smallint check (energy_score between 1 and 5),
  mood_score            smallint check (mood_score between 1 and 5),
  gut_comfort_score     smallint check (gut_comfort_score between 1 and 5),

  -- Symptom flags (presence-only — absence of flag ≠ symptom absent)
  symptom_flags         text[] not null default '{}',

  -- Free text
  notes                 text check (char_length(notes) <= 140),

  -- Weekly audit
  standing_water_present boolean,

  -- Antibiotic-derived flags (computed by M2 from antibiotic_courses at write time)
  on_antibiotics        boolean not null default false,
  gut_watch_active      boolean not null default false,

  -- Data Quality Score (0–100, computed by normaliser)
  log_completeness      numeric(5,2) not null default 0 check (log_completeness between 0 and 100),

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  unique (user_id, log_date)
);

alter table public.daily_gut_rows enable row level security;

create policy "Users can read own gut rows"
  on public.daily_gut_rows for select
  using (auth.uid() = user_id);

create policy "Users can insert own gut rows"
  on public.daily_gut_rows for insert
  with check (auth.uid() = user_id);

create policy "Users can update own gut rows"
  on public.daily_gut_rows for update
  using (auth.uid() = user_id);


-- ═══════════════════════════════════════════════════════════════
-- 2. ANTIBIOTIC_COURSES
--    Event-based (not daily). One row per course per user.
--    M2 derives on_antibiotics and gut_watch_active on daily_gut_rows
--    from these records at log write time.
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.antibiotic_courses (
  id                bigint generated always as identity primary key,
  user_id           uuid not null references auth.users(id) on delete cascade,
  drug_name         text not null,
  start_date        date not null,
  duration_days     smallint not null check (duration_days > 0),
  end_date          date not null,                         -- start_date + duration_days - 1, stored for query efficiency
  completed         boolean not null default false,
  reminder_enabled  boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.antibiotic_courses enable row level security;

create policy "Users can read own antibiotic courses"
  on public.antibiotic_courses for select
  using (auth.uid() = user_id);

create policy "Users can insert own antibiotic courses"
  on public.antibiotic_courses for insert
  with check (auth.uid() = user_id);

create policy "Users can update own antibiotic courses"
  on public.antibiotic_courses for update
  using (auth.uid() = user_id);

create policy "Users can delete own antibiotic courses"
  on public.antibiotic_courses for delete
  using (auth.uid() = user_id);
