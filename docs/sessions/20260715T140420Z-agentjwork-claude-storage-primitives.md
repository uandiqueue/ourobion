# Session 20260715T140420Z — agentjwork — claude — storage-primitives

> Session log format: **Attempted / Changed / Decided / Left / Blockers**.
> First step of any session: read the latest `docs/sessions/` files + run `node tools/context_sync.mjs --session-start`.

- **Device:** agentjwork · **Agent:** Claude Code (Fable 5, build session U2) · **Branch:**
  `feat/db-storage/continuity-primitives` (cut from `feat/shared/l0-contract-extension`) ·
  **Issue:** run chain (orchestrator opens PR)
- **Type:** Track A critical path — the continuity-based storage primitives
  (phase-2-plan §"The metric platform" property 3 + §W0 storage-primitives row).

## Attempted
- Ship the four generalized storage-primitive tables (`events`, `state_bands`, `signals`,
  `derived_metrics`) as a migration, widen the registry `MetricTable` union so future metrics can
  declare them, and make the metrics-registry-to-schema guard continuity-aware; run the full gate.

## Changed
- `supabase/migrations/20260715140420_create_continuity_storage_primitives.sql` — one migration,
  four tables, all with RLS + per-user select/insert/update/delete policies in the existing style
  (`auth.uid() = user_id`):
  - `events` — `id uuid pk default gen_random_uuid()`, `user_id` FK auth.users cascade,
    `metric_key text`, `occurred_at timestamptz`, `value jsonb null`, `source text null`,
    `logged_at timestamptz default now()`; index `(user_id, metric_key, occurred_at)`.
  - `state_bands` — `id uuid pk`, `user_id`, `metric_key`, `started_at timestamptz`,
    `ended_at timestamptz null` (null = open/active band), `value jsonb null`, `source text null`,
    check `ended_at >= started_at`; index `(user_id, metric_key, started_at)`.
  - `signals` — `user_id`, `metric_key`, `ts timestamptz`, `value double precision not null`,
    `source text not null`, `device text null`; composite **pk `(user_id, metric_key, ts, source)`**
    (dedupe + covering index; no separate index).
  - `derived_metrics` — `id bigint identity pk`, `user_id`, `metric_key`, `as_of date`,
    `value jsonb not null`, `computed_at default now()`, unique `(user_id, metric_key, as_of)`;
    table COMMENT: rebuildable projection, never hand-edited, never truth-tier (memory 0001).
  - Header comment documents the grandfathered first instances: `daily_gut_rows` → daily_log,
    `antibiotic_courses` → state_bands, `wearable_daily` → signals, `baseline_snapshots` →
    derived_metrics. Legacy tables untouched; no data migration; no metric re-homed.
- `shared/metrics/registry.ts` — `MetricTable` union widened with the four primitive names;
  file-header + `table` doc updated (primitives are what new metrics declare).
- `shared/metrics/registry.schema.ts` — `metricTableSchema` z.enum widened identically.
- `shared/metrics/registry.dart` — `table` doc comment mirrors the widened union (Dart models
  `table` as `String`; the parity guard checks per-key values, so a doc-level mirror is the
  faithful minimal change).
- `shared/metrics/README.md` — new "Storage (continuity primitives)" section (primitive semantics
  + legacy-table mapping), `table` field row updated, add-a-metric runbook step 2 split: wide
  table → ADD COLUMN; primitive → no column, no migration (rows carry `metric_key`).
- `apps/biotope/test/guards/metrics_registry_schema_test.dart` — continuity-aware: legacy wide
  tables keep the column==registry equality check; the four primitives get existence + core-column
  checks (`metric_key`, time column — `occurred_at`/`started_at`/`ts`/`as_of` — and `value`); new
  completeness test: every table declared by an active registry metric must be covered by one of
  the two maps. +5 tests (35 → 40). No new guard file → no new couplings.yaml edge; the
  `metrics-registry-to-schema` edge's `to`/`why` text updated to describe both semantics.

## Decided
- **One migration file** for all four tables — they ship (and are reviewed) as one primitive set;
  matches the M2 precedent of two related tables per file.
