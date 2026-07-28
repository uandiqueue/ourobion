-- R4-U3 · the loader run ledger, the input watermark, and the DERIVED publication status
-- (design §D.2, §D.1, §E.1, §E.2)
--
-- WHY RUN IDENTITY LIVES IN NEW TABLES AND NOWHERE ELSE.
-- authz_probe.colpriv_state (supabase/tests/authz/20_probe_harness.sql:174-188) enumerates every
-- column × 3 API roles × 4 privilege types for every table in `public`, and
-- 70_non_regression.sql:102-121 asserts the symmetric difference against the pre-U2 snapshot is 0
-- for every table present in that snapshot. Adding `loader_run_id` to daily_gut_rows, `run_key` to
-- insight_cards, or `demand_key` to gap_ledger would add 12 rows to colpriv_state that are absent
-- from colpriv_snapshot and fail those assertions. So: no column is added to any pre-U2 table by
-- this unit. Run identity, watermarks, leases and demand keys are new tables only.
--
-- ZERO POLICIES, RLS ON, EXPLICIT REVOKE — see 20260728030000's header for why this is required
-- rather than merely prudent.

-- ═══════════════════════════════════════════════════════════════
-- 1. NAO_LOADER_RUNS — durable idempotency + single-flight, one row per COMMITTED run
-- ═══════════════════════════════════════════════════════════════
--
-- There is deliberately no 'failed' status. The whole apply body (advisory lock → run row →
-- provenance scan → BOTH upserts → completion) runs in ONE transaction with no exception handler,
-- so a failure aborts everything: no gut rows, no wearable rows, AND no run row. "Partially
-- applied" is not a representable state, and a failed attempt leaves no trace here at all — which
-- is also what makes a retry with the SAME request_key a clean first execution (the uniqueness
-- record died with the transaction).
--
-- 'running' exists only for in-transaction bookkeeping and is UNOBSERVABLE from outside: the row
-- and the writes share a transaction, so any other session either sees nothing or sees
-- status = 'succeeded'.

create table if not exists public.nao_loader_runs (
  id               bigint generated always as identity primary key,
  -- The single-flight / idempotency key. UNIQUE is the durable half of single-flight; the
  -- transaction-scoped advisory lock in nao_loader_apply_simulated_days is the serialising half.
  -- Neither alone is sufficient: a lock serialises but does not remember (the second caller would
  -- simply execute again), and uniqueness without serialisation lets the second caller observe an
  -- in-flight row with nothing to return.
  request_key      text not null unique,
  target_user_id   uuid not null references auth.users(id) on delete cascade,
  -- auth.uid() at write time. NEVER a parameter — the loader accepts no caller-supplied identity
  -- beyond the explicit target.
  actor_user_id    uuid not null,
  origin           text not null references public.nao_simulation_origins(origin),
  plan             jsonb not null,
  -- The run's OWN footprint: exactly the dates it wrote (apply) or removed (release). Nothing but
  -- this migration's two writer RPCs ever populate it, and it is what lets residue detection
  -- (§6 below) be scoped to "dates THIS run touched" rather than every registered-simulated row for
  -- the target (independent re-review finding N1: run-scoping the verdict by request_key, without
  -- also scoping residue by date, let a LATER legitimate run's own freshly-written dates be reported
  -- as residue of an EARLIER, unrelated run).
  written_dates    date[] not null default '{}'::date[],
  watermark_before jsonb not null,
  watermark_after  jsonb,
  result           jsonb,
  status           text not null default 'running' check (status in ('running', 'succeeded')),
  -- Publication lease (§E.1). A DURABLE lease, not a held lock: a session-level lock cannot be held
  -- across the three HTTP calls the pipeline needs through a pooled PostgREST connection. Set on
  -- completion, cleared by nao_loader_record_pipeline, self-expiring so a crashed run cannot wedge
  -- a target permanently.
  lease_until      timestamptz,
  started_at       timestamptz not null default now(),
  completed_at     timestamptz
);

comment on table public.nao_loader_runs is
  'R4-U3 · one row per COMMITTED demo-loader run. The authority on what committed (nao_control_'
  'events is the authority on what was ATTEMPTED — a rolled-back run can leave an audit row and no '
  'run row, deliberately). request_key is the durable idempotency key: the same key always returns '
  'the first completed result. No ''failed'' status exists because a failure rolls the whole '
  'transaction back, this row included.';
