# workspace-context.md — Team Session Tracker
> **VARIABLE LAYER** — Update this document at the start and end of every work session.
> Purpose: To keep the 3-person team aligned on who did what, and what needs to happen next.

---

## 📅 Phase Timeline Status

| Phase | Milestone | Status | Target Date |
|---|---|---|---|
| **Phase 1 Stage 1 MVP** | **Repository Scaffolding** | ✅ Complete | - |
| Phase 1 Stage 1 MVP | M1 Authentication & DB Models | 🔨 In Progress (testing pending) | TBD |
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
    *   Built full Biotope design system (`core/theme.dart`) — M3 color tokens, Manrope font, input/button styles.
    *   Built `LivingBackdrop` widget — animated drifting orbs using CustomPainter.
    *   Rebuilt sign-in + sign-up screens with design system (logo, eyebrow labels, styled fields, CTA).
    *   Added `google_fonts` dependency + logo asset (`src/assets/images/logo.png`).
    *   Added UI design context docs (`UI-DESIGN-CONTEXT.md`, `auth-screen` HTML reference).
    *   Set up Flutter-on-Windows dev plan to avoid WSL2/USB/port-forwarding complexity.
*   **Next Session Goals:**
    *   Set up Flutter + Android Studio on Windows, clone repo there.
    *   Start local Supabase in WSL2 (`npx supabase start` + `npx supabase db push`).
    *   Test full sign-up → consent → profile → home flow on Android device.
    *   App shell + bottom tab navigation (once basic flow verified).
*   **Notes / Blocked by / Needs:**
    *   Flutter dev moving to Windows side. WSL2 = Supabase only.
    *   `.env` on Windows clone needs LAN IP (`192.168.x.x:54321`) not `127.0.0.1`.
    *   WSL2 needs `netsh` port forward: `netsh interface portproxy add v4tov4 listenport=54321 listenaddress=0.0.0.0 connectport=54321 connectaddress=172.25.169.171`.

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
1. **2026-05-07** - Built styled auth screens with Biotope design system: LivingBackdrop, Manrope, BiotopeTheme, logo asset, UI design context docs. — *Jayden*
2. **2026-04-18** - Built M1 onboarding UI: consent screen, profile setup screen, home placeholder, AuthGate onboarding flow. — *Jayden*
3. **2026-04-17** - Fixed M1 bugs: OAuth return type, `getProfile()` null safety, `updateProfile()` map mutation. — *Jayden*
4. **2026-03-18** - M1 Auth backend, DB models, services, SQL migration, sign-in/sign-up UI, `.env` config. — *Alton*
5. **2026-03-09** - Initial repository structure and `SHARED-CONTEXT.md` types created. — *All*
