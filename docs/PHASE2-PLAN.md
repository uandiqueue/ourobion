# Phase 2 — Integrated Plan (two tracks, 2 months)

> **Status:** APPROVED SEQUENCE (owner decisions, 2026-06-11; issue #10). Feature definitions live in
> [`PHASE2-GOALS-AND-FEATURES.md`](PHASE2-GOALS-AND-FEATURES.md) (workstreams W0–W7); the insights-engine
> design detail (steps A–E) stays in [`NEXT-PHASE-PLAN.md`](NEXT-PHASE-PLAN.md). This doc is the
> **sequencing authority**: what runs when, in which track, and what gates Phase 3.
> **Timeline: 2 months** (~2026-06-15 → ~2026-08-15).
> Plain-language companion: [`human-briefs/2026-06-11-phase2-integrated-plan.md`](human-briefs/2026-06-11-phase2-integrated-plan.md).

## Owner decisions locked (2026-06-11)

1. **Environment (W3/M4) is IN Phase 2** — it's the One Health differentiator and feeds the best
   cross-metric insights. Scoped small: Singapore first, 2–3 open data sources.
2. **Android health only (W1)** — Health Connect end-to-end. **Apple/HealthKit is excluded**; the
   Apple decision (paid developer account + Mac path) is made **at the end of Phase 2** and, if
   approved, implemented **before Phase 3**.
3. **Community layer (W4) for ALL users** — no region scoping yet ("we are just testing the app at
   this stage"): global aggregates + **community features (simple chat etc.)**. Regional thresholds
   (PROJECT-CONTEXT principle 5) are *deferred for the testing stage, not deleted* — they return when
   the user base justifies per-region publishing.
4. **Gamification is Phase 3, and it's bigger than rewards** — conceptually an entire game inside the
   health app (open-world, pixel-art, D&D playstyle; **nothing confirmed**), paired with a **UI
   redesign** (Blender-rendered assets, AI-assisted). Phase 3 starts only after the Phase 2 **stress
   test** passes: the insights engine actually working.

## The flow

```
housekeeping (W0) ──► graphify (W6) ──┬─► TRACK A: environment (W3) ─► Android health (W1) ─► community layer + chat (W4)─┐
                                      │                                                                                   ├─► MERGE ─► stress test ─► [gate] ─► Phase 3
                                      └─► TRACK B: insights engine (W2: B1…B5 ─► C ─► D) ─────────────────────────────────┘
                                                                                            [Apple health decision at gate]
```

Tracks branch **after graphify** and develop in parallel — Track A is app/data-facing, Track B is the
engine — and **merge only when both are done** (community layer landed, engine verified). The merge
step wires the engine to the new data; the stress test proves it.

## Schedule (9 weeks)

| Weeks | Step | What ships | Notes |
|---|---|---|---|
| **1–2** | **W0 Housekeeping** | Dart shared contracts complete (2-reviewer PR) + 3 parity guards real ⛔; M1 real tab shell; PDPA copy review; M2 normaliser/controller extraction + standing-water, symptom-flags, antibiotic flows (+ local-notifications scaffold); M6 stat display. | Parallelizable across both teammates — each item its own issue/session per AGENTS.md §7. |
| **2** | **W6 graphify** | Install bounded to the project (per toolchain rule), index **biotope repo only**, artifacts gitignored at `docs/graph/generated/`. Port the path-normalizer later if we decide to commit `graph.json`. | Memory 0008 already holds the Dart-extraction probe: structure yes, call edges no — fine for the context-substrate role. |
| | | **── branch point ──** | |
| **3–4** | **A1 · Environment (W3)** | `env_daily` migration (DailyEnvRow contract from W0) + ingestion edge function + pg_cron; **Singapore, 2–3 sources** (data.gov.sg weather/UV, NEA dengue clusters); env consent-copy update; optional time-in-green field. | Raw `env_daily` rows = truth; graceful degradation — env is a confidence multiplier, never a gate. |
| **5** | **A2 · Android health (W1)** | Health Connect → `wearable_daily` verified **end-to-end on a real Android device**; device-type + permission status on profile. | Apply the known M3 fix first: MainActivity must extend `FlutterFragmentActivity` (health plugin ClassCastException). HRV = RMSSD only on Android. |
| **6–7** | **A3 · Community layer (W4)** | M7 module activation, feature-flagged: **global** `community_aggregates` (all users, no region split) + community surface ("everyone this week") + **simple chat** (text-only, RLS per-user rows, report/delete, minimal moderation). PDPA consent copy extended for community/chat. | Chat is a NEW `shared/` surface → 2-reviewer PR. Biotope-authored strings stay non-diagnostic; user content gets a disclaimer, not the copy gate. |
| **3–7** | **B · Insights engine (W2)** | NEXT-PHASE-PLAN A–E unchanged in order: **B1** rule contract (`shared/rules/`, 2-reviewer) → **B2** `rules` table → **B3** loader → **B4** extract skeleton → **B5** guards/couplings → **C** engine refactor (trend/threshold/correlation evaluators) → **D** verify on seeded data. | Runs against M2 metrics + seeded data; does NOT wait for Track A. Research paper still pending — hand-author the first blueprints if it hasn't arrived. |
| **8** | **MERGE** | Extend M5a `compute-baselines` over `wearable_daily` + `env_daily` metrics; author the first **cross-metric rules incl. env** (e.g. rainfall × mosquito sightings, heat × hydration); engine reads all metric families; community aggregates fed by the full dataset. | The seeder (`scripts/seed-test-data.ps1`) covers backdated multi-metric data. |
| **9** | **STRESS TEST → gate** | See gate definition below. | Phase 3 GO/NO-GO + **Apple health decision** happen here. |

## The Phase 2 → Phase 3 gate (stress test = "insights engine actually working")

All must hold, on the live (hosted) stack, before Phase 3 starts:

1. Rules load from `data/rules/**` blueprints only — zero hardcoded rules left in the function.
2. Cards generate for **single AND cross-metric** rules, including at least one env-involving rule,
   from real (non-seeded) user data on Android devices.
3. Dismissal respected (no regeneration), `(user_id, rule_id)` upsert stable, expiry honoured.
4. Copy gates green at all three layers (load / blueprint guard / render); `flutter analyze` +
   `flutter test` + `deno test` + `context_sync --check` + CI all green.
5. Engine runs the nightly pg_cron cycle for **7 consecutive days** without manual intervention.
6. Community layer + chat live behind the flag with no privacy incident (no individual data exposed).

**At the gate:** decide Apple/HealthKit (US$99/yr + Mac path). If approved → implemented **between
Phase 2 and Phase 3**. Then Phase 3 opens: the gamification **game** (open-world pixel, D&D playstyle
— concept to be designed, nothing confirmed) + **UI redesign** (Blender-rendered, AI-assisted).

## Track ownership (per AGENTS.md §6 workstreams)

- **Track A** leans **Alton** (Flutter UI, M3 wearables) with Jayden on the M4 ingestion/db side and
  all consent-copy work (M1 ownership).
- **Track B** leans **Jayden** (db rules, copy-guidelines enforcement path) with Alton as the second
  reviewer on the `shared/` PRs (B1, chat contract).
- Every step = its own issue + session branch off `dev-phase2` (AGENTS.md §7); the schedule above is
  the order PRs should land, not one mega-branch per track.

## Risks / watch items

- **W0 is two weeks of real work** — if it slips, the branch point slips; protect it (it blocks both tracks).
- **Research paper still missing** — Track B ships with hand-authored blueprints if needed; the
  extract step stays a skeleton (unchanged from NEXT-PHASE-PLAN).
- **Chat scope creep** — "simple chat etc." is deliberately minimal in Phase 2 (text, report/delete,
  flag-gated). Anything richer (groups, media, reactions) is Phase 3 with the game/redesign.
- **OAuth** — community/chat on the hosted stack may want Google sign-in (works on hosted, not local
  Docker); slot it into A3 if email/password proves too high-friction for testers.
- **Stress test needs real users on hosted Supabase** — plan the small tester group + hosted project
  config (pg_cron settings per memory 0005) during week 7, not week 9.
