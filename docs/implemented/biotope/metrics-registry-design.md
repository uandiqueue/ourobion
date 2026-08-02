---
title: Metrics Registry — Design
summary: Why the metric registry (shared/metrics/) is a code-registry-plus-parity-guard so adding/removing a metric is a localized, guard-protected change; agents read this for the rationale, the derive-from-registry consumers, the guards, and the add/remove runbook. The MetricDefinition shape itself is owned by shared/metrics/README.md.
type: design
scope: biotope
status: canonical
updated: 2026-07-31
---
# Metrics Registry — Design

A single source of truth for every metric ourobion collects, so **adding or removing a metric is a
localized, guard-protected change** — incomplete propagation fails a test (`flutter test` /
`context_sync --check` / CI) instead of silently breaking at runtime.

## Why

Metric keys are currently hardcoded in **several unlinked places**, with no compile-time link across the
Dart / TypeScript / SQL seam:

- `shared/types/index.ts` + `index.dart` — the `DailyGutRow` / `DailyPhysioRow` / `DailyEnvRow` fields
- `supabase/functions/compute-baselines/index.ts` — a `GUT_METRIC_KEYS` / `WEARABLE_METRIC_KEYS` array **and** the explicit SQL `SELECT` column list
- `supabase/functions/generate-insights/index.ts` — each rule's `metricKey`
- the M2 logging screens, the DQS weighting (M2 normaliser), the seed script, and the docs tables

**This drifted.** Before the registry, the wearable contract and the baseline function disagreed — e.g.:

| Contract (`DailyPhysioRow`) | `compute-baselines` (`WEARABLE_METRIC_KEYS`) |
|---|---|
| `resting_hr` | `resting_hr_bpm` |
| `hrv_rmssd` | `hrv_sdnn_ms` |
| `skin_temp_delta` | `body_temp_c` |
| `respiratory_rate`, `sleep_fragmentation` | `spo2_pct`, `step_count` |

No test caught it because the Supabase client speaks dynamic JSON. A registry + guards turns each such
mismatch into a failing build (this specific drift is now resolved — see the RESOLVED section below).

## Goal

- **One definition per metric**, consumed everywhere else.
- **Add** a metric → add one registry entry; guards then *require* the contract field + migration column
  before anything ships.
- **Remove** a metric → **soft-deprecate** (keep the entry, mark it), so historical baselines/cards keep
  resolving; the column is dropped only after a deprecation window. Nothing referencing the key dangles
  mid-flight. *This is why subtraction won't break the app.*

## Where it lives

`shared/metrics/` — the cross-language seam, mirroring `shared/types`, `shared/constants`, and the
planned `shared/rules`:

```
shared/metrics/
  registry.ts          # canonical metric definitions (the source of truth)
  registry.schema.ts   # zod schema + AssertExact compile-time drift guard (same pattern as shared/rules)
  index.ts             # TypeScript typed accessors
  pubspec.yaml         # local Dart package manifest
  lib/
    ourobion_metrics.dart # public Dart barrel + typed accessors
    src/registry.dart  # private Dart mirror (app side)
  README.md            # the contract + the add / remove runbook
```

**Decision: a code registry + parity guard, not a single JSON file.** It matches the repo's established
cross-language mechanism (parity guards are how `shared/` already holds TS and Dart together), gives
compile-time typing on both sides, and the rules engine already uses zod + `AssertExact` the same way.
(A JSON-single-file alternative is under *Alternatives*.) Registry = **TRUTH** tier (git-tracked,
2-reviewer PR per [memory 0002](../../memory/0002-shared-contract-two-reviewers.md)); baselines / `insight_cards` /
the `rules` table stay rebuildable projections ([memory 0001](../../memory/0001-two-tier-truth.md)).

## The `MetricDefinition` shape

The `MetricDefinition` shape (fields, enums, an example entry) is defined in
[`shared/metrics/README.md`](../../../shared/metrics/README.md) **and only there** — it is the canonical
owner of the shape. Do not restate it here; a table in this doc would drift (an earlier draft's
`source: self_report | wearable | env` is already stale against the shipped
`manual | semi_passive | sensor | api | derived`). This doc keeps the *rationale, guards, and history*;
the README keeps the *shape*.

## What derives from the registry

| Consumer | Reads | Enforced by |
|---|---|---|
| Contract row types (`shared/types`) | field set per `table` | schema guard: row fields == registry keys for that table (TS **and** Dart) |
| Migrations (`supabase/migrations`) | columns per table | schema guard: columns == registry keys (+ type compatibility) |
| M5a `compute-baselines` | the list to baseline | derives from `registry.filter(active && baselineApplicable && table)` — no local literals |
| M5b engine / rules | valid `metricKeys` | guard: every rule `metricKey ∈` registry active keys |
| M2 DQS (normaliser) | daily-core completeness weights | guard-synced to registry `countsTowardDailyCompleteness` weights (`kDailyCoreDqsWeights`); M6 only consumes the resulting `log_completeness` |
| M2/M3/M4 collection + UI | what to collect/show | `self_report` entries drive the log screens |
| `seed-test-data.ps1` | columns to populate | registry keys |
| docs metric tables | the metric list | checked against the registry |

## Guards (new `couplings.yaml` edges — what makes add/remove safe)

Each names a guard test (`status: active`), enforced by `context_sync --check` + CI:

