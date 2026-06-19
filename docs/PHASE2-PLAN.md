# Phase 2 — Plan

Biotope's MVP self-report loop is in place: M1 auth, M2 logging, M5a baselines, M5b discovery cards,
M6 engagement. **Phase 2 turns that loop into the real product** over ~2 months (~2026-06-15 →
~2026-08-15), in **two parallel tracks** that branch after foundations and **merge for a stress test
that gates Phase 3**.

This doc is the **plan authority**: goals, what Phase 2 contains, the sequence, and the gate. The
insights-engine contract detail (rule blueprints, `rules` table, evaluators) lives in
[`INSIGHTS-ENGINE-DESIGN.md`](INSIGHTS-ENGINE-DESIGN.md). Plain-language companion:
[`human-briefs/2026-06-11-phase2-integrated-plan.md`](human-briefs/2026-06-11-phase2-integrated-plan.md).

## Goals

| # | Goal | Phase 2 outcome |
|---|---|---|
| **G1** | Stand on a solid floor — no downstream work builds on stubs. | Dart contracts complete + parity-guarded; all MVP screens/flows real. |
| **G2** | The app sees your body, passively. | Health Connect (Android) verified end-to-end; wearable confidence feeding insights. Apple/HealthKit decided at the gate. |
| **G3** | Insights become an engine, not a hardcoded list. | Rules are reviewable data; engine evaluates trend/threshold/correlation; cards can say *why* they fired. |
| **G4** | Health is social and situated. | First community surface: **global** aggregates (all users — testing stage) + simple chat, opt-in, privacy-safe. |
| **G5** | Logging stays worth it. | Phase 2 surfaces the two computed stats; the gamification **game** + UI redesign are Phase 3. |
| **G6** | The repo stays understandable as it grows. | graphify semantic graph of the repo as dev infrastructure (not part of the insights engine). |

## What Phase 2 contains (by workstream)

Disposition: unmarked = in Phase 2. **→ P3** = Phase 3. **→ Later** = after Phase 2. ⛔ = hard
prerequisite for the insights engine.

### W0 · Foundations — clear first

The unfinished MVP work everything else builds on.

| Feature | What it is |
|---|---|
| ⛔ Dart shared contracts | Finish `shared/types/index.dart` (`BaselineSnapshot`, `InsightCard`, `InsightFiredEvent`, `EngagementState`, `DailyPhysioRow`, `DailyEnvRow` + `fromJson`/`toJson`) and the `getCopyRule()` stub. 2-reviewer PR. |
| ⛔ Real parity guard tests | Promote the 3 skipped guards (`shared_types_parity`, `copy_guidelines_parity`, `daily_gut_row_schema`) + their `couplings.yaml` edges `planned → active`. |
| M1 app shell | Replace the `[DEV]` home screen with real Home / Log / Insights / Profile tab navigation. |
| PDPA consent legal review | Singapore-law review of consent copy before any release build. |
| M2 logic extraction | Pull inline DQS/save logic into `normaliser.dart` + `logging_controller.dart` + focused tests. |
| M2 standing-water weekly audit | Weekly (not daily) "standing water present?" prompt with re-ask suppression. |
| M2 symptom flags | Multi-select symptom logging (feverish, nausea, body aches, fatigue, appetite, cramps, headache) — presence-only. |
| M2 antibiotic course tracker | Set up a course (drug, start, duration); app derives `on_antibiotics`/`gut_watch_active`; dose reminders. Needs `antibiotic_service.dart` + local notifications. |
| M6 stat display | Surface `dqs_7day_avg` + `longest_streak` in the home tab. |
| Local notifications scaffold | Flutter local-notifications setup in M1 (prerequisite for antibiotic reminders). |

### W1 · Android passive health (M3)

| Feature | What it is |
|---|---|
| ⛔ End-to-end device verification | Real Android device (Health Connect) → `wearable_daily` rows. Apply the known M3 fix first: `MainActivity` must extend `FlutterFragmentActivity`. Apple/HealthKit is **gate-decided**, not in Phase 2. |
| Wearable confidence into insights | `confidence_sources[]` on cards populated from wearable presence; M5a baselines over `DailyPhysioRow` metrics (resting_hr_bpm, hrv_sdnn_ms, sleep_duration_min, spo2_pct, body_temp_c, step_count). |
| Device-type tracking | Profile captures device platform + health-permission status. |
| Stool/meal venue tags | Optional tags ('loose', 'painful'; 'hawker', 'restaurant'). |
| Timestamped stool events → Later | Upgrade from one daily entry to timestamped events if variability proves meaningful. |

*Constraints (not features): HRV is RMSSD on Android (SDNN is iOS-only); wearable sync is best-effort,
never a hard gate (graceful degradation).*

