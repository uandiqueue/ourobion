---
title: Run 4 U6 A5 daily-log storage options
summary: A5 options analysis and the selected U6b posture: retain daily_gut_rows and add typed nullable columns while deferring a generalized daily-log table.
type: brief
scope: shared
status: canonical
updated: 2026-07-29
---

# Run 4 U6 A5 — daily-log storage options

## Recorded decision (2026-07-29)

Jayden selected **option 1 for the U6b wellbeing slice**: keep `daily_gut_rows` as the
authoritative raw-truth store and add typed nullable columns for the five approved wellbeing
fields. A new generalized daily-log table remains deferred. The existing seven-field DQS stays
unchanged, new writes must preserve omitted fields, and every `shared/metrics/**` PR still requires
actual Jayden and Alton reviews. This decision authorizes the bounded U6b slices; it does not select
a generalized storage primitive for unrelated future metric families.

The comparison below is retained as the decision evidence and migration trade-off record.

## Original decision question

`register A5` is deliberately unresolved: the current `daily_gut_rows` table is a
grandfathered instance of the daily-log primitive, not a general primitive. The register
therefore blocks roughly 15 EASY daily self-report metrics on a deliberate build-versus-
defer choice ([pending-build-register.md](./pending-build-register.md):66-77). This brief
originally did not choose a design. The recorded decision above now resolves the U6b slice while
preserving the broader design question. Any later change to `shared/metrics` requires actual
reviews from both Jayden and Alton; their names alone are not a substitute for reviews.

The governing constraints are:

- Raw daily observations are truth; do not make them derived-only or hand-edit a derived
  projection ([AGENTS.md](../../../AGENTS.md) §2).
- Existing `daily_gut_rows` is one row per `(user_id, log_date)`, carries the present DQS,
  and has user-scoped select/insert/update RLS
  ([20260513_create_m2_daily_gut_rows_and_antibiotic_courses.sql](../../../supabase/migrations/20260513_create_m2_daily_gut_rows_and_antibiotic_courses.sql):9-64).
- The current full-row path is only safe because the screen reloads and resends every field;
  a single-column writer must instead use an omission-preserving patch
  ([logging_controller.dart](../../../apps/biotope/lib/modules/m2_self_report/impl/logging_controller.dart):65-194).
- DQS is presently the seven named T1 fields whose weights sum to 100, and explicitly
  excludes event/period/passive values
  ([normaliser.dart](../../../apps/biotope/lib/modules/m2_self_report/impl/normaliser.dart):1-31).
- The joint-series view currently unpivots wide `daily_gut_rows` columns, and remains a
  security-invoker view over the underlying tables
  ([20260715154000_create_m5a_metric_daily_values_view.sql](../../../supabase/migrations/20260715154000_create_m5a_metric_daily_values_view.sql):14-25, 94-98).

## Options

### 1. Defer, then add columns to `daily_gut_rows`

Keep `daily_gut_rows` as the sole daily manual-record table. Until a metric ships, defer it;
when it ships, add a typed nullable column, constraints, registry entry, UI write path, DQS
handling where applicable, and a new view-unpivot branch.

- **Raw truth and RLS:** raw values stay in the existing daily row and inherit its current
  `(user_id, log_date)` uniqueness and owner RLS. There is no second source to reconcile.
- **Old-row compatibility:** existing reads and writes remain valid. New columns are nullable,
  so old rows and older clients leave them absent. The existing complete-row save must include
  each new column after the screen has learned to reload it, or it can erase that value.
- **Safe partial writes:** continue using a column-only update/insert path; adding fields does
  not itself make full-row upserts safe. Each new answer needs a patch whose absent keys are
  genuinely absent, not JSON nulls.
- **DQS:** the current explicit seven-key map can stay unchanged. If a new metric should count,
  changing its weight changes the denominator and requires an explicit compatibility decision
  for historical `log_completeness`; if it should not, it must be excluded deliberately.
- **Migration, backfill, rollback:** additive, nullable migrations have no mandatory backfill;
  rollback is a forward migration that stops reads/writes, not deletion of raw values. Repeated
  column migrations and generated-view regeneration accumulate with every metric.
- **Size and review:** smallest first implementation, but repeats schema, generated-view, Dart,
  parity, and review work per metric. `shared/metrics` review requirements still apply.
- **Cost of deferral:** no structural work now, but every EASY metric stays unavailable and
  dashboard support remains coupled to wide-table changes.

### 2. Long-form general daily values beside the grandfathered row

Create a new truth-tier table such as a daily `(user_id, log_date, metric_key, value)` record,
while preserving `daily_gut_rows` as the grandfathered legacy row. New EASY metrics write the
new table; existing gut metrics continue writing their existing columns.

- **Raw truth and RLS:** each observation has a stable daily key and owner RLS equivalent to
  the current table. The schema must constrain value shape/range by registry contract or
  typed representation; otherwise raw truth is preserved but becomes semantically ambiguous.
- **Old-row compatibility:** no rewrite is required. Old clients and existing M2 paths read and
  write `daily_gut_rows`; new readers need an explicit union/adapter policy. A key must not be
  silently readable from both stores without a precedence and duplicate rule.
