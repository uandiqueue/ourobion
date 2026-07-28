-- R4-U3 · the atomic demo loader (design §A, §B.3, §C, §D.2) — one transaction, or nothing.
--
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- WHY A SECURITY DEFINER RPC PRESERVES R4-U2's pc_probe — the four independent reasons
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- pc_probe (supabase/tests/authz/60_assertions.sql:166-199, invoked 6× at :657-672 = 48 assertions)
-- proves no nao tier can write ANOTHER user's daily_gut_rows / wearable_daily. This file adds a
-- capability that writes another user's rows. All 48 assertions still pass verbatim, because:
--
--   1. DIFFERENT PATH. pc_probe's first four statements are DIRECT table statements executed under
--      `set local role authenticated`; they are denied by the `auth.uid() = user_id` policies on the
--      two tables. This unit changes no policy, adds no policy, and changes no grant — so their
--      evaluation is bit-identical. A definer function is a THIRD path pc_probe never invokes.
--   2. pc_probe's last four statements are RLS-BLIND BY CONSTRUCTION. They count rows
--      `where user_id = <target>` while running as a different user, so the select policy filters
--      them to zero whether or not the target's rows exist. They cannot be tripped by data.
--   3. NO FORCE RLS anywhere in supabase/ or ci/, and the two tables are owned by the migration
--      role — so a definer function owned by that role writes any user_id with NO policy change at
--      all. That is what lets this RPC satisfy O26 while keeping R4-U2's Invariant P intact: this
--      unit creates no policy, drops none, and changes no grant on either truth table.
--   4. NO RESTRICTIVE POLICY IS ADDED, so nonreg.zero_restrictive_policies_on_daily_gut_rows,
--      …_on_wearable_daily, nonreg.exactly_ten_restrictive_policies_added and
--      nonreg.new_permissive_policies_only_on_the_two_new_tables are untouched. The silent-failure
--      mode Invariant P exists to stop (an invisible conflict target, a zero-row DO UPDATE, no
--      error) cannot arise because the mechanism that causes it is never used — and the row-count
--      assertion after each upsert is a second, independent guard against that same shape.
--
-- Likewise no CHECK on data_origin/source (it would break four expect_ok assertions in pa/pb_probe
-- and, through pb_probe, nonreg.pb_probe_identical_pre_and_post) and no trigger on either table (it
-- would change the literal values the `…_took_effect` assertions pin). Provenance is enforced at
-- this writer, against the 20260728030000 registries.
--
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- THE TRANSACTION BOUNDARY, EXACTLY (design §C.1)
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- PostgREST executes each request — an RPC call included — inside exactly one transaction
-- (`begin; set local …; <statement>; commit;` — the shape 20_probe_harness.sql:7-22 documents and
-- relies on). A single `select public.nao_loader_apply_simulated_days(…)` is therefore one statement
-- in one transaction, and the advisory lock, the run row, the provenance scan, BOTH upserts and the
-- completion update all execute inside it. Nothing in the body opens, commits or closes a
-- transaction, and THERE IS NO `exception` BLOCK ANYWHERE IN IT — deliberately, so that any failure
-- (constraint violation, row-count raise, serialization failure, statement_timeout, backend crash)
-- propagates to the top and rolls everything back, run row included. A failed run therefore leaves
-- NO TRACE, and a retry with the same request_key is a clean first execution because the uniqueness
-- record died with the transaction.
--
-- The one deliberate exception to "no trace": recordControlEvent runs in the nao route BEFORE the
-- RPC and is a separate, best-effort transaction, so an audit row can exist for a run that rolled
-- back. That is correct and intended — nao_control_events records ATTEMPTS BY AN ACTOR,
-- nao_loader_runs records WHAT COMMITTED.
--
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- WHAT THE ADVISORY LOCK CANNOT COVER, AND WHERE THE GUARANTEE ACTUALLY LIVES
-- (independent review finding F1 — this was a real, reproduced raw-truth integrity failure)
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- pg_advisory_xact_lock serialises LOADER CALLERS AGAINST EACH OTHER. It does not — and cannot —
-- exclude the TARGET's own ordinary RLS-governed writes through PostgREST, which take no such lock.
-- So the pre-write provenance scan at step 8 is a snapshot read that a concurrent Biotope write can
-- slip past: the target commits a real row (data_origin IS NULL) after the scan's statement
-- snapshot, the loader's INSERT blocks on the (user_id, log_date) unique index, the other
-- transaction commits, and the loader's insert then takes its ON CONFLICT branch on a row the scan
-- never saw. With an unconditional DO UPDATE that silently destroyed a user's self-report and
-- re-stamped it as simulated, returning ok:true.
--
-- "PRECEDES" IS NOT "CONDITIONS". The fix is therefore AT WRITE TIME, in the ON CONFLICT DO UPDATE
-- clause itself: both upserts carry a WHERE predicate that restricts the update to rows whose
-- EXISTING provenance is a registered, non-revoked, is_simulated origin. A row with NULL or
-- non-simulated provenance is not updated by the upsert AT ALL, whatever any earlier snapshot
-- showed. The skipped rows are then detected by counting what the statement actually wrote
-- (RETURNING, not `get diagnostics` — see step 9) and the whole transaction is failed with the same
-- OU409 the scan would have raised, so the caller sees the identical mutation-free refusal. The
-- pre-scan REMAINS, as a fast path that gives a better error earlier and covers both tables before
-- either is touched — but the WHERE predicate is the authority.
--
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- ISOLATION LEVEL: THIS FUNCTION ASSUMES READ COMMITTED (the PostgreSQL default)
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- Two behaviours depend on each statement inside plpgsql taking a FRESH snapshot:
--
--   * step 4b's authoritative read. Under READ COMMITTED the loser of a single-flight race acquires
--     the advisory lock only after the winner committed, and then SEES the winner's run row, so it
--     replays. Under REPEATABLE READ the snapshot is pinned before the lock is taken, the loser
--     never sees that row, and its insert raises 40001 (could not serialize access) instead.
--   * step 9/10's post-conflict re-scan, which must see the row the loader just blocked on.
--
-- Nothing in supabase/ or ci/ sets a non-default isolation level, so this is a stated assumption
-- rather than a live bug. It is not silent: apps/nao/src/lib/loaderRuns.ts maps 40001 and 40P01
-- (deadlock) to a RETRYABLE 503 rather than a 500, so a stricter isolation level degrades to "retry
-- this request" instead of to an opaque server fault.

