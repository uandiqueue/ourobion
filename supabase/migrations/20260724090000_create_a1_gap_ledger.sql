-- A1 · gap_ledger — per-pair record of *why* each candidate pair isn't served; the loop's
-- demand signal (docs/shared/insight-engine-architecture.md §A1; docs/shared/biotope-nao-link.md
-- §6). Table shape follows §A1 VERBATIM (column names, status enum, PK) — backlog O9's
-- demand-side slice plus O18's gap-only research-context/contradiction routing and O16's
-- object-only-signal routing all land their events here.
--
-- WRITERS this slice: generate-insights (service_role) emits gap events beside its composed
-- insights via record_gap_events() below — aggregate rows ONLY (scope = 'aggregate').
-- The full §A1 status classifier (weekly cron over registry derivedFrom + A6 co-occurrence +
-- S5 personal signals, statuses 'served'/'lit-candidate-no-edge'/'retrieval-exhausted'/
-- 'edge-below-band') and the A3 queue builder are LATER units (U16 / B5-gated) — this table is
-- the surface they will share.
--
-- PRIVACY INVARIANT (§A1 / O9 locked decision): `demand` aggregates fire-counts with NO user
-- ids — the serve path writes no per-user rows and no user identifiers of any kind. The §A1
-- shape reserves scope = user_id::text for the LATER classifier's personal rows; the
-- authenticated read policy below deliberately exposes only scope = 'aggregate' rows, so even
-- if personal-scope rows appear later they stay invisible to app reads until a policy
-- deliberately serves them.

-- ═══════════════════════════════════════════════════════════════
-- 1. GAP_LEDGER (§A1 store, verbatim shape)
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.gap_ledger (
  metric_a            text not null,                 -- lexicographic (metric_a < metric_b)
  metric_b            text not null,
  scope               text not null default 'aggregate', -- 'aggregate' | user_id::text (later classifier)
  status              text not null check (status in
                        ('served', 'edge-below-band', 'personal-signal-no-edge',
                         'lit-candidate-no-edge', 'personal-null', 'blocked-completeness',
                         'needs-review', 'retrieval-exhausted')),
  personal_signal     jsonb,                         -- {rho, nEff, qValue, stable} (personal rows only)
  lit_candidate       jsonb,                         -- {cooccurStrength, hasEdge, servingBand, ...}
  completeness        numeric(4,3),
  demand              integer not null default 0,    -- aggregate fire-count, NO user ids (privacy)
  last_ingest_attempt jsonb,                         -- {runId, at, outcome} — A3/A10 write-back (later)
  corpus_version      text,                          -- watermark for cheap re-eval (later)
  last_status_change  timestamptz not null default now(),
  primary key (metric_a, metric_b, scope),
  constraint gap_ledger_pair_order check (metric_a < metric_b)
);

comment on table public.gap_ledger is
  'A1 gap ledger (architecture §A1): per-pair record of why a candidate pair is not served — '
  'the demand signal driving gap-driven research (O9). Serve-path writers append aggregate '
  'demand only (scope = ''aggregate'', NO user ids); the weekly A1 classifier (later unit) owns '
  'full status resolution; the A3 queue builder (later, B5-gated) ranks rows into ingest runs.';
comment on column public.gap_ledger.demand is
  'Aggregate fire-count — incremented per demanding user per generate-insights run, never '
  'tied to a user id (privacy invariant, §A1 / biotope-nao-link §6).';
comment on column public.gap_ledger.status is
  'Serve path writes: personal-signal-no-edge (idiosyncratic card + O16 object-only signals), '
  'blocked-completeness (research-context, completeness-gated per §S7), needs-review '
  '(contradiction), personal-null (computed-but-non-gate-passing personal pair with no edge). '
  'Remaining values belong to the A1 classifier / A10 write-back (later units). Last write '
  'wins until the classifier (which is total) owns resolution.';
comment on column public.gap_ledger.scope is
  '''aggregate'' for demand rows (the only scope the serve path writes); §A1 reserves '
  'user_id::text for the later classifier''s personal rows. The authenticated read policy '
  'exposes aggregate rows only.';

-- ═══════════════════════════════════════════════════════════════
-- 2. RLS — aggregate demand is server data; authenticated may read (nao gap surfacing, later
--    unit). Writes go through service_role (bypasses RLS) — no write policy on purpose.
-- ═══════════════════════════════════════════════════════════════

alter table public.gap_ledger enable row level security;

create policy "Authenticated users can read aggregate gap ledger rows"
  on public.gap_ledger for select
  to authenticated
  using (scope = 'aggregate');

-- ═══════════════════════════════════════════════════════════════
-- 3. record_gap_events — the serve path's UPSERT-increment (demand++, status transition)
-- ═══════════════════════════════════════════════════════════════

-- events: jsonb array of {metric_a, metric_b, status, demand?, completeness?, lit_candidate?}.
-- Pair order is normalised here (least/greatest) so callers cannot violate the lexicographic
-- CHECK; demand defaults to 1 per event; status transitions bump last_status_change. A plpgsql
-- loop (not one INSERT ... ON CONFLICT) so several events for the SAME pair in one call apply
-- sequentially instead of erroring ("cannot affect row a second time").
create or replace function public.record_gap_events(events jsonb)
returns integer
language plpgsql
as $$
declare
  e jsonb;
  n integer := 0;
begin
  for e in select * from jsonb_array_elements(coalesce(events, '[]'::jsonb)) loop
    insert into public.gap_ledger as g
      (metric_a, metric_b, scope, status, lit_candidate, completeness, demand)
    values (
      least(e->>'metric_a', e->>'metric_b'),
      greatest(e->>'metric_a', e->>'metric_b'),
      'aggregate',
      e->>'status',
      e->'lit_candidate',
      (e->>'completeness')::numeric(4,3),
      coalesce((e->>'demand')::integer, 1)
    )
    on conflict (metric_a, metric_b, scope) do update set
      demand             = g.demand + excluded.demand,
      lit_candidate      = coalesce(excluded.lit_candidate, g.lit_candidate),
      completeness       = coalesce(excluded.completeness, g.completeness),
      status             = excluded.status,
      last_status_change = case when g.status is distinct from excluded.status
                                then now() else g.last_status_change end;
    n := n + 1;
  end loop;
  return n;
end;
$$;

comment on function public.record_gap_events(jsonb) is
  'Serve-path gap-event writer (§A1 upsert-increment): demand += per event, last-write-wins '
  'status with last_status_change bumped on transition. Aggregate scope only — never accepts '
  'a user id. Executable by service_role only.';

-- Functions default to EXECUTE for PUBLIC — only the engine (service_role) may write demand.
revoke execute on function public.record_gap_events(jsonb) from public, anon, authenticated;
grant execute on function public.record_gap_events(jsonb) to service_role;
