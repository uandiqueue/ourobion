-- R4-U2 · nao staff-only boundary (AS RESTRICTIVE policies) + identity-column redaction grants.
--
-- This is the DATABASE half of the two-layer enforcement design (§B). It is genuinely
-- independent of the route matrix: it is declared here in SQL and derived from nothing in
-- apps/nao, so a route-layer bug — a forgotten guard, a wrong role constant, an unlisted new
-- route — cannot open the database, and a direct PostgREST or /rest/v1/rpc call that never
-- touches Next.js is still denied.
--
-- ── MECHANISM: `AS RESTRICTIVE`, and nothing else ────────────────────────────────────────────
-- Postgres combines PERMISSIVE policies with OR and RESTRICTIVE policies with AND. Adding a
-- restrictive policy therefore NARROWS access without editing, renaming, dropping or recreating
-- one existing policy. Every pre-existing policy body in this schema stays byte-identical; this
-- migration only ADDS. That is the entire "don't break Biotope" strategy, and it is mechanically
-- checkable, and deliberately checkable by the crudest possible tool: no R4-U2 migration contains a
-- policy-dropping statement anywhere — not even inside a comment — so a plain case-insensitive grep
-- for that statement across supabase/migrations/20260728010*.sql returns zero hits with no reading
-- required, and none reuses an existing policy name. supabase/tests/authz asserts both at the catalog
-- level as well, plus a full pg_policies snapshot diff in both directions.
--
-- ── HOW A DIRECT PostgREST CALL BY A NON-MEMBER IS DENIED ────────────────────────────────────
-- A valid user JWT sets `role = authenticated` and request.jwt.claims.sub, so auth.uid()
-- resolves and the caller reaches the table. The restrictive policy then calls
-- public.nao_has_role('viewer'), which finds no effective public.nao_members row and returns
-- false. `permissive AND restrictive` = false ⇒ zero rows on SELECT, and
-- "new row violates row-level security policy" (SQLSTATE 42501 → HTTP 403) on INSERT/UPDATE.
-- An RPC to public.nao_authorize raises 42501 → HTTP 403. No route code participates.
--
-- ── TABLES DELIBERATELY NOT TOUCHED (the named non-regression list, §B.3) ────────────────────
-- profiles, consent_records, daily_gut_rows, antibiotic_courses, baseline_snapshots,
-- insight_cards, engagement_state, wearable_daily, events, state_bands, signals,
-- derived_metrics, rules, personal_signals, composed_insights.
-- Not one line of their policies or grants changes here.
--
-- daily_gut_rows and wearable_daily are called out by name because they are the POPULATE PATH's
-- enforcement surface (design invariant P): nao's loader writes the ACTING DEV'S OWN rows, under
-- that dev's own session and own user_id, and relies on the existing `auth.uid() = user_id`
-- policies. A restrictive policy there — even one that looks harmless, e.g. requiring
-- nao_has_role('viewer') — would break the loader, and would do so SILENTLY: an upsert's
-- conflict target goes invisible and the UPDATE branch affects zero rows without raising, so the
-- route would answer ok:true over an empty database. Hence: no restrictive policy, no grant
-- change, no policy edit on either table. Asserted three ways in supabase/tests/authz (P-a, P-c,
-- and a pg_policies RESTRICTIVE-count assertion).
--
-- ── ACCEPTED LIMIT: relationship_claims / edge_verifications / edge_human_verdicts READS ─────
-- These three keep their open `to authenticated using (true)` read policies. public.verified_edges
-- is `security_invoker = true` and public.get_insight_provenance(bigint) is SECURITY INVOKER and
-- granted to `authenticated`; Biotope (Flutter) calls the latter as an ordinary authenticated
-- user. A restrictive READ policy on any of the three would blank every Biotope user's provenance
-- view — and would silently blank human_verdict, so a rejected edge would look un-rejected. So
-- these three get WRITE-side and COLUMN-side restrictions only. A non-member can still read the
-- claim rows themselves; they carry no user identity, and after the column revoke below they
-- carry no curator identity either. This is an accepted, recorded limit (design §H.1.6), not an
-- oversight; closing it means giving get_insight_provenance an ownership guard, which is a
-- different unit.

