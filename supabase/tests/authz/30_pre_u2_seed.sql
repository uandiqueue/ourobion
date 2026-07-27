-- supabase/tests/authz/30_pre_u2_seed.sql
--
-- Fixtures for the RLS proof harness, applied as the superuser AFTER the pre-U2 migrations and
-- BEFORE the R4-U2 migrations, so the pre-U2 baseline probe (40_...) exercises real rows.
--
-- NINE SYNTHETIC IDENTITIES. Every value in this file is invented at authoring time and carries no
-- relationship to any real account: the uuids are hand-written non-random patterns and every email
-- is on the reserved `.invalid` TLD (RFC 2606), which can never resolve. There is no credential
-- here of any kind — the harness never authenticates; it asserts claims (see 20_probe_harness.sql).
--
--   aaaaaaaa-…-0001  viewer            effective nao member, tier viewer
--   aaaaaaaa-…-0002  curator           effective nao member, tier curator
--   aaaaaaaa-…-0003  admin             effective nao member, tier admin
--   aaaaaaaa-…-0004  suspended         nao_members row with status = 'suspended'   → must be denied
--   aaaaaaaa-…-0005  revoked           nao_members row with revoked_at set          → must be denied
--   aaaaaaaa-…-0006  deleted           nao_members row created then DELETED         → must be denied
--   aaaaaaaa-…-0007  dev2              a SECOND effective member (curator) — the "another dev"
--                                      target for the cross-user assertions (P-c)
--   bbbbbbbb-…-0001  biotope           NO nao_members row: an ordinary Biotope user. The
--                                      authenticated-but-unprovisioned subject, and the P-b subject
--   bbbbbbbb-…-0002  biotope2          a second Biotope-only user — the other P-c target
--
-- The membership rows themselves are seeded later (50_post_u2_seed.sql), because public.nao_members
-- does not exist until the R4-U2 migrations have been applied.

-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- 1 · Identities. Inserting into auth.users fires the 20260313 on_auth_user_created trigger,
--     which creates the matching public.profiles row — so profiles is deliberately NOT seeded
--     here (doing so would conflict) and the Biotope profile read path is exercised as it really
--     behaves.
-- ─────────────────────────────────────────────────────────────────────────────────────────────

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'viewer@harness.invalid'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'curator@harness.invalid'),
  ('aaaaaaaa-0000-4000-8000-000000000003', 'admin@harness.invalid'),
  ('aaaaaaaa-0000-4000-8000-000000000004', 'suspended@harness.invalid'),
  ('aaaaaaaa-0000-4000-8000-000000000005', 'revoked@harness.invalid'),
  ('aaaaaaaa-0000-4000-8000-000000000006', 'deleted@harness.invalid'),
  ('aaaaaaaa-0000-4000-8000-000000000007', 'dev2@harness.invalid'),
  ('bbbbbbbb-0000-4000-8000-000000000001', 'biotope@harness.invalid'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'biotope2@harness.invalid');

-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- 2 · Biotope per-user truth rows — one baseline row each, for the populate-path assertions.
--     data_origin / source = 'seed:baseline' makes the baseline count stable across phases, so a
--     pre-vs-post comparison of the SAME assertion name is exact even though each phase writes
--     its own extra rows on distinct dates.
-- ─────────────────────────────────────────────────────────────────────────────────────────────

insert into public.daily_gut_rows (user_id, log_date, data_origin)
select u, date '2026-01-01', 'seed:baseline'
from unnest(array[
  'aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000002',
  'aaaaaaaa-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000007',
  'bbbbbbbb-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000002'
]::uuid[]) as u;

insert into public.wearable_daily (user_id, date, resting_hr_bpm, source)
select u, date '2026-01-01', 60, 'seed:baseline'
from unnest(array[
  'aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000002',
  'aaaaaaaa-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000007',
  'bbbbbbbb-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000002'
]::uuid[]) as u;

