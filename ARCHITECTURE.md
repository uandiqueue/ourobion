# ARCHITECTURE.md — Biotope
> **CONSTANT LAYER** — Update only at phase transitions.
> Last updated: Phase 1 Stage 1 (MVP)

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
    │ [ACTIVE]   │   │[DEFERRED]  │   │ [DEFERRED]  │
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
                    │ Motivation  │        │ [DORMANT]   │
                    └─────────────┘        └─────────────┘
```

---

## Data Flow — Phase 1 Stage 1 (MVP)

```
User taps logging UI
        │
        ▼
  M2 logging controller
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
  (Phase 1: descriptive only,
   reads baselines + raw rows)
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

| Table | Owner Module | Phase Added |
|---|---|---|
| `profiles` | M1 | Stage 1 |
| `consent_records` | M1 | Stage 1 |
| `daily_gut_rows` | M2 | Stage 1 |
| `antibiotic_courses` | M2 | Stage 1 |
| `wearable_daily` | M3 | Stage 2 |
| `env_daily` | M4 | Stage 3 |
| `baseline_snapshots` | M5a | Stage 1 |
| `insight_cards` | M5b | Stage 1 |
| `engagement_state` | M6 | Stage 1 |
| `community_aggregates` | M7 | Phase 3 |

---

## Module Interface Rules

1. **M2 → M5a**: M5a reads `daily_gut_rows` directly from DB. No function call boundary needed
   for MVP. In Phase 2, expose a `getMetricSeries(userId, metric, days)` function if M5b
   needs programmatic access.

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

## Expansion Hints (Read-Only for MVP)

- Phase 2 will introduce cross-metric rules in M5b — M5a must support multi-metric
  baseline queries, not just per-metric lookups.
- Phase 3 M7 aggregation will GROUP BY region on `daily_gut_rows` — ensure `region`
  column is present and indexed from Stage 1.
- M3 wearable data will feed into M5a alongside M2 data — M5a's baseline logic
  must treat data sources as pluggable, not hardcoded to M2 only.