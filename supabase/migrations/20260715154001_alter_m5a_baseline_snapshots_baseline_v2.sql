-- S3 · baseline v2 — additive amendment to baseline_snapshots
-- (docs/implemented/shared/insight-engine-architecture.md §S3; confidence cutoffs per
-- docs/shared/phase2-run-config-decisions.md C5: 3 / 5 / 14).
--
-- baseline_snapshots is a rebuildable projection (two-tier truth, docs/memory/0001):
-- additive columns only, no rewrite — the nightly compute-baselines run repopulates them.
--
-- This fixes the v1 contradiction that days_of_data was a ≤7-day window count while
-- confidence='high' demanded 14+ days — unreachable. total_history_days (all non-null days
-- ever, counted from the S2 metric_daily_values view) now carries the 14+ semantics;
-- days_of_data stays the in-window coverage count.

-- Widen the four stat columns to unconstrained numeric: numeric(6,3) caps |value| < 1000,
-- which real wearable magnitudes overflow (step_count ~10^4 → 22003 numeric field overflow
-- on upsert, observed while exercising S3 v2 against seeded wearable rows).
alter table public.baseline_snapshots
  alter column mean type numeric,
  alter column std_dev type numeric,
  alter column min type numeric,
  alter column max type numeric;

alter table public.baseline_snapshots
  add column if not exists window_days smallint not null default 7;

alter table public.baseline_snapshots
  add column if not exists total_history_days integer not null default 0;

comment on column public.baseline_snapshots.window_days is
  'Rolling-stats window in days: mean/std_dev/min/max/trend and days_of_data are computed over the last window_days days.';

comment on column public.baseline_snapshots.days_of_data is
  'Days with a non-null value WITHIN the last window_days days (in-window coverage count).';

comment on column public.baseline_snapshots.total_history_days is
  'All days with a non-null value ever for this (user, metric), counted from the S2 metric_daily_values view.';

-- Supersedes the v1 inline comment ('low' 3–6 / 'medium' 7–13 / 'high' 14+ on days_of_data):
-- confidence is re-based on in-window coverage + total history (C5 cutoffs 3 / 5 / 14).
comment on column public.baseline_snapshots.confidence is
  'Coverage-rebased confidence (C5: 3/5/14): insufficient = days_of_data < 3; low = 3 <= days_of_data < 5; medium = days_of_data >= 5 and total_history_days < 14; high = days_of_data >= 5 and total_history_days >= 14.';
