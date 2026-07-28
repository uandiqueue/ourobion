---
title: "UI continuation — close the five scoped gaps from #175 and ship the full UI"
summary: "Gold/porcelain reskin completed: a real archived status across all four representations, device-local backdrop persistence, a sealed server-side digest preference, inline chip answering via a genuine partial update, and an honest close for the environmental row that has no data behind it."
type: session
scope: biotope
status: canonical
updated: 2026-07-28
---

# UI continuation — close the five scoped gaps from #175 and ship the full UI

Issue #188. Branch `feat/m1-ui/biomech-botanical-full`, cut from **PR #175's head** `5d1e177a…`
(biomech-botanical gold/porcelain reskin, owner-approved by Jayden and Alton). `origin/dev-phase2-run4`
was merged in mid-unit — see Decided.

## Attempted

Close the five gaps #175 deliberately scoped out, plus the manual click-through it left unchecked.

## Changed

44 paths / 6,230 added lines as the PR diff reads against `dev-phase2-run4`; of that, **29 paths /
2,981 lines are this unit's own gap-closure work** — the remainder is the R4-U2 merge pulled in
mid-unit.

- **Gap 1 · environmental row** — `scan_tab.dart` `EnvironmentRow`, `m4_environmental/index.dart`,
  `docs/biotope/ui/ui-design-context.md`.
- **Gap 2 · daily digest** — new `20260728040001_profile_daily_digest.sql`
  (`profile_notification_prefs` + two definer RPCs), `profile_service.dart`, `profile_tab.dart`,
  `user_profile.dart`, and a new `supabase/tests/profile_prefs/` harness.
- **Gap 3 · living backdrop** — `core/app_preferences.dart`, `main.dart`, `pubspec.yaml`/`.lock`.
- **Gap 4 · archived status** — new `20260728040000_insight_card_archived_status.sql`,
  `shared/types/index.ts`, `insight_service.dart`, `insights_tab.dart`, `archive_tab.dart`,
  `generate-insights/index.ts`.
- **Gap 5 · inline chips** — `scan_tab.dart`, `logging_controller.dart`.
- Plus `docs/graph/couplings.yaml`, `supabase/deploy-attestation.json` (re-recorded), and 8 test files.

## Decided

- **⚠ This diff needs TWO human reviewers.** `shared/types/index.ts` is a shared contract type
  (AGENTS.md §5, `docs/memory/0002`). Gap 4 cannot be done without it — the status union lives there.
  The owner directed the change after being told this, and states that **both Jayden and Alton approve
  the UI**, which is the two reviewers the rule asks for. Recorded here and in the code so the
  requirement travels with the diff rather than resting on a chat message.
- **Gap 1 closes with honest copy, not a working toggle.** `m4_environmental/index.dart` was a literal
  nine-line comment-only stub — no service, table, edge function or API anywhere. Wiring a switch to
  nothing would have been worse than the labelled gap #175 shipped. The row is now a single disabled
  semantics node reading "Not built" (a promise removed — no date exists), and a widget test asserts
  **zero** `GestureDetector`/`InkWell`/`Switch`/button in its subtree, so no later edit can quietly
  wire a dead control.
- **`origin/dev-phase2-run4` was merged in mid-unit, and it caught a real break.** #175's head predates
  R4-U2 by three commits, so U2's 443-assertion harness did not exist on this branch and could not be
  run. After merging, gap 2's original design — a `daily_digest_enabled` column on `public.profiles` —
  **failed 2 of 443**: `profiles` is on U2's hardcoded 15-table untouchable list
  (`20_probe_harness.sql:192-198`) and `70_non_regression.sql:102-121` diffs pre-U2 column privileges
  against current state. That would have shipped and broken the suite at integration time.
- **The obvious alternative was blocked too**, which only reading the assertions reveals:
  `nonreg.new_permissive_policies_only_on_the_two_new_tables` pins new PERMISSIVE policies at exactly
  **3**, so a new table carrying a user-facing RLS policy fails as well. The route through is the
  pattern R4-U3 established — a **new table with zero policies** plus **`SECURITY DEFINER` RPCs** that
  perform their own `auth.uid()` check. Neither RPC accepts a user id, enforced structurally by a test
  that fails if any overload ever takes a `uuid`.
- **Gap 4 is a four-way parity problem, and two of the four fail silently.** The status exists in the DB
  CHECK, the shared TS union, the Dart enum, and `USER_HELD_STATUSES` in `generate-insights`. Omit it
  from the last and the nightly regeneration re-upserts `status:'active'` over the user's own choice —
  every saved card quietly reverts. A missing Dart `_parseStatus` arm is silent too: it falls through to
  `active`. Registered as coupling `insight-card-status-four-way-parity` so the guard cannot be deleted
  as unused.
- **Existing `snoozed` rows are left untouched.** Every one is in practice a save, but nothing in the row
  records that intent; rewriting user rows on an inference is irreversible while leaving them is not. The
  Archive query widens to `status in ('archived','snoozed')` so nobody loses a card.
- **Gap 5 uses a genuine targeted `UPDATE`, not load-then-merge.** `saveDailyLog` is a whole-row upsert,
  so a naive inline answer would have nulled every other field in the day silently. Proven: swapping in a
  faithful naive stand-in fails 5 of 11 tests, headline
  `column "urine_colour" changed during a mood_score chip answer`.
- **Telemetry corrected**: an `archived` skip was incrementing `snoozedSkipped`, misreporting saves as
  snoozes. Now counted separately as `archivedSkipped`.

## Left

- **The manual click-through remains unverified** — the item #175 also left unchecked. A physical device
  is connected (YAL L21, Android 10), and `flutter test` runs fine, but any device build fails with
  `Building with plugins requires symlink support — please enable Developer Mode`. A machine setting,
  not a code defect; the same blocker R4-U0 recorded. Three things want human eyes once it is enabled:
  swiping the Insights deck, toggling the backdrop and relaunching to confirm it persists, and answering
  a Scan chip then checking the day's other fields survived.
- **Nothing sends a daily digest.** The preference now persists server-side; no composer or sender
  exists. The copy says so.
- **`EngagementService.updateOnLogWrite` now fires per inline chip answer**, matching `DailyLogScreen` —
  without it a Scan-tab coverage change would be invisible to M6 streaks. Correct, but it is an extra
  write per tap; batching is a reasonable follow-up.
- **`apps/nao/src/components/LoaderPanel.tsx` still returns 400** — R4-U3 made the loader `target`
  explicit and required. That is nao UI and outside this unit; recorded on #184.
- **The landing cap is exceeded**, as expected — the owner directed that it must not constrain UI scope.
- `TEST_MODE_LABEL` and biotope's provenance screen were not touched: that is O38 / deferred R4-U4
  territory, blocked on the same two-reviewer precondition. Note that if Alton is available to review
  `shared/` generally, **P2 is satisfiable and U4 becomes startable** — its other gates are already met.

## Blockers

None for this unit. Two environment limits stand: Developer Mode blocks device builds, and no CI job
invokes a Docker harness, so the 443-assertion and 34-assertion suites are recorded local evidence.

memory: none
