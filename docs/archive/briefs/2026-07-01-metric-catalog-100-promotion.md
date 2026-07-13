# Growing the metric registry to 100 — which metrics, and why

**Date:** 2026-07-01 · **Status:** ✅ **DECISION — adopted 2026-07-01 (the 100-metric expansion; supersedes PHASE2-PLAN's thin-slice stance).** · **Source catalog:** [`../biotope/METRICS-CATALOG.md`](../../biotope/METRICS-CATALOG.md) · **Platform detail:** [`../biotope/METRICS-REGISTRY-DESIGN.md`](../../biotope/METRICS-REGISTRY-DESIGN.md) · **Plan:** [`../PHASE2-PLAN.md`](../../shared/PHASE2-PLAN.md) · **Record:** [`../memory/0014-metric-catalog-100-expansion-decision.md`](../../memory/0014-metric-catalog-100-expansion-decision.md)

## The problem

The Phase 2 metric platform is built: the registry (`shared/metrics/registry.{ts,dart}`) is the single
source of truth, adding a metric is a localized guard-protected change, and storage follows a metric's
*continuity*. But the registry only holds **19 metrics** today — the gut/hydration self-report spine
plus six wearable signals. Meanwhile the research catalog [`METRICS-CATALOG.md`](../../biotope/METRICS-CATALOG.md) describes **360** candidate
metrics (110 manual · 100 passive sensor/API · 150 derived). We want to prove the platform at scale and
give the insights engine real breadth to work with by growing the registry to **100 metrics**.

This brief says **which 100** and **why**, and — importantly — in **what order**, because a metric is
only useful once something collects it.

> **A deliberate step past the plan's "thin slice."** `PHASE2-PLAN.md` cautions against populating the
> catalog early ("build the platform + a thin slice; resist populating the full catalog"). Going to 100
> is a conscious decision to go bigger. We manage the risk two ways: (1) **phasing** — metrics are
> promoted wave-by-wave as their collector ships, never all at once; (2) **manual-forward weighting** —
> we lean on what the current Android build can actually capture, so most of the 100 earn their place by
> being collectable soon, not speculatively.

## The two rules that pick the 100

The catalog's own economics decide almost everything:

1. **Manual logging is a scarce budget; passive data is free.** So we *ration* manual metrics to an
   honest, sticky spine (plus cheap events/states that don't spend daily budget) and *maximize* the
   free passive + derived layers — breadth in the free layer is what surfaces overlooked correlations.
2. **A metric is only worth promoting when it's collectable soon.** Each wave below maps to a collector
   we're building anyway. Per registry rules, **every promotion forces its storage + contract + guards**
   before it can ship — so we promote a wave only when its collector lands, or the build goes red.

Weighting (per the manual-forward steer): **45 manual · 25 passive sensor · 12 passive API · 18 derived.**

## The 100, by promotion wave

Legend — **Tier:** T1 daily-core · T2 optional/rotating · T3 event · T4 state/period · T5 profile ·
T0 passive. **✱** = catalog "ignored-indicator" discovery bet (Part E). Existing = already registered.

### Wave 1 — Self-report expansion (now)
*Collector: the app's own logging screens. **Depends on the `events` / `state_bands` storage primitives
— the current biotope W0 next step.** No new hardware or external feeds.* This is the bulk of the
manual-forward slice: everything a person can tell us in a 30-second daily check, an in-the-moment tap,
or a start/end toggle.

**Daily-core spine (T1) — the sticky ~9-touch morning + evening check**

| Catalog | key | Why promote |
|---|---|---|
| existing | `urine_colour`, `stool_form`, `outside_meals`, `mosquito_bites`, `energy_score`, `mood_score`, `gut_comfort_score`, `symptom_flags`, `standing_water_present` | the shipped spine — stays |
| L-58 | `sleep_quality` | one morning scale; merges "slept well" + "rested"; anchors circadian trends |
| L-47 | `stress_score` | evening slider; top driver in gut/sleep cross-metric rules |
| L-20 | `nocturia_count` | "wake to pee? 0/1/2+" — the *answerable* urinary metric (replaces frequency asks) |
| new/L-35 | `sweet_drink_index` ✱ | SEA-native sugar-load proxy; 1 tap/drink, hard to fake, far honester than macro logging |
| L-42 | `fried_oily_meal` | diet chip; fat-load flag (goreng/santan) — reflux + metabolic signal |
| L-40 | `veg_fruit_intake` | diet chip; cheap fibre/diversity signal |
| D-60 proxy | `plant_diversity_count` | "different plants today? 0–10+" — microbiome-diversity proxy, one slider |

**Optional / rotating (T2) — opt-in or sampled a few times a week**

| Catalog | key | Why |
|---|---|---|
| L-28 | `appetite_score` | lets us *derive* hunger/satiety without per-meal burden |
| L-48 | `anxiety_score` | rotate with mood; distinct affect axis |
| L-51 | `brain_fog_score` | cognition trend; pairs with sleep/glucose |
| L-92 | `meditation_done` | habit toggle (or app-detected) |
| L-91 | `stretching_done` | habit toggle |
| L-109 | `spf_used` | UV is high year-round in SG/MY |
| L-37 | `smoking_vaping` | daily bucket; respiratory + CV covariate |
| L-76 | `body_weight_kg` | weekly cadence; **semi-passive** (smart scale) later |

**Events (T3) — logged at the moment; frequency/timing derived, never asked**

| Catalog | key | Why |
|---|---|---|
| L-3 | `stool_colour` | swatch tap at the Bristol event |
| L-6 | `blood_in_stool` | toggle + bright/dark; safety-relevant flag |
| L-24 | `nausea_event` | GI event |
| L-25 | `vomiting_event` | count derived from taps |
| L-26 | `reflux_event` | + timing; SEA spicy/fatty/santan trigger |
| L-35 | `caffeine_intake` | kopi/teh tap; doubles as sugar signal |
| L-36 | `alcohol_units` | sleep/HRV covariate |
| L-38 | `supplements_taken` | schedule-confirm |
| L-53 | `headache_event` ✱ | pairs with barometric/humidity swings (D-98) |
| L-61 | `skin_condition_event` | photo + tag; allergen tracing |
| L-67 | `cough_event` | pairs with haze/AQI |
| L-70 | `fever_feeling` | dengue / illness flag |
| L-90 | `exercise_session` | manual only for sessions the wearable misses |
| L-80 | `blood_glucose_manual` | fingerstick event; high SEA diabetes relevance |

**States / periods (T4) & profile (T5) — toggled or set once**

| Catalog | key | Why |
|---|---|---|
| L-39 | `antibiotic_course` | the exemplar state band; already has a table — formalize as a metric |
| new | `fasting_period` ✱ | **SEA-critical**: Ramadan/Lent/veg periods; without it the model misreads fasting as anomalies |
| L-95 | `travel_period` | destination → exposure context band |
| L-97 | `known_conditions` | onboarding profile |
| L-99 | `allergies_known` | onboarding; anchors allergen tracing |

**Wave-1 derived** (from self-report only; the "free" payoff of raw rows):

| Catalog | key | Why |
|---|---|---|
| existing | `stool_variability`, `log_completeness` | already derived — stay |
| D-64 | `hydration_status` | urine colour + drink taps (env sharpens it in Wave 3) — replaces volume asks |
| D-51 | `bowel_regularity` | from Bristol event timestamps |
| D-52 | `gut_transit_estimate` | marker-meal → BM interval |
| D-55 | `food_symptom_trigger` ✱ | lagged; spicy/santan triggers (SEA) |
| D-60 | `dietary_diversity` | from plant-count + chips |
| D-61 | `microbiome_diversity_proxy` | plants + fermented (tempeh/tapai/yakult) |
| D-58 | `gut_brain_correlation` ✱ | GI vs mood co-movement — cheap, high-discovery |

### Wave 2 — Phone-sensor signals (app-collected)
*Collector: the app reads phone sensors onto the `signals` primitive. Both-platform only — no wearable.*
Zero logging budget, and several are the catalog's cheapest "ignored indicators."

| Catalog | key | Why |
|---|---|---|
| E-1 | `gps_location` | the spine that keys every external feed in Wave 3 |
| E-2 | `location_dwell` | routine / life-space |
| E-5 | `distance_m` | complements the existing `step_count` |
| E-6 | `flights_climbed` | cheap fitness proxy |
| E-7 | `walking_speed` | mobility/aging marker |
| E-8 | `active_minutes` | activity load |
| E-9 | `activity_type` | replaces most manual exercise logging |
| E-12 | `ambient_noise_db` | sleep-environment + stress; on-device only |
| E-13 | `barometric_pressure` ✱ | pressure swings vs headache/joint pain — very cheap |
| E-22 | `phone_stationary` | sleep/inactivity proxy |
| E-21 | `charging_rhythm` ✱ | daily-routine regularity, free |
| E-23 | `bluetooth_density` | crowding / co-presence proxy |
| D-118 | `routine_regularity` ✱ | behavioural-rhythm trend from the above — cheap illness/mood signal |

### Wave 3 — Environment / `api` source (M4 / W3)
*Collector: `env_daily` ingestion keyed on GPS + time (Singapore first, 2–3 open feeds).* The One Health
differentiator and where cross-metric rules get their best pairings.

| Catalog | key | Why |
|---|---|---|
| E-58 | `air_temperature` | base exposome |
| E-59 | `humidity` | chronically high in SEA; pair with heat |
| E-61 | `heat_index` ✱ | the SEA hydration & sleep driver — replaces water-volume asks |
| E-62 | `precipitation` | rain → dengue-vector breeding lag |
| E-66 | `uv_index` | high year-round at the equator |
| E-71 | `air_quality_index` ✱ | haze season (~Jun–Oct) — major exposure variable |
| E-72 | `pm25` | haze marker |
| E-73 | `pm10` | haze |
| E-65 | `regional_pressure` | complements phone barometer for weather-sensitivity |
| E-84 | `dengue_cluster_rate` ✱ | NEA cluster feed — high SEA value |
| E-85 | `vector_alert` | dengue/Zika/chikungunya alerts |
| E-90 | `ndvi_greenness` | green-cover exposure → mood/restoration |
| D-67 | `heat_stress_exposure` ✱ | core SEA exposure (heat-index × outdoor time) |
| D-68 | `dehydration_risk` | high-yield in the tropics |
| D-82 | `personal_pm_dose` ✱ | GPS × hourly AQI — haze-season gold |
| D-92 | `allergen_symptom_lag` ✱ | haze/PM2.5 vs respiratory symptoms |
| D-98 | `weather_sensitivity` ✱ | pressure/humidity vs headache/joint — classic ignored trend |
| D-134 | `mosquito_exposure_risk` ✱ | dengue: dusk outdoor + standing water + alerts |

### Wave 4 — Wearable + semi-passive + CGM (M3 / W1)
*Collector: Health Connect / HealthKit fetch onto `signals`; needs a real device.* The six existing
wearable metrics are already registered; these deepen the passive physiological layer.

| Catalog | key | Why |
|---|---|---|
| existing | `resting_hr_bpm`, `hrv_sdnn_ms`, `sleep_duration_min`, `spo2_pct`, `body_temp_c`, `step_count` | shipped wearable signals — stay |
| E-31 | `hr_continuous` | full HR series for strain/recovery |
| E-33 | `max_hr_bpm` | exertion ceiling |
| E-37 | `respiratory_rate` | illness/anomaly detection |
| E-41 | `sleep_stages` | restorative-sleep quality |
| E-44 | `sleep_timing` | bed/wake regularity |
| E-48 | `energy_expenditure_kcal` | activity energy |
| E-49 | `glucose_cgm` ✱ | CGM — high SG/MY value given diabetes burden |
| D-17 | `recovery_readiness` | HRV + RHR + sleep composite |
| D-103 | `illness_onset_signal` ✱ | RHR↑ + temp↑ + HRV↓ vs baseline — early dengue/illness flag |

## What we deliberately left out (and why)

- **iOS-only / Android-only phone signals** (ambient lux E-11, screen/app-usage E-15–17, Wi-Fi scan
  E-24): platform-degraded, so they'd need a manual/other fallback to be trustworthy cross-platform.
  Defer until the both-platform layer proves out.
- **Pollen (E-78–80, E-97)**: coverage is sparse in SEA — low data yield here.
- **Seasonal-daylight / SAD logic** (D-15, D-114): ~12h daylight year-round makes these near-flat at the
  equator.
- **Sensitive/niche manual metrics** (libido L-75, sexual activity L-88, detailed reproductive series):
  cohort opt-in later, not part of the first 100.
- **Exotic hardware** (EDA E-45, depth scan E-29, sweat-ion E-56): no mainstream consumer path yet.
- **Manual counts we replace, not ask** (urination frequency L-18, water volume L-34, gram-level food
  L-31/33 detail): promoted only as their cheaper proxies/derivations (§B6 of the catalog).

## Reliability is promoted alongside every metric

Each metric carries its catalog reliability weight (device-measured > ambient API > in-moment event >
subjective rating > manual count). The engine confidence-weights inputs and triangulates self-report
against its passive correlate — so a ★ subjective mood rating never overrides a ★★★★ glucose trend, and
low-reliability metrics surface as personal trends only, never cross-user absolutes.

## What this unlocks

Roughly two dozen ✱ "ignored-indicator" correlations become testable — barometric/humidity vs headache,
heat-index vs sleep, haze PM2.5 vs respiratory symptoms, sweet-drink index vs energy crashes, routine
regularity vs mood — exactly the overlooked-trend discovery the product is built to find, against a
manual spine that stays a thin ~9 daily touches.

## Decisions needed

1. **Scope of the "declared but not-yet-collected" state.** Waves 2–4 are promoted as their collectors
   land. Do we want a registry marker (e.g. a `collectionStatus`) so a promoted-but-uncollected metric
   is visibly not-yet-live, or do we simply hold each wave's PR until its collector is merged?
2. **Manual-forward vs the plan's thin slice — ✅ RESOLVED (2026-07-01):** owner **adopted** the
   100-metric expansion; `PHASE2-PLAN.md` updated to match (the thin-slice stance is superseded). Waves
   can still be trimmed operationally.
3. **Wave-1 storage dependency.** Wave 1 needs the `events` / `state_bands` primitives — the current
   biotope W0 next step. Sequence: land storage primitives first, then Wave 1 promotions ride on them.
4. **Exact 45/25/12/18 split.** The counts are a starting weighting; a few metrics can move between
   T2/T3 or waves without changing the total.

---

*Snapshot at 2026-07-01. The living source of truth is `shared/metrics/registry.{ts,dart}` + the
catalog `METRICS-CATALOG.md`; this brief is the selection rationale, not the encoded registry.*
