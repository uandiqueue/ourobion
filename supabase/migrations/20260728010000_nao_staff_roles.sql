-- R4-U2 · nao staff roles — the "ourobion dev" scope, expressed as a membership row.
--
-- WHY THIS EXISTS (design §A.0). User auth is sliced into exactly two scopes inside ONE
-- Supabase auth pool:
--   * Biotope user  — an auth.users row with NO public.nao_members row. Biotope access only.
--   * Ourobion dev  — an auth.users row WITH an effective public.nao_members row. nao + Biotope.
-- So membership IS the nao scope: it is the single bit that grants any nao access at all. There
-- is no second auth project and no second user table; the shared auth pool stays physically
-- intact. viewer / curator / admin are capability TIERS inside the nao scope, never three kinds
-- of person and never a second identity system — a dev's Biotope identity, Biotope data and
-- Biotope access are wholly unaffected by which tier they hold, and no tier appears in any
-- Biotope-facing policy.
--
-- WHAT MEMBERSHIP DOES NOT GRANT (design §B.4). No role gains cross-user data authority. This
-- migration adds no policy to any per-user table and widens no `auth.uid() = user_id` predicate.
-- An admin cannot read or write another user's daily_gut_rows, wearable_daily, profiles,
-- insight_cards or any other per-user table — including another dev's rows. Asserted in
-- supabase/tests/authz (assertions P-a / P-b / P-c).
--
-- EFFECTIVE MEMBERSHIP = `status = 'active' AND revoked_at IS NULL`. Three independent kill
-- switches, in increasing permanence: suspend (temporary), revoke (permanent, keeps the audit
-- row), delete the row (cascades from auth.users too). Each is proven to deny in the harness.
--
-- PROVISIONING IS service_role ONLY. There is deliberately NO insert/update/delete policy for
-- `authenticated`, and the corresponding table grants are revoked from `authenticated` as well,
-- so no self-service signup or self-promotion path exists at any layer.
--
-- THE ROLE IS NEVER READ FROM A JWT CLAIM (design §A.4). Every decision below reads the
-- membership row through public.nao_role(), which reads this table. A claim is stale for the
-- token's lifetime (~1h, silently refreshed) and forgeable in the threat model, so a revoked
-- admin would keep admin power until the next refresh. A table read is revocation-immediate.
-- The harness proves a forged `user_role: "admin"` claim grants nothing.

-- ═══════════════════════════════════════════════════════════════
-- 1. NAO_MEMBERS — the membership row (the whole nao scope)
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.nao_members (
  -- user_id is BOTH the primary key and the FK to auth.users: one membership per account, and
  -- `on delete cascade` makes deleting the auth user remove nao access atomically.
  user_id    uuid primary key references auth.users(id) on delete cascade,
  role       text not null check (role in ('viewer', 'curator', 'admin')),
  status     text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Non-null ⇒ NO access, regardless of `status`. Kept (never deleted) so the audit trail of
  -- "this account once had nao access" survives revocation.
  revoked_at timestamptz
);

comment on table public.nao_members is
  'R4-U2 · the ourobion-dev scope as data. A row here (status = ''active'' and revoked_at is '
  'null) is the ONLY thing that grants nao access; an auth.users row without one is a '
  'Biotope-only user with zero nao access. Provisioned by service_role only (no insert/update/'
  'delete policy and no write grant for authenticated). role is a capability TIER inside nao '
  '(viewer < curator < admin), never cross-user data authority — see design §B.4.';
comment on column public.nao_members.role is
  'Capability tier inside the nao scope: viewer (read the console) < curator (operate the '
  'corpus/pipeline) < admin (policy and money; read the control-event audit log). A higher tier '
  'satisfies a lower requirement (public.nao_has_role).';