comment on column public.nao_loader_runs.request_key is
  'Durable idempotency / single-flight key, ^[A-Za-z0-9._:-]{16,128}$. Explicit (caller-supplied) '
  'keys give replay protection across arbitrary delay; an auto-derived key collapses only the '
  'concurrent/immediate replay, because the first attempt changes the watermark it is derived from.';
comment on column public.nao_loader_runs.actor_user_id is
  'auth.uid() captured inside the definer function. Never a parameter — unspoofable attribution.';
comment on column public.nao_loader_runs.lease_until is
  'Publication lease. While it is in the future and no stage row exists, another run against the '
  'same target is refused (42501, same fixed message as every other denial). Cleared by '
  'nao_loader_record_pipeline; self-expires so a crashed run cannot wedge the target.';

create index if not exists nao_loader_runs_target_recent_idx
  on public.nao_loader_runs (target_user_id, started_at desc);

alter table public.nao_loader_runs enable row level security;
revoke all on public.nao_loader_runs from anon, authenticated;
grant select, insert, update on public.nao_loader_runs to service_role;

-- ═══════════════════════════════════════════════════════════════
-- 2. NAO_LOADER_RUN_STAGES — per-stage outcome, with the watermark observed at that moment
-- ═══════════════════════════════════════════════════════════════
--
-- THERE IS NO overall_status COLUMN, AND THAT IS THE DESIGN. A stored aggregate is precisely what a
-- later write clobbers. The aggregate is DERIVED on every read by nao_loader_status() as a maximum
-- over a total severity order (worst wins), so there is no code path that assigns a status and
-- therefore no path that can overwrite one.

create table if not exists public.nao_loader_run_stages (
  run_id           bigint not null references public.nao_loader_runs(id) on delete cascade,
  stage            text not null check (stage in
                     ('compute-baselines', 'evaluate-signals', 'generate-insights')),
  http_status      integer not null,
  ok               boolean not null,
  -- The target's watermark digest observed when THIS stage finished. If raw truth changed under the
  -- pipeline, this differs from the run's watermark_after and the fold yields 'mixed'.
  watermark_digest text not null,
  summary          jsonb not null default '{}'::jsonb,   -- redacted; never a uuid
  observed_at      timestamptz not null default now(),
  primary key (run_id, stage)
);

comment on table public.nao_loader_run_stages is
  'R4-U3 · per-stage pipeline outcome for a loader run, plus the raw-truth watermark digest observed '
  'when that stage finished. Consumed ONLY by nao_loader_status(), which derives the publication '
  'verdict as a worst-wins fold; nothing stores an aggregate. Re-recording a stage is worst-wins '
  'too: nao_loader_record_pipeline''s upsert updates only while the recorded row is still ok, so a '
  'later ok observation can never improve a recorded failure for the same stage.';

alter table public.nao_loader_run_stages enable row level security;
revoke all on public.nao_loader_run_stages from anon, authenticated;
grant select, insert, update on public.nao_loader_run_stages to service_role;

-- ═══════════════════════════════════════════════════════════════
-- 3. NAO_LOADER_ASSERT_TARGET — the five target checks, ONE fixed message, ONE implementation
-- ═══════════════════════════════════════════════════════════════
--
-- Factored out of the RPCs so the "one fixed message" property is structural rather than a
-- convention three call sites must remember. Returns the target's non-identifying label.
--
-- The five checks (design §A.3):
--   1. target is NULL                                            → deny
--   2. target = auth.uid()  (the target must be DISTINCT)         → deny
--   3. no effective public.nao_demo_targets row                   → deny
--   4. target holds an effective public.nao_members row           → deny
--   5. target absent from auth.users → implied by nao_demo_targets' FK, so there is no separate
--      probe and the function is not an existence oracle over auth.users
--
-- ONE MESSAGE FOR ALL OF THEM. Distinct messages would make the RPC an oracle over the demo roster
-- and over nao_members — exactly the property R4-U2 spent nao_authorize's single fixed string on
-- (20260728010000_nao_staff_roles.sql:163-165). Tests distinguish the cases by SETUP, not by text.
--
-- Check 4 reads public.nao_members DIRECTLY inside the definer body and never via a
-- nao_role(uuid) overload: R4-U2's contract requires nao_role() to take no arguments precisely so
-- it is impossible to ask about another user, and objects.nao_role_takes_no_arguments
-- (70_non_regression.sql:170-171) pins that. This check is what stops the loader becoming a door
-- onto another DEV's rows — which is pc_probe's whole subject.