-- ═══════════════════════════════════════════════════════════════
-- 1. NAO_LOADER_APPLY_SIMULATED_DAYS — the atomic write
-- ═══════════════════════════════════════════════════════════════
--
-- p_days is generated in TypeScript (apps/nao/src/lib/simulatedHealth.ts) on purpose: that module's
-- seeded FNV-1a + mulberry32 determinism is what makes repeated loads byte-identical, and
-- re-implementing it in PL/pgSQL would create a second truth for row content whose drift would be
-- invisible. So the route GENERATES and this function VALIDATES AND WRITES.
--
-- Shape: [{ "date": "YYYY-MM-DD", "gut": {…SimulatedGutRow…}, "wearable": {…SimulatedWearableRow…} }]
-- Either side may be absent (that is how a half-loaded day from the pre-U3 two-upsert path heals).
-- The row's user_id and provenance are set HERE, from p_target_user_id and p_origin; any user_id,
-- id, created_at or data_origin/source inside the payload is ignored by construction, because the
-- insert's select list never reads them.

create or replace function public.nao_loader_apply_simulated_days(
  p_target_user_id uuid,      -- REQUIRED, no DEFAULT: omitting it is a 42883 resolution failure,
                              -- never a silent fallback to auth.uid()
  p_request_key    text,      -- durable idempotency / single-flight key
  p_origin         text,      -- must be a registered, non-revoked, is_simulated origin
  p_plan           jsonb,     -- {seed, scenario, anchorDate, daysRequested, segments}
  p_days           jsonb      -- the generated payload (above)
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_label            text;
  v_dates            date[];
  v_day_count        integer;
  v_gut_expected     integer;
  v_wear_expected    integer;
  v_protected        integer;
  v_run_id           bigint;
  v_existing         public.nao_loader_runs;
  v_watermark_before jsonb;
  v_watermark_after  jsonb;
  v_result           jsonb;
  v_n                integer;
  v_skipped          integer;
  v_lease            timestamptz;
begin
  -- ── 1 · R4-U2's OWN GATE, verbatim. Not a parallel authorization concept. ──────────────────
  -- public.nao_authorize('curator') delegates to nao_has_role → nao_role() → the nao_members read,
  -- and raises 'nao: access denied' / 42501 (→ HTTP 403) with ONE fixed message for every denial
  -- reason, so this RPC inherits R4-U2's non-oracle property. No role is invented, no tier, no
  -- second membership concept, and no JWT claim is read. An ordinary Biotope user has no
  -- nao_members row ⇒ nao_role() is NULL ⇒ this raises, with no new code path.
  perform public.nao_authorize('curator');

  -- ── 2 · Payload shape. Every violation is 23514 (→ HTTP 400), never a partial write. ────────
  if p_request_key is null or p_request_key !~ '^[A-Za-z0-9._:-]{16,128}$' then
    raise exception 'nao: loader request key is malformed' using errcode = '23514';
  end if;

  -- Fail closed on an unknown or retired marker: only a registered, non-revoked, is_simulated
  -- origin THAT IS LOADER-WRITABLE may be WRITTEN. A typo ('simulated:run4-demoo') is unregistered
  -- and therefore refused — the property an open text column never had.
  --
  -- loader_writable is a SEPARATE predicate from is_simulated on purpose (review finding F9).
  -- p_origin is caller-supplied, and 'seed:baseline' is a registered is_simulated marker owned by
  -- R4-U2's authz fixture — is_simulated alone let a curator stamp another harness's provenance
  -- onto a demo target's raw truth, making U2's fixture rows indistinguishable from loader output.
  -- "may a row bearing this be overwritten" and "may THIS loader author it" are different
  -- questions; the registry answers them with different columns.
  if p_origin is null or not exists (
       select 1 from public.nao_simulation_origins o
        where o.origin = p_origin and o.revoked_at is null
          and o.is_simulated and o.loader_writable) then
    raise exception 'nao: loader origin is not a registered simulation origin'
      using errcode = '23514';
  end if;

  if p_plan is null or jsonb_typeof(p_plan) <> 'object' then
    raise exception 'nao: loader plan must be a json object' using errcode = '23514';
  end if;

  if p_days is null or jsonb_typeof(p_days) <> 'array' or jsonb_array_length(p_days) = 0 then
    raise exception 'nao: loader payload must be a non-empty json array' using errcode = '23514';
  end if;

  -- MAX_LOAD_DAYS (apps/nao/src/lib/simulatedHealth.ts).
  if jsonb_array_length(p_days) > 60 then
    raise exception 'nao: loader payload exceeds the 60-day cap' using errcode = '23514';
  end if;

  if exists (
       select 1 from jsonb_array_elements(p_days) d
        where jsonb_typeof(d.value) <> 'object'
           or d.value->>'date' is null
           or d.value->>'date' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
           or not (d.value ? 'gut' or d.value ? 'wearable')
           or (d.value ? 'gut'      and jsonb_typeof(d.value->'gut')      <> 'object')
           or (d.value ? 'wearable' and jsonb_typeof(d.value->'wearable') <> 'object')) then
    raise exception 'nao: loader payload day is malformed' using errcode = '23514';
  end if;

  v_day_count := jsonb_array_length(p_days);

  select array_agg(distinct (d.value->>'date')::date) into v_dates
    from jsonb_array_elements(p_days) d;

  -- Contiguity is never assumed — holes in the requested range are ordinary. Duplicates are not:
  -- two entries for one date would make the row-count assertion below ambiguous.
  if coalesce(array_length(v_dates, 1), 0) <> v_day_count then
    raise exception 'nao: loader payload contains duplicate dates' using errcode = '23514';
  end if;

  select count(*) filter (where d.value ? 'gut'),
         count(*) filter (where d.value ? 'wearable')
    into v_gut_expected, v_wear_expected
    from jsonb_array_elements(p_days) d;

  -- ── 3 · Target validation — five checks, ONE fixed message (see 20260728030001). ───────────
  v_label := public.nao_loader_assert_target(p_target_user_id);

  -- ── 4 · Single-flight, half one: SERIALISE. Transaction-scoped, so it releases on commit and
  --        cannot leak if the backend dies mid-run (a session-level lock could, under PostgREST's
  --        pooled connections). ────────────────────────────────────────────────────────────────
  perform pg_advisory_xact_lock(hashtextextended('nao.loader:' || p_target_user_id::text, 0));

  -- ── 4b · Single-flight, half two: REMEMBER. Once the lock is held, any concurrent run against
  --         this target has already committed or rolled back, so this read is authoritative. A
  --         committed row for the same key ⇒ replay: return the identical stored result. The second
  --         concurrent caller therefore NEVER observes a 'running' state and never writes. ──────
  select r.* into v_existing
    from public.nao_loader_runs r where r.request_key = p_request_key;
  if v_existing.id is not null then
    if v_existing.target_user_id <> p_target_user_id or v_existing.origin <> p_origin then
      -- Key reuse across targets/origins is a caller bug, not a replay. 22023 → HTTP 400.
      raise exception 'nao: loader request key reused for a different target or origin'
        using errcode = '22023';
    end if;
    return coalesce(v_existing.result, '{}'::jsonb) || jsonb_build_object('replayed', true);
  end if;

  -- ── 5 · Publication lease (design §E.1). Refuse a NEW run while the target's most recent run
  --        still holds an unexpired lease and has recorded no pipeline stage — otherwise a second
  --        load could commit under the first run's in-flight pipeline. Same fixed 42501 message as
  --        every other denial. A replay was already returned above, so a legitimate retry of the
  --        SAME key is never blocked here. ─────────────────────────────────────────────────────
  select r.lease_until into v_lease
    from public.nao_loader_runs r
   where r.target_user_id = p_target_user_id
     and r.lease_until is not null
     and r.lease_until > now()
     and not exists (select 1 from public.nao_loader_run_stages s where s.run_id = r.id)
   order by r.started_at desc, r.id desc
   limit 1;
  if v_lease is not null then
    raise exception 'nao: loader target not permitted' using errcode = '42501';
  end if;

  -- ── 6 · The input watermark, read AFTER the lock, so a run that follows another sees post-commit
  --        truth and its plan is computed from it. No interleaving. ──────────────────────────────
  v_watermark_before := public.nao_loader_watermark(p_target_user_id);

  -- ── 7 · The run row. `on conflict do nothing` is a race backstop only (the lock already made the
  --        read at 4b authoritative); it matters when two DIFFERENT targets share a request key. ─
  insert into public.nao_loader_runs
    (request_key, target_user_id, actor_user_id, origin, plan, watermark_before, status)
  values (p_request_key, p_target_user_id, auth.uid(), p_origin, p_plan, v_watermark_before,
          'running')
  on conflict (request_key) do nothing
  returning id into v_run_id;

  if v_run_id is null then
    select r.* into v_existing
      from public.nao_loader_runs r where r.request_key = p_request_key;
    if v_existing.target_user_id <> p_target_user_id or v_existing.origin <> p_origin then
      raise exception 'nao: loader request key reused for a different target or origin'
        using errcode = '22023';
    end if;
    return coalesce(v_existing.result, '{}'::jsonb) || jsonb_build_object('replayed', true);
  end if;

  -- ── 8 · PROVENANCE CONFLICT SCAN — the FAST PATH, not the guarantee. ──────────────────────
  -- A row is PROTECTED iff its provenance is absent (NULL = real user-entered data, the semantics
  -- 20260724120000 declared) or is not a registered, non-revoked, is_simulated origin. A protected
  -- row is NEVER overwritten and NEVER merged: the whole request is refused.
  --
  -- This scan runs BEFORE either write so that the common case refuses earlier, with both tables
  -- considered together and a single count in the error detail. It is NOT what makes the refusal
  -- safe: "precedes" is not "conditions", and a concurrent RLS-governed write by the target itself
  -- takes no advisory lock and can commit after this statement's snapshot (see this file's F1
  -- header). The authority is the WHERE predicate on each DO UPDATE branch at steps 9 and 10.
  --
  -- Both tables are scanned INDEPENDENTLY, so a date protected on only one side still refuses the
  -- whole request — which is what makes gut-only and wearable-only history safe.
  select count(*) into v_protected from (
    select g.log_date as d
      from public.daily_gut_rows g
     where g.user_id = p_target_user_id
       and g.log_date = any (v_dates)
       and (g.data_origin is null
            or not exists (select 1 from public.nao_simulation_origins o
                            where o.origin = g.data_origin
                              and o.revoked_at is null and o.is_simulated))
    union
    select w.date
      from public.wearable_daily w
     where w.user_id = p_target_user_id
       and w.date = any (v_dates)
       and (w.source is null
            or not exists (select 1 from public.nao_simulation_origins o
                            where o.origin = w.source
                              and o.revoked_at is null and o.is_simulated))
  ) p;

  if v_protected > 0 then
    -- OU409 is a custom SQLSTATE so a conflict is machine-distinguishable from an authorization
    -- denial (42501) and a payload error (23514). The nao route maps OU409 → 409. Honest limit
    -- (design §I.5): PostgREST does not know OU409, so a DIRECT PostgREST caller sees 500. No
    -- mutation occurred either way.
    raise exception 'nao: loader refuses to overwrite rows that are not registered simulation'
      using errcode = 'OU409',
            detail   = format('%s protected date(s)', v_protected);   -- counts, never a date list
  end if;

  -- ── 9 · Gut rows. THE WRITE-TIME GUARANTEE LIVES HERE. ────────────────────────────────────
  -- The DO UPDATE branch is CONDITIONAL on the EXISTING row's provenance being a registered,
  -- non-revoked, is_simulated origin. A real row (data_origin IS NULL), or one bearing an
  -- unregistered / revoked / non-simulated marker, is NOT UPDATED AT ALL — whenever it committed,
  -- including after step 8's scan and including a row this statement had to wait on at the unique
  -- index. That is the atomic form of "never overwrite real rows"; step 8 is only an early exit.
  --
  -- The written count comes from RETURNING rather than `get diagnostics row_count`, because the
  -- diagnostic cannot distinguish "inserted", "updated" and "conflicted but skipped by the
  -- predicate" — it is the measure that made the original defect invisible. Counting the rows the
  -- statement actually emitted does distinguish them: a skipped row emits nothing.
  with src as (
    select (d.value->>'date')::date                                            as the_date,
           jsonb_populate_record(null::public.daily_gut_rows, d.value->'gut')   as r
      from jsonb_array_elements(p_days) d
     where d.value ? 'gut'
  ), written as (
  insert into public.daily_gut_rows (
    user_id, log_date, region, urine_colour, stool_form, stool_count, stool_variability,
    outside_meals, mosquito_bites, energy_score, mood_score, gut_comfort_score, symptom_flags,
    notes, standing_water_present, on_antibiotics, gut_watch_active, log_completeness,
    data_origin, updated_at)
  select p_target_user_id,
         s.the_date,
         coalesce((s.r).region, ''),
         (s.r).urine_colour,
         (s.r).stool_form,
         (s.r).stool_count,
         coalesce((s.r).stool_variability, 0),
         (s.r).outside_meals,
         (s.r).mosquito_bites,
         (s.r).energy_score,
         (s.r).mood_score,
         (s.r).gut_comfort_score,
         coalesce((s.r).symptom_flags, '{}'::text[]),
         (s.r).notes,
         (s.r).standing_water_present,
         coalesce((s.r).on_antibiotics, false),
         coalesce((s.r).gut_watch_active, false),
         coalesce((s.r).log_completeness, 0),
         p_origin,
         now()
    from src s
  on conflict (user_id, log_date) do update set
    region                 = excluded.region,
    urine_colour           = excluded.urine_colour,
    stool_form             = excluded.stool_form,
    stool_count            = excluded.stool_count,
    stool_variability      = excluded.stool_variability,
    outside_meals          = excluded.outside_meals,
    mosquito_bites         = excluded.mosquito_bites,
    energy_score           = excluded.energy_score,
    mood_score             = excluded.mood_score,
    gut_comfort_score      = excluded.gut_comfort_score,
    symptom_flags          = excluded.symptom_flags,
    notes                  = excluded.notes,
    standing_water_present = excluded.standing_water_present,
    on_antibiotics         = excluded.on_antibiotics,
    gut_watch_active       = excluded.gut_watch_active,
    log_completeness       = excluded.log_completeness,
    data_origin            = excluded.data_origin,
    updated_at             = now()
  -- ↓↓ THE GUARD. Update only a row that is provably registered simulation. ↓↓
  where daily_gut_rows.data_origin is not null
    and exists (select 1 from public.nao_simulation_origins o
                 where o.origin = daily_gut_rows.data_origin
                   and o.revoked_at is null and o.is_simulated)
  returning 1 as one
  )
  select count(*) into v_n from written;

  -- A shortfall has exactly two possible causes and they get different SQLSTATEs:
  --
  --   * the write-time guard refused a protected row (the F1 race, or anything else that put a real
  --     row on a requested date) ⇒ the SAME OU409 refusal step 8 raises, so the caller cannot tell
  --     whether the scan or the predicate caught it, and no row and no run row survives; or
  --   * the SILENT-ZERO shape R4-U2's Invariant P warns about — a restrictive policy makes an
  --     upsert's conflict target invisible and its update branch affect zero rows WITHOUT raising.
  --     This unit adds no restrictive policy, so that cause is absent today; 22023 keeps any FUTURE
  --     cause of that shape a loud failure rather than an ok:true over an empty database.
  --
  -- The re-scan is what tells them apart, and it is correct to read it here: the conflicting row is
  -- committed by now (this statement waited on it), so it is visible to a fresh statement snapshot.
  if v_n <> v_gut_expected then
    select count(*) into v_skipped
      from public.daily_gut_rows g
     where g.user_id = p_target_user_id
       and g.log_date = any (v_dates)
       and (g.data_origin is null
            or not exists (select 1 from public.nao_simulation_origins o
                            where o.origin = g.data_origin
                              and o.revoked_at is null and o.is_simulated));
    if v_skipped > 0 then
      raise exception 'nao: loader refuses to overwrite rows that are not registered simulation'
        using errcode = 'OU409',
              detail   = format('%s protected date(s)', v_skipped);  -- counts, never a date list
    end if;
    raise exception 'nao: loader gut upsert affected % row(s), expected %', v_n, v_gut_expected
      using errcode = '22023';
  end if;

  -- ── 10 · Wearable rows. Second statement, SAME transaction — a failure here cannot leave step 9
  --         committed, and step 11 never runs, so no run row survives either. Same write-time guard
  --         as step 9, over `source` instead of `data_origin`: the two tables are guarded
  --         INDEPENDENTLY, so a real row on only one side still refuses the whole request. ──────
  with src as (
    select (d.value->>'date')::date                                                as the_date,
           jsonb_populate_record(null::public.wearable_daily, d.value->'wearable')  as r
      from jsonb_array_elements(p_days) d
     where d.value ? 'wearable'
  ), written as (
  insert into public.wearable_daily (
    user_id, date, resting_hr_bpm, hrv_sdnn_ms, sleep_duration_min, spo2_pct, body_temp_c,
    step_count, source, synced_at)
  select p_target_user_id,
         s.the_date,
         (s.r).resting_hr_bpm,
         (s.r).hrv_sdnn_ms,
         (s.r).sleep_duration_min,
         (s.r).spo2_pct,
         (s.r).body_temp_c,
         (s.r).step_count,
         p_origin,
         now()
    from src s
  on conflict (user_id, date) do update set
    resting_hr_bpm     = excluded.resting_hr_bpm,
    hrv_sdnn_ms        = excluded.hrv_sdnn_ms,
    sleep_duration_min = excluded.sleep_duration_min,
    spo2_pct           = excluded.spo2_pct,
    body_temp_c        = excluded.body_temp_c,
    step_count         = excluded.step_count,
    source             = excluded.source,
    synced_at          = now()
  where wearable_daily.source is not null
    and exists (select 1 from public.nao_simulation_origins o
                 where o.origin = wearable_daily.source
                   and o.revoked_at is null and o.is_simulated)
  returning 1 as one
  )
  select count(*) into v_n from written;

  if v_n <> v_wear_expected then
    select count(*) into v_skipped
      from public.wearable_daily w
     where w.user_id = p_target_user_id
       and w.date = any (v_dates)
       and (w.source is null
            or not exists (select 1 from public.nao_simulation_origins o
                            where o.origin = w.source
                              and o.revoked_at is null and o.is_simulated));
    if v_skipped > 0 then
      raise exception 'nao: loader refuses to overwrite rows that are not registered simulation'
        using errcode = 'OU409',
              detail   = format('%s protected date(s)', v_skipped);
    end if;
    raise exception 'nao: loader wearable upsert affected % row(s), expected %', v_n, v_wear_expected
      using errcode = '22023';
  end if;

  -- ── 11 · Complete the run and open the publication lease. ─────────────────────────────────
  v_watermark_after := public.nao_loader_watermark(p_target_user_id);

  -- The response carries the target's LABEL and never its uuid: apps/nao/src/lib/authz.ts's
  -- redactDeep drops user_id/userId keys at any depth and redactText scrubs uuid-shaped substrings
  -- from every string, so returning a uuid would either be stripped (leaving a confusing hole) or,
  -- if named around the deny-list, be an actual regression of R4-U2's finding 1.
  v_result := jsonb_build_object(
    'ok',                  true,
    'replayed',            false,
    'targetLabel',         v_label,
    'origin',              p_origin,
    'requestKey',          p_request_key,
    'loadedDays',          v_day_count,
    'gutRowsWritten',      v_gut_expected,
    'wearableRowsWritten', v_wear_expected,
    'firstDate',           v_dates[1]::text,
    'lastDate',            v_dates[array_length(v_dates, 1)]::text,
    'plan',                p_plan,
    'watermarkBefore',     v_watermark_before->>'digest',
    'watermarkAfter',      v_watermark_after->>'digest');

  update public.nao_loader_runs set
    status          = 'succeeded',
    watermark_after = v_watermark_after,
    result          = v_result,
    completed_at    = now(),
    lease_until     = now() + interval '5 minutes'
   where id = v_run_id;

  return v_result;
