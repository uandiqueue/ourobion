-- supabase/tests/u3/20_assertions.sql
--
-- THE R4-U3 PROOF. Every assertion below runs against the real, fully-migrated schema inside a
-- transaction shaped exactly as PostgREST shapes one per request:
--
--     begin;
--       set local request.jwt.claims = '{"sub": "<uuid>", "role": "authenticated"}';
--       set local role authenticated;
--       ... the statement under test ...
--     commit;
--
-- The primitives (expect_ok / expect_error / expect_value / expect_rows_affected) are R4-U2's, reused
-- BY PATH from supabase/tests/authz/20_probe_harness.sql rather than copied, so a change there cannot
-- silently diverge here. See that file for the full argument that this IS PostgREST's enforcement
-- path, and for the explicit list of what a reconstruction cannot prove (Kong/PostgREST routing, real
-- HTTP, the 42501 → 403 and OU409 → 409 mappings, JWT signature verification, service_role's
-- production BYPASSRLS, the edge functions, pg_cron).
--
-- Blocks COMMIT rather than roll back, for the same reason R4-U2's do: an assertion is recorded by
-- inserting a row, so a rollback would discard the evidence along with the effect and the suite would
-- silently shrink to only its committing blocks. Every denial block has, by construction, nothing to
-- undo. Where a later assertion depends on earlier state, the dependency is named in a comment.
--
-- One deliberately harness-only manoeuvre is used and is called out where it happens: a NOT VALID
-- CHECK constraint is added to public.wearable_daily and dropped again, to force a failure on the
-- SECOND table after the first has already been written. That constraint exists ONLY in this
-- disposable container — it is not in any migration (a migration-level CHECK on either truth table
-- would break four R4-U2 expect_ok assertions; see 20260729010000's header).

set authz_probe.phase = 'u3';

-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 1 · OBJECT SHAPE — the contract's surface, read from the catalog rather than from behaviour
-- ═════════════════════════════════════════════════════════════════════════════════════════════

select authz_probe.expect_value('u3.objects.apply_is_security_definer',
  'select prosecdef::text from pg_proc
     where oid = ''public.nao_loader_apply_simulated_days(uuid,text,text,jsonb,jsonb)''::regprocedure',
  'true');

select authz_probe.expect_value('u3.objects.apply_is_volatile',
  'select provolatile::text from pg_proc
     where oid = ''public.nao_loader_apply_simulated_days(uuid,text,text,jsonb,jsonb)''::regprocedure',
  'v');

-- No DEFAULT on any parameter: omitting the target must be a function-resolution failure, never a
-- silent fallback to auth.uid().
select authz_probe.expect_value('u3.objects.apply_has_no_default_arguments',
  'select pronargdefaults::text from pg_proc
     where oid = ''public.nao_loader_apply_simulated_days(uuid,text,text,jsonb,jsonb)''::regprocedure',
  '0');

-- R4-U2's gate must precede EVERY effect in the body: the target lookup, the advisory lock, and both
-- writes. Asserted structurally against prosrc, so an edit that moves a read above the gate is
-- caught here rather than in review.
select authz_probe.expect_value('u3.objects.the_gate_precedes_every_effect',
  'select (position(''nao_authorize'' in prosrc) > 0
       and position(''nao_authorize'' in prosrc)
           < position(''nao_loader_assert_target'' in prosrc)
       and position(''nao_authorize'' in prosrc)
           < position(''pg_advisory_xact_lock'' in prosrc)
       and position(''nao_authorize'' in prosrc)
           < position(''insert into public.daily_gut_rows'' in prosrc)
       and position(''nao_authorize'' in prosrc)
           < position(''insert into public.wearable_daily'' in prosrc))::text
     from pg_proc
    where oid = ''public.nao_loader_apply_simulated_days(uuid,text,text,jsonb,jsonb)''::regprocedure',
  'true');

-- The provenance scan must precede BOTH writes. This is what makes "reject without mutation"
-- structural rather than conditional.
select authz_probe.expect_value('u3.objects.the_provenance_scan_precedes_both_writes',
  'select (position(''nao_simulation_origins'' in prosrc) > 0
       and position(''OU409'' in prosrc)
           < position(''insert into public.daily_gut_rows'' in prosrc)
       and position(''OU409'' in prosrc)
           < position(''insert into public.wearable_daily'' in prosrc))::text
     from pg_proc
    where oid = ''public.nao_loader_apply_simulated_days(uuid,text,text,jsonb,jsonb)''::regprocedure',
  'true');

-- THE WRITE-TIME GUARANTEE, ASSERTED STRUCTURALLY (independent review finding F1).
--
-- The provenance scan PRECEDING both writes is not the same thing as the writes being CONDITIONAL,
-- and the difference was a reproduced defect: the advisory lock serialises loader callers but takes
-- no part in the target's own RLS-governed PostgREST writes, so a real row committed between the
-- scan's snapshot and the insert was invisible to the scan and then unconditionally overwritten by
-- the DO UPDATE branch. Both branches must therefore carry a WHERE predicate over the EXISTING
-- row's provenance. The behavioural proof is the two-process race in 32/33_toctou_*.sql; this
-- catches the predicate being deleted even if that probe is ever skipped.
select authz_probe.expect_value('u3.objects.both_upserts_condition_their_do_update_branch',
  'select (prosrc ~ ''where daily_gut_rows\.data_origin is not null''
       and prosrc ~ ''where wearable_daily\.source is not null''
       and prosrc ~ ''o\.origin = daily_gut_rows\.data_origin''
       and prosrc ~ ''o\.origin = wearable_daily\.source'')::text
     from pg_proc
    where oid = ''public.nao_loader_apply_simulated_days(uuid,text,text,jsonb,jsonb)''::regprocedure',
  'true');

-- ...and the written count comes from RETURNING, never from `get diagnostics`. The diagnostic
-- cannot distinguish "inserted", "updated" and "conflicted but skipped by the predicate", which is
-- precisely the measurement that let the overwrite report ok:true.
-- `--` prose is stripped first, the same convention apps/nao/tests uses: this file's own body
-- legitimately DISCUSSES `get diagnostics row_count` and why it was the wrong measure, and that
-- explanation is the opposite of the defect. Only executable text counts.
select authz_probe.expect_value('u3.objects.the_written_count_comes_from_returning',
  'select ((select count(*)
              from regexp_matches(regexp_replace(prosrc, ''--.*'', '''', ''gn''),
                                  ''returning 1 as one'', ''g'')) = 2
       and regexp_replace(prosrc, ''--.*'', '''', ''gn'') !~ ''get diagnostics'')::text
     from pg_proc
    where oid = ''public.nao_loader_apply_simulated_days(uuid,text,text,jsonb,jsonb)''::regprocedure',
  'true');

-- The repair path runs the SAME step-5 preamble as the write path (finding F2): it deletes, which
-- is strictly worse than overwriting, so it must not be able to run under an open lease.
select authz_probe.expect_value('u3.objects.the_release_path_checks_the_publication_lease',
  'select (position(''lease_until'' in prosrc) > 0
       and position(''pg_advisory_xact_lock'' in prosrc)
           < position(''lease_until'' in prosrc)
       and position(''lease_until'' in prosrc)
           < position(''delete from public.daily_gut_rows'' in prosrc))::text
     from pg_proc
    where oid = ''public.nao_loader_release_simulated_days(uuid,date[])''::regprocedure', 'true');

-- NO exception HANDLER anywhere in the apply body: a failure MUST propagate so the transaction
-- aborts. An `exception when …` block would make "partially applied" representable again. (`raise
-- exception` is of course everywhere — it is the handler shape that is forbidden.)
select authz_probe.expect_value('u3.objects.apply_body_has_no_exception_handler',
  'select (prosrc !~* ''exception[[:space:]]+when'')::text from pg_proc
     where oid = ''public.nao_loader_apply_simulated_days(uuid,text,text,jsonb,jsonb)''::regprocedure',
  'true');

select authz_probe.expect_value('u3.objects.every_new_definer_is_security_definer',
  'select count(*) from unnest(array[
       ''public.nao_loader_assert_target(uuid)'',
       ''public.nao_loader_watermark(uuid)'',
       ''public.nao_loader_plan_inputs(uuid)'',
       ''public.nao_loader_status(uuid)'',
       ''public.nao_loader_status(uuid,text)'',
       ''public.nao_loader_apply_simulated_days(uuid,text,text,jsonb,jsonb)'',
       ''public.nao_loader_release_simulated_days(uuid,date[])'',
       ''public.nao_loader_record_pipeline(text,jsonb)'']) f
    where not (select prosecdef from pg_proc where oid = f::regprocedure)', '0');

select authz_probe.expect_value('u3.objects.every_new_function_pins_search_path',
  'select count(*) from unnest(array[
       ''public.nao_loader_assert_target(uuid)'',
       ''public.nao_loader_watermark(uuid)'',
       ''public.nao_loader_plan_inputs(uuid)'',
       ''public.nao_loader_status(uuid)'',
       ''public.nao_loader_status(uuid,text)'',
       ''public.nao_loader_apply_simulated_days(uuid,text,text,jsonb,jsonb)'',
       ''public.nao_loader_release_simulated_days(uuid,date[])'',
       ''public.nao_loader_record_pipeline(text,jsonb)'',
       ''public.record_gap_events_keyed(jsonb,text)'']) f
    where array_to_string((select proconfig from pg_proc where oid = f::regprocedure), '','')
          <> ''search_path=public, pg_temp''', '0');

-- No new function compares against, reads, or mentions service_role or a key/secret GUC. The
-- request-path decision is a membership-table read and nothing else.
select authz_probe.expect_value('u3.objects.no_new_function_mentions_service_role_or_a_secret',
  'select count(*) from unnest(array[
       ''public.nao_loader_assert_target(uuid)'',
       ''public.nao_loader_watermark(uuid)'',
       ''public.nao_loader_plan_inputs(uuid)'',
       ''public.nao_loader_status(uuid)'',
       ''public.nao_loader_status(uuid,text)'',
       ''public.nao_loader_apply_simulated_days(uuid,text,text,jsonb,jsonb)'',
       ''public.nao_loader_release_simulated_days(uuid,date[])'',
       ''public.nao_loader_record_pipeline(text,jsonb)'',
       ''public.record_gap_events_keyed(jsonb,text)'']) f
    where (select prosrc from pg_proc where oid = f::regprocedure)
          ~* ''(service_role|secret|password|apikey|api_key|bearer|current_setting)''', '0');

-- The identity surface: anon can execute nothing; the internal helpers are service_role-only, so an
-- authenticated caller can reach the watermark ONLY through a gated RPC.
select authz_probe.expect_value('u3.objects.anon_can_execute_no_new_function',
  'select count(*) from unnest(array[
       ''public.nao_loader_assert_target(uuid)'',
       ''public.nao_loader_watermark(uuid)'',
       ''public.nao_loader_plan_inputs(uuid)'',
       ''public.nao_loader_status(uuid)'',
       ''public.nao_loader_status(uuid,text)'',
       ''public.nao_loader_apply_simulated_days(uuid,text,text,jsonb,jsonb)'',
       ''public.nao_loader_release_simulated_days(uuid,date[])'',
       ''public.nao_loader_record_pipeline(text,jsonb)'',
       ''public.record_gap_events_keyed(jsonb,text)'']) f
    where has_function_privilege(''anon'', f, ''EXECUTE'')', '0');

