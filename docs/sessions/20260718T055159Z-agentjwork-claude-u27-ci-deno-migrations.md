# Session 20260718T055159Z — agentjwork — claude — u27-ci-deno-migrations

> Session log format: **Attempted / Changed / Decided / Left / Blockers**.
> First step of any session: read the latest `docs/sessions/` files + run `node tools/context_sync.mjs --session-start`.

- **Device:** agentjwork · **Agent:** Claude Code (Fable 5, build session U27) · **Branch:**
  `ci/deno-check-migrations-apply` (cut from the chain tip `fix/tools/budget-ledger-lifecycle`) ·
  **Issue:** #88 · **PR:** #89 (stacked)
- **Type:** audit-fix unit U27 — **CI blind spots**, finding A24 (low) from
  `docs/temp/phase2-audit/audit-findings-register.md`: the three `Deno.serve` handler shells are
  compiled by nothing in CI, and no job ever applies `supabase/migrations/*.sql`.

## Attempted
- Add a `deno-check` CI job type-checking all three edge-function handler entrypoints.
- Add a `migrations-apply` CI job shadow-applying every migration, in filename order, against a
  vanilla postgres service — with whatever minimal checked-in bootstrap makes vanilla postgres
  accept supabase-flavoured SQL honestly.

## Changed (committed)
- `.github/workflows/ci.yml` — two new jobs (header comment: four → six), same push/PR triggers
  as the existing jobs:
  - **`deno-check`** (`Deno — <function>`): `denoland/setup-deno@v2` pinned to `deno-version:
    v2.x` (supabase/config.toml sets `edge_runtime.deno_version = 2`), matrix over
    compute-baselines / evaluate-signals / generate-insights, `deno check --no-lock index.ts`
    run **from each function's directory** so its `deno.json` is the discovered config and the
    upward config walk never reaches the repo-root `package.json`. `--no-lock` because no
    `deno.lock` is committed (deno isn't installed on dev machines; the supabase CLI bundler owns
    resolution at deploy time).
  - **`migrations-apply`** (`Migrations — shadow apply (postgres:17)`): `postgres:17` service
    (major version = config.toml `major_version = 17`) with a pg_isready healthcheck; then
    (1) `docker cp` the pg_cron/pg_net stub extension definitions into the service container via
    `job.services.postgres.id`, (2) `psql -f ci/migrations-bootstrap.sql`, (3) loop
    `supabase/migrations/*.sql` in sorted filename order, `psql -v ON_ERROR_STOP=1` each.
    In-YAML comment states it complements — does not replace — local `supabase db reset`.
- `ci/migrations-bootstrap.sql` — NEW, the honest-minimal supabase-shaped primitives the checked-in
  migrations actually reference (each item documented in-file): roles `anon`/`authenticated`/
  `service_role` (nologin; only `authenticated` is referenced today), schema `auth` with a minimal
  `auth.users (id uuid pk, email text)` (FK target + the two columns `handle_new_user()` reads)
  and supabase's real `auth.uid()` definition, and schema `extensions` + usage grants.
- `ci/pg-extension-stubs/` — NEW: `pg_cron.control` + `pg_cron--1.0.sql` (creates schema `cron` +
  a `cron.schedule(text,text,text) returns bigint` no-op — the migrations CALL it at apply time)
  and `pg_net.control` + `pg_net--1.0.sql` (schema `net` + an `http_post` stub matching the real
  signature; only ever referenced inside cron command strings, never executed at apply time).
  Needed because `create extension` requires control files on the server filesystem — no SQL-only
  bootstrap can fake it; the job `docker cp`s these in before applying.
- `supabase/functions/evaluate-signals/deno.json` — NEW, byte-identical to the other two
  functions' (it was the only one missing it): gives `deno check` a config boundary at the
  function dir and keeps the three functions uniform.
- `docs/temp/phase2-run-orchestration-log.md` — U27 row → done; ledger row appended.
- `docs/temp/phase2-run-blocked-register.md` — B12 updated: required-checks list grows by four
  (`Deno — compute-baselines|evaluate-signals|generate-insights`, `Migrations — shadow apply
  (postgres:17)`).

## Decided / judgment calls
- **pg_cron/pg_net as stub extension FILES, not SQL.** `create extension if not exists pg_cron`
  cannot be satisfied by pre-creating schemas/functions — postgres insists on a control file. The
  stubs are checked in under `ci/`, clearly labelled CI-only, and installed by `docker cp` into
  the service container (GitHub exposes the container id as `job.services.postgres.id`). The
  alternative (running the supabase postgres image as the service) was rejected: the worklist
  wants a fast vanilla-psql shadow apply, and the supabase image would silently paper over
  exactly the "works only on supabase" assumptions this job exists to surface.
- **Bootstrap scope:** the canonical role trio is created together (cheap, future migrations may
  grant to `anon`/`service_role`) but nothing speculative beyond that — no bypassrls, no GoTrue
  columns beyond `id`/`email`, no storage/realtime schemas (nothing references them).
- **`deno check` shape:** per-function working directory + `--no-lock`; no import-map flags
  needed — the handlers' imports are `jsr:` specifiers and relative `.ts` paths (including
  `../../../shared/*.ts`, which are dependency-free), and the `/// <reference types="jsr:…" />`
  pragma is a full specifier needing no mapping.

## Gate results / local proof
- **Shadow apply, local (disposable `postgres:17` container, server 17.10):** stubs docker-cp'd,
  `ci/migrations-bootstrap.sql` OK, then **all 16 migrations applied in filename order with
  `ON_ERROR_STOP=1`, zero errors** (both `cron.schedule` calls returned a job id). Post-apply:
  17 public tables, 2 public views, extensions = pg_cron, pg_net, plpgsql. Container removed.
- `npx supabase db reset` — green after the change (16/16 migrations on the real image).
- `npx supabase functions serve` — still green with the new evaluate-signals/deno.json: all three
  functions listed, and a POST to evaluate-signals reached the handler's own service-role gate
  (401 from handler code = the worker bundled and executed; no BOOT_ERROR).
- Workflow YAML: both `.github/workflows/*.yml` parse clean via js-yaml; all three matrix
  entrypoint paths verified to exist.
- `flutter analyze` — no issues; `flutter test` — **62/62** (untouched-green).
- `node tools/context_sync.mjs --check` — consistent.

## Left / follow-ups (not this unit)
- **`deno check` itself never ran locally — deno is not installed on this machine.** The three
  deno-check matrix legs first execute for real on the PR's own CI run; if a handler has a latent
  type error under Deno's strict defaults, that run is where it surfaces (which is the finding's
  point). Everything around the steps (YAML, paths, config discovery, serve compatibility) is
  locally verified.
- B12 (make the new checks *required*) stays a human repo-settings task; entry updated.
- `supabase/config.toml` has no `[functions.evaluate-signals]` block (the other two have one).
  Serve/deploy defaults cover it today; noted here rather than changed — config.toml is outside
  this unit's blast radius.

## Blockers
- None.

memory: none