end
$$;

comment on function public.nao_loader_apply_simulated_days(uuid, text, text, jsonb, jsonb) is
  'R4-U3 · the atomic demo loader (O26). Gated by public.nao_authorize(''curator'') as its first '
  'statement, then by the demo-target registry (one fixed 42501 message for all five denial '
  'reasons, so it is not an oracle). Refuses any date whose existing gut or wearable provenance is '
  'absent or unregistered (OU409, no mutation) — enforced AT WRITE TIME by a WHERE predicate on '
  'each ON CONFLICT DO UPDATE branch, not merely by the scan that precedes them, so a row committed '
  'concurrently by the target''s own RLS-governed write (which takes no advisory lock) is refused '
  'too. Writes BOTH truth tables in ONE transaction with no '
  'exception handler, so a failure leaves no rows and no run row — "partially applied" is '
  'unrepresentable. Single-flight = unique request_key + pg_advisory_xact_lock: the second '
  'concurrent caller sees a COMMITTED row and returns the identical result, never a ''running'' '
  'state. Accepts no caller-supplied identity beyond the explicit target.';

revoke execute on function
  public.nao_loader_apply_simulated_days(uuid, text, text, jsonb, jsonb) from public, anon;
grant execute on function
  public.nao_loader_apply_simulated_days(uuid, text, text, jsonb, jsonb)
  to authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════