select authz_probe.expect_value('u3.objects.authenticated_cannot_execute_the_internal_helpers',
  'select count(*) from unnest(array[
       ''public.nao_loader_assert_target(uuid)'',
       ''public.nao_loader_watermark(uuid)'',
       ''public.record_gap_events_keyed(jsonb,text)'']) f
    where has_function_privilege(''authenticated'', f, ''EXECUTE'')', '0');

select authz_probe.expect_value('u3.objects.authenticated_can_execute_the_gated_rpcs',
  'select count(*) from unnest(array[
       ''public.nao_loader_apply_simulated_days(uuid,text,text,jsonb,jsonb)'',
       ''public.nao_loader_release_simulated_days(uuid,date[])'',
       ''public.nao_loader_record_pipeline(text,jsonb)'',
       ''public.nao_loader_plan_inputs(uuid)'',
       ''public.nao_loader_status(uuid)'',
       ''public.nao_loader_status(uuid,text)'']) f
    where not has_function_privilege(''authenticated'', f, ''EXECUTE'')', '0');

-- Every new U3 table: RLS on, ZERO policies, and no privilege for either API role. Deny-all at both
-- layers, which is what R4-U2's global policy counts require (a single new policy anywhere in
-- `public` breaks 70_non_regression.sql:89-96).
select authz_probe.expect_value('u3.objects.every_new_table_has_rls_enabled',
  'select count(*) from unnest(array[
       ''nao_simulation_origins'', ''nao_demo_targets'', ''nao_loader_runs'',
       ''nao_loader_run_stages'', ''gap_demand_applications'']) t
    where not (select relrowsecurity from pg_class
                where oid = (''public.'' || t)::regclass)', '0');