- **Safe partial writes:** natural per-key upsert protects unrelated metrics, provided its
  conflict target is `(user_id, log_date, metric_key)` and an update never replaces another
  key's value. This is safer for independent answers than the legacy whole-row save.
- **DQS:** preserve the legacy DQS calculation for legacy rows initially, or define a single
  cross-store DQS computation with an explicit historical-read strategy. Counting new keys
  cannot be implicit: it changes completeness semantics and may require recomputation of the
  persisted legacy field.
- **Migration, backfill, rollback:** no required backfill; optional one-way legacy export is a
  separate audited migration, never a hand edit. Rollback can stop new writers while retaining
  rows, but read adapters must still explain whether new values are visible.
- **Size and review:** medium: new migration/RLS/constraints, writer and reader adapters,
  `metric_daily_values` treatment, registry/parity guards, and cross-store DQS tests.
- **Cost of deferral:** it postpones an up-front seam but avoids committing every future daily
  scalar to the wide legacy schema.

### 3. Daily-log header/value pair

Create a daily header keyed by `(user_id, log_date)` plus child values keyed by header and
`metric_key`. The header can own date-level metadata (for example provenance and timestamps);
values own the metric payload. `daily_gut_rows` remains grandfathered unless a later migration
explicitly moves it.

- **Raw truth and RLS:** the header and each value are truth-tier rows. RLS must protect both
  the header owner and child access through an owner-safe join/foreign-key design, so no child
  can be inserted under another user's header.
- **Old-row compatibility:** legacy screens continue unchanged. New daily-log readers need a
  header/value adapter; old metrics must not be duplicated into the new pair without a declared
  authoritative source and read precedence.
- **Safe partial writes:** per-value updates can preserve unrelated answers. Header creation
  and first value insert must be transactional (or an idempotent RPC) to avoid orphan headers,
  orphan values, or a partial date-level state after retry.
- **DQS:** a header offers a natural place for a future date-level completeness projection, but
  it must not silently diverge from `daily_gut_rows.log_completeness`. Preserve the existing
  legacy result until an approved cross-store rule and rebuild plan exist.
- **Migration, backfill, rollback:** additive and no required backfill, but introduces two
  tables, FK/index/policy migrations, and atomicity tests. Rollback leaves retained raw rows
  and must disable both writer paths coherently.
- **Size and review:** largest new-schema option: ownership/RLS, transactional write semantics,
  adapters, projections, registry parity, and DQS compatibility all need review.
- **Cost of deferral:** keeps the simplest conceptual long-form model unavailable, but avoids
  introducing a header whose only current purpose is future extensibility.

### 4. Rename/recast `daily_gut_rows` with a compatibility layer

Migrate the existing table into an explicitly named generalized daily-log design (wide or
otherwise), retaining a compatibility view/RPC/adapter so old clients and consumers keep their
published contract during transition.

- **Raw truth and RLS:** the migration must preserve every existing raw row exactly once and
  reproduce owner isolation on the recast store and compatibility layer. The compatibility
  surface must not be a security bypass.
- **Old-row compatibility:** strongest promise when complete, but also the highest risk: every
  current direct table reader/writer, including M2, M5a and M6 consumers, must be inventoried
  and either migrated or supported by the compatibility layer.
- **Safe partial writes:** the compatibility write surface must preserve the current
  single-column patch guarantee. A view alone cannot safely emulate all writes unless its
  update rules/RPC behavior and concurrent updates are explicitly tested.
- **DQS:** the seven-key legacy formula and persisted value need an exact compatibility period.
  Any generalized DQS must specify historic reads, recomputation, and whether the old field is
  retained, derived, or deprecated.
- **Migration, backfill, rollback:** requires a rehearsed copy/rename strategy, validation of
  counts and values, dual-read or compatibility rollback plan, and forward-only recovery. It
  has the greatest chance of requiring a production-style migration rehearsal.
- **Size and review:** highest. It crosses schema, app consumers, view generation, engagement,
  tests, and potentially shared contracts; later shared changes require Jayden and Alton's
  actual reviews.
- **Cost of deferral:** avoids an invasive migration now, but preserves the naming and modeling
  mismatch that A5 records.

## Decision record checklist

Jayden's recorded choice states the selected option and U6b authoritative store. Any future
generalized primitive decision must additionally state: authoritative raw store for every
legacy and new metric; RLS ownership model; old-client/read/write compatibility window; partial-
write and retry semantics; DQS treatment and historical behavior; migration/backfill/rollback
plan; and the metrics that trigger the first implementation. It must also state whether any
`shared/metrics` changes follow, so Jayden and Alton can provide actual PR reviews.

U6b is no longer blocked by A5: its bounded option-1 implementation is locally complete and awaits
normal PR/review integration. This brief intentionally does not treat the already-existing
`events`/`state_bands` work as a substitute: those are A4 and solve a different continuity class
([20260715140420_create_continuity_storage_primitives.sql](../../../supabase/migrations/20260715140420_create_continuity_storage_primitives.sql):4-14).
