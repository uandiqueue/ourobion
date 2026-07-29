# Metrics Registry

**This file is the ONLY definition of the `MetricDefinition` shape; [`docs/biotope/metrics-registry-design.md`](../../docs/biotope/metrics-registry-design.md) carries rationale only.**

`registry.ts` is **the single source of truth** for every metric ourobion collects.
`registry.dart` is its faithful mirror for the Flutter app. The two are held in lockstep by
guards — adding or removing a metric is a localized, guard-protected change, so incomplete
propagation fails the build instead of silently breaking at runtime.

See [`docs/biotope/metrics-registry-design.md`](../../docs/biotope/metrics-registry-design.md) for the full design.

## `MetricDefinition` fields

| Field | Meaning |
|---|---|
| `key` | canonical snake_case id — **== DB column == `metric_key` == rule `metricKey`** |
| `source` | source economy: `manual` \| `semi_passive` \| `sensor` \| `api` \| `derived` |
| `table` | storage location: a continuity primitive (`events` \| `state_bands` \| `signals` \| `derived_metrics`) or a grandfathered first-instance table (`daily_gut_rows` \| `wearable_daily` \| `env_daily`) — see [Storage](#storage-continuity-primitives) |
| `tier` | collection tier (logging budget): `T0` passive · `T1` daily core · `T2` optional · `T3` event · `T4` state · `T5` profile |
| `continuity` | `continuous` \| `episodic` \| `state` \| `static` — the data shape over time |
| `type` | `numeric` \| `ordinal` \| `boolean` \| `enum` \| `multi_select` \| `text` |
| `scale` | `{ min, max }` for numeric/ordinal, else `null` |
| `unit` | optional display unit |
| `enumValues` | allowed values for `enum` / `multi_select`, else `null` |
| `baselineApplicable` | does M5a compute mean/std/trend? (true only for numeric/ordinal) |
| `reliability` | confidence weight `4` device · `3` in-moment · `2` subjective/count · `1` free-text (Part F) |
| `derivedFrom` | for `source: derived`, the input metric keys it is computed from (seeds the relationship graph); else `null` |
| `availability` | `both` \| `ios_only` \| `android_only` \| `hardware_gated` (graceful degradation) |
| `preferredSource` | semi-passive: fetch from this source first (health store), else `null` |
| `dqs` | `{ weight, countsTowardDailyCompleteness }` — only the `T1` spine counts; weights sum to 100 |
| `signal` | S4 anomaly params ([ADR-0002](../../docs/shared/decisions/0002-anomaly-definition.md)): `{ deadbandK }`, the daily 3-state deadband in robust σ̂ (= MAD/0.6745) units — `neutral` iff \|x − median\| ≤ `deadbandK`·σ̂; set (typically `1.0`, provisional) for every `baselineApplicable` metric, else `null` |
| `ui` | optional `{ label, inputType }` hint for M2 self-report screens |
| `dailyProjection` | optional explicit primitive-to-day policy; absent/`null` by default. Events use UTC `count` / `sum` / `mean` / `latest`; state bands use UTC `presence` over half-open `[start,end)` only |
| `status` | `active` \| `deprecated` |
| `introducedIn` / `deprecatedAt` | lifecycle stamps |

Typed accessors live in `index.ts` / `index.dart` (`activeMetrics`, `metricByKey`,
`metricsByTable`, `baselineKeys`, `activeKeys`, `isActiveMetric`, `dqsWeights`,
`dailyCompletenessKeys`) — consumers read the list through these, never hardcoded keys.

## Storage (continuity primitives)

Storage follows a metric's **continuity**, not its body system (phase-2-plan §3). The
`create_continuity_storage_primitives` migration ships four generalized tall/narrow tables —
`events` (episodic, timestamped; frequency/timing derived, never asked), `state_bands`
(start/end spans; open band = active), `signals` (passive time-series), and `derived_metrics`
(rebuildable projection, never truth-tier). A metric homed on a primitive needs **no dedicated
column** — rows carry its registry `key` as `metric_key`. The legacy tables stay untouched as
grandfathered first instances of the primitives: `daily_gut_rows` → `daily_log` (the thin
continuous spine), `antibiotic_courses` → `state_bands`, `wearable_daily` → `signals`,
`baseline_snapshots` → `derived_metrics`. No existing metric is re-homed.

## Add a metric (safe flow)

1. Add **one** entry to `registry.ts` **and** `registry.dart` (same key, same order within its
   source block).
2. Guards fail and tell you exactly what's missing. Legacy wide table (`daily_gut_rows` /
   `wearable_daily`): add the field to the contract row (TS + Dart) plus a migration
   `ADD COLUMN <key> … NULL`. Continuity primitive (`events` / `state_bands` / `signals` /
   `derived_metrics`): **no column and no migration** — rows carry the key as `metric_key`.
3. Baselines, DQS, and engine validation pick it up **from the registry** — no separate edits.
   A numeric/ordinal metric on `events` or `state_bands` must select `dailyProjection`; the view
   generator fails closed instead of guessing. Event payload reducers accept JSON numbers only
   (`count` ignores payload), state presence collapses overlapping bands to one, and neither path
   manufactures a quiet-day zero.
   When this changes production SQL, first update `VIEW_MIGRATION_RELPATH` to a new timestamped,
   nonexistent migration, then run `npm run view:write`. The generator refuses to overwrite a
   landed migration; `--check` continues to prove the current target has not drifted.
4. (self-report only) add the UI input; (optional) add rule blueprints that use it.
5. 2-reviewer `shared/` PR. Green tests = nothing silently broke.

## Remove a metric (soft-deprecate)

1. Set `status: 'deprecated'` + `deprecatedAt` — **do not delete the entry.**
2. Collection UI stops offering it; baselines skip it; the engine rejects *new* rules using it;
   existing baselines/cards that reference the key still resolve (entry still present).
3. After a deprecation window, a single migration drops the column **and** the entry is removed
   together (the schema guard keeps them in lockstep).

## Guard couplings

These edges enforce the registry, defined in [`docs/graph/couplings.yaml`](../../docs/graph/couplings.yaml)
with tests in [`apps/biotope/test/guards/`](../../apps/biotope/test/guards/):

- `metrics-registry-ts-dart-parity` — `registry.ts` == `registry.dart`
- `metrics-registry-to-contract` — registry keys (per table) == contract row fields (TS + Dart)
- `metrics-registry-to-schema` — registry keys (per table) == migration columns
- `metrics-registry-to-baselines` — `compute-baselines` derives its list from the registry
- `metrics-registry-to-engine` — every rule `metricKey` resolves to an active registry entry
- `metrics-registry-to-dqs` — the M2 normaliser's daily-core DQS weights == the registry's `countsTowardDailyCompleteness` weights