### W2 · Insights engine (M5b) — see [`INSIGHTS-ENGINE-DESIGN.md`](INSIGHTS-ENGINE-DESIGN.md)

| Feature | What it is |
|---|---|
| Rules as reviewable data | Git-tracked JSON rule blueprints (`data/rules/**`) → Postgres `rules` projection + loader. Adding a rule = a PR, not a redeploy. |
| Cross-metric rules | `correlation` condition over 2+ metrics (e.g. sleep down AND gut comfort down) — the headline analytical upgrade. |
| Data-driven engine | `generate-insights` refactored to pure evaluators (trend / threshold / correlation), deterministic, non-diagnostic gates at load + render. |
| "Why am I seeing this?" | Per-card explanation from `contributing_metrics[]`. |
| Paper → rules extraction | LLM-assisted CLI drafting candidate rules from research PDFs, human-reviewed, budget-capped. Skeleton until a research paper arrives. |
| AI weekly summary → Later | Optional NL summary layer reading deterministic cards. Additive; engine ships without it. |

### W3 · Environment & outbreak context (M4)

The user-visible "One Health" differentiator, and where cross-metric rules get their best pairings.

| Feature | What it is |
|---|---|
| `env_daily` ingestion | External API fetch per region: temp, heat index, rainfall, UV, NDVI/green cover, dengue case rate, outbreak alert. **Scoped: Singapore, 2–3 sources** (data.gov.sg weather/UV, NEA dengue clusters). |
| Time-in-green logging | Optional user-logged minutes in green space. |
| Env consent copy | Consent update explaining how open data combines with personal logs. |

*Raw `env_daily` rows are truth; env is a confidence multiplier, never a gate.*

### W4 · Community & globals (M7 first slice)

First slice covers **all users globally — no region scoping yet** (testing stage); regional thresholds
(principle 5) return when the user base justifies per-region publishing.

| Feature | What it is |
|---|---|
| Global aggregates | Privacy-safe `community_aggregates` over all users; individual data never exposed. |
| Community surface | Opt-in screen: "everyone this week" alongside the user's own patterns. |
| Simple chat | Text-only community chat: RLS per-user rows, report/delete, minimal moderation, feature-flagged. New `shared/` surface → 2-reviewer PR. Biotope strings stay non-diagnostic; user content gets a disclaimer, not the copy gate. |
| Insight Lab → Later | Users correlate their own behaviour with their signals (the raw-rows-are-the-asset payoff). |

### W6 · Context tooling — graphify

Repo infrastructure so agents/humans keep navigating the codebase as it grows. **Not a product
feature and not part of the insights engine.** In place today: graphify indexes biotope's own repo into
a semantic graph (`graphify-out/`, gitignored; rebuild with `scripts/graphify-build.ps1`). A separate
paper-corpus graph supports W2 extraction once papers arrive. See [`graph/README.md`](graph/README.md)
and [`memory/0008-graphify-context-tool.md`](memory/0008-graphify-context-tool.md).

### W7 · Platform plumbing

