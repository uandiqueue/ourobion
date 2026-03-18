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
    *   (Initial Setup: Scaffolded repo and created module context files)
*   **Next Session Goals:**
    *   Implement Supabase Email & Apple Sign In flows.
    *   Implement user profile creation.
*   **Notes / Blocked by / Needs:**
    *   *None currently.*

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

### Member 3: [None]
**Focus Area:** M5a/M5b (Intelligence) + M6 (Engagement)
*   **Last Session Accomplished:**
    *   (Initial Setup: Created compute-baselines and generate-insights edge functions)
*   **Next Session Goals:**
    *   Write the pg_cron scheduled job for `M5a`.
    *   Map out the DQS (Data Quality Score) calculation trigger.
*   **Notes / Blocked by / Needs:**
    *   Needs M2 to finalize the `daily_gut_rows` table schema before writing the rolling average queries.

---

## 📝 Recent Change Log (Last 5 merged PRs/Sessions)
1. **2026-03-18** - M1 Auth backend, DB models, services, SQL migration, sign-in/sign-up UI, `.env` config. — *Alton*
2. **[Date]** - Initial repository structure and `SHARED-CONTEXT.md` types created. — *All*
