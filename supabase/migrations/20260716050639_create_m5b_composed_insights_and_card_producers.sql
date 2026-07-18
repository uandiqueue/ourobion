-- M5b · S7 + S8: composed_insights store + the insight_cards producer columns
-- (docs/shared/insight-engine-architecture.md §S7 store / §S8 card-table migration).
--
-- S7: composed_insights — the composer's branch-classified output (append-only; insight_id is a
-- deterministic hash of (user_id, patternKey, edgeId|'none', period_start), so re-runs are
-- idempotent inserts). PROJECTION TIER (two-tier truth, docs/memory/0001): rebuildable by
-- re-running generate-insights over metric_daily_values + baseline_snapshots + personal_signals +
-- verified_edges. Never hand-edit.
--
-- S8: insight_cards gains the three producer columns — ONE table, THREE producers, disjoint
-- rule_id key spaces (§S8 rationale):
--   producer 'rules'    -> rule_id = blueprint ruleId            (the rules-engine producer)
--   producer 'edge'     -> rule_id = 'edge:' || edge_id          (the composer's cited cards)
--   producer 'personal' -> rule_id = 'personal:' || a || '|' || b (the "still researching" variant)
-- All additive with defaults, so every existing row stays valid ('rules', edge_refs '[]',
-- insight_id null). The category CHECK gains 'relationship' (composer cards); a CHECK enforces
-- that a personal card can NEVER carry a citation (edge_refs must stay '[]' — §S8: this variant
-- cannot acquire a citation without going back through the edge pipeline).

-- ═══════════════════════════════════════════════════════════════
-- 1. COMPOSED_INSIGHTS (§S7 store)
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.composed_insights (
  insight_id    text primary key,        -- sha-256 of (user_id, patternKey, edgeId|'none', period_start)
  user_id       uuid not null references auth.users(id) on delete cascade,
  period_start  date not null,
  period_end    date not null,
  branch        text not null check (branch in
                  ('agree', 'research-context', 'idiosyncratic', 'contradiction')),
  payload       jsonb not null,          -- full ComposedInsight (pattern, edges, personal, completeness)
  created_at    timestamptz not null default now()
);

comment on table public.composed_insights is
  'S7 composer output (projection tier — rebuilt by generate-insights from FiredPatterns x '
  'verified_edges x personal_signals; never hand-edit). Append-only: the deterministic insight_id '
  'makes re-runs idempotent. agree -> cited card; idiosyncratic -> "still researching" card; '
  'research-context / contradiction are recorded but never surfaced (gap-ledger fuel, A1 later).';
comment on column public.composed_insights.payload is
  'The full ComposedInsight record: pattern, edges (with per-edge direction / servingBand / '
  'edgeScore / citations / U1 applicability — stub ''unknown'' until the grader ships), personal '
  '{rho, nEff, qValue, stable} | null, branch, completeness {score, daysPresent, windowDays, perMetric}.';

create index if not exists composed_insights_user_period_idx
  on public.composed_insights (user_id, period_start desc);

alter table public.composed_insights enable row level security;

create policy "Users can read own composed insights"
  on public.composed_insights for select
  using (auth.uid() = user_id);

-- No write policy on purpose: only the engine (service_role) writes.

-- ═══════════════════════════════════════════════════════════════
-- 2. INSIGHT_CARDS — producer / insight_id / edge_refs (§S8)
-- ═══════════════════════════════════════════════════════════════

alter table public.insight_cards
  add column if not exists producer text not null default 'rules'
    check (producer in ('rules', 'edge', 'personal')),
  add column if not exists insight_id text references public.composed_insights(insight_id),
  add column if not exists edge_refs jsonb not null default '[]';

comment on column public.insight_cards.producer is
  'Which producer owns this row''s rule_id namespace: rules (blueprint id), edge '
  '(''edge:''||edge_id, cited relationship card), personal (''personal:''||a||''|''||b, the '
  'uncited "still researching" variant). Each producer upserts only its own namespace.';
comment on column public.insight_cards.edge_refs is
  'The card <-> edge join: [{edgeId, verifiedAt}] — an edge VERSION per §S6 (one card may rest '
  'on several 1-hop edges). Always [] for producer=personal (CHECK below).';

-- category gains 'relationship' (composer cards). The rules table's category CHECK stays the
-- narrower blueprint set — cards are now a SUPERSET (rules set + 'relationship'); guard:
-- apps/biotope/test/guards/rules_table_contract_test.dart.
alter table public.insight_cards drop constraint insight_cards_category_check;
alter table public.insight_cards add constraint insight_cards_category_check
  check (category in ('hydration', 'gut', 'vector', 'behaviour', 'descriptive', 'relationship'));

-- The still-researching variant is uncited BY CONSTRUCTION (§S8).
alter table public.insight_cards add constraint insight_cards_personal_uncited
  check (producer <> 'personal' or edge_refs = '[]'::jsonb);
