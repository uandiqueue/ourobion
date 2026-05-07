# workspace-context.md — Team Session Tracker
> **VARIABLE LAYER** — Update this document at the start and end of every work session.
> Purpose: To keep the 3-person team aligned on who did what, and what needs to happen next.

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
*   **Last Session Accomplished:**
    *   Fixed Manrope font crash — disabled runtime fetching, bundled font via pubspec.yaml.
    *   Resolved Supabase connectivity via Tailscale (WiFi firewall workaround).
    *   Verified full auth flow end-to-end on Android phone: sign-up → consent → profile → home. ✅
*   **Next Session Goals (M1 MVP v1 Polish):**
    *   Profile setup: replace region free-text with country picker + regions pulled from DB.
    *   Sign-in/sign-up: implement Google and Apple OAuth via Supabase.
    *   Fix sign-out button on home screen placeholder (currently not working).
    *   Above 3 items complete = M1 MVP v1 done.
*   **Notes / Blocked by / Needs:**
    *   Manrope TTF files still need to be downloaded and placed in `src/assets/fonts/` for font to fully render.
    *   Alton still blocked on app shell + tab navigation before M2 UI can be wired in — do this after M1 polish.

### Member 2: [Alton]
**Focus Area:** M2 (Self-Report Logging) + Flutter UI
*   **Last Session Accomplished:**
    *   Initialized Flutter project + installed all dependencies.
    *   Created M1 data models + services (`auth_service`, `profile_service`, `consent_service`).
    *   Created SQL migration for `profiles` and `consent_records` tables with RLS + auto-profile trigger.
    *   Implemented full M2 backend: `urine_logging`, `stool_logging`, `food_logging`, `mosquito_logging`, `antibiotics_logging`, `daily_checkin`, `logging_controller`, `normaliser`, `antibiotic_service`.
*   **Next Session Goals:**
    *   Create SQL migration for `daily_gut_rows` and `antibiotic_courses` tables (M2 owns these).
    *   Build Urine Color UI (Armstrong 1–8 colour palette tap).
    *   Build Stool Form UI (Bristol scale 1–7 icon picker).
    *   Build daily log shell screen that stitches the M2 inputs together.
*   **Notes / Blocked by / Needs:**
    *   M1 UI is fully done by Jayden — no longer blocked on auth/consent/profile screens.
    *   App shell + tab navigation (Home, Log, Insights, Squad, World) still needed from Jayden before M2 UI can be wired into navigation.
    *   M2 UI should follow Biotope design system — see `docs/ui-context/UI-DESIGN-CONTEXT.md` before building any screens.

---

## 📝 Recent Change Log (Last 5 merged PRs/Sessions)
1. **2026-05-08** - Verified end-to-end auth on Android phone. Fixed Manrope font crash, resolved Supabase connectivity via Tailscale. — *Jayden*
2. **2026-05-07** - Built styled auth screens with Biotope design system: LivingBackdrop, Manrope, BiotopeTheme, logo asset, UI design context docs. — *Jayden*
2. **2026-04-18** - Built M1 onboarding UI: consent screen, profile setup screen, home placeholder, AuthGate onboarding flow. — *Jayden*
3. **2026-04-17** - Fixed M1 bugs: OAuth return type, `getProfile()` null safety, `updateProfile()` map mutation. — *Jayden*
4. **2026-03-18** - M1 Auth backend, DB models, services, SQL migration, sign-in/sign-up UI, `.env` config. — *Alton*
5. **2026-03-09** - Initial repository structure and `SHARED-CONTEXT.md` types created. — *All*
