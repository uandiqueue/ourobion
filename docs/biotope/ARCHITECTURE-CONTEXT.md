# ARCHITECTURE-CONTEXT.md — Ourobion
> **CONSTANT LAYER** — system structure, data flow, and module interface rules. Update only at phase
> transitions. Current phase scope lives in [`PHASE2-PLAN.md`](../shared/PHASE2-PLAN.md).

---

## Module Dependency Graph

```
┌─────────────────────────────────────────────────────────────┐
│                    SHARED / TYPES                           │
│  DailyGutRow  DailyPhysioRow  DailyEnvRow  InsightCard      │
│  BaselineSnapshot  InsightFiredEvent  EngagementState        │
└──────────────────────────┬──────────────────────────────────┘
                           │ all modules read from here
          ┌────────────────┼────────────────┐
          │                │                │
    ┌─────▼──────┐         │         ┌──────▼──────┐
    │     M1     │         │         │     M1      │
    │  Core &    │◄────────┼─────────│  (auth +    │
    │ Compliance │         │         │ copy rules) │
    └─────┬──────┘         │         └─────────────┘
          │                │
    ┌─────▼──────┐   ┌─────▼──────┐   ┌─────────────┐
    │     M2     │   │     M3     │   │     M4      │
    │Self-Report │   │  Passive   │   │Environment  │
    │Gut & Behav │   │  Health    │   │& Outbreak   │
    └─────┬──────┘   └─────┬──────┘   └──────┬──────┘
          │                │                  │
          └────────────────┼──────────────────┘
                           │
                    ┌──────▼──────┐
                    │    M5a      │
                    │ Baselines & │
                    │  Pipeline   │
                    └──────┬──────┘
                           │  BaselineSnapshot
                    ┌──────▼──────┐
                    │    M5b      │
                    │   Insight   │
                    │   Engine    │
                    └──────┬──────┘
                           │  InsightFiredEvent
                    ┌──────▼──────┐        ┌─────────────┐
                    │     M6      │        │     M7      │
                    │ Engagement  │        │  Community  │
                    │ Motivation  │        │             │
                    └─────────────┘        └─────────────┘
```

---

## Data Flow — the self-report loop

```
User taps logging UI
        │
        ▼
  M2 logging layer
  validates + normalises input
        │
        ▼
  Supabase: daily_gut_rows table
  (DailyGutRow shape)
        │
        ├──────────────────────────────────────────────────────┐
        │                                                      │
        ▼                                                      ▼
  M5a baseline job                                     M6 completeness
  (runs nightly via pg_cron)                           (reads same table,
  computes 7-day rolling                               computes DQS score
  averages per metric                                  in real time)
        │                                                      │
        ▼                                                      ▼
  baseline_snapshots table                          engagement_state table
  (BaselineSnapshot shape)                          (EngagementState shape)
        │
        ▼
  M5b discovery card generator
  (reads baselines + raw rows)
        │
        ▼
  insight_cards table
  (InsightCard shape)
  + fires InsightFiredEvent
        │
        ▼
  Frontend Insights tab
  + M6 listens to InsightFiredEvent
    for reward triggers
```

---

## Database Table Overview

> Full schema definitions in `shared/types/`. Tables listed here for orientation only.

| Table | Owner Module |
|---|---|
| `profiles` | M1 |
| `consent_records` | M1 |
| `daily_gut_rows` | M2 |
| `antibiotic_courses` | M2 |
| `wearable_daily` | M3 |
| `baseline_snapshots` | M5a |
| `insight_cards` | M5b |
| `engagement_state` | M6 |
| `env_daily` | M4 — *planned (Phase 2 Track A); not yet migrated* |
| `community_aggregates` | M7 — *planned (Phase 2 Track A); not yet migrated* |

---

## Module Interface Rules

1. **M2 → M5a**: M5a reads `daily_gut_rows` directly from DB — no function-call boundary. Expose a
   `getMetricSeries(userId, metric, days)` function if M5b later needs programmatic access.

2. **M5a → M5b**: M5b reads `baseline_snapshots` table. M5a also exposes
   `getBaseline(userId, metric): BaselineSnapshot` for synchronous lookups.

3. **M5b → M6**: M5b fires `InsightFiredEvent` via Supabase Realtime or Edge Function event.
   M6 never reads `insight_cards` table directly — it only responds to the event.

4. **M5b → Frontend**: Frontend reads `insight_cards` table directly via Supabase client.
   M5b does not own the UI — it only owns the card data.

5. **M1 → All**: All modules call `M1.verifyAuth(token)` and read from
   `M1.getCopyRules()` for non-diagnostic string enforcement. M1 exposes these
   via its public index only.

6. **No module imports from `/impl` of another module.** Ever.

---

## Phase Transition Checklist

When moving between phases, update this file to:
- [ ] Change deferred/dormant module statuses
- [ ] Add any new tables to the table overview
- [ ] Update the data flow diagram if new pipelines are introduced
- [ ] Tag the Git release before merging phase-transition PRs

---

## Design constraints (forethought baked into the schema)

- **Cross-metric rules (M5b):** M5a must support multi-metric baseline queries, not just per-metric
  lookups — the data-driven engine evaluates `correlation` over 2+ metrics.
- **M7 region aggregation:** community aggregation GROUPs BY region on `daily_gut_rows` — the `region`
  column is present and indexed so this stays a query, not a backfill.
- **Pluggable baseline sources:** M3 wearable data feeds M5a alongside M2 data — M5a's baseline logic
  treats data sources as pluggable, never hardcoded to M2 only.
