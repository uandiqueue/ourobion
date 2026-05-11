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
    *   Above 2 items complete = M1 MVP v1 done.
*   **Notes / Blocked by / Needs:**
    *   Alton still blocked on app shell + tab navigation before M2 UI can be wired in — do this after M1 polish.

### Member 2: [Alton]
**Focus Area:** M2 (Self-Report Logging) + Flutter UI
*   **Last Session Accomplished:**
    *   Connected physical Android phone (Samsung A165F) via USB debugging.
    *   Downloaded missing Manrope `.ttf` font files into `src/assets/fonts/` to resolve Android build errors.
    *   Configured `src/.env` to use the Mac's local WiFi IP (`192.168.4.53`) to allow the physical phone to communicate with the local Supabase instance.
    *   Fixed sign-out bug in `home_screen.dart` to properly route back to the AuthGate (`/`) instead of closing the app.
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
1. **2026-05-11** - Connected physical Android phone, resolved Manrope font build error, configured local Supabase IP for USB debugging, and fixed sign-out navigation bug. — *Alton*
2. **2026-05-08** - Pulled latest dev-phase1. Updated README with Android Emulator setup (Option B under macOS, restructured Android section). — *Alton*
3. **2026-05-08** - Verified end-to-end auth on Android phone. Fixed Manrope font crash, resolved Supabase connectivity via Tailscale. — *Jayden*
3. **2026-05-07** - Built styled auth screens with Biotope design system: LivingBackdrop, Manrope, BiotopeTheme, logo asset, UI design context docs. — *Jayden*
4. **2026-04-18** - Built M1 onboarding UI: consent screen, profile setup screen, home placeholder, AuthGate onboarding flow. — *Jayden*
5. **2026-04-17** - Fixed M1 bugs: OAuth return type, `getProfile()` null safety, `updateProfile()` map mutation. — *Jayden*