-- ═══════════════════════════════════════════════════════════════
-- 1. CLASS B — nao-console-only tables: membership gate on read, role gate on write
--
-- Safe because no apps/biotope or shared code file references any of these tables, and every
-- non-nao reader (tools/llm-router publish-status, tools/brain-ingest seeder, tools/edge-loader,
-- the generate-insights function) connects as service_role, which has BYPASSRLS and is named in
-- none of the policies below (all are `to authenticated`).
-- ═══════════════════════════════════════════════════════════════

-- 1.1 llm_router_status — published config projection. Console read surface.
create policy "nao members only can read llm router status"
  on public.llm_router_status as restrictive for select
  to authenticated
  using (public.nao_has_role('viewer'));

-- 1.2 llm_router_spend — published budget projection. Console read surface.
create policy "nao members only can read llm router spend"
  on public.llm_router_spend as restrictive for select
  to authenticated
  using (public.nao_has_role('viewer'));

-- 1.3 llm_router_cap_overrides — reading caps is a console read; CHANGING a spend cap is money,
--     so it is admin-only at the database, independently of the route matrix.
create policy "nao members only can read llm router cap overrides"
  on public.llm_router_cap_overrides as restrictive for select
  to authenticated
  using (public.nao_has_role('viewer'));

create policy "nao admins only can insert llm router cap overrides"
  on public.llm_router_cap_overrides as restrictive for insert
  to authenticated
  with check (public.nao_has_role('admin'));

create policy "nao admins only can update llm router cap overrides"
  on public.llm_router_cap_overrides as restrictive for update
  to authenticated
  using (public.nao_has_role('admin'))
  with check (public.nao_has_role('admin'));

-- 1.4 ingestion_seeds — corpus operation is curator work. The existing column-level
--     `grant update (enabled)` restriction from 20260724152525 is untouched and still applies.
create policy "nao members only can read ingestion seeds"
  on public.ingestion_seeds as restrictive for select
  to authenticated
  using (public.nao_has_role('viewer'));

create policy "nao curators only can add ingestion seeds"
  on public.ingestion_seeds as restrictive for insert
  to authenticated
  with check (public.nao_has_role('curator'));

create policy "nao curators only can toggle ingestion seeds"
  on public.ingestion_seeds as restrictive for update
  to authenticated
  using (public.nao_has_role('curator'))
  with check (public.nao_has_role('curator'));

-- 1.5 gap_ledger — membership gate PLUS a small-cohort floor.
--
-- k = 5 is the conventional minimum cell size in statistical disclosure control for health
-- aggregates (US NCHS/CDC and UK ONS both suppress cells below 5) and matches Singapore PDPC
-- anonymisation guidance (k >= 5), which this repo already treats as binding. In a cohort of two
-- devs plus demo accounts, a count of 1-2 is effectively an identifier; k = 5 removes single-user
-- and pair inference outright. k = 10 would empty the panel in a two-user environment and invite
-- someone to switch the floor off — a threshold that gets disabled protects nothing.
--
-- HONEST LIMIT: gap_ledger.demand is a FIRE COUNT, not a distinct-user count (the table
-- deliberately stores no user ids), so `demand >= 5` is heuristic suppression, not true
-- k-anonymity: one user firing five times passes the floor. Closing that properly needs the
-- aggregator to record a distinct_user_count, which is outside this unit.
-- Policy name kept under Postgres' 63-byte identifier limit: a longer one is silently TRUNCATED,
-- which would leave a name in the catalog that does not match the name in this file.
create policy "nao members only read gap ledger above cohort floor"
  on public.gap_ledger as restrictive for select
  to authenticated
  using (public.nao_has_role('viewer') and demand >= 5);

-- ═══════════════════════════════════════════════════════════════
-- 2. CLASS A — Biotope-reachable shared science tables: WRITE gate only, reads left open
-- ═══════════════════════════════════════════════════════════════

-- Recording a human verdict over the adversarial verifier is curator work. Today ANY
-- authenticated account can do it via direct PostgREST; after this it needs curator membership.
-- The existing permissive policy's `created_by = auth.uid()` check is untouched and still runs.
create policy "nao curators only can record edge human verdicts"
  on public.edge_human_verdicts as restrictive for insert
  to authenticated
  with check (public.nao_has_role('curator'));