- **`value jsonb` on `events`/`state_bands`/`derived_metrics`; `double precision` on `signals`.**
  Events/bands carry heterogeneous typed payloads per registry metric type (enum, multi_select,
  numeric, text) — jsonb avoids per-type columns; the registry, not the DB, owns value typing.
  Signals are the high-row-count workhorse: fixed-width numeric keeps rows narrow and aggregates
  fast. Alternative (typed value columns per primitive) rejected: reintroduces schema churn per
  metric, defeating the localized-add property.
- **No `value_text` on `signals`.** Judged non-numeric passive signals to be events with a jsonb
  payload; keeping signals numeric-only preserves the tall/narrow contract. Revisit only if a real
  non-numeric high-frequency source appears.
- **`events.value` nullable** — a pure-occurrence event (the timestamp is the datum) carries no
  payload; `derived_metrics.value not null` (a computed row with no value is meaningless);
  `signals.value not null` likewise.
- **PK choices:** `events`/`state_bands` get `id uuid default gen_random_uuid()` (client-side id
  generation for offline logging; bands are mutated later to close them, so a stable row id
  matters). `derived_metrics` keeps the `bigint identity` + unique-key convention of
  `baseline_snapshots` (server/edge-written). `signals` uses the natural composite pk
  `(user_id, metric_key, ts, source)` — enforces one reading per instant per source, and the pk
  btree is the covering index for per-metric time-range scans, so no secondary index on the
  highest-volume table. Alternative (surrogate id + unique) rejected: pure overhead at signals
  volume.
- **`source` nullability:** `not null` on `signals` (pk member, dedupe axis), nullable on
  `events`/`state_bands` (matches `wearable_daily.source` precedent).
- **`derived_metrics` gets all four per-user policies** (unlike select-only
  `baseline_snapshots`): derivation can run on-device (M2 already derives at write time
  client-side), so the client must be able to upsert its own rows; RLS still confines rows to the
  owner, and "never hand-edited" is a two-tier-truth process rule, not an RLS concern. Edge
  functions bypass RLS as service_role either way.
- **`ended_at >= started_at` check** on state_bands (cheap invariant, matches
  `duration_days > 0` precedent); no exclusion constraint against overlapping bands — overlap
  semantics (e.g. two concurrent antibiotic courses) are a product decision left to the collector.
- **Guard shape:** extended the existing `metrics_registry_schema_test.dart` (no new file, so no
  new couplings.yaml edge; existing edge text updated). Core-column sets kept minimal
  (`metric_key`/time/`value`) per session spec — `source`/`device` are not guarded columns.
- **Timestamp naming** `20260715140420_create_continuity_storage_primitives.sql` — full
  `YYYYMMDDHHMMSS` form of the newer migrations.

## Left
- No registry metric is homed on a primitive yet (deliberate — this session is storage only);
  first instances land with their collectors (M2 course tracker → state_bands exemplar, Track B
  wide-passive → signals).
- `daily_log` (the generalized thin continuous spine) is NOT created here — phase-2-plan lists it
  as a primitive but `daily_gut_rows` is its grandfathered instance and no second continuous-spine
  table is needed until a non-gut daily metric ships; session scope was the four new tables.
- `env_daily` remains in the `MetricTable` union with no migration/guard coverage — unused by any
  registry entry; the new completeness guard test will force a mapping the moment a metric
  declares it.

## Blockers
- None blocking. Note for the record: `npx supabase db reset` applied **all 9 migrations cleanly**
  (twice), but the CLI then exits 1 at the post-apply "Restarting containers..." step with a 502
  (pre-existing Windows/analytics container quirk — CLI warns analytics needs the Docker daemon on
  tcp:2375). Verified post-reset via psql in the db container: all four tables present, RLS
  enabled, 4 policies each, indexes/pks as designed, derived_metrics COMMENT set.
- Gate: `npx tsc --noEmit` (shared/) clean · `flutter analyze` clean · `flutter test` 40/40 pass
  (incl. 7 metrics-registry-to-schema guard tests) · `context_sync --fix-index` + `--check` pass.

memory: none
