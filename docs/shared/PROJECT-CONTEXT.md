# PROJECT-CONTEXT.md — Ourobion
> **CONSTANT LAYER** — product principles, tech stack, module map, and the shared contract. Change
> only at formal phase transitions or full team agreement. Current phase scope + sequencing live in
> [`PHASE2-PLAN.md`](PHASE2-PLAN.md).

---

## What We Are Building

Ourobion is a One Health personal ecological health monitor for the ASEAN market.
It connects human physiology, daily behaviour, and environmental context to help users
understand patterns in their gut health, hydration, vector exposure, and ecological
wellbeing — without making diagnostic claims.

Users log a small set of high-yield health signals in under 30 seconds per day.
The app surfaces descriptive patterns and insight cards. It never diagnoses.

---

## Product Principles (Non-Negotiable)

1. **Non-diagnostic always** — Every user-facing string must use observational language.
   No "you may have X". Only "your data shows a pattern". See `shared/constants/copy_guidelines.ts`.
2. **30-second logging** — The daily log flow must never exceed 30 seconds for core fields.
3. **Graceful degradation** — Features that depend on wearables or external APIs must have
   wearable-free and offline-safe fallbacks. Wearables and env data are confidence multipliers,
   never hard gates.
4. **PDPA compliance — deferred past the demo.** The current build is a **demo with all user data in
   Supabase**; PDPA data-isolation, granular per-source consent, and on-device raw-signal processing are
   re-instated when we move past the basics / start scaling — not built now.
5. **Privacy-safe community — aggregates only.** Community surfaces publish **aggregates only, never
   individual rows**. Regional minimum-threshold publishing returns when the user base justifies it.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Mobile app | Flutter (iOS + Android) |
| Backend / DB | Supabase (Postgres + Auth + Storage + Edge Functions) |
| Auth providers | Email, Google, Apple |
| State management | Riverpod |
| Background jobs | Supabase Edge Functions + pg_cron |
| Shared types | Dart (app) + TypeScript (backend/functions) |
| CI/CD | GitHub Actions |
| Hosting | Supabase (backend), App Store + Play Store (mobile) |

> ⚠️ Stack decisions are CONSTANT. Changes require full team agreement and PROJECT-CONTEXT.md update.

---

## Module Map

```
M1  Core Platform & Compliance      ← foundation, no dependencies
M2  Self-Report: Gut & Behaviour    ← depends on M1
M3  Passive Health & Wearable       ← depends on M1
M4  Environmental & Outbreak        ← depends on M1
M5a Baselines & Data Pipeline       ← depends on M2, M3, M4
M5b Insight Engine                  ← depends on M5a, M1 (copy rules)
M6  Engagement & Motivation         ← depends on M2 (completeness), M5b (InsightFiredEvent)
M7  Community & Ecosystem           ← depends on M4, M2 aggregates
```

Full dependency diagram: see `biotope/ARCHITECTURE-CONTEXT.md`

---

## Phases

> Phase definitions only. Current scope, sequencing, and the gate live in
> [`PHASE2-PLAN.md`](PHASE2-PLAN.md); per-session status in `docs/sessions/`.

| Phase | Focus |
|---|---|
| Phase 1 | Easy-collection MVP — the self-report loop end to end (M1 auth, M2 logging, M5a baselines, M5b discovery cards, M6 engagement); no wearables, no external APIs. |
| Phase 2 | Turn the MVP loop into the real product, two tracks: foundations + graphify → env APIs (M4, SG-scoped) → Android health (M3) → community v1 + chat (M7 slice) ∥ data-driven cross-metric insights engine (M5b) → merge → stress test. |
| Phase 2→3 gate | Stress test: the insights engine actually working (7-day unattended cycle, cross-metric cards from real data). Apple/HealthKit decision made here. |
| Phase 3 | Gamification **game** (open-world pixel, D&D playstyle — concept TBD) + UI redesign (Blender, AI-assisted); Insight Lab. |

---

## Shared Contract (Lock Before Coding)

These types must be agreed by all team members before module work begins.
Defined in `shared/types/`. Changes require team discussion + PR with two reviewers.

- `DailyGutRow` — M2's normalised daily output
- `DailyPhysioRow` — M3's normalised daily output (populated by the wearable integration)
- `DailyEnvRow` — M4's normalised daily output (populated by the env ingestion function)
- `BaselineSnapshot` — M5a's output per metric per user
- `InsightCard` — M5b's output consumed by frontend + M6
- `InsightFiredEvent` — event M6 listens to (never reads M5b internals)
- `EngagementState` — M6's output (score, streak, titles, rewards)

---

## Team & Module Ownership

> Ownership is maintained in `AGENTS.md` §6 (team workstreams) — summary below.

| Module | Owner | Notes |
|---|---|---|
| M1 Core Platform | Jayden | + database rules, copy-guidelines enforcement, auth/OAuth (PDPA/consent deferred past demo) |
| M2 Self-Report | Alton (Jayden assists) | Largest MVP surface; Flutter UI |
| M3 Wearables | Alton | HealthKit / Health Connect → `wearable_daily` + M5a wearable extension |
| M5a + M5b Intelligence | shared | Depends on M2 being stable |
| M6 Engagement | shared | Depends on M2 completeness signal |
| M4 Environmental | Jayden | Env ingestion → `env_daily` (SG-scoped); see `PHASE2-PLAN.md` Track A |
| M7 Community | shared | Global aggregates + chat first slice; see `PHASE2-PLAN.md` Track A |

---

## Team Conventions

- Branch naming: `feat/m{n}-{module-name}/{short-description}`
- No module imports from another module's `/impl` — public `index` only
- All user-facing strings must pass the non-diagnostic language check
- One append-only session log per session in `docs/sessions/` (enforced — see `AGENTS.md` §7)
- Shared types changes require PR with 2 reviewers
- Tests required before any PR merge to main
- `main` is always deployable

---

## Schema forethought (why these fields exist)

> Contracts carry fields ahead of the feature that fills them, so later modules join in without a
> migration. Don't remove them because they look unused.

- **`InsightCard.confidence_sources[]`** — M3 attaches physiological confidence to each card; the
  array exists on `InsightCard` so M5b accommodates it whether or not wearable data is present.
- **Baselines keyed by `(user_id, date, region)`** — so M4 env rows join without a schema migration.
- **`region` on every daily row** — so M7 community aggregation is a query, not a backfill.
- **`InsightCard.contributing_metrics: string[]`** — powers "Why am I seeing this?"; present from the
  start so the engine can fill it without a contract change.
- **Store all raw daily rows, never derive-only** — raw data is the asset (the Insight Lab payoff).
  See [`docs/memory/0001-two-tier-truth.md`](../memory/0001-two-tier-truth.md).
