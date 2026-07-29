-- supabase/tests/u3/33_toctou_a.sql — THE LOADER, in the TOCTOU race. See 32_toctou_b.sql's header
-- for the full interleaving and for why B's wait (rather than a sleep) is what makes this probe
-- non-vacuous.
--
-- A is the curator. It starts 1.5 s after B, by which time B holds an UNCOMMITTED real row on
-- 2026-07-03 — a date inside A's requested range. So:
--
--   · the two captures below are consecutive statements, microseconds apart;
--   · the first records what the target's raw truth looks like to A RIGHT NOW, through the same
--     gated definer read the route plans from. It must report zero rows: B is uncommitted, so its
--     row is invisible to A, and therefore invisible to the loader's own pre-write scan;
--   · the second is the loader. Its scan passes, its insert blocks, B commits, and its ON CONFLICT
--     branch then meets a REAL row that no snapshot it ever took could see.
--
-- Before the fix that is an `ok: true` and a destroyed self-report. After it, the DO UPDATE branch
-- refuses the row, the written count falls short of the intended day count, and the whole
-- transaction fails with OU409 — the identical mutation-free refusal the scan would have given.
--
-- The error is captured (u3_capture_jsonb catches into {sqlstate, message} in a subtransaction) so
-- 40_late_assertions.sql can assert on it as the superuser. The subtransaction rollback is also
-- what undoes A's three writable rows, which is asserted too.

set authz_probe.phase = 'u3';

-- Harness-only (re-review finding N2): opts THIS session in to the RAISE DEBUG markers the apply
-- function emits at each refusal site, so run.mjs can tell from this session's stderr whether the
-- pre-scan or the write-time guard is what actually refused. Below the ordinary client default
-- ('notice'), so no real API caller is affected by the migration carrying these markers.
set client_min_messages = debug1;

select pg_sleep(1.5);

begin;
  set local request.jwt.claims = '{"sub": "cccccccc-0000-4000-8000-000000000002", "role": "authenticated"}';
  set local role authenticated;

  select authz_probe.u3_capture_jsonb('toctou.a_sees_before_applying',
    'select public.nao_loader_plan_inputs(''dddddddd-0000-4000-8000-000000000018''::uuid)');

  select authz_probe.u3_capture_jsonb('toctou.a',
    authz_probe.u3_apply_sql('dddddddd-0000-4000-8000-000000000018', 'toctou-key-0000000001',
                             authz_probe.u3_days(date '2026-07-01', 4)));
commit;
