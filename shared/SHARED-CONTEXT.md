# shared/SHARED-CONTEXT.md — Biotope Shared Contract
> **CONSTANT LAYER** — All changes require PR with 2 team reviewers.
> Breaking changes to any type below require notifying all module owners.
> Last updated: Phase 2 (metrics registry; M3 wearable contract corrected)

---

## Why This File Exists

These are the connective tissue of Biotope. Every module boundary crosses
through one of these types. If you change a type here without coordinating,
you break other people's AI sessions and potentially production.

**Rule:** If you need to add a field — add it as optional with a default.
Never remove or rename a field without a migration plan.

---

## DailyGutRow
> Produced by: M2 Self-Report
> Consumed by: M5a Baselines, M6 Engagement (completeness), M7 (Phase 3 aggregation)

```typescript
interface DailyGutRow {
  id: string                        // uuid
  user_id: string                   // uuid, FK profiles
  date: string                      // ISO date YYYY-MM-DD
  region: string                    // country name e.g. 'Singapore' — required even in MVP (M7 future join)

  // Hydration
  urine_colour: number | null       // Armstrong scale 1–8

  // Gut
  stool_count: number | null        // bowel movements that day
  stool_form: number | null         // Bristol Stool Scale 1–7 (last/worst of day)
  stool_variability: number | null  // derived: max - min Bristol score if multiple logs

  // Food risk
  outside_meals: number | null      // 0–3 tap selector

  // Vector exposure
  mosquito_bites: number | null     // integer count
  standing_water_present: boolean | null  // weekly audit flag

  // Antibiotics (see antibiotic_courses table for full course detail)
  on_antibiotics: boolean | null
  gut_watch_active: boolean | null  // true if within 14-day post-course window

  // Daily check-in (3-item Likert)
  energy_score: number | null       // 1–5
  mood_score: number | null         // 1–5
  gut_comfort_score: number | null  // 1–5

  // Symptom flags (present-only, not absence-of)
  symptom_flags: string[]           // e.g. ['feverish', 'nausea', 'body_aches'] — empty array default

  // Qualitative context
  notes: string | null              // max 140 chars

  // Metadata
  log_completeness: number          // 0–100 DQS score for this day
  created_at: string                // ISO datetime
  updated_at: string                // ISO datetime
}
```

---

## DailyPhysioRow
> Produced by: M3 Passive Health (Wearables) — table `wearable_daily` shipped
> Consumed by: M5a Baselines
> Field keys derive from shared/metrics/registry.ts (the metrics registry is the single source of truth).

```typescript
interface DailyPhysioRow {
  user_id: string
  date: string                       // ISO date YYYY-MM-DD

  // Wearable metrics (all nullable — wearables are optional confidence multipliers).
  // Keys are the single source of truth in shared/metrics/registry.ts (source: 'wearable').
  resting_hr_bpm: number | null      // bpm
  hrv_sdnn_ms: number | null         // ms — SDNN, iOS/HealthKit only; null on Android (see docs/memory/0004)
  sleep_duration_min: number | null  // total sleep minutes
  spo2_pct: number | null            // blood oxygen %
  body_temp_c: number | null         // °C
  step_count: number | null          // steps that day

  // Provenance
  source: string | null              // 'healthkit' | 'health_connect'
  synced_at: string                  // ISO datetime of last upsert
}
```

---

## DailyEnvRow
> Produced by: M4 Environmental & Outbreak [DEFERRED — Phase 1 Stage 3]
> Consumed by: M5a Baselines
> Shape locked now so M5a is not rewritten at Stage 3.

```typescript
interface DailyEnvRow {
  id: string
  user_id: string
  date: string
  region: string                     // state/district code

  // Weather
  temp_max_c: number | null
  temp_min_c: number | null
  heat_index_c: number | null
  rainfall_mm: number | null
  uv_index: number | null

  // Green cover (weekly cadence — carried forward daily)
  ndvi_score: number | null          // 0–1 normalised vegetation index
  green_cover_bucket: 'low' | 'medium' | 'high' | null

  // Outbreak context (weekly per state)
  dengue_case_rate: number | null    // cases per 100k, state level
  outbreak_alert_active: boolean     // from official MY open data or WHO

  // Optional manual input
  time_in_green_min: number | null   // user-logged, Phase 1 Stage 3+

  created_at: string
}
```

