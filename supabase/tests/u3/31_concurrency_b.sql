-- supabase/tests/u3/31_concurrency_b.sql — CALLER B of the concurrent single-flight probe.
--
-- Starts two seconds after A, with the SAME request key against the SAME target. It blocks on A's
-- transaction-scoped advisory lock inside the RPC, and only proceeds once A has committed — at which
-- point the run row for that key is COMMITTED and B returns it verbatim.
--
-- The lock is what makes this deterministic: without it B could read A's uncommitted row (see
-- nothing), insert its own, and execute a second time. Without the unique key, the lock alone would
-- merely delay a second execution rather than prevent it.

set authz_probe.phase = 'u3';

select pg_sleep(2);

begin;
  set local request.jwt.claims = '{"sub": "cccccccc-0000-4000-8000-000000000002", "role": "authenticated"}';
  set local role authenticated;
  select authz_probe.u3_capture_jsonb('concurrent.b',
    authz_probe.u3_apply_sql('dddddddd-0000-4000-8000-000000000006', 'u3-conc-key-000000001',
                             authz_probe.u3_days(date '2026-07-01', 6)));
commit;
