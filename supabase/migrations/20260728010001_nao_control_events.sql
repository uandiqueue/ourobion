-- R4-U2 · nao_control_events — the append-only, unspoofably-attributed control-action log.
--
-- Every nao action that changes policy, money, or the corpus/pipeline records exactly one row
-- here. Two properties are load-bearing, and each is enforced by MORE THAN ONE mechanism so that
-- defeating one lock is not enough:
--
--   APPEND-ONLY   — (1) UPDATE/DELETE/TRUNCATE are revoked from anon, authenticated and
--                   service_role, so the whole API surface gets a hard 42501; (2) BEFORE
--                   UPDATE/DELETE row triggers and a BEFORE TRUNCATE statement trigger raise,
--                   which also covers the TABLE OWNER and superuser paths where grants do not
--                   apply; (3) no UPDATE or DELETE policy exists at all.
--                   Why all three: with only RLS, an UPDATE matching no policy affects ZERO ROWS
--                   SILENTLY and looks like success. A raise is unambiguous. And TRUNCATE never
--                   fires row triggers, so it needs its own statement-level trigger.
--
--   ATTRIBUTED    — a BEFORE INSERT trigger OVERWRITES actor_user_id with auth.uid() and
--                   actor_role with public.nao_role(). Whatever the client sends is discarded, so
--                   there is no field to lie in. The column DEFAULT is auth.uid() as well, but a
--                   default alone would be spoofable simply by supplying a value — hence the
--                   overwrite. The RLS INSERT policy redundantly asserts
--                   `actor_user_id = auth.uid()`, so forging would require defeating the trigger
--                   AND the policy.
--
-- auth.uid() is NULL for both `anon` and `service_role`, so the trigger REJECTS every
-- unattributed insert — not even the service key can record an action as somebody else. Accepted
-- consequence: the edge functions cannot write control events. They are not control actions.
--
-- READ ACCESS IS admin-ONLY. Curators write events they cannot read back, which is the correct
-- shape for an audit log and is also the one place where curator identity legitimately lives
-- after 20260728010002 revokes the identity columns elsewhere.
--
-- THE WRITER: recordControlEvent() in apps/nao/src/lib/authzServer.ts, called by every mutating
-- nao route handler (claims/reject, ingest-control POST, ingest-control/trigger, loader POST,
-- loader/run-pipeline POST, models/caps POST, seeds POST, seeds PATCH — one handler per `action`
-- value in the CHECK below). A source-conformance test in apps/nao/tests/authz.test.ts walks the
-- route files and fails if a mutating handler does not record an event, so "the table exists but
-- nothing writes to it" cannot regress silently.
--
-- `detail` MUST NEVER CONTAIN A SECRET. It carries a redacted request summary only;
-- recordControlEvent() passes both `detail` and `target` through the same redaction as a response
-- body (redactDeep / redactText in apps/nao/src/lib/authz.ts) before insert. Nothing in the
-- database can enforce that, so it is stated here as the contract it is.
--
-- FK NOTE: actor_user_id references auth.users(id) with NO ACTION (the contract's shape, and
-- correct for an audit log — an audit row pins its actor). Deleting an auth.users row that has
-- recorded control events therefore fails until those rows are archived by an operator. That is
-- deliberate: the alternative (cascade) would let account deletion erase the audit trail.

-- ═══════════════════════════════════════════════════════════════
-- 1. TABLE
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.nao_control_events (
  id            bigint generated always as identity primary key,
  occurred_at   timestamptz not null default now(),
  -- Defaulted AND trigger-overwritten (see header): the default is a convenience, the trigger is
  -- the guarantee.
  actor_user_id uuid not null default auth.uid() references auth.users(id),
  actor_role    text not null,                 -- captured at write time, not looked up on read
  action        text not null check (action in (
                  'ingest_control.patch',
                  'ingest.trigger',
                  'seeds.add',
                  'seeds.toggle',
                  'models.cap_override',
                  'claims.reject',
                  'loader.simulate',
                  'pipeline.run'
                )),
  target        text,                          -- node id / seed slug / edge id — never a uuid
  detail        jsonb not null default '{}'::jsonb
);

comment on table public.nao_control_events is
  'R4-U2 · append-only, attributed log of nao control actions. Append-only via revoked '
  'UPDATE/DELETE/TRUNCATE grants + raising triggers + absent policies (three independent locks). '
  'Attribution is unspoofable: a BEFORE INSERT trigger overwrites actor_user_id with auth.uid() '
  'and actor_role with public.nao_role(), and rejects any insert where auth.uid() is null (so '
  'neither anon nor service_role can record an action). Written by curator+, readable by admin '
  'only.';
