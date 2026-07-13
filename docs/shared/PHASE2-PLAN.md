# Phase 2 — Plan

Ourobion's MVP self-report loop is in place: M1 auth, M2 logging, M5a baselines, M5b discovery cards,
M6 engagement. **Phase 2 turns that loop into the real product**, in **two parallel tracks** —
**biotope** (the app: metrics, passive health, insights, community) and **brain/nao** (the knowledge
graph that powers insights) — that share a foundation, develop independently, and **merge for a stress
test that gates Phase 3**.

Phase 2 also makes one architectural commitment everything else rides on: ourobion stops being a fixed
set of ~20 metrics in wide daily tables and becomes a **modifiable metric platform** that scales to
hundreds of metrics across five sources, where **adding or removing a metric is a localized,
guard-protected change — never a schema-wide rewrite.** On that platform Phase 2 **grows the registry to
100 metrics in collector-gated waves** (the adopted
[100-metric decision](../temp/human-brief/2026-07-01-metric-catalog-100-promotion.md) · [memory 0014](../memory/0014-metric-catalog-100-expansion-decision.md));
the full ~360-metric [`METRICS-CATALOG.md`](../biotope/METRICS-CATALOG.md) stays the reference, not the ship target.

This doc is the **plan authority**: goals, what Phase 2 contains, the tracks + sequence, and the gate.
Detail lives in the design docs it points to — the metric platform in
[`METRICS-REGISTRY-DESIGN.md`](../biotope/METRICS-REGISTRY-DESIGN.md) + [`shared/metrics/README.md`](../../shared/metrics/README.md);
the insights engine in [`INSIGHTS-ENGINE-DESIGN.md`](../biotope/INSIGHTS-ENGINE-DESIGN.md); the brain
pipeline in [`nao/BRAIN-DESIGN.md`](../nao/BRAIN-DESIGN.md) + [`nao/BRAIN-MODELS-TRAINING.md`](../nao/BRAIN-MODELS-TRAINING.md)
(anchor decision: [`human-briefs/2026-07-01-brain-pipeline-and-training-eval.md`](../temp/human-brief/2026-07-01-brain-pipeline-and-training-eval.md) · [memory 0013](../memory/0013-brain-pipeline-and-support-models-decision.md)).

## The metric platform (the floor everything else stands on)

The discovery engine's job is to surface overlooked correlations, which means a **wide, cheap passive
layer correlated against a thin, reliable self-report spine.** That only works if metrics are cheap to
add, safe to remove, and uniformly described. Four properties define the platform.

### 1 · Five sources, one registry

Every metric declares its **source economy**:

| Source | Cost to the user | Strategy | Examples |
|---|---|---|---|
| **manual** | attention per entry — *scarce* | **ration** to a thin spine | mood, urine colour, Bristol tap |
| **semi-passive** | ~zero — fetched from HealthKit / Health Connect (another app already logs it) | **fetch first**, ask only as fallback | nutrition, workouts, menstruation, glucose |
| **sensor** | ~zero after one permission — phone + wearable | **maximize** | steps, HR/HRV, barometric pressure, sleep |
| **api** | ~zero — external feeds keyed on location + time | **maximize** | weather, AQI/haze, UV, dengue clusters |
| **derived** | ~zero — computed from the above | **maximize** | hydration status, gut transit, sleep regularity |

`shared/metrics/registry.{ts,dart}` is the single source of truth. Manual is the only rationed economy;
the other four are maximized — breadth is the product, not the cost.

### 2 · Modifiability is the headline requirement

- **Add** a metric → **one registry entry**; the guards then *require* its storage + contract before
  it can ship (incomplete propagation fails a test, not production).
- **Remove** a metric → **soft-deprecate** (mark it, keep the entry) so historical data and any
  rule/insight referencing the key keep resolving; the store is dropped only after a deprecation window.
- **No add or remove touches more than the registry and its generated/guarded edges** — see
  [`METRICS-REGISTRY-DESIGN.md`](../biotope/METRICS-REGISTRY-DESIGN.md) and the `metrics-registry-*` guards.

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

