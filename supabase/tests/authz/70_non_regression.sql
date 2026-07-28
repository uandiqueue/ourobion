-- supabase/tests/authz/70_non_regression.sql
--
-- THE OTHER HALF OF THE PROOF, and every bit as important as the security half: that R4-U2 changed
-- NOTHING it was not supposed to change.
--
-- The security assertions in 60_... would all still pass if this unit had accidentally locked
-- Biotope out. These assertions are what makes that impossible to ship silently. They are measured
-- against a snapshot of pg_policies and of effective column privileges captured in THIS SAME RUN,
-- before any R4-U2 object existed (40_pre_u2_probe.sql) — not asserted from reading the diff.
--
-- The failure mode being guarded against is invisible at the API: a RESTRICTIVE policy on
-- daily_gut_rows or wearable_daily makes an upsert's conflict target unreachable and its UPDATE
-- branch affect zero rows WITHOUT raising, so the nao loader route would answer ok:true over an
-- empty database. Nothing in a normal test run would notice.

set authz_probe.phase = 'post';

-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 1 · THE HARD INVARIANT — zero RESTRICTIVE policies on the populate path, and on any of the 15
-- ═════════════════════════════════════════════════════════════════════════════════════════════

select authz_probe.expect_value('nonreg.zero_restrictive_policies_on_daily_gut_rows',
  'select count(*) from pg_policies
     where schemaname = ''public'' and tablename = ''daily_gut_rows''
       and permissive = ''RESTRICTIVE''', '0');

select authz_probe.expect_value('nonreg.zero_restrictive_policies_on_wearable_daily',
  'select count(*) from pg_policies
     where schemaname = ''public'' and tablename = ''wearable_daily''
       and permissive = ''RESTRICTIVE''', '0');

select authz_probe.expect_value('nonreg.zero_restrictive_policies_on_any_untouched_table',
  'select count(*) from authz_probe.policy_state p
     join authz_probe.untouched_tables u using (tablename)
    where p.permissive = ''RESTRICTIVE''', '0');

-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 2 · NO PRE-EXISTING POLICY WAS DROPPED, RENAMED, OR EDITED
--
--     A byte-comparison of tablename/policyname/permissive/roles/cmd/qual/with_check against the
--     pre-U2 snapshot, in both directions.
-- ═════════════════════════════════════════════════════════════════════════════════════════════

select authz_probe.expect_value('nonreg.no_pre_existing_policy_dropped_or_renamed',
  'select count(*) from authz_probe.policy_snapshot s
    where not exists (select 1 from authz_probe.policy_state c
                       where c.tablename = s.tablename and c.policyname = s.policyname)', '0');

select authz_probe.expect_value('nonreg.no_pre_existing_policy_body_changed',
  'select count(*) from (select * from authz_probe.policy_snapshot
                         except
                         select * from authz_probe.policy_state) d', '0');

select authz_probe.expect_value('nonreg.no_new_policy_on_any_untouched_table',
  'select count(*) from authz_probe.policy_state c
     join authz_probe.untouched_tables u using (tablename)
    where not exists (select 1 from authz_probe.policy_snapshot s
                       where s.tablename = c.tablename and s.policyname = c.policyname)', '0');

-- Every policy R4-U2 added is either RESTRICTIVE (so it can only narrow) or lives on one of the two
-- tables the unit created. There is no third case — that is the mechanical form of "we only added".
select authz_probe.expect_value('nonreg.every_new_policy_is_restrictive_or_on_a_new_nao_table',
  'select count(*) from authz_probe.policy_state c
    where not exists (select 1 from authz_probe.policy_snapshot s
                       where s.tablename = c.tablename and s.policyname = c.policyname)
      and c.permissive <> ''RESTRICTIVE''
      and c.tablename not in (''nao_members'', ''nao_control_events'')', '0');

-- Every new policy is scoped to `authenticated` alone. This is what keeps the service_role tool
-- paths (llm-router publish-status, brain-ingest seeder, edge-loader, generate-insights) provably
-- outside the new enforcement: no new policy names them, and service_role has BYPASSRLS in
-- production. (That BYPASSRLS is NOT reproducible in this harness — see 20_probe_harness.sql — so
-- this structural assertion is what stands in for it.)
select authz_probe.expect_value('nonreg.every_new_policy_targets_authenticated_only',
  'select count(*) from authz_probe.policy_state c
    where not exists (select 1 from authz_probe.policy_snapshot s
                       where s.tablename = c.tablename and s.policyname = c.policyname)
      and c.roles <> ''{authenticated}''', '0');