select authz_probe.expect_value('u3.objects.every_new_table_has_zero_policies',
  'select count(*) from pg_policies
    where schemaname = ''public''
      and tablename in (''nao_simulation_origins'', ''nao_demo_targets'', ''nao_loader_runs'',
                        ''nao_loader_run_stages'', ''gap_demand_applications'')', '0');

select authz_probe.expect_value('u3.objects.no_api_role_can_touch_a_new_table',
  'select count(*) from (
     select r, p, t from unnest(array[''anon'', ''authenticated'']) r
       cross join unnest(array[''SELECT'', ''INSERT'', ''UPDATE'', ''DELETE'']) p
       cross join unnest(array[''public.nao_simulation_origins'', ''public.nao_demo_targets'',
                               ''public.nao_loader_runs'', ''public.nao_loader_run_stages'',
                               ''public.gap_demand_applications'']) t) x
    where has_table_privilege(x.r, x.t, x.p)', '0');

-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 2 · UNAUTHENTICATED — anon cannot reach the loader at all
-- ═════════════════════════════════════════════════════════════════════════════════════════════

begin;
  set local role anon;
  select authz_probe.expect_error('u3.anon.apply_raises_42501',
    authz_probe.u3_apply_sql('dddddddd-0000-4000-8000-000000000001', 'anon-attempt-key-00001',
                             authz_probe.u3_days(date '2026-07-01', 3)),
    '42501');
  select authz_probe.expect_error('u3.anon.status_raises_42501',
    'select public.nao_loader_status(''dddddddd-0000-4000-8000-000000000001''::uuid)', '42501');
commit;

-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 3 · AUTHENTICATED BUT NOT AN EFFECTIVE CURATOR — one fixed message, four different subjects
--
--     The Biotope-only user is the O26 requirement stated live: an ordinary Biotope account has no
--     nao_members row, so nao_role() is NULL and R4-U2's own gate denies with NO new code path.
-- ═════════════════════════════════════════════════════════════════════════════════════════════

begin;
  set local request.jwt.claims = '{"sub": "eeeeeeee-0000-4000-8000-000000000003", "role": "authenticated"}';
  set local role authenticated;
  select authz_probe.expect_error('u3.gate.biotope_only_user_denied',
    authz_probe.u3_apply_sql('dddddddd-0000-4000-8000-000000000001', 'biotope-attempt-key-001',
                             authz_probe.u3_days(date '2026-07-01', 3)),
    '42501');
  select authz_probe.u3_expect_message('u3.gate_msg.biotope_only_user',
    authz_probe.u3_apply_sql('dddddddd-0000-4000-8000-000000000001', 'biotope-attempt-key-002',
                             authz_probe.u3_days(date '2026-07-01', 3)),
    'nao: access denied');
commit;

-- A forged role claim grants nothing: the role is read from nao_members, never from the token.
begin;
  set local request.jwt.claims = '{"sub": "eeeeeeee-0000-4000-8000-000000000003", "role": "authenticated", "user_role": "admin"}';
  set local role authenticated;
  select authz_probe.expect_error('u3.gate.forged_admin_claim_denied',
    authz_probe.u3_apply_sql('dddddddd-0000-4000-8000-000000000001', 'forged-attempt-key-001',
                             authz_probe.u3_days(date '2026-07-01', 3)),
    '42501');
commit;

begin;
  set local request.jwt.claims = '{"sub": "cccccccc-0000-4000-8000-000000000001", "role": "authenticated"}';
  set local role authenticated;
  select authz_probe.expect_error('u3.gate.viewer_tier_denied',
    authz_probe.u3_apply_sql('dddddddd-0000-4000-8000-000000000001', 'viewer-attempt-key-0001',
                             authz_probe.u3_days(date '2026-07-01', 3)),
    '42501');
  select authz_probe.u3_expect_message('u3.gate_msg.viewer_tier',
    authz_probe.u3_apply_sql('dddddddd-0000-4000-8000-000000000001', 'viewer-attempt-key-0002',
                             authz_probe.u3_days(date '2026-07-01', 3)),
    'nao: access denied');
commit;

begin;
  set local request.jwt.claims = '{"sub": "cccccccc-0000-4000-8000-000000000004", "role": "authenticated"}';
  set local role authenticated;
  select authz_probe.expect_error('u3.gate.suspended_member_denied',
    authz_probe.u3_apply_sql('dddddddd-0000-4000-8000-000000000001', 'susp-attempt-key-00001',
                             authz_probe.u3_days(date '2026-07-01', 3)),
    '42501');
  select authz_probe.u3_expect_message('u3.gate_msg.suspended_member',
    authz_probe.u3_apply_sql('dddddddd-0000-4000-8000-000000000001', 'susp-attempt-key-00002',
                             authz_probe.u3_days(date '2026-07-01', 3)),
    'nao: access denied');
commit;

begin;
  set local request.jwt.claims = '{"sub": "cccccccc-0000-4000-8000-000000000005", "role": "authenticated"}';
  set local role authenticated;
  select authz_probe.expect_error('u3.gate.revoked_member_denied',
    authz_probe.u3_apply_sql('dddddddd-0000-4000-8000-000000000001', 'revk-attempt-key-00001',
                             authz_probe.u3_days(date '2026-07-01', 3)),
    '42501');
  select authz_probe.u3_expect_message('u3.gate_msg.revoked_member',
    authz_probe.u3_apply_sql('dddddddd-0000-4000-8000-000000000001', 'revk-attempt-key-00002',
                             authz_probe.u3_days(date '2026-07-01', 3)),
    'nao: access denied');
commit;

select authz_probe.expect_value('u3.gate_msg.every_gate_denial_shares_one_message',
  'select count(distinct actual)::text from authz_probe.result
    where name like ''u3.gate_msg.%''', '1');

-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 4 · TARGET VALIDATION — five denial reasons, ONE message, so the RPC is not an oracle
--
--     All five run as the SAME effective curator, so the gate cannot be what denies them.
-- ═════════════════════════════════════════════════════════════════════════════════════════════

begin;
  set local request.jwt.claims = '{"sub": "cccccccc-0000-4000-8000-000000000002", "role": "authenticated"}';
  set local role authenticated;

  -- (1) NULL target.
  select authz_probe.expect_error('u3.target.null_denied',
    authz_probe.u3_apply_sql(null, 'tgt-null-key-000000001',
                             authz_probe.u3_days(date '2026-07-01', 3)), '42501');
  select authz_probe.u3_expect_message('u3.deny_msg.null_target',
    authz_probe.u3_apply_sql(null, 'tgt-null-key-000000002',
                             authz_probe.u3_days(date '2026-07-01', 3)),
    'nao: loader target not permitted');

  -- (2) A real auth.users row that was NEVER registered as a demo target.
  select authz_probe.expect_error('u3.target.unregistered_denied',
    authz_probe.u3_apply_sql('eeeeeeee-0000-4000-8000-000000000001', 'tgt-unreg-key-00000001',
                             authz_probe.u3_days(date '2026-07-01', 3)), '42501');
  select authz_probe.u3_expect_message('u3.deny_msg.unregistered_target',
    authz_probe.u3_apply_sql('eeeeeeee-0000-4000-8000-000000000001', 'tgt-unreg-key-00000002',
                             authz_probe.u3_days(date '2026-07-01', 3)),
    'nao: loader target not permitted');

  -- (3) A registered target whose registration was REVOKED. Revocation fails closed.
  select authz_probe.expect_error('u3.target.revoked_registration_denied',
    authz_probe.u3_apply_sql('dddddddd-0000-4000-8000-000000000011', 'tgt-revk-key-00000001',
                             authz_probe.u3_days(date '2026-07-01', 3)), '42501');
  select authz_probe.u3_expect_message('u3.deny_msg.revoked_registration',
    authz_probe.u3_apply_sql('dddddddd-0000-4000-8000-000000000011', 'tgt-revk-key-00000002',
                             authz_probe.u3_days(date '2026-07-01', 3)),
    'nao: loader target not permitted');

  -- (4) A REGISTERED target that also holds an effective nao_members row. This is the check that
  --     stops the loader becoming a door onto another DEV's rows — pc_probe's whole subject.
  select authz_probe.expect_error('u3.target.nao_member_denied',
    authz_probe.u3_apply_sql('eeeeeeee-0000-4000-8000-000000000002', 'tgt-memb-key-00000001',
                             authz_probe.u3_days(date '2026-07-01', 3)), '42501');
  select authz_probe.u3_expect_message('u3.deny_msg.nao_member_target',
    authz_probe.u3_apply_sql('eeeeeeee-0000-4000-8000-000000000002', 'tgt-memb-key-00000002',
                             authz_probe.u3_days(date '2026-07-01', 3)),
    'nao: loader target not permitted');

  -- (5) The caller themselves. The pre-U3 self-write path is retired: the target must be DISTINCT.
  select authz_probe.expect_error('u3.target.self_denied',
    authz_probe.u3_apply_sql('cccccccc-0000-4000-8000-000000000002', 'tgt-self-key-00000001',
                             authz_probe.u3_days(date '2026-07-01', 3)), '42501');
  select authz_probe.u3_expect_message('u3.deny_msg.self_target',
    authz_probe.u3_apply_sql('cccccccc-0000-4000-8000-000000000002', 'tgt-self-key-00000002',
                             authz_probe.u3_days(date '2026-07-01', 3)),
    'nao: loader target not permitted');

  -- Omitting the argument entirely: a resolution failure (42883), never a silent fallback.
  select authz_probe.expect_error('u3.target.missing_argument_raises_42883',
    'select public.nao_loader_apply_simulated_days()', '42883');

  -- A malformed / unregistered ORIGIN is a payload error, not a target error — and it fails CLOSED.
  select authz_probe.expect_error('u3.payload.unregistered_origin_raises_23514',
    authz_probe.u3_apply_sql('dddddddd-0000-4000-8000-000000000001', 'origin-typo-key-000001',
                             authz_probe.u3_days(date '2026-07-01', 3),
                             'simulated:run4-demoo'), '23514');
  select authz_probe.expect_error('u3.payload.revoked_origin_raises_23514',
    authz_probe.u3_apply_sql('dddddddd-0000-4000-8000-000000000001', 'origin-revk-key-000001',
                             authz_probe.u3_days(date '2026-07-01', 3),
                             'retired:marker'), '23514');
  -- p_origin is CALLER-SUPPLIED. 'seed:baseline' is registered AND is_simulated — a row bearing it
  -- may be overwritten — but it belongs to R4-U2's authz fixture (30_pre_u2_seed.sql) and the
  -- loader must never AUTHOR it: stamping another harness's provenance onto a demo target's raw
  -- truth would make that harness's rows and loader output indistinguishable afterwards. The
  -- registry answers the two questions with two columns; this is the loader_writable one.
  select authz_probe.expect_error('u3.payload.another_harnesses_marker_is_refused_as_origin',
    authz_probe.u3_apply_sql('dddddddd-0000-4000-8000-000000000001', 'origin-seed-key-000001',
                             authz_probe.u3_days(date '2026-07-01', 3),
                             'seed:baseline'), '23514');
  -- ...and a registered NON-simulated marker (the release ledger's own) is refused too.
  select authz_probe.expect_error('u3.payload.a_non_simulated_marker_is_refused_as_origin',
    authz_probe.u3_apply_sql('dddddddd-0000-4000-8000-000000000001', 'origin-rel-key-0000001',
                             authz_probe.u3_days(date '2026-07-01', 3),
                             'release:run4-demo'), '23514');
  select authz_probe.expect_error('u3.payload.short_request_key_raises_23514',
    authz_probe.u3_apply_sql('dddddddd-0000-4000-8000-000000000001', 'tooshort',
                             authz_probe.u3_days(date '2026-07-01', 3)), '23514');
  select authz_probe.expect_error('u3.payload.empty_days_raises_23514',
    authz_probe.u3_apply_sql('dddddddd-0000-4000-8000-000000000001', 'empty-days-key-0000001',
                             '[]'::jsonb), '23514');
  select authz_probe.expect_error('u3.payload.duplicate_dates_raise_23514',
    authz_probe.u3_apply_sql('dddddddd-0000-4000-8000-000000000001', 'dup-dates-key-00000001',
                             jsonb_build_array(authz_probe.u3_day(date '2026-07-01', true, true),
                                               authz_probe.u3_day(date '2026-07-01', true, true))),
    '23514');
  select authz_probe.expect_error('u3.payload.over_sixty_days_raises_23514',
    authz_probe.u3_apply_sql('dddddddd-0000-4000-8000-000000000001', 'toolong-days-key-00001',
                             authz_probe.u3_days(date '2026-01-01', 61)), '23514');
commit;

-- ONE message for every target denial. This is the non-oracle property, measured rather than
-- asserted: five different setups, one indistinguishable string.
select authz_probe.expect_value('u3.deny_msg.all_five_target_denials_share_one_message',
  'select count(distinct actual)::text from authz_probe.result
    where name like ''u3.deny_msg.%''', '1');
-- ...and there really were five of them, so the assertion above is not vacuous. The two meta
-- assertions are excluded by name: they are ABOUT the five, not among them.
select authz_probe.expect_value('u3.deny_msg.five_target_denials_were_measured',
  'select count(*)::text from authz_probe.result
    where name in (''u3.deny_msg.null_target'', ''u3.deny_msg.unregistered_target'',
                   ''u3.deny_msg.revoked_registration'', ''u3.deny_msg.nao_member_target'',
                   ''u3.deny_msg.self_target'')', '5');

-- No rejected attempt wrote anything, anywhere.
select authz_probe.expect_value('u3.target.no_truth_row_for_any_rejected_target',
  'select (
     (select count(*) from public.daily_gut_rows where user_id in (
        ''eeeeeeee-0000-4000-8000-000000000001'', ''eeeeeeee-0000-4000-8000-000000000002'',
        ''dddddddd-0000-4000-8000-000000000011'', ''cccccccc-0000-4000-8000-000000000002''))
   + (select count(*) from public.wearable_daily where user_id in (
        ''eeeeeeee-0000-4000-8000-000000000001'', ''eeeeeeee-0000-4000-8000-000000000002'',
        ''dddddddd-0000-4000-8000-000000000011'', ''cccccccc-0000-4000-8000-000000000002''))
   )::text', '0');

select authz_probe.expect_value('u3.target.no_run_row_for_any_rejected_target',
  'select count(*)::text from public.nao_loader_runs where target_user_id in (
      ''eeeeeeee-0000-4000-8000-000000000001'', ''eeeeeeee-0000-4000-8000-000000000002'',
      ''dddddddd-0000-4000-8000-000000000011'', ''cccccccc-0000-4000-8000-000000000002'')', '0');

-- Nothing at all has been recorded yet: every attempt so far — gate denial, target denial, payload
-- rejection — left the ledger completely empty.
select authz_probe.expect_value('u3.target.the_run_ledger_is_still_empty_after_every_rejection',
  'select count(*)::text from public.nao_loader_runs', '0');

-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 5 · THE POSITIVE CASE — a curator CAN write a registered, distinct identity
-- ═════════════════════════════════════════════════════════════════════════════════════════════

begin;
  set local request.jwt.claims = '{"sub": "cccccccc-0000-4000-8000-000000000002", "role": "authenticated"}';
  set local role authenticated;
  select authz_probe.expect_ok('u3.happy.curator_can_load_a_registered_distinct_target',
    authz_probe.u3_apply_sql('dddddddd-0000-4000-8000-000000000001', 'happy-14d-key-000000001',
                             authz_probe.u3_days(date '2026-07-01', 14)));
  select authz_probe.expect_value('u3.happy.result_reports_fourteen_days',
    authz_probe.u3_apply_sql('dddddddd-0000-4000-8000-000000000001', 'happy-14d-key-000000001',
                             authz_probe.u3_days(date '2026-07-01', 14))
    || '->>''loadedDays''', '14');
commit;

select authz_probe.expect_value('u3.happy.fourteen_provenance_stamped_gut_rows',
  'select count(*)::text from public.daily_gut_rows
    where user_id = ''dddddddd-0000-4000-8000-000000000001''
      and data_origin = ''simulated:run4-demo''', '14');

select authz_probe.expect_value('u3.happy.fourteen_provenance_stamped_wearable_rows',
  'select count(*)::text from public.wearable_daily
    where user_id = ''dddddddd-0000-4000-8000-000000000001''
      and source = ''simulated:run4-demo''', '14');

-- The caller-supplied user_id and provenance inside the payload are ignored by construction: the
-- insert's select list never reads them.
select authz_probe.expect_value('u3.happy.payload_supplied_user_id_was_ignored',
  'select count(*)::text from public.daily_gut_rows
    where user_id = ''ffffffff-0000-4000-8000-00000000ffff''', '0');
select authz_probe.expect_value('u3.happy.payload_supplied_provenance_was_ignored',
  'select count(*)::text from public.daily_gut_rows
    where data_origin = ''simulated:not-this-one''', '0');

select authz_probe.expect_value('u3.happy.exactly_one_run_row_and_it_succeeded',
  'select status from public.nao_loader_runs
    where request_key = ''happy-14d-key-000000001''', 'succeeded');
select authz_probe.expect_value('u3.happy.actor_is_the_calling_curator',
  'select actor_user_id::text from public.nao_loader_runs
    where request_key = ''happy-14d-key-000000001''',
  'cccccccc-0000-4000-8000-000000000002');
select authz_probe.expect_value('u3.happy.result_carries_the_label_not_the_uuid',
  'select result->>''targetLabel'' from public.nao_loader_runs
    where request_key = ''happy-14d-key-000000001''', 'demo:u3-happy');
select authz_probe.expect_value('u3.happy.lease_is_open_after_the_write',
  'select (lease_until > now())::text from public.nao_loader_runs
    where request_key = ''happy-14d-key-000000001''', 'true');
select authz_probe.expect_value('u3.happy.watermark_moved',
  'select (watermark_before->>''digest'' <> watermark_after->>''digest'')::text
     from public.nao_loader_runs where request_key = ''happy-14d-key-000000001''', 'true');

-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 5b · THE GATED PLAN READ — the route can see the TARGET's range without an ungated definer
--
--      The caller's own cookie-bound client cannot see the target's rows at all (RLS is
--      `auth.uid() = user_id`, and Invariant P forbids changing that), so planning has to go through
--      a definer read. nao_loader_watermark IS that read, and it is service_role-only precisely
--      because granting it to `authenticated` would make it an oracle over ANY user's log dates and
--      provenance markers. nao_loader_plan_inputs is the gated wrapper, and it must be gated exactly
--      like the loader itself — same two checks, same two fixed messages.
-- ═════════════════════════════════════════════════════════════════════════════════════════════

begin;
  set local role anon;
  select authz_probe.expect_error('u3.plan.anon_cannot_read_plan_inputs',
    'select public.nao_loader_plan_inputs(''dddddddd-0000-4000-8000-000000000001''::uuid)', '42501');
commit;

begin;
  set local request.jwt.claims = '{"sub": "eeeeeeee-0000-4000-8000-000000000003", "role": "authenticated"}';
  set local role authenticated;
  select authz_probe.u3_expect_message('u3.plan.a_biotope_user_is_denied_by_the_same_gate',
    'select public.nao_loader_plan_inputs(''dddddddd-0000-4000-8000-000000000001''::uuid)',
    'nao: access denied');
commit;

begin;
  set local request.jwt.claims = '{"sub": "cccccccc-0000-4000-8000-000000000002", "role": "authenticated"}';
  set local role authenticated;
  select authz_probe.u3_expect_message('u3.plan.an_unregistered_target_is_denied_by_the_same_message',
    'select public.nao_loader_plan_inputs(''eeeeeeee-0000-4000-8000-000000000001''::uuid)',
    'nao: loader target not permitted');
  select authz_probe.u3_expect_message('u3.plan.the_caller_cannot_ask_about_themselves',
    'select public.nao_loader_plan_inputs(''cccccccc-0000-4000-8000-000000000002''::uuid)',
    'nao: loader target not permitted');
  -- ...and for a permitted target it returns the one watermark shape in the system, plus the label.
  -- Both counts matter: planning over BOTH tables is what stops a wearable-only day being invisible.
  select authz_probe.expect_value('u3.plan.it_reports_both_table_ranges',
    'select (public.nao_loader_plan_inputs(''dddddddd-0000-4000-8000-000000000001''::uuid)
               ->>''gutCount'')
         || ''/'' ||
           (public.nao_loader_plan_inputs(''dddddddd-0000-4000-8000-000000000001''::uuid)
               ->>''wearCount'')', '14/14');
  select authz_probe.expect_value('u3.plan.it_carries_the_label_not_the_uuid',
    'select public.nao_loader_plan_inputs(''dddddddd-0000-4000-8000-000000000001''::uuid)
              ->>''targetLabel''', 'demo:u3-happy');
  select authz_probe.expect_value('u3.plan.the_document_contains_no_uuid',
    'select (public.nao_loader_plan_inputs(''dddddddd-0000-4000-8000-000000000001''::uuid)::text
             !~ ''[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'')::text',
    'true');
  select authz_probe.u3_capture_jsonb('plan.happy',
    'select public.nao_loader_plan_inputs(''dddddddd-0000-4000-8000-000000000001''::uuid)');
commit;

-- The wrapper must not become a SECOND watermark implementation: its digest is byte-identical to
-- nao_loader_watermark's, so there is exactly one watermark shape in the system and the route's
-- auto-derived idempotency key cannot drift from the one the RPC stores.
select authz_probe.expect_value('u3.plan.the_digest_is_the_watermarks_own',
  'select ((select value->>''digest'' from authz_probe.u3_capture where key = ''plan.happy'')
         = (public.nao_loader_watermark(
              ''dddddddd-0000-4000-8000-000000000001''::uuid)->>''digest''))::text', 'true');

-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 6 · PROVENANCE CONFLICT — reject WITHOUT mutation, in every direction
-- ═════════════════════════════════════════════════════════════════════════════════════════════

begin;
  set local request.jwt.claims = '{"sub": "cccccccc-0000-4000-8000-000000000002", "role": "authenticated"}';
  set local role authenticated;

  -- (a) A REAL gut row (data_origin IS NULL) inside the requested range.
  select authz_probe.expect_error('u3.conflict.real_gut_row_rejected',
    authz_probe.u3_apply_sql('dddddddd-0000-4000-8000-000000000002', 'conf-gut-key-000000001',
                             authz_probe.u3_days(date '2026-07-01', 14)), 'OU409');
  select authz_probe.u3_expect_message('u3.conflict.message_is_a_refusal_not_a_denial',
    authz_probe.u3_apply_sql('dddddddd-0000-4000-8000-000000000002', 'conf-gut-key-000000002',
                             authz_probe.u3_days(date '2026-07-01', 14)),
    'nao: loader refuses to overwrite rows that are not registered simulation');

  -- (b) A REAL wearable row for a target with NO gut row at all. Provenance is checked per table, so
  --     the ABSENCE of a gut row must not excuse the protected wearable row.
  select authz_probe.expect_error('u3.conflict.real_wearable_only_rejected',
    authz_probe.u3_apply_sql('dddddddd-0000-4000-8000-000000000003', 'conf-wear-key-00000001',
                             authz_probe.u3_days(date '2026-07-01', 14)), 'OU409');

  -- (c) An UNREGISTERED marker (a real provider value). Fail closed on an unknown string.
  select authz_probe.expect_error('u3.conflict.unregistered_marker_rejected',
    authz_probe.u3_apply_sql('dddddddd-0000-4000-8000-000000000008', 'conf-unreg-key-0000001',
                             authz_probe.u3_days(date '2026-07-01', 14)), 'OU409');

  -- (d) A REGISTERED-THEN-REVOKED marker. Retiring an origin protects the rows bearing it.
  select authz_probe.expect_error('u3.conflict.revoked_marker_rejected',
    authz_probe.u3_apply_sql('dddddddd-0000-4000-8000-000000000009', 'conf-retire-key-000001',
                             authz_probe.u3_days(date '2026-07-01', 14)), 'OU409');
commit;

-- NO MUTATION. The scan is a SELECT that precedes both INSERTs in the same transaction, so a refusal
-- aborts having written nothing — proven by row counts AND by whole-row byte identity.
select authz_probe.expect_value('u3.conflict.gut_conflict_target_has_only_its_real_row',
  'select count(*)::text from public.daily_gut_rows
    where user_id = ''dddddddd-0000-4000-8000-000000000002''', '1');
select authz_probe.expect_value('u3.conflict.gut_conflict_target_got_no_wearable_row',
  'select count(*)::text from public.wearable_daily
    where user_id = ''dddddddd-0000-4000-8000-000000000002''', '0');
select authz_probe.expect_value('u3.conflict.real_gut_row_is_byte_identical',
  'select (md5(g::text) = (select digest from authz_probe.u3_baseline
                            where tag = ''real_gut_conflict''))::text
     from public.daily_gut_rows g
    where g.user_id = ''dddddddd-0000-4000-8000-000000000002''
      and g.log_date = date ''2026-07-03''', 'true');

-- The asymmetric case: a protected WEARABLE row and no gut row. If the scan ran per-table but the
-- writes did not share a transaction, 14 gut rows would be sitting here.
select authz_probe.expect_value('u3.conflict.wearable_only_conflict_wrote_zero_gut_rows',
  'select count(*)::text from public.daily_gut_rows
    where user_id = ''dddddddd-0000-4000-8000-000000000003''', '0');
