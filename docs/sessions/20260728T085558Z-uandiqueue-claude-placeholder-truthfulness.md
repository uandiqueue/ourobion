---
title: Placeholder truthfulness sweep — fabricated numbers, dead controls, untrue copy
summary: Removed fabricated step counters and a dead password link, replaced untrue onboarding promises with statements matching what exists, made the insight deck's replay and SAVED count read Supabase instead of local state, and deleted an orphaned placeholder screen.
type: session
scope: shared
status: canonical
updated: 2026-07-28
---

# Placeholder truthfulness sweep — fabricated numbers, dead controls, untrue copy

Branch: `fix/m1-ui/placeholder-truthfulness`

Fixes a verified audit list of UI surfaces that presented something the app cannot
back: fabricated numbers, controls that could not act, copy describing features this
repo does not contain, and screen state that drifted away from Supabase.

memory: none

## Attempted

- Delete fabricated numbers rather than invent real ones to replace them.
- Make every onboarding sentence true of code that exists in this repo today.
- Remove controls that cannot act instead of leaving them styled and enabled.
- Point the Insights header and the empty-deck action at Supabase, not at local state.
- Pin each fix with a regression test, because all three defects the previous session
  shipped passed `flutter analyze` and the whole widget suite.

## Changed

### Tier 1 — fabricated numbers

- **`urine_color_screen.dart`, `stool_form_screen.dart`** — deleted the hardcoded
  `'01 / 08'` / `'02 / 08'` step counters. There is no eight-step flow: `DailyLogScreen`
  is one scrolling form that pushes four optional detail screens. Deleted rather than
  derived — a real position/total would be a number nobody asked for, describing a wizard
  that does not exist. The back control stays.

### Tier 2 — dead controls and untrue copy

- **`sign_in_screen.dart`** — removed the "Forgot password?" `TextButton`. It was fully
  styled and enabled with `onPressed: () {}` on the first screen of the app. Password
  reset needs mail delivery this project cannot verify, and `AuthService` has no reset
  path, so the affordance is gone rather than faked.
- **`profile_tab.dart`** — the 22pt heading no longer falls back to `'Biome'`. It renders
  the display name, else the account email, else `ProfileTabCopy.noNameSet`
  ("No name set"). The small email line is suppressed when the email is carrying the
  heading. A name-shaped literal in that slot is indistinguishable from a name the user
  chose.
- **`consent_screen.dart`** — all copy moved into a gated `ConsentScreenCopy` set, and
  three untrue claims replaced:
  - "You can update or withdraw consent any time in Settings." → now says the choices are
    recorded on continue and that changing them later is not built into the app yet. No
    settings or consent-management screen exists; the Profile tab never touches
    `ConsentService`.
  - "...by contacting us through the app" → now states the right and says plainly the app
    has no way to send the request yet. There is no mail link, support screen or form in
    `lib/`.
  - `'Coming soon — sync data from fitness trackers'` behind `onChanged: null` was the
    **inverse** of the truth: wearable reading is live (`WearableService.syncToday` →
    `wearable_daily`). The row is now a statement, not a control, naming the real gate —
    the phone's own health-data permission.
- **`sign_up_screen.dart`** — dropped "By continuing you agree to our Terms and Privacy
  Policy." No such document, route or tap target exists. The remaining sentence ("You'll
  set your data permissions in the next step.") is true of `AuthGate`.

### Tier 3 — state that drifted from Supabase

- **`insight_deck.dart`** — `_resetDeck()` now awaits a required `onReplay` callback that
  re-reads `InsightService.getInsights`, then zeroes the index against what came back. It
  used to rewind `_idx` only, resurrecting cards whose row already read
  `archived`/`dismissed` and serving them as fresh swipeable insights. The button label
  followed the implementation: `InsightCardCopy.replayDeck` is now "Check for new cards".
- **`insights_tab.dart`** — the SAVED header re-reads `getArchivedInsights` after a save
  instead of `_savedCount += 1`. The status write is an idempotent UPDATE, so re-saving an
  already-archived card moved the counter without moving a row; the header drifted above
  the true archive size and never re-synced within the session.

### Tier 4 — cosmetic

- **`home_screen.dart`** — deleted. Orphaned placeholder ("Temporary home screen",
  "Home screen — coming soon.", three `[DEV]` buttons) with zero references outside
  itself; `main.dart` routes SignIn → Consent → ProfileSetup → `AppShell`. Stale
  references in `m1-context.md` / `m2-context.md` updated.
