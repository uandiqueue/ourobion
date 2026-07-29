-- R4-U3 · stable demand identity for gap_ledger (design §D.3)
--
-- THE PROBLEM, PRECISELY. public.record_gap_events is DELIBERATELY additive:
-- `demand = g.demand + excluded.demand` (20260724090000_create_a1_gap_ledger.sql:104-105), and
-- `demand` is documented as "incremented per demanding user per generate-insights run" (:49-51). A
-- legitimate rerun over new data and an accidental replay over unchanged data are therefore
-- INDISTINGUISHABLE today: a retried pipeline double-counts demand, and nothing can tell that apart
-- from real new demand.
--
-- WHY NOT A COLUMN ON gap_ledger. authz_probe.colpriv_state (20_probe_harness.sql:174-188) ×
-- 70_non_regression.sql:113-121 asserts the column-privilege diff against the pre-U2 snapshot is 0
-- for every table in that snapshot, and gap_ledger IS in it. A `demand_key` column would add 12
-- rows to colpriv_state that are absent from colpriv_snapshot and fail the assertion. So identity
-- lives in a NEW table.
--
-- WHY record_gap_events IS LEFT BYTE-IDENTICAL. It is A1's function and other units are its declared
-- future callers; `create or replace` on it would silently change their semantics. The keyed writer
-- below is a SECOND function with the same inner upsert, not a replacement.

-- ═══════════════════════════════════════════════════════════════
-- 1. GAP_DEMAND_APPLICATIONS — "this (key, event) has already been applied"
-- ═══════════════════════════════════════════════════════════════
--
-- PER-EVENT granularity, not per-run: a crash midway through the event loop leaves the events
-- already applied recorded WITH their increments, and a retry with the same key applies only the
-- remainder. That is what makes the loop resumable rather than all-or-nothing.
--
-- `status` is part of the primary key because that is pushGap's own event identity
-- (aggKey = `${a}|${b}:${status}`, supabase/functions/generate-insights/index.ts:476), so two events
-- for the same pair with different statuses stay distinct here exactly as they do there.
--
-- No user ids, ever — gap_ledger's §A1 privacy invariant extends to this table by construction: it
-- stores only a digest, a metric pair, a scope and a status.

create table if not exists public.gap_demand_applications (
  demand_key text not null check (char_length(demand_key) between 8 and 128),
  metric_a   text not null,
  metric_b   text not null,
  scope      text not null,
  status     text not null,
  applied_at timestamptz not null default now(),
  primary key (demand_key, metric_a, metric_b, scope, status)
);

comment on table public.gap_demand_applications is
  'R4-U3 · idempotency ledger for gap-ledger demand. One row per (demand_key, pair, scope, status) '
  'that has ALREADY been applied. record_gap_events_keyed increments gap_ledger.demand only when the '
  'insert here is new, so replaying a pipeline over unchanged inputs cannot double-count demand '
  'while a genuinely new run (new inputs ⇒ new key) still increments additively, exactly as A1 '
  'intends. Contains no user identifiers — the §A1 privacy invariant holds by construction.';
comment on column public.gap_demand_applications.demand_key is
  'sha256(''gi.v1'' ⟂ day ⟂ inputDigest) computed by generate-insights over its INPUTS — the metric '
  'values, personal signals, baseline snapshots, verified edges and rule templates it fetched — not '
  'over the emitted events. Keying on outputs would dedupe a run over genuinely new data that '
  'happened to produce an identical event set, and lose a legitimate fire.';

alter table public.gap_demand_applications enable row level security;   -- zero policies
revoke all on public.gap_demand_applications from anon, authenticated;
grant select, insert on public.gap_demand_applications to service_role;

-- ═══════════════════════════════════════════════════════════════
-- 2. RECORD_GAP_EVENTS_KEYED — the same upsert, applied at most once per (key, event)
-- ═══════════════════════════════════════════════════════════════
--
-- The inner INSERT ... ON CONFLICT body is character-for-character the one in
-- public.record_gap_events (20260724090000:93-110), including the least()/greatest() pair
-- normalisation, the demand default of 1, and the last_status_change bump on transition — so a
-- keyed call that DOES apply is indistinguishable from the unkeyed one.
--
-- SECURITY INVOKER (like record_gap_events), service_role EXECUTE only: the engine is the only
-- caller and it already runs as service_role.

create or replace function public.record_gap_events_keyed(events jsonb, p_demand_key text)
returns jsonb
language plpgsql
volatile
set search_path = public, pg_temp
as $$
declare
  e       jsonb;
  n       integer;
  applied integer := 0;
  skipped integer := 0;
begin
  if p_demand_key is null or char_length(p_demand_key) < 8 then
    raise exception 'record_gap_events_keyed: a demand key of at least 8 characters is required'
      using errcode = '22023';
  end if;

  for e in select * from jsonb_array_elements(coalesce(events, '[]'::jsonb)) loop
    -- Claim the event for this key. `do nothing` is the whole idempotency mechanism.
    insert into public.gap_demand_applications (demand_key, metric_a, metric_b, scope, status)
    values (p_demand_key,
            least(e->>'metric_a', e->>'metric_b'),
            greatest(e->>'metric_a', e->>'metric_b'),
            'aggregate',
            e->>'status')
    on conflict do nothing;
    get diagnostics n = row_count;

    if n = 1 then
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
      applied := applied + 1;
    else
      skipped := skipped + 1;
    end if;
  end loop;

  return jsonb_build_object('applied', applied, 'skipped', skipped);
end;
$$;

comment on function public.record_gap_events_keyed(jsonb, text) is
  'R4-U3 · the keyed serve-path gap-event writer. Identical to record_gap_events''s upsert, but each '
  '(demand_key, pair, scope, status) is applied AT MOST ONCE, so an identical replay increments '
  'nothing while a run over genuinely new inputs (new digest ⇒ new key) increments additively. '
  'Returns {applied, skipped} so a replay is VISIBLE in the pipeline output rather than merely '
  'harmless. Aggregate scope only — never accepts a user id. Executable by service_role only.';

revoke execute on function public.record_gap_events_keyed(jsonb, text)
  from public, anon, authenticated;
grant execute on function public.record_gap_events_keyed(jsonb, text) to service_role;