select authz_probe.expect_value('u3.conflict.wearable_only_conflict_target_row_count_unchanged',
  'select count(*)::text from public.wearable_daily
    where user_id = ''dddddddd-0000-4000-8000-000000000003''', '1');
select authz_probe.expect_value('u3.conflict.real_wearable_row_is_byte_identical',
  'select (md5(w::text) = (select digest from authz_probe.u3_baseline
                            where tag = ''real_wearable_conflict''))::text
     from public.wearable_daily w
    where w.user_id = ''dddddddd-0000-4000-8000-000000000003''
      and w.date = date ''2026-07-04''', 'true');

select authz_probe.expect_value('u3.conflict.unregistered_marker_row_is_byte_identical',
  'select (md5(w::text) = (select digest from authz_probe.u3_baseline
                            where tag = ''unregistered_marker''))::text
     from public.wearable_daily w
    where w.user_id = ''dddddddd-0000-4000-8000-000000000008''
      and w.date = date ''2026-07-05''', 'true');
select authz_probe.expect_value('u3.conflict.revoked_marker_row_is_byte_identical',
  'select (md5(g::text) = (select digest from authz_probe.u3_baseline
                            where tag = ''retired_marker''))::text
     from public.daily_gut_rows g
    where g.user_id = ''dddddddd-0000-4000-8000-000000000009''
      and g.log_date = date ''2026-07-06''', 'true');

-- A refusal happens AFTER the run row is inserted, so this proves the run row rolled back with it:
-- a refused request leaves no trace at all.
select authz_probe.expect_value('u3.conflict.no_run_row_survives_a_refusal',
  'select count(*)::text from public.nao_loader_runs where target_user_id in (
      ''dddddddd-0000-4000-8000-000000000002'', ''dddddddd-0000-4000-8000-000000000003'',
      ''dddddddd-0000-4000-8000-000000000008'', ''dddddddd-0000-4000-8000-000000000009'')', '0');