> **Scope.** The registry grows to **100 metrics in collector-gated waves** — a wave promotes only when
> its collector ships (or the guards go red), and the manual spine stays a thin ~9 daily touches
> (breadth lives in the free passive/derived layers). It does **not** ship the full ~360-metric catalog;
> that stays reference. Add/remove remains a localized, guard-protected, per-metric change.
>
> **Demo storage.** All user data lives in **Supabase** for now. PDPA/data-isolation and privacy
> hardening (on-device processing of raw mic/location/camera, granular per-source consent) are
> **deferred until past the demo / scaling** — not built in Phase 2.

## Goals

| # | Goal | Phase 2 outcome |
|---|---|---|
| **G1** | Stand on a solid floor — no downstream work builds on stubs or hardcoded metric lists. | Dart contracts complete + parity-guarded; **the modifiable metric platform** (registry v2 + continuity-based storage) is the single source of truth; add/remove a metric is a localized change. |
| **G2** | The app sees your body, passively. | Health Connect (Android) verified end-to-end; **semi-passive fetch** from the health store; wearable confidence feeding insights. Apple/HealthKit decided at the gate. |
| **G3** | Insights become an engine, not a hardcoded list. | Rules are reviewable data; a **relationship graph (the brain)** makes cross-metric evaluation tractable at scale; engine evaluates trend/threshold/correlation; cards can say *why* they fired. |
| **G4** | Health is social and situated. | First community surface: **global** aggregates (all users — testing stage) + simple chat, opt-in (aggregates only). |
| **G5** | Logging stays worth it. | Phase 2 surfaces the two computed stats; the gamification **game** + UI redesign are Phase 3. |
| **G6** | The repo stays understandable as it grows. | graphify semantic graph of the repo as dev infrastructure (not part of the insights engine). |

## What Phase 2 contains (by workstream)

Disposition: unmarked = in Phase 2. **→ P3** = Phase 3. **→ Later** = after Phase 2. ⛔ = hard
prerequisite for the insights engine.

### W0 · Foundations — clear first

The unfinished MVP work, **plus the metric platform** everything else builds on.

| Feature | What it is |
|---|---|
| ⛔ **Metric platform — registry v2** | Extend the registry with the scale dimensions: `tier`, `continuity`, the 5-source economy, `reliability` weight, `derivedFrom[]` (inputs of a derived metric — seeds the brain), `platform` availability, `preferredSource`/`fallback` (semi-passive). Guarded; 2-reviewer `shared/` PR. |
| ⛔ **Metric platform — storage primitives** | Generalize storage to `daily_log` / `events` / `state_bands` / `signals` / `derived_metrics` (migrations + schema guards). `daily_gut_rows`, `antibiotic_courses`, `wearable_daily`, `baseline_snapshots` become the first instances — no rewrite. |
| ⛔ Dart shared contracts | `shared/types/index.dart` (`BaselineSnapshot`, `InsightCard`, `InsightFiredEvent`, `EngagementState`, `DailyPhysioRow`, `DailyEnvRow` + `fromJson`/`toJson`) and `getCopyRule()`. 2-reviewer PR. |
| ⛔ Real parity guard tests | `shared_types_parity`, `copy_guidelines_parity`, `daily_gut_row_schema` + their `couplings.yaml` edges `planned → active`. (`shared_types_parity` + the `metrics-registry-*` guards are active; `copy_guidelines` + `daily_gut_row` remain.) || M1 app shell | Replace the `[DEV]` home screen with real Home / Log / Insights / Profile tab navigation. || M2 logic extraction | Pull inline DQS/save logic into `normaliser.dart` + `logging_controller.dart` + tests. **DQS becomes tier-aware** — only the daily-core (T1) spine counts toward completeness; events / periods / passive never penalize it. |
| M2 standing-water weekly audit | Weekly "standing water present?" prompt with re-ask suppression — a periodic event, not a daily column. |
| M2 symptom flags | Multi-select symptom logging surfaced via a daily "anything feel off?" gateway that opens symptom **events**. |
| M2 antibiotic course tracker | Set up a course (drug, start, duration); app derives `on_antibiotics`/`gut_watch_active`; dose reminders. The exemplar `state_bands` instance. |
| M6 stat display | Surface `dqs_7day_avg` + `longest_streak` in the home tab. |
| Local notifications scaffold | Flutter local-notifications setup in M1 (prerequisite for antibiotic reminders). |

### W1 · Passive health — sensors + semi-passive (M3)

