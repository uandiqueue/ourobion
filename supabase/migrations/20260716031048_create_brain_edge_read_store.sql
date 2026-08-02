-- Brain · S6: D1 edge read store + gating — relationship_claims, edge_verifications,
-- verified_edges (docs/implemented/shared/insight-engine-architecture.md §S6; rationale in
-- docs/nao/brain-synthesis-design.md).
--
-- DERIVED PROJECTION of the truth-tier R2 edge artifacts (edges/claims.jsonl +
-- edges/verifications.jsonl, validated against the shared/brain contract). Populated ONLY by
-- tools/edge-loader/load_edges.mjs (transactional upsert + prune, full-rebuild supported).
-- NEVER hand-edit rows — fix the artifacts (or re-run synthesis/verification) and re-run the
-- loader (two-tier truth, docs/memory/0001).
--
-- Gating truth lives in shared/brain/index.ts (edgeScore / servingBand / EDGE_GATES): the loader
-- precomputes edge_score + serving_band with those exact functions so reads NEVER re-derive
-- gating. No graph DB: a 1-hop lookup is `where subject = $k or object = $k` over two btree
-- indexes (§S6 / rules-engine-design "The pattern").
--
-- CHECK sets below are held character-identical to the shared/brain contract enums by
-- tools/edge-loader/tests/edge_table_schema.test.ts (docs/graph/couplings.yaml
-- brain-edge-to-schema).
--
-- RLS: edges are GLOBAL population data (no user rows). Per §S6 "readable by authenticated
-- users": RLS on + a read policy for authenticated. The loader writes as service_role (bypasses
-- RLS), so there is no write policy — a deliberate deviation from the rules-table precedent,
-- which has NO read policy because only the engine (service_role) reads rules.

-- ═══════════════════════════════════════════════════════════════
-- 1. RELATIONSHIP CLAIMS — what synthesis proposed (one row per edge)
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.relationship_claims (
  edge_id         text primary key,      -- relationKey(subject, relation, object), shared/brain/index.ts
  subject         text not null,         -- canonical shared/metrics registry key
  object          text not null,         -- canonical shared/metrics registry key
  relation        text not null check (relation in
                    ('increases', 'decreases', 'modulates', 'correlates', 'confounds', 'no_effect')),
  claim           jsonb not null,        -- full RelationshipClaim, zod-validated at load
  prompt_version  text not null,
  synthesised_at  timestamptz not null,
  loaded_at       timestamptz not null default now()
);

comment on table public.relationship_claims is
  'DERIVED PROJECTION of the truth-tier R2 edge artifact edges/claims.jsonl (shared/brain '
  'contract). Rebuilt by tools/edge-loader/load_edges.mjs — never hand-edited (memory 0001). '
  'Re-synthesis replaces on edge_id.';
comment on column public.relationship_claims.claim is
  'The full RelationshipClaim record, verbatim from the artifact line (validated by '
  'shared/brain/relationships.schema.ts validateClaim before load).';

-- §S6 1-hop lookup: where subject = $k or object = $k.
create index if not exists relationship_claims_subject_idx on public.relationship_claims (subject);
create index if not exists relationship_claims_object_idx  on public.relationship_claims (object);

-- ═══════════════════════════════════════════════════════════════
-- 2. EDGE VERIFICATIONS — append-only; "edge version" = (edge_id, verified_at)
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.edge_verifications (
  edge_id       text not null references public.relationship_claims(edge_id) on delete cascade,
  verified_at   timestamptz not null,
  verification  jsonb not null,          -- full EdgeVerification, zod-validated at load
  verdict       text not null check (verdict in
                  ('supported', 'partial', 'unsupported', 'contradicted', 'uncertain')),
  status        text not null check (status in ('active', 'stale', 'superseded')),
  edge_score    numeric(4,3) not null check (edge_score >= 0 and edge_score <= 1),
  serving_band  text not null check (serving_band in ('high', 'mid', 'hold')),
  loaded_at     timestamptz not null default now(),
  primary key (edge_id, verified_at)
);

comment on table public.edge_verifications is
  'DERIVED PROJECTION of the truth-tier R2 edge artifact edges/verifications.jsonl '
  '(shared/brain contract). Rebuilt by tools/edge-loader/load_edges.mjs — never hand-edited. '
  'Append-only: an edge version is (edge_id, verified_at); when a newer active verification '
  'lands, the loader flips prior active rows'' status column to superseded.';
comment on column public.edge_verifications.edge_score is
  'Precomputed at load by shared/brain/index.ts edgeScore() — the single source of gating '
  'truth. Reads never re-derive it.';
comment on column public.edge_verifications.serving_band is
  'Precomputed at load by shared/brain/index.ts servingBand() over EDGE_GATES '
  '(high >= 0.8, mid >= 0.5, else hold — hold is never served).';
comment on column public.edge_verifications.status is
  'Serving lifecycle. May differ from verification->>''status'' (kept verbatim from the '
  'artifact): the loader supersedes older active rows when a newer active verification of the '
  'same edge exists.';

-- ═══════════════════════════════════════════════════════════════
-- 3. VERIFIED EDGES — newest ACTIVE verification per edge (the servable unit)
-- ═══════════════════════════════════════════════════════════════

create or replace view public.verified_edges
  with (security_invoker = true) as
  select distinct on (c.edge_id)
         c.*, v.verified_at, v.verification, v.verdict, v.edge_score, v.serving_band
  from public.relationship_claims c
  join public.edge_verifications v using (edge_id)
  where v.status = 'active'
  order by c.edge_id, v.verified_at desc;

comment on view public.verified_edges is
  'Newest active verification per edge, with precomputed edge_score / serving_band (§S6). '
  'S7 / A1 read this; serving_band = hold rows are visible but must never be surfaced '
  '(shared/brain isServable).';

-- ═══════════════════════════════════════════════════════════════
-- 4. RLS — global population data: authenticated read, service-role writes
-- ═══════════════════════════════════════════════════════════════

alter table public.relationship_claims enable row level security;
alter table public.edge_verifications  enable row level security;

create policy "Authenticated users can read relationship claims"
  on public.relationship_claims for select
  to authenticated
  using (true);

create policy "Authenticated users can read edge verifications"
  on public.edge_verifications for select
  to authenticated
  using (true);

-- No write policies on purpose: only the loader writes, as service_role (bypasses RLS).
