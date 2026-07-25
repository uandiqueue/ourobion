-- O10 · llm-router read boundaries for nao's model-config panel (run-2 U8; DEMO feature (a)).
--
-- nao may NOT read tools/ files directly (O10 locked decision) — the backend exposes the
-- router's config + spend as Supabase read surfaces instead. TWO-TIER TRUTH: the source of
-- truth for config stays tools/llm-router/router.config.json and for spend stays the
-- file-backed ledger data/llm-router/ledger.json; the two tables below are REBUILDABLE
-- PROJECTIONS published by tools/llm-router/scripts/publish-status.ts (service_role,
-- explicit script — NOT auto-published per call this cycle). Never hand-edit them.
--
-- The ONE write surface (O10 demo exception, caps ONLY): llm_router_cap_overrides.
-- Authenticated users (the two ourobion devs — dev-only posture per this run's D3
-- precedent) may set per-node per-day-USD / per-run-token cap overrides, audited via
-- updated_by. The router consumes overrides FAIL-SOFT at check time (file config wins
-- when the boundary is unreachable). CHECK bounds keep a UI typo from blowing the run
-- budget: per_day_usd_cap <= 5.00 (run budget is hard-capped ~14.7 USD total; C-entry
-- candidate) and per_run_token_cap <= 200000 (C7's originally-shipped per-run ceiling).
-- NO other write surfaces: no source toggles, no model-id editing (locked).

-- ═══════════════════════════════════════════════════════════════
-- 1. LLM_ROUTER_STATUS — published config snapshot (one row per node)
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.llm_router_status (
  node               text not null primary key,
  model_id           text not null,
  route              text not null check (route in ('local_agent', 'api_worker')),
  max_output_tokens  integer not null check (max_output_tokens > 0),
  per_day_usd_cap    numeric(8,2) not null check (per_day_usd_cap > 0),
  per_run_token_cap  integer not null check (per_run_token_cap > 0),
  hard_stop_fraction numeric(4,3) not null check (hard_stop_fraction > 0 and hard_stop_fraction <= 1),
  test_mode          boolean not null default false,
  test_mode_reason   text,
  published_at       timestamptz not null default now()
);

comment on table public.llm_router_status is
  'PROJECTION of tools/llm-router/router.config.json (O10 read boundary for nao) — rebuildable, '
  'never hand-edited; published by tools/llm-router/scripts/publish-status.ts (service_role). '
  'Source of truth stays the config file (two-tier truth). per_day_usd_cap / per_run_token_cap '
  'here are the FILE values; effective caps also honour llm_router_cap_overrides.';

-- ═══════════════════════════════════════════════════════════════
-- 2. LLM_ROUTER_SPEND — published budget-ledger snapshot ((day, node) rows)
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.llm_router_spend (
  day          date not null,
  node         text not null,
  calls        integer not null default 0 check (calls >= 0),
  tokens_in    bigint  not null default 0 check (tokens_in >= 0),
  tokens_out   bigint  not null default 0 check (tokens_out >= 0),
  -- 8 dp: single cheap calls are ~1.5e-4 USD (U1's real smoke entry is 0.00015125) —
  -- 6 dp would round real cents-of-a-cent spend away.
  usd          numeric(14,8) not null default 0 check (usd >= 0),
  published_at timestamptz not null default now(),
  primary key (day, node)
);

comment on table public.llm_router_spend is
  'PROJECTION of the llm-router budget ledger data/llm-router/ledger.json (O10 read boundary '
  'for nao) — rebuildable, never hand-edited; published by tools/llm-router/scripts/'
  'publish-status.ts (service_role). Source of truth stays the ledger file (two-tier truth). '
  'Freshness is publish-driven: consumers must treat published_at honestly (stale hint in nao).';

-- ═══════════════════════════════════════════════════════════════
-- 3. LLM_ROUTER_CAP_OVERRIDES — the one write surface (caps only, demo exception)
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.llm_router_cap_overrides (
  node              text not null primary key check (node in
                      ('seeder', 'synthesis', 'verifier',
                       'phrasing_card', 'report_narrative', 'extract_assist')),
  -- Bounds are load-bearing (see header): a NULL clears that override (file value applies).
  per_day_usd_cap   numeric(8,2) check (per_day_usd_cap > 0 and per_day_usd_cap <= 5.00),
  per_run_token_cap integer      check (per_run_token_cap > 0 and per_run_token_cap <= 200000),
  updated_by        uuid not null,
  updated_at        timestamptz not null default now()
);

comment on table public.llm_router_cap_overrides is
  'O10 demo exception — the ONLY nao write surface for the router: per-node token/spend CAP '
  'overrides (nothing else; no source toggles, no model ids — locked). Consumed FAIL-SOFT by '
  'tools/llm-router (src/overrides.ts): an override REPLACES the file cap for that node, '
  'bounded by the CHECKs above (per_day_usd_cap <= 5.00 protects the ~14.7 USD run budget '
  'from UI typos — C-entry candidate). node CHECK mirrors LLM_NODE_IDS '
  '(tools/llm-router/src/types.ts); adding a node needs a new migration by design.';
comment on column public.llm_router_cap_overrides.updated_by is
  'auth.users id of the (authenticated) editor — audit trail for the demo write path.';

-- ═══════════════════════════════════════════════════════════════
-- 4. RLS — authenticated read everywhere; write ONLY on cap_overrides
--    (dev-only posture per this run's D3 precedent: any authenticated user
--    is one of the two ourobion devs). service_role bypasses RLS to publish.
-- ═══════════════════════════════════════════════════════════════

alter table public.llm_router_status enable row level security;
alter table public.llm_router_spend enable row level security;
alter table public.llm_router_cap_overrides enable row level security;

create policy "Authenticated users can read llm router status"
  on public.llm_router_status for select
  to authenticated
  using (true);

create policy "Authenticated users can read llm router spend"
  on public.llm_router_spend for select
  to authenticated
  using (true);

create policy "Authenticated users can read llm router cap overrides"
  on public.llm_router_cap_overrides for select
  to authenticated
  using (true);

-- The demo write path: INSERT/UPDATE only (no DELETE — clear a cap by setting it NULL),
-- and the row must carry the editor's own uid so updated_by cannot be forged.
create policy "Authenticated users can insert llm router cap overrides"
  on public.llm_router_cap_overrides for insert
  to authenticated
  with check (updated_by = auth.uid());

create policy "Authenticated users can update llm router cap overrides"
  on public.llm_router_cap_overrides for update
  to authenticated
  using (true)
  with check (updated_by = auth.uid());