select authz_probe.expect_value('nonreg.no_new_policy_names_service_role',
  'select count(*) from authz_probe.policy_state c
    where not exists (select 1 from authz_probe.policy_snapshot s
                       where s.tablename = c.tablename and s.policyname = c.policyname)
      and c.roles like ''%service_role%''', '0');

-- The expected shape of what WAS added: 10 restrictive policies over the 6 pre-existing gated
-- tables, and 3 permissive policies on the 2 new tables. A count assertion here means a stray
-- extra policy cannot slip in unnoticed.
select authz_probe.expect_value('nonreg.exactly_ten_restrictive_policies_added',
  'select count(*) from authz_probe.policy_state where permissive = ''RESTRICTIVE''', '10');

select authz_probe.expect_value('nonreg.new_permissive_policies_only_on_the_two_new_tables',
  'select count(*) from authz_probe.policy_state c
    where not exists (select 1 from authz_probe.policy_snapshot s
                       where s.tablename = c.tablename and s.policyname = c.policyname)
      and c.permissive = ''PERMISSIVE''', '3');

-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 3 · COLUMN PRIVILEGES — changed on EXACTLY the three redacted tables and nowhere else
-- ═════════════════════════════════════════════════════════════════════════════════════════════

select authz_probe.expect_value('nonreg.column_privileges_unchanged_on_untouched_tables',
  'select count(*) from (
     (select * from authz_probe.colpriv_snapshot except select * from authz_probe.colpriv_state)
     union all
     (select * from authz_probe.colpriv_state except select * from authz_probe.colpriv_snapshot)
   ) d join authz_probe.untouched_tables u using (tablename)', '0');

-- Across every table that already existed before R4-U2, the ONLY effective column-privilege changes
-- are on the three redacted tables. (Tables the unit created — nao_members, nao_control_events — are
-- excluded by requiring the table to appear in the pre-U2 snapshot; their privilege map is asserted
-- directly in section 5 instead.)
select authz_probe.expect_value('nonreg.column_privileges_changed_only_on_the_three_redacted_tables',
  'select count(*) from (
     (select * from authz_probe.colpriv_snapshot except select * from authz_probe.colpriv_state)
     union all
     (select * from authz_probe.colpriv_state except select * from authz_probe.colpriv_snapshot)
   ) d
   where d.tablename in (select distinct tablename from authz_probe.colpriv_snapshot)
     and d.tablename not in (''llm_router_cap_overrides'', ''edge_human_verdicts'',
                             ''ingestion_seeds'')', '0');

-- ...and the three redacted tables DID change, in the expected direction. A test that only proves
-- "nothing changed" would also pass if the revoke silently did nothing.
select authz_probe.expect_value('nonreg.the_three_redacted_tables_did_change',
  'select count(distinct d.tablename) from (
     select * from authz_probe.colpriv_snapshot except select * from authz_probe.colpriv_state
   ) d
   where d.tablename in (''llm_router_cap_overrides'', ''edge_human_verdicts'',
                         ''ingestion_seeds'')', '3');

-- Named explicitly, because these two are the ones a mistake would silently break.
select authz_probe.expect_value('nonreg.daily_gut_rows_authenticated_privileges_intact',
  'select (has_table_privilege(''authenticated'', ''public.daily_gut_rows'', ''SELECT'')
       and has_table_privilege(''authenticated'', ''public.daily_gut_rows'', ''INSERT'')
       and has_table_privilege(''authenticated'', ''public.daily_gut_rows'', ''UPDATE''))::text',
  'true');

select authz_probe.expect_value('nonreg.wearable_daily_authenticated_privileges_intact',
  'select (has_table_privilege(''authenticated'', ''public.wearable_daily'', ''SELECT'')
       and has_table_privilege(''authenticated'', ''public.wearable_daily'', ''INSERT'')
       and has_table_privilege(''authenticated'', ''public.wearable_daily'', ''UPDATE''))::text',
  'true');

-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 4 · P-b · THE BIOTOPE-ONLY USER'S ACCESS IS BIT-FOR-BIT WHAT IT WAS BEFORE R4-U2
-- ═════════════════════════════════════════════════════════════════════════════════════════════

select authz_probe.expect_value('nonreg.pb_probe_ran_in_both_phases',
  'select (count(*) filter (where phase = ''pre'')  >= 20
       and count(*) filter (where phase = ''pre'')
         = count(*) filter (where phase = ''post''))::text
     from authz_probe.result where name like ''pb.%''', 'true');

