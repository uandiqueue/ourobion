# Phase 2 — Plan

Ourobion's MVP self-report loop is in place: M1 auth, M2 logging, M5a baselines, M5b discovery cards,
M6 engagement. **Phase 2 turns that loop into the real product** over ~2 months (~2026-06-15 →
~2026-08-15), in **two parallel tracks** that branch after foundations and **merge for a stress test
that gates Phase 3**.

Phase 2 also makes one architectural commitment everything else rides on: ourobion stops being a fixed
set of ~20 metrics in wide daily tables and becomes a **modifiable metric platform** that scales to
hundreds of metrics across five sources, where **adding or removing a metric is a localized,
guard-protected change — never a schema-wide rewrite.** The metric *catalog* (which metrics, exact
definitions, clinical weighting) is later research; Phase 2 builds the *platform* and lights up a thin,
honest vertical slice on it.

This doc is the **plan authority**: goals, what Phase 2 contains, the sequence, and the gate. The
metric-platform detail (registry schema, storage primitives, add/remove runbook) lives in
[`METRICS-REGISTRY-DESIGN.md`](biotope/METRICS-REGISTRY-DESIGN.md) and [`shared/metrics/README.md`](../shared/metrics/README.md);
the insights-engine contract detail (rule blueprints, `rules` table, evaluators) lives in
[`INSIGHTS-ENGINE-DESIGN.md`](biotope/INSIGHTS-ENGINE-DESIGN.md). Plain-language companion:
[`human-briefs/2026-06-11-phase2-integrated-plan.md`](human-briefs/2026-06-11-phase2-integrated-plan.md).

## The metric platform (the floor everything else stands on)

The discovery engine's job is to surface overlooked correlations, which means a **wide, cheap passive
layer correlated against a thin, reliable self-report spine.** That only works if metrics are cheap to
add, safe to remove, and uniformly described. Five properties define the platform.

### 1 · Five sources, one registry

Every metric declares its **source economy**:

| Source | Cost to the user | Strategy | Examples |
|---|---|---|---|
| **manual** | attention per entry — *scarce* | **ration** to a thin spine | mood, urine colour, Bristol tap |
| **semi-passive** | ~zero — fetched from HealthKit / Health Connect (another app already logs it) | **fetch first**, ask only as fallback | nutrition, workouts, menstruation, glucose |
| **sensor** | ~zero after one permission — phone + wearable | **maximize** | steps, HR/HRV, barometric pressure, sleep |
| **api** | ~zero — external feeds keyed on location + time | **maximize** | weather, AQI/haze, UV, dengue clusters |
| **derived** | ~zero — computed from the above | **maximize** | hydration status, gut transit, sleep regularity |

`shared/metrics/registry.{ts,dart}` is the single source of truth (v1 shipped). Manual is the only
rationed economy; the other four are maximized — breadth is the product, not the cost.

### 2 · Modifiability is the headline requirement

- **Add** a metric → **one registry entry**; the guards then *require* its storage + contract before
  it can ship (incomplete propagation fails a test, not production).
- **Remove** a metric → **soft-deprecate** (mark it, keep the entry) so historical data and any
  rule/insight referencing the key keep resolving; the store is dropped only after a deprecation
  window.
- **No add or remove touches more than the registry and its generated/guarded edges.** This is the
  whole point — see [`METRICS-REGISTRY-DESIGN.md`](biotope/METRICS-REGISTRY-DESIGN.md) and the
  `metrics-registry-*` guards.

### 3 · Storage follows *continuity*, not body system

A 20-column daily table doesn't scale to hundreds of metrics, and most metrics aren't daily anyway.
Storage primitives map to a metric's **continuity**:

