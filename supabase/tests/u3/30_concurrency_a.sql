-- supabase/tests/u3/30_concurrency_a.sql — CALLER A of the concurrent single-flight probe.
--
-- Driven by run.mjs as one of two parallel psql children. A opens a transaction, calls the loader,
-- and then HOLDS the transaction open for six seconds before committing. Because
-- pg_advisory_xact_lock is transaction-scoped, B (which starts two seconds later with the SAME
-- request key) blocks inside the RPC for the remainder — so this is a real race against a real lock,
-- not a simulated one.
--
-- What must be true when both have finished: exactly ONE execution, ONE run row, and B returning A's
-- result verbatim with replayed = true. B must never observe status = 'running'.

set authz_probe.phase = 'u3';

begin;
  set local request.jwt.claims = '{"sub": "cccccccc-0000-4000-8000-000000000002", "role": "authenticated"}';
  set local role authenticated;
  select authz_probe.u3_capture_jsonb('concurrent.a',
    authz_probe.u3_apply_sql('dddddddd-0000-4000-8000-000000000006', 'u3-conc-key-000000001',
                             authz_probe.u3_days(date '2026-07-01', 6)));
  -- Hold the advisory lock (and the uncommitted run row) while B is blocked on it.
  select pg_sleep(6);
commit;
