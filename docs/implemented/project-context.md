---
title: Project Context
summary: Constant-layer product brief — what Ourobion is (One Health monitor for ASEAN), the non-negotiable principles (non-diagnostic, 30-second logging, PDPA), tech stack, and a pointer to the module map. Biotope-centric by origin; it predates Nao and the brain pipeline, which are covered in ../README.md.
type: context
scope: repo
status: unverified
updated: 2026-08-02
---

# project-context.md — Ourobion
> **CONSTANT LAYER** — product principles, tech stack, module map, and the shared contract. Change
> only at formal phase transitions or full team agreement. Current phase scope + sequencing live in
> [`phase-2-plan.md`](../development/phase-2-plan.md).

> **Evidence class — read before citing.** Authored design narrative, not runtime proof. Per
> [`AGENTS.md`](../../AGENTS.md) §7, `docs/implemented/` is stale older design material and is not
> present-state authority; the code, migrations, and contracts win on any disagreement.
> **Scope warning:** this document was written when Biotope was the whole product. It does not
> describe **Nao**, the **brain pipeline**, or the Cloudflare surfaces, all of which now exist. For a
> reconciled whole-system view use [`README.md`](README.md). Points known to describe a target rather
> than current behaviour are marked **[TARGET — not implemented]** inline.

---

## What We Are Building

Ourobion is an agentic research system for health evidence: a pipeline that turns scientific
literature into independently reviewed relationships between health measures, plus the products that
consume them.

**Biotope**, the phone app, is the One Health personal ecological health monitor for the ASEAN
market. It connects human physiology, daily behaviour, and environmental context to help users
understand patterns in their gut health, hydration, vector exposure, and ecological
wellbeing — without making diagnostic claims. **Nao** is the research workbench where any
relationship can be opened and inspected.

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
| Mobile app (Biotope) | Flutter (iOS + Android) |
| Operator app (Nao) | Next.js on an OpenNext **Cloudflare Worker** (not Cloudflare Pages) |
| Backend / DB | Supabase (Postgres + Auth + Storage + Edge Functions) |
| Auth providers | Email; Google and Apple client hooks exist, but provider availability depends on external Supabase configuration and is not proven by this repository |
| State management | Riverpod |
| Background jobs | Supabase Edge Functions + pg_cron; GitHub Actions for work exceeding a Worker request lifetime |
| Corpus / artifacts | Cloudflare **R2** (canonical store) with **D1** as a rebuildable Nao search projection |
| Shared types | Dart (app) + TypeScript (backend/functions) |
| CI/CD | GitHub Actions |
| Hosting | Supabase (backend), Cloudflare Workers (Nao). **[TARGET]** No App Store or Play Store release is established in this repository — no release APK or store listing exists. |

> ⚠️ Stack decisions are CONSTANT. Changes require full team agreement and project-context.md update.

> The Nao, Cloudflare, and GitHub-Actions rows postdate this document's original Biotope-only framing
> and were added during reconciliation. GitHub Actions is an automation bridge for long-running work,
> not the normal runtime data path for either application.

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

Full dependency diagram: see `biotope/architecture-context.md`

---

## Phases

> Phase definitions only. Current scope, sequencing, and the gate live in
> [`phase-2-plan.md`](../development/phase-2-plan.md); per-session status in `docs/sessions/`.

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

> **Team composition is owned by [`docs/memory/0025-team-composition.md`](../memory/0025-team-composition.md)**
> (accepted, Jayden-verified). Read it there; it is not duplicated here.
>
> The previous pointer in this file — "`AGENTS.md` §6 (team workstreams)" — was stale in two ways:
> AGENTS.md §6 is *Delegation invariants*, and AGENTS.md deliberately carries no team assignments at
> all. The module-ownership table that stood here listed a two-person team and is superseded by 0025,
> which records **three** members (Jayden, Alton, Janson). Two-person references are origin history
> only.

Module *ownership* rotates with the run and is therefore not fixed in this constant layer. For who is
working on what right now, use the active issue/PR record and the current run docs under
[`docs/development/`](../development/).

---

## Team Conventions

- Branch naming: `feat/m{n}-{module-name}/{short-description}`
- No module imports from another module's `/impl` — public `index` only
- All user-facing strings must pass the non-diagnostic language check
- One append-only session log per session in `docs/sessions/` (enforced — see `AGENTS.md` §4, *Agent
  work protocol → Session record*; §7 is *Documentation and owner verification*)
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
