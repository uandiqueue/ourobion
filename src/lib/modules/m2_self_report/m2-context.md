# m2-context.md — M2: Self-Report — Gut & Behaviour
> Updated at end of every AI session.
> Owner: [ASSIGN]
> Phase 1 Stage 1 — MVP

---

## Purpose

Captures all active user self-logging in under ~30 seconds per day. Owns the logging
UI, input validation, normalisation, and persistence of all self-reported health signals.
Produces `DailyGutRow` — the primary data asset for the entire insight pipeline.

Does NOT own: insight generation, baseline computation, engagement rewards, or any
display of patterns. M2's job ends at writing a clean, normalised row to the database.

---

## Public Interface (what other modules may use)

```dart
// Reading (for M5a, M6)
Future<DailyGutRow?> getRow(String userId, String date)
Future<List<DailyGutRow>> getRows(String userId, {int days = 30})
Future<double> getCompletenessScore(String userId, String date)  // 0–100 DQS

// Writing (internal — M2 only calls these)
// Other modules never write to daily_gut_rows
```

M5a reads the `daily_gut_rows` table directly via DB query for batch baseline computation.
The function interface above is for synchronous single-row lookups only.

---

## Database Tables Owned

- `daily_gut_rows` — one row per user per day (upsert on same date)
- `antibiotic_courses` — separate table: course start/end, drug name, reminders

---

## Metrics Implemented (Phase 1 Stage 1)

### Core Logging Flow (~30 seconds)

| Metric | Input Type | Scale / Range | Field in DailyGutRow |
|---|---|---|---|
| Urine colour | One-tap horizontal colour palette | Armstrong 1–8 | `urine_colour` |
| Stool form | Icon-based picker | Bristol Stool Scale 1–7 | `stool_form` |
| Stool count | Number stepper | 0–10 | `stool_count` |
| Outside meals | 3-tap selector | 0–3 | `outside_meals` |
| Mosquito bites | Number stepper | 0–20+ | `mosquito_bites` |
| Energy | Likert slider | 1–5 | `energy_score` |
| Mood | Likert slider | 1–5 | `mood_score` |
| Gut comfort | Likert slider | 1–5 | `gut_comfort_score` |
| Symptom flags | Multi-select (present-only) | See SYMPTOM_FLAGS | `symptom_flags` |
| Notes | Free text | max 140 chars | `notes` |

### Weekly Audit (separate prompt, not daily)

| Metric | Input Type | Field |
|---|---|---|
| Standing water present | Boolean toggle | `standing_water_present` |

### Antibiotic Tracker (event-based, not daily)

Separate flow. User sets up a course (drug name, start date, duration).
App derives `on_antibiotics` and `gut_watch_active` on `daily_gut_rows` from course dates.

---

## Derived Fields

These are computed by M2 at write time, not stored raw:

- `stool_variability` — if user logs multiple stool events in a day, this is `max_bristol - min_bristol`. If single log, this is 0.
- `gut_watch_active` — true if today falls within 14 days after any completed antibiotic course.
- `log_completeness` (DQS) — weighted score. Core fields (urine, stool, outside meals) = 70% weight. Check-in fields = 20%. Optional fields = 10%.

---

## DQS Weighting (Data Quality Score)

```
urine_colour logged:          25 pts
stool_form logged:            25 pts
outside_meals logged:         20 pts
energy + mood + gut_comfort:  20 pts (combined, ~6.7 pts each)
mosquito_bites logged:        10 pts
                             ─────
Maximum:                     100 pts
```

Streak counts as a streak day if DQS ≥ 60. (Configurable — see M6.)

---

## Internal File Structure