| Feature | What it is |
|---|---|
| ⛔ End-to-end device verification | Real Android device (Health Connect) → `wearable_daily` (a `signals` instance). Apply the M3 fix first: `MainActivity` extends `FlutterFragmentActivity`. Apple/HealthKit is **gate-decided**. |
| **Semi-passive fetch path** | Detect which source apps populate HealthKit / Health Connect (nutrition, workouts, weight, menstruation, glucose…), switch those metrics to **fetch-mode**, retire their manual prompt — re-surfacing only if the source goes quiet. Collapses a dozen would-be prompts to zero. |
| Wearable / signal confidence into insights | `confidence_sources[]` populated from signal presence; M5a baselines over wearable metrics, **reliability-weighted** per source. |
| Device-type tracking | Profile captures device platform + health-permission status. |
| Timestamped stool events | One Bristol tap per movement; **frequency / transit derived from timestamps**, never asked (rides the `events` primitive). |

*Constraints (not features): HRV is RMSSD on Android (SDNN is iOS-only); wearable sync is best-effort,
never a hard gate (graceful degradation).*

### W2 · Insights engine (M5b) + the brain — see [`INSIGHTS-ENGINE-DESIGN.md`](../biotope/INSIGHTS-ENGINE-DESIGN.md)

| Feature | What it is |
|---|---|
| Rules as reviewable data | Git-tracked JSON rule blueprints (`data/rules/**`) → Postgres `rules` projection + loader. Adding a rule = a PR, not a redeploy. |
| **Metric-relationship graph (the brain)** | Relationships-as-data (TRUTH tier): truth-tier edge artifacts, **projected to the relational `verified_edges` view** (a 1-hop Postgres lookup, no graph DB) for traversal. Bootstrapped from the registry's `derivedFrom[]` + curated priors and grown by the **brain pipeline** (paper corpus → synthesis → adversarial verification → verified edges — [`BRAIN-DESIGN.md`](../nao/BRAIN-DESIGN.md)). **Prunes the correlation search space** and is the **retrieval substrate** for explanation. Centralised, server-side, shared by all users. |
| Cross-metric rules | `correlation` condition over 2+ metrics, **scoped to brain neighbours with configurable lag windows** — the headline analytical upgrade. |
| Data-driven engine | `generate-insights` refactored to pure evaluators (trend / threshold / correlation), deterministic, non-diagnostic gates at load + render. **The brain decides *what* fires; the engine stays deterministic.** |
| Reliability weighting + triangulation | Engine confidence-weights inputs by source reliability and cross-checks self-report against its passive correlate before firing. |
| "Why am I seeing this?" | Per-card explanation from `contributing_metrics[]`, path-traced over the brain. |
| Presentation agent (grounded NL) | On demand, the server retrieves the relevant brain subgraph and a **constrained** LLM phrases the wording — introducing **no relationship or number** outside the retrieved set, **copy-gated at render, cached, and degradable** to templated copy. The deterministic engine stays the authority for *what is true*; the agent only phrases *how it reads*. See [`INSIGHTS-ENGINE-DESIGN §E`](../biotope/INSIGHTS-ENGINE-DESIGN.md). |
| Paper → rules/edge extraction | The brain's ingestion + synthesis + adversarial verification pipeline turns the paper corpus into verified relationships; human-reviewed, budget-capped. See [`BRAIN-DESIGN.md`](../nao/BRAIN-DESIGN.md) + [`BRAIN-MODELS-TRAINING.md`](../nao/BRAIN-MODELS-TRAINING.md). |

### W3 · Environment & outbreak context (M4) — the `api` source

The user-visible "One Health" differentiator, and where cross-metric rules get their best pairings — the
first build-out of the `api` source economy onto the `signals` / `derived_metrics` primitives.

| Feature | What it is |
|---|---|
| `env_daily` ingestion | External API fetch per region: temp, heat index, rainfall, UV, NDVI/green cover, dengue case rate, outbreak alert. **Scoped: Singapore, 2–3 sources** (data.gov.sg weather/UV, NEA dengue clusters). |
| Time-in-green logging | Optional user-logged minutes in green space. |
*Raw `env_daily` rows are truth; env is a confidence multiplier, never a gate.*

### W4 · Community & globals (M7 first slice)

First slice covers **all users globally — no region scoping yet** (testing stage); regional thresholds
return when the user base justifies per-region publishing.

