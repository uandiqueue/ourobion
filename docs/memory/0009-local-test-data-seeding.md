---
id: "0009"
title: Local test data seeding (don't log for a week by hand)
summary: Inject backdated rows keyed on log_date via scripts/seed-test-data.ps1 then rebuild projections (compute-baselines before generate-insights) so the UI renders "weeks in" instantly; target user must already exist (RLS on auth.uid).
type: memory
status: accepted
decided: 2026-07-13
updated: 2026-07-30
---

# Local test data seeding (don't log for a week by hand)

**Gotcha / workflow.** Time-based features (streaks, baselines, insights) don't require logging for
real over days. Raw rows are keyed on `log_date` (a date string), not the wall clock, so you **inject
backdated rows** and the UI renders "weeks in" instantly. Tool: `scripts/seed-test-data.ps1`
(+ `scripts/seed-test-data.sql`) — tune the variables at the top, run it.

**Why injection alone isn't enough.** The UI reads from four places and only one is a raw table:

| UI view | Table | Tier | Rebuilt by |
|---|---|---|---|
| Log tab / "Today" DQS | `daily_gut_rows` | TRUTH | direct insert ✅ |
| Home streak / titles / 7-day avg | `engagement_state` | projection | M6 logic in `engagement_service.dart` (on log-write) |
| Baselines | `baseline_snapshots` | projection | `compute-baselines` edge fn (30-day lookback) |
| Insights | `insight_cards` | projection | `generate-insights` edge fn — **reads `baseline_snapshots`** |

**How to apply.** This is the [0001-two-tier-truth](0001-two-tier-truth.md) model: inject truth, then rebuild projections.
The seeder handles all of it — injects raw rows, replicates the M6 streak/title computation in SQL,
then invokes `compute-baselines` **before** `generate-insights` (ordering matters). Constraints baked
into the tool: (1) **RLS** keys on `auth.uid() = user_id`, so the target user must already exist — sign
in once in the app first; the seeder resolves the UUID from `auth.users` by email. (2) Edge functions
are served by `npx supabase start` (the `edgeRuntime` container) — no separate `functions serve`.
(3) The app fetches on screen init, so pull-to-refresh after seeding. Confidence tiers: ≥3 days leaves
"insufficient", ≥7 "medium", ≥14 "high" (and a 7-day streak unlocks insights + the "Committed" title).
The SQL's engagement rebuild **mirrors** `engagement_service.dart` — if M6's rules change, update both.

**Provenance and destructive-mode safety.** Seeded truth uses the exact registered simulated marker
`seed:local-test-data` in both `daily_gut_rows.data_origin` and `wearable_daily.source`; registry
revocation is durable and survives reapplying its forward migration. `WipeFirst = true` remains the
default and is destructive: it clears the selected user's raw rows and rebuildable projections, so
use it only for a dedicated, disposable local test user. With `WipeFirst = false`, the seeder scans
both truth tables over the complete requested date range before writing and refuses NULL/real,
unregistered, revoked, registered-real, or foreign provenance. Non-wipe replay is allowed only for
this script's exact marker.