- `metrics-registry-ts-dart-parity` — `registry.ts` == `registry.dart`
- `metrics-registry-to-contract` — registry keys (per table) == `DailyGutRow`/`DailyPhysioRow`/`DailyEnvRow` fields (TS + Dart)
- `metrics-registry-to-schema` — registry keys == migration columns
- `metrics-registry-to-baselines` — `compute-baselines` derives its list from the registry (no stray key literals)
- `metrics-registry-to-engine` — every rule `metricKey` resolves to an active registry entry
- `metrics-registry-to-dqs` — the M2 normaliser's `kDailyCoreDqsWeights` stays in lockstep with the registry's `countsTowardDailyCompleteness` weights

## Add a metric (safe flow)

1. Add **one** entry to `registry.ts` (+ `registry.dart`).
2. Guards fail and tell you exactly what's missing → add the field to the contract row (TS + Dart) + a
   migration `ADD COLUMN <key> … NULL`.
3. Baselines, DQS, and engine validation pick it up **from the registry** — no separate edits.
4. (self-report only) add the UI input; (optional) add rule blueprints that use it.
5. 2-reviewer `shared/` PR. Green tests = nothing silently broke.

## Remove a metric (soft, safe flow)

1. Set `status: "deprecated"` + `deprecatedAt` — **do not delete the entry.**
2. Collection UI stops offering it; baselines skip it; the engine rejects *new* rules using it; existing
   baselines/cards that reference the key still resolve (entry still present).
3. After a deprecation window, a single migration drops the column **and** the entry is removed together
   (the schema guard keeps them in lockstep).

## Fix-on-arrival — RESOLVED (registry seeded from deployed truth)

Standing up the registry forced one canonical set of wearable keys, resolving the
`DailyPhysioRow` ↔ `compute-baselines` drift shown above.

**Correction to an earlier draft of this section.** An earlier version claimed the contract's
`hrv_rmssd` was correct and `compute-baselines`' `hrv_sdnn_ms` was the stale literal to drop. That
was **backwards.** The canonical, deployed truth is the `wearable_daily` migration
(`supabase/migrations/20260528100000_create_m3_wearable_daily.sql`), which the running `WearableService`
upserts to and `compute-baselines` reads from — all three use `resting_hr_bpm`, `hrv_sdnn_ms`,
`sleep_duration_min`, `spo2_pct`, `body_temp_c`, `step_count`. [memory 0004](../../memory/0004-hrv-sdnn-ios-only.md)
confirms `hrv_sdnn_ms` is the intended field (SDNN, iOS/HealthKit only; **null on Android** by design,
which is *why* it is nullable — not a reason to drop it). The stale artifact was the **contract
`DailyPhysioRow`** (the never-implemented placeholder fields `resting_hr`, `hrv_rmssd`,
`sleep_fragmentation`, `respiratory_rate`, `skin_temp_delta`, `region`, `device_type`,
`data_completeness`). The registry was seeded from the deployed columns, and `DailyPhysioRow`
(TS + Dart) was rewritten to match.

## Implementation steps

1. ✅ `shared/metrics/{registry.ts, registry.schema.ts, index.ts}` + local Dart package +
   `README.md`.
2. ✅ Seeded from the **deployed** schema (gut + corrected wearable), all `status: active`. Env (`env_daily`)
   is deferred until the M4 migration lands — the runbook in `shared/metrics/README.md` shows the add flow.
3. ✅ Parity + contract + schema + baselines + engine guards made real (`status: active` in
   `couplings.yaml`, tests in `apps/biotope/test/guards/`). The pre-existing `shared-types-ts-dart-parity` guard
   was also flipped to `active` (the W0 ⛔ guard work — now load-bearing).
4. ✅ `compute-baselines` derives its metric list **and** SELECT columns from the registry import.
5. ✅ DQS weighting synced to the registry: the M2 self-report normaliser's `kDailyCoreDqsWeights`
   (`apps/biotope/lib/modules/m2_self_report/impl/normaliser.dart`) is kept in lockstep with the
   registry's `countsTowardDailyCompleteness` weights by the active `metrics-registry-to-dqs` guard.
   (M6 only consumes the resulting `log_completeness`.)
6. M5a trend-axis placement and wording derive from registry `valueStep`, `scale`, `unit`, and
   minimal `ui` metadata. Armstrong/Bristol category semantics switch on `ui.inputType`, never on a
   metric key; ordinary numeric metrics can be added without editing chart source.

The `shared/` changes are 2-reviewer per [memory 0002](../../memory/0002-shared-contract-two-reviewers.md).

## Alternatives considered

- **Single JSON file read by both languages** — truly one source, but loses compile-time typing, needs
  runtime parsing + Flutter asset bundling, and the typed row classes still need syncing. Rejected for
  inconsistency with the existing `shared/` pattern.
- **Dart codegen (`build_runner`) to generate row classes from the registry** — removes hand-syncing on
  the Dart side but adds a build step. Deferred; the schema guard gives the safety without it. Revisit if
  hand-sync proves painful.

## Open decisions

1. **DQS weights** in the registry vs an M6 config — recommend the registry (single source).
2. **UI metadata** depth — recommend a minimal `{label, inputType}` hint in the registry; rich widget
   config stays in M2.
3. **Dart codegen** now vs later — recommend later.