| Feature | What it is |
|---|---|
| Feature flags | M1-hosted `isFeatureEnabled('cross_metric_insights')` etc., so W2/W4 ship dark and ramp safely. |
| Google OAuth | Hosted-Supabase config (won't work against local Docker). |
| Apple Sign-In | Needs the same paid Apple account as HealthKit testing — one purchase unblocks both. |
| Rules reload trigger | CI-on-`data/rules`-change + manual (no cron). |
| Gemini session hook → Later | Session-start briefing parity for the Gemini CLI. |

### Deferred to Phase 3 (not Phase 2)

Gamification as a full **game** (open-world pixel-art, D&D playstyle — concept TBD) absorbing the old M6
expansion hints (missions, challenges, titles, leaderboards); an app-wide **UI redesign** (Blender
assets, AI-assisted); and the **Insight Lab**. Phase 3 starts only after the Phase 2 stress test passes.

## The flow

```
foundations (W0) ──► graphify (W6) ──┬─► TRACK A: environment (W3) ─► Android health (W1) ─► community + chat (W4)─┐
                                     │                                                                             ├─► MERGE ─► stress test ─► [gate] ─► Phase 3
                                     └─► TRACK B: insights engine (W2) ───────────────────────────────────────────┘
                                                                                          [Apple health decision at gate]
```

Tracks branch after foundations + graphify and develop in parallel — Track A is app/data-facing, Track
B is the engine — and **merge only when both are done** (community layer landed, engine verified). The
merge wires the engine to the new data; the stress test proves it.

## Schedule (9 weeks)

| Weeks | Step | What ships |
|---|---|---|
| **1–2** | **W0 Foundations** | Dart contracts complete (2-reviewer) + 3 parity guards real ⛔; M1 real tab shell; PDPA copy review; M2 normaliser/controller extraction + standing-water, symptom-flags, antibiotic flows (+ local-notifications scaffold); M6 stat display. Parallelizable — each item its own issue/session. |
| **2** | **W6 graphify** | Repo indexed; context tooling in place (gitignored output, rebuild script). |
| | | **── branch point ──** |
| **3–4** | **A1 · Environment (W3)** | `env_daily` migration + ingestion edge function + pg_cron; Singapore, 2–3 sources; env consent copy; optional time-in-green. |
| **5** | **A2 · Android health (W1)** | Health Connect → `wearable_daily` verified end-to-end on a real device; device-type + permission status on profile. |
| **6–7** | **A3 · Community (W4)** | M7 activation, feature-flagged: global `community_aggregates` + community surface + simple chat. PDPA consent extended. |
| **3–7** | **B · Insights engine (W2)** | B1 rule contract (2-reviewer) → B2 `rules` table → B3 loader → B4 extract skeleton → B5 guards/couplings → C engine refactor → D verify on seeded data (see [`INSIGHTS-ENGINE-DESIGN.md`](INSIGHTS-ENGINE-DESIGN.md)). Runs against M2 + seeded data; does not wait for Track A. |
| **8** | **MERGE** | Extend M5a `compute-baselines` over `wearable_daily` + `env_daily`; author the first cross-metric rules incl. env (rainfall × mosquito sightings, heat × hydration); community aggregates fed by the full dataset. |
| **9** | **STRESS TEST → gate** | See gate below. Phase 3 GO/NO-GO + Apple decision happen here. |

## Phase 2 → Phase 3 gate (stress test = "insights engine actually working")

All must hold, on the live (hosted) stack, before Phase 3 starts:

1. Rules load from `data/rules/**` blueprints only — zero hardcoded rules left in the function.
2. Cards generate for **single AND cross-metric** rules, including at least one env-involving rule,
   from real (non-seeded) user data on Android devices.
3. Dismissal respected (no regeneration), `(user_id, rule_id)` upsert stable, expiry honoured.
4. Copy gates green at all three layers (load / blueprint guard / render); `flutter analyze` +
   `flutter test` + `deno test` + `context_sync --check` + CI all green.
5. Engine runs the nightly pg_cron cycle for **7 consecutive days** without manual intervention.
6. Community layer + chat live behind the flag with no privacy incident (no individual data exposed).

**At the gate:** decide Apple/HealthKit (US$99/yr + Mac path). If approved → implemented between Phase 2
and Phase 3. Then Phase 3 opens: the gamification game + UI redesign.

## Track ownership

- **Track A** leans **Alton** (Flutter UI, M3 wearables) with Jayden on the M4 ingestion/db side and
  all consent-copy work (M1 ownership).
- **Track B** leans **Jayden** (db rules, copy-guidelines enforcement path) with Alton as the second
  reviewer on the `shared/` PRs (B1, chat contract).
- Every step = its own issue + session branch off `dev-phase2` (AGENTS.md §7); the schedule is the
  order PRs land, not one mega-branch per track.

## Constraints that shape the plan

- **Non-diagnostic always; 30-second logging; graceful degradation; PDPA isolation; privacy-safe
  community minimums** (PROJECT-CONTEXT principles — W4 leans hardest on the last two).
- **Two-tier truth:** raw rows / migrations / `shared/` / `data/rules` are TRUTH; baselines, cards,
  engagement, the `rules` table, and graphify output are rebuildable projections.
- **Module order:** M7 depends on M4 + M2 aggregates; M5a depends on M2/M3/M4; M6 reacts only to
  `InsightFiredEvent`. The engine refactor (W2-C) stays **last** within W2.
- **`shared/` changes = 2-reviewer PRs** (W0 contracts, W2-B1, any W4 contract additions).
- **iOS wall:** HealthKit e2e + Apple Sign-In both need a Mac + paid Apple Developer account; Android is
  fully unblocked on the current Windows setup.

## Risks / watch items

- **W0 is two weeks of real work** — if it slips, the branch point slips; protect it (it blocks both tracks).
- **Research paper still missing** — Track B ships with hand-authored blueprints if needed; the extract
  step stays a skeleton.
- **Chat scope creep** — "simple chat" is deliberately minimal (text, report/delete, flag-gated).
  Anything richer (groups, media, reactions) is Phase 3.
- **OAuth** — community/chat on the hosted stack may want Google sign-in; slot it into A3 if
  email/password proves too high-friction for testers.
- **Stress test needs real users on hosted Supabase** — plan the tester group + hosted config (pg_cron
  settings per memory 0005) during week 7, not week 9.
