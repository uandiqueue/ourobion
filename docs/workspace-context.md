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
| Phase 1 Stage 1 MVP | M5a Baseline Computation Engine | ⏳ Pending | TBD |
| Phase 1 Stage 1 MVP | M5b Insight Generation | ⏳ Pending | TBD |
| Phase 1 Stage 1 MVP | M6 Engagement Systems | ⏳ Pending | TBD |
| Phase 1 Stage 2 | Passive Health (Wearables) | 🗓️ Planned | TBD |
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
**Focus Area:** M2 (Self-Report Logging) + Flutter UI
*   **Last Session Accomplished (2026-05-14):**
    *   Home tab reload fix — `HomeTabState` made public, `reload()` method added; `AppShell` calls `reload()` via `GlobalKey` whenever user navigates back to Home tab, so DQS + streak always reflect latest saved log. ✅
    *   Today card UX fix — partially logged card (< 60 pts) is now tappable with "Complete →" affordance; only streak-worthy (≥ 60 pts) is non-tappable. ✅
    *   M6 early titles — Pioneer (first log) and Committed (7-day streak) badges on home screen; titles section hidden until first log; earned = coloured, locked = greyed. ✅
    *   Tested on Android phone — all features working. ✅
    *   `flutter analyze` passes with no issues. ✅
*   **Next Session Goals:**
    *   M5a: Baseline computation — migration for `baseline_snapshots` table + nightly Edge Function (pg_cron) computing 7-day rolling averages per metric from `daily_gut_rows`.
    *   M5b: First descriptive insight card — read `baseline_snapshots`, write to `insight_cards`, display on Insights tab.
*   **Notes / Blocked by / Needs:**
    *   Note for Jayden: WiFi IP changes on network reconnect — remind team to check `src/.env.public` if Supabase connection fails.
    *   M2 UI follows Biotope design system — see `docs/ui-context/UI-DESIGN-CONTEXT.md`.

---

## 📝 Recent Change Log (Last 5 merged PRs/Sessions)
1. **2026-05-14** - M6 titles + home tab reload + today card UX: Pioneer/Committed badges, `HomeTabState.reload()` via GlobalKey on tab switch, partially-logged card tappable. Tested on Android. `flutter analyze` clean. — *Alton*
2. **2026-05-14** - M2 pre-populate + active antibiotic display: `getTodayLog` (logging_controller), `getActiveCourse` (antibiotic_service), `DailyLogScreen` initState pre-fill + spinner + `_ActiveCourseCard`. Fixed `src/.env.public` Supabase IP. `flutter analyze` clean. — *Alton*
2. **2026-05-14** - M2 service extraction + symptom flags + antibiotic course flow: `DailyLogService` (region, on_antibiotics, gut_watch_active), `symptom_flags_screen.dart` (7 flags, multi-select), `antibiotic_course_screen.dart` + `AntibioticService`. `flutter analyze` clean. — *Jayden*
3. **2026-05-13** - App shell (`app_shell.dart`) + Home dashboard (`home_tab.dart`): 5-tab NavigationBar, today's log card, streak card, insights teaser, sign-out dialog. `DailyLogScreen` wired into Log tab. `flutter analyze` clean. — *Alton*
2. **2026-05-13** - Frontend env cleanup: `src/.env.public` for bundled client config, removed `src/.env`, kept backend secrets in `supabase/.env`; hardened Supabase trigger `search_path`; docs refreshed. — *Jayden*
3. **2026-05-13** - Stool Form UI (Bristol 1–7 picker, custom shape icons). Daily Log shell (all M2 inputs, live DQS, Supabase upsert). Tested on Samsung A165F. — *Alton*
4. **2026-05-13** - M2 SQL migration (daily_gut_rows + antibiotic_courses, RLS). Urine Color UI (Armstrong 1–8 palette). Tested on Samsung A165F. — *Alton*
5. **2026-05-10** - Fixed sign-out (AuthGate navigation bug). Full country picker (195 countries, search). Singapore corrections across codebase. Session/commit conventions added. — *Jayden*
