-- Audit U25 · constraint hygiene — findings A16 + A17
-- (docs/temp/phase2-audit/audit-findings-register.md; NEW additive migration per sign-off
-- decision D19: shipped migrations are append-only even while unreleased — never edited).
--
-- A17: cheap CHECKs the S5/S7 tables were missing while their siblings encode analogous
-- invariants (state_bands band ordering, edge_verifications score range). The engine is the
-- only writer, so these guard against a silent engine regression landing impossible rows,
-- not against user input. All CHECKs are null-tolerant by SQL semantics, which is exactly
-- right for the nullable ci_low/ci_high (null = CI not computable when n_eff too small).
--
-- A16: edge_verifications.edge_score numeric(4,3) rounded the loader's float (0.7996 →
-- 0.800) while serving_band was precomputed on the UNROUNDED value ('mid') — at a gate
-- boundary the stored row can visually contradict the band (score reads 0.800 against
-- EDGE_GATES.high = 0.8). Band stays authoritative; widening to unconstrained numeric stores
-- the score exactly as shared/brain edgeScore() computed it (the D11 precedent:
-- baseline_snapshots' stat columns were widened numeric(6,3) → numeric the same way).

-- ═══════════════════════════════════════════════════════════════
-- 1. A17 — composed_insights: a period cannot end before it starts
-- ═══════════════════════════════════════════════════════════════

alter table public.composed_insights
  add constraint composed_insights_period_order check (period_end >= period_start);

-- ═══════════════════════════════════════════════════════════════
-- 2. A17 — personal_signals: statistical ranges
-- ═══════════════════════════════════════════════════════════════

-- Spearman rank correlation and its Fisher-z CI bounds live in [-1, 1]; a BH-adjusted
-- q value lives in [0, 1]. ci_low/ci_high are nullable (n_eff too small) — a NULL passes
-- its CHECK, so the "no CI" state stays representable.
alter table public.personal_signals
  add constraint personal_signals_rho_range     check (rho     between -1 and 1),
  add constraint personal_signals_ci_low_range  check (ci_low  between -1 and 1),
  add constraint personal_signals_ci_high_range check (ci_high between -1 and 1),
  add constraint personal_signals_q_value_range check (q_value between 0 and 1);

-- ═══════════════════════════════════════════════════════════════
-- 3. A16 — edge_verifications.edge_score: store the unrounded score
-- ═══════════════════════════════════════════════════════════════

-- verified_edges selects v.edge_score, and Postgres refuses to alter the type of a column a
-- view depends on — so drop and recreate the view around the ALTER. The definition below is
-- character-identical to 20260716031048_create_brain_edge_read_store.sql (held so by
-- tools/edge-loader/tests/edge_table_schema.test.ts).
drop view public.verified_edges;

-- The [0, 1] range CHECK from the create-table migration survives the type change; only the
-- precision cap goes. Existing rows keep their (already-rounded) values — the loader's next
-- full rebuild repopulates them unrounded (derived projection, docs/memory/0001).
alter table public.edge_verifications
  alter column edge_score type numeric;

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

comment on column public.edge_verifications.edge_score is
  'Precomputed at load by shared/brain/index.ts edgeScore() — the single source of gating '
  'truth. Reads never re-derive it. Unconstrained numeric on purpose (A16): the stored score '
  'is exactly the float the loader computed, so it can never round into visually '
  'contradicting the serving_band that was gated on the unrounded value.';