| Feature | What it is |
|---|---|
| Global aggregates | `community_aggregates` over all users — aggregates only, no individual rows surfaced. |
| Community surface | Opt-in screen: "everyone this week" alongside the user's own patterns. |
| Simple chat | Text-only community chat: RLS per-user rows, report/delete, minimal moderation, feature-flagged. New `shared/` surface → 2-reviewer PR. Ourobion strings stay non-diagnostic; user content gets a disclaimer, not the copy gate. |
| Insight Lab → Later | Users correlate their own behaviour with their signals (the raw-rows-are-the-asset payoff). |

### W5 · nao — the brain's human surface

nao is the expert web app for inspecting and curating the brain (biotope's sibling). It ships in phases
gated on how much of the brain exists. Detail: [`nao/NAO-DESIGN.md`](../nao/NAO-DESIGN.md) (product +
phasing) · [`nao/BRAIN-DESIGN.md`](../nao/BRAIN-DESIGN.md) (edge synthesis + verification) ·
[`nao/BRAIN-INGESTION-DESIGN.md`](../nao/BRAIN-INGESTION-DESIGN.md) (paper corpus) ·
[`nao/BRAIN-MODELS-TRAINING.md`](../nao/BRAIN-MODELS-TRAINING.md) (support models). Pipeline decision:
[memory 0013](../memory/0013-brain-pipeline-and-support-models-decision.md). Stack: Next.js/OpenNext on
Cloudflare Workers, D1 + R2, Supabase-auth-gated.

| Phase | What it is |
|---|---|
| **v1 corpus dashboard** | Shipped (PR #36): search / facet / inspect the paper corpus (Overview / Papers / Detail). Deploy-time provisioning remains (remote D1 rebuild, real `database_id`, login user, bind domain). |
| **v2 graph + evidence** → Later | Force-directed graph of `verified_edges` + an evidence panel (quote spans + citations + quality markers) — unblocked once the brain **edge pipeline** (Track B) produces servable edges. |
| **v3 human-in-the-loop curation** → Later | A curator approves LLM-proposed edges into the truth store (`provenance:'human'`) — the strongest agentic-app surface. |
| **v4 LLM query** → Later | Natural-language questions over a *retrieved* brain subgraph, constrained to introduce no relationship outside the retrieved set. |

### W6 · Context tooling — graphify

Repo infrastructure so agents/humans keep navigating the codebase as it grows. **Not a product feature
and not part of the insights engine.** graphify indexes ourobion's repo into a semantic graph
(`graphify-out/`, gitignored; rebuild with `scripts/graphify-build.ps1`); a separate paper-corpus graph
supports W2 extraction. See [`graph/README.md`](../graph/README.md) + [`memory/0008-graphify-context-tool.md`](../memory/0008-graphify-context-tool.md).

### W7 · Platform plumbing

| Feature | What it is |
|---|---|
| Feature flags | M1-hosted `isFeatureEnabled('cross_metric_insights')` etc., so W2/W4 ship dark and ramp safely. |
| Registry / rules version stamp | Every registry and rules projection carries a version; the engine and any client evaluator pin it, so a stale device can't silently diverge from the central definition. |
| Google OAuth | Hosted-Supabase config (won't work against local Docker). |
| Apple Sign-In | Needs the same paid Apple account as HealthKit testing — one purchase unblocks both. |
| Rules reload trigger | CI-on-`data/rules`-change + manual (no cron). |
| Gemini session hook → Later | Session-start briefing parity for the Gemini CLI. |

### Deferred to Phase 3

Gamification as a full **game** (open-world pixel-art, D&D playstyle) absorbing the old M6 expansion
hints (missions, challenges, titles, leaderboards); an app-wide **UI redesign**; and the **Insight Lab**
(the interactive per-user graph). Phase 3 starts only after the Phase 2 stress test passes.

## Tracks, dependencies & sequencing

Two tracks develop in parallel over disjoint file surfaces and **merge only when both are done**. Each
has one **foundation** that unblocks the rest; the foundations are independent, so both start at once.

```
FOUNDATIONS (parallel)                PARALLEL BUILD                              CONVERGE
  biotope: storage primitives + ─────► metric waves ─► env (M4) ─► community ─┐
           registry v2                 insights engine ─► presentation agent   ├─► MERGE ─► stress test ─► [gate] ─► Phase 3
  brain:   LLM router (dual-route) ───► agentic seeder ─► edge pipeline ───────┘
           + nao v1 ship                (support-model training: deferred → GMI)   [Apple health decision at gate]
```

### Track A — biotope (app · metrics · insights · community)

Critical path: **storage primitives** (the longest pole; every metric wave rides it).

| Work | Depends on | Effort |
|---|---|:--:|
| **Storage primitives + registry v2** (W0) | — | L |
| Other W0 foundations — M1 shell, M2 extraction, M6 stat | — (parallel) | M |
| Metric **Wave 1** — self-report (~45) | storage primitives | L |
| Metric **Wave 2** — phone sensors | storage + GPS | M |
| Metric **Wave 3** — env/API (M4, W3) | storage + GPS | L |
| Metric **Wave 4** — wearable/CGM (M3, W1) + semi-passive fetch | storage + real device | M |
| Insights **engine refactor** (rules → deterministic engine, W2) | rule contract; runs on seeded data | L |
| **Presentation agent** (W2) | engine cards + the LLM router | M |
| **Community + chat** (M7 first slice, W4) | M2 aggregates | M–L |

Metric waves are **sequenced** behind the storage primitives and each wave's collector — not parallel
with each other. The engine refactor is independent of the waves (works on seeded data).

### Track B — brain / nao (knowledge graph)

Critical path: **LLM router → edge pipeline** (edges unblock nao v2 and brain-grounded insights).

| Work | Depends on | Effort |
|---|---|:--:|
| **LLM router** (dual-route — see below) | — | M |
| nao **v1 ship** (deploy + auth-test fix) | — | S |
| Support model **b2** — venue lookup (SJR + OpenAlex) | — (no training) | S |
| **Agentic seeder** (registry `derivedFrom[]` + insight needs → research queries) | registry + LLM router | M |
| **Edge pipeline** — synthesis → `quoteCheck` → adversarial verifier → truth-tier edge store → relational `verified_edges` projection | paper corpus + brain contract + LLM router | XL |
| Support models **a / c / b1** — training | **GMI credits + GPU** | L (deferred) |

### Two cross-cutting constraints

1. **No GPU / GMI credits yet.** Support-model *training* can't start — credits aren't provisioned and
   the local box can't fine-tune. The models are **design + data-prep only** for now (see
   [`BRAIN-MODELS-TRAINING.md`](../nao/BRAIN-MODELS-TRAINING.md)); training lands when GMI does. The **b2**
   venue lookup needs no training and ships anytime.
2. **Every LLM node runs via two routes** (model ids in config, both OpenAI and Anthropic): a
   **local-agent route** — inside Claude Code the host generalist (Opus) runs it, no API/no specialised
   worker — and an **API-worker route** — headless/scaled, a specialised worker via API, OpenAI *or*
   Anthropic (synthesis + verifier resolve to different families). The **LLM router** that resolves this
   is a foundation: build it before the LLM nodes (synthesis, verifier, presentation agent, seeder,
   extract).

### What to start now, and what waits

- **Start in parallel (disjoint files):** biotope storage primitives + the other W0 foundations; the
  brain LLM router; nao v1 ship; the insights engine refactor (on seeded data); the b2 lookup.
- **Then:** metric waves behind the storage primitives + their collectors; the agentic seeder and the
  edge-pipeline scaffolding behind the router (the pipeline's LLM runs need the router in place).
- **Deferred:** support-model training (→ GMI credits); the presentation agent (behind the engine +
  router); nao v2/v3 (behind the edge pipeline).
- **Merge** wires the deterministic engine to the new sources: extend M5a baselines over the `signals`
  (wearable + env) sources, author the first cross-metric rules including env (rainfall × mosquito
  sightings, heat × hydration), feed community aggregates from the full dataset.

Every step = its own issue + session branch off `dev-phase2` (AGENTS.md §7); land the shared foundations
(registry v2, storage primitives, the brain contract, the rule contract) before the work that depends on
them.

## Phase 2 → Phase 3 gate (stress test = "insights engine actually working")

All must hold, on the live (hosted) stack, before Phase 3 starts:

1. Rules load from `data/rules/**` blueprints only — zero hardcoded rules left in the function.
2. Cards generate for **single AND cross-metric** rules, including at least one env-involving rule, from
   real (non-seeded) user data on Android devices.
3. Dismissal respected (no regeneration), `(user_id, rule_id)` upsert stable, expiry honoured.
4. Copy gates green at all three layers (load / blueprint guard / render) **including any LLM-phrased
   text**; `flutter analyze` + `flutter test` + `deno test` + `context_sync --check` + CI all green.
5. Engine runs the nightly pg_cron cycle for **7 consecutive days** without manual intervention.
6. Community aggregates + chat live behind the flag (aggregates only — no individual rows surfaced).
7. **Platform modifiability proven:** a metric added via a single registry entry passes all guards
   end-to-end, and a metric **soft-deprecated** leaves historical baselines/cards still resolving — no
   schema-wide edit required for either.

**At the gate:** decide Apple/HealthKit (US$99/yr + Mac path); if approved, implement between Phase 2
and Phase 3. Then Phase 3 opens: the gamification game + UI redesign + Insight Lab.

## Ownership

- **Track A (biotope)** leans **Alton** (Flutter UI, M3 sensors/semi-passive) with Jayden on the M4
  ingestion/db side and copy/compliance work (M1 ownership).
- **Track B (brain/nao)** leans **Jayden** (db rules, the brain, copy-guidelines enforcement path) with
  Alton as second reviewer on the `shared/` PRs (registry v2, brain/rule contracts, chat contract).
- The shared foundations (registry v2, storage primitives, brain + rule contracts) are **`shared/`
  2-reviewer** work both tracks depend on — land them before the dependent work.

## Constraints that shape the plan

- **Non-diagnostic always; 30-second logging; graceful degradation** (PROJECT-CONTEXT principles).
  *(PDPA/data-isolation and on-device privacy are **deferred past the demo** — all user data is in
  Supabase for now.)*
- **Metric platform invariants:** the registry is the single source of truth; **storage follows
  continuity, not body system**; add/remove a metric is localized; reliability is a per-metric weight.
- **Two-tier truth:** raw rows / events / state bands / migrations / `shared/` / `data/rules` are TRUTH;
  baselines, cards, engagement, the `rules` table, the runtime brain projection (the relational
  `verified_edges` view), and graphify output are rebuildable projections.
- **Module order:** M7 depends on M4 + M2 aggregates; M5a depends on M2/M3/M4; M6 reacts only to
  `InsightFiredEvent`. The engine refactor stays **last** within W2.
- **`shared/` changes = 2-reviewer PRs** (registry v2, contracts, chat contract).
- **iOS wall:** HealthKit e2e + Apple Sign-In both need a Mac + paid Apple Developer account; Android is
  fully unblocked on the current Windows setup.

## Risks / watch items

- **Foundations are the longest pole** — the storage primitives (Track A) and the LLM router (Track B)
  gate their tracks. If a foundation slips, its track slips; protect them.
- **Registry v2 migration** — extending the registry + generalizing storage touches `shared/` and
  migrations; keep each a small, guarded, 2-reviewer PR and migrate existing tables in place (no rewrite
  of `daily_gut_rows` / `wearable_daily`).
- **Metric-catalog scope** — the target is 100 metrics in collector-gated waves; resist creeping toward
  the full ~360 catalog, and never promote a wave ahead of its collector (the guards enforce this).
- **Brain correctness** — a wrong/overgreedy relationship graph produces spurious correlations; seed
  conservatively (registry `derivedFrom` + curated priors), grow from adversarially-verified extraction.
- **LLM non-diagnostic risk** — free text can imply diagnosis with no forbidden words; constrain
  generation to retrieved relationships, run the copy gate on output, keep the deterministic engine the
  authority for what fires.
- **No research corpus edges yet** — Track B ships with hand-authored relationships if needed until the
  edge pipeline produces verified ones; nao v2 + grounded synthesis wait on it.
- **Chat scope creep** — "simple chat" is deliberately minimal (text, report/delete, flag-gated).
  Anything richer is Phase 3.
- **OAuth** — community/chat on the hosted stack may want Google sign-in; slot it into the community work
  if email/password proves too high-friction for testers.
- **Stress test needs real users on hosted Supabase** — plan the tester group + hosted config (pg_cron
  settings per [memory 0005](../memory/0005-pgcron-config-prereqs.md)) ahead of the merge, not at the gate.
