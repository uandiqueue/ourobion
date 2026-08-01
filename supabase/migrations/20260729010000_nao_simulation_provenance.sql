-- R4-U3 · simulation provenance registries (design §A.3, §B.1, §B.2)
--
-- WHY TWO REGISTRY TABLES AND NOT TWO CHECK CONSTRAINTS.
-- The obvious way to close the provenance vocabulary is a CHECK on daily_gut_rows.data_origin and
-- wearable_daily.source. That is MECHANICALLY IMPOSSIBLE here, and the reason is worth recording so
-- nobody "fixes" it later:
--
--   * supabase/tests/authz/40_pre_u2_probe.sql:46-49,63-65 inserts data_origin = 'probe:pb' and
--     source = 'probe:pb' and expects `ok`;
--   * supabase/tests/authz/60_assertions.sql:129-132,146-148 does the same with 'probe:pa';
--   * supabase/tests/authz/30_pre_u2_seed.sql seeds 'seed:baseline' into both columns;
--   * supabase/tests/authz/run.mjs:120-132,187-198 applies every migration sorting AFTER the R4-U2
--     allocation (i.e. THIS FILE) in phase 3, BEFORE 60_assertions.sql and 70_non_regression.sql
--     run — so U3's schema is live while all 443 R4-U2 assertions execute.
--
-- A closed-vocabulary CHECK therefore turns four `expect_ok` assertions into `error:23514`, and
-- because pb_probe is the one probe that runs in BOTH phases it also breaks
-- nonreg.pb_probe_identical_pre_and_post (70_non_regression.sql:155-159). A BEFORE INSERT/UPDATE
-- trigger fails for the same class of reason: the `..._took_effect` assertions pin data_origin's
-- literal value after an upsert.
--
-- So the vocabulary is closed AT THE ONE WRITER U3 OWNS
-- (public.nao_loader_apply_simulated_days), against these registries. The regex CHECK below lives
-- on the REGISTRY, where a closed vocabulary constrains nothing that already exists.
--
-- Consequence, stated honestly (design §I.2): "only registered origins appear in the column" is a
-- property of the loader, not of the database. A curator writing their OWN rows directly through
-- PostgREST can still put any string in data_origin/source — which R4-U2's Invariant P positively
-- requires.
--
-- ZERO POLICIES ON PURPOSE. 70_non_regression.sql:89-96 pins the global RESTRICTIVE policy count at
-- exactly 10 and the count of newly-added PERMISSIVE policies at exactly 3. Any policy added
-- anywhere in `public` — including on a brand-new U3 table — breaks one of those two assertions. So
-- every table below is `enable row level security` with NO policy at all, which is deny-all for
-- anon and authenticated. The explicit `revoke all` is not belt-and-braces, it is REQUIRED: the
-- harness shim (10_supabase_shim.sql:91-93) reproduces Supabase's real
-- `alter default privileges in schema public grant all on tables to anon, authenticated,
-- service_role`, so a new table arrives already granted ALL to authenticated. RLS-with-no-policy
-- would deny reads anyway, but the revoke is what makes the denial an error rather than a silent
-- zero-row result.
--
-- The only reader/writer of these tables in the request path is a SECURITY DEFINER function owned
-- by the table owner (20260729010002).

-- ═══════════════════════════════════════════════════════════════
-- 1. NAO_SIMULATION_ORIGINS — the closed provenance vocabulary, as data
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.nao_simulation_origins (
  origin       text primary key check (origin ~ '^[a-z][a-z0-9]*:[A-Za-z0-9._-]{1,48}$'),
  label        text not null,
  -- false ⇒ the marker is RECOGNISED but does not denote simulated data, so a row bearing it is
  -- PROTECTED (never overwritten) and the marker can never be written as row provenance.
  is_simulated boolean not null default true,
  -- false ⇒ the marker belongs to ANOTHER writer (another harness, another unit), so the demo
  -- loader may not STAMP it — even when is_simulated is true. `is_simulated` answers "may a row
  -- bearing this be overwritten"; `loader_writable` answers "may THIS loader author it". They are
  -- different questions and conflating them let a curator stamp R4-U2's fixture marker
  -- ('seed:baseline') onto a demo target's truth rows. Default false: a newly registered origin is
  -- not loader-writable until someone says so.
  loader_writable boolean not null default false,
  owner        text not null,            -- which harness/unit writes this marker
  created_at   timestamptz not null default now(),
  revoked_at   timestamptz               -- non-null ⇒ treated exactly like an unregistered marker
);

-- For a database where this migration already created the table without the column.
alter table public.nao_simulation_origins
  add column if not exists loader_writable boolean not null default false;

comment on table public.nao_simulation_origins is
  'R4-U3 · the closed provenance vocabulary for daily_gut_rows.data_origin and '
  'wearable_daily.source, held as DATA rather than as a CHECK constraint (a CHECK would break four '
  'R4-U2 expect_ok assertions — see this migration''s header). PRESCRIPTIVE for '
  'nao_loader_apply_simulated_days (only a registered, non-revoked, is_simulated origin may be '
  'written, and only a registered non-revoked is_simulated origin may be overwritten); DESCRIPTIVE '
  'for rows that already exist. Fail-closed: an unregistered or misspelled marker is treated as '
  'real data and is therefore protected.';
comment on column public.nao_simulation_origins.is_simulated is
  'true ⇒ a row bearing this marker is simulated and may be overwritten by the loader. false ⇒ the '
  'marker is recognised but the row is real/protected, and the marker may never be written as row '
  'provenance.';