select authz_probe.expect_value('nonreg.pb_probe_identical_pre_and_post',
  'select count(*) from authz_probe.result pre
     join authz_probe.result post on post.name = pre.name and post.phase = ''post''
    where pre.phase = ''pre''
      and (pre.actual <> post.actual or pre.ok <> post.ok)', '0');

select authz_probe.expect_value('nonreg.pb_probe_all_passed_pre',
  'select count(*) from authz_probe.result
    where phase = ''pre'' and not ok', '0');

-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 5 · OBJECT-SHAPE ASSERTIONS — the contract's surface, verified against the catalog
-- ═════════════════════════════════════════════════════════════════════════════════════════════

-- nao_role() must take NO arguments: it must be impossible to ask about another user.
select authz_probe.expect_value('objects.nao_role_takes_no_arguments',
  'select pronargs::text from pg_proc where oid = ''public.nao_role()''::regprocedure', '0');
select authz_probe.expect_value('objects.nao_role_is_security_definer',
  'select prosecdef::text from pg_proc where oid = ''public.nao_role()''::regprocedure', 'true');
select authz_probe.expect_value('objects.nao_role_is_stable',
  'select provolatile::text from pg_proc where oid = ''public.nao_role()''::regprocedure', 's');
select authz_probe.expect_value('objects.nao_role_search_path_is_pinned',
  'select array_to_string(proconfig, '','') from pg_proc
     where oid = ''public.nao_role()''::regprocedure', 'search_path=public, pg_temp');

select authz_probe.expect_value('objects.nao_has_role_is_security_definer',
  'select prosecdef::text from pg_proc where oid = ''public.nao_has_role(text)''::regprocedure',
  'true');
select authz_probe.expect_value('objects.nao_has_role_is_stable',
  'select provolatile::text from pg_proc where oid = ''public.nao_has_role(text)''::regprocedure',
  's');
select authz_probe.expect_value('objects.nao_has_role_search_path_is_pinned',
  'select array_to_string(proconfig, '','') from pg_proc
     where oid = ''public.nao_has_role(text)''::regprocedure', 'search_path=public, pg_temp');

select authz_probe.expect_value('objects.nao_authorize_is_security_definer',
  'select prosecdef::text from pg_proc where oid = ''public.nao_authorize(text)''::regprocedure',
  'true');
select authz_probe.expect_value('objects.nao_authorize_is_volatile',
  'select provolatile::text from pg_proc where oid = ''public.nao_authorize(text)''::regprocedure',
  'v');
select authz_probe.expect_value('objects.nao_authorize_returns_void',
  'select pg_get_function_result(''public.nao_authorize(text)''::regprocedure)', 'void');
select authz_probe.expect_value('objects.nao_authorize_search_path_is_pinned',
  'select array_to_string(proconfig, '','') from pg_proc
     where oid = ''public.nao_authorize(text)''::regprocedure', 'search_path=public, pg_temp');

-- Function EXECUTE map: authenticated yes, anon no. (`public` cannot be passed to
-- has_function_privilege, so anon — which is the role an unauthenticated request actually runs
-- as — is what is asserted.)
select authz_probe.expect_value('objects.anon_cannot_execute_nao_role',
  'select has_function_privilege(''anon'', ''public.nao_role()'', ''EXECUTE'')::text', 'false');
select authz_probe.expect_value('objects.anon_cannot_execute_nao_authorize',
  'select has_function_privilege(''anon'', ''public.nao_authorize(text)'', ''EXECUTE'')::text',
  'false');
select authz_probe.expect_value('objects.authenticated_can_execute_nao_role',
  'select has_function_privilege(''authenticated'', ''public.nao_role()'', ''EXECUTE'')::text',
  'true');
select authz_probe.expect_value('objects.authenticated_can_execute_nao_authorize',
  'select has_function_privilege(''authenticated'', ''public.nao_authorize(text)'',
                                 ''EXECUTE'')::text', 'true');
select authz_probe.expect_value('objects.anon_cannot_execute_nao_record_control_event',
  'select has_function_privilege(
     ''anon'', ''public.nao_record_control_event(uuid,text,text,text,jsonb,text)'', ''EXECUTE''
   )::text', 'false');
select authz_probe.expect_value('objects.anon_cannot_execute_nao_apply_control_mutation',
  'select has_function_privilege(
     ''anon'', ''public.nao_apply_control_mutation(uuid,text,text,jsonb,jsonb)'', ''EXECUTE''
   )::text', 'false');
select authz_probe.expect_value('objects.service_role_cannot_execute_nao_record_control_event',
  'select has_function_privilege(
     ''service_role'', ''public.nao_record_control_event(uuid,text,text,text,jsonb,text)'', ''EXECUTE''
   )::text', 'false');
select authz_probe.expect_value('objects.service_role_cannot_execute_nao_apply_control_mutation',
  'select has_function_privilege(
     ''service_role'', ''public.nao_apply_control_mutation(uuid,text,text,jsonb,jsonb)'', ''EXECUTE''
   )::text', 'false');
select authz_probe.expect_value('objects.authenticated_can_execute_nao_record_control_event',
  'select has_function_privilege(
     ''authenticated'', ''public.nao_record_control_event(uuid,text,text,text,jsonb,text)'', ''EXECUTE''
   )::text', 'true');
select authz_probe.expect_value('objects.authenticated_can_execute_nao_apply_control_mutation',
  'select has_function_privilege(
     ''authenticated'', ''public.nao_apply_control_mutation(uuid,text,text,jsonb,jsonb)'', ''EXECUTE''
   )::text', 'true');

-- nao_members: SELECT-only for authenticated, at BOTH layers (no write policy AND no write grant).
select authz_probe.expect_value('objects.nao_members_has_no_write_policy',
  'select count(*) from pg_policies
     where schemaname = ''public'' and tablename = ''nao_members'' and cmd <> ''SELECT''', '0');
select authz_probe.expect_value('objects.authenticated_cannot_write_nao_members',
  'select (has_table_privilege(''authenticated'', ''public.nao_members'', ''INSERT'')
        or has_table_privilege(''authenticated'', ''public.nao_members'', ''UPDATE'')
        or has_table_privilege(''authenticated'', ''public.nao_members'', ''DELETE''))::text',
  'false');
select authz_probe.expect_value('objects.service_role_can_provision_nao_members',
  'select (has_table_privilege(''service_role'', ''public.nao_members'', ''INSERT'')
       and has_table_privilege(''service_role'', ''public.nao_members'', ''UPDATE''))::text',
  'true');
select authz_probe.expect_value('objects.anon_has_no_privilege_on_nao_members',
  'select has_any_column_privilege(''anon'', ''public.nao_members'', ''SELECT'')::text', 'false');

-- nao_control_events: append-only at all three locks.
select authz_probe.expect_value('objects.control_events_have_no_update_or_delete_policy',
  'select count(*) from pg_policies
     where schemaname = ''public'' and tablename = ''nao_control_events''
       and cmd in (''UPDATE'', ''DELETE'', ''ALL'')', '0');
select authz_probe.expect_value('objects.no_api_role_can_mutate_control_events',
  'select count(*) from (
     select r, p from unnest(array[''anon'', ''authenticated'', ''service_role'']) r
       cross join unnest(array[''UPDATE'', ''DELETE'', ''TRUNCATE'']) p) x
    where has_table_privilege(x.r, ''public.nao_control_events'', x.p)', '0');
select authz_probe.expect_value('objects.control_events_append_only_triggers_present',
  'select count(*) from pg_trigger
     where tgrelid = ''public.nao_control_events''::regclass
       and tgname in (''nao_control_events_no_update'', ''nao_control_events_no_delete'',
                      ''nao_control_events_no_truncate'')
       and not tgisinternal', '3');
select authz_probe.expect_value('objects.control_events_stamp_trigger_present',
  'select count(*) from pg_trigger
     where tgrelid = ''public.nao_control_events''::regclass
       and tgname = ''nao_control_events_stamp'' and not tgisinternal', '1');

-- The redaction, read straight out of the privilege map rather than from an error message.
select authz_probe.expect_value('objects.authenticated_has_no_table_select_on_redacted_tables',
  'select count(*) from unnest(array[
       ''public.llm_router_cap_overrides'', ''public.edge_human_verdicts'',
       ''public.ingestion_seeds'']) t
    where has_table_privilege(''authenticated'', t, ''SELECT'')', '0');

select authz_probe.expect_value('objects.identity_columns_are_unreadable_by_authenticated',
  'select count(*) from (values
       (''public.llm_router_cap_overrides'', ''updated_by''),
       (''public.edge_human_verdicts'',      ''created_by''),
       (''public.ingestion_seeds'',          ''created_by'')) v(t, c)
    where has_column_privilege(''authenticated'', v.t, v.c, ''SELECT'')', '0');

select authz_probe.expect_value('objects.identity_columns_are_unreadable_by_anon',
  'select count(*) from (values
       (''public.llm_router_cap_overrides'', ''updated_by''),
       (''public.edge_human_verdicts'',      ''created_by''),
       (''public.ingestion_seeds'',          ''created_by'')) v(t, c)
    where has_column_privilege(''anon'', v.t, v.c, ''SELECT'')', '0');

select authz_probe.expect_value('objects.granted_columns_are_all_readable_by_authenticated',
  'select count(*) from (values
       (''public.llm_router_cap_overrides'', ''node''),
       (''public.llm_router_cap_overrides'', ''per_day_usd_cap''),
       (''public.llm_router_cap_overrides'', ''per_run_token_cap''),
       (''public.llm_router_cap_overrides'', ''updated_at''),
       (''public.edge_human_verdicts'',      ''id''),
       (''public.edge_human_verdicts'',      ''edge_id''),
       (''public.edge_human_verdicts'',      ''action''),
       (''public.edge_human_verdicts'',      ''reason''),
       (''public.edge_human_verdicts'',      ''created_at''),
       (''public.ingestion_seeds'',          ''id''),
       (''public.ingestion_seeds'',          ''slug''),
       (''public.ingestion_seeds'',          ''label''),
       (''public.ingestion_seeds'',          ''query_hint''),
       (''public.ingestion_seeds'',          ''enabled''),
       (''public.ingestion_seeds'',          ''created_at'')) v(t, c)
    where not has_column_privilege(''authenticated'', v.t, v.c, ''SELECT'')', '0');

-- service_role keeps the identity columns: "who edited this" is answerable for engineering, just
-- not through the API.
select authz_probe.expect_value('objects.service_role_retains_identity_column_reads',
  'select count(*) from (values
       (''public.llm_router_cap_overrides'', ''updated_by''),
       (''public.edge_human_verdicts'',      ''created_by''),
       (''public.ingestion_seeds'',          ''created_by'')) v(t, c)
    where not has_column_privilege(''service_role'', v.t, v.c, ''SELECT'')', '0');

-- The pre-existing column-level UPDATE restriction on ingestion_seeds is still exactly `enabled`.
select authz_probe.expect_value('nonreg.ingestion_seeds_update_still_limited_to_enabled',
  'select (has_column_privilege(''authenticated'', ''public.ingestion_seeds'', ''enabled'',
                                ''UPDATE'')
       and not has_column_privilege(''authenticated'', ''public.ingestion_seeds'', ''label'',
                                    ''UPDATE'')
       and not has_column_privilege(''authenticated'', ''public.ingestion_seeds'', ''created_by'',
                                    ''UPDATE''))::text', 'true');

reset authz_probe.phase;
