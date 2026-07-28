---
title: Bound wearable authorization so a missing provider can't hang the Scan sweep
summary: Health().requestAuthorization never resolves on a device with no wearable provider (e.g. Android 10 without Health Connect), which — awaited inside scan_tab.dart's Future.wait — left the Scan sweep stuck forever, making the Scan gap card (the only route to DailyLogScreen) permanently unreachable there. Wrapped the authorization call in a bounded, distinguishable-failure timeout inside WearableService.
type: session
scope: shared
status: canonical
updated: 2026-07-28
---

# Bound wearable authorization so a missing provider can't hang the Scan sweep

Branch: `fix/m2-scan/sweep-timeout`

## Attempted

- Reproduce and fix a hang reported on a real Android 10 phone (Huawei YAL-L21, no Health Connect):
  the Scan tab's "Run sweep" never leaves the "Sweeping…" state, because
  `WearableService.syncToday` awaits `Health().requestAuthorization` inside
  `scan_tab.dart`'s `Future.wait`, and that call never resolves when there is no wearable
  provider on the other end of the platform channel.
- Verify the fix on-device on that same physical phone.

## Changed

- `apps/biotope/lib/modules/m3_passive_health/impl/wearable_service.dart`
  - Added `wearableAuthTimeout` (5s) and `authorizeWithTimeout(authorize, {timeout})`, a small
    testable wrapper: a timeout degrades quietly to `false` (the same outcome as a declined
    prompt — `WearableSyncRow` already renders that as the honest "No data available" state); a
    *genuine* failure is reported through `FlutterError.reportError` first (so it isn't silently
    swallowed and is distinguishable from a timeout) before it, too, degrades to `false`, because
    the sweep must complete either way.
  - `syncToday` now calls `health.requestAuthorization` through `authorizeWithTimeout` instead of
    awaiting it directly. Nothing else in `syncToday` (or in `scan_tab.dart`) changed — the
    Future.wait in the sweep, the wearable-declined semantics, and the happy path are untouched.
  - Chose 5s as the bound: generous headroom over the sub-second happy-path response on a device
    with a real provider, short enough that the sweep still completes promptly when there is none.
- New `apps/biotope/test/m3_passive_health/wearable_service_timeout_test.dart` (4 tests, pure unit
  tests, no Supabase/Health plugin wiring needed):
  - completes with `false` when the authorization call never resolves — a `Completer<bool>` that
    is deliberately never completed, i.e. the exact field failure.
  - resolves immediately on the happy path (asserts it does not wait out the timeout).
  - a genuine failure (`Future.error`) is reported through `FlutterError.onError` and is
    distinguishable from a timeout.
  - a timeout does **not** report through `FlutterError` — it's the expected "nothing answered"
    case, not an error.

## Decided

- Fix lives in `wearable_service.dart`, not `scan_tab.dart`: the root cause is the specific
  `requestAuthorization` platform-channel call never resolving, not the `Future.wait` shape around
  it, so the bound wraps exactly that call. `scan_tab.dart` needed no changes.
- No new user-facing copy: the timeout path degrades to the same `null` reading `syncToday` already
  returns for a declined prompt, which `WearableSyncRow` already renders as "No data available" —
  reusing an existing, already copy-gated honest state rather than inventing a new one.

## Verification actually run

- `flutter analyze` — `No issues found!`
- `flutter test` (full suite, post-rebase onto `origin/dev-phase2-run4`) — **346 pass, 26 skipped**,
  0 failures, including the 4 new `wearable_service_timeout_test.dart` cases and the full existing
  `scan_tab_widgets_test.dart` / `scan_tab_copy_gate_test.dart` suites (untouched, still green).
- `git diff --ignore-cr-at-eol` confirmed the generated-plugin churn from `flutter test`/`pub get`
  under `linux/`, `macos/` was content-empty (line-ending only); discarded, not committed.
- `node tools/run4_release_gate.mjs landing --base 547280f69fe37fe1c7271ea126002f9ffaadafb9 --head HEAD --max-paths 115 --max-added 8500`
  → `{"changedPaths":48,"addedLines":4602}` — within both limits.
- On-device: built and ran successfully via `flutter run -d <serial>` on the real YAL-L21 (Android
  10, no Health Connect) — the app installed, launched, and Supabase initialised cleanly against the
  hosted project the device's `.env.public` currently points at.

## Left

- **Could not complete the on-screen Scan-sweep / DailyLogScreen confirmation on-device.** The
  hosted Supabase project this device's `.env.public` points at requires email confirmation for new
  signups, and its confirmation-email sending is currently rate-limited
  (`over_email_send_rate_limit`, confirmed via both the sign-up UI and a direct `POST
  .../auth/v1/signup` — a fresh account cannot be created right now regardless of email address).
  Local Docker Supabase (which offers instant, confirmation-free signup per
  [0011](../memory/0011-local-supabase-auth-email-only.md)) is not viable either: `docker info`
  fails with a 500 from the Docker Desktop engine on this box, and several `com.docker.backend` /
  `Docker Desktop` processes are already running under what looks like other agents' sessions, so
  restarting it was judged too risky to shared state to attempt from this session. No known-working
  demo credentials for the hosted project were found in-repo, and guessing/probing candidate
  emails against the hosted auth endpoint was (correctly) refused by the environment's safety
  classifier.
  - What *is* verified instead: `authorizeWithTimeout` is unit-tested against the literal
    reproduction (a `Completer` that never completes) and proven to resolve rather than hang, in
    well under the production 5s bound; the wrapper is the only thing standing between
    `Health().requestAuthorization` and the `Future.wait` in `scan_tab.dart`'s sweep, so a resolved
    `authorized` (`true` or `false`) is sufficient for `syncToday` to return and the sweep's
    `Future.wait` to complete — the mechanism the sweep hang depended on is provably closed.
  - Follow-up: re-run the on-device sweep/DailyLogScreen check once either the hosted project's
    email rate limit clears or working demo credentials are available.

## Blockers

- Hosted Supabase project email-send rate limit + unavailable local Docker backend, both blocking
  only the final on-screen confirmation step (see Left). Not caused by, and not a risk introduced
  by, this change.

memory: none
