-- supabase/tests/authz/60_assertions.sql
--
-- THE PROOF. Every assertion below is executed against the real, fully-migrated schema inside a
-- transaction shaped exactly as PostgREST shapes one per request:
--
--     begin;
--       set local request.jwt.claims = '{"sub": "<uuid>", "role": "authenticated"}';
--       set local role authenticated;
--       ... statement under test ...
--     commit;
--
-- See 20_probe_harness.sql for the full argument that this IS PostgREST's enforcement path, and for
-- the explicit list of what this harness does NOT prove (Kong/PostgREST routing config, real HTTP,
-- 42501 → 403 mapping, JWT signature verification, service_role BYPASSRLS, the edge functions,
-- pg_cron). Nothing here touches the developer's running Supabase stack: the whole file executes in
-- a disposable postgres:17 container created and destroyed by run.mjs.
--
-- The claims JSON is set BEFORE `set local role`, which is also the effective order PostgREST uses;
-- what matters for faithfulness is that during statement execution the role is `authenticated` and
-- the GUC holds the verified claims, which is exactly the state below.
--
-- WHY EVERY BLOCK COMMITS RATHER THAN ROLLS BACK. Each assertion is recorded by inserting a row into
-- authz_probe.result, so a rollback would discard the evidence along with the effects and the suite
-- would silently shrink to only its committing blocks — the exact "silent pass over zero assertions"
-- this harness is required to make impossible. Committing is safe because every DENIAL block has, by
-- construction, no effect to undo (its inserts raise and its updates touch zero rows), and the three
-- blocks that do write (curator, admin, P-a) write rows no later assertion's expected value depends
-- on. Where a later block does depend on earlier state, the dependency is spelled out in a comment.
-- Statement-level failures are still isolated: expect_* wraps each statement in its own plpgsql
-- sub-block, so a raise rolls that statement back and the transaction continues.

set authz_probe.phase = 'post';

-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 0 · Reusable batteries. All SECURITY INVOKER, so every statement they execute is evaluated as
--     the session's current role. A definer here would make the entire suite pass vacuously.
-- ═════════════════════════════════════════════════════════════════════════════════════════════

-- The complete "this authenticated caller has NO nao capability" battery. Applied verbatim to five
-- different subjects (unprovisioned, forged-claim, suspended, revoked, membership-deleted) so that
-- none of them can be denied for a *different* reason than the others.
--
-- p_own_member_rows: a suspended or revoked member can still see their OWN nao_members row (that is
-- intended — the console must be able to say "your access is suspended"); an unprovisioned or
-- deleted subject sees none. Everything else is identical.
create or replace function authz_probe.assert_denied_authenticated(
  p_prefix text, p_own_member_rows integer)
