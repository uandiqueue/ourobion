# workspace-context.md — Team Session Tracker
> **VARIABLE LAYER** — Update this document at the start and end of every work session.
> Purpose: To keep the 2-person team aligned on who did what, and what needs to happen next.

---

## 📋 Session & Commit Conventions

### Session Rules
- **Read this file first** at the start of every session before doing any work.
- **Update this file last** before ending every session — log what you did and what's next.
- **One commit per session** — batch all session work into a single commit at the end. Do not commit mid-session.

### Commit Message Format (Conventional Commits)
```
type(scope): short summary in imperative mood

- bullet of what changed and why (optional body)

Co-Authored-By: ...
```

**Types:**
| Type | When to use |
|---|---|
| `feat` | New feature or behaviour |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `refactor` | Code restructure, no feature/fix |
| `test` | Tests only |
| `chore` | Dependency updates, config, tooling |

**Scope** = the module or area (e.g. `m1`, `m2`, `db`, `ui`, `docs`).

---

## 📅 Phase Timeline Status

| Phase | Milestone | Status | Target Date |
|---|---|---|---|
| **Phase 1 Stage 1 MVP** | **Repository Scaffolding** | ✅ Complete | - |
| Phase 1 Stage 1 MVP | M1 Authentication & DB Models | 🔨 In Progress (copy polish remaining; app shell + tab nav ✅) | TBD |
| Phase 1 Stage 1 MVP | M2 Self-Report Logging UI | ✅ Complete (all logging UI done, home tab wired, titles, reload fix) | - |
| Phase 1 Stage 1 MVP | M5a Baseline Computation Engine | ✅ Complete | - |
| Phase 1 Stage 1 MVP | M5b Insight Generation | ✅ Complete | - |
| Phase 1 Stage 1 MVP | M6 Engagement Systems | ✅ Complete (streak, DQS, 4 titles, insights teaser; `dqs_7day_avg` + `longest_streak` display deferred) | - |
| Phase 1 Stage 2 | Passive Health (Wearables) | 🔨 In Progress (M3 Flutter integration done: `WearableService`, `wearable_daily` migration applied, platform config set; iOS HealthKit entitlement pending Xcode; end-to-end test pending real wearable) | TBD |
| Phase 1 Stage 3 | Environmental Modifiers | 🗓️ Planned | TBD |

---

## 👥 Team Workstreams

> Instructions for team members: 
> 1. Claim your module ownership here.
> 2. When starting a session, check if anyone left notes for you in "Blocked by / Needs".
> 3. Before ending your session, log what you accomplished in the last session and what your next steps are.

### Member 1: [Jayden]
**Focus Area:** M1 (Core & Compliance) + Database Rules + M2 assist
*   **Last Session Accomplished (2026-05-14):**
    *   Extracted M2 persistence from `DailyLogScreen` into `DailyLogService` (`logging_controller.dart`) — pulls region from profiles, derives `on_antibiotics` / `gut_watch_active` from antibiotic_courses at write time, passes `symptom_flags`. ✅
    *   Built `symptom_flags_screen.dart` — 7-flag presence-only multi-select chip screen (feverish, nausea, body_aches, fatigue, loss_of_appetite, abdominal_cramps, headache); wired into DailyLogScreen BEHAVIOUR section. ✅
    *   Built `antibiotic_service.dart` (`AntibioticCourse` model + `AntibioticService.addCourse` / `getCourses`). ✅
    *   Built `antibiotic_course_screen.dart` — drug name, start date picker, duration stepper (1–30 days), computes end_date, 14-day gut watch note; wired into DailyLogScreen MEDICATIONS section. ✅
    *   `flutter analyze` passes with no issues. ✅
*   **Next Session Goals:**
    *   M1: Finalize copy/legal polish — review PDPA consent wording and complete `shared/constants/copy_guidelines.dart` enforcement path.
    *   M1: Defer Google/Apple OAuth until Supabase dashboard redirect URLs and platform deep-link config are ready.
    *   M2 (optional): Load today's existing row on `DailyLogScreen` open so returning mid-day pre-populates fields.
*   **Notes / Blocked by / Needs:**
    *   Nothing blocking.

### Member 2: [Alton]
**Focus Area:** M2 (Self-Report Logging) + Flutter UI + M3 Wearables
*   **Last Session Accomplished (2026-05-28):**
    *   Fixed `updateOnLogWrite` — removed `unawaited()`, now properly `await`ed in `_save()`; dropped unused `dart:async` import. Silent engagement update failures will now surface to the user. ✅
    *   M3 Flutter integration — `WearableService` + `WearableReading` model (`m3_passive_health/impl/wearable_service.dart`); HealthKit (6 signals) + Health Connect (5 signals, no HRV SDNN) per platform. ✅
    *   `wearable_daily` DB migration written + applied locally (`20260528100000_create_m3_wearable_daily.sql`); RLS policies set. ✅
    *   Platform config: `NSHealthShareUsageDescription` / `NSHealthUpdateUsageDescription` added to `Info.plist`; 6 Health Connect read permissions + rationale activity + `activity-alias` added to `AndroidManifest.xml`. ✅
    *   Wired `WearableService.syncToday` into `DailyLogScreen._loadTodayData` — fire-and-forget via `.ignore()`; does not block screen load. ✅
    *   M5a extended — `compute-baselines` edge function now fetches `wearable_daily` in parallel with gut rows; `buildSnapshots` + `groupByUser` helpers extracted; 6 wearable metrics compute mean/std_dev/trend/confidence with `data_sources: ['wearable']`. Tested locally — runs clean. ✅
    *   `flutter analyze` clean. ✅