-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 7 · FORCED FAILURE ON THE SECOND TABLE — neither side committed
--
--     HARNESS-ONLY. This NOT VALID CHECK exists solely in this disposable container; no migration
--     adds a constraint to either truth table (that would break R4-U2's pa/pb expect_ok assertions).
--     NOT VALID so the 14 rows already written by section 5 are not re-validated — the constraint
--     only has to bite on the NEW insert, which is the point.
-- ═════════════════════════════════════════════════════════════════════════════════════════════

alter table public.wearable_daily
  add constraint u3_tmp_force_failure check (spo2_pct is null or spo2_pct < 0) not valid;

begin;
  set local request.jwt.claims = '{"sub": "cccccccc-0000-4000-8000-000000000002", "role": "authenticated"}';
  set local role authenticated;
  select authz_probe.expect_error('u3.rollback.second_table_failure_raises_23514',
    authz_probe.u3_apply_sql('dddddddd-0000-4000-8000-000000000004', 'rollback-key-0000000001',
                             authz_probe.u3_days(date '2026-07-01', 14)), '23514');
commit;

select authz_probe.expect_value('u3.rollback.first_table_wrote_nothing',
  'select count(*)::text from public.daily_gut_rows
    where user_id = ''dddddddd-0000-4000-8000-000000000004''', '0');
select authz_probe.expect_value('u3.rollback.second_table_wrote_nothing',
  'select count(*)::text from public.wearable_daily
    where user_id = ''dddddddd-0000-4000-8000-000000000004''', '0');
select authz_probe.expect_value('u3.rollback.no_run_row_survives',
  'select count(*)::text from public.nao_loader_runs
    where request_key = ''rollback-key-0000000001''', '0');

alter table public.wearable_daily drop constraint u3_tmp_force_failure;

-- ...and the SAME request key now succeeds, because the uniqueness record died with the transaction.
-- That is what makes a failed run safely retryable rather than permanently poisoned.
begin;
  set local request.jwt.claims = '{"sub": "cccccccc-0000-4000-8000-000000000002", "role": "authenticated"}';
  set local role authenticated;
  select authz_probe.expect_ok('u3.rollback.retry_with_the_same_key_is_a_clean_first_execution',
    authz_probe.u3_apply_sql('dddddddd-0000-4000-8000-000000000004', 'rollback-key-0000000001',
                             authz_probe.u3_days(date '2026-07-01', 14)));
commit;

select authz_probe.expect_value('u3.rollback.retry_wrote_both_tables',
  'select ((select count(*) from public.daily_gut_rows
             where user_id = ''dddddddd-0000-4000-8000-000000000004'')
        || ''/'' ||
           (select count(*) from public.wearable_daily
             where user_id = ''dddddddd-0000-4000-8000-000000000004''))', '14/14');
select authz_probe.expect_value('u3.rollback.retry_left_exactly_one_run_row',
  'select count(*)::text from public.nao_loader_runs
    where request_key = ''rollback-key-0000000001''', '1');

-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 8 · SEQUENTIAL IDEMPOTENCY — the same explicit key returns the first completed result
-- ═════════════════════════════════════════════════════════════════════════════════════════════

begin;
  set local request.jwt.claims = '{"sub": "cccccccc-0000-4000-8000-000000000002", "role": "authenticated"}';
  set local role authenticated;
  select authz_probe.expect_value('u3.replay.first_call_is_not_a_replay',
    authz_probe.u3_apply_sql('dddddddd-0000-4000-8000-000000000005', 'replay-key-00000000001',
                             authz_probe.u3_days(date '2026-07-01', 10))
    || '->>''replayed''', 'false');
  select authz_probe.expect_value('u3.replay.second_call_is_a_replay',
    authz_probe.u3_apply_sql('dddddddd-0000-4000-8000-000000000005', 'replay-key-00000000001',
                             authz_probe.u3_days(date '2026-07-01', 10))
    || '->>''replayed''', 'true');
  -- Byte-identical payload back, modulo the replayed flag.
  select authz_probe.u3_capture_jsonb('replay.second',
    authz_probe.u3_apply_sql('dddddddd-0000-4000-8000-000000000005', 'replay-key-00000000001',
                             authz_probe.u3_days(date '2026-07-01', 10)));
  -- A DIFFERENT payload under the same key still returns the stored result: the key is the identity.
  select authz_probe.u3_capture_jsonb('replay.second_with_other_payload',
    authz_probe.u3_apply_sql('dddddddd-0000-4000-8000-000000000005', 'replay-key-00000000001',
                             authz_probe.u3_days(date '2026-08-01', 3)));
commit;

select authz_probe.expect_value('u3.replay.exactly_one_run_row_for_the_key',
  'select count(*)::text from public.nao_loader_runs
    where request_key = ''replay-key-00000000001''', '1');
select authz_probe.expect_value('u3.replay.replay_returns_the_stored_result_verbatim',
  'select ((select value - ''replayed'' from authz_probe.u3_capture where key = ''replay.second'')
         = (select result - ''replayed'' from public.nao_loader_runs
             where request_key = ''replay-key-00000000001''))::text', 'true');
select authz_probe.expect_value('u3.replay.replay_ignores_a_changed_payload',
  'select ((select value from authz_probe.u3_capture
             where key = ''replay.second_with_other_payload'')
         = (select value from authz_probe.u3_capture where key = ''replay.second''))::text', 'true');
select authz_probe.expect_value('u3.replay.no_second_write_happened',
  'select ((select count(*) from public.daily_gut_rows
             where user_id = ''dddddddd-0000-4000-8000-000000000005'')
        || ''/'' ||
           (select count(*) from public.wearable_daily
             where user_id = ''dddddddd-0000-4000-8000-000000000005''))', '10/10');
select authz_probe.expect_value('u3.replay.watermark_is_unchanged_after_the_replays',
  'select ((select watermark_after->>''digest'' from public.nao_loader_runs
             where request_key = ''replay-key-00000000001'')
         = (public.nao_loader_watermark(
              ''dddddddd-0000-4000-8000-000000000005''::uuid)->>''digest''))::text', 'true');

-- A key reused for a DIFFERENT target is a caller bug, not a replay.
begin;
  set local request.jwt.claims = '{"sub": "cccccccc-0000-4000-8000-000000000002", "role": "authenticated"}';
  set local role authenticated;
  select authz_probe.expect_error('u3.replay.key_reuse_across_targets_raises_22023',
    authz_probe.u3_apply_sql('dddddddd-0000-4000-8000-000000000001', 'replay-key-00000000001',
                             authz_probe.u3_days(date '2026-07-01', 3)), '22023');
commit;

-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 9 · SPARSE, MISMATCHED AND HALF-LOADED HISTORY — and the publication fold reaching `published`
--
--     Target demo:u3-sparse starts with a simulated GUT row on 07-01 and a simulated WEARABLE row on
--     07-02 — the exact partial state the pre-U3 two-upsert path could leave. The payload is
--     non-contiguous (07-01, 07-02, 07-05, 07-09) and asymmetric per date.
-- ═════════════════════════════════════════════════════════════════════════════════════════════

begin;
  set local request.jwt.claims = '{"sub": "cccccccc-0000-4000-8000-000000000002", "role": "authenticated"}';
  set local role authenticated;
  select authz_probe.expect_ok('u3.sparse.mixed_channel_payload_with_holes_is_accepted',
    authz_probe.u3_apply_sql('dddddddd-0000-4000-8000-000000000007', 'sparse-key-00000000001',
      jsonb_build_array(
        authz_probe.u3_day(date '2026-07-01', false, true),   -- wearable only: gut already exists
        authz_probe.u3_day(date '2026-07-02', true,  false),  -- gut only: HEALS the half-loaded day
        authz_probe.u3_day(date '2026-07-05', true,  true),
        authz_probe.u3_day(date '2026-07-09', true,  true))));
commit;

select authz_probe.expect_value('u3.sparse.only_the_requested_channels_were_written',
  'select ((select count(*) from public.daily_gut_rows
             where user_id = ''dddddddd-0000-4000-8000-000000000007''
               and data_origin = ''simulated:run4-demo'')
        || ''/'' ||
           (select count(*) from public.wearable_daily
             where user_id = ''dddddddd-0000-4000-8000-000000000007''
               and source = ''simulated:run4-demo''))', '3/3');
select authz_probe.expect_value('u3.sparse.the_pre_existing_run2_rows_were_not_touched',
  'select ((select count(*) from public.daily_gut_rows
             where user_id = ''dddddddd-0000-4000-8000-000000000007''
               and data_origin = ''simulated:run2-demo'')
        || ''/'' ||
           (select count(*) from public.wearable_daily
             where user_id = ''dddddddd-0000-4000-8000-000000000007''
               and source = ''simulated:run2-demo''))', '1/1');
select authz_probe.expect_value('u3.sparse.the_half_loaded_day_is_now_whole',
  'select (exists (select 1 from public.daily_gut_rows
                    where user_id = ''dddddddd-0000-4000-8000-000000000007''
                      and log_date = date ''2026-07-02'')
       and exists (select 1 from public.wearable_daily
                    where user_id = ''dddddddd-0000-4000-8000-000000000007''
                      and date = date ''2026-07-02''))::text', 'true');
select authz_probe.expect_value('u3.sparse.holes_in_the_range_were_not_filled',
  'select count(*)::text from public.daily_gut_rows
    where user_id = ''dddddddd-0000-4000-8000-000000000007''
      and log_date between date ''2026-07-03'' and date ''2026-07-04''', '0');
-- Mismatched table ranges are reported rather than inferred: the watermark records both sides.
select authz_probe.expect_value('u3.sparse.watermark_reports_both_ranges_separately',
  'select (public.nao_loader_watermark(''dddddddd-0000-4000-8000-000000000007''::uuid)
             ->>''gutCount'')
       || ''/'' ||
         (public.nao_loader_watermark(''dddddddd-0000-4000-8000-000000000007''::uuid)
             ->>''wearCount'')', '4/4');

begin;
  set local request.jwt.claims = '{"sub": "cccccccc-0000-4000-8000-000000000002", "role": "authenticated"}';
  set local role authenticated;
  -- Recording all three stages, all ok, with an unchanged watermark ⇒ the derived status is
  -- `published`. It is never stored; it is folded on every read.
  select authz_probe.expect_value('u3.fold.all_three_ok_stages_derive_published',
    'select public.nao_loader_record_pipeline(''sparse-key-00000000001'',
              authz_probe.u3_stages_ok())->>''status''', 'published');
  -- ...and recording the stages cleared the lease, so a NEW key may now load the same target.
  select authz_probe.expect_ok('u3.sparse.registered_simulated_rows_are_overwritable',
    authz_probe.u3_apply_sql('dddddddd-0000-4000-8000-000000000007', 'sparse-key-00000000002',
      jsonb_build_array(authz_probe.u3_day(date '2026-07-01', true, true),
                        authz_probe.u3_day(date '2026-07-02', true, true))));
commit;

select authz_probe.expect_value('u3.sparse.run2_rows_were_relabelled_by_the_second_load',
  'select ((select count(*) from public.daily_gut_rows
             where user_id = ''dddddddd-0000-4000-8000-000000000007''
               and data_origin = ''simulated:run2-demo'')
        || ''/'' ||
           (select count(*) from public.wearable_daily
             where user_id = ''dddddddd-0000-4000-8000-000000000007''
               and source = ''simulated:run2-demo''))', '0/0');
select authz_probe.expect_value('u3.sparse.row_counts_did_not_grow_on_overwrite',
  'select ((select count(*) from public.daily_gut_rows
             where user_id = ''dddddddd-0000-4000-8000-000000000007'')
        || ''/'' ||
           (select count(*) from public.wearable_daily
             where user_id = ''dddddddd-0000-4000-8000-000000000007''))', '4/4');

-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 10 · THE PUBLICATION LEASE — a second, DIFFERENT run cannot land under an in-flight pipeline
-- ═════════════════════════════════════════════════════════════════════════════════════════════

begin;
  set local request.jwt.claims = '{"sub": "cccccccc-0000-4000-8000-000000000002", "role": "authenticated"}';
  set local role authenticated;
  select authz_probe.expect_ok('u3.lease.first_run_succeeds',
    authz_probe.u3_apply_sql('dddddddd-0000-4000-8000-000000000010', 'lease-key-1-000000000',
                             authz_probe.u3_days(date '2026-07-01', 5)));
  -- A DIFFERENT key while the lease is open and no stage recorded ⇒ refused, same fixed message.
  select authz_probe.expect_error('u3.lease.a_new_key_is_refused_while_the_lease_is_open',
    authz_probe.u3_apply_sql('dddddddd-0000-4000-8000-000000000010', 'lease-key-2-000000000',
                             authz_probe.u3_days(date '2026-07-10', 5)), '42501');
  -- A retry of the SAME key is NOT blocked — the replay is returned before the lease is consulted.
  select authz_probe.expect_value('u3.lease.the_same_key_still_replays_under_an_open_lease',
    authz_probe.u3_apply_sql('dddddddd-0000-4000-8000-000000000010', 'lease-key-1-000000000',
                             authz_probe.u3_days(date '2026-07-01', 5))
    || '->>''replayed''', 'true');
  select authz_probe.expect_value('u3.lease.status_reports_the_lease_as_active',
    'select public.nao_loader_status(''dddddddd-0000-4000-8000-000000000010''::uuid)
              ->>''leaseActive''', 'true');
  -- Recording the pipeline clears it; the new key now proceeds.
  select authz_probe.expect_ok('u3.lease.recording_the_pipeline_clears_the_lease',
    'select public.nao_loader_record_pipeline(''lease-key-1-000000000'',
              authz_probe.u3_stages_ok())');
  select authz_probe.expect_ok('u3.lease.the_new_key_proceeds_once_the_lease_is_cleared',
    authz_probe.u3_apply_sql('dddddddd-0000-4000-8000-000000000010', 'lease-key-2-000000000',
                             authz_probe.u3_days(date '2026-07-10', 5)));
commit;

select authz_probe.expect_value('u3.lease.the_refused_run_left_no_row',
  'select count(*)::text from public.nao_loader_runs
    where target_user_id = ''dddddddd-0000-4000-8000-000000000010''', '2');
