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
--   3. THE TOCTOU PROBE — the target's OWN RLS-governed write racing the loader, which is the one
--      interleaving the advisory lock cannot cover (32_toctou_b.sql / 33_toctou_a.sql).

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

-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 3 · TOCTOU — A REAL, USER-AUTHORED ROW COMMITTED UNDER THE LOADER IS STILL REFUSED
--
--     This is the interleaving an independent database review reproduced against this unit, in
--     which a real self-report was silently overwritten and re-stamped `simulated:run4-demo` with
--     `ok: true`, no conflict raised, and no artefact recording that it happened.
--
--     The advisory lock serialises loader callers; it takes no part in the TARGET's own
--     RLS-governed PostgREST write. So the pre-write provenance scan is a snapshot read that a
--     concurrent write can slip past, and "the scan precedes both inserts" — which is true — does
--     not make the inserts conditional. The guarantee therefore lives in the ON CONFLICT DO UPDATE
--     branch of each upsert, which refuses any existing row whose provenance is not registered
--     simulation, whenever that row arrived.
-- ═════════════════════════════════════════════════════════════════════════════════════════════

-- ── The probe is not vacuous ────────────────────────────────────────────────────────────────────
-- Both halves matter. If B had committed before A scanned, the ordinary pre-scan would have refused
-- and none of the assertions below would say anything about the write-time guard.

select authz_probe.expect_value('u3.toctou.both_racers_recorded_something',
  'select count(*)::text from authz_probe.u3_capture
    where key in (''toctou.a'', ''toctou.a_sees_before_applying'', ''toctou.b_observed_the_block'')',
  '3');

-- A, immediately before calling the loader, could see NO row for the target at all — B's real row
-- was uncommitted and therefore invisible to A's snapshot and to the loader's own scan.
select authz_probe.expect_value('u3.toctou.the_scan_could_not_see_the_racing_row',
  'select (value->>''gutCount'') || ''/'' || (value->>''wearCount'')
     from authz_probe.u3_capture where key = ''toctou.a_sees_before_applying''', '0/0');

-- ...and B committed only once the loader was demonstrably BLOCKED on a lock, which it can only be
-- at its insert — i.e. after it had already run and passed the scan.
select authz_probe.expect_value('u3.toctou.the_loader_was_blocked_before_the_row_committed',
  'select value->>''blocked'' from authz_probe.u3_capture
    where key = ''toctou.b_observed_the_block''', 'true');

-- ── The refusal ─────────────────────────────────────────────────────────────────────────────────

select authz_probe.expect_value('u3.toctou.the_loader_refused_with_OU409',
  'select value->>''sqlstate'' from authz_probe.u3_capture where key = ''toctou.a''', 'OU409');

-- The SAME message the scan raises, so a caller cannot tell which of the two caught it — the
-- refusal is one behaviour with two enforcement points, not two behaviours.
select authz_probe.expect_value('u3.toctou.the_refusal_is_the_conflict_refusal_verbatim',
  'select value->>''message'' from authz_probe.u3_capture where key = ''toctou.a''',
  'nao: loader refuses to overwrite rows that are not registered simulation');

-- ── WHICH enforcement point actually fired (re-review finding N2b) ─────────────────────────────
-- The refusal above is byte-identical whether the pre-scan or the write-time guard caught it, by
-- design, so the assertions above cannot tell them apart. run.mjs recorded a harness-only signal
-- (RAISE DEBUG, invisible to any real caller) read off A's own stderr. This is what proves the
-- interleaving actually exercised the WRITE-TIME guard — the thing the F1 fix is supposed to be —
-- rather than merely getting lucky with a pre-scan that happened to also refuse.
select authz_probe.expect_value('u3.toctou.the_write_time_guard_fired_on_the_gut_table',
  'select value->>''writeTimeGut'' from authz_probe.u3_capture where key = ''toctou.refusal_path''',
  'true');
select authz_probe.expect_value('u3.toctou.the_prescan_did_not_also_fire',
  'select value->>''prescan'' from authz_probe.u3_capture where key = ''toctou.refusal_path''',
  'false');

-- ── No mutation whatsoever ──────────────────────────────────────────────────────────────────────

select authz_probe.expect_value('u3.toctou.the_real_row_is_byte_identical',
  'select (md5(g::text) = (select digest from authz_probe.u3_baseline
                            where tag = ''toctou_real_gut''))::text
     from public.daily_gut_rows g
    where g.user_id = ''dddddddd-0000-4000-8000-000000000018''
      and g.log_date = date ''2026-07-03''', 'true');

-- Stated separately from the digest, because THIS is the harm: the row must still be REAL, not
-- relabelled as simulated.
select authz_probe.expect_value('u3.toctou.the_real_row_is_still_provenance_free',
  'select (data_origin is null)::text from public.daily_gut_rows
    where user_id = ''dddddddd-0000-4000-8000-000000000018''
      and log_date = date ''2026-07-03''', 'true');
select authz_probe.expect_value('u3.toctou.the_users_own_content_survived',
  'select region || ''|'' || notes || ''|'' || energy_score::text from public.daily_gut_rows
    where user_id = ''dddddddd-0000-4000-8000-000000000018''
      and log_date = date ''2026-07-03''',
  'REAL-REGION|user-authored real self-report|5');

-- The three dates the loader COULD have written rolled back with the refusal: a partial write is
-- unrepresentable here too, and the target is left holding exactly its own one row.
select authz_probe.expect_value('u3.toctou.the_loader_wrote_no_gut_row_at_all',
  'select count(*)::text from public.daily_gut_rows
    where user_id = ''dddddddd-0000-4000-8000-000000000018''', '1');
select authz_probe.expect_value('u3.toctou.the_loader_wrote_no_wearable_row_at_all',
  'select count(*)::text from public.wearable_daily
    where user_id = ''dddddddd-0000-4000-8000-000000000018''', '0');
select authz_probe.expect_value('u3.toctou.no_run_row_survives_the_race',
  'select count(*)::text from public.nao_loader_runs
    where request_key = ''toctou-key-0000000001''', '0');
select authz_probe.expect_value('u3.toctou.nothing_was_stamped_simulated_for_this_target',
  'select count(*)::text from public.daily_gut_rows
    where user_id = ''dddddddd-0000-4000-8000-000000000018''
      and data_origin is not null', '0');
