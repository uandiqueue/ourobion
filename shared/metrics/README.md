# Metrics Registry

`registry.ts` is **the single source of truth** for every metric biotope collects.
`registry.dart` is its faithful mirror for the Flutter app. The two are held in lockstep by
guards — adding or removing a metric is a localized, guard-protected change, so incomplete
propagation fails the build instead of silently breaking at runtime.

See [`docs/METRICS-REGISTRY-DESIGN.md`](../../docs/METRICS-REGISTRY-DESIGN.md) for the full design.

## `MetricDefinition` fields

| Field | Meaning |
|---|---|
| `key` | canonical snake_case id — **== DB column == `metric_key` == rule `metricKey`** |
| `source` | source economy: `manual` \| `semi_passive` \| `sensor` \| `api` \| `derived` |
| `table` | current storage location: `daily_gut_rows` \| `wearable_daily` \| `env_daily` (storage is migrating to continuity-based primitives — see PHASE2-PLAN) |
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
| `ui` | optional `{ label, inputType }` hint for M2 self-report screens |
| `status` | `active` \| `deprecated` |
| `introducedIn` / `deprecatedAt` | lifecycle stamps |

Typed accessors live in `index.ts` / `index.dart` (`activeMetrics`, `metricByKey`,
`metricsByTable`, `baselineKeys`, `activeKeys`, `isActiveMetric`, `dqsWeights`,
`dailyCompletenessKeys`) — consumers read the list through these, never hardcoded keys.

## Add a metric (safe flow)

1. Add **one** entry to `registry.ts` **and** `registry.dart` (same key, same order within its
   source block).
2. Guards fail and tell you exactly what's missing → add the field to the contract row (TS + Dart)
   plus a migration `ADD COLUMN <key> … NULL`.
3. Baselines, DQS, and engine validation pick it up **from the registry** — no separate edits.
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
with tests in [`src/test/guards/`](../../src/test/guards/):

- `metrics-registry-ts-dart-parity` — `registry.ts` == `registry.dart`
- `metrics-registry-to-contract` — registry keys (per table) == contract row fields (TS + Dart)
- `metrics-registry-to-schema` — registry keys (per table) == migration columns
- `metrics-registry-to-baselines` — `compute-baselines` derives its list from the registry
- `metrics-registry-to-engine` — every rule `metricKey` resolves to an active registry entry
- `metrics-registry-to-dqs` — the M2 normaliser's daily-core DQS weights == the registry's `countsTowardDailyCompleteness` weights