comment on column public.nao_control_events.actor_user_id is
  'The acting human. Trigger-OVERWRITTEN from auth.uid() — a client-supplied value is discarded, '
  'so the audit trail cannot be forged.';
comment on column public.nao_control_events.actor_role is
  'The actor''s effective nao role AT ACTION TIME (trigger-stamped from public.nao_role()). '
  'Snapshotted rather than joined, so a later role change never rewrites history.';
comment on column public.nao_control_events.action is
  'Closed set. Adding an action needs a migration by design — an audit log with an open '
  'vocabulary cannot be reviewed.';
comment on column public.nao_control_events.target is
  'Human-meaningful subject of the action (node id, seed slug, edge id). NEVER a user uuid.';
comment on column public.nao_control_events.detail is
  'Redacted request summary. MUST NEVER CONTAIN A SECRET or a raw identity: the response layer '
  'passes every payload through redactDeep() before insert. Not database-enforceable — this '
  'comment is the contract.';

-- The only read shape: newest-first, optionally per actor (admin console audit view).
create index if not exists nao_control_events_occurred_at_idx
  on public.nao_control_events (occurred_at desc, id desc);

-- ═══════════════════════════════════════════════════════════════
-- 2. ATTRIBUTION — overwrite, never merely default
-- ═══════════════════════════════════════════════════════════════

create or replace function public.nao_stamp_control_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- OVERWRITE, not coalesce: any client-supplied actor is discarded outright.
  new.actor_user_id := auth.uid();
  if new.actor_user_id is null then
    -- anon and service_role both land here: an unattributed control action does not exist.
    raise exception 'nao_control_events requires an authenticated actor'
      using errcode = '42501';
  end if;

  new.actor_role := public.nao_role();
  if new.actor_role is null then
    raise exception 'nao_control_events requires an effective nao membership'
      using errcode = '42501';
  end if;

  new.occurred_at := now();
  return new;
end
$$;

comment on function public.nao_stamp_control_event() is
  'BEFORE INSERT stamp for nao_control_events: overwrites actor_user_id from auth.uid() and '
  'actor_role from public.nao_role(), and raises 42501 when either is null. Runs before NOT NULL '
  'and before the RLS WITH CHECK, so the policy sees the stamped row.';

create trigger nao_control_events_stamp
  before insert on public.nao_control_events
  for each row execute function public.nao_stamp_control_event();

-- ═══════════════════════════════════════════════════════════════
-- 3. APPEND-ONLY — grants AND triggers (see header for why both)
-- ═══════════════════════════════════════════════════════════════

create or replace function public.nao_control_events_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception 'nao_control_events is append-only' using errcode = 'P0001';
end
$$;

comment on function public.nao_control_events_append_only() is
  'Raises P0001 on any UPDATE/DELETE/TRUNCATE of nao_control_events. Covers the table-owner and '
  'superuser paths, where the revoked grants do not apply.';

create trigger nao_control_events_no_update
  before update on public.nao_control_events
  for each row execute function public.nao_control_events_append_only();

create trigger nao_control_events_no_delete
  before delete on public.nao_control_events
  for each row execute function public.nao_control_events_append_only();

-- TRUNCATE never fires row-level triggers, hence FOR EACH STATEMENT.
create trigger nao_control_events_no_truncate
  before truncate on public.nao_control_events
  for each statement execute function public.nao_control_events_append_only();

-- ═══════════════════════════════════════════════════════════════
-- 4. RLS + GRANTS
-- ═══════════════════════════════════════════════════════════════

alter table public.nao_control_events enable row level security;

-- curator+ may record. The actor_user_id equality is redundant after the stamp trigger and is
-- kept as the second lock.
create policy "nao curators can record control events"
  on public.nao_control_events for insert
  to authenticated
  with check (public.nao_has_role('curator') and actor_user_id = auth.uid());

-- admin-only read: the audit log is where curator identity legitimately lives.
create policy "nao admins can read control events"
  on public.nao_control_events for select
  to authenticated
  using (public.nao_has_role('admin'));

-- No UPDATE/DELETE policy on purpose (lock 3 of 3).

-- Lock 1 of 3: strip the mutating privileges from every API-reachable role. Supabase's default
-- privileges grant ALL on new public tables to anon/authenticated/service_role, so this revoke
-- is what actually removes them.
revoke all on public.nao_control_events from anon, authenticated, service_role;
grant select, insert on public.nao_control_events to authenticated;
grant select, insert on public.nao_control_events to service_role;
-- anon gets nothing at all.
