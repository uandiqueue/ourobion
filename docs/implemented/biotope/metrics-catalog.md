---
title: Metrics Catalog — Candidate Metrics, Reorganized Around a Logging Budget (SG/MY)
summary: Broad candidate catalog organized around "manual logging is a scarce budget; passive data is free"; it is a reference for choosing supportable metrics, not a fixed registry-size or ship target. Stable IDs map onto the collectibility audit.
type: reference
scope: biotope
status: unverified
updated: 2026-08-02
---
# Metrics Catalog — Candidate Metrics, Reorganized Around a Logging Budget (SG/MY)

> **This is a candidate catalogue, not the implemented metric inventory.** Nothing here is evidence
> that a metric is collected, projected, or served. The implemented inventory is the exported
> `METRICS` array in [`shared/metrics/registry.ts`](../../../shared/metrics/registry.ts) — **24
> entries** (`SELF_REPORT` + `WEARABLE`), verified 2026-08-02. This catalogue is deliberately much
> broader; the gap between it and the registry is intended design space, not a backlog and not drift.
> Per [`AGENTS.md`](../../../AGENTS.md) §7 this file is older design material rather than
> present-state authority. To add or remove a metric, follow the runbook in
> [`metrics-registry-design.md`](metrics-registry-design.md) — the registry, not this page, is what
> the guards enforce.

A full rebuild of the metrics catalog around one organizing idea: **manual logging is a scarce budget; passive data is free.** The earlier catalog asked *"can an app collect this?"* This version asks the harder product question: *"is it worth spending the user's attention on, and if so, how do we ask so they actually answer — and answer accurately — day after day, in Singapore and Malaysia?"*

IDs are preserved (`L-31`, `E-71`, `D-47`) so this maps 1:1 onto the collectibility audit. Nothing was deleted — items that fail the budget test are **re-tiered or replaced with a cheaper proxy**, not dropped.

---

## What changed from v1

- **Three economies, not one list.** *Passive* (`E`/`D` — sensors + APIs) **and** *semi-passive* (anything the user already logs in **other** apps, synced via HealthKit / Health Connect) cost nothing per day → collect *all* of it as trend fuel. Only the **manual** layer (`L`, our own prompts) is rationed into tiers.
- **Reuse, don't re-ask — don't change the user's routine.** If they already track it elsewhere (Strava for activity, a calorie app, a period app) and it reaches the health store, we **fetch it, not re-ask** — never make them log the same thing twice (§B8).
- **The manual layer is re-sorted by *logging cost × answerability × continuity*,** not by body system.
- **Hard-to-answer metrics are replaced, not demanded.** Exact urination counts, gram-level food logs, and water-volume totals are swapped for anchored single-taps, photos, events, and proxies (see §B6).
- **Episodic ≠ daily.** One-off events (antibiotics, a vaccination, travel, a vomiting episode) never sit in the daily prompt set; they live as event taps or "period" bands that don't spend daily budget.
- **Localized for SG/MY** (diet, climate, fasting, vectors, language) — §A6 and §D.

---

# Part A — Operating principles

## A1. The three economies

