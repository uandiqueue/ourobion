# Session 20260622T021945Z — uandiqueue — claude — w0-metric-platform-foundation

> Session log format: **Attempted / Changed / Decided / Left / Blockers**.
> First step of any session: read the latest `docs/sessions/` files + run `node tools/context_sync.mjs --session-start`.

- **Device:** uandiqueue · **Agent:** Claude Code (claude-opus-4-8[1m]) · **Branch:** feat/shared/metric-platform-w0 (from dev-phase2)
- **Type:** W0 foundation — registry v2 + tier-aware DQS + activate remaining parity guards. Closes #19.

## Attempted
Complete the agent-appropriate, verifiable slice of Phase 2 W0: the metric-platform spine both tracks
depend on. (PDPA *legal* review and end-to-end *device* verification are out of an agent's reach;
several M1/M2 items already exist — surveyed first.)

## Changed
- **Registry v2** (`shared/metrics/registry.{ts,dart}`, `registry.schema.ts`): added `tier`,
  `continuity`, the 5-source economy (`manual`/`semi_passive`/`sensor`/`api`/`derived`), `reliability`,
  `derivedFrom[]`, `availability`, `preferredSource`; re-tagged all 19 metrics (gut=manual,
  wearable=sensor, stool_variability/log_completeness=derived). Kept `table` (non-breaking). zod schema
  + `AssertExact` extended; added invariants (derived⇒derivedFrom; only T1 counts; weight⇒counts).
  Set the `dqs` weights to the **real** DQS weights (urine 25/stool_form 25/outside_meals 20/
  mosquito_bites 10/energy 7/mood 7/gut_comfort 6 = 100).
- **Tier-aware DQS** (`m2_self_report/impl/normaliser.dart` — was empty): pure `computeDqs()` +
  `kDailyCoreDqsWeights`; `daily_log_screen.dart` now delegates to it (numerically identical). Unit
  tests in `src/test/m2_self_report/normaliser_test.dart`.
- **Contract drift fixed**: `DailyGutRow.date` → `log_date` (TS + Dart) to match the `daily_gut_rows`
  column — resolves the long-flagged gut date drift.
- **Guards activated** (`couplings.yaml` planned→active + real assertions): `copy-guidelines-ts-dart-parity`,
  `daily-gut-row-to-schema`; **new** `metrics-registry-to-dqs` (normaliser weights == registry
  countsTowardDailyCompleteness weights). Parser helpers added to `guard_support.dart`.
- README field table updated for v2.

## Decided
- `table` retained alongside the new `continuity` during the storage transition (decoupling fully would
  break the schema/contract guards now); storage primitives land with their first consumer (per replan).
- DQS made registry-driven via a **guard** (not an import) because `src/` can't import the `shared/`
  parity mirrors — consistent with the repo's guard-based anti-drift model.

## Left (handed off — not agent-completable this session)
- Storage-primitive tables (`events`/`state_bands`/`signals`/`derived_metrics`): land with first consumer.
- Local notifications + antibiotic dose reminders: needs a package + device (Alton, M2/M3).
- Standing-water weekly audit + symptom gateway UX: M2 (Alton); screens partly exist.
- Granular *sensor* consent (location/mic/camera) UI + PDPA legal copy: M1 + legal (Jayden + lawyer).
  (Note: 4 data-scope consents already exist; the sensor surface is the new part.)
- Profile device/health-permission fields: with W1.
- PDPA consent legal review: human/legal.

## Blockers
- None. Verified: `tsc --noEmit` clean; `flutter analyze` clean; `flutter test` 30 passed / 0 skipped;
  `context_sync --check` passed.
