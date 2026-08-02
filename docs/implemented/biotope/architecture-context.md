---
title: biotope Architecture Context (module map)
summary: The authored module map for biotope's Flutter app (M1–M7 dependency graph, self-report data flow, table ownership, module-interface rules). Mixed current/target — the M5b→M6 event path is designed but not implemented. Contract types live in SHARED-CONTEXT.md; the v2 engine + brain flow live in insight-engine-architecture.md.
type: context
scope: biotope
status: unverified
updated: 2026-08-02
---
# architecture-context.md — Ourobion
> **CONSTANT LAYER** — system structure, data flow, and module interface rules. Update only at phase
> transitions. Current phase scope lives in [`phase-2-plan.md`](../../development/phase-2-plan.md).

> **Evidence class — read before citing.** This is authored design narrative, not runtime proof.
> Per [`AGENTS.md`](../../../AGENTS.md) §7, `docs/implemented/` is stale older design material and is
> not present-state authority. Where this file and the code disagree, the code wins: see
> [`supabase/migrations/`](../../../supabase/migrations/), [`shared/`](../../../shared/), and the
> reconciled summary in [`../README.md`](../README.md). Points where this file is known to describe a
> target rather than current behaviour are marked **[TARGET — not implemented]** inline.

> **Engine v2 / brain flow.** The module map and self-report loop below are the *constant structure* of
> the biotope app. The end-to-end **insight-engine v2** (deterministic serve path + offline authoring/
> brain edge flow) — which extends the MVP self-report loop diagrammed below — is owned by
> [`insight-engine-architecture`](../shared/insight-engine-architecture.md). Contract **types** are
> enumerated in [`SHARED-CONTEXT`](../../../shared/SHARED-CONTEXT.md), not here.

---

## Module Dependency Graph

```
┌─────────────────────────────────────────────────────────────┐
│                    SHARED / TYPES                           │
│   contract types enumerated in SHARED-CONTEXT.md (not here) │
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
    └─────┬──────┘   └─────┬──────┘   └───────┬─────┘
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
                           │  InsightFiredEvent [TARGET — not emitted]
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
        │
        ▼
  Frontend Insights tab
```

> **[TARGET — not implemented]** The diagram above once showed M5b firing an `InsightFiredEvent` that
> M6 consumed for reward triggers. That path does not exist in code. `InsightFiredEvent` is declared
> in [`shared/types/index.ts`](../../../shared/types/index.ts) and
> [`index.dart`](../../../shared/types/index.dart) and asserted by a parity test, but it is never
> emitted or consumed by any app, edge function, or SQL. M6 currently recomputes engagement from
> `daily_gut_rows` after a log write, shown as the right-hand branch above. Keep the contract type —
> removing it is a shared-contract change — but do not describe the event as a live flow.

---

## Database Table Overview

> Supabase migrations in `supabase/migrations/` are the full schema truth. Tables listed here are an
> intentionally small module-orientation view, not a complete database inventory.

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

3. **M5b → M6**: **[TARGET — not implemented]** The intended boundary is that M5b fires
   `InsightFiredEvent` via Supabase Realtime or an Edge Function event and M6 never reads
   `insight_cards` directly. No emitter or subscriber exists. M6 today derives engagement from
   `daily_gut_rows` after a log write and does not observe card generation at all. Treat this rule as
   the boundary to preserve when the event is built, not as a description of current wiring.

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
