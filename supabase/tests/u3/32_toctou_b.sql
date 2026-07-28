-- supabase/tests/u3/32_toctou_b.sql — THE TARGET's own write, in the TOCTOU race.
--
-- This is the concurrent writer the advisory lock cannot exclude, and it is the exact interleaving
-- an independent database review reproduced against this unit: a real, user-authored row was
-- silently overwritten and re-stamped as simulated, with ok:true and no conflict raised.
--
-- B is the DEMO TARGET itself — an ordinary Biotope user writing its OWN row as `authenticated`
-- through the ordinary `auth.uid() = user_id` policy path. It takes NO advisory lock, because
-- nothing in R4-U2's policy set has any reason to, and R4-U2's Invariant P forbids changing that.
-- That is precisely why `pg_advisory_xact_lock('nao.loader:<target>')` — which serialises loader
-- callers against each other — cannot cover this case, and why the guarantee has to live in the
-- ON CONFLICT DO UPDATE clause instead of in the scan that precedes it.
--
-- THE ORDERING, AND WHY IT IS A SYNCHRONISATION AND NOT A SLEEP:
--
--   B  insert the real row for 2026-07-03, uncommitted, transaction held open
--   A  (33_toctou_a.sql, 1.5 s later) calls the loader over 2026-07-01..04
--      · the pre-write provenance scan cannot see B's row → it PASSES
--      · the gut insert BLOCKS on the (user_id, log_date) unique index
--   B  observes that some other backend now holds an ungranted lock, and only then COMMITS
--   A  unblocks, reaches its ON CONFLICT branch on B's now-committed REAL row
--
-- B's wait is what makes the probe non-vacuous. If B simply slept and happened to commit first, the
-- ordinary pre-scan would refuse and the assertions would pass without ever exercising the
-- write-time guard. `u3.toctou.the_loader_was_blocked_before_the_row_committed` asserts the wait
-- really observed the block.

set authz_probe.phase = 'u3';

begin;
  set local request.jwt.claims = '{"sub": "dddddddd-0000-4000-8000-000000000018", "role": "authenticated"}';
  set local role authenticated;

  -- A REAL self-report: data_origin IS NULL, which 20260724120000 declared to mean user-entered.
  insert into public.daily_gut_rows
    (user_id, log_date, region, energy_score, mood_score, gut_comfort_score, notes, data_origin)
  values (auth.uid(), date '2026-07-03', 'REAL-REGION', 5, 5, 5,
          'user-authored real self-report', null);

  -- The byte-identity baseline, taken from INSIDE this transaction: the row exactly as its owner
  -- wrote it, at the only moment no loader could possibly have reached it. md5 over the whole row's
  -- text form, so ANY column moving — updated_at included — changes the digest.
  insert into authz_probe.u3_baseline (tag, digest)
  select 'toctou_real_gut', md5(g::text) from public.daily_gut_rows g
   where g.user_id = auth.uid() and g.log_date = date '2026-07-03'
  on conflict (tag) do update set digest = excluded.digest;

  -- Hold until the loader is demonstrably parked on our uncommitted row, then commit.
  select authz_probe.u3_capture_jsonb('toctou.b_observed_the_block',
    'select jsonb_build_object(''blocked'', authz_probe.u3_wait_for_a_blocked_backend(30))');
commit;