| Continuity | Primitive | First instance (today) | Examples |
|---|---|---|---|
| continuous (daily series) | **`daily_log`** — the thin spine | `daily_gut_rows` | mood, energy, urine colour |
| episodic (event) | **`events`** — typed, timestamped; frequency/timing/transit **derived**, never asked | (new) | Bristol tap, insect bite, meal photo, symptom |
| state / period (span) | **`state_bands`** — toggled start/end | `antibiotic_courses` | antibiotics, fasting, illness, travel, pregnancy |
| passive signal | **`signals`** — tall/narrow time-series (`metric_key, ts, value, source, device`) | `wearable_daily` | steps, HR, AQI, weather |
| derived | **`derived_metrics`** — rebuildable projection | `baseline_snapshots` | hydration, transit, regularity |

`daily_gut_rows`, `antibiotic_courses`, `wearable_daily`, and `baseline_snapshots` **stay exactly as
they are** — they become the first instances of these primitives, not rewrites.

### 4 · Reliability is a first-class weight

Cheap ≠ trustworthy. Each metric carries a **reliability weight** (device-measured > ambient API >
in-moment event > subjective rating > manual count). Baselines and insights confidence-weight inputs
and **triangulate** — a self-report agreeing with its passive correlate raises confidence; divergence
flags bad data. Low-reliability metrics surface as personal trends only, never cross-user absolutes.

### 5 · Privacy scales with the sensor surface

A multi-source platform pulls in location, mic, camera, BLE/Wi-Fi. The rule: **raw signals stay
on-device; only the derived metric is stored**, behind **granular per-source consent scopes** the user
grants independently. This is an M1 platform capability, not a copy review.

> **Scope discipline.** Phase 2 builds this platform and populates a **thin vertical slice** — the
> ~9-touch daily spine + ~a dozen high-value passive signals + a handful of derived metrics. It does
> **not** attempt to ship hundreds of metrics. The platform is what makes growing the catalog later a
> cheap, safe, per-metric change.

## Goals

| # | Goal | Phase 2 outcome |
|---|---|---|
| **G1** | Stand on a solid floor — no downstream work builds on stubs or hardcoded metric lists. | Dart contracts complete + parity-guarded; **the modifiable metric platform** (registry v2 + continuity-based storage) is the single source of truth; add/remove a metric is a localized change. |
| **G2** | The app sees your body, passively. | Health Connect (Android) verified end-to-end; **semi-passive fetch** from the health store; wearable confidence feeding insights. Apple/HealthKit decided at the gate. |
| **G3** | Insights become an engine, not a hardcoded list. | Rules are reviewable data; a **relationship graph (the brain)** makes cross-metric evaluation tractable at scale; engine evaluates trend/threshold/correlation; cards can say *why* they fired. |
| **G4** | Health is social and situated. | First community surface: **global** aggregates (all users — testing stage) + simple chat, opt-in, privacy-safe. |
| **G5** | Logging stays worth it. | Phase 2 surfaces the two computed stats; the gamification **game** + UI redesign are Phase 3. |
| **G6** | The repo stays understandable as it grows. | graphify semantic graph of the repo as dev infrastructure (not part of the insights engine). |

## What Phase 2 contains (by workstream)

Disposition: unmarked = in Phase 2. **→ P3** = Phase 3. **→ Later** = after Phase 2. ⛔ = hard
prerequisite for the insights engine.

### W0 · Foundations — clear first

The unfinished MVP work, **plus the metric platform** everything else builds on.