create or replace function public.nao_loader_assert_target(p_target_user_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_label text;
begin
  if p_target_user_id is null then
    raise exception 'nao: loader target not permitted' using errcode = '42501';
  end if;

  if auth.uid() is not null and p_target_user_id = auth.uid() then
    raise exception 'nao: loader target not permitted' using errcode = '42501';
  end if;

  select t.label into v_label
    from public.nao_demo_targets t
   where t.user_id = p_target_user_id
     and t.revoked_at is null;

  if v_label is null then
    raise exception 'nao: loader target not permitted' using errcode = '42501';
  end if;

  if exists (select 1 from public.nao_members m
              where m.user_id = p_target_user_id
                and m.status = 'active'
                and m.revoked_at is null) then
    raise exception 'nao: loader target not permitted' using errcode = '42501';
  end if;

  return v_label;
end
$$;

comment on function public.nao_loader_assert_target(uuid) is
  'Raises 42501 with ONE fixed message unless p_target_user_id is a non-null, effective '
  'nao_demo_targets row that is neither the caller nor an effective nao_members holder; returns the '
  'target''s non-identifying label otherwise. One message for every denial reason so the loader '
  'cannot be used as an oracle over the demo roster or the staff roster.';

revoke execute on function public.nao_loader_assert_target(uuid) from public, anon, authenticated;
grant   execute on function public.nao_loader_assert_target(uuid) to service_role;

-- ═══════════════════════════════════════════════════════════════
-- 4. NAO_LOADER_WATERMARK — the stable INPUT watermark over the target's raw truth
-- ═══════════════════════════════════════════════════════════════
--
-- Digest over the ordered (date, provenance) pairs of BOTH truth tables plus both row counts. This
-- is exactly the state that determines (a) what planLoadRange will emit and (b) whether the write
-- is permitted, so it is the right thing for an auto-derived idempotency key to cover.
--
-- sha256(bytea) is a Postgres built-in (v11+) — no pgcrypto, no extension, so this applies on the
-- vanilla postgres:17 the `migrations-apply` CI job uses.
--
-- Honest limit (design §I.8): this is a full scan per run. Fine at demo scale (<= 60 days per
-- target); it is not a design that survives production volumes without an incremental digest.

create or replace function public.nao_loader_watermark(p_target_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with g as (
    select d.log_date as d, coalesce(d.data_origin, '<null>') as origin
      from public.daily_gut_rows d
     where d.user_id = p_target_user_id
  ), w as (
    select x.date as d, coalesce(x.source, '<null>') as origin
      from public.wearable_daily x
     where x.user_id = p_target_user_id
  )
  select jsonb_build_object(
    'gutCount',  (select count(*) from g),
    'gutMin',    (select min(d)::text from g),
    'gutMax',    (select max(d)::text from g),
    'wearCount', (select count(*) from w),
    'wearMin',   (select min(d)::text from w),
    'wearMax',   (select max(d)::text from w),
    'digest',    encode(sha256(convert_to(
                   'nao.wm.v1' || chr(31)
                   || coalesce((select string_agg(d::text || '=' || origin, chr(30) order by d)
                                  from g), '')
                   || chr(31)
                   || coalesce((select string_agg(d::text || '=' || origin, chr(30) order by d)
                                  from w), '')
                   || chr(31)
                   || (select count(*) from g)::text || ':' || (select count(*) from w)::text,
                   'UTF8')), 'hex')
  )
$$;

comment on function public.nao_loader_watermark(uuid) is
  'R4-U3 · the stable INPUT watermark for one target: {gutCount, gutMin, gutMax, wearCount, '
  'wearMin, wearMax, digest}, where digest is a sha256 over the ordered (date, provenance) pairs of '
  'both truth tables plus both counts. Covers exactly the state that determines the generated '
  'payload and whether the write is permitted. service_role EXECUTE only — an authenticated caller '
  'reaches it solely through the gated loader RPCs, so it is never an oracle over another user''s '
  'raw truth.';

revoke execute on function public.nao_loader_watermark(uuid) from public, anon, authenticated;
grant   execute on function public.nao_loader_watermark(uuid) to service_role;

-- ═══════════════════════════════════════════════════════════════
-- 5. NAO_LOADER_PLAN_INPUTS — the GATED read the route plans from
-- ═══════════════════════════════════════════════════════════════
--
-- nao_loader_watermark above is a bare definer read with no authorization check of its own, and it is
-- granted to service_role ONLY — deliberately, because granting it to `authenticated` would turn it
-- into an oracle over ANY user's log dates and provenance markers, which is exactly the cross-user
-- exposure R4-U2 closed. This is the wrapper that adds the gate: nao_authorize('curator'), then the
-- demo-target registry, then the same watermark document plus the target's non-identifying label.
--
-- The route needs it because the caller's own cookie-bound client cannot see the TARGET's rows at
-- all: daily_gut_rows / wearable_daily RLS is `auth.uid() = user_id` and Invariant P forbids changing
-- it. So both the planner's "existing range" (over BOTH tables, which is what stops a wearable-only
-- day being invisible to planning) and the auto-derived idempotency key's watermark digest have to
-- come through a definer read — a GATED one.
--
-- Returns the watermark document verbatim, so there is exactly ONE watermark shape in the system, plus
-- `targetLabel`. Never the target's uuid.

create or replace function public.nao_loader_plan_inputs(p_target_user_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_label text;
begin
  perform public.nao_authorize('curator');
  v_label := public.nao_loader_assert_target(p_target_user_id);
  return public.nao_loader_watermark(p_target_user_id)
         || jsonb_build_object('targetLabel', v_label);
end
$$;

comment on function public.nao_loader_plan_inputs(uuid) is
  'R4-U3 · the GATED watermark read the nao loader route plans from: nao_authorize(''curator'') then '
  'the demo-target registry, returning nao_loader_watermark''s document plus the target''s label. '
  'Exists so nao_loader_watermark itself never has to be granted to authenticated, where it would be '
  'an oracle over any user''s log dates and provenance markers. Denials use the same fixed messages '
  'as the loader, so it is not an oracle over the demo roster either.';

revoke execute on function public.nao_loader_plan_inputs(uuid) from public, anon;
grant   execute on function public.nao_loader_plan_inputs(uuid) to authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════
-- 6. NAO_LOADER_STATUS — the publication verdict, DERIVED by a worst-wins fold
-- ═══════════════════════════════════════════════════════════════
--
--   severity 4  failed      any stage row has ok = false
--   severity 3  mixed       any stage row's watermark_digest <> run.watermark_after->>'digest'
--   severity 2  incomplete  1 or 2 of the 3 stage rows present
--   severity 1  pending     run row present, zero stage rows
--   severity 0  published   all 3 present, all ok, all digests equal
--
-- One SQL expression (greatest() over case terms), so `failed` outranks `mixed` outranks
-- `incomplete` and NO ordering of stage-row arrivals can produce `published` unless every condition
-- holds simultaneously.
--
-- Also returns the two repair inputs of design §F: `protected` (dates whose provenance is absent or
-- unregistered — the rows the loader will refuse to touch) and `residue` (dates whose provenance IS
-- registered simulation but whose row was modified after the run that wrote it, i.e. the Biotope
-- write-over-a-simulated-date case U3 can detect and repair but not prevent — design §B.5/§I.3).
--
-- ── RESIDUE IS SCOPED TO THE RUN'S OWN DATES, FOR THE RUN-SCOPED QUESTION ONLY (re-review finding
--    N1) ────────────────────────────────────────────────────────────────────────────────────────
-- Run-scoping the VERDICT by request_key (F3, above) did not, by itself, scope RESIDUE by date: the
-- original fix compared every registered-simulated row for the TARGET against v_run.completed_at,
-- so a LATER, entirely legitimate run's own freshly-written days (never touched by the NAMED run)
-- were reported as that run's residue. §F's repair table tells an operator to hand residue dates to
-- nao_loader_release_simulated_days — which would then delete the newer run's good data.
--
-- The fix (below) restricts residue to `v_run.written_dates` ONLY when p_request_key is given —
-- i.e. only for "how did MY (possibly non-latest) run go?". The target-scoped question ("what is
-- this target's state?", p_request_key null) always resolves v_run to the target's LATEST run by
-- construction, so nothing chronologically after it can leak in from another run — there is no N1
-- exposure there. Date-scoping THAT branch too would be a regression in the other direction:
-- consecutive runs for one target legitimately touch different, non-overlapping dates (an apply,
-- then a release of a subset of it), so reducing "the target's current state" to only the very
-- latest run's own dates would make the target-scoped view blind to residue an intervening direct
-- Biotope write left on a date an EARLIER run (still registered-simulated) touched.
--
-- ── RUN-SCOPED, NOT MERELY TARGET-SCOPED (independent review finding F3) ─────────────────────────
-- There are TWO questions here and they need different answers:
--
--   "how did MY run go?"           → nao_loader_status(target, request_key)
--   "what is this target's state?"  → nao_loader_status(target)   ⇒ the target's LATEST run
--
-- Resolving the first question with the second is a real defect, not a nicety. An over-running
-- pipeline (design §E.1) is exactly the case where the two diverge: run A's lease expires, run B
-- commits new raw truth for the same target, and only THEN does A's pipeline report its stages. A
-- target-scoped lookup answers about B — so A's raced run reports `pending` (severity 1, LOWER than
-- `incomplete`) instead of `mixed` (severity 3), and the returned `requestKey` is not the caller's.
-- `nao_loader_record_pipeline` therefore passes ITS key through, and the two-argument form below is
-- the authority; the one-argument form is a thin delegation so every existing target-scoped caller
-- and grant keeps working unchanged.

create or replace function public.nao_loader_status(p_target_user_id uuid, p_request_key text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_label     text;
  v_run       public.nao_loader_runs;
  v_stages    integer;
  v_severity  integer;
  v_status    text;
  v_protected date[];
  v_residue   date[];
begin
  perform public.nao_authorize('curator');
  v_label := public.nao_loader_assert_target(p_target_user_id);

  if p_request_key is null then
    -- Target-scoped: the most recent run, which is the right answer to "what is this target's
    -- state?" and the wrong answer to "how did my run go?".
    select r.* into v_run
      from public.nao_loader_runs r
     where r.target_user_id = p_target_user_id
     order by r.started_at desc, r.id desc
     limit 1;
  else
    -- RUN-scoped. The target is re-asserted above and matched here too, so a key belonging to
    -- another target cannot be used to read across the registry.
    select r.* into v_run
      from public.nao_loader_runs r
     where r.request_key = p_request_key
       and r.target_user_id = p_target_user_id;
    if v_run.id is null then
      raise exception 'nao: loader run not found for that request key' using errcode = '22023';
    end if;
  end if;

  select coalesce(array_agg(d order by d), '{}'::date[]) into v_protected from (
    select g.log_date as d
      from public.daily_gut_rows g
     where g.user_id = p_target_user_id
       and (g.data_origin is null
            or not exists (select 1 from public.nao_simulation_origins o
                            where o.origin = g.data_origin
                              and o.revoked_at is null and o.is_simulated))
    union
    select w.date
      from public.wearable_daily w
     where w.user_id = p_target_user_id
       and (w.source is null
            or not exists (select 1 from public.nao_simulation_origins o
                            where o.origin = w.source
                              and o.revoked_at is null and o.is_simulated))
  ) p;

  if v_run.id is null then
    return jsonb_build_object(
      'targetLabel', v_label,
      'status', 'absent',
      'severity', 1,
      'stagesRecorded', 0,
      'protectedDateCount', coalesce(array_length(v_protected, 1), 0),
      'protectedDates', to_jsonb(v_protected),
      'residueDateCount', 0,
      'residueDates', to_jsonb('{}'::date[]));
  end if;

  select count(*) into v_stages
    from public.nao_loader_run_stages s where s.run_id = v_run.id;

  v_severity := greatest(
    case when exists (select 1 from public.nao_loader_run_stages s
                       where s.run_id = v_run.id and not s.ok) then 4 else 0 end,
    case when exists (select 1 from public.nao_loader_run_stages s
                       where s.run_id = v_run.id
                         and s.watermark_digest
                             is distinct from (v_run.watermark_after->>'digest')) then 3 else 0 end,
    case when v_stages between 1 and 2 then 2 else 0 end,
    case when v_stages = 0 then 1 else 0 end,
    0);

  v_status := case v_severity
                when 4 then 'failed'
                when 3 then 'mixed'
                when 2 then 'incomplete'
                when 1 then 'pending'
                else        'published'
              end;

  -- Residue: registered-simulated provenance, but the row moved after the run that wrote it.
  --
  -- Date-scoping (N1) applies ONLY to the RUN-SCOPED question (p_request_key given), because that
  -- is the only case a NAMED run can be a NON-latest run for its target — exactly the interleaving
  -- N1 reproduced: run A (named by key) queried while run B, chronologically later, has since
  -- written fresh, unrelated dates. Restricting to v_run.written_dates confines A's own answer to
  -- A's own footprint.
  --
  -- The TARGET-SCOPED question (p_request_key null) already resolves v_run to the target's LATEST
  -- run by construction, so nothing chronologically after v_run can exist to leak in — there is no
  -- N1 exposure here. Date-scoping this branch too would be actively wrong: consecutive runs for
  -- the same target legitimately touch DIFFERENT, non-overlapping dates (an apply, then a release of
  -- a subset of it), so "the target's current state" cannot be reduced to only the very latest run's
  -- own dates without going blind to residue that an intervening direct Biotope write left on a date
  -- an EARLIER run (still registered-simulated) touched.
  select coalesce(array_agg(d order by d), '{}'::date[]) into v_residue from (
    select g.log_date as d
      from public.daily_gut_rows g
     where g.user_id = p_target_user_id
       and (p_request_key is null or g.log_date = any (v_run.written_dates))
       and g.data_origin is not null
       and exists (select 1 from public.nao_simulation_origins o
                    where o.origin = g.data_origin
                      and o.revoked_at is null and o.is_simulated)
       and v_run.completed_at is not null
       and g.updated_at > v_run.completed_at
    union
    select w.date
      from public.wearable_daily w
     where w.user_id = p_target_user_id
       and (p_request_key is null or w.date = any (v_run.written_dates))
       and w.source is not null
       and exists (select 1 from public.nao_simulation_origins o
                    where o.origin = w.source
                      and o.revoked_at is null and o.is_simulated)
       and v_run.completed_at is not null
       and w.synced_at > v_run.completed_at
  ) x;

  return jsonb_build_object(
    'targetLabel', v_label,
    'status', v_status,
    'severity', v_severity,
    'stagesRecorded', v_stages,
    'runStatus', v_run.status,
    'requestKey', v_run.request_key,
    'origin', v_run.origin,
    'leaseActive', (v_run.lease_until is not null and v_run.lease_until > now()),
    'watermarkAfter', v_run.watermark_after->>'digest',
    'protectedDateCount', coalesce(array_length(v_protected, 1), 0),
    'protectedDates', to_jsonb(v_protected),
    'residueDateCount', coalesce(array_length(v_residue, 1), 0),
    'residueDates', to_jsonb(v_residue));
end
$$;

comment on function public.nao_loader_status(uuid, text) is
  'R4-U3 · the DERIVED publication verdict for ONE loader run, identified by its request key (the '
  'run-scoped authority — see this migration''s §6 header for why a target-scoped answer is wrong '
  'for an over-running pipeline). Passing NULL for the key falls back to the target''s most recent '
  'run. Folded worst-wins over the run''s own stage rows; nothing is stored.';

revoke execute on function public.nao_loader_status(uuid, text) from public, anon;
grant   execute on function public.nao_loader_status(uuid, text) to authenticated, service_role;

-- The one-argument form: unchanged behaviour (the target's latest run), expressed as a delegation so
-- there is exactly ONE fold implementation. It is its own SECURITY DEFINER with its own pinned
-- search_path, so the object-shape assertions that enumerate it by signature stay true; the gate and
-- the target check run inside the delegate, as its first two statements.
create or replace function public.nao_loader_status(p_target_user_id uuid)
returns jsonb
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  select public.nao_loader_status(p_target_user_id, null::text)
$$;

comment on function public.nao_loader_status(uuid) is
  'R4-U3 · the DERIVED publication verdict for a target''s most recent loader run, folded worst-wins '
  'over the stage rows (failed > mixed > incomplete > pending > published) so no arrival order can '
  'report published over a partial pipeline, and no write can clobber a stored aggregate — there is '
  'no stored aggregate. Also returns the two repair inputs: protected dates (the loader will refuse '
  'to touch them) and residue dates (registered-simulated provenance on a row that moved after the '
  'run wrote it). Gated by nao_authorize(''curator'') then by the target registry; returns the '
  'target''s label, never its uuid.';

revoke execute on function public.nao_loader_status(uuid) from public, anon;
grant   execute on function public.nao_loader_status(uuid) to authenticated, service_role;
