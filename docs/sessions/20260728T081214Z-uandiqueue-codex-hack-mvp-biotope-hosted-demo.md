---
title: Hackathon MVP biotope device demo, local fallback
summary: Secured and device-verified the Run 4 local demo, fixed a restored-session onboarding race without weakening authorization, and recorded the exact five-tab evidence and gaps after no hosted-ready handoff arrived.
type: session
scope: biotope
status: canonical
updated: 2026-07-28
---

# Hackathon MVP biotope device demo, local fallback

Issue: #203

Branch: `fix/hack-mvp-biotope-demo`

## Attempted

- Prepared a guaranteed local Supabase fallback before waiting for the CLOUD lane.
- Applied every pending local migration, reloaded PostgREST, seeded 21 simulated days, and rebuilt
  baselines then insights through the internal-authenticated function boundary.
- Ran the full Flutter verification gate and traversed all five tabs on the tethered Huawei YAL-L21.
- Looked for the exact required `HOSTED READY — ...` handoff across sibling worktrees before the stop
  rule; none existed, so the ignored dotenv configuration stayed local.

## Changed

- Added a one-shot, fail-closed retry for the exact restored-session race
  `PGRST303: JWT issued at future`; other failures and a repeated PGRST303 rethrow unchanged.
- Added three regression tests covering the successful retry, an unrelated authorization denial,
  and the bounded second failure.
- Added `docs/temp/run4/hack-mvp-demo-script.md` with exact local commands, the device talk track,
  observed evidence, and the unsoftened gap list.
- Local derived demo state now contains 16 baseline snapshots, one active relationship card, and one
  rules card archived through the UI. No derived database row was hand-edited.

## Decided

- Used the local fallback because the CLOUD lane never issued the explicit hosted-ready signal. No
  hosted write, dotenv flip, live-nao claim, promotion, deploy, or release was attempted.
- Restored the ignored Android plugin registrant from the canonical UI worktree because Windows
  Developer Mode is unavailable; did not commit generated plugin output or change product code for
  that machine-only artifact.
- Kept the session-refresh repair exact and bounded instead of broadly retrying authorization errors.
- Recorded, but did not expand scope to repair, the stale already-mounted Archive tab: its save write
  persisted and loaded after cold restart, but the empty tab did not live-refresh.

## Verification actually run

- `flutter analyze --no-pub`: `No issues found!`.
- `flutter test --no-pub test/core/session_refresh_retry_test.dart`: 3 pass, 0 fail.
- `flutter test --no-pub`: 266 pass, 26 skipped, 0 fail. The skips remain the documented generated
  asset downscale group and O28 1.6× MetricTile case.
- Physical Huawei YAL-L21: Home, Scan, Insights, Archive, and Profile rendered; artwork present; no
  Home tile overflow; Profile did not hang; provenance and archived-card cold read verified.
- Local database evidence: 21 daily rows, 21 wearable rows, 16 baselines, 21-day streak, 2 generated
  cards before UI save, 5 indexed study identifiers, 4 verified relationships.
- Internal-auth negative: function invocation without the configured internal secret failed closed
  with `internal auth denied: not_configured`.

## Left

- Hosted phone verification and live-nao shared-project proof; no `HOSTED READY` handoff arrived.
- Archive trends (#200), `scanSweep` restyle (#201), B-UI3 humanVerdict, B-UI10/B-UI11 provenance and
  accessibility work, and O28 1.6× typography.
- Archive tab live refresh after a save; persisted data is visible after cold launch.
- Flutter/Kotlin built-in migration, large-asset frame cost, and the Windows Developer Mode setup gap.
- Landing is expected to remain gated until the CLOUD/release lane advances `RUN4_UNIT_BASE_SHA` past
  the merged UI; this session did not touch its owned gate, CI, or attestation files.

## Blockers

- No explicit CLOUD-lane hosted-ready signal, so the stop rule required the local fallback.
- The release-gate base still predates the merged full UI and is owned by the CLOUD/release lane.

memory: none