-- 2. NAO_LOADER_RELEASE_SIMULATED_DAYS — removal, never relabelling (design §B.5)
-- ═══════════════════════════════════════════════════════════════
--
-- RULE: simulated data is never converted to real. It is REMOVED, and only then may real input
-- occupy the date. Nulling data_origin while leaving the generated numbers would produce the worst
-- possible artefact — synthetic values labelled as real self-report, permanently indistinguishable.
--
-- Mirror of the conflict rule: it refuses unless EVERY row it is about to remove is provably
-- registered simulation, so it can never delete a real row. Neither truth table has a delete policy
-- for authenticated — irrelevant, because a definer bypasses RLS and the owner holds DELETE. No
-- grant or policy change (Invariant P intact).

create or replace function public.nao_loader_release_simulated_days(
  p_target_user_id uuid,
  p_dates          date[]
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_label            text;
  v_protected        integer;
  v_gut_removed      integer;
  v_wear_removed     integer;
  v_watermark_before jsonb;
  v_watermark_after  jsonb;
  v_result           jsonb;
  v_key              text;
  v_lease            timestamptz;
begin
  perform public.nao_authorize('curator');

  if p_dates is null or coalesce(array_length(p_dates, 1), 0) = 0 then
    raise exception 'nao: loader release requires at least one date' using errcode = '23514';
  end if;
  if array_length(p_dates, 1) > 60 then
    raise exception 'nao: loader release exceeds the 60-day cap' using errcode = '23514';
  end if;

  v_label := public.nao_loader_assert_target(p_target_user_id);

  perform pg_advisory_xact_lock(hashtextextended('nao.loader:' || p_target_user_id::text, 0));

  -- PUBLICATION LEASE — the SAME step-5 preamble the apply path runs (design §B.5: "same preamble
  -- as §A.2 steps 1-5"). It was missing here, and the omission was strictly worse than the one the
  -- lease exists to stop: the apply path OVERWRITES under an in-flight pipeline, this path DELETES.
  -- A repair must not remove raw truth from under a pipeline that is still reading it. There is no
  -- replay short-circuit above this, so unlike the apply path every release is subject to it.
  select r.lease_until into v_lease
    from public.nao_loader_runs r
   where r.target_user_id = p_target_user_id
     and r.lease_until is not null
     and r.lease_until > now()
     and not exists (select 1 from public.nao_loader_run_stages s where s.run_id = r.id)
   order by r.started_at desc, r.id desc
   limit 1;
  if v_lease is not null then
    raise exception 'nao: loader target not permitted' using errcode = '42501';
  end if;

  select count(*) into v_protected from (
    select g.log_date as d
      from public.daily_gut_rows g
     where g.user_id = p_target_user_id
       and g.log_date = any (p_dates)
       and (g.data_origin is null
            or not exists (select 1 from public.nao_simulation_origins o
                            where o.origin = g.data_origin
                              and o.revoked_at is null and o.is_simulated))
    union
    select w.date
      from public.wearable_daily w
     where w.user_id = p_target_user_id
       and w.date = any (p_dates)
       and (w.source is null
            or not exists (select 1 from public.nao_simulation_origins o
                            where o.origin = w.source
                              and o.revoked_at is null and o.is_simulated))
  ) p;

  if v_protected > 0 then
    raise exception 'nao: loader release refuses to remove rows that are not registered simulation'
      using errcode = 'OU409',
            detail   = format('%s protected date(s)', v_protected);
  end if;

  v_watermark_before := public.nao_loader_watermark(p_target_user_id);

  delete from public.daily_gut_rows g
   where g.user_id = p_target_user_id
     and g.log_date = any (p_dates)
     and g.data_origin is not null
     and exists (select 1 from public.nao_simulation_origins o
                  where o.origin = g.data_origin
                    and o.revoked_at is null and o.is_simulated);
  get diagnostics v_gut_removed = row_count;

  delete from public.wearable_daily w
   where w.user_id = p_target_user_id
     and w.date = any (p_dates)
     and w.source is not null
     and exists (select 1 from public.nao_simulation_origins o
                  where o.origin = w.source
                    and o.revoked_at is null and o.is_simulated);
  get diagnostics v_wear_removed = row_count;

  v_watermark_after := public.nao_loader_watermark(p_target_user_id);

  v_result := jsonb_build_object(
    'ok',              true,
    'targetLabel',     v_label,
    'datesRequested',  array_length(p_dates, 1),
    'gutRowsRemoved',  v_gut_removed,
    'wearableRowsRemoved', v_wear_removed,
    'watermarkBefore', v_watermark_before->>'digest',
    'watermarkAfter',  v_watermark_after->>'digest');

  -- Record the release on the run ledger. `release:run4-demo` is registered with
  -- is_simulated = false, so it satisfies the origin FK while remaining unwritable as row
  -- provenance. The key is a digest, never a uuid, so the ledger row carries no identity.
  v_key := 'release.' || substr(encode(sha256(convert_to(
             p_target_user_id::text || chr(31) || clock_timestamp()::text || chr(31)
             || array_to_string(p_dates, ','), 'UTF8')), 'hex'), 1, 40);

  insert into public.nao_loader_runs
    (request_key, target_user_id, actor_user_id, origin, plan, watermark_before, watermark_after,
     result, status, completed_at)
  values (v_key, p_target_user_id, auth.uid(), 'release:run4-demo',
          jsonb_build_object('kind', 'release', 'dates', to_jsonb(p_dates)),
          v_watermark_before, v_watermark_after, v_result, 'succeeded', now());

  return v_result;
end
$$;

comment on function public.nao_loader_release_simulated_days(uuid, date[]) is
  'R4-U3 · the repair path: removes simulated rows for a target on the given dates, in ONE '
  'transaction across both truth tables, refusing outright if ANY row on those dates is not provably '
  'registered simulation — so it can never delete a real row. Simulated data is never relabelled as '
  'real; it is removed, and only then may real input occupy the date. Same gate, same target '
  'registry, same advisory lock and same publication-lease refusal as the loader, so a repair '
  'cannot delete raw truth from under an in-flight pipeline.';

revoke execute on function public.nao_loader_release_simulated_days(uuid, date[]) from public, anon;
grant execute on function public.nao_loader_release_simulated_days(uuid, date[])
  to authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════
-- 3. NAO_LOADER_RECORD_PIPELINE — record the stage outcomes, clear the lease
-- ═══════════════════════════════════════════════════════════════
--
-- Called by the nao route AFTER the pipeline returns, once per run. p_stages is
--   [{ "stage": "compute-baselines"|"evaluate-signals"|"generate-insights",
--      "httpStatus": <int>, "ok": <bool>, "summary": {…redacted…} }]
-- Each stage row records the target's watermark digest AS OBSERVED NOW, which is what lets
-- nao_loader_status() detect a run whose raw truth changed under the pipeline ('mixed') rather than
-- merely hoping the lease held. Returns the derived status, so the caller never assigns one.

create or replace function public.nao_loader_record_pipeline(
  p_request_key text,
  p_stages      jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_run    public.nao_loader_runs;
  v_digest text;
begin
  perform public.nao_authorize('curator');

  if p_request_key is null or p_request_key !~ '^[A-Za-z0-9._:-]{16,128}$' then
    raise exception 'nao: loader request key is malformed' using errcode = '23514';
  end if;
  if p_stages is null or jsonb_typeof(p_stages) <> 'array' or jsonb_array_length(p_stages) = 0 then
    raise exception 'nao: loader stage payload must be a non-empty json array'
      using errcode = '23514';
  end if;
  if exists (select 1 from jsonb_array_elements(p_stages) s
              where jsonb_typeof(s.value) <> 'object'
                 or s.value->>'stage' is null
                 or s.value->>'httpStatus' is null
                 or s.value->>'ok' is null) then
    raise exception 'nao: loader stage entry is malformed' using errcode = '23514';
  end if;

  select r.* into v_run
    from public.nao_loader_runs r where r.request_key = p_request_key;
  if v_run.id is null then
    raise exception 'nao: loader run not found for that request key' using errcode = '22023';
  end if;

  -- Re-validate the target through the same gate, so recording stages cannot be used to reach a
  -- revoked target or a target that has since become a nao member.
  perform public.nao_loader_assert_target(v_run.target_user_id);

  v_digest := public.nao_loader_watermark(v_run.target_user_id)->>'digest';

  insert into public.nao_loader_run_stages
    (run_id, stage, http_status, ok, watermark_digest, summary)
  select v_run.id,
         s.value->>'stage',
         (s.value->>'httpStatus')::integer,
         (s.value->>'ok')::boolean,
         v_digest,
         coalesce(s.value->'summary', '{}'::jsonb)
    from jsonb_array_elements(p_stages) s
  -- WORST-WINS PER STAGE, ACROSS CALLS (review finding F5). The update branch applies only while
  -- the ALREADY RECORDED observation is ok, so a later ok can never improve a recorded failure for
  -- the SAME stage — which is what 20260728030001's "no code path can overwrite a status" and
  -- apps/nao/src/lib/loaderRuns.ts's "a not-ok observation is never replaced by a later ok one"
  -- both claim, and what a plain last-write-wins upsert made false the moment a stage was
  -- re-recorded. Worsening is still allowed (ok ⇒ not ok, and a moved digest over an ok row), so
  -- the recorded history can only ever get more pessimistic. A skipped update is not an error: the
  -- derived fold already reports the worse, recorded outcome.
  on conflict (run_id, stage) do update set
    http_status      = excluded.http_status,
    ok               = excluded.ok,
    watermark_digest = excluded.watermark_digest,
    summary          = excluded.summary,
    observed_at      = now()
  where nao_loader_run_stages.ok;

  -- The lease exists to keep a second load out while THIS run's pipeline is in flight. It is done.
  update public.nao_loader_runs set lease_until = null where id = v_run.id;

  -- RUN-SCOPED (review finding F3). The verdict answers about THE RUN THIS CALLER NAMED, not about
  -- whatever run happens to be the target's most recent — those differ in exactly the case the
  -- lease exists for: an over-running pipeline whose lease expired and under which a second run
  -- already committed. A target-scoped answer reported that raced run as `pending` (severity 1,
  -- lower than `incomplete`) and handed back somebody else's `requestKey`.
  --
  -- `observedDigest` is the digest stamped on the stage rows just now. It is returned so the relay
  -- route's own fold has a real observation to compare against `watermarkAfter`, instead of passing
  -- null and leaving its watermark term permanently unreachable (review finding F10).
  return public.nao_loader_status(v_run.target_user_id, p_request_key)
         || jsonb_build_object('observedDigest', v_digest);
end
$$;

comment on function public.nao_loader_record_pipeline(text, jsonb) is
  'R4-U3 · records the three pipeline stage outcomes for a loader run (stamping each with the '
  'target''s watermark digest observed at that moment, worst-wins so a later ok cannot improve a '
  'recorded failure for the same stage), clears the publication lease, and returns the DERIVED '
  'status of THAT RUN from nao_loader_status(target, request_key) plus the digest it observed. The '
  'caller never assigns a status.';

revoke execute on function public.nao_loader_record_pipeline(text, jsonb) from public, anon;
grant execute on function public.nao_loader_record_pipeline(text, jsonb)
  to authenticated, service_role;
