-- supabase/tests/u3/40_late_assertions.sql
--
-- The assertions that can only be made AFTER run.mjs has driven two out-of-band probes that cannot be
-- expressed inside a single psql script:
--
--   1. THE CONCURRENCY PROBE — two parallel psql children racing the same request key against a real
--      transaction-scoped advisory lock (30_concurrency_a.sql / 31_concurrency_b.sql).
--   2. THE TOP-LEVEL ABORT PROBE — a forced failure on the SECOND table where the statement is NOT
--      wrapped in a plpgsql sub-block, so the whole top-level transaction really aborts. Section 7 of
--      20_assertions.sql proves the same thing through expect_error's subtransaction; this proves it
--      through the path PostgREST actually takes, where nothing catches the error at all.

set authz_probe.phase = 'u3';

-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 1 · TWO CONCURRENT CALLERS, SAME KEY — one execution, identical results, no 'running' observed
-- ═════════════════════════════════════════════════════════════════════════════════════════════

select authz_probe.expect_value('u3.concurrent.both_callers_returned_something',
  'select count(*)::text from authz_probe.u3_capture
    where key in (''concurrent.a'', ''concurrent.b'')', '2');

select authz_probe.expect_value('u3.concurrent.caller_a_executed',
  'select value->>''replayed'' from authz_probe.u3_capture where key = ''concurrent.a''', 'false');

select authz_probe.expect_value('u3.concurrent.caller_b_replayed_rather_than_executing',
  'select value->>''replayed'' from authz_probe.u3_capture where key = ''concurrent.b''', 'true');

-- B must not have errored, and must never have seen a 'running' state — the run row and the writes
-- share a transaction, so 'running' is unobservable by construction.
select authz_probe.expect_value('u3.concurrent.caller_b_did_not_error',
  'select (value->>''sqlstate'' is null)::text from authz_probe.u3_capture
    where key = ''concurrent.b''', 'true');
select authz_probe.expect_value('u3.concurrent.caller_b_never_observed_a_running_state',
  'select (value::text not like ''%running%'')::text from authz_probe.u3_capture
    where key = ''concurrent.b''', 'true');

select authz_probe.expect_value('u3.concurrent.both_callers_got_the_identical_result',
  'select ((select value - ''replayed'' from authz_probe.u3_capture where key = ''concurrent.a'')
         = (select value - ''replayed'' from authz_probe.u3_capture where key = ''concurrent.b''))::text',
  'true');

select authz_probe.expect_value('u3.concurrent.exactly_one_run_row_for_the_shared_key',
  'select count(*)::text from public.nao_loader_runs
    where request_key = ''u3-conc-key-000000001''', '1');

select authz_probe.expect_value('u3.concurrent.exactly_one_run_row_for_the_target',
  'select count(*)::text from public.nao_loader_runs
    where target_user_id = ''dddddddd-0000-4000-8000-000000000006''', '1');

select authz_probe.expect_value('u3.concurrent.exactly_one_execution_worth_of_rows',
  'select ((select count(*) from public.daily_gut_rows
             where user_id = ''dddddddd-0000-4000-8000-000000000006'')
        || ''/'' ||
           (select count(*) from public.wearable_daily
             where user_id = ''dddddddd-0000-4000-8000-000000000006''))', '6/6');

select authz_probe.expect_value('u3.concurrent.the_committed_run_succeeded',
  'select status from public.nao_loader_runs
    where request_key = ''u3-conc-key-000000001''', 'succeeded');

-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 2 · TOP-LEVEL TRANSACTION ABORT — the PostgREST path, with nothing catching the error
-- ═════════════════════════════════════════════════════════════════════════════════════════════

-- run.mjs snapshotted the state immediately after the abort and before the retry, because the retry
-- deliberately REUSES the same request key.
select authz_probe.expect_value('u3.toplevel.the_first_table_committed_nothing',
  'select value->>''gut'' from authz_probe.u3_capture where key = ''toplevel.after_abort''', '0');

select authz_probe.expect_value('u3.toplevel.the_second_table_committed_nothing',
  'select value->>''wear'' from authz_probe.u3_capture where key = ''toplevel.after_abort''', '0');

select authz_probe.expect_value('u3.toplevel.no_run_row_survived_the_abort',
  'select value->>''runs'' from authz_probe.u3_capture where key = ''toplevel.after_abort''', '0');

-- ...and after the forced failure is removed, the SAME key succeeds: the uniqueness record died with
-- the transaction, so a failed run is safely retryable rather than permanently poisoned.
select authz_probe.expect_value('u3.toplevel.the_same_key_succeeds_once_the_fault_is_removed',
  'select count(*)::text from public.nao_loader_runs
    where request_key = ''toplevel-key-0000000001'' and status = ''succeeded''', '1');
select authz_probe.expect_value('u3.toplevel.the_retry_wrote_both_tables',
  'select ((select count(*) from public.daily_gut_rows
             where user_id = ''dddddddd-0000-4000-8000-000000000012'')
        || ''/'' ||
           (select count(*) from public.wearable_daily
             where user_id = ''dddddddd-0000-4000-8000-000000000012''))', '14/14');

-- The harness-only forced-failure constraint must be gone again, so nothing downstream inherits it.
select authz_probe.expect_value('u3.toplevel.the_harness_only_constraint_was_removed',
  'select count(*)::text from pg_constraint
    where conname = ''u3_tmp_force_failure''', '0');