-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- 3 · nao console surfaces (Class B). Synthetic node/spend/seed values within the migrations' own
--     CHECK bounds.
-- ─────────────────────────────────────────────────────────────────────────────────────────────

insert into public.llm_router_status
  (node, model_id, route, max_output_tokens, per_day_usd_cap, per_run_token_cap, hard_stop_fraction)
values
  ('seeder', 'harness-model-a', 'api_worker', 1024, 1.00, 50000, 0.900),
  ('verifier', 'harness-model-b', 'local_agent', 2048, 2.00, 80000, 0.800);

insert into public.llm_router_spend (day, node, calls, tokens_in, tokens_out, usd) values
  (date '2026-01-01', 'seeder', 3, 1200, 400, 0.00015125);

insert into public.llm_router_cap_overrides (node, per_day_usd_cap, per_run_token_cap, updated_by)
values ('seeder', 1.50, 60000, 'aaaaaaaa-0000-4000-8000-000000000003');

insert into public.ingestion_seeds (slug, label, query_hint, enabled, created_by) values
  ('harness_topic_alpha', 'Harness topic alpha', 'alpha query', true,
   'aaaaaaaa-0000-4000-8000-000000000002');

-- One row above the k = 5 small-cohort floor and one below it, so the floor is proven to BIND
-- rather than merely to exist. metric_a < metric_b is the table's own CHECK.
insert into public.gap_ledger (metric_a, metric_b, scope, status, demand) values
  ('metric_alpha', 'metric_beta',  'aggregate', 'lit-candidate-no-edge', 9),
  ('metric_delta', 'metric_gamma', 'aggregate', 'lit-candidate-no-edge', 2);

-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- 4 · Shared science tables (Class A) + the provenance chain, so the single most important
--     don't-break-Biotope path (get_insight_provenance, SECURITY INVOKER, called by Flutter as an
--     ordinary authenticated user) is exercised for real both before and after the column revoke.
-- ─────────────────────────────────────────────────────────────────────────────────────────────

insert into public.relationship_claims
  (edge_id, subject, object, relation, claim, prompt_version, synthesised_at)
values
  ('metric_alpha|increases|metric_beta', 'metric_alpha', 'metric_beta', 'increases',
   '{"derivation": "harness", "population": {"n": 0}}'::jsonb,
   'harness-v1', timestamptz '2026-01-01 00:00:00+00');

insert into public.edge_verifications
  (edge_id, verified_at, verification, verdict, status, edge_score, serving_band)
values
  ('metric_alpha|increases|metric_beta', timestamptz '2026-01-01 00:00:00+00',
   '{"status": "active"}'::jsonb, 'supported', 'active', 0.900, 'high');

insert into public.edge_human_verdicts (edge_id, action, reason, created_by) values
  ('metric_alpha|increases|metric_beta', 'reject', 'harness fixture',
   'aaaaaaaa-0000-4000-8000-000000000002');

insert into public.composed_insights
  (insight_id, user_id, period_start, period_end, branch, payload)
values
  ('harness-insight-0001', 'bbbbbbbb-0000-4000-8000-000000000001',
   date '2026-01-01', date '2026-01-07', 'agree',
   '{"patternKey": "harness.pattern", "completeness": {"score": 1}, "personal": null,
     "edges": [{"edgeId": "metric_alpha|increases|metric_beta", "direction": "positive",
                "servingBand": "high", "edgeScore": 0.9}]}'::jsonb);

insert into public.insight_cards
  (user_id, rule_id, title, body, category, producer, insight_id, edge_refs)
values
  ('bbbbbbbb-0000-4000-8000-000000000001', 'edge:metric_alpha|increases|metric_beta',
   'Harness card', 'Harness body', 'relationship', 'edge', 'harness-insight-0001',
   '[{"edgeId": "metric_alpha|increases|metric_beta",
      "verifiedAt": "2026-01-01T00:00:00+00:00"}]'::jsonb);
