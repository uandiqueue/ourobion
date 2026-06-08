# Session 20260601T000000Z — uandiqueue — team — historical-backfill

> **Backfilled history.** This single file preserves the "Recent Change Log" that used to live in
> `docs/workspace-context.md`, converted into the session-log format when biotope adopted append-only
> per-session logs (see the 2026-06-08 bootstrap session). Timestamp is nominal (00:00:00Z on the date
> of the most recent change-log entry) because the original entries were dated by day, not by UTC time.
> From the bootstrap session onward, every session writes its own file.

- **Device:** uandiqueue · **Agents:** Jayden + Alton (mixed) · **Branches:** various (`dev-*`)
- **Goal:** historical record of P1S1 (MVP) + early P1S2 (wearables) work prior to the context system.

## Attempted
Build out the Phase 1 Stage 1 MVP (M1, M2, M5a, M5b, M6) and begin Phase 1 Stage 2 wearable
integration (M3).

## Changed (most recent first — from the old Recent Change Log)
- **2026-06-01** — M3 iOS dev environment: CocoaPods installed, Podfile iOS target bumped to 14.0,
  Xcode iOS 26.5 SDK downloaded, `flutter build ios --debug` confirmed clean. End-to-end device test
  (HealthKit → `wearable_daily`) TBC pending Jayden. — *Alton*
- **2026-05-30** — M3 iOS: HealthKit capability added in Xcode; `Runner.entitlements` now contains
  `com.apple.developer.healthkit = true`. iOS wearable sync unblocked. — *Alton*
- **2026-05-28** — M5a extended: `compute-baselines` now fetches `wearable_daily` in parallel;
  `buildSnapshots` + `groupByUser` helpers; 6 wearable metrics → `baseline_snapshots` with
  `data_sources: ['wearable']`. Tested locally. — *Alton*
- **2026-05-28** — M3 Flutter integration: `WearableService` (HealthKit + Health Connect, 6 signals),
  `wearable_daily` migration + RLS applied, platform config (Info.plist + AndroidManifest), wired into
  `DailyLogScreen`. Fixed `updateOnLogWrite` (unawaited → await). `flutter analyze` clean. — *Alton*
- **2026-05-27** — M3 Stage 2 planning: HealthKit + Health Connect; 6 signals (resting HR, HRV, sleep,
  SpO2, body temp, steps); pull-on-log-open; `wearable_daily` schema agreed; Alton owns Flutter
  integration, Jayden owns PDPA consent update. — *Alton*
- **2026-05-27** — M1 PDPA consent copy polish; M6 device test passed. `flutter analyze` clean. — *Alton*
- **2026-05-27** — M6 home tab: surface `longest_streak_days` + `dqs_7day_avg` as stat chips. — *Alton*
- **2026-05-15** — M6 engagement: `engagement_state` migration + RLS, `EngagementService`,
  `updateOnLogWrite` wired on save, home tab streak/titles/insights teaser. — *Alton*
- **2026-05-15** — M5a + M5b: baseline computation pipeline + insight engine
  (`baseline_snapshots` + `insight_cards` tables, `compute-baselines` + `generate-insights` edge
  functions, pg_cron, `BaselineService` + `InsightService` + `InsightsTab`). — *Alton*
- **2026-05-14** — M6 titles + home tab reload + today card UX; M2 pre-populate + active antibiotic
  display; M2 persistence extracted into `DailyLogService`; symptom flags + antibiotic course screens.
  — *Jayden + Alton*
- **2026-05-13** — App shell + Home dashboard (5-tab NavigationBar); Stool Form + Daily Log UI; M2 SQL
  migration (daily_gut_rows + antibiotic_courses, RLS); frontend env cleanup (`src/.env.public`). —
  *Jayden + Alton*
- **2026-05-10** — Sign-out fix, full country picker, Singapore corrections, session/commit
  conventions added. — *Jayden*

## Decided
- Two-tier ownership: Jayden → M1/DB/M2-assist; Alton → M2/Flutter UI/M3. (Now in AGENTS.md §6.)
- Durable gotchas captured as memory facts during the 2026-06-08 bootstrap (HRV SDNN iOS-only;
  wearable sync best-effort; pg_cron config prereqs).

## Left
- M3: end-to-end wearable test on a real iPhone (HealthKit → `wearable_daily`) — still pending.
- M1: copy/legal polish; defer Google/Apple OAuth until Supabase redirect URLs + deep links ready.
- M6: `dqs_7day_avg` + `longest_streak` display deferred.

## Blockers / notes
- Bundle ID changed to `com.biotope.alton` for dev signing (free Apple ID team) — may need updating
  before production distribution.
- WiFi IP changes on network reconnect — check `src/.env.public` if Supabase connection fails.