select authz_probe.expect_value('u3.lease.ten_days_are_loaded_across_the_two_runs',
  'select count(*)::text from public.daily_gut_rows
    where user_id = ''dddddddd-0000-4000-8000-000000000010''', '10');

-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 11 · THE DERIVED STATUS FOLD — worst wins, and nothing is ever stored
-- ═════════════════════════════════════════════════════════════════════════════════════════════

-- pending: a run with zero stage rows (demo:u3-replay, section 8) is never `published`.
begin;
  set local request.jwt.claims = '{"sub": "cccccccc-0000-4000-8000-000000000002", "role": "authenticated"}';
  set local role authenticated;
  select authz_probe.expect_value('u3.fold.zero_stages_derive_pending',
    'select public.nao_loader_status(''dddddddd-0000-4000-8000-000000000005''::uuid)
              ->>''status''', 'pending');

  select authz_probe.expect_ok('u3.fold.setup_fold_target',
    authz_probe.u3_apply_sql('dddddddd-0000-4000-8000-000000000014', 'fold-key-000000000001',
                             authz_probe.u3_days(date '2026-07-01', 4)));
  -- incomplete: 2 of 3 stages present.
  select authz_probe.expect_value('u3.fold.two_of_three_stages_derive_incomplete',
    'select public.nao_loader_record_pipeline(''fold-key-000000000001'', jsonb_build_array(
        jsonb_build_object(''stage'', ''compute-baselines'', ''httpStatus'', 200, ''ok'', true),
        jsonb_build_object(''stage'', ''evaluate-signals'', ''httpStatus'', 200, ''ok'', true)
      ))->>''status''', 'incomplete');
  -- failed outranks everything: the third stage arrives NOT ok.
  select authz_probe.expect_value('u3.fold.a_failed_stage_outranks_a_complete_set',
    'select public.nao_loader_record_pipeline(''fold-key-000000000001'', jsonb_build_array(
        jsonb_build_object(''stage'', ''generate-insights'', ''httpStatus'', 502, ''ok'', false)
      ))->>''status''', 'failed');
  -- ...and a later all-ok recording of THE SAME STAGE cannot improve it back to published.
  --
  -- The stage name matters and this assertion used to get it wrong: it re-recorded
  -- `compute-baselines` while `generate-insights` was the failed one, so the failure survived for a
  -- reason that had nothing to do with the claim in the assertion's name — and the underlying
  -- last-write-wins upsert (which really did replace ok=false with ok=true for the SAME stage) went
  -- unmeasured. Re-recording the failed stage itself is the only form of this test that can fail.
  select authz_probe.expect_value('u3.fold.failed_cannot_be_improved_by_a_later_ok_stage',
    'select public.nao_loader_record_pipeline(''fold-key-000000000001'', jsonb_build_array(
        jsonb_build_object(''stage'', ''generate-insights'', ''httpStatus'', 200, ''ok'', true)
      ))->>''status''', 'failed');
  -- Worst-wins is a one-way ratchet, not a freeze: WORSENING an already-ok stage still applies.
  select authz_probe.expect_value('u3.fold.an_ok_stage_can_still_be_worsened',
    'select public.nao_loader_record_pipeline(''fold-key-000000000001'', jsonb_build_array(
        jsonb_build_object(''stage'', ''compute-baselines'', ''httpStatus'', 503, ''ok'', false)
      ))->>''status''', 'failed');
  select authz_probe.expect_error('u3.fold.an_unknown_stage_name_is_refused',
    'select public.nao_loader_record_pipeline(''fold-key-000000000001'', jsonb_build_array(
        jsonb_build_object(''stage'', ''not-a-stage'', ''httpStatus'', 200, ''ok'', true)
      ))', '23514');
commit;

-- The derived verdict is one thing; the RECORDED ROW is another, and the row is what a later read
-- folds. Asserted as the superuser, because `authenticated` holds no privilege on the stage table
-- at all (RLS on, zero policies, revoke all) and that is itself part of the contract.
select authz_probe.expect_value('u3.fold.the_failed_stage_row_itself_was_not_overwritten',
  'select s.ok::text || ''/'' || s.http_status::text
     from public.nao_loader_run_stages s
     join public.nao_loader_runs r on r.id = s.run_id
    where r.request_key = ''fold-key-000000000001'' and s.stage = ''generate-insights''',
  'false/502');
select authz_probe.expect_value('u3.fold.the_worsened_stage_row_was_updated',
  'select s.ok::text || ''/'' || s.http_status::text
     from public.nao_loader_run_stages s
     join public.nao_loader_runs r on r.id = s.run_id
    where r.request_key = ''fold-key-000000000001'' and s.stage = ''compute-baselines''',
  'false/503');

-- mixed: raw truth moved between the run's commit and the stage recording.
begin;
  set local request.jwt.claims = '{"sub": "cccccccc-0000-4000-8000-000000000002", "role": "authenticated"}';
  set local role authenticated;
  select authz_probe.expect_ok('u3.fold.setup_mixed_target',
    authz_probe.u3_apply_sql('dddddddd-0000-4000-8000-000000000015', 'mixed-key-00000000001',
                             authz_probe.u3_days(date '2026-07-01', 4)));
commit;

-- An out-of-band write (the pipeline has no per-user scoping, so this is the real-world shape).
insert into public.daily_gut_rows (user_id, log_date, region, data_origin)
values ('dddddddd-0000-4000-8000-000000000015', date '2026-07-20', '', 'simulated:run2-demo');

begin;
  set local request.jwt.claims = '{"sub": "cccccccc-0000-4000-8000-000000000002", "role": "authenticated"}';
  set local role authenticated;
  select authz_probe.expect_value('u3.fold.a_moved_watermark_derives_mixed',
    'select public.nao_loader_record_pipeline(''mixed-key-00000000001'',
              authz_probe.u3_stages_ok())->>''status''', 'mixed');
commit;

select authz_probe.expect_value('u3.fold.no_table_stores_an_overall_status',
  'select count(*)::text from information_schema.columns
    where table_schema = ''public''
      and table_name in (''nao_loader_runs'', ''nao_loader_run_stages'')
      and column_name in (''overall_status'', ''publication_status'', ''derived_status'')', '0');

-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 12 · REPAIR — removal, never relabelling; and residue is DETECTED
-- ═════════════════════════════════════════════════════════════════════════════════════════════

begin;
  set local request.jwt.claims = '{"sub": "cccccccc-0000-4000-8000-000000000002", "role": "authenticated"}';
  set local role authenticated;
  select authz_probe.expect_ok('u3.release.setup_load',
    authz_probe.u3_apply_sql('dddddddd-0000-4000-8000-000000000013', 'release-key-0000000001',
                             authz_probe.u3_days(date '2026-08-01', 7)));
  select authz_probe.expect_ok('u3.release.clear_the_lease',
    'select public.nao_loader_record_pipeline(''release-key-0000000001'',
              authz_probe.u3_stages_ok())');
  select authz_probe.u3_capture_jsonb('release.first',
    'select public.nao_loader_release_simulated_days(
              ''dddddddd-0000-4000-8000-000000000013''::uuid,
              array[date ''2026-08-01'', date ''2026-08-02'', date ''2026-08-03''])');
  -- The real row on 2026-08-20 can never be removed: the release mirrors the conflict rule.
  select authz_probe.expect_error('u3.release.refuses_to_remove_a_real_row',
    'select public.nao_loader_release_simulated_days(
              ''dddddddd-0000-4000-8000-000000000013''::uuid, array[date ''2026-08-20''])', 'OU409');
commit;

select authz_probe.expect_value('u3.release.three_simulated_dates_are_removed_from_both_tables',
  'select (value->>''gutRowsRemoved'') || ''/'' || (value->>''wearableRowsRemoved'')
     from authz_probe.u3_capture where key = ''release.first''', '3/3');
select authz_probe.expect_value('u3.release.four_simulated_days_remain_plus_the_real_row',
  'select ((select count(*) from public.daily_gut_rows
             where user_id = ''dddddddd-0000-4000-8000-000000000013'')
        || ''/'' ||
           (select count(*) from public.wearable_daily
             where user_id = ''dddddddd-0000-4000-8000-000000000013''))', '5/4');
select authz_probe.expect_value('u3.release.the_real_row_is_byte_identical',
  'select (md5(g::text) = (select digest from authz_probe.u3_baseline
                            where tag = ''release_real_gut''))::text
     from public.daily_gut_rows g
    where g.user_id = ''dddddddd-0000-4000-8000-000000000013''
      and g.log_date = date ''2026-08-20''', 'true');
select authz_probe.expect_value('u3.release.simulated_data_is_never_relabelled_as_real',
  'select count(*)::text from public.daily_gut_rows
    where user_id = ''dddddddd-0000-4000-8000-000000000013''
      and data_origin is null and log_date <> date ''2026-08-20''', '0');
select authz_probe.expect_value('u3.release.the_release_is_recorded_on_the_run_ledger',
  'select count(*)::text from public.nao_loader_runs
    where target_user_id = ''dddddddd-0000-4000-8000-000000000013''
      and origin = ''release:run4-demo''', '1');

-- RESIDUE (design §B.5 / §I.3): a Biotope write over a simulated date leaves the marker stale. U3
-- cannot prevent it (a CHECK or trigger would break R4-U2; apps/biotope is a forbidden path) — so it
-- DETECTS it. Simulated on the marker, but the row moved after the run that wrote it.
update public.daily_gut_rows
   set updated_at = now() + interval '5 seconds', notes = 'a later real edit'
 where user_id = 'dddddddd-0000-4000-8000-000000000013' and log_date = date '2026-08-04';

begin;
  set local request.jwt.claims = '{"sub": "cccccccc-0000-4000-8000-000000000002", "role": "authenticated"}';
  set local role authenticated;
  select authz_probe.expect_value('u3.residue.a_later_edit_over_a_simulated_date_is_detected',
    'select public.nao_loader_status(''dddddddd-0000-4000-8000-000000000013''::uuid)
              ->>''residueDateCount''', '1');
  select authz_probe.expect_value('u3.residue.the_real_row_is_reported_as_protected',
    'select public.nao_loader_status(''dddddddd-0000-4000-8000-000000000013''::uuid)
              ->>''protectedDateCount''', '1');
  -- The status surface is gated exactly like the loader, and is not an oracle either.
  select authz_probe.u3_expect_message('u3.residue.status_on_an_unregistered_target_is_denied',
    'select public.nao_loader_status(''eeeeeeee-0000-4000-8000-000000000001''::uuid)',
    'nao: loader target not permitted');
commit;

-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 12b · THE REPAIR PATH IS SUBJECT TO THE PUBLICATION LEASE TOO (independent review finding F2)
--
--      Design §B.5 says the release runs "the same preamble as §A.2 steps 1-5", and step 5 IS the
--      lease check. It was absent, so a repair could DELETE raw truth from under an in-flight
--      pipeline while a second LOAD against the same target was correctly refused — the repair path
--      bypassing the very mechanism §E.1 exists for, and deleting is strictly worse than
--      overwriting. Unlike the apply path there is no replay short-circuit above it, so every
--      release is subject to the check.
-- ═════════════════════════════════════════════════════════════════════════════════════════════

begin;
  set local request.jwt.claims = '{"sub": "cccccccc-0000-4000-8000-000000000002", "role": "authenticated"}';
  set local role authenticated;
  select authz_probe.expect_ok('u3.release.setup_a_load_that_opens_a_lease',
    authz_probe.u3_apply_sql('dddddddd-0000-4000-8000-000000000016', 'rellease-key-000000001',
                             authz_probe.u3_days(date '2026-08-01', 5)));
  -- Lease open, zero stages recorded ⇒ a new LOAD is refused (§E.1). A REPAIR must be too.
  select authz_probe.expect_error('u3.release.a_new_load_is_refused_while_the_lease_is_open',
    authz_probe.u3_apply_sql('dddddddd-0000-4000-8000-000000000016', 'rellease-key-000000002',
                             authz_probe.u3_days(date '2026-08-10', 5)), '42501');
  select authz_probe.expect_error('u3.release.is_refused_while_the_lease_is_open',
    'select public.nao_loader_release_simulated_days(
              ''dddddddd-0000-4000-8000-000000000016''::uuid,
              array[date ''2026-08-01'', date ''2026-08-02''])', '42501');
  select authz_probe.u3_expect_message('u3.release.the_lease_refusal_reuses_the_one_fixed_message',
    'select public.nao_loader_release_simulated_days(
              ''dddddddd-0000-4000-8000-000000000016''::uuid, array[date ''2026-08-01''])',
    'nao: loader target not permitted');
commit;

select authz_probe.expect_value('u3.release.the_refused_release_deleted_nothing',
  'select ((select count(*) from public.daily_gut_rows
             where user_id = ''dddddddd-0000-4000-8000-000000000016'')
        || ''/'' ||
           (select count(*) from public.wearable_daily
             where user_id = ''dddddddd-0000-4000-8000-000000000016''))', '5/5');
select authz_probe.expect_value('u3.release.the_refused_release_left_no_ledger_row',
  'select count(*)::text from public.nao_loader_runs
    where target_user_id = ''dddddddd-0000-4000-8000-000000000016''
      and origin = ''release:run4-demo''', '0');