- **`badge_chip.dart`** — `BadgeChip.disabled` now REQUIRES `label`. The
  `'Coming soon'` default was one omitted argument away from rendering a delivery promise.
- **`scan_tab.dart`** — `_openGap(String key)` discarded its key, so the tap on a card
  naming one metric opened the whole form. `DailyLogScreen` has no focus seam, so the
  parameter is gone and the card states its destination instead
  (`ScanTabCopy.gapOpensFullLog`). Scope kept small — PR #205 just landed here.
- **`profile_tab.dart`** — corrected the `DailyDigestToggle` doc comment. It claimed the
  digest persists via `updateProfile` to `profiles.daily_digest_enabled` with "no second
  write path"; the real path is `setDailyDigestEnabled` → RPC over
  `profile_notification_prefs`. The rendered copy was already correct. Also fixed the
  stale `profile_copy_gate_test.dart` path in the `ProfileTabCopy` header (the gate lives
  in `profile_digest_test.dart`).

### Tests

- New `test/m1_core/onboarding_truthfulness_test.dart` — 17 assertions over the sign-in,
  sign-up, consent, profile and self-report surfaces: the copy gate over
  `ConsentScreenCopy`, absence of the step counters and the `'Biome'` literal, absence of
  a Settings promise / in-app contact claim / Terms reference, that the wearable consent
  row renders no switch or tap target and records no consent value, that no button has an
  empty callback, and that `BadgeChip.disabled` requires its label. It parses source with
  comments stripped, so the reasoning at each deletion site cannot fail the test that
  pins the deletion.
- `archive_status_widget_test.dart` — its fake is now stateful and models the idempotent
  status UPDATE, so an honest re-read is distinguishable from a local increment. Existing
  assertions kept; added the re-read assertion, a no-drift-on-double-save test, and two
  empty-deck tests (a held card does not come back; a newly generated card does).
- `scan_tab_widgets_test.dart` — a whole-card tap-through must state its destination, and
  an inline-answerable card must not.

## Decided

- **Deleted the step counters rather than deriving real ones.** A truthful absence beats a
  derived number nobody asked for, and there is no flow for a position to describe.
- **The wearable consent row is a statement, not a switch.** Nothing in this repo reads
  `ConsentScope.wearableData`, so a switch there would be a control whose "off" position
  did not stop the collection it appears to govern — worse than no control. Making it gate
  `syncToday` would change demo data flow and needs the owner (below).
- **Stopped recording `wearable_data` consent at all.** The screen appended a
  `granted: false` record for the scope while the sync ran, so the append-only record
  stated the opposite of the app's behaviour. Writing nothing is truthful; writing `false`
  was not. `communityData: false` stays — that one is accurate, M7 collects nothing.
- **Corrected a test rather than preserved its buggy expectation.** The old
  "increments on save" assertion pinned the optimistic counter. The replacement is
  strictly stronger: same rendered outcome, plus the re-read and the idempotency case.

## Left

Two items flagged for the owner, deliberately unchanged:

1. **`insight_card_visual.dart:52` — `if (score >= 1.0) return 'High confidence'`.**
   Current buckets: `>= 1.0` High, `>= 0.66` Medium, `>= 0.33` Low, else "Building data".
   A real 0.9 card renders "Medium confidence", which looks like an off-by-one against the
   0.66/0.33 spacing. Fixing it RAISES confidence labels on served health claims.
   Recommendation: treat as an owner decision with two-reviewer review; if changed, the
   consistent boundary is `>= 0.99` or a re-spaced set, not a silent bump.
2. **`daily_log_screen.dart:117` — `WearableService(client).syncToday(userId).ignore()`
   fires on screen render.** This contradicts the documented rule at
   `wearable_sync_row.dart:7-14` ("never surprise-prompt permissions just from a screen
   render") and is a real provenance concern. Recommendation: move it behind an explicit
   action as Scan already does — but not hours before a demo, since it changes when data
   arrives.

Not touched, correct by design: `EnvironmentRow`'s inert "NOT BUILT" row, and the honest
empty states (`'—'`, `'No data yet'`, `'Building baseline'`, `'No streak yet'`).

Also left: the consent screen now says out loud that consent choices cannot be changed
in-app and that no in-app route exists for a data access/correction/deletion request.
Both are real PDPA gaps that need an affordance, not just honest copy. Recorded in
`m1-context.md`.

## Blockers

- `gh issue create` and `gh pr create` were blocked by the local permission classifier, as
  were direct `psql` reads against the local stack. The branch is pushed; the PR into
  `dev-phase2-run4` needs to be opened by a human or an unblocked session.
