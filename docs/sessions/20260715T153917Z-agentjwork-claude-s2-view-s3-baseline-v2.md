# Session 20260715T153917Z — agentjwork — claude — s2-view-s3-baseline-v2

> Session log format: **Attempted / Changed / Decided / Left / Blockers**.
> First step of any session: read the latest `docs/sessions/` files + run `node tools/context_sync.mjs --session-start`.

- **Device:** agentjwork · **Agent:** Claude Code (Fable 5, build session U6) · **Branch:**
  `feat/m5a-engine/s2-view-s3-baseline-v2` (cut from `feat/m5b-rules/rules-as-data`) ·
  **Issue:** run chain (orchestrator opens PR)
- **Type:** insight-engine serve path, stages S2 + S3 of
  `docs/shared/insight-engine-architecture.md` — the registry-generated `metric_daily_values`
  unpivot view (S2, the single long-format read seam) and baseline v2
  (S3: `window_days` / `total_history_days`, coverage-rebased 3/5/14 confidence per
  `docs/shared/phase2-run-config-decisions.md` C5). S4 signal firing is explicitly NOT here
  (next session).

## Attempted
- S2: a deterministic generator that renders the `metric_daily_values` view SQL from
  `shared/metrics/registry.ts`, the committed migration it emits, and a drift guard (`--check` +
  node test) holding the two together.
- S3: additive `baseline_snapshots` migration + full rewrite of `compute-baselines` to read the
  S2 view, compute per-(user,metric) window stats + total history, and adopt the C5 3/5/14
  confidence cutoffs from a named config object (deployed code used 3/7/14 — divergence fixed).
- Functional exercise of the whole path against local supabase (db reset → seed → edge-function
  invoke → direct SQL verification), not just static checks.

## Changed
- `tools/metric-view/` (NEW package, house `tools/` style mirroring `tools/rules`):
  `gen_metric_view.mjs` (CLI: stdout / `--write` / `--check` drift-diff, CRLF-tolerant),
  `lib/view.mjs` (pure generator; registers the tsx ESM loader and imports
  `shared/metrics/registry.ts` directly — no parse-by-regex, one source of truth),
  `tests/view_migration_drift.test.ts` (5 node tests: byte-identical committed migration,
  determinism, every baselineApplicable key covered, exact key set (no extras),
  security_invoker + signals branch present), package.json / tsconfig / package-lock.
- `supabase/migrations/20260715154000_create_m5a_metric_daily_values_view.sql` — **GENERATED**
  (header says so): `create or replace view public.metric_daily_values with
  (security_invoker = true)` — shape `(user_id, log_date date, metric_key text, value double
  precision, source text)`; one UNION ALL branch per active numeric/ordinal wide-table metric
  (10 × daily_gut_rows tagged `self_report`, 6 × wearable_daily tagged `wearable`, `where <col>
  is not null`) + one generated `signals` branch (daily-grain `avg(value)`, UTC day bucket,
  tagged `signal`, no per-key filter) so future passive metrics surface automatically.
- `supabase/migrations/20260715154001_alter_m5a_baseline_snapshots_baseline_v2.sql` — additive:
  `window_days smallint not null default 7`, `total_history_days integer not null default 0`
  (per §S3 DDL), re-documenting `days_of_data`/`confidence` via `comment on column`, **plus**
  widening mean/std_dev/min/max from `numeric(6,3)` to unconstrained `numeric` (see Decided).
- `supabase/functions/compute-baselines/index.ts` — S3 v2 rewrite: derives
  `BASELINE_METRIC_KEYS` from the registry (`status === "active" && baselineApplicable`), reads
  **only** `metric_daily_values` (paginated, stable ordering; no more wide-table SELECTs),
  groups per (user, metric), computes mean/std/min/max/trend over the last `windowDays` days and
  `total_history_days` over all rows, and populates the new columns. `BASELINE_CONFIG` named
  object holds `windowDays: 7` + confidence cutoffs `{lowMinDays: 3, mediumMinDays: 5,
  highMinHistoryDays: 14}` (C5) — no inline literals. Auth check, upsert on
  `(user_id, metric_key)`, invocation contract (POST `{}` + service-role bearer) and response
  shape (`{ok, users, snapshots}`) all unchanged — the seeder works unmodified.
- `apps/biotope/test/guards/metrics_registry_baselines_test.dart` — guard updated faithfully for
  v2: still asserts registry import + no hardcoded key literals (now across gut+wearable+signals
  keys), anchors changed from per-table `table === "…"` filters to `m.baselineApplicable` /
  `m.status === "active"` + must-read-`"metric_daily_values"` + must-NOT-name the wide tables.
- `docs/graph/couplings.yaml` — new **metrics-registry-to-daily-values-view** coupling (guard:
  `tools/metric-view/tests/view_migration_drift.test.ts`, active); reworded
  metrics-registry-to-baselines `why` for the view seam.