-- ═══════════════════════════════════════════════════════════════
-- 3. IDENTITY-COLUMN REDACTION — revoke the table grant FIRST, then grant explicit columns
--
-- THE TRAP (and why the order matters): in Postgres a table-level SELECT grant implies every
-- column, and a column-level REVOKE cannot subtract from it — `revoke select (updated_by)` after
-- a table-level grant is a NO-OP. The only working form is: revoke the table-level privilege,
-- then grant an explicit column list. This repo already uses exactly that pattern for UPDATE at
-- 20260724152525_create_o14_ingestion_seeds.sql:65-66.
--
-- CONSEQUENCE, which is also a feature: `select *` (PostgREST `select=*`) on these three tables
-- now returns 42501 for `authenticated`. Any future code that reaches for `*` on a redacted table
-- fails LOUDLY instead of quietly leaking a staff uuid.
--
-- WHY NO VIEW AND NO READ RPC: a `security_invoker = true` view over a column-revoked table fails
-- for the same reason `select *` does, and a definer view or definer read-RPC would bypass the
-- base table's RLS — precisely the hazard this unit exists to remove. So identity is NOT
-- re-exposed under a friendlier label. Curator identity remains available exactly where it
-- belongs: in the admin-only, append-only public.nao_control_events log — written by
-- recordControlEvent() in apps/nao/src/lib/authzServer.ts, which every mutating nao route
-- handler calls (a source-conformance test in apps/nao/tests/authz.test.ts fails the build if one
-- does not) — and to service_role for engineering. Nowhere else.
--
-- anon is revoked and granted nothing: every read policy on these tables is `to authenticated`,
-- so anon already saw zero rows; removing the dangling grant keeps the privilege map honest.
-- ═══════════════════════════════════════════════════════════════

-- 3.1 llm_router_cap_overrides.updated_by — a raw auth.users uuid, today returned to every
--     authenticated caller by `select('*')` in the models route.
revoke select on public.llm_router_cap_overrides from authenticated, anon;
grant select (node, per_day_usd_cap, per_run_token_cap, updated_at)
  on public.llm_router_cap_overrides to authenticated;

comment on column public.llm_router_cap_overrides.updated_by is
  'auth.users id of the (nao admin) editor — audit trail for the demo write path. R4-U2: SELECT '
  'is REVOKED from authenticated/anon; readable by service_role only. Who changed a cap is '
  'surfaced through the admin-only public.nao_control_events log — action ''models.cap_override'', '
  'written by the caps route via recordControlEvent() — never through this table.';

-- 3.2 edge_human_verdicts.created_by — the curating human's uuid, today readable by every
--     authenticated caller through the open `using (true)` read policy.
--
--     The four columns kept below are exactly the ones public.verified_edges and
--     public.get_insight_provenance(bigint) read from this table (id, edge_id, action,
--     created_at) plus `reason`, which the console shows. Both are SECURITY/security_invoker, so
--     they are evaluated with the caller's column privileges — verified against
--     20260724150001_o13_verified_edges_human_overlay.sql before writing this grant.
revoke select on public.edge_human_verdicts from authenticated, anon;
grant select (id, edge_id, action, reason, created_at)
  on public.edge_human_verdicts to authenticated;

comment on column public.edge_human_verdicts.created_by is
  'The curating human (auth.uid()); the INSERT policy forces it, so the audit trail cannot be '
  'forged. R4-U2: SELECT is REVOKED from authenticated/anon (service_role only) — the four '
  'columns verified_edges / get_insight_provenance need are still granted, so Biotope''s '
  'provenance read is unaffected.';

-- 3.3 ingestion_seeds.created_by — the adding human's uuid, today selected explicitly by the
--     seeds route and returned wholesale by its PATCH.
revoke select on public.ingestion_seeds from authenticated, anon;
grant select (id, slug, label, query_hint, enabled, created_at)
  on public.ingestion_seeds to authenticated;

comment on column public.ingestion_seeds.created_by is
  'The adding human (auth.uid()); the INSERT policy forces it, so the audit trail cannot be '
  'forged. R4-U2: SELECT is REVOKED from authenticated/anon (service_role only). Who added a '
  'seed, and who toggled one, is surfaced through the admin-only public.nao_control_events log — '
  'actions ''seeds.add'' / ''seeds.toggle'', written by the seeds route via recordControlEvent().';