returns void
language plpgsql
as $$
begin
  -- Role resolution: the caller has no effective membership, whatever their claims say.
  perform authz_probe.expect_value(p_prefix || '.nao_role_is_null',
    'select coalesce(public.nao_role(), ''<null>'')', '<null>');
  perform authz_probe.expect_value(p_prefix || '.has_role_viewer_false',
    'select public.nao_has_role(''viewer'')::text', 'false');
  perform authz_probe.expect_value(p_prefix || '.has_role_curator_false',
    'select public.nao_has_role(''curator'')::text', 'false');
  perform authz_probe.expect_value(p_prefix || '.has_role_admin_false',
    'select public.nao_has_role(''admin'')::text', 'false');

  -- The RPC a direct PostgREST caller would hit: 42501 → HTTP 403, no route code involved.
  perform authz_probe.expect_error(p_prefix || '.authorize_viewer_raises_42501',
    'select public.nao_authorize(''viewer'')', '42501');
  perform authz_probe.expect_error(p_prefix || '.authorize_admin_raises_42501',
    'select public.nao_authorize(''admin'')', '42501');

  -- Staff-only reads: zero rows, because permissive AND restrictive is false.
  perform authz_probe.expect_value(p_prefix || '.read_llm_router_status_zero',
    'select count(*) from public.llm_router_status', '0');
  perform authz_probe.expect_value(p_prefix || '.read_llm_router_spend_zero',
    'select count(*) from public.llm_router_spend', '0');
  perform authz_probe.expect_value(p_prefix || '.read_llm_router_cap_overrides_zero',
    'select count(*) from public.llm_router_cap_overrides', '0');
  perform authz_probe.expect_value(p_prefix || '.read_ingestion_seeds_zero',
    'select count(*) from public.ingestion_seeds', '0');
  perform authz_probe.expect_value(p_prefix || '.read_gap_ledger_zero',
    'select count(*) from public.gap_ledger', '0');
  perform authz_probe.expect_value(p_prefix || '.read_nao_control_events_zero',
    'select count(*) from public.nao_control_events', '0');
  perform authz_probe.expect_value(p_prefix || '.read_nao_members_rows',
    'select count(*) from public.nao_members', p_own_member_rows::text);

  -- Staff-only writes. INSERT raises (42501); UPDATE is the silent shape — it affects ZERO rows and
  -- raises nothing, which is exactly why it is asserted by row count.
  perform authz_probe.expect_error(p_prefix || '.insert_ingestion_seeds_raises_42501',
    format('insert into public.ingestion_seeds (slug, label, created_by)
            values (%L, %L, auth.uid())', 'denied_' || replace(p_prefix, '.', '_'), 'denied'),
    '42501');
  perform authz_probe.expect_rows_affected(p_prefix || '.update_ingestion_seeds_zero_rows',
    'update public.ingestion_seeds set enabled = false where slug = ''harness_topic_alpha''', 0);
  perform authz_probe.expect_error(p_prefix || '.insert_edge_human_verdicts_raises_42501',
    'insert into public.edge_human_verdicts (edge_id, action, created_by)
     values (''metric_alpha|increases|metric_beta'', ''reject'', auth.uid())', '42501');
  perform authz_probe.expect_error(p_prefix || '.insert_cap_overrides_raises_42501',
    'insert into public.llm_router_cap_overrides (node, per_day_usd_cap, updated_by)
     values (''synthesis'', 1.00, auth.uid())', '42501');
  perform authz_probe.expect_rows_affected(p_prefix || '.update_cap_overrides_zero_rows',
    'update public.llm_router_cap_overrides set per_day_usd_cap = 4.00 where node = ''seeder''', 0);
  perform authz_probe.expect_error(p_prefix || '.insert_control_event_raises_42501',
    'insert into public.nao_control_events (action, target) values (''seeds.add'', ''denied'')',
    '42501');

  -- No self-provisioning and no self-promotion at any layer: the grant is revoked, so this raises
  -- rather than silently affecting zero rows.
  perform authz_probe.expect_error(p_prefix || '.insert_nao_members_raises_42501',
    'insert into public.nao_members (user_id, role) values (auth.uid(), ''admin'')', '42501');
  perform authz_probe.expect_error(p_prefix || '.update_nao_members_raises_42501',
    'update public.nao_members set role = ''admin'' where user_id = auth.uid()', '42501');

  -- Identity columns stay unreadable even to a caller who can reach the table.
  perform authz_probe.expect_error(p_prefix || '.read_cap_overrides_updated_by_raises_42501',
    'select updated_by from public.llm_router_cap_overrides', '42501');
  perform authz_probe.expect_error(p_prefix || '.read_seeds_created_by_raises_42501',
    'select created_by from public.ingestion_seeds', '42501');
  perform authz_probe.expect_error(p_prefix || '.read_verdicts_created_by_raises_42501',
    'select created_by from public.edge_human_verdicts', '42501');
end
$$;

-- P-a · the populate capability, for one member. Asserted for EVERY tier, viewer included, so
-- nobody can claim the loader survived only for admins.
create or replace function authz_probe.pa_probe(p_prefix text, p_uid uuid, p_day date)
returns void
language plpgsql
as $$
begin
  perform authz_probe.expect_value(p_prefix || '.select_own_baseline_gut_row',
    'select count(*) from public.daily_gut_rows where data_origin = ''seed:baseline''', '1');
  perform authz_probe.expect_ok(p_prefix || '.insert_own_gut_row',
    format('insert into public.daily_gut_rows (user_id, log_date, data_origin)
            values (%L, %L, %L)', p_uid, p_day, 'probe:pa'));
  -- The loader's real write shape (onConflict user_id,log_date). A restrictive policy here would
  -- make this affect zero rows WITHOUT raising — the silent failure the invariant exists to stop.
  perform authz_probe.expect_rows_affected(p_prefix || '.upsert_own_gut_row',
    format('insert into public.daily_gut_rows (user_id, log_date, data_origin)
            values (%L, %L, %L)
            on conflict (user_id, log_date) do update set data_origin = %L',
           p_uid, p_day, 'probe:pa', 'probe:pa-upserted'), 1);
  perform authz_probe.expect_value(p_prefix || '.upsert_own_gut_row_took_effect',
    format('select data_origin from public.daily_gut_rows where log_date = %L', p_day),
    'probe:pa-upserted');
  perform authz_probe.expect_rows_affected(p_prefix || '.update_own_gut_row',
    format('update public.daily_gut_rows set notes = %L where log_date = %L',
           'pa', date '2026-01-01'), 1);

  perform authz_probe.expect_ok(p_prefix || '.insert_own_wearable',
    format('insert into public.wearable_daily (user_id, date, resting_hr_bpm, source)
            values (%L, %L, 64, %L)', p_uid, p_day, 'probe:pa'));
  perform authz_probe.expect_rows_affected(p_prefix || '.upsert_own_wearable',
    format('insert into public.wearable_daily (user_id, date, resting_hr_bpm, source)
            values (%L, %L, 65, %L)
            on conflict (user_id, date) do update set resting_hr_bpm = 66',
           p_uid, p_day, 'probe:pa'), 1);
  perform authz_probe.expect_value(p_prefix || '.upsert_own_wearable_took_effect',
    format('select resting_hr_bpm::text from public.wearable_daily where date = %L', p_day), '66');
  perform authz_probe.expect_rows_affected(p_prefix || '.update_own_wearable',
    format('update public.wearable_daily set step_count = 200 where date = %L',
           date '2026-01-01'), 1);
end
$$;

-- P-c · membership grants nao capability, NEVER cross-user data authority. Run for every tier
-- against BOTH another dev and a Biotope-only user. This is the assertion that keeps "nao can
-- populate Biotope" from becoming "nao can write anyone's health data".
create or replace function authz_probe.pc_probe(
  p_prefix text, p_target uuid, p_target_label text, p_day date)
returns void
language plpgsql
as $$
begin
  perform authz_probe.expect_error(
    p_prefix || '.insert_gut_row_for_' || p_target_label || '_raises_42501',
    format('insert into public.daily_gut_rows (user_id, log_date) values (%L, %L)',
           p_target, p_day), '42501');
  perform authz_probe.expect_error(
    p_prefix || '.insert_wearable_for_' || p_target_label || '_raises_42501',
    format('insert into public.wearable_daily (user_id, date) values (%L, %L)',
           p_target, p_day), '42501');
  perform authz_probe.expect_rows_affected(
    p_prefix || '.update_' || p_target_label || '_gut_row_zero_rows',
    format('update public.daily_gut_rows set notes = ''nope'' where user_id = %L', p_target), 0);
  perform authz_probe.expect_rows_affected(
    p_prefix || '.update_' || p_target_label || '_wearable_zero_rows',
    format('update public.wearable_daily set step_count = 999 where user_id = %L', p_target), 0);
  perform authz_probe.expect_value(
    p_prefix || '.select_' || p_target_label || '_gut_rows_zero',
    format('select count(*) from public.daily_gut_rows where user_id = %L', p_target), '0');
  perform authz_probe.expect_value(
    p_prefix || '.select_' || p_target_label || '_wearable_zero',
    format('select count(*) from public.wearable_daily where user_id = %L', p_target), '0');
  perform authz_probe.expect_value(
    p_prefix || '.select_' || p_target_label || '_profile_zero',
    format('select count(*) from public.profiles where user_id = %L', p_target), '0');
  perform authz_probe.expect_value(
    p_prefix || '.select_' || p_target_label || '_insight_cards_zero',
    format('select count(*) from public.insight_cards where user_id = %L', p_target), '0');
end
$$;

-- The three identity columns, from the point of view of a caller who IS allowed to reach the row.
create or replace function authz_probe.assert_identity_redaction(p_prefix text)
returns void
language plpgsql
as $$
begin
  -- `select *` must now fail loudly on all three tables. That is the point: any future code
  -- reaching for `*` on a redacted table breaks instead of quietly leaking a staff uuid.
  perform authz_probe.expect_error(p_prefix || '.select_star_cap_overrides_raises_42501',
    'select * from public.llm_router_cap_overrides', '42501');
  perform authz_probe.expect_error(p_prefix || '.select_star_ingestion_seeds_raises_42501',
    'select * from public.ingestion_seeds', '42501');
  perform authz_probe.expect_error(p_prefix || '.select_star_edge_human_verdicts_raises_42501',
    'select * from public.edge_human_verdicts', '42501');

  -- The identity column itself, named explicitly.
  perform authz_probe.expect_error(p_prefix || '.select_cap_overrides_updated_by_raises_42501',
    'select updated_by from public.llm_router_cap_overrides', '42501');
  perform authz_probe.expect_error(p_prefix || '.select_ingestion_seeds_created_by_raises_42501',
    'select created_by from public.ingestion_seeds', '42501');
  perform authz_probe.expect_error(p_prefix || '.select_edge_human_verdicts_created_by_raises_42501',
    'select created_by from public.edge_human_verdicts', '42501');

  -- Aggregates and predicates over the identity column are just as denied — no side channel.
  perform authz_probe.expect_error(p_prefix || '.count_distinct_updated_by_raises_42501',
    'select count(distinct updated_by) from public.llm_router_cap_overrides', '42501');
  perform authz_probe.expect_error(p_prefix || '.filter_on_created_by_raises_42501',
    'select count(*) from public.ingestion_seeds where created_by = auth.uid()', '42501');

  -- ...while the granted, non-identity column lists still work, so the console keeps functioning.
  perform authz_probe.expect_ok(p_prefix || '.select_granted_cap_override_columns',
    'select node, per_day_usd_cap, per_run_token_cap, updated_at
       from public.llm_router_cap_overrides');
  perform authz_probe.expect_ok(p_prefix || '.select_granted_seed_columns',
    'select id, slug, label, query_hint, enabled, created_at from public.ingestion_seeds');
  perform authz_probe.expect_ok(p_prefix || '.select_granted_verdict_columns',
    'select id, edge_id, action, reason, created_at from public.edge_human_verdicts');
end
$$;

-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 1 · ANONYMOUS (role anon, no claims at all) — nothing at any layer
-- ═════════════════════════════════════════════════════════════════════════════════════════════

begin;
  set local role anon;

  -- EXECUTE on the role functions is revoked from public and anon, so these are hard denials
  -- rather than "returns null" — anon cannot even ask the question.
  select authz_probe.expect_error('anon.nao_role_execute_denied',
    'select public.nao_role()', '42501');
  select authz_probe.expect_error('anon.nao_has_role_execute_denied',
    'select public.nao_has_role(''viewer'')', '42501');
  select authz_probe.expect_error('anon.nao_authorize_execute_denied',
    'select public.nao_authorize(''viewer'')', '42501');

  -- Tables whose SELECT grant anon still holds: no policy applies to anon, so zero rows.
  select authz_probe.expect_value('anon.read_llm_router_status_zero',
    'select count(*) from public.llm_router_status', '0');
  select authz_probe.expect_value('anon.read_llm_router_spend_zero',
    'select count(*) from public.llm_router_spend', '0');
  select authz_probe.expect_value('anon.read_gap_ledger_zero',
    'select count(*) from public.gap_ledger', '0');
  select authz_probe.expect_value('anon.read_daily_gut_rows_zero',
    'select count(*) from public.daily_gut_rows', '0');
  select authz_probe.expect_value('anon.read_wearable_daily_zero',
    'select count(*) from public.wearable_daily', '0');

  -- Tables where R4-U2 removed anon's dangling grant outright: hard 42501, not zero rows.
  select authz_probe.expect_error('anon.read_ingestion_seeds_raises_42501',
    'select count(*) from public.ingestion_seeds', '42501');
  select authz_probe.expect_error('anon.read_cap_overrides_raises_42501',
    'select count(*) from public.llm_router_cap_overrides', '42501');
  select authz_probe.expect_error('anon.read_edge_human_verdicts_raises_42501',
    'select count(*) from public.edge_human_verdicts', '42501');
  select authz_probe.expect_error('anon.read_nao_members_raises_42501',
    'select count(*) from public.nao_members', '42501');
  select authz_probe.expect_error('anon.read_nao_control_events_raises_42501',
    'select count(*) from public.nao_control_events', '42501');

  -- Writes.
  select authz_probe.expect_error('anon.insert_edge_human_verdicts_raises_42501',
    'insert into public.edge_human_verdicts (edge_id, action, created_by)
     values (''metric_alpha|increases|metric_beta'', ''reject'',
             ''bbbbbbbb-0000-4000-8000-000000000001'')', '42501');
  select authz_probe.expect_error('anon.insert_control_event_raises_42501',
    'insert into public.nao_control_events (action) values (''seeds.add'')', '42501');
  select authz_probe.expect_error('anon.insert_ingestion_seeds_raises_42501',
    'insert into public.ingestion_seeds (slug, label, created_by)
     values (''anon_denied'', ''x'', ''bbbbbbbb-0000-4000-8000-000000000001'')', '42501');
  select authz_probe.expect_error('anon.insert_nao_members_raises_42501',
    'insert into public.nao_members (user_id, role)
     values (''bbbbbbbb-0000-4000-8000-000000000001'', ''admin'')', '42501');
commit;

-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 2 · AUTHENTICATED BUT UNPROVISIONED — a valid user JWT, no nao_members row.
--     This is the central claim of the unit: "being authenticated" now grants nothing in nao.
-- ═════════════════════════════════════════════════════════════════════════════════════════════

begin;
  set local request.jwt.claims = '{"sub": "bbbbbbbb-0000-4000-8000-000000000001", "role": "authenticated"}';
  set local role authenticated;
  select authz_probe.assert_denied_authenticated('unprovisioned', 0);
  -- Its own Biotope access is untouched — proven exhaustively by the P-b comparison below.
  select authz_probe.expect_value('unprovisioned.still_reads_own_gut_rows',
    'select count(*) from public.daily_gut_rows where data_origin = ''seed:baseline''', '1');
commit;

-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 3 · FORGED CLAIMS — a validly-signed token whose body lies about the role.
--
--     The token below is what an attacker (or a future custom-access-token hook fed from a
--     user-influenceable source) would produce. The role is read from public.nao_members on every
--     call, so the claim is inert. Three shapes are covered: a non-member claiming admin, a real
--     viewer claiming admin, and a claim that tries to impersonate the service_role.
-- ═════════════════════════════════════════════════════════════════════════════════════════════

begin;
  set local request.jwt.claims = '{"sub": "bbbbbbbb-0000-4000-8000-000000000001",
                                   "role": "authenticated", "user_role": "admin",
                                   "nao_role": "admin", "app_metadata": {"role": "admin"}}';
  set local role authenticated;
  select authz_probe.assert_denied_authenticated('forged_nonmember', 0);
commit;

begin;
  -- A REAL viewer whose token claims admin. The tier must not move.
  set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-4000-8000-000000000001",
                                   "role": "authenticated", "user_role": "admin",
                                   "nao_role": "admin"}';
  set local role authenticated;
  select authz_probe.expect_value('forged_viewer.nao_role_still_viewer',
    'select public.nao_role()', 'viewer');
  select authz_probe.expect_value('forged_viewer.has_role_admin_false',
    'select public.nao_has_role(''admin'')::text', 'false');
  select authz_probe.expect_error('forged_viewer.authorize_admin_raises_42501',
    'select public.nao_authorize(''admin'')', '42501');
  select authz_probe.expect_error('forged_viewer.authorize_curator_raises_42501',
    'select public.nao_authorize(''curator'')', '42501');
  select authz_probe.expect_error('forged_viewer.insert_cap_overrides_raises_42501',
    'insert into public.llm_router_cap_overrides (node, per_day_usd_cap, updated_by)
     values (''synthesis'', 1.00, auth.uid())', '42501');
  select authz_probe.expect_value('forged_viewer.read_control_events_zero',
    'select count(*) from public.nao_control_events', '0');
  select authz_probe.expect_error('forged_viewer.insert_control_event_raises_42501',
    'insert into public.nao_control_events (action) values (''seeds.add'')', '42501');
  select authz_probe.expect_value('forged_viewer.read_nao_members_only_own_row',
    'select count(*) from public.nao_members', '1');
commit;

begin;
  -- A claim asserting the service_role. The SESSION role is what Postgres enforces, and the nao
  -- role still comes from the table, so this changes nothing.
  set local request.jwt.claims = '{"sub": "bbbbbbbb-0000-4000-8000-000000000001",
                                   "role": "service_role", "user_role": "admin"}';
  set local role authenticated;
  select authz_probe.expect_value('forged_service_role_claim.nao_role_is_null',
    'select coalesce(public.nao_role(), ''<null>'')', '<null>');
  select authz_probe.expect_error('forged_service_role_claim.authorize_viewer_raises_42501',
    'select public.nao_authorize(''viewer'')', '42501');
  select authz_probe.expect_value('forged_service_role_claim.read_ingestion_seeds_zero',
    'select count(*) from public.ingestion_seeds', '0');
commit;

-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 4 · THE THREE KILL SWITCHES — suspended, revoked, deleted
-- ═════════════════════════════════════════════════════════════════════════════════════════════

begin;
  set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-4000-8000-000000000004", "role": "authenticated"}';
  set local role authenticated;
  -- status = 'suspended', revoked_at null. Sees its own row (the console must be able to say
  -- "suspended"), has zero capability.
  select authz_probe.assert_denied_authenticated('suspended', 1);
commit;

begin;
  set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-4000-8000-000000000005", "role": "authenticated"}';
  set local role authenticated;
  -- revoked_at set while status is STILL 'active' and the tier is admin: revoked_at alone denies,
  -- and it beats the highest tier.
  select authz_probe.assert_denied_authenticated('revoked', 1);
commit;

begin;
  set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-4000-8000-000000000006", "role": "authenticated"}';
  set local role authenticated;
  -- The membership row was deleted. No residue.
  select authz_probe.assert_denied_authenticated('row_deleted', 0);
commit;

-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 5 · VIEWER — staff READS only, and only above the small-cohort floor
-- ═════════════════════════════════════════════════════════════════════════════════════════════

begin;
  set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "role": "authenticated"}';
  set local role authenticated;

  select authz_probe.expect_value('viewer.nao_role', 'select public.nao_role()', 'viewer');
  select authz_probe.expect_value('viewer.has_role_viewer_true',
    'select public.nao_has_role(''viewer'')::text', 'true');
  select authz_probe.expect_value('viewer.has_role_curator_false',
    'select public.nao_has_role(''curator'')::text', 'false');
  select authz_probe.expect_value('viewer.has_role_admin_false',
    'select public.nao_has_role(''admin'')::text', 'false');
  select authz_probe.expect_ok('viewer.authorize_viewer_ok',
    'select public.nao_authorize(''viewer'')');
  select authz_probe.expect_error('viewer.authorize_curator_raises_42501',
    'select public.nao_authorize(''curator'')', '42501');
  select authz_probe.expect_error('viewer.authorize_admin_raises_42501',
    'select public.nao_authorize(''admin'')', '42501');

  -- A typo in `required` must RAISE, never quietly return false (which would look like a gate that
  -- works while it denies everyone, or — worse, in a `not` context — like one that allows everyone).
  select authz_probe.expect_error('viewer.has_role_unknown_raises_22023',
    'select public.nao_has_role(''superadmin'')', '22023');
  select authz_probe.expect_error('viewer.has_role_null_raises_22023',
    'select public.nao_has_role(null::text)', '22023');

  -- Reads that a viewer must have.
  select authz_probe.expect_value('viewer.read_llm_router_status',
    'select count(*) from public.llm_router_status', '2');
  select authz_probe.expect_value('viewer.read_llm_router_spend',
    'select count(*) from public.llm_router_spend', '1');
  select authz_probe.expect_value('viewer.read_cap_overrides',
    'select count(*) from public.llm_router_cap_overrides', '1');
  select authz_probe.expect_value('viewer.read_ingestion_seeds',
    'select count(*) from public.ingestion_seeds', '1');
  select authz_probe.expect_value('viewer.read_nao_members_only_own_row',
    'select count(*) from public.nao_members', '1');

  -- k = 5 small-cohort floor: the demand-9 row is visible, the demand-2 row is not.
  select authz_probe.expect_value('viewer.read_gap_ledger_above_floor',
    'select count(*) from public.gap_ledger', '1');
  select authz_probe.expect_value('viewer.gap_ledger_below_floor_invisible',
    'select count(*) from public.gap_ledger where demand < 5', '0');
  select authz_probe.expect_value('viewer.gap_ledger_visible_row_is_the_high_demand_one',
    'select metric_a from public.gap_ledger', 'metric_alpha');

  -- ...and nothing beyond reads.
  select authz_probe.expect_error('viewer.insert_ingestion_seeds_raises_42501',
    'insert into public.ingestion_seeds (slug, label, created_by)
     values (''viewer_denied'', ''x'', auth.uid())', '42501');
  select authz_probe.expect_rows_affected('viewer.update_ingestion_seeds_zero_rows',
    'update public.ingestion_seeds set enabled = false where slug = ''harness_topic_alpha''', 0);
  select authz_probe.expect_error('viewer.insert_edge_human_verdicts_raises_42501',
    'insert into public.edge_human_verdicts (edge_id, action, created_by)
     values (''metric_alpha|increases|metric_beta'', ''reject'', auth.uid())', '42501');
  select authz_probe.expect_error('viewer.insert_cap_overrides_raises_42501',
    'insert into public.llm_router_cap_overrides (node, per_day_usd_cap, updated_by)
     values (''synthesis'', 1.00, auth.uid())', '42501');
  select authz_probe.expect_rows_affected('viewer.update_cap_overrides_zero_rows',
    'update public.llm_router_cap_overrides set per_day_usd_cap = 4.00 where node = ''seeder''', 0);
  select authz_probe.expect_error('viewer.insert_control_event_raises_42501',
    'insert into public.nao_control_events (action) values (''seeds.add'')', '42501');
  select authz_probe.expect_value('viewer.read_control_events_zero',
    'select count(*) from public.nao_control_events', '0');

  select authz_probe.assert_identity_redaction('viewer');
commit;

-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 6 · CURATOR — corpus/pipeline mutations approved; policy and money still refused
--     (this block COMMITS, because later blocks assert on the rows it writes)
-- ═════════════════════════════════════════════════════════════════════════════════════════════

begin;
  set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-4000-8000-000000000002", "role": "authenticated"}';
  set local role authenticated;

  select authz_probe.expect_value('curator.nao_role', 'select public.nao_role()', 'curator');
  select authz_probe.expect_value('curator.has_role_viewer_true',
    'select public.nao_has_role(''viewer'')::text', 'true');
  select authz_probe.expect_value('curator.has_role_curator_true',
    'select public.nao_has_role(''curator'')::text', 'true');
  select authz_probe.expect_value('curator.has_role_admin_false',
    'select public.nao_has_role(''admin'')::text', 'false');
  select authz_probe.expect_ok('curator.authorize_curator_ok',
    'select public.nao_authorize(''curator'')');
  select authz_probe.expect_error('curator.authorize_admin_raises_42501',
    'select public.nao_authorize(''admin'')', '42501');

  -- Approved: corpus operation.
  select authz_probe.expect_ok('curator.insert_ingestion_seeds_ok',
    'insert into public.ingestion_seeds (slug, label, created_by)
     values (''harness_topic_curator'', ''added by curator'', auth.uid())');
  select authz_probe.expect_rows_affected('curator.toggle_ingestion_seed_ok',
    'update public.ingestion_seeds set enabled = false where slug = ''harness_topic_alpha''', 1);
  -- The pre-existing `grant update (enabled)` column restriction is untouched and still binds.
  select authz_probe.expect_error('curator.update_seed_label_still_column_denied_42501',
    'update public.ingestion_seeds set label = ''rewritten'' where slug = ''harness_topic_alpha''',
    '42501');
  select authz_probe.expect_ok('curator.insert_edge_human_verdict_ok',
    'insert into public.edge_human_verdicts (edge_id, action, reason, created_by)
     values (''metric_alpha|increases|metric_beta'', ''reject'', ''curator probe'', auth.uid())');

  -- Refused: policy and money remain admin-only at the DATABASE, not just in the route matrix.
  select authz_probe.expect_error('curator.insert_cap_overrides_raises_42501',
    'insert into public.llm_router_cap_overrides (node, per_day_usd_cap, updated_by)
     values (''synthesis'', 1.00, auth.uid())', '42501');
  select authz_probe.expect_rows_affected('curator.update_cap_overrides_zero_rows',
    'update public.llm_router_cap_overrides set per_day_usd_cap = 4.00 where node = ''seeder''', 0);

  -- Control events: a curator WRITES events it cannot READ back. That is the correct shape for an
  -- audit log, and it is where curator identity legitimately lives after the column revokes.
  select authz_probe.expect_ok('curator.insert_control_event_ok',
    'insert into public.nao_control_events (operation_id, phase, action, target, detail)
     values (''10000000-0000-4000-8000-000000000001'', ''attempted'',
             ''seeds.add'', ''harness_topic_curator'', ''{"n": 1}''::jsonb)');
  select authz_probe.expect_value('curator.read_control_events_zero',
    'select count(*) from public.nao_control_events', '0');

  -- ATTRIBUTION SPOOF ATTEMPT: supply somebody else's uuid and a higher role. The insert succeeds
  -- (there is nothing to reject — the values are simply discarded), and section 8 asserts as the
  -- superuser that the stored row carries the CURATOR's id and role.
  select authz_probe.expect_ok('curator.spoofed_attribution_insert_accepted',
    'insert into public.nao_control_events
       (operation_id, phase, actor_user_id, actor_role, action, target)
     values (''10000000-0000-4000-8000-000000000002'', ''attempted'',
             ''aaaaaaaa-0000-4000-8000-000000000003'', ''admin'',
             ''seeds.toggle'', ''spoof-probe'')');

  -- An unrecognised action is rejected: an audit log with an open vocabulary cannot be reviewed.
  select authz_probe.expect_error('curator.unknown_control_action_rejected_23514',
    'insert into public.nao_control_events (operation_id, phase, action)
     values (''10000000-0000-4000-8000-000000000003'', ''attempted'', ''arbitrary.thing'')',
    '23514');

  -- Append-only, from the API surface: the grant is gone, so this raises rather than silently
  -- affecting zero rows.
  select authz_probe.expect_error('curator.update_control_events_raises_42501',
    'update public.nao_control_events set target = ''tampered''', '42501');
  select authz_probe.expect_error('curator.delete_control_events_raises_42501',
    'delete from public.nao_control_events', '42501');
  select authz_probe.expect_error('curator.truncate_control_events_raises_42501',
    'truncate public.nao_control_events', '42501');

  select authz_probe.assert_identity_redaction('curator');
commit;

-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 7 · ADMIN — policy and money, plus the audit log
-- ═════════════════════════════════════════════════════════════════════════════════════════════

begin;
  set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-4000-8000-000000000003", "role": "authenticated"}';
  set local role authenticated;

  select authz_probe.expect_value('admin.nao_role', 'select public.nao_role()', 'admin');
  select authz_probe.expect_value('admin.has_role_admin_true',
    'select public.nao_has_role(''admin'')::text', 'true');
  select authz_probe.expect_ok('admin.authorize_admin_ok',
    'select public.nao_authorize(''admin'')');

  select authz_probe.expect_ok('admin.insert_cap_override_ok',
    'insert into public.llm_router_cap_overrides (node, per_day_usd_cap, per_run_token_cap, updated_by)
     values (''verifier'', 2.50, 70000, auth.uid())');
  select authz_probe.expect_rows_affected('admin.update_cap_override_ok',
    'update public.llm_router_cap_overrides set per_day_usd_cap = 3.00, updated_by = auth.uid()
       where node = ''seeder''', 1);

  -- The audit log is readable by admin only, and it already holds the curator's two events.
  select authz_probe.expect_value('admin.read_control_events',
    'select count(*) from public.nao_control_events', '2');
  select authz_probe.expect_value('admin.control_events_actor_role_is_curator',
    'select distinct actor_role from public.nao_control_events', 'curator');

  -- Append-only holds for admin too — the log has no privileged mutator.
  select authz_probe.expect_error('admin.update_control_events_raises_42501',
    'update public.nao_control_events set target = ''tampered''', '42501');
  select authz_probe.expect_error('admin.delete_control_events_raises_42501',
    'delete from public.nao_control_events', '42501');
  select authz_probe.expect_error('admin.truncate_control_events_raises_42501',
    'truncate public.nao_control_events', '42501');

  -- Admin sees the roster (6 rows: viewer, curator, admin, suspended, revoked, dev2) but still
  -- cannot change it — provisioning is service_role only.
  select authz_probe.expect_value('admin.read_nao_members_roster',
    'select count(*) from public.nao_members', '6');
  select authz_probe.expect_error('admin.insert_nao_members_raises_42501',
    'insert into public.nao_members (user_id, role)
     values (''bbbbbbbb-0000-4000-8000-000000000002'', ''admin'')', '42501');
  select authz_probe.expect_error('admin.update_nao_members_raises_42501',
    'update public.nao_members set role = ''viewer''
       where user_id = ''aaaaaaaa-0000-4000-8000-000000000002''', '42501');
  select authz_probe.expect_error('admin.delete_nao_members_raises_42501',
    'delete from public.nao_members where user_id = ''aaaaaaaa-0000-4000-8000-000000000001''',
    '42501');

  -- Even an admin cannot read a staff uuid out of the console tables.
  select authz_probe.assert_identity_redaction('admin');
commit;

-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 8 · ATTRIBUTION AND APPEND-ONLY AT THE OWNER/SUPERUSER LEVEL
--
--     Grants do not constrain the table owner or a superuser, so the raising triggers are the lock
--     that does. And auth.uid() is NULL outside a request, so an unattributed insert — including one
--     by service_role — is rejected outright.
-- ═════════════════════════════════════════════════════════════════════════════════════════════

-- The spoof attempt from section 6, inspected as the superuser: the stored row carries the
-- CURATOR's id and role, not the admin id and 'admin' the client supplied.
select authz_probe.expect_value('attribution.actor_user_id_forced_to_auth_uid',
  'select actor_user_id::text from public.nao_control_events where target = ''spoof-probe''',
  'aaaaaaaa-0000-4000-8000-000000000002');
select authz_probe.expect_value('attribution.actor_role_forced_to_nao_role',
  'select actor_role from public.nao_control_events where target = ''spoof-probe''', 'curator');
select authz_probe.expect_value('attribution.no_event_attributed_to_the_spoofed_admin',
  'select count(*) from public.nao_control_events
     where actor_user_id = ''aaaaaaaa-0000-4000-8000-000000000003''', '0');

-- auth.uid() is NULL here (no request GUC), which is also the case for anon and for service_role.
-- Not even the service key can record an action as somebody else.
select authz_probe.expect_error('attribution.unattributed_insert_raises_42501',
  'insert into public.nao_control_events (action) values (''pipeline.run'')', '42501');
select authz_probe.expect_error('attribution.unattributed_insert_with_supplied_actor_raises_42501',
  'insert into public.nao_control_events (actor_user_id, actor_role, action)
   values (''aaaaaaaa-0000-4000-8000-000000000003'', ''admin'', ''pipeline.run'')', '42501');

-- The append-only triggers, on the path where grants do not apply.
select authz_probe.expect_error('append_only.superuser_update_raises_P0001',
  'update public.nao_control_events set target = ''tampered''', 'P0001');
select authz_probe.expect_error('append_only.superuser_delete_raises_P0001',
  'delete from public.nao_control_events', 'P0001');
select authz_probe.expect_error('append_only.superuser_truncate_raises_P0001',
  'truncate public.nao_control_events', 'P0001');
select authz_probe.expect_value('append_only.log_still_intact_after_tamper_attempts',
  'select count(*) from public.nao_control_events', '2');

-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 9 · P-a · THE POPULATE CAPABILITY SURVIVES FOR EVERY TIER (viewer included)
-- ═════════════════════════════════════════════════════════════════════════════════════════════

begin;
  set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "role": "authenticated"}';
  set local role authenticated;
  select authz_probe.pa_probe('pa.viewer', 'aaaaaaaa-0000-4000-8000-000000000001', date '2026-05-01');
commit;

begin;
  set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-4000-8000-000000000002", "role": "authenticated"}';
  set local role authenticated;
  select authz_probe.pa_probe('pa.curator', 'aaaaaaaa-0000-4000-8000-000000000002', date '2026-05-02');
commit;

begin;
  set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-4000-8000-000000000003", "role": "authenticated"}';
  set local role authenticated;
  select authz_probe.pa_probe('pa.admin', 'aaaaaaaa-0000-4000-8000-000000000003', date '2026-05-03');
commit;

-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 10 · P-c · NO TIER GAINS CROSS-USER AUTHORITY, against another dev AND a Biotope-only user
-- ═════════════════════════════════════════════════════════════════════════════════════════════

begin;
  set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "role": "authenticated"}';
  set local role authenticated;
  select authz_probe.pc_probe('pc.viewer', 'aaaaaaaa-0000-4000-8000-000000000007', 'dev2', date '2026-06-01');
  select authz_probe.pc_probe('pc.viewer', 'bbbbbbbb-0000-4000-8000-000000000001', 'biotope', date '2026-06-01');
commit;

begin;
  set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-4000-8000-000000000002", "role": "authenticated"}';
  set local role authenticated;
  select authz_probe.pc_probe('pc.curator', 'aaaaaaaa-0000-4000-8000-000000000007', 'dev2', date '2026-06-02');
  select authz_probe.pc_probe('pc.curator', 'bbbbbbbb-0000-4000-8000-000000000001', 'biotope', date '2026-06-02');
commit;

begin;
  set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-4000-8000-000000000003", "role": "authenticated"}';
  set local role authenticated;
  select authz_probe.pc_probe('pc.admin', 'aaaaaaaa-0000-4000-8000-000000000007', 'dev2', date '2026-06-03');
  select authz_probe.pc_probe('pc.admin', 'bbbbbbbb-0000-4000-8000-000000000001', 'biotope', date '2026-06-03');
commit;

-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 11 · P-b · THE BIOTOPE-ONLY USER, RE-PROBED IDENTICALLY
--
--      Same function, same subject, same assertion names as 40_pre_u2_probe.sql — only the working
--      date differs, so 70_non_regression.sql can compare the two phases assertion-for-assertion.
-- ═════════════════════════════════════════════════════════════════════════════════════════════

begin;
  set local request.jwt.claims = '{"sub": "bbbbbbbb-0000-4000-8000-000000000001", "role": "authenticated"}';
  set local role authenticated;
  select authz_probe.pb_probe(
    'bbbbbbbb-0000-4000-8000-000000000001'::uuid,
    'aaaaaaaa-0000-4000-8000-000000000007'::uuid,
    date '2026-04-02');
commit;

-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 12 · LIVE REVOCATION — no caching anywhere in the path
--
--      dev2 is an effective curator right now. An operator revokes them (as service_role would),
--      and their very next statement is denied. This is what a role CLAIM could not deliver: a
--      claim stays valid for the token's lifetime, so a revoked admin would keep admin power for up
--      to an hour. Runs last, because it changes the roster.
-- ═════════════════════════════════════════════════════════════════════════════════════════════

begin;
  set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-4000-8000-000000000007", "role": "authenticated"}';
  set local role authenticated;
  select authz_probe.expect_value('live_revocation.dev2_is_curator_before',
    'select public.nao_role()', 'curator');
  select authz_probe.expect_value('live_revocation.dev2_reads_seeds_before',
    'select count(*) from public.ingestion_seeds', '2');
commit;

-- The operator's action (service_role in production; superuser here).
update public.nao_members
   set revoked_at = now(), updated_at = now()
 where user_id = 'aaaaaaaa-0000-4000-8000-000000000007';

begin;
  set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-4000-8000-000000000007", "role": "authenticated"}';
  set local role authenticated;
  select authz_probe.assert_denied_authenticated('live_revocation.dev2_after', 1);
commit;

-- 13 Â· TRUTHFUL CONTROL LIFECYCLE (issue #182)
-- Real SECURITY INVOKER calls under the actor role: ordering, mutation failure, retry
-- idempotency, attribution, and an injected terminal-write fault.
begin;
  set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-4000-8000-000000000002", "role": "authenticated"}';
  set local role authenticated;

  -- These are executable privilege regressions, not SQL-shape checks. The RPC must succeed AS
  -- authenticated while the raw identity columns remain unreadable to that same database role.
  select authz_probe.expect_value('audit_lifecycle.seed_identity_select_stays_revoked',
    'select has_column_privilege(current_user, ''public.ingestion_seeds'', ''created_by'', ''select'')::text',
    'false');
  select authz_probe.expect_value('audit_lifecycle.verdict_identity_select_stays_revoked',
    'select has_column_privilege(current_user, ''public.edge_human_verdicts'', ''created_by'', ''select'')::text',
    'false');

  select authz_probe.expect_value('audit_lifecycle.transactional_success',
    'select (public.nao_apply_control_mutation(
      ''20000000-0000-4000-8000-000000000001'', ''seeds.add'', ''audit_lifecycle_seed'',
      ''{"label":"Audit lifecycle"}''::jsonb,
      ''{"label":"Audit lifecycle","queryHint":null}''::jsonb
    )->>''ok'')', 'true');
  select authz_probe.expect_value('audit_lifecycle.retry_is_duplicate',
    'select (public.nao_apply_control_mutation(
      ''20000000-0000-4000-8000-000000000001'', ''seeds.add'', ''audit_lifecycle_seed'',
      ''{"label":"Audit lifecycle"}''::jsonb,
      ''{"label":"Audit lifecycle","queryHint":null}''::jsonb
    )->>''errorCode'')', 'duplicate_operation');
  select authz_probe.expect_value('audit_lifecycle.mutation_failure_is_typed',
    'select (public.nao_apply_control_mutation(
      ''20000000-0000-4000-8000-000000000002'', ''seeds.toggle'', ''missing_audit_seed'',
      ''{"enabled":false}''::jsonb, ''{"enabled":false}''::jsonb
    )->>''errorCode'')', 'unknown_seed');
  select authz_probe.expect_value('audit_lifecycle.seed_toggle_succeeds_without_identity_select',
    'select (public.nao_apply_control_mutation(
      ''20000000-0000-4000-8000-000000000005'', ''seeds.toggle'', ''audit_lifecycle_seed'',
      ''{"enabled":false}''::jsonb, ''{"enabled":false}''::jsonb
    )->>''ok'')', 'true');
  select authz_probe.expect_value('audit_lifecycle.claim_reject_succeeds_without_identity_select',
    'select (public.nao_apply_control_mutation(
      ''20000000-0000-4000-8000-000000000006'', ''claims.reject'',
      ''metric_alpha|increases|metric_beta'', ''{"reason":"privilege regression"}''::jsonb,
      ''{"reason":"privilege regression"}''::jsonb
    )->>''ok'')', 'true');
commit;

begin;
  set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-4000-8000-000000000003", "role": "authenticated"}';
  set local role authenticated;
  select authz_probe.expect_value('audit_lifecycle.cap_identity_select_stays_revoked',
    'select has_column_privilege(current_user, ''public.llm_router_cap_overrides'', ''updated_by'', ''select'')::text',
    'false');
  select authz_probe.expect_value('audit_lifecycle.cap_upsert_succeeds_without_identity_select',
    'select (public.nao_apply_control_mutation(
      ''20000000-0000-4000-8000-000000000007'', ''models.cap_override'', ''extract_assist'',
      ''{"perDayUsdCap":1.25,"perRunTokenCap":45000}''::jsonb,
      ''{"perDayUsdCap":1.25,"perRunTokenCap":45000}''::jsonb
    )->>''ok'')', 'true');
commit;

select authz_probe.expect_value('audit_lifecycle.retry_mutated_once',
  'select count(*) from public.ingestion_seeds where slug = ''audit_lifecycle_seed''', '1');
select authz_probe.expect_value('audit_lifecycle.success_has_attempt_then_succeeded',
  'select string_agg(phase, '','' order by id) from public.nao_control_events
    where operation_id = ''20000000-0000-4000-8000-000000000001''',
  'attempted,succeeded');
select authz_probe.expect_value('audit_lifecycle.failure_has_attempt_then_failed',
  'select string_agg(phase, '','' order by id) from public.nao_control_events
    where operation_id = ''20000000-0000-4000-8000-000000000002''',
  'attempted,failed');
select authz_probe.expect_value('audit_lifecycle.actor_stamped_on_every_phase',
  'select count(*) from public.nao_control_events
    where operation_id in (''20000000-0000-4000-8000-000000000001'',
                           ''20000000-0000-4000-8000-000000000002'')
      and actor_user_id = ''aaaaaaaa-0000-4000-8000-000000000002''
      and actor_role = ''curator''', '4');
select authz_probe.expect_value('audit_lifecycle.all_four_privilege_sensitive_branches_succeeded',
  'select count(*) from public.nao_control_events
    where operation_id in (''20000000-0000-4000-8000-000000000001'',
                           ''20000000-0000-4000-8000-000000000005'',
                           ''20000000-0000-4000-8000-000000000006'',
                           ''20000000-0000-4000-8000-000000000007'')
      and phase = ''succeeded''', '4');

-- A failed attempt insert (viewer cannot write the log) prevents the seed mutation.
begin;
  set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "role": "authenticated"}';
  set local role authenticated;
  select authz_probe.expect_error('audit_lifecycle.attempt_failure_blocks_mutation',
    'select public.nao_apply_control_mutation(
      ''20000000-0000-4000-8000-000000000003'', ''seeds.add'', ''attempt_must_block'',
      ''{}''::jsonb, ''{"label":"must not exist"}''::jsonb)', '42501');
commit;
select authz_probe.expect_value('audit_lifecycle.attempt_failure_wrote_no_seed',
  'select count(*) from public.ingestion_seeds where slug = ''attempt_must_block''', '0');

-- Fault-inject only the succeeded event. The RPC must roll back the seed AND its attempt.
create or replace function authz_probe.fail_control_outcome()
returns trigger language plpgsql as $$
begin
  if new.target = 'outcome_fault_seed' and new.phase = 'succeeded' then
    raise exception 'injected outcome failure' using errcode = 'P0001';
  end if;
  return new;
end
$$;
create trigger authz_probe_fail_control_outcome
  before insert on public.nao_control_events
  for each row execute function authz_probe.fail_control_outcome();

begin;
  set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-4000-8000-000000000002", "role": "authenticated"}';
  set local role authenticated;
  select authz_probe.expect_error('audit_lifecycle.outcome_failure_rolls_back_rpc',
    'select public.nao_apply_control_mutation(
      ''20000000-0000-4000-8000-000000000004'', ''seeds.add'', ''outcome_fault_seed'',
      ''{}''::jsonb, ''{"label":"must roll back"}''::jsonb)', 'P0001');
commit;

drop trigger authz_probe_fail_control_outcome on public.nao_control_events;
drop function authz_probe.fail_control_outcome();
select authz_probe.expect_value('audit_lifecycle.outcome_failure_wrote_no_seed',
  'select count(*) from public.ingestion_seeds where slug = ''outcome_fault_seed''', '0');
select authz_probe.expect_value('audit_lifecycle.outcome_failure_left_no_partial_db_audit',
  'select count(*) from public.nao_control_events
    where operation_id = ''20000000-0000-4000-8000-000000000004''', '0');

reset authz_probe.phase;
