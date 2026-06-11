# Phase 2 — Consolidated Goals & Feature List

> **Status:** CONSOLIDATION (issue #6, 2026-06-11). This doc gathers **every past and present goal**
> scattered across `PROJECT-CONTEXT.md`, `ARCHITECTURE-CONTEXT.md`, the module context docs,
> `shared/SHARED-CONTEXT.md` expansion hints, `docs/NEXT-PHASE-PLAN.md`, and `docs/memory/` into one
> human-readable list, and proposes what "Phase 2" actually contains. It is the **anchor for the
> Phase 2 plan** — sequencing/design stays in [`NEXT-PHASE-PLAN.md`](NEXT-PHASE-PLAN.md) (engine
> pipeline detail, still valid) and the integrated plan that follows once this list is approved.
>
> Plain-language companion: [`human-briefs/2026-06-11-phase2-goals-and-features.md`](human-briefs/2026-06-11-phase2-goals-and-features.md).

---

## The product in one paragraph

Biotope is a **One Health personal ecological health monitor** for the ASEAN market. Users log a few
high-yield health signals in under 30 seconds a day; the app quietly adds passive data from their
watch/phone and (later) their environment, finds **descriptive patterns** — never diagnoses — and
keeps them motivated to log through streaks, scores, and titles. Eventually, individuals see their
patterns in the context of their **region and community**, privacy-safely.

Phase 1 Stage 1 (MVP) shipped the self-report loop end to end: logging → baselines → insight cards →
engagement. **Phase 2 turns that MVP loop into the real product**: passive health data on both
platforms, a true insights engine, the first social/global layer, deeper gamification — with the repo
kept agent-navigable via graphify.

## Goals

| # | Goal | Today | Phase 2 outcome |
|---|---|---|---|
| **G1** | **Stand on a solid floor** — close the MVP's loose ends so nothing downstream builds on stubs. | Dart contracts are stubs, guard tests are placeholders, M1 home screen is a `[DEV]` placeholder, three M2 flows unbuilt. | Contracts complete + parity-guarded; all MVP screens/flows real. |
| **G2** | **The app sees your body, passively** — wearable data flows on both platforms without the user doing anything. | Flutter `WearableService` + `wearable_daily` exist; never proven end-to-end on a real device. | HealthKit (iOS) + Health Connect (Android) verified end-to-end; wearable confidence feeding insights. |
| **G3** | **Insights become an engine, not a hardcoded list** — evidence-backed, cross-metric, explainable. | 6 hardcoded single-metric TypeScript rules; editing a rule = redeploying a function. | Rules are reviewable data; engine evaluates trend/threshold/correlation; cards can say *why* they fired. |
| **G4** | **Health is social and situated** — your patterns alongside your region's, privacy-safe. | M7 is an architectural placeholder; `region` is captured on every row but unused. | First community/global surface: regional aggregates behind minimum-user thresholds, opt-in. |
| **G5** | **Logging stays worth it** — engagement grows beyond streaks. | Streak, DQS, 2 titles (and two computed stats not yet displayed). | Missions/challenges layer; insight-driven engagement; full stat surfacing. |
| **G6** | **The repo stays understandable** — humans and agents navigate a growing codebase without context overload. | Curated docs + couplings.yaml only. | graphify semantic graph of the biotope repo as dev infrastructure (explicitly **not** part of the insights engine). |

## Feature inventory

Everything found in the docs, grouped into workstreams. **Disposition** says where it lands:
**P2** = in Phase 2 · **P2?** = candidate, owner decision needed · **Later** = explicitly after
Phase 2 · **P0** = foundations to clear first (inside Phase 2, sequenced earliest).

### W0 · Foundations — clear first (the old "Phase 0")

The unfinished MVP work everything else builds on. ⛔ = hard prerequisite for the insights engine.

| Feature | What it is | Disposition | Source |
|---|---|---|---|
| ⛔ Dart shared contracts | Finish `shared/types/index.dart` (`BaselineSnapshot`, `InsightCard`, `InsightFiredEvent`, `EngagementState`, `DailyPhysioRow`, `DailyEnvRow` + `fromJson`/`toJson`) and the `getCopyRule()` stub. 2-reviewer PR. | P0 | NEXT-PHASE-PLAN Phase 0 |
| ⛔ Real parity guard tests | Promote the 3 skipped guards (`shared_types_parity`, `copy_guidelines_parity`, `daily_gut_row_schema`) + their `couplings.yaml` edges `planned → active`. | P0 | NEXT-PHASE-PLAN Phase 0 |
| M1 app shell | Replace the `[DEV]` home screen with real Home / Log / Insights / Profile tab navigation. | P0 | m1-context, NEXT-PHASE-PLAN |
| PDPA consent legal review | Singapore-law review of consent copy before any release build. | P0 | m1-context |
| M2 logic extraction | Pull inline DQS/save logic into `normaliser.dart` + `logging_controller.dart` + focused tests. | P0 | m2-context |
| M2 standing-water weekly audit | Weekly (not daily) "standing water present?" prompt with re-ask suppression. | P0 | m2-context |
| M2 symptom flags | Multi-select symptom logging (feverish, nausea, body aches, fatigue, appetite, cramps, headache) — presence-only. | P0 | m2-context |
| M2 antibiotic course tracker | Set up a course (drug, start, duration); app derives `on_antibiotics`/`gut_watch_active`; dose reminders. Needs `antibiotic_service.dart` + local notifications. | P0 | m2-context |
| M6 stat display | Surface `dqs_7day_avg` + `longest_streak` in the home tab. | P0 | NEXT-PHASE-PLAN Phase 0 |
| Local notifications scaffold | Flutter local-notifications setup in M1 (prerequisite for antibiotic reminders). | P0 | m2-context watch-out |

### W1 · Passive health — Apple & Android wearables (M3)

| Feature | What it is | Disposition | Source |
|---|---|---|---|
| ⛔ End-to-end device verification | Real device → `wearable_daily` rows, both platforms. Android emulator/device is free and unblocked; **iOS needs a Mac + paid Apple Developer account** (US$99/yr). | P2 (Android now, iOS when unblocked) | NEXT-PHASE-PLAN ⛔, memory 0010 |
| Wearable confidence into insights | `confidence_sources[]` on insight cards populated from wearable presence; M5a baselines over `DailyPhysioRow` metrics (resting HR, HRV, sleep duration/fragmentation, respiratory rate, skin-temp delta). | P2 | SHARED-CONTEXT, ARCHITECTURE-CONTEXT |
| Device-type tracking | Profile captures device platform + health-permission status. | P2 | m1-context expansion hint |
| Known constraints | HRV SDNN is iOS-only (Android = RMSSD); sync is best-effort, never a hard gate (graceful degradation). | — (constraints, not features) | memory 0004, 0006 |
| Stool/meal venue tags | Optional tags ('loose', 'painful'; 'hawker', 'restaurant') — old "Stage 2" hint. | P2? | m2-context expansion hint |
| Timestamped stool events | Upgrade from one daily entry to timestamped events if variability proves meaningful. | Later | m2-context expansion hint |

### W2 · Insights engine (M5b deep analysis)

The detailed design already exists in [`NEXT-PHASE-PLAN.md`](NEXT-PHASE-PLAN.md) (steps A–E); listed
here as features, not steps.

| Feature | What it is | Disposition | Source |
|---|---|---|---|
| Rules as reviewable data | Git-tracked JSON rule blueprints (`data/rules/**`) → Postgres `rules` projection + loader. Adding a rule = a PR, not a redeploy. | P2 | NEXT-PHASE-PLAN B1–B3, memory 0007 |
| Cross-metric rules | `correlation` condition over 2+ metrics (e.g. sleep down AND gut comfort down) — the headline analytical upgrade. | P2 | NEXT-PHASE-PLAN, PROJECT-CONTEXT Phase 2 |
| Data-driven engine | `generate-insights` refactor to pure evaluators (trend / threshold / correlation), deterministic, non-diagnostic gates at load + render. | P2 | NEXT-PHASE-PLAN C |
| "Why am I seeing this?" | Per-card explanation from `contributing_metrics[]` (field exists since MVP, empty). | P2 | PROJECT-CONTEXT expansion hint |
| Paper → rules extraction | LLM-assisted CLI drafting candidate rules from research PDFs, human-reviewed, budget-capped. Skeleton until the research paper arrives. | P2 (skeleton) | NEXT-PHASE-PLAN B4 |
| AI weekly summary | Optional NL summary layer reading deterministic cards. Additive; engine ships without it. | Later | NEXT-PHASE-PLAN E |

### W3 · Environment & outbreak context (M4) — *buried, decision needed*

The user-visible "One Health" differentiator (weather, vegetation, dengue case rates, outbreak
alerts per region → `env_daily`). Old label: Phase 1 Stage 3, deferred. **It resurfaces now because
two Phase 2 streams want it**: cross-metric rules get their most compelling pairings from env data
(rainfall × mosquito sightings, heat × hydration), and the social/global layer (W4) formally
depends on M4 in the module map.

| Feature | What it is | Disposition | Source |
|---|---|---|---|
| `env_daily` ingestion | External API fetch per region: temp, heat index, rainfall, UV, NDVI/green cover, dengue case rate, outbreak alert. | P2? | SHARED-CONTEXT (DailyEnvRow), ARCHITECTURE-CONTEXT |
| Time-in-green logging | Optional user-logged minutes in green space. | P2? | SHARED-CONTEXT |
| Env consent copy | Consent update explaining how open data combines with personal logs. | P2? (with M4) | m1-context expansion hint |

### W4 · Socials & globals (M7 first slice)

Old label: Phase 3, dormant. Pulled forward per owner direction. Every M2 row already carries
`region`, so a first slice can aggregate **self-report data by region without M4** — but the full
eco-social vision (region env context next to community patterns) wants W3.

| Feature | What it is | Disposition | Source |
|---|---|---|---|
| Regional aggregates | Privacy-safe `community_aggregates`: publish per-region patterns only above a minimum-user threshold; individual data never exposed. | P2 | PROJECT-CONTEXT principle 5, ARCHITECTURE-CONTEXT |
| Community surface | Opt-in screen: "your region this week" alongside the user's own patterns. | P2 | PROJECT-CONTEXT Phase 3 scope, pulled forward |
| Insight Lab | Users correlate their own behaviour with their signals (the raw-rows-are-the-asset payoff). | Later | PROJECT-CONTEXT expansion hint |

### W5 · Gamification (M6 expansion)

| Feature | What it is | Disposition | Source |
|---|---|---|---|
| Missions & challenges | `missions[]` / `challenges[]` on `EngagementState` — time-boxed goals beyond the daily streak. | P2 | SHARED-CONTEXT expansion hint |
| Insight-driven engagement | Track `insight_actions_taken`; reward engaging with insights, not just logging. | P2 | SHARED-CONTEXT expansion hint |
| Title expansion | Grow beyond the 2 MVP titles. | P2 | M6 scope |
| Leaderboards | Region-scoped, privacy-safe ranking. Depends on W4 aggregates + privacy thresholds. | P2? | SHARED-CONTEXT expansion hint |

### W6 · Dev infrastructure — context management (graphify)

**Not a product feature and not part of the insights engine** — repo tooling so agents/humans keep
navigating the codebase as it grows.

| Feature | What it is | Disposition | Source |
|---|---|---|---|
| graphify repo graph | Install + index **biotope's own repo** as a semantic knowledge graph (`docs/graph/generated/`, gitignored until a path-normalizer makes it diff cleanly). Never index NUSPlan. | P2 | NEXT-PHASE-PLAN A, memory 0008 |
| Paper-corpus graph | Separate graph over the research-paper corpus, once papers arrive (supports W2 extraction). | P2 (when papers arrive) | memory 0008 |
| Structural import graph | Auto-generated Dart+TS+SQL import graph. | Later (graphify may obviate) | docs/graph/README |

### W7 · Platform plumbing (enables the above)

| Feature | What it is | Disposition | Source |
|---|---|---|---|
| Feature flags | M1-hosted `isFeatureEnabled('cross_metric_insights')` etc., so W2/W4 ship dark and ramp safely. | P2 | m1-context expansion hint |
| Google OAuth | Hosted-Supabase config (won't work against local Docker). | P2? | memory 0011 |
| Apple Sign-In | Needs the same paid Apple account as HealthKit testing — one purchase unblocks both. | P2? (with iOS device test) | memory 0010 |
| Rules reload trigger | CI-on-`data/rules`-change + manual (no cron) — confirm at implementation. | P2 (with W2) | NEXT-PHASE-PLAN open decision |
| Gemini session hook | Session-start briefing parity for the Gemini CLI. | Later | NEXT-PHASE-PLAN deferred |

## Old labels → this doc

The old phase names fragmented the same product direction across four labels. Mapping:

| Old label | Where it lives now |
|---|---|
| "Phase 0 / P1S2 backlog" (NEXT-PHASE-PLAN) | **W0 Foundations** (first inside Phase 2) |
| Phase 1 Stage 2 — wearables | **W1** |
| Phase 2 — full insight engine | **W2** |
| Phase 1 Stage 3 — environmental | **W3** (candidate, pulled forward) |
| Phase 3 — community, gamification expansion, Insight Lab | **W4 + W5** first slices pulled into Phase 2; Insight Lab stays Later |
| (new, dev-infra) | **W6 graphify**, **W7 plumbing** |

## Constraints that shape the plan (all pre-existing, none new)

- **Non-diagnostic always; 30-second logging; graceful degradation; PDPA isolation; privacy-safe
  community minimums** (PROJECT-CONTEXT principles — W4 leans hardest on the last two).
- **Two-tier truth:** raw rows / migrations / `shared/` / `data/rules` are TRUTH; baselines, cards,
  engagement, `rules` table, graphify output are rebuildable projections.
- **Module order:** M7 depends on M4 + M2 aggregates; M5a depends on M2/M3/M4; M6 reacts only to
  `InsightFiredEvent`. Engine work (W2-C) stays **last** within W2.
- **`shared/` changes = 2-reviewer PRs** (W0 contracts, W2-B1, any W4/W5 contract additions).
- **iOS wall:** HealthKit e2e + Apple Sign-In both need a Mac + paid Apple Developer account; Android
  is fully unblocked on the current Windows setup.

## Open questions (owner)

1. **W3 (M4 environment) in or out of Phase 2?** In = the One Health differentiator + best
   cross-metric rules + clean W4 dependency; out = smaller phase, W4 first slice limited to
   self-report aggregates. *Recommendation: in, scoped to one region/country and 2–3 data sources.*
2. **Apple Developer account (US$99/yr)** — buy now (unblocks iOS e2e + Apple Sign-In) or ship
   Phase 2 Android-first?
3. **W4 first slice** — read-only regional aggregates only, or also leaderboards (W5)?
4. **Research paper(s)** for W2 extraction — still pending; W2-B4 stays a skeleton until provided.

---

*Sequencing, milestones, and session breakdown belong to the integrated Phase 2 plan (next session,
on approval of this list). `NEXT-PHASE-PLAN.md`'s A–E design remains the W2 detail; its "Phase 0" is
superseded by W0 here.*
