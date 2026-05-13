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
| Phase 1 Stage 1 MVP | M2 Self-Report Logging UI | 🔨 In Progress (core UI + DB done, service extraction pending) | TBD |
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
*   **Last Session Accomplished (2026-05-13):**
    *   Audited frontend/backend env handling and replaced ambiguous `src/.env` with explicit `src/.env.public` for bundled Flutter client config. ✅
    *   Kept backend/local secrets isolated under `supabase/.env`; removed old frontend `src/.env` local file and deleted tracked `src/.env.example`. ✅
    *   Updated `main.dart`, `pubspec.yaml`, `setup.sh`, README, and app docs to support plain `cd src && flutter run` with `.env.public`. ✅
    *   Hardened Supabase `handle_new_user()` `SECURITY DEFINER` migration with pinned `search_path`. ✅
    *   Refreshed stale docs across workspace, structure, M1, M2, shared contract, architecture, project context, and `src/README.md`. ✅
    *   Verified `flutter analyze` and `flutter test` pass. ✅
*   **Next Session Goals:**
    *   Finalize M1 copy/legal polish: review PDPA consent wording and complete `shared/constants/copy_guidelines.dart` enforcement path.
    *   Defer Google/Apple OAuth until Supabase dashboard redirect URLs and platform deep-link config are ready.
*   **Notes / Blocked by / Needs:**
    *   App shell + tab nav delivered by Alton this session — no longer blocked.

### Member 2: [Alton]
**Focus Area:** M2 (Self-Report Logging) + Flutter UI
*   **Last Session Accomplished (2026-05-13):**
    *   Built `app_shell.dart` — `AppShell` with Material 3 `NavigationBar` (5 tabs: Home, Log, Insights, Squad, World), `IndexedStack`, design-token styled, 6px indicator radius, `outlineVariant` top border. ✅
    *   Built `home_tab.dart` — Home dashboard with time-based greeting, display name from `ProfileService`, today's log status card, streak card, insights teaser with 7-day progress bar; 600ms slide+fade entry animation. ✅
    *   Placeholder tabs for Insights / Squad / World with contextual subtitles. ✅
    *   `DailyLogScreen` wired into Log tab; back button removed. `main.dart` updated to `AppShell`. ✅
    *   Sign-out moved to profile icon in home header with confirmation dialog. ✅
    *   `flutter analyze` passes with no issues. ✅
*   **Next Session Goals:**
    *   Symptom flags multi-select screen — `symptom_flags_screen.dart` (presence-only, multi-select chips).
    *   Antibiotic course setup flow (separate screen, event-based not daily).
    *   Extract M2 persistence out of `DailyLogScreen` into impl services before adding more write paths.
*   **Notes / Blocked by / Needs:**
    *   M2 UI follows Biotope design system — see `docs/ui-context/UI-DESIGN-CONTEXT.md`.

---

## 📝 Recent Change Log (Last 5 merged PRs/Sessions)
1. **2026-05-13** - App shell (`app_shell.dart`) + Home dashboard (`home_tab.dart`): 5-tab NavigationBar, today's log card, streak card, insights teaser, sign-out dialog. `DailyLogScreen` wired into Log tab. `flutter analyze` clean. — *Alton*
2. **2026-05-13** - Frontend env cleanup: `src/.env.public` for bundled client config, removed `src/.env`, kept backend secrets in `supabase/.env`; hardened Supabase trigger `search_path`; docs refreshed. — *Jayden*
3. **2026-05-13** - Stool Form UI (Bristol 1–7 picker, custom shape icons). Daily Log shell (all M2 inputs, live DQS, Supabase upsert). Tested on Samsung A165F. — *Alton*
4. **2026-05-13** - M2 SQL migration (daily_gut_rows + antibiotic_courses, RLS). Urine Color UI (Armstrong 1–8 palette). Tested on Samsung A165F. — *Alton*
5. **2026-05-10** - Fixed sign-out (AuthGate navigation bug). Full country picker (195 countries, search). Singapore corrections across codebase. Session/commit conventions added. — *Jayden*
