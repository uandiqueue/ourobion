# workspace-context.md — Team Session Tracker
> **VARIABLE LAYER** — Update this document at the start and end of every work session.
> Purpose: To keep the 3-person team aligned on who did what, and what needs to happen next.

---

## 📅 Phase Timeline Status

| Phase | Milestone | Status | Target Date |
|---|---|---|---|
| **Phase 1 Stage 1 MVP** | **Repository Scaffolding** | ✅ Complete | - |
| Phase 1 Stage 1 MVP | M1 Authentication & DB Models | 🔨 In Progress | TBD |
| Phase 1 Stage 1 MVP | M2 Self-Report Logging UI | ⏳ Pending | TBD |
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
    *   Fixed M1 bugs: OAuth return type (`AuthResult.pending()`), `getProfile()` null safety, `updateProfile()` map mutation.
    *   Built consent screen UI (`consent_screen.dart`) — 4 toggles, wearable greyed out per MVP spec.
    *   Built profile setup screen UI (`profile_setup_screen.dart`) — display name, region, city, wearable toggle.
    *   Built home screen placeholder (`home_screen.dart`) — shows email + sign out.
    *   Updated `main.dart` AuthGate to route through full onboarding flow (consent → profile → home).
*   **Next Session Goals:**
    *   Start local Supabase (`npx supabase start`) and run the SQL migration.
    *   Test the full sign-up → consent → profile → home flow on Android device.
    *   App shell + bottom tab navigation (once basic flow is verified working).
*   **Notes / Blocked by / Needs:**
    *   Android SDK still needs installing (Android Studio on Windows + `flutter config --android-sdk`).

### Member 2: [Alton]
**Focus Area:** M2 (Self-Report Logging) + Flutter UI
*   **Last Session Accomplished:**
    *   Initialized Flutter project (`flutter create .`) and installed dependencies (`supabase_flutter`, `flutter_riverpod`, `go_router`, `flutter_dotenv`).
    *   Set up `.env` for Supabase credentials + added to `.gitignore`.
    *   Created M1 data models: `auth_result.dart`, `user_identity.dart`, `user_profile.dart`, `consent_record.dart`.
    *   Implemented `auth_service.dart` (email sign-in/sign-up, OAuth placeholders, sign-out).
    *   Implemented `profile_service.dart` and `consent_service.dart`.
    *   Created SQL migration for `profiles` and `consent_records` tables with RLS + auto-profile trigger.
    *   Built sign-in and sign-up UI screens.
    *   Rewrote `main.dart` with Supabase init + AuthGate routing.
*   **Next Session Goals:**
    *   Run the SQL migration in Supabase SQL Editor.
    *   Build the Urine Color UI (Armstrong scale) for M2.
    *   Build the Stool Form UI (Bristol scale) for M2.
*   **Notes / Blocked by / Needs:**
    *   M1 Auth backend is done. `user_id` is now available via `AuthService.getCurrentUser()`.
    *   M1 still needs: consent screen UI, profile setup screen UI, app shell navigation, copy constants (Jayden to pick up).

---

## 📝 Recent Change Log (Last 5 merged PRs/Sessions)
1. **2026-05-07** - Built styled auth screens (sign in + sign up) using Biotope design system: LivingBackdrop widget, Manrope font, full color token set, BiotopeTheme. Added google_fonts dependency, logo asset. — *Jayden*
2. **2026-04-18** - Built M1 onboarding UI: consent screen, profile setup screen, home placeholder. Updated AuthGate to route through full onboarding flow. — *Jayden*
2. **2026-04-17** - Fixed M1 bugs: OAuth return type, `getProfile()` null safety, `updateProfile()` map mutation. — *Jayden*
2. **2026-03-18** - M1 Auth backend, DB models, services, SQL migration, sign-in/sign-up UI, `.env` config. — *Alton*
3. **2026-03-09** - Initial repository structure and `SHARED-CONTEXT.md` types created. — *All*