comment on column public.nao_simulation_origins.loader_writable is
  'true ⇒ nao_loader_apply_simulated_days may STAMP this marker onto a demo target''s rows. false ⇒ '
  'the marker belongs to another writer and the loader must refuse it as p_origin, even when '
  'is_simulated is true (''seed:baseline'' is R4-U2''s fixture marker: overwritable, never '
  'loader-authored). Defaults to false so registering an origin does not grant the loader authority '
  'over it.';
comment on column public.nao_simulation_origins.revoked_at is
  'Non-null ⇒ the marker behaves exactly as if it were never registered: it cannot be written, and '
  'a row bearing it is protected. Retiring an origin therefore FAILS CLOSED.';

alter table public.nao_simulation_origins enable row level security;
revoke all on public.nao_simulation_origins from anon, authenticated;
grant select, insert, update on public.nao_simulation_origins to service_role;

-- Seed rows. Registering 'seed:baseline' is a documentation act: R4-U2's fixture marker becomes a
-- named, owned entry instead of an undeclared second value sharing the column with no collision
-- detection. It is is_simulated (a row bearing it may be overwritten) but NOT loader_writable —
-- it belongs to 30_pre_u2_seed.sql, and a curator stamping another harness's marker onto a demo
-- target's truth rows would make U2's fixture provenance ambiguous. 'probe:pa' / 'probe:pb' are
-- deliberately NOT registered at all — they are therefore treated as real data and are protected,
-- which is the correct posture and needs no coordination with R4-U2's harness.
--
-- `do update` rather than `do nothing`: these four rows are repo-owned and their two boolean
-- columns are load-bearing, so re-applying this migration must re-establish them rather than leave
-- a pre-existing row at the column default (`loader_writable = false` would disable the loader).
-- `revoked_at` is deliberately NOT re-set, so an operator's revocation survives re-application.
insert into public.nao_simulation_origins (origin, label, is_simulated, loader_writable, owner)
values
  ('simulated:run2-demo', 'O11 / run-2 demo loader',     true,  true,
   'apps/nao/src/lib/simulatedHealth.ts'),
  ('simulated:run4-demo', 'R4-U3 atomic demo loader',    true,  true,
   'apps/nao/src/lib/simulatedHealth.ts'),
  ('seed:baseline',       'R4-U2 authz probe fixture',   true,  false,
   'supabase/tests/authz/30_pre_u2_seed.sql'),
  -- The release marker: recognised so nao_loader_runs.origin can reference it for a
  -- release/repair ledger row, is_simulated = false so it can never be stamped onto a truth row.
  ('release:run4-demo',   'R4-U3 simulated-day release', false, false,
   'public.nao_loader_release_simulated_days')
on conflict (origin) do update set
  label           = excluded.label,
  is_simulated    = excluded.is_simulated,
  loader_writable = excluded.loader_writable,
  owner           = excluded.owner;

-- ═══════════════════════════════════════════════════════════════
-- 2. NAO_DEMO_TARGETS — the approved demo context (O26), as data
-- ═══════════════════════════════════════════════════════════════
--
-- WHY A REGISTRY RATHER THAN "ANY USER OTHER THAN THE CALLER" (design §A.3).
-- pc_probe (60_assertions.sql:166-199, 48 assertions) denies every tier the ability to write
-- ANOTHER user's daily_gut_rows / wearable_daily at the table. "Any distinct target is fine" would
-- re-grant exactly that authority through a definer RPC — and pc_probe would still pass, because it
-- tests the DIRECT path. That makes the permissive option worse than useless: it would defeat the
-- invariant invisibly to the suite that exists to protect it. The registry bounds the blast radius
-- to the accounts an operator provisioned, is revocable, is auditable through a non-identifying
-- label, and mirrors R4-U2's own "membership IS the scope" idiom so the repo has one provisioning
-- pattern instead of two.

create table if not exists public.nao_demo_targets (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  -- A stable, NON-IDENTIFYING name. This is what the loader returns and logs; the target's uuid
  -- never leaves the database (apps/nao/src/lib/authz.ts redactDeep/redactText would strip it
  -- anyway, leaving a confusing hole).
  label      text not null unique check (label ~ '^demo:[a-z0-9][a-z0-9._-]{0,32}$'),
  note       text,
  created_at timestamptz not null default now(),
  revoked_at timestamptz               -- non-null ⇒ not a permitted target; row kept for audit
);

comment on table public.nao_demo_targets is
  'R4-U3 · the approved demo context (O26) as data. nao_loader_apply_simulated_days refuses any '
  'target that is not an effective row here, is the caller themselves, or holds an effective '
  'public.nao_members row. Provisioned by service_role only (no policy, no grant to '
  'authenticated). Bounded blast radius + revocability + a non-identifying audit label.';
comment on column public.nao_demo_targets.label is
  'Stable non-identifying name (e.g. ''demo:u3''), returned by the loader and written to '
  'nao_control_events in place of the target uuid.';
comment on column public.nao_demo_targets.revoked_at is
  'Non-null ⇒ NOT a permitted loader target, regardless of anything else. Row kept so the audit '
  'trail of "this account was once a demo target" survives.';

alter table public.nao_demo_targets enable row level security;
revoke all on public.nao_demo_targets from anon, authenticated;
grant select, insert, update on public.nao_demo_targets to service_role;