```
/modules/m2-self-report
  m2-context.md
  index.dart              ← exports getRow(), getRows(), getCompletenessScore()

  /impl
    /gut
      urine_logging.dart         ← Armstrong palette UI + validation
      stool_logging.dart         ← Bristol picker UI + stool_count stepper
    /behaviour
      food_logging.dart          ← 0–3 outside meals selector
      mosquito_logging.dart      ← bite counter + standing water weekly prompt
      antibiotics_logging.dart   ← course setup, dose reminders, gut watch logic
    /checkin
      daily_checkin.dart         ← energy/mood/gut_comfort Likert + symptom flags + notes
    logging_controller.dart      ← orchestrates all sub-loggers, assembles DailyGutRow
    normaliser.dart              ← raw inputs → validated DailyGutRow, DQS computation
    antibiotic_service.dart      ← manages antibiotic_courses table + derives daily flags

  /tests
    logging_controller_test.dart
    normaliser_test.dart
    dqs_calculation_test.dart
```

---

## Current State

| Feature | Status |
|---|---|
| Urine colour logging (Armstrong palette) | ✅ Done |
| Stool form logging (Bristol picker) | ✅ Done |
| Stool count stepper | ✅ Done in `DailyLogScreen` |
| Outside meals 0–3 selector | ✅ Done in `DailyLogScreen` |
| Mosquito bite counter | ✅ Done in `DailyLogScreen` |
| Standing water weekly audit | ❌ Not started |
| Daily check-in (energy/mood/comfort) | ✅ Done in `DailyLogScreen` |
| Symptom flag multi-select | ❌ Not started |
| Notes free text (140 char) | ✅ Done in `DailyLogScreen` |
| Antibiotic course tracker | ❌ Not started |
| DQS computation | 🔨 Inline UI computation done; normaliser/service pending |
| Save/upsert to `daily_gut_rows` | ✅ Done in `DailyLogScreen` |
| `daily_gut_rows` DB table + RLS | ✅ Done |
| `antibiotic_courses` DB table + RLS | ✅ Done |

---

## Key Decisions Made

- **Upsert on date** — only one `DailyGutRow` per user per day. Re-opening the logging
  screen overwrites today's entry. No multi-entry stool log in MVP (stool_count covers quantity;
  Phase 2 can add timestamped stool events if needed).
- **Symptom flags are presence-only** — the absence of a flag does not mean the symptom
  is absent. M5b must never infer "no fever" from an empty array.
- **30-second constraint is hard** — if a UX review finds the logging flow exceeds 30 seconds
  for median users, remove fields in this priority: notes → symptom flags → standing water.
  Core fields (urine, stool, outside meals) are never removable.
- **No AI image analysis for stool** — icon-based Bristol picker only. Avoids medical device
  classification risk and reduces friction.

---

## In Progress / Next Tasks

1. Extract inline `DailyLogScreen` save/DQS logic into `normaliser.dart` and
   `logging_controller.dart` so it is unit-testable.
2. Build symptom flags multi-select screen and write `symptom_flags`.
3. Build standing water weekly audit prompt logic.
4. Build antibiotic course setup flow + gut watch derivation.
5. Implement `antibiotic_service.dart` for `antibiotic_courses`.
6. Replace temporary HomeScreen `[DEV]` entry points once app shell tabs exist.
7. Add focused tests for DQS, normalisation, and upsert payloads.

---

## Watch Out / Known Issues

- Bristol Stool Scale icons need careful design — must be clinical enough to be useful,
  abstract enough to not be off-putting in a consumer app.
- Standing water audit is weekly, not daily — the prompt logic must not ask daily.
  Suggested: show on Monday, or if it's been >7 days since last response.
- Antibiotic dose reminders require local notifications — confirm Flutter local_notifications
  package is set up in M1 app scaffold before building this.
- Current M2 persistence lives directly in `DailyLogScreen`; extract before expanding
  the flow further to avoid UI-owned data logic.

---

## Expansion Hints (Do Not Build)

- Stage 2: optional stool event tags ('loose', 'constipated', 'painful') and meal venue
  tags ('hawker', 'restaurant') added as optional fields on existing tables.
- Stage 3: optional `time_in_green_min` field added to daily log flow.
- Phase 2: timestamped stool events (vs single daily entry) may be introduced if
  variability patterns prove meaningful. Design DB to allow this without breaking DailyGutRow.
