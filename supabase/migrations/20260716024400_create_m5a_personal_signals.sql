-- M5a · S5: personal_signals — the D2 n=1 evaluator's output table
-- (docs/implemented/shared/insight-engine-architecture.md §S5; statistics + gates per ADR-0002 /
-- docs/shared/phase2-run-config-decisions.md C4).
--
-- One row per (user_id, metric_a, metric_b) with metric_a < metric_b (lexicographic).
-- The evaluate-signals edge function upserts here after computing Spearman ρ,
-- Pyper–Peterman N_eff and Benjamini–Hochberg q over the 60-day joint series.
-- Pairs with too few joint days get NO row (§S5 failure mode) — "no row" and
-- "flat pair" (rho 0, q ~1, stable false) stay distinguishable downstream.
--
-- PROJECTION TIER (two-tier truth, AGENTS.md §2 / docs/memory/0001): fully rebuildable
-- from the S2 metric_daily_values view by re-running evaluate-signals. NEVER hand-edit;
-- fix the raw rows or the evaluator and re-run the job.
--
-- RLS: users read their own rows. The edge function runs as service_role, which
-- bypasses RLS, so no write policy is needed (baseline_snapshots precedent).

create table if not exists public.personal_signals (
  user_id       uuid not null references auth.users(id) on delete cascade,
  metric_a      text not null,
  metric_b      text not null,                -- lexicographic order: metric_a < metric_b

  window_days   smallint not null default 60, -- joint-series evaluation window (C4)
  n_days        smallint not null,            -- joint non-null days in window
  n_eff         numeric(6,2) not null,        -- Pyper–Peterman autocorrelation-adjusted N
  rho           numeric(5,4) not null,        -- Spearman rank correlation
  ci_low        numeric(5,4),                 -- Fisher-z 95% CI (null when n_eff too small)
  ci_high       numeric(5,4),
  q_value       numeric(6,5) not null,        -- Benjamini–Hochberg FDR-adjusted p, per user per run

  -- sign(rho) unchanged across 3 fixed deterministic windows AND |rho| >= 0.3 (ADR-0002)
  stable        boolean not null,

  computed_at   timestamptz not null default now(),
  runs_observed smallint not null default 1,

  primary key (user_id, metric_a, metric_b),
  constraint personal_signals_pair_order check (metric_a < metric_b)
);

comment on table public.personal_signals is
  'S5 n=1 evaluator output (projection tier — rebuilt by the evaluate-signals edge function '
  'from metric_daily_values; never hand-edit). Serve gate: q_value <= 0.05 AND n_eff >= 10 '
  'AND stable (ADR-0002 / config C4).';
comment on column public.personal_signals.n_days is
  'Joint non-null days of the pair inside window_days.';
comment on column public.personal_signals.n_eff is
  'Pyper–Peterman (1998) modified-Chelton effective N: 1/N* = 1/N + (2/N)·Σ r_XX(j)·r_YY(j), '
  'bias-corrected autocorrelations, lags truncated at N/5, clamped to [2, N].';
comment on column public.personal_signals.q_value is
  'Benjamini–Hochberg step-up adjusted p across all pairs evaluated for the user in one run.';
comment on column public.personal_signals.stable is
  'sign(rho) identical across 3 fixed deterministic sub-windows AND |rho| >= 0.3 (ADR-0002 '
  'stability gate — deterministic windows, never unseeded resampling).';
comment on column public.personal_signals.runs_observed is
  'Informational only: ADR-0002 moved stability to fixed sub-windows WITHIN a run, so this '
  'no longer feeds the stable gate (the architecture sketch predates the ADR). Always 1 today.';

-- No separate user_id index: the primary key (user_id, metric_a, metric_b) already serves
-- per-user lookups (unlike baseline_snapshots, whose PK is a surrogate id).

alter table public.personal_signals enable row level security;

create policy "Users can read own personal signals"
  on public.personal_signals for select
  using (auth.uid() = user_id);
