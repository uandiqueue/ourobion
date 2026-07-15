-- M5b / rules-engine B2: rules table — DERIVED PROJECTION of the data/rules/** blueprints.
--
-- Two-tier truth (docs/memory/0007-rules-as-data-two-tier.md): the git-tracked JSON blueprints at
-- data/rules/{single,cross}/<category>/<rule_id>.json (validated by shared/rules) are TRUTH; this
-- table is a rebuildable projection populated ONLY by tools/rules/load_rules.mjs (full-rebuild
-- transactional upsert + prune). Never hand-edit rows — fix a blueprint and re-run the loader.
--
-- The engine (generate-insights, refactor step C) reads in-force rows with:
--   enabled_phase = $active and deprecated_at is null
--   and (effective_from is null or effective_from <= current_date)
--   and (effective_to   is null or effective_to   >= current_date)
--
-- category / severity CHECK sets are character-identical to insight_cards' (guarded by
-- apps/biotope/test/guards/rules_table_contract_test.dart via docs/graph/couplings.yaml).
--
-- RLS: rules are global server data, not per-user. RLS is on with NO user/anon policy — the loader
-- writes and the engine reads as service_role, which bypasses RLS (mirrors baseline_snapshots'
-- write path).

-- ═══════════════════════════════════════════════════════════════
-- 1. RULES
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.rules (
  rule_id          text primary key,                 -- == blueprint ruleId == insight_cards.rule_id
  schema_version   smallint not null,

  scope            text not null check (scope in ('single', 'cross')),
  metric_keys      text[] not null,                  -- registry keys the rule reads (1 = single, 2+ = cross)
  condition_type   text not null check (condition_type in ('trend', 'threshold', 'coincidence')),
  condition_params jsonb not null,                   -- the condition leaf minus its 'type' discriminator

  title_template   text not null,                    -- copy-gated at load (validateCopyString)
  body_template    text not null,

  severity         text not null check (severity in ('info', 'notice', 'watch')) default 'info',
  category         text not null check (category in ('hydration', 'gut', 'vector', 'behaviour', 'descriptive')),
  enabled_phase    text not null,

  provenance_tier  text not null check (provenance_tier in ('hand_authored', 'extracted')),
  source_citation  jsonb,                            -- { sourceNote, citation } from blueprint provenance

  effective_from   date,
  effective_to     date,
  status           text not null check (status in ('active', 'deprecated')) default 'active',
  deprecated_at    timestamptz,

  cooldown_days    smallint check (cooldown_days > 0),
  expiry_days      smallint not null check (expiry_days > 0),

  loaded_at        timestamptz not null default now(),
  content_hash     text not null                     -- sha256 of the canonical blueprint JSON
);

comment on table public.rules is
  'DERIVED PROJECTION of data/rules/** blueprints (TRUTH, shared/rules contract). Rebuilt by tools/rules/load_rules.mjs — never hand-edited (memory 0007).';

-- The engine only ever scans in-force rules.
create index if not exists rules_in_force_idx
  on public.rules (enabled_phase)
  where deprecated_at is null;

alter table public.rules enable row level security;

-- No user/anon policies on purpose: loader (write) and engine (read) both run as service_role.