- Root `package.json` — `view:gen` / `view:write` / `view:check` / `view:test` scripts.
- `scripts/seed-test-data.sql` — drive-by fix required to run the gate: `v_titles || 'pioneer'`
  resolves to `array_cat` (untyped literal parsed as an ARRAY literal → "malformed array
  literal"); added `::text` casts. Pre-existing breakage, not caused by this session.

## Decided
- **View shape `log_date`, not the doc sketch's `day`:** the session spec fixed the shape as
  `(user_id, metric_key, log_date, value double precision, source)`; `log_date` also matches the
  daily_gut_rows column and the guards' system-column list. §S2's inline sketch (`day`,
  `numeric`) is a sketch, not DDL; noted here as the one deliberate divergence.
- **Non-null rows only:** the view emits only days that HAVE a value (`where <col> is not
  null`), so S3's `days_of_data` / `total_history_days` are plain row counts. A fully unlogged
  day never had a row to emit anyway, so "null value" rows carried no information.
- **Signals aggregation = MEAN** of the day's readings (UTC day bucket), per the session spec's
  default (doc is silent). Revisit per-metric (sum-natured metrics like step deltas) when a
  signals-resident metric actually lands. Branch is unconditional and key-unfiltered: anything
  written to `signals` (numeric-only by schema; keys registry-tied by the schema guard) surfaces
  automatically. Generator hard-fails if an active numeric/ordinal metric declares a table with
  no branch config (e.g. env_daily before that table lands).
- **S3 window semantics:** `window_days = 7` (the §S3 default). mean/std_dev/min/max/trend +
  `days_of_data` are computed over the last 7 calendar days (UTC, inclusive of today);
  `total_history_days` = all non-null days ever from the view. Confidence per §S3/C5:
  insufficient <3 in-window · low 3–4 · medium ≥5 with history <14 · high ≥5 with history ≥14.
  v1's 30-day lookback is gone — history now comes from the view, unbounded (paginated reads,
  1000/page, stable order).
- **Widened stat columns (beyond the doc's additive list):** `numeric(6,3)` caps |value| < 1000;
  seeded wearable rows (step_count ≈ 7–10k) made the v2 upsert fail with `22003 numeric field
  overflow` — v1 would have failed identically on this data. baseline_snapshots is a rebuildable
  projection (two-tier truth), so widening in the same migration is safe; function still
  round3()s.
- **`data_sources`** = sorted distinct `source` values of the rows that fed the stats (falls
  back to whole-history sources when the window is empty) — data-driven instead of v1's
  per-table constant, same values today (`{self_report}` / `{wearable}`).
- **Snapshot emitted for any metric with ≥1 historical day** (window may be empty → null stats,
  days_of_data 0, insufficient); metrics with no rows at all emit nothing (§S2 failure mode:
  zero rows → S3 `insufficient` path downstream).
- **Guard update over anchor preservation:** the old baselines-guard anchors
  (`table === "daily_gut_rows"` / `"wearable_daily"`) would have forced the rewrite to keep
  artificial per-table key lists; updated the guard faithfully instead (stronger: the function
  must now NOT name the wide tables).

## Left
- S4 (3-state signal + pattern firing) — next session; reads S3 rows + today's S2 values.
- Registry `signal.deadbandK` already exists (ADR-0002) — S4 consumes it, nothing needed here.
- CI still doesn't run node tool-package tests (`view:test` joins `rules:test` in that gap —
  same orchestrator decision as U5); the Dart guard + `--check` in pre-push cover the seam.
- `scripts/seed-test-data.ps1` is UTF-8-without-BOM and fails to PARSE under Windows PowerShell
  5.1 (mis-decoded `✓` becomes a smart quote inside a double-quoted string). Ran a BOM'd copy
  this session; left the repo file untouched (encoding-only churn) — flag for a hygiene pass.
- Local edge runtime serves the rewritten function per-request (no deploy step needed);
  `deno` is not installed on this machine, so no standalone `deno check` — see Blockers for what
  was actually exercised instead.

## Blockers
- None. Gate: `npx supabase db reset` — all 12 migrations apply (view + baseline v2 alter) ·
  generator `--check` ✓ against the committed migration · `tools/metric-view` tests 5/5 +
  `tsc --noEmit` clean · **functional (really run, local stack):** seeded 14 days for a
  SQL-created auth user → view returns 224 rows = 16 metrics × 14 days (`self_report` +
  `wearable` sources); `pg_class.reloptions = {security_invoker=true}`; hand-inserted `signals`
  rows (60, 70 same day) surfaced as one daily row value 65 source `signal`; invoking
  compute-baselines over HTTP → `{ok, users:1, snapshots:16}` with `window_days=7`,
  `total_history_days` populated, and confidence tiers proven live: 4 seeded days → `low`,
  5 days → `medium` (history < 14), 14 days → `high`; generate-insights still fires (1 card) ·
  shared `npx tsc --noEmit` clean · `flutter analyze` clean · `flutter test` 43/43 ·
  `context_sync --fix-index` + `--check` pass. compute-baselines itself was validated by live
  execution (edge runtime serves + runs it), not `deno check` (deno absent on this machine).

memory: none