*   **Next Session Goals:**
    *   iOS: Add HealthKit capability in Xcode (Runner → Signing & Capabilities → + HealthKit) — required before iOS wearable sync can run.
    *   End-to-end wearable test on real device once wearable is paired and Health Connect / HealthKit has data.
*   **Notes / Blocked by / Needs:**
    *   iOS HealthKit entitlement must be added manually in Xcode — Info.plist strings are in place but the capability is not active until the entitlement is toggled.
    *   HRV SDNN is iOS-only; Android Health Connect exposes RMSSD only, so `hrv_sdnn_ms` will stay null on Android.
    *   Wearable sync is best-effort (`.ignore()`) — permission denial or missing Health Connect silently no-ops; `wearable_daily` row is only written if at least one signal is available.
    *   Note for Jayden: WiFi IP changes on network reconnect — remind team to check `src/.env.public` if Supabase connection fails.
    *   pg_cron migrations require `app.supabase_url` and `app.service_role_key` set in Supabase dashboard (Settings → Database → Configuration) before applying to production.
    *   M2 UI follows Biotope design system — see `docs/ui-context/UI-DESIGN-CONTEXT.md`.

---

## 📝 Recent Change Log (Last 5 merged PRs/Sessions)
1. **2026-05-28** - M5a extended: `compute-baselines` now fetches `wearable_daily` in parallel; `buildSnapshots` + `groupByUser` helpers; 6 wearable metrics → `baseline_snapshots` with `data_sources: ['wearable']`. Tested locally. — *Alton*
2. **2026-05-28** - M3 Flutter integration: `WearableService` (HealthKit + Health Connect, 6 signals), `wearable_daily` migration + RLS applied, platform config (Info.plist + AndroidManifest), wired into `DailyLogScreen`. Fixed `updateOnLogWrite` (unawaited → await). `flutter analyze` clean. — *Alton*
2. **2026-05-27** - M3 Stage 2 planning: HealthKit + Health Connect; 6 signals (resting HR, HRV, sleep, SpO2, body temp, steps); pull-on-log-open; `wearable_daily` schema agreed; Alton owns Flutter integration, Jayden owns PDPA consent update. — *Alton*
3. **2026-05-27** - M1 PDPA consent copy polish: title, purpose + observational framing, "daily signals", user rights note. M6 device test passed. `flutter analyze` clean. — *Alton*
4. **2026-05-27** - M6 home tab: surface `longest_streak_days` + `dqs_7day_avg` as stat chips in streak card (`_StatChip` widget, stat row hidden when no data). `flutter analyze` clean. — *Alton*
2. **2026-05-15** - M6 engagement: `engagement_state` migration + RLS, `EngagementService` (streak, titles, DQS avg, total logs), `updateOnLogWrite` wired on save, home tab streak/titles/insights teaser UI. `flutter analyze` clean. — *Alton*
3. **2026-05-15** - M5a + M5b: baseline computation pipeline + insight engine. `baseline_snapshots` + `insight_cards` tables, `compute-baselines` + `generate-insights` edge functions, pg_cron schedules, `BaselineService` + `InsightService` + `InsightsTab` UI. Backend tested end-to-end locally. `flutter analyze` clean. — *Alton*
4. **2026-05-14** - M6 titles + home tab reload + today card UX: Pioneer/Committed badges, `HomeTabState.reload()` via GlobalKey on tab switch, partially-logged card tappable. Tested on Android. `flutter analyze` clean. — *Alton*
5. **2026-05-14** - M2 pre-populate + active antibiotic display: `getTodayLog` (logging_controller), `getActiveCourse` (antibiotic_service), `DailyLogScreen` initState pre-fill + spinner + `_ActiveCourseCard`. Fixed `src/.env.public` Supabase IP. `flutter analyze` clean. — *Alton*
3. **2026-05-13** - App shell (`app_shell.dart`) + Home dashboard (`home_tab.dart`): 5-tab NavigationBar, today's log card, streak card, insights teaser, sign-out dialog. `DailyLogScreen` wired into Log tab. `flutter analyze` clean. — *Alton*
2. **2026-05-13** - Frontend env cleanup: `src/.env.public` for bundled client config, removed `src/.env`, kept backend secrets in `supabase/.env`; hardened Supabase trigger `search_path`; docs refreshed. — *Jayden*
3. **2026-05-13** - Stool Form UI (Bristol 1–7 picker, custom shape icons). Daily Log shell (all M2 inputs, live DQS, Supabase upsert). Tested on Samsung A165F. — *Alton*
4. **2026-05-13** - M2 SQL migration (daily_gut_rows + antibiotic_courses, RLS). Urine Color UI (Armstrong 1–8 palette). Tested on Samsung A165F. — *Alton*
5. **2026-05-10** - Fixed sign-out (AuthGate navigation bug). Full country picker (195 countries, search). Singapore corrections across codebase. Session/commit conventions added. — *Jayden*
