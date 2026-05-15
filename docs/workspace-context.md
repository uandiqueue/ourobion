# workspace-context.md — Team Session Tracker
> **VARIABLE LAYER** — Update this document at the start and end of every work session.
> Purpose: To keep the 2-person team aligned on who did what, and what needs to happen next.

---

<!-- [ai-entry] -->
## AI Agent Entry Point

> This section is for AI agents. Team members: skip to [Session & Commit Conventions](#-session--commit-conventions).

**Read `docs/AGENT-PROTOCOL.md` first.** It contains the routing table, non-negotiables, and PR review checklist. Come back here for current team state only.

This file is the **variable layer** — it changes every session. Do not treat it as authoritative for code interfaces or architecture. For those, follow the truth hierarchy in `AGENT-PROTOCOL.md`.

**Section map for targeted retrieval:**

| Section tag | What it contains | Read when |
|---|---|---|
| `[session-conventions]` | Commit format, session rules | Starting a session, preparing a commit |
| `[phase-status]` | Milestone table, what is done vs pending | Scoping work, checking if a feature is in-phase |
| `[blocked-items]` | Current blockers and cross-member notes | Triaging before starting work |
| `[team-state]` | Per-member last session + next steps | Resuming work, handing off between members |
| `[change-log]` | Last 5 sessions of work done | Understanding what changed recently, checking if module context is stale |

---

---

<!-- [session-conventions] -->
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

---

<!-- [phase-status] -->
## 📅 Phase Timeline Status

| Phase | Milestone | Status | Target Date |
|---|---|---|---|
| **Phase 1 Stage 1 MVP** | **Repository Scaffolding** | ✅ Complete | - |
| Phase 1 Stage 1 MVP | M1 Authentication & DB Models | 🔨 In Progress (copy polish remaining; app shell + tab nav ✅) | TBD |
| Phase 1 Stage 1 MVP | M2 Self-Report Logging UI | 🔨 In Progress (pre-populate + active course display done; home tab real DQS + streak pending) | TBD |
| Phase 1 Stage 1 MVP | M5a Baseline Computation Engine | ⏳ Pending | TBD |
| Phase 1 Stage 1 MVP | M5b Insight Generation | ⏳ Pending | TBD |
| Phase 1 Stage 1 MVP | M6 Engagement Systems | ⏳ Pending | TBD |
| Phase 1 Stage 2 | Passive Health (Wearables) | 🗓️ Planned | TBD |
| Phase 1 Stage 3 | Environmental Modifiers | 🗓️ Planned | TBD |

---

---

<!-- [blocked-items] -->
## 🚧 Current Blocked Items

> Extracted from team notes for fast triage. Update whenever a block appears or resolves.

- **Env:** Supabase WiFi IP changes on network reconnect — if connection fails, check `src/.env.public`. *(Note from Alton → Jayden, 2026-05-14)*
- **Auth:** Google/Apple OAuth deferred until Supabase dashboard redirect URLs and platform deep-link config are ready. *(Jayden)*
- **M1 copy:** PDPA consent copy needs legal review before any release build. *(Jayden)*
- Nothing else currently blocking.

---

<!-- [team-state] -->
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
    *   Fixed Supabase connection error — Mac WiFi IP changed from `.53` to `.52`; updated `src/.env.public`. ✅
    *   Added `getTodayLog` to `DailyLogService` (`logging_controller.dart`) — fetches today's existing `daily_gut_rows` row (`maybeSingle`). ✅
    *   Added `getActiveCourse` to `AntibioticService` (`antibiotic_service.dart`) — queries `antibiotic_courses` where today falls within `start_date..end_date`. ✅
    *   Updated `DailyLogScreen` — `initState` calls `_loadTodayData`: fetches today's row + active course in parallel, pre-populates all fields (urine, stool, count, meals, mosquito, energy, mood, gut comfort, symptom flags, notes); shows spinner while loading. ✅
    *   Added `_ActiveCourseCard` widget — shows drug name, "Day X of Y · N days remaining", ACTIVE badge in MEDICATIONS section; refreshes when returning from antibiotic course screen. ✅
    *   `flutter analyze` passes with no issues. ✅
*   **Next Session Goals:**
    *   M2: Home tab `today's log status card` — wire up real DQS from `daily_gut_rows` so the card shows actual completeness, not a placeholder.
    *   M2: Streak counter — read `daily_gut_rows` consecutive days ≥ 60 pts to compute streak; display on home tab streak card.
    *   M5a / M6: Begin baseline computation engine or engagement state table once M2 data is stable.
*   **Notes / Blocked by / Needs:**
    *   Note for Jayden: WiFi IP changes on network reconnect — remind team to check `src/.env.public` if Supabase connection fails.
    *   M2 UI follows Biotope design system — see `docs/ui-context/UI-DESIGN-CONTEXT.md`.

---

---

<!-- [change-log] -->
## 📝 Recent Change Log (Last 5 merged PRs/Sessions)
1. **2026-05-14** - M2 pre-populate + active antibiotic display: `getTodayLog` (logging_controller), `getActiveCourse` (antibiotic_service), `DailyLogScreen` initState pre-fill + spinner + `_ActiveCourseCard`. Fixed `src/.env.public` Supabase IP. `flutter analyze` clean. — *Alton*
2. **2026-05-14** - M2 service extraction + symptom flags + antibiotic course flow: `DailyLogService` (region, on_antibiotics, gut_watch_active), `symptom_flags_screen.dart` (7 flags, multi-select), `antibiotic_course_screen.dart` + `AntibioticService`. `flutter analyze` clean. — *Jayden*
3. **2026-05-13** - App shell (`app_shell.dart`) + Home dashboard (`home_tab.dart`): 5-tab NavigationBar, today's log card, streak card, insights teaser, sign-out dialog. `DailyLogScreen` wired into Log tab. `flutter analyze` clean. — *Alton*
2. **2026-05-13** - Frontend env cleanup: `src/.env.public` for bundled client config, removed `src/.env`, kept backend secrets in `supabase/.env`; hardened Supabase trigger `search_path`; docs refreshed. — *Jayden*
3. **2026-05-13** - Stool Form UI (Bristol 1–7 picker, custom shape icons). Daily Log shell (all M2 inputs, live DQS, Supabase upsert). Tested on Samsung A165F. — *Alton*
4. **2026-05-13** - M2 SQL migration (daily_gut_rows + antibiotic_courses, RLS). Urine Color UI (Armstrong 1–8 palette). Tested on Samsung A165F. — *Alton*
5. **2026-05-10** - Fixed sign-out (AuthGate navigation bug). Full country picker (195 countries, search). Singapore corrections across codebase. Session/commit conventions added. — *Jayden*