| | Manual (`L` — *our* prompts) | Semi-passive (synced from the user's **other** apps via HealthKit / Health Connect) | Passive (`E`/`D` — sensors + APIs) |
|---|---|---|---|
| **Cost to user** | attention every entry — *scarce* | ~zero — they already log it elsewhere | ~zero after one-time permission |
| **Failure mode** | survey fatigue → drop-off + satisficing | source-app gaps; user uses no such app | hardware / coverage gaps |
| **Quality over time** | decays as motivation fades | as good (or bad) as the source app | stable; collected silently for months |
| **Right strategy** | **ration** to a thin spine | **fetch first**, ask only as fallback | **maximize** — collect all |
| **Budget applied?** | **yes** — the whole point | **no** | **no** |

> The semi-passive layer is the practical heart of "don't change the routine": most engaged users *already* run a tracker or two. Read those through the health store and reserve our own prompts for what no other app captures.

The evidence backs this split: in experience-sampling research, passive sensing "imposes less demand on participants, improving compliance, and allows data to be collected for much longer periods" while being "less likely to change the behaviour being studied." Self-report earns its place only when it captures something no sensor can — and only if asked cheaply.

> **Design consequence for your goal (new trends via ignored indicators):** the discovery engine is the *passive* layer correlated against a *thin, reliable* self-report spine. Spend manual budget on a handful of honest signals; let the free layer be wide.

## A2. The three levers that decide every manual metric

1. **Continuity** — does it form a daily time-series, or is it a rare event?
   - *Continuous* (eaten today, slept, mood, stool) → eligible for daily logging; these build trends.
   - *Episodic* (vomiting, insect bite, new diagnosis) → **never** a daily prompt; capture as an event. A trend can't be built from something that happens twice a year, and asking daily just burns budget and trains the user to tap "no."
2. **Answerability** — can they answer accurately with low effort, or will they forget / guess / round?
   - *Easy*: binary, single most-recent instance, anchored to a salient moment.
   - *Hard*: requires counting across a day, recalling quantities, or aggregating (the classic traps: "how many times did you urinate?", "how many ml of water?", "what exactly did you eat?").
3. **Logging cost** — taps + seconds + cognitive load.

A metric is **trend-grade** when it is *continuous AND easy*. Everything else gets demoted, made into an event, or **replaced by a proxy that is continuous and easy** (§B6).

> Note on "trend-fit" ratings below: per your steer, these score *suitability for longitudinal logging* (continuity × answerability), **not** clinical importance — that's your later research.

## A3. The tier ladder

| Tier | Name | When it's collected | Budget cost |
|---|---|---|---|
| **T0** | **Passive** | Always, silently (sensors, APIs, wearables) | None |
| **T1** | **Daily Core** | Anchored morning + evening micro-checks | ~30–60s/day total, sticky |
| **T2** | **Daily Optional / Rotating** | Opt-in, or app rotates "one extra today" | A few taps, spread over days |
| **T3** | **Event-Triggered** | Only when the thing happens (quick-action/widget) | Pay-per-event; zero on quiet days |
| **T4** | **Periods / States** | Toggle once at start & end of a span | ~2 taps per span (not per day) |
| **T5** | **Profile / Static** | Onboarding + occasional review | One-time |

Frequency, timing, and counts are **derived from T3 event timestamps** — never asked. ("How often do you poo?" is answered by counting taps, not by a survey question.)

## A4. Design patterns that turn "hard" into "easy"

- **Anchor to a salient moment.** First-morning pee → urine-colour tap. After a meal → photo. You remember the instance because you're in it; you can't remember a daily total.
- **Event → derived frequency.** One tap when it happens; the app computes per-day/per-week rates. Removes recall entirely.
- **Bounded categorical beats open count.** "Wake to pee? 0 / 1 / 2+" not "how many times?". "Rice/noodle portions: 0 / 1 / 2 / 3+" not grams.
- **Photo / barcode / voice instead of typing.** A meal photo or 3-second voice note is one action; structured fields are derived later by a model. Lower friction *and* lower fabrication.
- **Progressive disclosure.** A single daily gateway — *"Anything feel off today?"* — opens the symptom body-map only when the answer is yes. Most days it's one tap.
- **"Same as usual" carry-forward.** Default to yesterday's profile (diet pattern, meds); the user edits only deltas.
- **Rotation / sampling.** Don't ask all wellbeing items daily — rotate so each is sampled a few times a week. EMA gets its validity from *repetition over time*, not from completeness on any single day.
- **Schedule-confirm, don't free-recall.** For regular meds/supplements: a scheduled "Taken? ✓" beats "what did you take today?".

## A5. Rating legend (used throughout Part B)

- **Cost:** 🟢 1 tap / <5s · 🟡 a few taps / categorical / 5–15s · 🔴 multi-field / recall / >15s
- **Continuity:** ● continuous (daily series) · ◆ episodic (event) · ▮ state/period · ○ static (profile)
- **Answerability:** **E** easy · **M** medium · **H** hard (recall/estimation risk)
- **Trend-fit:** ★★★ continuous+easy · ★★ usable · ★ weak (episodic or hard) — *logging suitability only, not health value*
- **Source:** 🔁 *semi-passive* — the value can be **fetched from HealthKit / Health Connect** if another app already logs it; the manual tiers are then just the *fallback* (see §B8)

## A6. SG/MY localization principles (full detail in §D)

- **Diet is eaten *out* and is *sweet-drink-heavy*.** Hawker/kopitiam/mamak culture means "what did you cook" misses most meals. The high-signal, low-effort tags are local: *kopi/teh* (sweetened, condensed/evaporated milk), bubble tea, hawker-vs-home, fried (*goreng*), coconut (*santan*) dishes, rice/noodle portions, sambal/chili (reflux trigger), dairy (lactose intolerance is common). Sugary-drink frequency is a cheaper, more honest diabetes-risk signal here than macro logging.
- **Climate is equatorial and constant.** ~12h daylight year-round → seasonal-daylight/SAD logic is largely irrelevant; **heat, humidity, and haze** dominate the exposome. Hydration is better inferred from heat exposure + urine colour than asked as volume.
- **Vectors matter.** Dengue (daytime *Aedes*) is endemic with rainy-season peaks → insect-bite events + fever episodes + local cluster feeds are first-class, not afterthoughts.
- **Fasting & feasting are calendar events.** Ramadan brings ~30 days of dawn-to-dusk no food/water for Muslim-Malay users; without a "fasting period" toggle the model will read it as anomalies. Hari Raya, CNY, Deepavali, Lent, Vesak/Thaipusam vegetarian periods reshape diet too.
- **Multilingual, multi-script.** EN / Malay / Mandarin / Tamil + dialects → prefer icons, photos, emoji scales, and voice over free text.

---

# Part B — The manual layer, rebuilt by tier

Columns: **Cost** (🟢/🟡/🔴) · **Cont.** (●continuous ◆episodic ▮state ○static) · **Ans.** (E/M/H) · **Fit** (★ logging-suitability only) · how to ask.

## B1. Tier 1 — Daily Core (the sticky spine: two ~30s micro-checks)

**Morning check** — anchored to waking:

| ID · Metric | Cost | Cont. | Ans. | Fit | How to ask |
|---|:--:|:--:|:--:|:--:|---|
| L-58/60 · Slept well / rested | 🟢 | ● | E | ★★★ | one morning scale; merges "sleep quality" + "feeling rested" (don't ask both) |
| L-46 · Mood | 🟢 | ● | E | ★★★ | emoji / 5-pt |
| L-49 · Energy | 🟢 | ● | E | ★★★ | 3-pt; **L-50 fatigue is its inverse — drop it** |
| L-15 · Urine colour (first pee) | 🟢 | ● | E | ★★★ | 1-tap swatch; hydration proxy — **replaces volume asks** |
| L-1 · Stool passed? (Bristol if yes) | 🟢 | ◆→● | E | ★★★ | cheap binary "poo today?"; event tap adds Bristol |
| L-20 · Nocturia | 🟢 | ● | E | ★★ | "wake to pee? 0 / 1 / 2+" — the *answerable* urinary metric |

**Evening check** — anchored to wind-down:

| ID · Metric | Cost | Cont. | Ans. | Fit | How to ask |
|---|:--:|:--:|:--:|:--:|---|
| L-47 · Stress today | 🟢 | ● | E | ★★★ | slider |
| Diet pattern chips (SEA) | 🟡 | ● | E | ★★★ | sugary drink? · fried/oily? · ate out/hawker? · veg or fruit? — condenses L-35/L-40/L-42/L-43 |
| L-«gate» · "Anything feel off today?" | 🟢 | ● | E | ★★★ | 1 tap; opens the symptom map (T3) **only if yes** |

→ ~9 touches across two anchored moments. Everything below is optional on top of this.

## B2. Tier 2 — Daily Optional / Rotating (opt-in, or app samples a few times/week)

| ID · Metric | Cost | Cont. | Ans. | Fit | Note |
|---|:--:|:--:|:--:|:--:|---|
| L-21 · Bloating | 🟡 | ● | M | ★★ | evening 1-tap; GI series |
| L-28 · Appetite | 🟡 | ● | M | ★★ | also lets us *derive* L-29 hunger/satiety |
| L-48 · Anxiety | 🟡 | ● | M | ★★ | rotate with mood |
| L-51 · Brain fog / clarity | 🟡 | ● | M | ★★ | rotate |
| L-52 · Focus | 🟡 | ● | M | ★★ | or derive from an in-app reaction test |
| L-94 · Social interaction quality | 🟡 | ● | M | ★★ | |
| L-23 · Gas / flatulence | 🟡 | ● | M | ★ | rotate; low daily value |
| L-30 · Food cravings (type) | 🟡 | ◆ | M | ★★ | tag; pairs with mood → emotional-eating (D-119) |
| L-75 · Libido | 🟡 | ● | M | ★ | sensitive; opt-in / rotate |
| L-59 · Dream recall / nightmares | 🟢 | ● | E | ★ | toggle; opt-in |
| L-91 · Stretching / mobility done | 🟢 | ● | E | ★★ | habit toggle |
| L-92 · Meditation / breathwork done | 🟢 | ● | E | ★★ | toggle (or app-detected) |
| L-109 · Sun protection (SPF) | 🟢 | ● | E | ★★ | toggle; UV high **year-round** in SG/MY |
| L-37 · Smoking / vaping | 🟡 | ● | M | ★★ | daily bucket or event |
| L-76 · Body weight | 🟡 | ● | E | ★★ | weekly cadence; auto via smart scale (E-50) |
| L-77 · Waist / hip | 🔴 | ◆ | M | ★ | occasional; tape needed |
| L-84 · Cervical mucus | 🟡 | ● | M | ★★ | TTC cohort opt-in |
| L-87 · Menopausal symptoms | 🟡 | ● | M | ★★ | cohort opt-in |

## B3. Tier 3 — Event-Triggered (log at the moment via quick-action/widget; frequency & timing are *derived*, never asked)

**Digestive events** (one Bristol tap powers most gut metrics):

| ID · Metric | Cost | Ans. | Fit | Note |
|---|:--:|:--:|:--:|---|
| L-1 · Stool form (Bristol) | 🟢 | E | ★★★ | visual tap; **frequency L-5, transit L-14 derived from timestamps** |
| L-3 · Stool colour | 🟢 | E | ★★ | swatch |
| L-6 · Blood in stool | 🟢 | E | ★★ | toggle + bright/dark |
| L-4 / L-7 / L-8 / L-10 · volume / mucus / undigested / floating | 🟢 | E | ★ | optional toggles at the same event |
| L-11 / L-12 / L-13 · urgency / evacuation / straining | 🟢 | M | ★ | sliders at event |
| L-19 · Urinary urgency | 🟢 | M | ★ | at event |
| L-24 · Nausea | 🟢 | E | ★★ | |
| L-25 · Vomiting | 🟢 | E | ★★ | count derived |
| L-26 · Heartburn / reflux | 🟡 | M | ★★ | + timing; **SEA spicy/fatty/santan trigger** |

**Meals & intake events:**

| ID · Metric | Cost | Ans. | Fit | Note |
|---|:--:|:--:|:--:|---|
| L-31 · Food intake | 🔁 / 🟢 | E | ★★★ | **semi-passive: fetch `Nutrition` from the health store if a calorie app feeds it (§B8).** Else a **meal photo** → items/portion/macros derived |
| L-33 · Portion size | 🟢 | E | ★★ | from photo, or quick S/M/L |
| L-35 · Caffeine (*kopi/teh*/energy) | 🟢 | E | ★★★ | tap; SEA-localized, doubles as a **sugar** signal |
| L-36 · Alcohol (units) | 🟢 | E | ★★ | tap |
| L-38 · Supplements | 🟢 | E | ★★ | schedule-confirm |
| L-41 · Suspected trigger food | 🟡 | M | ★★ | tag at meal, opt-in |
| L-80 · Blood glucose (fingerstick) | 🟡 | E | ★★ | event; or passive CGM (E-49) — **high SEA relevance** |
| L-78 · Body temp (manual) | 🟡 | E | ★★ | when febrile; or wearable (E-38) |
| L-79 · Blood pressure (cuff) | 🟡 | E | ★★ | event; or device (E-46) |

**Symptoms** — opened by the T1 gateway; body-map + tags + optional voice note:

| ID · Metric | Cost | Ans. | Fit | Note |
|---|:--:|:--:|:--:|---|
| L-22 / L-55 · Abdominal / regional pain | 🟡 | M | ★★ | body map |
| L-53 · Headache | 🟡 | M | ★★ | **pairs with barometric swings (D-98)** |
| L-56 · Joint stiffness | 🟡 | M | ★★ | weather-linked (D-98) |
| L-54 · Dizziness | 🟢 | E | ★ | |
| L-57 · Muscle soreness | 🟡 | M | ★ | post-exercise |
| L-61 · Skin condition | 🟢 | E | ★★ | photo + tag |
| L-63 / L-64 / L-65 · oral / eye / tinnitus | 🟡 | M | ★ | tags |
| L-66 · Sneezing / congestion | 🟡 | M | ★★ | **pairs with haze/AQI/pollen** |
| L-67 · Cough (dry/productive) | 🟡 | M | ★★ | + passive cough audio (D-109) |
| L-68 / L-69 · sore throat / breathlessness | 🟢 | E | ★★ | **haze-relevant** |
| L-70 · Fever feeling / chills | 🟢 | E | ★★ | **dengue / illness flag** |
| L-71 / L-72 / L-73 · night sweats / hives / oedema | 🟢 | E | ★★ | toggles; hives → allergen tracing |

**Behaviour & exposure events:**

| ID · Metric | Cost | Ans. | Fit | Note |
|---|:--:|:--:|:--:|---|
| L-104 · **Insect bite** (+location) | 🟢 | E | ★★★ | **dengue — first-class in SG/MY** |
| L-90 · Exercise (type + RPE) | 🟡 | M | ★★ | mostly passive (E-9/wearable); manual only for untracked |
| L-88 · Sexual activity | 🟢 | E | ★ | toggle |
| L-93 · Major life event / stressor | 🟡 | M | ★★ | tag / text |
| L-102 · Contact with sick person | 🟢 | E | ★★ | toggle |
| L-103 · Contact w/ animals / livestock | 🟢 | E | ★★ | **One Health** |
| L-101 · Pet health / symptoms | 🟡 | M | ★★ | **One Health** link to L-100 |
| L-107 / L-108 · cleaning chemical / new cosmetic | 🟡 | M | ★ | allergen tracing |
| L-81 · Menstruation start/end | 🟢 | E | ★★★ | predicted + confirm; opens period state |
| L-82 / L-83 · flow / menstrual symptoms | 🟡 | E/M | ★★ | period-active only |
| L-85 · Ovulation test | 🟢 | E | ★★ | TTC opt-in |
| L-96 · Vaccination | 🟡 | E | ★ | also profile |

## B4. Tier 4 — Periods / States (toggle once at start & end → a covariate band, not a daily prompt)

> This is where your **antibiotics** example lives: a course is a *span*, logged twice, not a daily question. Discontinuous data becomes a band on the timeline that the trend engine can condition on — without spending daily budget.

| ID · Metric | Cont. | Ans. | Note |
|---|:--:|:--:|---|
| L-39 · Medication course (e.g., antibiotics) | ▮ | E | start/end band; chronic meds → scheduled "Taken? ✓" |
| **Fasting period** (Ramadan, Lent, vegetarian periods) | ▮ | E | **SEA-critical**: reshapes meal-timing, hydration, sleep, glucose interpretation |
| Illness episode | ▮ | E | "sick since…" band, opened from fever/symptom events |
| L-95 · Travel | ▮ | E | destination → exposure context |
| L-86 · Pregnancy (status/week) | ▮ | E | auto-advances weeks |
| L-89 · Contraception change | ▮ | E | state span |

## B5. Tier 5 — Profile / Static (set once at onboarding; occasional review)

| ID · Metric | Note |
|---|---|
| L-97 · Known diagnoses / conditions | onboarding |
| L-98 · Family history | onboarding |
| L-99 · Allergies (known) | onboarding |
| L-100 · Pet ownership & species | **One Health** anchor |
| L-106 · Occupation / occupational exposures | onboarding |
| L-105 · Home environment (damp, mold, pests) | occasional |
| L-62 · Hair / nail baseline | occasional photo |
| L-74 · Bruising tendency | rare flag |

## B6. Replacements — traditional metric → why it fails the budget → cheaper proxy

| # | Traditional ask | Why it fails | Proposed replacement (continuous + easy) |
|---|---|---|---|
| 1 | **L-18 Urination frequency / count** | counting all day; forgotten by evening | first-morning **urine colour** (L-15) + **nocturia bucket** (L-20) + optional in-moment pee tap → *frequency derived* |
| 2 | **L-34 Water / fluid volume** | ml unknown; soup/*kopi/teh*-heavy diet; forgotten | urine colour proxy + **drink-event taps** (kopi/teh/bottle) + passive **heat-index** (E-61) → *net hydration derived* (D-64) |
| 3 | **L-31/33 Food items + portions + macros** | recall failure, fabrication, mostly eaten out | **Fetch `Nutrition` from the health store** (the user's existing calorie app, §B8) first; else **meal photo** + **SEA chips** + **plant-count** → *macros derived* (D-71). *Fetched kcal is still low-accuracy — §F.* |
| 4 | **L-5 Stool frequency** | counting / recall | Bristol **event tap** → *frequency derived* (D-51) |
| 5 | **L-29 Hunger/satiety per meal** | per-meal burden | one daily **appetite** (L-28) + derive from meal events |
| 6 | **~30 symptom sliders (L-46–L-75)** | too many to ask daily | one **gateway** + progressive disclosure + **rotation** + voice note |
| 7 | **L-90 Exercise type / RPE** | duplicates sensors | passive activity (E-9 / wearable) + optional RPE tap for untracked sessions |
| 8 | **L-39 "What meds today?"** | free recall | **schedule-confirm** (chronic) / **period band** (course) / event (PRN) |
| 9 | **L-32 Meal timing** | extra field | *timestamp of the photo/event* — free |
| 10 | **Fiber / plant detail** | needs macro knowledge | **"different plants today? 0–10+"** slider → microbiome-diversity proxy (D-61) |

**New proxy metric proposed (SEA-native):** *Sweet-drink index* — daily count of sweetened *kopi/teh*/bubble-tea/soft-drink events (from L-35 taps). One tap per drink, continuous, hard to fake, and a far more honest everyday sugar-load signal for SG/MY than gram-level logging.

## B7. Demoted / merged / derived (nothing deleted — just no longer a daily prompt)

- **Merged:** L-2 hardness → into L-1 Bristol · L-50 fatigue → inverse of L-49 · L-60 rested → into L-58 sleep.
- **Derived from events (not asked):** L-5 frequency · L-14 toilet time · L-29 hunger/satiety · L-32 meal timing.
- **Replaced (see §B6):** L-18 · L-34 · L-31/33 detail.
- **Optional-only / low signal:** L-9 odour · L-16 clarity · L-17 urine odour · L-27 belching · L-44 eating context.
- **Dropped for SG/MY:** L-45 chewing thoroughness (low signal, hard) · L-110 clothing layers (negligible thermal variance in the tropics).

## B8. Semi-passive — fetch from the health store, don't re-ask

**Principle: don't change the user's routine.** If a value already lives in **HealthKit** (iOS) or **Health Connect** (Android) — written by an app or device the user *already* uses — **fetch it**. The manual tiers above become the **fallback**, surfaced only for people who don't track it elsewhere. This avoids duplicate logging and pulls in data we'd otherwise have to spend budget asking for. Accuracy is inherited from the source app — see §F.

| Our metric(s) | Health-store type (iOS / Android) | Common source | If present | Manual fallback |
|---|---|---|:--:|---|
| L-31/33 food → D-71 macros | Nutrition / `NutritionRecord` | MyFitnessPal, Cronometer, FatSecret | **fetch** | meal photo + SEA chips |
| L-34 hydration → D-64 | Dietary Water / `HydrationRecord` | water-tracker apps | **fetch** | urine colour + drink taps |
| L-90 exercise → D-31… | Workout / `ExerciseSessionRecord` | Strava, Nike, Garmin, watch | **fetch** | event tap + RPE |
| L-76 weight | Body Mass / `WeightRecord` | smart scale, other apps | **fetch** | weekly manual |
| L-78 body temp | Body Temperature / `BodyTemperatureRecord` | thermometer / wearable | **fetch** | manual when febrile |
| L-79 blood pressure | Blood Pressure / `BloodPressureRecord` | cuff app | **fetch** | manual |
| L-80 blood glucose | Blood Glucose / `BloodGlucoseRecord` | CGM / glucometer app | **fetch** | fingerstick event |
| L-81/82 menstruation / flow | Menstruation / `MenstruationFlowRecord` | Flo, Clue, period apps | **fetch** | event / state |
| L-84 cervical mucus | Cervical Mucus / `CervicalMucusRecord` | period trackers | **fetch** | manual |
| L-85 ovulation test | Ovulation Test / `OvulationTestRecord` | fertility apps | **fetch** | manual |
| L-88 sexual activity | Sexual Activity / `SexualActivityRecord` | health / period apps | **fetch** | event toggle |
| L-92 mindfulness | Mindful Session *(iOS only)* | Calm, Headspace | **fetch** | toggle |

*Platform note:* Health Connect has **no mindfulness/meditation type** (and no raw-ECG type). Where a store type is iOS-only, the manual fallback carries Android. **Onboarding flow:** detect which source apps are populating the store, switch each matching metric to fetch-mode, and silently retire its prompt — re-surfacing it only if the source goes quiet.

> Net effect on budget: for a user who already runs a calorie app + Strava + a period app, roughly a dozen would-be prompts collapse to **zero** — they fall straight into the passive pool, leaving the manual spine even thinner.

---

# Part C — The passive layer (zero logging budget)

**Collect all of it.** None of these spend the user's attention, so the budget logic does not apply — breadth is exactly what powers *finding new trends via usually-ignored indicators*. Status icons carry over from the collectibility audit (✅ both platforms · 🟡 Android-only/iOS-degraded · 🟠 hardware/coverage-gated · 🔴 not app-collectible). The **🔆 flag marks cheap, under-used "ignored indicators"** worth correlating early.

> **Platform reality (unchanged, condensed):** three iOS sandboxes drive every 🟡 — ambient light/lux (no iOS API), screen/app-usage (alerts only, no export), Wi-Fi scan (no iOS API). 🟠 items aren't an OS problem — they need a wearable/CGM/scale or a regional dataset. Build the spine on **location + timestamp**, which alone unlock the entire external-API layer identically on both OSes.

## C1. Auto-fetchable `E` (E-1 … E-100)

### Phone sensors & OS signals (E-1 … E-30)

| ID · Metric | St | How / SG-MY & ignored-indicator note |
|---|:--:|---|
| E-1 GPS location | ✅ | spine of the catalog; keys every external API below |
| E-2 Location history / dwell | ✅ | visit + significant-change logging → routine, life-space |
| E-3 Altitude | ✅ | GPS + barometer |
| E-4 Step count | ✅ | HealthKit / Health Connect |
| E-5 Distance | ✅ | pedometer + GPS |
| E-6 Flights of stairs | ✅ | pedometer / barometer |
| E-7 Walking speed / pace | ✅ | GPS + motion |
| E-8 Active / movement minutes | ✅ | accelerometer |
| E-9 Detected activity type | ✅ | replaces most manual exercise logging (L-90) |
| E-10 Transport mode | ✅ | activity + speed |
| E-11 Ambient light (lux) | 🟡 | Android free; iOS none. Circadian timing only — **not** seasonal here |
| E-12 Ambient noise (dB) | ✅ | on-device only; never store raw audio |
| E-13 Barometric pressure | ✅ | 🔆 **ignored indicator** — pressure swings vs headache/joint pain (very cheap) |
| E-14 Orientation / posture | ✅ | accel + gyro |
| E-15 Screen-on / screen time | 🟡 | Android only; iOS no export |
| E-16 App usage by category | 🟡 | Android only |
| E-17 Phone pickups / unlocks | 🟡 | 🔆 Android only — restlessness/attention proxy |
| E-18 Notification volume | 🟡 | Android only (sensitive) |
| E-19 Keystroke dynamics | 🔴 | in-app text fields only |
| E-20 Touch / scroll patterns | ✅ | 🔆 in-app only — fatigue/cognition proxy |
| E-21 Charging start/stop | ✅ | 🔆 **ignored indicator** — daily-routine regularity, free |
| E-22 Phone-stationary periods | ✅ | sleep/inactivity proxy |
| E-23 Bluetooth device density | ✅ | crowding/co-presence proxy |
| E-24 Wi-Fi network density | 🟡 | Android only |
| E-25 Timezone changes | ✅ | jet-lag |
| E-26 Local time of events | ✅ | OS clock |
| E-27 Camera PPG heart rate | ✅ | finger-on-lens spot HR — no wearable needed |
| E-28 Camera skin/eye/tongue imaging | ✅ | 🔆 tongue/eye imaging is an under-used, TCM-familiar input in SG/MY |
| E-29 Depth face/body scan | 🟠 | iOS TrueDepth / some Android ToF |
| E-30 Voice features (pitch, jitter) | ✅ | 🔆 from any voice note — respiratory/affect biomarker |

### Wearables & peripherals (E-31 … E-57) — all 🟠 (need the device, not the OS)

| ID · Metric | St | Note |
|---|:--:|---|
| E-31 Heart rate (continuous) | 🟠 | watch/ring PPG |
| E-32 Resting HR | 🟠 | overnight |
| E-33 Max / peak HR | 🟠 | during exertion |
| E-34 HRV (RMSSD) | 🟠 | autonomic baseline |
| E-35 SpO₂ | 🟠 | watch / oximeter |
| E-36 ECG (single-lead) | 🟠 | iOS HealthKit; Android via vendor SDK |
| E-37 Respiratory rate | 🟠 | watch/ring/strap |
| E-38 Skin / wrist temp | 🟠 | thermistor — illness/fever, cycle |
| E-39 Core body temp estimate | 🟠 | few devices, low confidence |
| E-40 Sleep duration | 🟠 | watch/ring; phone-only rough |
| E-41 Sleep stages | 🟠 | wearable only |
| E-42 Sleep onset latency | 🟠 | wearable |
| E-43 Wake-after-onset / awakenings | 🟠 | wearable |
| E-44 Sleep timing (bed/wake) | 🟠 | wearable; phone-approx via E-22 |
| E-45 Electrodermal activity | 🔴 | vendor SDK only |
| E-46 Blood pressure | 🟠 | cuff; some watches |
| E-47 VO₂max estimate | 🟠 | watch algorithm |
| E-48 Energy expenditure | 🟠 | watch; phone rough |
| E-49 Continuous glucose | 🟠 | 🔆 CGM — **high SG/MY value** given diabetes burden |
| E-50 Body weight | 🟠 | smart scale |
| E-51 Body fat / composition | 🟠 | bioimpedance scale |
| E-52 Fall / hard-fall | 🟠 | watch accelerometer |
| E-53 Cadence / stride | 🟠 | watch/foot pod |
| E-54 Cycling power / pace | 🟠 | connected sensors |
| E-55 Snoring / night breathing audio | ✅ | **phone/earbud mic — not wearable-gated** |
| E-56 Hydration / sweat-ion sensor | 🔴 | no mainstream consumer hardware yet |
| E-57 UV exposure (wearable) | 🟠 | few devices populate it |

### External APIs keyed to location + time (E-58 … E-100) — all collectible on both OSes; only dataset/coverage gates

| ID · Metric | St | SG-MY & ignored-indicator note |
|---|:--:|---|
| E-58 Temperature | ✅ | weather API |
| E-59 Humidity | ✅ | **chronically high in SEA — pair with heat** |
| E-60 Dew point | ✅ | |
| E-61 "Feels-like" / heat index | ✅ | 🔆 **the SEA hydration & sleep driver** — replaces water-volume asks |
| E-62 Precipitation | ✅ | rain → dengue-vector breeding lag |
| E-63 Wind speed/direction | ✅ | |
| E-64 Cloud cover | ✅ | |
| E-65 Atmospheric pressure (regional) | ✅ | complements E-13 |
| E-66 UV index | ✅ | **high year-round at the equator** |
| E-67 Sunrise / sunset | ✅ | ~12h, near-constant — minimal seasonal swing |
| E-68 Daylight length | ✅ | **near-flat in SG/MY — de-emphasize seasonal logic** |
| E-69 Solar elevation | ✅ | |
| E-70 Moon phase | ✅ | 🔆 cheap "ignored indicator" to test vs sleep |
| E-71 Air Quality Index | ✅ | 🔆 **haze season (≈Jun–Oct) — major exposure variable** |
| E-72 PM2.5 | ✅ | **haze marker** |
| E-73 PM10 | ✅ | haze |
| E-74 Ozone | ✅ | |
| E-75 NO₂ | ✅ | traffic corridors |
| E-76 SO₂ | ✅ | |
| E-77 CO | ✅ | |
| E-78 Pollen — tree | ✅ | sparse coverage in SEA |
| E-79 Pollen — grass | ✅ | sparse in SEA |
| E-80 Pollen — weed | ✅ | sparse in SEA |
| E-81 Mold spore counts | 🟠 | limited coverage |
| E-82 Wildfire smoke / fire proximity | ✅ | **regional peatland-fire smoke = haze source** |
| E-83 Respiratory illness surveillance | 🟠 | coverage varies |
| E-84 Local outbreak / case data | 🟠 | 🔆 **dengue clusters (e.g. NEA SG feed)** — high value |
| E-85 Vector-borne disease alerts | 🟠 | **dengue/Zika/chikungunya — core SEA layer** |
| E-86 Water quality reports | 🟠 | jurisdiction-dependent |
| E-87 Walkability score | ✅ | |
| E-88 Noise map level | ✅ | |
| E-89 Light-pollution level | ✅ | VIIRS dataset |
| E-90 Land cover / NDVI (greenness) | ✅ | needs own processing |
| E-91 Proximity to parks / green | ✅ | |
| E-92 Proximity to water (blue) | ✅ | standing water → vector breeding |
| E-93 Proximity to major roads | ✅ | |
| E-94 Food environment | ✅ | 🔆 hawker/fast-food density — SEA-relevant |
| E-95 Healthcare facility proximity | ✅ | |
| E-96 Elevation / terrain | ✅ | |
| E-97 Pollen / allergy forecast | ✅ | sparse in SEA |
| E-98 Tide times (coastal) | ✅ | |
| E-99 Traffic / congestion | ✅ | commute-pollution input |
| E-100 Population density | ✅ | crowding / transmission context |

## C2. Derived `D` (D-1 … D-150)

A derived metric is collectible when **all its inputs** are — so 🟡/🟠 breakages propagate. None cost logging budget. 🔆 marks cheap, high-discovery "ignored indicators."

### Sleep & circadian (D-1 … D-15)

| ID · Metric | St | Note |
|---|:--:|---|
| D-1 Sleep regularity index | ✅ | timing variance |
| D-2 Social jet lag | ✅ | weekday vs weekend midpoint |
| D-3 Chronotype | ✅ | habitual midpoint |
| D-4 Sleep debt | ✅ | need − actual |
| D-5 Sleep efficiency | ✅ | accurate with wearable |
| D-6 Circadian light alignment | 🟡 | iOS: Watch daylight timing |
| D-7 Morning light dose | 🟡 | iOS: daylight minutes |
| D-8 Evening light at night | 🟡 | Android only |
| D-9 Pre-sleep screen time | 🟡 | Android only |
| D-10 Jet-lag burden | ✅ | timezone shifts |
| D-11 Sleep environment quality | 🟡 | iOS: noise+temp, drop light |
| D-12 Nighttime noise disturbance | ✅ | mic events |
| D-13 Bedroom temp comfort | ✅ | 🔆 **hot/humid nights — strong SEA sleep driver via E-61** |
| D-14 Restorative sleep score | 🟠 | needs sleep stages |
| D-15 Seasonal sleep shift | ✅ | **near-flat at equator — low yield here** |

### Cardiovascular / autonomic (D-16 … D-27) — all 🟠 (wearable HR/HRV)

| ID · Metric | St | Note |
|---|:--:|---|
| D-16 Autonomic balance trend | 🟠 | HRV baseline |
| D-17 Recovery / readiness | 🟠 | HRV+RHR+sleep |
| D-18 Resting HR drift | 🟠 | longitudinal RHR |
| D-19 Cardiorespiratory fitness trend | 🟠 | RHR+VO₂max |
| D-20 HR recovery post-exercise | 🟠 | |
| D-21 Cardiac strain in activity | 🟠 | %max HR |
| D-22 Training load (acute) | 🟠 | intensity×duration |
| D-23 Acute:chronic workload | 🟠 | 7d vs 28d |
| D-24 Overtraining risk | 🟠 | |
| D-25 Blood-pressure variability | 🟠 | |
| D-26 Orthostatic response | 🟠 | HR on standing |
| D-27 Physiological stress load | 🟠 | low HRV (EDA fallback) |

### Activity, fitness & neuromotor (D-28 … D-43)

| ID · Metric | St | Note |
|---|:--:|---|
| D-28 Sedentary time | ✅ | |
| D-29 Prolonged sitting bouts | ✅ | |
| D-30 NEAT | ✅ | non-exercise movement |
| D-31 Activity-intensity distribution | ✅ | HR zones richer w/ wearable |
| D-32 Aerobic vs anaerobic split | 🟠 | needs HR |
| D-33 Active-transport ratio | ✅ | walk/cycle vs vehicle |
| D-34 Daily energy expenditure | ✅ | step-based; wearable improves |
| D-35 Energy balance | ✅ | present as range, not target |
| D-36 Gait speed | ✅ | 🔆 cheap mobility/aging marker |
| D-37 Stride / cadence regularity | ✅ | |
| D-38 Gait asymmetry | 🟠 | needs dual sensors |
| D-39 Balance / sway | ✅ | in-app test |
| D-40 Fall-risk score | ✅ | |
| D-41 Tremor index | ✅ | 🔆 in-app, under-used |
| D-42 Stair-climb fitness | 🟠 | HR response |
| D-43 Movement entropy / diversity | ✅ | 🔆 routine-variety proxy |

### Metabolic & glycemic (D-44 … D-50) — all 🟠 (CGM)

| ID · Metric | St | Note |
|---|:--:|---|
| D-44 Postprandial glucose spike | 🟠 | 🔆 **per-meal spike — high SG/MY diabetes value** |
| D-45 Glycemic response per food | 🟠 | links to meal photo |
| D-46 Glucose variability | 🟠 | |
| D-47 Time-in-range | 🟠 | |
| D-48 Metabolic flexibility | 🟠 | |
| D-49 Dawn-phenomenon | 🟠 | |
| D-50 Meal–activity glucose interaction | 🟠 | post-meal walk effect |

### Digestive / gut (D-51 … D-63) — all ✅ (events + activity)

| ID · Metric | St | Note |
|---|:--:|---|
| D-51 Bowel regularity score | ✅ | from Bristol events |
| D-52 Gut transit estimate | ✅ | marker-meal → BM interval |
| D-53 Constipation risk | ✅ | freq+hardness+fiber+hydration+activity |
| D-54 Diarrhea clustering | ✅ | |
| D-55 Food–symptom trigger | ✅ | 🔆 **lagged; spicy/santan triggers — SEA** |
| D-56 Reflux trigger analysis | ✅ | meal+posture |
| D-57 IBS flare prediction | ✅ | stress+diet+sleep |
| D-58 Gut–brain correlation | ✅ | 🔆 GI vs mood co-movement |
| D-59 Fiber intake estimate | ✅ | from food log/photo |
| D-60 Dietary diversity index | ✅ | from plant-count proxy |
| D-61 Microbiome-diversity proxy | ✅ | plants + fermented (tempeh/tapai/yakult) |
| D-62 Ultra-processed ratio | ✅ | |
| D-63 Post-meal movement habit | ✅ | steps after meals |

### Hydration & thermoregulation (D-64 … D-70) — all ✅

| ID · Metric | St | Note |
|---|:--:|---|
| D-64 Hydration status | ✅ | **intake proxy + urine colour + heat — replaces volume asks** |
| D-65 Sweat-loss estimate | ✅ | activity + heat-index |
| D-66 Electrolyte-loss estimate | ✅ | |
| D-67 Heat-stress exposure | ✅ | 🔆 **core SEA exposure (E-61 × outdoor time)** |
| D-68 Dehydration risk (heat) | ✅ | **high-yield in tropics** |
| D-69 Cold exposure | ✅ | rare in SG/MY (aircon only) |
| D-70 Thermal comfort index | ✅ | temp/humidity/wind |

### Nutrition aggregates (D-71 … D-76) — all ✅ (present as ranges)

| ID · Metric | St | Note |
|---|:--:|---|
| D-71 Daily macro/micro estimates | ✅ | **derived from meal photo — not asked** |
| D-72 Eating window / TRE | ✅ | first-to-last intake |
| D-73 Late-night eating | ✅ | supper culture relevant |
| D-74 Meal-timing regularity | ✅ | **breaks during Ramadan — see T4** |
| D-75 Caffeine-to-sleep proximity | ✅ | last kopi/teh vs sleep |
| D-76 Alcohol impact on sleep/HRV | ✅ | HRV part needs wearable |

### Environmental exposome (D-77 … D-102)

| ID · Metric | St | Note |
|---|:--:|---|
| D-77 Green-cover exposure | ✅ | NDVI along track |
| D-78 Indoor vs outdoor time | 🟡 | iOS drops lux; still workable |
| D-79 Time in nature / parks | ✅ | |
| D-80 Blue-space exposure | ✅ | |
| D-81 Residential greenness | ✅ | |
| D-82 Personal air-pollution dose | ✅ | 🔆 **GPS × hourly AQI — haze-season gold** |
| D-83 Commute pollution exposure | ✅ | |
| D-84 Pollution–exercise interaction | ✅ | vigorous activity in bad AQI |
| D-85 Traffic-proximity exposure | ✅ | |
| D-86 Personal UV dose | ✅ | high year-round |
| D-87 Sunburn risk | ✅ | |
| D-88 Vitamin-D synthesis potential | ✅ | ample UV; behaviour-limited |
| D-89 Personal noise-exposure dose | ✅ | |
| D-90 Light-at-night exposure | ✅ | VIIRS — unaffected by iOS lux gap |
| D-91 Pollen exposure dose | ✅ | sparse SEA pollen data |
| D-92 Allergen–symptom lag | ✅ | 🔆 **haze/PM2.5 vs respiratory symptoms** |
| D-93 Mold-exposure risk | ✅ | **humidity-driven — SEA relevant** |
| D-94 Wildfire-smoke exposure | ✅ | **= transboundary haze** |
| D-95 Urban heat-island exposure | ✅ | dense SG/KL |
| D-96 Altitude / hypoxia | ✅ | low yield (lowland) |
| D-97 Barometric-pressure swings | ✅ | 🔆 input to weather-sensitivity |
| D-98 Weather-sensitivity correlation | ✅ | 🔆 **pressure/humidity vs headache/joint — classic ignored trend** |
| D-99 Indoor air-quality proxy | ✅ | |
| D-100 Activity-space env quality | ✅ | composite |
| D-101 Greenspace dose–mood link | ✅ | 🔆 |
| D-102 Daily outdoor lux-hours | 🟡 | iOS: outdoor minutes |

### Respiratory & illness detection (D-103 … D-110)

| ID · Metric | St | Note |
|---|:--:|---|
| D-103 Illness-onset signal | 🟠 | RHR↑+temp↑+HRV↓ vs baseline |
| D-104 Fever-trend detection | 🟠 | 🔆 **dengue/illness early flag (wearable temp)** |
| D-105 Sleep-apnea risk | 🟠 | SpO₂ dips + snoring |
| D-106 Snoring index | ✅ | phone/earbud mic |
| D-107 Respiratory-rate anomaly | 🟠 | |
| D-108 Recovery-from-illness | 🟠 | baseline return |
| D-109 Cough-frequency trend | ✅ | 🔆 mic — pairs with haze |
| D-110 Voice-based respiratory change | ✅ | 🔆 from voice notes |

### Mental health, stress & cognition (D-111 … D-120)

| ID · Metric | St | Note |
|---|:--:|---|
| D-111 Stress-recovery balance | 🟠 | HRV-based |
| D-112 Mood–activity correlation | ✅ | mood vs steps |
| D-113 Mood–daylight correlation | ✅ | weaker at equator |
| D-114 Seasonal affective risk | ✅ | **low relevance in SG/MY** |
| D-115 Digital-overload signal | 🟡 | Android only |
| D-116 Cognitive-performance proxy | 🔴 | in-app test only |
| D-117 Behavioural activation | ✅ | location+activity+social |
| D-118 Routine regularity / entropy | ✅ | 🔆 **cheap behavioural-rhythm trend** |
| D-119 Emotional-eating pattern | ✅ | cravings vs stress/mood |
| D-120 Stress–sleep feedback | ✅ | |

### Social & mobility (D-121 … D-127)

| ID · Metric | St | Note |
|---|:--:|---|
| D-121 Life-space / mobility radius | ✅ | 🔆 |
| D-122 Location diversity | ✅ | |
| D-123 Social-isolation index | 🟡 | iOS: BLE+location only |
| D-124 Time-at-home ratio | ✅ | |
| D-125 Crowding / co-exposure | 🟡 | iOS: BLE only |
| D-126 Commute burden | ✅ | |
| D-127 Walkable-routine score | ✅ | |

### Reproductive / cyclical (D-128 … D-132)

| ID · Metric | St | Note |
|---|:--:|---|
| D-128 Cycle-phase estimate | ✅ | logging + temp/HR refine |
| D-129 Ovulation-window prediction | ✅ | BBT/mucus + HR |
| D-130 Luteal-phase symptom map | ✅ | |
| D-131 Cycle effect on sleep/HRV | 🟠 | HRV → wearable |
| D-132 Pregnancy physiological trends | 🟠 | |

### One Health / zoonotic / planetary (D-133 … D-145)

| ID · Metric | St | Note |
|---|:--:|---|
| D-133 Tick-exposure risk | ✅ | low SEA relevance |
| D-134 Mosquito-exposure risk | ✅ | 🔆 **dengue — dusk outdoor + standing water + alerts** |
| D-135 Zoonotic-proximity risk | ✅ | farms/wet-market land use |
| D-136 Local outbreak proximity | ✅ | 🔆 **dengue clusters visited** |
| D-137 Travel-related exposure | ✅ | regional disease data |
| D-138 Pet-contact health correlation | ✅ | 🔆 **One Health core (L-100/101)** |
| D-139 Water-source risk | ✅ | |
| D-140 Vector-season alignment | ✅ | **monsoon → dengue calendar** |
| D-141 Climate-exposure trend | ✅ | long-run heat/AQI/smoke |
| D-142 Transport carbon footprint | ✅ | planetary-health link |
| D-143 Dietary footprint | ✅ | from food log |
| D-144 Active-travel co-benefit | ✅ | |
| D-145 Disaster / flood exposure | ✅ | monsoon flooding |

### Composite roll-ups (D-146 … D-150)

| ID · Metric | St | Note |
|---|:--:|---|
| D-146 Daily holistic wellbeing score | ✅ | blend of sleep/recovery/activity/env/mood |
| D-147 Environmental-burden index | ✅ | air+noise+heat+UV |
| D-148 Lifestyle-regularity index | ✅ | sleep+meal+activity+location |
| D-149 Restorative-environment exposure | ✅ | green+blue+quiet |
| D-150 Personalized symptom-trigger model | ✅ | ML over all logs + exposome — only as good as inputs |

---

# Part D — SG/MY localization deep-dive

## D-i. Diet capture kit (replaces gram-level logging)

The honest, one-tap-each evening chip set, tuned to how people actually eat in SG/MY:

- **Sweet drink?** *kopi/teh* (+ kosong / siew dai / gah dai sweetness), bubble tea, soft drink → feeds the **Sweet-drink index** (better daily sugar signal than macros).
- **Ate out / hawker / mamak?** vs home-cooked (L-43).
- **Fried / *goreng*?** and **coconut / *santan*?** (fat-load flags, L-42).
- **Rice / noodle portions:** 0 / 1 / 2 / 3+.
- **Veg or fruit today?** and **different plants count** (microbiome proxy, D-61).
- **Dairy?** (lactose intolerance is common in the population).
- **Spicy / sambal / chili?** (reflux trigger, D-56).
- Optional **"heaty / cooling"** tag — a TCM frame many local users find natural and quick.
- **Meal photo** for anything beyond the chips → items/portion/macros derived by vision (D-71), no typing. *(If the user runs a calorie app, fetch `Nutrition` from the health store instead — §B8.)*

## D-ii. Hydration without asking volume

Don't ask millilitres (soup-, kopi-, and teh-heavy diets make it meaningless). Derive **D-64 hydration** from: first-morning **urine colour** (L-15) + **drink-event taps** + passive **heat-index exposure** (E-61 → D-67). One swatch + a few drink taps beat a fictional "8 glasses" log.

## D-iii. Climate & exposome priorities

- **Lead with heat + humidity + haze**, not seasons. Heat-stress (D-67), dehydration risk (D-68), and haze-season PM2.5 (E-72 → D-82/D-92) are the high-yield environmental variables.
- **De-emphasize seasonal-daylight logic** (D-15, D-114, SAD): ~12h daylight year-round makes these near-flat. Keep circadian *timing* (D-6/7) but expect little seasonal signal.
- **Haze season (≈Jun–Oct):** spin up respiratory symptom prompts (L-66–L-69), mask-use events, and weight D-82/D-92 — this is a natural quasi-experiment for "ignored indicator" discovery.

## D-iv. Dengue / vector stack (One Health)

Insect-bite events (L-104) + fever episodes (L-70 → D-104) + standing-water proximity (E-92) + **local outbreak/cluster feeds** (E-84, e.g. NEA dengue clusters) + monsoon timing (E-62 → D-140) → **D-134 mosquito-exposure risk** and **D-136 outbreak proximity**. Daytime-biter behaviour means dusk/outdoor windows matter.

## D-v. Fasting & feasting as period states (T4)

A **fasting-period toggle is SEA-critical.** During Ramadan (~30 days, dawn-to-dusk, no food *or* water) the model would otherwise misread fasting as anomalous meal-skipping, dehydration, and sleep disruption. Capture it as a state band so D-72/73/74 (eating window/timing) and D-64/68 (hydration) are interpreted correctly; expect a *post-fast feast* (Hari Raya). Generalize the toggle to CNY/Deepavali feasting, Lent, and Vesak/Thaipusam vegetarian periods.

## D-vi. Language & UX

Multi-script population (EN / Malay / Mandarin / Tamil + dialects, plus *Singlish*/*Manglish*). Favour **icons, photos, emoji scales, and voice notes** (NLP-parsed) over free text so logging cost and meaning don't depend on literacy in any one language.

---

# Part E — "Ignored-indicator" discovery shortlist (your core goal)

The cheapest path to *new* trends is correlating the **free passive layer** against a **thin, honest self-report spine**. These are low-cost, continuous, and rarely tracked elsewhere — the best early bets for surfacing overlooked correlations:

| Candidate signal | Source | Cost | Test against |
|---|---|:--:|---|
| First-morning urine colour | L-15 | 🟢 log | hydration, heat exposure, sleep, next-day energy |
| Gut transit time (Bristol event timing) | D-52 | passive | diet pattern, stress, sleep |
| Barometric + humidity swings | D-97/98 | passive | headache (L-53), joint stiffness (L-56) |
| Personal heat-index dose | D-67 | passive | mood, sleep quality, energy (tropical-specific) |
| Routine regularity / behavioural entropy | D-43/D-118 | passive | mood, illness onset, wellbeing |
| Charging & phone-stationary rhythm | E-21/E-22 | passive | sleep timing, low-mood days |
| Voice biomarkers | E-30/D-110 | passive | respiratory change, affect, fatigue |
| **Sweet-drink index** (new) | L-35 taps | 🟢 log | energy crashes, mood, sleep, (later) glucose |
| Haze PM2.5 micro-dose | E-72/D-82 | passive | cough (D-109), congestion, mood, sleep |
| Location/BLE diversity | D-122/D-125 | passive | mood, social isolation, infection spread |
| Moon phase | E-70 | passive | sleep (cheap myth-test, either way it's a finding) |

All but two are zero-budget. That's the point: **breadth in the free layer + a sticky 9-touch spine** is what makes novel-trend mining sustainable.

---

# Part F — Logging reliability & accuracy

The tiers tell you what's **cheap to collect**; reliability tells you **how much to trust it.** These are independent axes — a signal can be cheap *and* unreliable (a subjective slider) or costly *and* reliable. Treat reliability as a **confidence weight** in any model (D-150), prefer the most reliable available source for each construct, and **triangulate** noisy self-report against a passive correlate.

## F1. Reliability ladder (most → least trustworthy)

1. **Device-measured passive — highest.** Steps, GPS, HR/HRV, wearable sleep, scale weight, CGM glucose. Objective, continuous, no recall. *Error modes:* device-specific — wrist PPG drifts during motion/cold, phone-only sleep is coarse, GPS drifts indoors, step counts wander. Still the gold standard for trends *and* absolutes.
2. **External-API exposome — high (ambient) / moderate (personal).** Weather, AQI, pollen, daylight. Accurate at the station/grid level; the gap is **exposure misclassification** — the nearest-station value ≠ what the person actually breathed or felt (indoor time, aircon, high-rise height, street canyon). Trust the *ambient* number; discount the *personal-dose* derivation.
3. **Semi-passive — inherits the source (high → low).** Activity from Strava/a watch is high; **calories from a food tracker stay low** (see #6). Fetching it for free removes *our* burden but does **not** fix the source's accuracy. Reliability = source-app accuracy × the user's diligence in that app.
4. **In-the-moment manual events — moderate–high (for what's captured).** Bristol tap, meal photo, insect bite, med tap. Little recall error because logged in the moment. *Dominant error:* **missingness** — forgotten logs undercount, and memorable events get over-logged (selection bias). Derive rates with explicit handling of gaps.
5. **Subjective ratings — low–moderate (trend-only).** Mood, stress, energy, pain, sleep quality, bloating. *Error modes:* genuine moment-to-moment fluctuation, scale-use & anchoring differences between people, framing/order effects, recall bias if asked retrospectively. **Valid as a within-person relative time-series — not as absolute values, and not comparable across people.** (Caveat: some of the "noise" is real signal — mood truly varies; the limit is measurement reliability, not that the construct is meaningless.)
6. **Manual counts & quantities — lowest.** Calorie/food intake, water volume in ml, urination frequency. *Error modes:* portion misjudgement, forgotten items, food-database errors, and **systematic under-reporting** — self-reported energy intake validates well *below* doubly-labelled-water truth (commonly ~20–40% under, larger at higher body weight), plus social-desirability bias. This is exactly why §B6 replaces them with proxies and §B8 prefers fetching them.

## F2. Quick reference

| Data type | Reliability | Dominant error | How to treat it |
|---|:--:|---|---|
| Sensor (steps/HR/sleep/weight/CGM) | ★★★★ | device noise | trends + absolutes OK; note the device |
| Exposome API (weather/AQI) | ★★★★ ambient · ★★ personal | exposure misclassification | trust ambient; weight personal dose |
| Semi-passive activity (Strava/watch) | ★★★★ | source gaps | treat as passive |
| Semi-passive food (calorie app) | ★★ | under-reporting | trends only; never read kcal as truth |
| In-moment events (poo/photo/bite) | ★★★ | missingness | model gaps; don't read 0 as "none" |
| Subjective ratings (mood/pain/sleep-q) | ★★ | fluctuation, scale-use | within-person trends, not absolutes |
| Manual counts (kcal/ml/frequency) | ★ | systematic under-report | replace (§B6) or fetch (§B8) |

## F3. Implications for the model

- **Confidence-weight every input** in D-150 — don't let a ★ self-reported calorie figure override a ★★★★ glucose or weight trend.
- **Absolutes vs trends:** surface low-reliability metrics only as personal trends/deltas against the user's own baseline; never as cross-user benchmarks.
- **Triangulate to validate:** agreement between a self-report and its passive correlate (reported sleep quality vs wearable sleep; reported activity vs steps; "ate heavy" vs a glucose spike) raises confidence; divergence flags bad data to down-weight or re-prompt.
- **Subjective is still essential:** mood, pain, and most symptoms have no sensor — they're valid as the person's own series; just don't over-interpret small absolute differences.
- **Missingness can be signal:** a skipped morning check may itself track low mood — but model absence explicitly rather than treating it as zero.

---

# Part G — Summary counts

### Manual layer (`L-1 … L-110`) — re-tiered by logging budget

| Tier | What | Count |
|---|---|:--:|
| **T1 Daily Core** | sticky spine, surfaced as ~9 daily touches | 10 |
| **T2 Daily Optional / Rotating** | opt-in or sampled across days | 18 |
| **T3 Event-Triggered** | logged at the moment; freq/timing derived | 54 |
| **T4 Periods / States** | toggled spans (+ derived *fasting* & *illness* states) | 4 |
| **T5 Profile / Static** | set once | 8 |
| **No longer a daily prompt** | merged · derived-from-events · replaced · optional-only · dropped | 16 |
| **Total** | | **110** |

> Headline: the askable daily surface drops from *up to 110 prompts* to **~9 anchored touches**, with everything else demoted to events, periods, profile, or passive derivation — and the lost detail (frequency, timing, macros, hydration) recovered by **deriving it** instead of asking.

### Passive layer (unchanged — collect all)

| Category | Total | ✅ both | 🟡 platform | 🟠 hardware/coverage | 🔴 none |
|---|:--:|:--:|:--:|:--:|:--:|
| `E` Auto-fetchable | 100 | 61 | 6 | 30 | 3 |
| `D` Derived | 150 | 108 | 10 | 31 | 1 |

**Catalog total: 360 metrics.** Manual budget is spent on ~9; the other ~350 cost nothing per day.

---

# Part H — Implementation notes

- **Anchor, don't interrupt.** Tie the two daily checks to waking and wind-down; use a home-screen/lock-screen quick-action for event taps so logging happens *in the moment*.
- **Derive aggressively.** Frequency, timing, transit, macros, hydration, energy-balance — compute these; never ask them.
- **Rotate to preserve budget.** Sample T2 items a few times a week; EMA validity comes from repetition over time, not daily completeness.
- **Lag windows are configurable.** Food↔symptom (D-55), allergen↔symptom (D-92), weather↔pain (D-98), stress↔sleep (D-120) — biology isn't instantaneous.
- **Baselines beat absolutes.** Illness onset, fever, autonomic shifts work off personal-baseline deviation (D-103/104/16), not population thresholds.
- **Privacy by design (deferred past the demo).** The demo stores all data in Supabase; on-device raw-signal handling (mic, continuous location, BT/Wi-Fi, keystrokes → store only the derived metric) is re-instated when scaling.
- **Graceful degradation.** Tag each metric by minimum hardware (phone-only → watch → ring → CGM → scale); the passive layer should light up as users connect devices, never block the core.
- **Don't surface clinical numbers as targets.** Weight, calories, glucose → trends and ranges, not goals (you'll calibrate health relevance in later research).
- **States as covariates.** Feed T4 period bands (fasting, antibiotics, illness, travel, pregnancy) into D-150 as conditioning variables so the trend engine reads anomalies correctly.

---

*v2 — reorganized around a tiered logging budget, localized for Singapore & Malaysia. Pairs with the v1 collectibility audit (same IDs) for platform/permission detail.*