---

## BaselineSnapshot
> Produced by: M5a Baselines & Data Pipeline
> Consumed by: M5b Insight Engine

```typescript
interface BaselineSnapshot {
  id: string
  user_id: string
  metric_key: string                 // e.g. 'urine_colour', 'stool_form', 'resting_hr_bpm'
  computed_at: string                // ISO datetime of last computation
  days_of_data: number               // how many days fed into this baseline

  // Rolling statistics (7-day default window)
  mean: number | null
  std_dev: number | null
  min: number | null
  max: number | null
  trend: 'stable' | 'rising' | 'falling' | null

  // Confidence
  confidence: 'insufficient' | 'low' | 'medium' | 'high'
  // insufficient = <3 days, low = 3–6 days, medium = 7–13 days, high = 14+ days

  // Expansion hint: data_sources will include 'wearable' and 'env' in later phases
  data_sources: ('self_report' | 'wearable' | 'env')[]
}
```

---

## InsightCard
> Produced by: M5b Insight Engine
> Consumed by: Frontend (Insights tab), M6 via InsightFiredEvent

```typescript
interface InsightCard {
  id: string
  user_id: string
  generated_at: string              // ISO datetime

  // Content
  title: string                     // short, non-diagnostic
  body: string                      // 1–2 sentences, observational language only
  category: 'hydration' | 'gut' | 'vector' | 'behaviour' | 'descriptive'
  severity: 'info' | 'notice' | 'watch'
  // MVP only uses 'info' and 'descriptive' cards — 'notice'/'watch' are Phase 2

  // Evidence (always populated, even if empty array in MVP)
  contributing_metrics: string[]    // e.g. ['urine_colour', 'gut_comfort_score']
  // Expansion hint: Phase 2 "Why am I seeing this?" uses this array

  // Confidence
  confidence_score: number          // 0–1
  confidence_sources: ('self_report' | 'wearable' | 'env')[]
  // MVP: confidence_sources = ['self_report'] always

  // Lifecycle
  status: 'active' | 'snoozed' | 'dismissed'
  expires_at: string | null         // null = persistent card

  // Metadata
  rule_id: string                   // which rule generated this — for debugging
  phase_generated: string           // e.g. 'p1s1' — for filtering/analytics
}
```

---

## InsightFiredEvent
> Fired by: M5b Insight Engine (via Supabase Realtime or Edge Function)
> Consumed by: M6 Engagement & Motivation ONLY
> M6 never reads insight_cards table directly.

```typescript
interface InsightFiredEvent {
  event_type: 'insight_fired'
  user_id: string
  insight_id: string               // FK insight_cards
  category: InsightCard['category']
  severity: InsightCard['severity']
  fired_at: string                 // ISO datetime
}
```

---

## EngagementState
> Produced by: M6 Engagement & Motivation
> Consumed by: Frontend (home screen, profile)

```typescript
interface EngagementState {
  user_id: string
  updated_at: string

  // Data Quality Score
  dqs_today: number                // 0–100
  dqs_7day_avg: number             // rolling average

  // Streaks
  current_streak_days: number
  longest_streak_days: number
  streak_threshold_dqs: number     // DQS needed to count as a streak day (default: 60)

  // Titles / Badges
  active_title: string             // e.g. 'Explorer', 'Health Mapper'
  unlocked_titles: string[]

  // Expansion hint: Phase 3 adds missions[], challenges[], insight_actions_taken: number
}
```

---

## Symptom Flags — Allowed Values

```typescript
const SYMPTOM_FLAGS = [
  'feverish',
  'nausea',
  'body_aches',
  'fatigue',
  'loss_of_appetite',
  'abdominal_cramps',
  'headache',
] as const

type SymptomFlag = typeof SYMPTOM_FLAGS[number]
```

---

## Non-Diagnostic Copy Rules

Defined in `shared/constants/copy_guidelines.ts`. Key constraints:
- Never use: "diagnosed", "condition", "disease", "illness", "treatment", "symptom" (as label)
- Always use: "pattern", "signal", "observation", "your data shows", "you may notice"
- Severity labels: "info" (blue), "notice" (amber), "watch" (soft red) — never "alert" or "warning"

All user-facing strings in M5b and M6 must pass this constraint.
M1 exposes `validateCopyString(text: string): boolean` for enforcement.
