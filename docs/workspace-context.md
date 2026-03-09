# workspace-context.md — Team Session Tracker
> **VARIABLE LAYER** — Update this document at the start and end of every work session.
> Purpose: To keep the 3-person team aligned on who did what, and what needs to happen next.

---

## 📅 Phase Timeline Status

| Phase | Milestone | Status | Target Date |
|---|---|---|---|
| **Phase 1 Stage 1 MVP** | **Repository Scaffolding** | ✅ Complete | - |
| Phase 1 Stage 1 MVP | M1 Authentication & DB Models | ⏳ Pending | TBD |
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
    *   (Initial Setup: Scaffolded M2 directories and normalizer files)
*   **Next Session Goals:**
    *   Build the Urine Color UI (Armstrong scale).
    *   Build the Stool Form UI (Bristol scale).
*   **Notes / Blocked by / Needs:**
    *   Needs M1 to finish Auth so that the `user_id` can be injected into the `DailyGutRow` on save.

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
1. **[Date]** - Initial repository structure and `SHARED-CONTEXT.md` types created. — *All*