-- ...and once the pipeline has reported, the lease clears and the repair proceeds normally, so the
-- check gates the repair rather than forbidding it.
begin;
  set local request.jwt.claims = '{"sub": "cccccccc-0000-4000-8000-000000000002", "role": "authenticated"}';
  set local role authenticated;
  select authz_probe.expect_ok('u3.release.recording_the_pipeline_clears_the_lease_for_repair',
    'select public.nao_loader_record_pipeline(''rellease-key-000000001'',
              authz_probe.u3_stages_ok())');
  select authz_probe.expect_ok('u3.release.proceeds_once_the_lease_is_cleared',
    'select public.nao_loader_release_simulated_days(
              ''dddddddd-0000-4000-8000-000000000016''::uuid,
              array[date ''2026-08-01'', date ''2026-08-02''])');
commit;

select authz_probe.expect_value('u3.release.the_permitted_release_removed_exactly_those_days',
  'select ((select count(*) from public.daily_gut_rows
             where user_id = ''dddddddd-0000-4000-8000-000000000016'')
        || ''/'' ||
           (select count(*) from public.wearable_daily
             where user_id = ''dddddddd-0000-4000-8000-000000000016''))', '3/3');

-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 12c · THE VERDICT IS RUN-SCOPED, NOT TARGET-SCOPED (independent review finding F3)
--
--      nao_loader_record_pipeline looked its run up BY KEY, inserted that run's stage rows, and
--      then returned a verdict derived from whatever run happened to be the target's most recent.
--      Those diverge in exactly the case the lease exists for: an OVER-RUNNING pipeline whose lease
--      expired, under which a second run has already committed. The raced run then reported
--      `pending` — severity 1, LOWER than `incomplete` — instead of `mixed` (3), and handed back a
--      requestKey that was not the caller's.
-- ═════════════════════════════════════════════════════════════════════════════════════════════

begin;
  set local request.jwt.claims = '{"sub": "cccccccc-0000-4000-8000-000000000002", "role": "authenticated"}';
  set local role authenticated;
  select authz_probe.expect_ok('u3.runscope.run_a_succeeds_and_opens_its_lease',
    authz_probe.u3_apply_sql('dddddddd-0000-4000-8000-000000000017', 'runscope-a-key-00000001',
                             authz_probe.u3_days(date '2026-07-01', 4)));
commit;

-- A's pipeline OVER-RUNS: the lease self-expires before the stages are reported. That is the whole
-- point of a self-expiring lease (a crashed run must not wedge the target permanently) and it is
-- what lets a second run land underneath.
update public.nao_loader_runs set lease_until = now() - interval '1 minute'
 where request_key = 'runscope-a-key-00000001';

begin;
  set local request.jwt.claims = '{"sub": "cccccccc-0000-4000-8000-000000000002", "role": "authenticated"}';
  set local role authenticated;
  select authz_probe.expect_ok('u3.runscope.run_b_lands_under_the_expired_lease',
    authz_probe.u3_apply_sql('dddddddd-0000-4000-8000-000000000017', 'runscope-b-key-00000001',
                             authz_probe.u3_days(date '2026-07-10', 4)));
  -- ...and only NOW does A's pipeline report. Raw truth moved under it, so A's own verdict is
  -- `mixed`; B's is `pending`. The caller asked about A.
  select authz_probe.u3_capture_jsonb('runscope.a_verdict',
    'select public.nao_loader_record_pipeline(''runscope-a-key-00000001'',
              authz_probe.u3_stages_ok())');
commit;

select authz_probe.expect_value('u3.runscope.the_verdict_names_the_callers_own_run',
  'select value->>''requestKey'' from authz_probe.u3_capture where key = ''runscope.a_verdict''',
  'runscope-a-key-00000001');
select authz_probe.expect_value('u3.runscope.an_over_running_pipeline_derives_mixed',
  'select value->>''status'' from authz_probe.u3_capture where key = ''runscope.a_verdict''',
  'mixed');
select authz_probe.expect_value('u3.runscope.mixed_outranks_incomplete_rather_than_ranking_below_it',
  'select value->>''severity'' from authz_probe.u3_capture where key = ''runscope.a_verdict''', '3');
select authz_probe.expect_value('u3.runscope.the_three_stages_were_recorded_against_run_a',
  'select value->>''stagesRecorded'' from authz_probe.u3_capture where key = ''runscope.a_verdict''',
  '3');
-- The relay's own fold needs a real observation to compare against `watermarkAfter`, so the
-- document carries the digest the definer observed while stamping (review finding F10).
select authz_probe.expect_value('u3.runscope.the_verdict_carries_the_observed_digest',
  'select ((value->>''observedDigest'') is not null
       and (value->>''observedDigest'') <> (value->>''watermarkAfter''))::text
     from authz_probe.u3_capture where key = ''runscope.a_verdict''', 'true');

begin;
  set local request.jwt.claims = '{"sub": "cccccccc-0000-4000-8000-000000000002", "role": "authenticated"}';
  set local role authenticated;
  -- "What is this target's state?" is a DIFFERENT question and still has its own answer.
  select authz_probe.expect_value('u3.runscope.the_target_scoped_form_still_reports_the_latest_run',
    'select public.nao_loader_status(''dddddddd-0000-4000-8000-000000000017''::uuid)
              ->>''requestKey''', 'runscope-b-key-00000001');
  -- An unknown key is refused rather than silently answered about somebody else's run.
  select authz_probe.expect_error('u3.runscope.an_unknown_key_is_refused_not_substituted',
    'select public.nao_loader_status(''dddddddd-0000-4000-8000-000000000017''::uuid,
                                     ''runscope-z-key-00000001'')', '22023');
  -- ...and a key belonging to ANOTHER target cannot be read across the registry.
  select authz_probe.expect_error('u3.runscope.a_key_from_another_target_is_refused',
    'select public.nao_loader_status(''dddddddd-0000-4000-8000-000000000017''::uuid,
                                     ''release-key-0000000001'')', '22023');

  -- ═══════════════════════════════════════════════════════════════════════════════════════════
  -- N1 (independent re-review finding): run-scoping the VERDICT above (F3) did not, by itself,
  -- run-scope RESIDUE. Residue was compared against v_run.completed_at with NO date restriction, so
  -- run B's brand-new, freshly-written days (2026-07-10..13 — never touched by run A, whose own
  -- footprint is 2026-07-01..04) were reported as run A's residue, purely because they postdate A's
  -- completed_at. §F's repair table tells an operator to hand residue dates to
  -- nao_loader_release_simulated_days — which would then delete run B's good data. Residue must be
  -- scoped to the NAMED run's own written_dates, so it can only ever report a date that run itself
  -- wrote.
  -- ═══════════════════════════════════════════════════════════════════════════════════════════
  select authz_probe.expect_value(
    'u3.runscope.a_later_legitimate_runs_own_dates_are_never_an_earlier_runs_residue',
    'select public.nao_loader_status(''dddddddd-0000-4000-8000-000000000017''::uuid,
                                     ''runscope-a-key-00000001'')->>''residueDateCount''', '0');
  select authz_probe.expect_value(
    'u3.runscope.the_residue_array_is_empty_not_merely_the_count',
    'select public.nao_loader_status(''dddddddd-0000-4000-8000-000000000017''::uuid,
                                     ''runscope-a-key-00000001'')->>''residueDates''', '[]');
  -- Directly against the offending dates, so a future re-widening of the predicate cannot pass this
  -- assertion by coincidence: run B's own dates specifically must not appear in run A's residue list.
  select authz_probe.expect_value(
    'u3.runscope.run_bs_own_dates_specifically_do_not_appear_in_run_as_residue',
    'select (
       (public.nao_loader_status(''dddddddd-0000-4000-8000-000000000017''::uuid,
                                  ''runscope-a-key-00000001'')->''residueDates'') ? ''2026-07-10''
       or
       (public.nao_loader_status(''dddddddd-0000-4000-8000-000000000017''::uuid,
                                  ''runscope-a-key-00000001'')->''residueDates'') ? ''2026-07-11''
     )::text', 'false');
commit;

-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 13 · STABLE DEMAND IDENTITY — a replay does not double-count, a genuinely new run still adds
--
--     Run as the superuser: record_gap_events_keyed is service_role-only, and the engine
--     (generate-insights) is the only caller.
-- ═════════════════════════════════════════════════════════════════════════════════════════════

select authz_probe.expect_value('u3.demand.first_application_applies_every_event',
  'select public.record_gap_events_keyed(
      ''[{"metric_a":"u3_alpha","metric_b":"u3_beta","status":"lit-candidate-no-edge"},
         {"metric_a":"u3_gamma","metric_b":"u3_delta","status":"personal-null"}]''::jsonb,
      ''gi.v1.harness.key.one'')::text',
  '{"applied": 2, "skipped": 0}');

select authz_probe.expect_value('u3.demand.demand_is_one_after_the_first_run',
  'select demand::text from public.gap_ledger
    where metric_a = ''u3_alpha'' and metric_b = ''u3_beta'' and scope = ''aggregate''', '1');

select authz_probe.expect_value('u3.demand.replaying_the_same_key_applies_nothing',
  'select public.record_gap_events_keyed(
      ''[{"metric_a":"u3_alpha","metric_b":"u3_beta","status":"lit-candidate-no-edge"},
         {"metric_a":"u3_gamma","metric_b":"u3_delta","status":"personal-null"}]''::jsonb,
      ''gi.v1.harness.key.one'')::text',
  '{"applied": 0, "skipped": 2}');

select authz_probe.expect_value('u3.demand.a_replay_does_not_double_count',
  'select demand::text from public.gap_ledger
    where metric_a = ''u3_alpha'' and metric_b = ''u3_beta'' and scope = ''aggregate''', '1');