comment on column public.nao_members.status is
  '''suspended'' is the TEMPORARY kill switch — access stops immediately, the row stays.';
comment on column public.nao_members.revoked_at is
  'PERMANENT kill switch. Non-null ⇒ no access regardless of status; the row is kept for audit.';

-- The only lookup shape that exists: "is THIS uid effective?". Partial index so the hot path
-- (public.nao_role) is an index-only probe over active rows.
create index if not exists nao_members_effective_idx
  on public.nao_members (user_id)
  where status = 'active' and revoked_at is null;

-- ═══════════════════════════════════════════════════════════════
-- 2. ROLE RESOLUTION — three functions, no caller-supplied identity
-- ═══════════════════════════════════════════════════════════════

-- Rank ordering. viewer < curator < admin; anything unrecognised ranks 0 so an unknown value
-- can never satisfy a requirement (fail closed). Pure — not a definer.
create or replace function public.nao_role_rank(p_role text)
returns smallint
language sql
immutable
set search_path = public, pg_temp
as $$
  select case p_role
           when 'viewer'  then 10::smallint
           when 'curator' then 20::smallint
           when 'admin'   then 30::smallint
           else 0::smallint
         end
$$;

comment on function public.nao_role_rank(text) is
  'Total order over the nao capability tiers (viewer 10 < curator 20 < admin 30). Unrecognised '
  'input ranks 0 and therefore satisfies nothing — fail closed.';

-- The caller's effective role, or NULL when the caller has no effective membership.
--
-- Takes NO ARGUMENTS on purpose: it must be impossible to ask this function about another user.
-- SECURITY DEFINER because `authenticated` has no read path to another member's row — the
-- function reads public.nao_members as its owner (which is also the table owner, so RLS on
-- nao_members is bypassed inside it; that is what makes the nao_members SELECT policy below
-- able to call nao_has_role without recursing).
create or replace function public.nao_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.role
  from public.nao_members m
  where m.user_id = auth.uid()
    and m.status = 'active'
    and m.revoked_at is null
$$;

comment on function public.nao_role() is
  'The CALLER''s effective nao role (''viewer''|''curator''|''admin''), or NULL when the caller '
  'has no effective membership (no row, suspended, or revoked). Zero arguments by design: there '
  'is no way to ask about another user. Read fresh from the table on every call — never from a '
  'JWT claim, so suspension/revocation takes effect on the caller''s very next statement.';

-- true iff the caller's effective role satisfies `required` under viewer < curator < admin.
-- RAISES on an unrecognised `required` — a typo must never silently deny (which would look like
-- a working gate) nor silently allow.
create or replace function public.nao_has_role(required text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  actual_role text;
begin
  if required is null or public.nao_role_rank(required) = 0 then
    raise exception 'nao_has_role: unrecognised required role %', coalesce(required, '<null>')
      using errcode = '22023';   -- invalid_parameter_value: a programming error, not a denial
  end if;

  actual_role := public.nao_role();
  if actual_role is null then
    return false;               -- no effective membership ⇒ satisfies nothing
  end if;

  return public.nao_role_rank(actual_role) >= public.nao_role_rank(required);
end
$$;

comment on function public.nao_has_role(text) is
  'The non-raising twin of nao_authorize, used inside RLS policies. true iff the caller''s '
  'effective role satisfies `required` (viewer < curator < admin; a higher tier satisfies a '
  'lower requirement). Raises 22023 on an unrecognised `required` value so a typo can never '
  'silently pass for a working gate. STABLE, so the planner evaluates it once per statement '
  'rather than once per row.';

-- The route/RPC workhorse: no-op when authorised, 42501 otherwise.
--
-- PostgREST maps SQLSTATE 42501 (insufficient_privilege) to HTTP 403, so a direct
-- POST /rest/v1/rpc/nao_authorize from a non-member is denied by the DATABASE with the same
-- status the route layer would have produced — no Next.js code involved.
--
-- ONE FIXED MESSAGE for every denial. It must not reveal whether the account exists in nao,
-- whether it is suspended, or which tier it holds; otherwise the endpoint becomes an oracle
-- over the staff roster.
create or replace function public.nao_authorize(required text)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.nao_has_role(required) then
    raise exception 'nao: access denied' using errcode = '42501';
  end if;
end
$$;

comment on function public.nao_authorize(text) is
  'Raises 42501 (→ HTTP 403 via PostgREST) unless the caller''s effective nao role satisfies '
  '`required`; no-op otherwise. The message is a single fixed string for every denial reason so '
  'the function cannot be used as an oracle over the staff roster.';

-- Functions default to EXECUTE for PUBLIC; the default privileges Supabase installs also grant
-- EXECUTE to anon directly. Both must be revoked before granting the intended set.
revoke execute on function public.nao_role_rank(text) from public, anon;
revoke execute on function public.nao_role()          from public, anon;
revoke execute on function public.nao_has_role(text)  from public, anon;
revoke execute on function public.nao_authorize(text) from public, anon;

grant execute on function public.nao_role_rank(text) to authenticated, service_role;
grant execute on function public.nao_role()          to authenticated, service_role;
grant execute on function public.nao_has_role(text)  to authenticated, service_role;
grant execute on function public.nao_authorize(text) to authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════
-- 3. RLS + GRANTS on nao_members — read-only for members, provisioned by service_role
-- ═══════════════════════════════════════════════════════════════

alter table public.nao_members enable row level security;

-- A member may see their own row (so nao can show "you are a curator"); an admin may see the
-- whole roster (the admin console's member list). No recursion: nao_has_role → nao_role is
-- SECURITY DEFINER owned by this table's owner, so it bypasses this policy.
create policy "nao members can read own row and admins the roster"
  on public.nao_members for select
  to authenticated
  using (user_id = auth.uid() or public.nao_has_role('admin'));

-- No INSERT/UPDATE/DELETE policy on purpose (design §A.2): membership is provisioned only by
-- service_role (dashboard / SQL editor / a migration seed). Belt and braces at the grant layer
-- too, because a missing policy alone makes an UPDATE affect zero rows *silently* while a
-- missing grant raises 42501.
revoke all on public.nao_members from anon, authenticated;
grant select on public.nao_members to authenticated;
grant select, insert, update, delete on public.nao_members to service_role;
