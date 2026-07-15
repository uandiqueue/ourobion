# Session 20260619T060221Z — uandiqueue — claude — metrics-registry-shared-parity

> Session log format: **Attempted / Changed / Decided / Left / Blockers**.
> First step of any session: read the latest `docs/sessions/` files + run `node tools/context_sync.mjs --session-start`.

- **Device:** uandiqueue · **Agent:** Claude Code (claude-opus-4-8[1m]) · **Branch:** feat/m5a-metrics/registry (cut from dev-phase2)
- **Type:** W0 Foundations — implement the metrics registry, fix the wearable-key drift, complete + parity-guard the Dart shared contracts. Closes #14.

## Attempted
Implement `docs/METRICS-REGISTRY-DESIGN.md`: stand up `shared/metrics/` as the single source of truth,
resolve the live `DailyPhysioRow` ↔ `compute-baselines` wearable-key drift, and finish the W0 ⛔
"Dart shared contracts" + parity-guard blockers.

## Changed
- **New `shared/metrics/`** — `registry.ts` (20 metrics, gut + wearable, the single source of truth),
  `registry.schema.ts` (zod schema + compile-time `AssertExact`), `index.ts` accessors, Dart mirror
  `registry.dart` + `index.dart`, and `README.md` (add/remove runbook).
- **Fixed contract** — rewrote `shared/types/index.ts` `DailyPhysioRow` to the deployed `wearable_daily`
  shape (`resting_hr_bpm`, `hrv_sdnn_ms`, `sleep_duration_min`, `spo2_pct`, `body_temp_c`, `step_count`,
  `source`, `synced_at`).
- **TS↔Dart parity** — completed `shared/types/index.dart`: all 7 contract types with `fromJson`/`toJson`
  (was 1 stub + a 6-type TODO).
- **compute-baselines** — derives its per-table metric keys **and** SELECT columns from the registry
  import (no hardcoded key arrays).
- **Guards now load-bearing** — `shared-types-ts-dart-parity` flipped `planned → active`; added 5 registry
  guards (`metrics-registry-{ts-dart-parity,to-contract,to-schema,to-baselines,to-engine}`) in
  `couplings.yaml` + real assertions in `src/test/guards/` (+ `guard_support.dart` parser helpers).
- **Docs** — corrected `METRICS-REGISTRY-DESIGN.md` (its "fix-on-arrival" was backwards), `SHARED-CONTEXT.md`
  (`DailyPhysioRow` + `BaselineSnapshot` example), `PHASE2-PLAN.md` (wearable metric list); `tsconfig.json`
  now compiles `metrics/**`.

## Decided
- **Canonical wearable shape = the deployed `wearable_daily` migration**, not the contract. The migration,
  `WearableService`, `compute-baselines`, and memory 0004 all agree on `hrv_sdnn_ms` (SDNN, iOS-only,
  null on Android by design). The design doc's earlier claim ("drop `hrv_sdnn_ms`, keep `hrv_rmssd`") was
  backwards and is corrected. The stale `DailyPhysioRow` placeholder fields were removed.
- **Registry is a code registry + parity guards** (per the design), not a JSON file — matches the existing
  `shared/` cross-language mechanism. TRUTH tier → 2-reviewer `shared/` PR (memory 0002).

## Left
- **M6 DQS wiring** (design step 5): registry carries `dqs` weights; pointing M6 at `registry.dqs` is pending.
- **Gut `date` vs `log_date` drift**: contract `DailyGutRow.date` vs table column `log_date`; left
  `daily-gut-row-to-schema` as `status: planned`. Follow-up.
- **`env_daily` metrics**: not added (no M4 migration yet); README runbook covers adding them later.
- **Deploy check**: `compute-baselines` now imports `../../../shared/metrics/registry.ts` — verify the
  Supabase cross-dir bundle on `supabase functions deploy` (not runnable locally).

## Blockers
- None. Verified locally: `tsc --noEmit` clean; `flutter test` 20 passed / 2 skipped; `flutter analyze`
  clean; `node tools/context_sync.mjs --check` passed.