select authz_probe.expect_value('u3.demand.a_genuinely_new_run_still_increments',
  'select public.record_gap_events_keyed(
      ''[{"metric_a":"u3_alpha","metric_b":"u3_beta","status":"lit-candidate-no-edge"},
         {"metric_a":"u3_gamma","metric_b":"u3_delta","status":"personal-null"}]''::jsonb,
      ''gi.v1.harness.key.two'')::text',
  '{"applied": 2, "skipped": 0}');

select authz_probe.expect_value('u3.demand.demand_is_two_after_the_second_run',
  'select demand::text from public.gap_ledger
    where metric_a = ''u3_alpha'' and metric_b = ''u3_beta'' and scope = ''aggregate''', '2');

-- A crash midway through the event loop: the events already applied keep their increments, and a
-- retry with the SAME key applies only the remainder. Per-event granularity is what makes the loop
-- resumable rather than all-or-nothing.
select authz_probe.expect_value('u3.demand.a_partial_run_applies_only_what_it_reached',
  'select public.record_gap_events_keyed(
      ''[{"metric_a":"u3_alpha","metric_b":"u3_beta","status":"lit-candidate-no-edge"}]''::jsonb,
      ''gi.v1.harness.key.three'')::text',
  '{"applied": 1, "skipped": 0}');

select authz_probe.expect_value('u3.demand.the_resumed_run_applies_only_the_remainder',
  'select public.record_gap_events_keyed(
      ''[{"metric_a":"u3_alpha","metric_b":"u3_beta","status":"lit-candidate-no-edge"},
         {"metric_a":"u3_gamma","metric_b":"u3_delta","status":"personal-null"}]''::jsonb,
      ''gi.v1.harness.key.three'')::text',
  '{"applied": 1, "skipped": 1}');

-- Note the pair order: record_gap_events_keyed normalises with least()/greatest() exactly as
-- record_gap_events does, so the (gamma, delta) event is stored as (u3_delta, u3_gamma). Asserting on
-- the stored order is the point — a caller cannot violate the lexicographic CHECK.
select authz_probe.expect_value('u3.demand.a_resumed_run_totals_exactly_one_clean_run',
  'select ((select demand from public.gap_ledger where metric_a = ''u3_alpha''
             and metric_b = ''u3_beta'' and scope = ''aggregate'')
        || ''/'' ||
           (select demand from public.gap_ledger where metric_a = ''u3_delta''
             and metric_b = ''u3_gamma'' and scope = ''aggregate''))', '3/3');

select authz_probe.expect_value('u3.demand.the_pair_order_is_normalised_by_the_writer',
  'select count(*)::text from public.gap_ledger
    where scope = ''aggregate'' and metric_a in (''u3_gamma'') ', '0');

select authz_probe.expect_value('u3.demand.the_applications_ledger_holds_no_user_identifier',
  'select count(*)::text from information_schema.columns
    where table_schema = ''public'' and table_name = ''gap_demand_applications''
      and column_name ~* ''user''', '0');

select authz_probe.expect_error('u3.demand.a_blank_demand_key_is_refused',
  'select public.record_gap_events_keyed(''[]''::jsonb, '''')', '22023');

-- record_gap_events itself is left BYTE-IDENTICAL: it is A1's function and other units are its
-- declared future callers.
select authz_probe.expect_value('u3.demand.record_gap_events_is_untouched',
  'select (pronargs = 1
       and position(''gap_demand_applications'' in prosrc) = 0
       and position(''demand             = g.demand + excluded.demand'' in prosrc) > 0)::text
     from pg_proc where oid = ''public.record_gap_events(jsonb)''::regprocedure', 'true');

-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 14 · R4-U2 NON-REGRESSION, RE-ASSERTED FROM U3's SIDE
--
--     These are U3's OWN assertions in U3's OWN file — no R4-U2 file is touched. They are the
--     mechanical statement of the four constraints U2's harness imposes on this unit, so a future
--     edit to these migrations cannot quietly break the 443-assertion suite next door.
-- ═════════════════════════════════════════════════════════════════════════════════════════════

select authz_probe.expect_value('u3.nonreg.zero_restrictive_policies_on_daily_gut_rows',
  'select count(*)::text from pg_policies
    where schemaname = ''public'' and tablename = ''daily_gut_rows''
      and permissive = ''RESTRICTIVE''', '0');
select authz_probe.expect_value('u3.nonreg.zero_restrictive_policies_on_wearable_daily',
  'select count(*)::text from pg_policies
    where schemaname = ''public'' and tablename = ''wearable_daily''
      and permissive = ''RESTRICTIVE''', '0');
select authz_probe.expect_value('u3.nonreg.exactly_ten_restrictive_policies_in_public',
  'select count(*)::text from pg_policies
    where schemaname = ''public'' and permissive = ''RESTRICTIVE''', '10');

-- The three policies on daily_gut_rows and the three on wearable_daily are still exactly R4-U2's.
select authz_probe.expect_value('u3.nonreg.the_truth_tables_still_have_three_policies_each',
  'select ((select count(*) from pg_policies where schemaname = ''public''
             and tablename = ''daily_gut_rows'')
        || ''/'' ||
           (select count(*) from pg_policies where schemaname = ''public''
             and tablename = ''wearable_daily''))', '3/3');

select authz_probe.expect_value('u3.nonreg.daily_gut_rows_authenticated_privileges_intact',
  'select (has_table_privilege(''authenticated'', ''public.daily_gut_rows'', ''SELECT'')
       and has_table_privilege(''authenticated'', ''public.daily_gut_rows'', ''INSERT'')
       and has_table_privilege(''authenticated'', ''public.daily_gut_rows'', ''UPDATE''))::text',
  'true');
select authz_probe.expect_value('u3.nonreg.wearable_daily_authenticated_privileges_intact',
  'select (has_table_privilege(''authenticated'', ''public.wearable_daily'', ''SELECT'')
       and has_table_privilege(''authenticated'', ''public.wearable_daily'', ''INSERT'')
       and has_table_privilege(''authenticated'', ''public.wearable_daily'', ''UPDATE''))::text',
  'true');

-- No trigger on either truth table (a trigger would change the literal values R4-U2's
-- `…_took_effect` assertions pin).
select authz_probe.expect_value('u3.nonreg.zero_triggers_on_the_truth_tables',
  'select count(*)::text from pg_trigger
    where tgrelid in (''public.daily_gut_rows''::regclass, ''public.wearable_daily''::regclass)
      and not tgisinternal', '0');

-- No CHECK constraint naming data_origin or source (a CHECK would turn four R4-U2 expect_ok
-- assertions into error:23514).
select authz_probe.expect_value('u3.nonreg.zero_checks_naming_data_origin_or_source',
  'select count(*)::text from pg_constraint c
    where c.conrelid in (''public.daily_gut_rows''::regclass, ''public.wearable_daily''::regclass)
      and c.contype = ''c''
      and (pg_get_constraintdef(c.oid) like ''%data_origin%''
        or pg_get_constraintdef(c.oid) like ''%source%'')', '0');

-- No column was added to either truth table: the column set is still exactly what 20260513 /
-- 20260528100000 / 20260724120000 created.
select authz_probe.expect_value('u3.nonreg.daily_gut_rows_column_count_is_unchanged',
  'select count(*)::text from information_schema.columns
    where table_schema = ''public'' and table_name = ''daily_gut_rows''', '22');
select authz_probe.expect_value('u3.nonreg.wearable_daily_column_count_is_unchanged',
  'select count(*)::text from information_schema.columns
    where table_schema = ''public'' and table_name = ''wearable_daily''', '10');
select authz_probe.expect_value('u3.nonreg.no_run_identity_column_leaked_into_a_pre_u2_table',
  'select count(*)::text from information_schema.columns
    where table_schema = ''public''
      and table_name in (''daily_gut_rows'', ''wearable_daily'', ''gap_ledger'', ''insight_cards'',
                         ''personal_signals'', ''baseline_snapshots'', ''composed_insights'')
      and column_name in (''loader_run_id'', ''run_key'', ''demand_key'', ''request_key'',
                          ''watermark'', ''lease_until'')', '0');

-- ...and the two truth tables' own populate path still works for an ordinary user writing their OWN
-- rows, exactly as pa_probe / pb_probe assert next door. This is Invariant P, re-proven here.
begin;
  set local request.jwt.claims = '{"sub": "eeeeeeee-0000-4000-8000-000000000003", "role": "authenticated"}';
  set local role authenticated;
  select authz_probe.expect_ok('u3.nonreg.a_biotope_user_can_still_insert_their_own_gut_row',
    'insert into public.daily_gut_rows (user_id, log_date, data_origin)
     values (auth.uid(), date ''2026-09-01'', ''probe:u3'')');
  select authz_probe.expect_ok('u3.nonreg.a_biotope_user_can_still_upsert_their_own_gut_row',
    'insert into public.daily_gut_rows (user_id, log_date, data_origin)
     values (auth.uid(), date ''2026-09-01'', ''probe:u3-upserted'')
     on conflict (user_id, log_date) do update set data_origin = excluded.data_origin');
  select authz_probe.expect_value('u3.nonreg.an_arbitrary_provenance_string_still_takes_effect',
    'select data_origin from public.daily_gut_rows
      where user_id = auth.uid() and log_date = date ''2026-09-01''', 'probe:u3-upserted');
  select authz_probe.expect_ok('u3.nonreg.a_biotope_user_can_still_insert_their_own_wearable_row',
    'insert into public.wearable_daily (user_id, date, resting_hr_bpm, source)
     values (auth.uid(), date ''2026-09-01'', 61, ''probe:u3'')');
  -- ...and still cannot reach anyone else's rows, through the tables or through the new RPC.
  select authz_probe.expect_error('u3.nonreg.a_biotope_user_still_cannot_insert_another_users_row',
    'insert into public.daily_gut_rows (user_id, log_date)
     values (''dddddddd-0000-4000-8000-000000000001'', date ''2026-09-02'')', '42501');
  select authz_probe.expect_rows_affected('u3.nonreg.a_biotope_user_still_updates_zero_foreign_rows',
    'update public.daily_gut_rows set notes = ''nope''
      where user_id = ''dddddddd-0000-4000-8000-000000000001''', 0);
commit;

-- The response surface carries no identity and nothing secret-shaped. Checked over EVERY run row
-- this suite produced, not over one hand-picked example.
select authz_probe.expect_value('u3.privacy.no_run_result_contains_a_uuid',
  'select count(*)::text from public.nao_loader_runs r
    where r.result::text
          ~ ''[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}''', '0');
select authz_probe.expect_value('u3.privacy.no_run_result_key_is_secret_shaped',
  'select count(*)::text from public.nao_loader_runs r, jsonb_object_keys(r.result) k
    where k ~* ''(secret|token|password|credential|apikey)''', '0');
select authz_probe.expect_value('u3.privacy.every_run_result_carries_a_label',
  'select count(*)::text from public.nao_loader_runs r
    where r.result->>''targetLabel'' is null', '0');
