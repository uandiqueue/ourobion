# workspace-context.md — Team Session Tracker
> **VARIABLE LAYER** — Update this document at the start and end of every work session.
> Purpose: To keep the 3-person team aligned on who did what, and what needs to happen next.

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

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
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
| Phase 1 Stage 1 MVP | M1 Authentication & DB Models | 🔨 In Progress (polish remaining) | TBD |
| Phase 1 Stage 1 MVP | M2 Self-Report Logging UI | 🔨 In Progress (backend done, UI pending) | TBD |
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
**Focus Area:** M1 (Core & Compliance) + Database Rules
*   **Last Session Accomplished (2026-05-10):**
    *   Fixed sign-out button: `HomeScreen` now explicitly navigates to `SignInScreen` after sign-out (was broken because `pushAndRemoveUntil` had removed `AuthGate` from widget tree). ✅
    *   Profile setup: replaced free-text region field with `country_picker` package — all 195 countries with flag emoji + searchable bottom sheet. Stores country name in existing `region` column, no DB migration needed. ✅
    *   Fixed all Malaysia/KL references to Singapore throughout codebase and docs (project is Singapore-based). ✅
    *   Fixed stale `widget_test.dart` referencing deleted `MyApp` class. ✅
    *   Added session & commit conventions to workspace. ✅
    *   `flutter analyze` clean: zero errors.
*   **Next Session Goals:**
    *   Implement Google and Apple OAuth sign-in via Supabase (needs Supabase dashboard config + redirect URL setup + platform-specific deep link config — skip until ready).
    *   App shell + bottom tab navigation (Home, Log, Insights, Squad, World) — unblocks Alton's M2 UI wiring.
    *   Above = M1 MVP v1 done.
*   **Notes / Blocked by / Needs:**
    *   Alton still blocked on app shell + tab navigation before M2 UI can be wired in — do this after M1 polish.

### Member 2: [Alton]
**Focus Area:** M2 (Self-Report Logging) + Flutter UI
*   **Last Session Accomplished (2026-05-13):**
    *   Built `stool_form_screen.dart` — Bristol scale 1–7 tile picker with custom-painted shape icons (pellets → wavy lines), description card, entry animation, skip + confirm flow. ✅
    *   Built `daily_log_screen.dart` — full M2 daily log hub: urine + stool navigate to dedicated screens, stool count + mosquito bites use +/− steppers, outside meals uses 0–3 segmented selector, energy/mood/gut comfort use 1–5 Likert rows, notes field with 140-char counter. ✅
    *   Live DQS progress bar (0–100 pts, turns green at 60 = streak-worthy). ✅
    *   Save upserts to `daily_gut_rows` via Supabase (`onConflict: user_id,log_date`). ✅
    *   Tested full logging flow end-to-end on physical Samsung A165F. ✅
*   **Next Session Goals:**
    *   Remove `[DEV]` buttons from `home_screen.dart` once app shell + tab nav is wired in.
    *   Wire `DailyLogScreen` into the Log tab once Jayden delivers app shell.
    *   Symptom flags multi-select screen — `symptom_flags_screen.dart` (presence-only, multi-select chips).
    *   Antibiotic course setup flow (separate screen, event-based not daily).
*   **Notes / Blocked by / Needs:**
    *   App shell + tab navigation (Home, Log, Insights, Squad, World) still needed from Jayden before M2 screens can be wired into real navigation.
    *   M2 UI follows Biotope design system — see `docs/ui-context/UI-DESIGN-CONTEXT.md`.

---

## 📝 Recent Change Log (Last 5 merged PRs/Sessions)
1. **2026-05-13** - Stool Form UI (Bristol 1–7 picker, custom shape icons). Daily Log shell (all M2 inputs, live DQS, Supabase upsert). Tested on Samsung A165F. — *Alton*
2. **2026-05-13** - M2 SQL migration (daily_gut_rows + antibiotic_courses, RLS). Urine Color UI (Armstrong 1–8 palette). Tested on Samsung A165F. — *Alton*
3. **2026-05-10** - Fixed sign-out (AuthGate navigation bug). Full country picker (195 countries, search). Singapore corrections across codebase. Session/commit conventions added. — *Jayden*
4. **2026-05-11** - Connected physical Android phone, resolved Manrope font build error, configured local Supabase IP for USB debugging, updated README Android section. — *Alton*
5. **2026-05-08** - Verified end-to-end auth on Android phone. Fixed Manrope font crash, resolved Supabase connectivity via Tailscale. — *Jayden*