| Feature | What it is |
|---|---|
| ⛔ **Metric platform — registry v2** | Extend the shipped registry with the scale dimensions: `tier`, `continuity`, the 5-source economy (`manual`/`semi_passive`/`sensor`/`api`/`derived`), `reliability` weight, `derivedFrom[]` (the inputs of a derived metric — seeds the brain), `platform` availability, and `preferredSource`/`fallback` (semi-passive). Guarded; 2-reviewer `shared/` PR. |
| ⛔ **Metric platform — storage primitives** | Generalize storage to `daily_log` / `events` / `state_bands` / `signals` / `derived_metrics` (migrations + schema guards). `daily_gut_rows`, `antibiotic_courses`, `wearable_daily`, `baseline_snapshots` become the first instances — no rewrite. |
| ⛔ Dart shared contracts | Finish `shared/types/index.dart` (`BaselineSnapshot`, `InsightCard`, `InsightFiredEvent`, `EngagementState`, `DailyPhysioRow`, `DailyEnvRow` + `fromJson`/`toJson`) and the `getCopyRule()` stub. 2-reviewer PR. **(Done — PR #15.)** |
| ⛔ Real parity guard tests | Promote the skipped guards (`shared_types_parity`, `copy_guidelines_parity`, `daily_gut_row_schema`) + their `couplings.yaml` edges `planned → active`. **(`shared_types_parity` + 5 `metrics-registry-*` guards done — PR #15; `copy_guidelines` + `daily_gut_row` remain.)** |
| ⛔ **Granular consent + on-device processing** | Per-source consent scopes (location, mic, camera, BLE, health-store) the user grants independently; raw mic/location/camera never leaves the device — only the derived metric is stored. (Elevated from "consent copy review" — the sensor surface makes this an architecture item.) |
| M1 app shell | Replace the `[DEV]` home screen with real Home / Log / Insights / Profile tab navigation. |
| PDPA consent legal review | Singapore-law review of consent copy before any release build. |
| M2 logic extraction | Pull inline DQS/save logic into `normaliser.dart` + `logging_controller.dart` + focused tests. **DQS becomes tier-aware** — only the daily-core (T1) spine counts toward completeness; events / periods / passive never penalize it. |
| M2 standing-water weekly audit | Weekly (not daily) "standing water present?" prompt with re-ask suppression — modelled as a periodic event, not a daily column. |
| M2 symptom flags | Multi-select symptom logging (feverish, nausea, body aches, fatigue, appetite, cramps, headache) — presence-only, surfaced via a daily "anything feel off?" gateway that opens symptom **events**. |
| M2 antibiotic course tracker | Set up a course (drug, start, duration); app derives `on_antibiotics`/`gut_watch_active`; dose reminders. Needs `antibiotic_service.dart` + local notifications. (The exemplar `state_bands` instance.) |
| M6 stat display | Surface `dqs_7day_avg` + `longest_streak` in the home tab. |
| Local notifications scaffold | Flutter local-notifications setup in M1 (prerequisite for antibiotic reminders). |

### W1 · Passive health — sensors + semi-passive (M3)

| Feature | What it is |
|---|---|
| ⛔ End-to-end device verification | Real Android device (Health Connect) → `wearable_daily` (a `signals` instance). Apply the known M3 fix first: `MainActivity` must extend `FlutterFragmentActivity`. Apple/HealthKit is **gate-decided**, not in Phase 2. |
| **Semi-passive fetch path** | Detect which source apps populate HealthKit / Health Connect (nutrition, workouts, weight, menstruation, glucose…), switch those metrics to **fetch-mode**, and retire their manual prompt — re-surfacing only if the source goes quiet. Collapses a dozen would-be prompts to zero. |
| Wearable / signal confidence into insights | `confidence_sources[]` on cards populated from signal presence; M5a baselines over wearable metrics (resting_hr_bpm, hrv_sdnn_ms, sleep_duration_min, spo2_pct, body_temp_c, step_count). Now **reliability-weighted** per source. |
| Device-type tracking | Profile captures device platform + health-permission status. |
| Stool / meal venue tags | Optional tags ('loose', 'painful'; 'hawker', 'restaurant') — carried as event payload. |
| Timestamped stool events | One Bristol tap per movement; **frequency / transit derived from timestamps** rather than asked. *(Was "→ Later"; the `events` primitive is now a W0 foundation, so this lands here — see flagged change below. Full event-granularity richness can still phase.)* |

*Constraints (not features): HRV is RMSSD on Android (SDNN is iOS-only); wearable sync is best-effort,
never a hard gate (graceful degradation).*

### W2 · Insights engine (M5b) + the brain — see [`INSIGHTS-ENGINE-DESIGN.md`](biotope/INSIGHTS-ENGINE-DESIGN.md)

| Feature | What it is |
|---|---|
| Rules as reviewable data | Git-tracked JSON rule blueprints (`data/rules/**`) → Postgres `rules` projection + loader. Adding a rule = a PR, not a redeploy. |
| **Metric-relationship graph (the brain)** | Relationships-as-data (TRUTH tier), seeded from the registry's `derivedFrom[]` + curated priors, projected to a runtime store. **Prunes the correlation search space** (hundreds of metrics × lag windows is not brute-forceable) and is the **retrieval substrate** for explanation/synthesis. Centralised, server-side, shared by all users. |
| Cross-metric rules | `correlation` condition over 2+ metrics (e.g. sleep down AND gut comfort down), **scoped to brain neighbours with configurable lag windows** — the headline analytical upgrade. |
| Data-driven engine | `generate-insights` refactored to pure evaluators (trend / threshold / correlation), deterministic, non-diagnostic gates at load + render. **The brain decides *what* fires; the engine stays deterministic.** |
| Reliability weighting + triangulation | Engine confidence-weights inputs by source reliability and cross-checks self-report against its passive correlate before firing. |
| "Why am I seeing this?" | Per-card explanation from `contributing_metrics[]`, path-traced over the brain. |
| LLM insight synthesis (grounded) | On demand, the client sends a trend package → server retrieves the relevant brain subgraph → a **constrained** LLM synthesises the wording, introducing **no relationship not in the retrieved set**; the non-diagnostic gate runs on its output. The deterministic brain remains the authority for *what is true*; the LLM only phrases *how it reads*. This is the **presentation agent** (grounded / copy-gated / cached / degradable) — see the [pipeline decision](human-briefs/2026-07-01-brain-pipeline-and-training-eval.md) + [INSIGHTS-ENGINE-DESIGN §E](biotope/INSIGHTS-ENGINE-DESIGN.md). |
| Paper → rules extraction | LLM-assisted CLI drafting candidate rules **and relationships** from research PDFs (graphify over the paper corpus), human-reviewed, budget-capped. Skeleton until a research paper arrives. |
| AI weekly summary → Later | Optional NL summary layer reading deterministic cards (the presentation agent's summary mode). Additive; engine ships without it. |

### W3 · Environment & outbreak context (M4) — the `api` source

The user-visible "One Health" differentiator, and where cross-metric rules get their best pairings.
**This is the first build-out of the `api` source economy onto the `signals` / `derived_metrics`
primitives.**

| Feature | What it is |
|---|---|
| `env_daily` ingestion | External API fetch per region: temp, heat index, rainfall, UV, NDVI/green cover, dengue case rate, outbreak alert. **Scoped: Singapore, 2–3 sources** (data.gov.sg weather/UV, NEA dengue clusters). |
| Time-in-green logging | Optional user-logged minutes in green space. |
| Env consent copy | Consent scope explaining how open data combines with personal logs. |

*Raw `env_daily` rows are truth; env is a confidence multiplier, never a gate.*

### W4 · Community & globals (M7 first slice)

First slice covers **all users globally — no region scoping yet** (testing stage); regional thresholds
(principle 5) return when the user base justifies per-region publishing.

| Feature | What it is |
|---|---|
| Global aggregates | Privacy-safe `community_aggregates` over all users; individual data never exposed. |
| Community surface | Opt-in screen: "everyone this week" alongside the user's own patterns. |
| Simple chat | Text-only community chat: RLS per-user rows, report/delete, minimal moderation, feature-flagged. New `shared/` surface → 2-reviewer PR. Ourobion strings stay non-diagnostic; user content gets a disclaimer, not the copy gate. |
| Insight Lab → Later | Users correlate their own behaviour with their signals (the raw-rows-are-the-asset payoff; the per-user-graph surface). |

### W6 · Context tooling — graphify

Repo infrastructure so agents/humans keep navigating the codebase as it grows. **Not a product
feature and not part of the insights engine.** In place today: graphify indexes ourobion's own repo into
a semantic graph (`graphify-out/`, gitignored; rebuild with `scripts/graphify-build.ps1`). A separate
paper-corpus graph supports W2 extraction (rules **and brain relationships**) once papers arrive. See
[`graph/README.md`](graph/README.md) and [`memory/0008-graphify-context-tool.md`](memory/0008-graphify-context-tool.md).

### W7 · Platform plumbing

| Feature | What it is |
|---|---|
| Feature flags | M1-hosted `isFeatureEnabled('cross_metric_insights')` etc., so W2/W4 ship dark and ramp safely. |
| Registry / rules version stamp | Every metric-registry and rules-blueprint projection carries a version; the engine and any client evaluator pin it, so a stale device or function can't silently diverge from the central definition. |
| Google OAuth | Hosted-Supabase config (won't work against local Docker). |
| Apple Sign-In | Needs the same paid Apple account as HealthKit testing — one purchase unblocks both. |
| Rules reload trigger | CI-on-`data/rules`-change + manual (no cron). |
| Gemini session hook → Later | Session-start briefing parity for the Gemini CLI. |

### Deferred to Phase 3 (not Phase 2)

Gamification as a full **game** (open-world pixel-art, D&D playstyle — concept TBD) absorbing the old M6
expansion hints (missions, challenges, titles, leaderboards); an app-wide **UI redesign** (Blender
assets, AI-assisted); and the **Insight Lab** (the interactive per-user graph). Phase 3 starts only
after the Phase 2 stress test passes.

## The flow

```
foundations (W0: metric platform + contracts) ─► graphify (W6) ──┬─► TRACK A: api/env (W3) ─► sensor + semi-passive health (W1) ─► community + chat (W4)─┐
                                                                 │                                                                                       ├─► MERGE ─► stress test ─► [gate] ─► Phase 3
                                                                 └─► TRACK B: brain + insights engine (W2) ──────────────────────────────────────────────┘
                                                                                                            [Apple health decision at gate]
```

Tracks branch after foundations + graphify and develop in parallel — Track A is source/data-facing
(api → sensor → community), Track B is the brain + engine — and **merge only when both are done**
(community layer landed, engine verified). The merge wires the engine to the new sources; the stress
test proves it.

## Schedule (9 weeks)

| Weeks | Step | What ships |
|---|---|---|
| **1–2** | **W0 Foundations** | **Metric platform: registry v2 + storage primitives (`events`/`state_bands`/`signals`/`derived_metrics`) ⛔; granular consent scopes ⛔.** Dart contracts complete (2-reviewer) + parity guards real ⛔; M1 real tab shell; PDPA copy review; M2 normaliser/controller extraction (tier-aware DQS) + standing-water, symptom-flag-gateway, antibiotic flows (+ local-notifications scaffold); M6 stat display. Parallelizable — each item its own issue/session. |
| **2** | **W6 graphify** | Repo indexed; context tooling in place (gitignored output, rebuild script). |
| | | **── branch point ──** |
| **3–4** | **A1 · Environment / `api` source (W3)** | `env_daily` migration + ingestion edge function + pg_cron onto `signals`/`derived_metrics`; Singapore, 2–3 sources; env consent scope; optional time-in-green. |
| **5** | **A2 · Sensor + semi-passive health (W1)** | Health Connect → `wearable_daily` verified end-to-end on a real device; **semi-passive fetch path**; device-type + permission status on profile. |
| **6–7** | **A3 · Community (W4)** | M7 activation, feature-flagged: global `community_aggregates` + community surface + simple chat. PDPA consent extended. |
| **3–7** | **B · Brain + insights engine (W2)** | B1 rule + relationship contract (2-reviewer) → B2 `rules` table + brain projection → B3 loader → B4 extract skeleton → B5 guards/couplings → C engine refactor (deterministic, reliability-weighted) + grounded LLM synthesis → D verify on seeded data (see [`INSIGHTS-ENGINE-DESIGN.md`](biotope/INSIGHTS-ENGINE-DESIGN.md)). Runs against M2 + seeded data; does not wait for Track A. The brain's full synthesis→verify→support-models→edge-store pipeline is the [pipeline decision](human-briefs/2026-07-01-brain-pipeline-and-training-eval.md) + [`BRAIN-DESIGN`](nao/BRAIN-DESIGN.md) + [`BRAIN-MODELS-TRAINING`](nao/BRAIN-MODELS-TRAINING.md). |
| **8** | **MERGE** | Extend M5a baselines over the `signals` (wearable + env) sources; author the first cross-metric rules incl. env (rainfall × mosquito sightings, heat × hydration); community aggregates fed by the full dataset. |
| **9** | **STRESS TEST → gate** | See gate below. Phase 3 GO/NO-GO + Apple decision happen here. |

## Phase 2 → Phase 3 gate (stress test = "insights engine actually working")

All must hold, on the live (hosted) stack, before Phase 3 starts:

1. Rules load from `data/rules/**` blueprints only — zero hardcoded rules left in the function.
2. Cards generate for **single AND cross-metric** rules, including at least one env-involving rule,
   from real (non-seeded) user data on Android devices.
3. Dismissal respected (no regeneration), `(user_id, rule_id)` upsert stable, expiry honoured.
4. Copy gates green at all three layers (load / blueprint guard / render) **including any LLM-synthesised
   text**; `flutter analyze` + `flutter test` + `deno test` + `context_sync --check` + CI all green.
5. Engine runs the nightly pg_cron cycle for **7 consecutive days** without manual intervention.
6. Community layer + chat live behind the flag with no privacy incident (no individual data exposed).
7. **Platform modifiability proven:** a metric added via a single registry entry passes all guards
   end-to-end, and a metric **soft-deprecated** leaves historical baselines/cards still resolving — no
   schema-wide edit required for either.

**At the gate:** decide Apple/HealthKit (US$99/yr + Mac path). If approved → implemented between Phase 2
and Phase 3. Then Phase 3 opens: the gamification game + UI redesign + Insight Lab.

## Track ownership

- **Track A** leans **Alton** (Flutter UI, M3 sensors/semi-passive) with Jayden on the M4 ingestion/db
  side and all consent-scope/copy work (M1 ownership).
- **Track B** leans **Jayden** (db rules, the brain, copy-guidelines enforcement path) with Alton as the
  second reviewer on the `shared/` PRs (registry v2, B1 contract, chat contract).
- The metric platform (W0 registry v2 + storage primitives) is a **shared/ 2-reviewer** foundation both
  tracks depend on — land it before the branch point.
- Every step = its own issue + session branch off `dev-phase2` (AGENTS.md §7); the schedule is the
  order PRs land, not one mega-branch per track.

## Constraints that shape the plan

- **Non-diagnostic always; 30-second logging; graceful degradation; PDPA isolation; privacy-safe
  community minimums** (PROJECT-CONTEXT principles — W4 leans hardest on the last two).
- **Metric platform invariants:** the registry is the single source of truth; **storage follows
  continuity, not body system**; add/remove a metric is localized (add = guard-forced completeness,
  remove = soft-deprecate); reliability is a per-metric weight; raw sensor data stays on-device.
- **Two-tier truth:** raw rows / events / state bands / migrations / `shared/` / `data/rules` /
  `data/metric-graph` are TRUTH; baselines, cards, engagement, the `rules` table, the runtime brain
  projection, and graphify output are rebuildable projections.
- **Module order:** M7 depends on M4 + M2 aggregates; M5a depends on M2/M3/M4; M6 reacts only to
  `InsightFiredEvent`. The engine refactor (W2-C) stays **last** within W2.
- **`shared/` changes = 2-reviewer PRs** (W0 registry v2 + contracts, W2-B1, any W4 contract additions).
- **iOS wall:** HealthKit e2e + Apple Sign-In both need a Mac + paid Apple Developer account; Android is
  fully unblocked on the current Windows setup.
- **No GPU / GMI credits yet** — support-model *training* is deferred (design + data-prep only); the local
  Windows box can't fine-tune. See the [2026-07-01 integrated update](#2026-07-01-integrated-update--brain-pipeline-metric-expansion-work-tracks--new-constraints).
- **Dual-route LLMs** — every LLM step supports a *local-agent* route (host Opus inside Claude Code, no
  API) and an *API-worker* route (OpenAI **or** Anthropic model, id in config); build the LLM-router
  first. See the 2026-07-01 integrated update.

## Risks / watch items

- **W0 is the longest pole** — it now also carries the metric platform (registry v2 + storage
  primitives), which both tracks depend on. If it slips, the branch point slips; protect it.
- **Platform scope creep** — Phase 2 builds the *platform + a thin slice*, **not** hundreds of metrics.
  Resist populating the full catalog; that's later research. Guard the slice boundary explicitly.
  **⚠️ Under revision (2026-07-01):** the [metric-catalog 100-expansion brief](human-briefs/2026-07-01-metric-catalog-100-promotion.md)
  proposes going *past* this thin slice to 100 metrics — an unresolved contradiction pending an owner
  call; see the 2026-07-01 integrated update.
- **Registry v2 migration** — extending the shipped v1 registry + generalizing storage touches `shared/`
  and migrations; keep each a small, guarded, 2-reviewer PR and migrate existing tables in place (no
  rewrite of `daily_gut_rows` / `wearable_daily`).
- **Brain correctness** — a wrong/overgreedy relationship graph produces spurious correlations; seed
  conservatively (registry `derivedFrom` + curated priors), grow from reviewed paper extraction.
- **LLM synthesis non-diagnostic risk** — free text can imply diagnosis with no forbidden words;
  constrain generation to retrieved relationships, run the copy gate on output, keep the deterministic
  brain as the authority for what fires.
- **Research paper still missing** — Track B ships with hand-authored blueprints/relationships if
  needed; the extract step stays a skeleton.
- **Chat scope creep** — "simple chat" is deliberately minimal (text, report/delete, flag-gated).
  Anything richer is Phase 3.
- **OAuth** — community/chat on the hosted stack may want Google sign-in; slot it into A3 if
  email/password proves too high-friction for testers.
- **Stress test needs real users on hosted Supabase** — plan the tester group + hosted config (pg_cron
  settings per memory 0005) during week 7, not week 9.

## 2026-07-01 integrated update — brain pipeline, metric expansion, work tracks & new constraints

Folds in the **brain-pipeline + support-models DECISION** ([anchor](human-briefs/2026-07-01-brain-pipeline-and-training-eval.md)
· [memory 0013](memory/0013-brain-pipeline-and-support-models-decision.md) · [`BRAIN-MODELS-TRAINING`](nao/BRAIN-MODELS-TRAINING.md))
and the **metric-catalog 100-expansion** proposal ([brief](human-briefs/2026-07-01-metric-catalog-100-promotion.md)
· [`METRICS-CATALOG`](biotope/METRICS-CATALOG.md)), and records two new constraints that reorder the work.

### Two new constraints (they change sequencing)

1. **No GPU / GMI credits yet.** Support-model *training* can't start — GMI credits aren't provisioned
   and the local Windows box can't run GPU fine-tuning. The support models are **design + data-prep only
   for now** (done — `BRAIN-MODELS-TRAINING`); **training is deferred until GMI lands.** Exception:
   **(b2) venue weight** is a deterministic SJR/OpenAlex lookup — no training, ships anytime.
2. **Every LLM step supports two routes** (model ids coded in, both OpenAI and Anthropic):
   - **Local-agent route** — inside Claude Code, the host generalist model (Opus) runs the step
     directly; **no API key, no specialised worker** (the graphify "host session model" pattern).
   - **API-worker route** — headless/scaled runs call **specialised workers** via API, using **either an
     OpenAI or an Anthropic model** (id in config); synthesis and verifier resolve to **different model
     families**.
   This is a small **LLM-router foundation** every LLM node (synthesis, verifier, presentation agent,
   seeder, paper→rules extract) calls through — **build it before the LLM-heavy tracks.**

### Work tracks — two independent families (disjoint file surfaces)

**Family A — biotope (app · metrics · insights).** Critical path = **A0 storage primitives.**

| Track | Depends on | Effort | Notes |
|---|---|:--:|---|
| **A0** storage primitives + registry v2 | — | L | biotope longest pole; unblocks all waves |
| **A1** metric Wave 1 self-report (~45) | A0 | L | the discovery-value slice; thin ~9-touch spine |
| **A2** Wave 2 phone sensors | A0 | M | |
| **A3** Wave 3 env/API (M4) | A0 + GPS | L | |
| **A4** Wave 4 wearable/CGM (M3) | A0 + **device** | M | hardware-gated |
| **A5** insights engine refactor (B1–C) | rule contract; seeded data | L | independent of the waves |
| **A6** presentation agent | A5 cards + **B0 router** | M | dual-route |

**Family B — brain / nao (knowledge graph).** Critical path = **B0 router → B4 edge pipeline.**

| Track | Depends on | Effort | Notes |
|---|---|:--:|---|
| **B0** LLM-router (dual-route) | — | M | **NEW foundation**; precedes every LLM node |
| **B1** nao v1 ship | — | S | deploy + auth-test fix |
| **B2** support-model training (a/c/b1) | **GMI credits + GPU** | L (GPU) | **DEFERRED**; design done |
| **B2′** (b2) venue lookup | — | S | no training; ships now |
| **B3** agentic seeder | registry + B0 | M | new files (brain-ingest is live) |
| **B4** edge pipeline (synth/verify/store/Neo4j) | corpus + contract + **B0** | XL | brain critical path; unblocks nao v2 + grounded insights |

Metric waves **A1 → A2/A3/A4** are *sequenced* behind A0 and each wave's collector — not parallel.

### Sequencing (given the constraints)

- **Start now, parallel (disjoint files):** **A0** (biotope foundation), **B0** (LLM-router), **B1**
  (cheap nao ship), **A5** (insights refactor on seeded data), **B2′** (b2 lookup).
- **Then:** **B3** and **B4 scaffolding** (edge-store schema + orchestration) once B0 exists; **B4's LLM
  runs** (synthesis/verifier) begin once B0 is in.
- **Deferred:** **B2 training** → waits for GMI credits. **A6** → behind A5. Metric waves → behind A0.
- The two critical paths (**A0** and **B0→B4**) touch disjoint files → **push both at once.**

### Contradictions flagged (per the ask)

- **Thin-slice vs 100 metrics** — this plan's "resist populating the full catalog" (Risks) is **directly
  contradicted** by the 100-expansion brief. **Unresolved — owner call required** (the brief's "Decisions
  needed #2"). Until confirmed, treat A1–A4 as *proposed*, not committed.
- **"Train (a)/(c) now" superseded** — the anchor brief's original sequencing said fine-tune on public
  data immediately; **constraint 1 defers training** until GMI/GPU. Design + data-prep stand.
- **Stale snapshot** — the plain-language [2026-06-11 integrated-plan brief](human-briefs/2026-06-11-phase2-integrated-plan.md)
  predates all of the above; **this section is the current integrated view.**
