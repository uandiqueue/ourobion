# PROJECT-CONTEXT.md — Biotope
> **CONSTANT LAYER** — Change only at formal phase transitions or full team agreement.
> Last updated: Phase 1 Stage 1 (MVP)

---

## What We Are Building

Biotope is a One Health personal ecological health monitor for the ASEAN market.
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
4. **PDPA compliance** — Personal health data is isolated from environmental/community data.
   Consent is granular and captured at onboarding. See M1.
5. **Privacy-safe community** — Aggregated community data only published at minimum user
   thresholds per region. Individual data never exposed.

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
M3  Passive Health & Wearable       ← depends on M1  [DEFERRED — Phase 1 Stage 2]
M4  Environmental & Outbreak        ← depends on M1  [DEFERRED — Phase 1 Stage 3]
M5a Baselines & Data Pipeline       ← depends on M2, M3, M4
M5b Insight Engine                  ← depends on M5a, M1 (copy rules)
M6  Engagement & Motivation         ← depends on M2 (completeness), M5b (InsightFiredEvent)
M7  Community & Ecosystem           ← depends on M4, M2 aggregates  [DORMANT — Phase 3]
```

Full dependency diagram: see `ARCHITECTURE-CONTEXT.md`

---

## Phase & Stage Overview

> Rolling status lives in `AGENTS.md` §6 (phase timeline) — this table is the phase definition only.

| Phase | Focus | Status |
|---|---|---|
| Phase 1 Stage 1 | Easy collection MVP — self-report only, no wearables, no ext APIs | ✅ Complete |
| **Phase 2** (re-baselined 2026-06-11, absorbs old P1S2/P1S3) | Integrated, 2 months, two tracks: foundations + graphify → env APIs (M4, SG-scoped) → Android health (M3) → community v1 + chat (M7 slice) ∥ insights engine (M5b data-driven, cross-metric) → merge → stress test | 🔨 **CURRENT** — see `docs/PHASE2-PLAN.md` |
| Phase 2→3 gate | Stress test: insights engine actually working (7-day unattended cycle, cross-metric cards from real data). Apple/HealthKit decision here. | ⏳ Gate |
| Phase 3 | Gamification **game** (open-world pixel, D&D playstyle — concept TBD) + UI redesign (Blender, AI-assisted); Insight Lab | ⏳ Future |

---

## Current Scope (Phase 1 Stage 1 — MVP)

**In scope:**
- M1: Auth, profiles, consent, non-diagnostic copy framework
- M2: All self-report logging (urine, stool, food, mosquito, antibiotics, daily check-in, symptoms, notes)
- M5a: 7-day silent baseline computation on M2 data only
- M5b: Descriptive discovery cards only (no threshold alerts)
- M6: Data Quality Score, streak counter, 2 early titles

**Explicitly out of scope for MVP:**
- M3 (wearables) — store toggle only
- M4 (environmental APIs) — store region/city only
- M7 (community) — architectural placeholder only
- Any alert that could be interpreted as diagnostic
- Any cross-metric rule combining more than one signal

---

## Shared Contract (Lock Before Coding)

These types must be agreed by all team members before module work begins.
Defined in `shared/types/`. Changes require team discussion + PR with two reviewers.

- `DailyGutRow` — M2's normalised daily output
- `DailyPhysioRow` — M3's normalised daily output (shape locked now, populated Phase 1 Stage 2)
- `DailyEnvRow` — M4's normalised daily output (shape locked now, populated Phase 1 Stage 3)
- `BaselineSnapshot` — M5a's output per metric per user
- `InsightCard` — M5b's output consumed by frontend + M6
- `InsightFiredEvent` — event M6 listens to (never reads M5b internals)
- `EngagementState` — M6's output (score, streak, titles, rewards)

---

## Team & Module Ownership

> Ownership is maintained in `AGENTS.md` §6 (team workstreams) — summary below.

| Module | Owner | Notes |
|---|---|---|
| M1 Core Platform | Jayden | + database rules, PDPA consent copy, copy-guidelines enforcement, auth/OAuth |
| M2 Self-Report | Alton (Jayden assists) | Largest MVP surface; Flutter UI |
| M3 Wearables | Alton | HealthKit / Health Connect → `wearable_daily` + M5a wearable extension |
| M5a + M5b Intelligence | shared | Depends on M2 being stable |
| M6 Engagement | shared | Depends on M2 completeness signal |
| M4, M7 | TBD (provisional) | Deferred/dormant — own the placeholder + schema |

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

## Expansion Hints (Do Not Build Yet)

> These exist so AI sessions don't accidentally design against them.

- M3 will add physiological confidence scores to every InsightCard — M5b must accommodate a
  `confidence_sources` array on InsightCard from day one (even if empty in MVP).
- M4 will add env context rows — M5a baseline tables must be keyed by `(user_id, date, region)`
  not just `(user_id, date)` so env joins work without schema migration.
- M7 will aggregate M2 fields at region level — M2 output rows must include `region` field
  even in MVP so aggregation is a query, not a backfill.
- Phase 2 will add "Why am I seeing this?" per insight — InsightCard should have a
  `contributing_metrics: string[]` field from day one (empty array in MVP is fine).
- Phase 3 Insight Lab will correlate behaviour with signals — store all raw daily rows,
  never derive-only. Raw data is the asset.
