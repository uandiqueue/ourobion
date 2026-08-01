---
session: 20260802T031500Z-agent-j-claude-biotope-deck-recovery
agent: agent-j (Claude Opus 5, builder)
date: 2026-08-02
scope: apps/biotope/lib/modules/m5b_insight_engine, apps/biotope/test/m5b_insight_engine
---

# A swiped card had no way back

## What happened

On a physical device the owner swiped through the insight deck and dismissed 54 of 56 cards,
including the one research-backed card the demo rests on. Then none of them could be found.

That was the app working as written:

| gesture | status written | where the card then lives |
| --- | --- | --- |
| swipe right | `archived` | Archive tab ("SAVED") |
| swipe left | `dismissed` | **nowhere** |

`getInsights` filters `status = 'active'`; `InsightService.archiveStatuses` is
`['archived','snoozed']` and deliberately excludes `dismissed`; and `generate-insights` counts
dismissed cards in `dismissedSkipped`, so re-running the pipeline does not bring one back either.
Recovery required a manual `PATCH` against the database. On camera that is unrecoverable.

Two affordances close it. Neither touches `supabase/**`: the pipeline's `dismissedSkipped`
behaviour is unchanged, and the engine still never resurrects a dismissed card on its own. Both
writes go through the existing `Users can update own insight card status` RLS policy — the same
route the swipe already uses, no privileged path added.

## 1 · Remove a saved insight (Archive tab)

Every saved tile gets an undo button (`ArchiveTabCopy.removeTooltip`, confirmed via dialog).

**"Remove" writes `active` — back to the deck.** The two honest readings were `active` and
`dismissed`; this took `active` because:

* it is the exact inverse of the gesture that filed the card. Swipe-right wrote `archived` over
  `active`; un-saving writes it back. No new lifecycle value, no third state.
* `dismissed` is the unrecoverable status. Routing the *only* un-save affordance into it would
  push cards into the precise black hole this change exists to close.
* `active` stays reversible with no bulk action — the card is in the deck and one swipe re-saves it.

Nothing is hard-deleted. `insight_cards` is the record of what the engine served and provenance
hangs off the row; a delete could not be undone by the user either, which is the failure being
fixed.

**One caveat that changed the design.** `getInsights` applies an expiry cutoff, so returning an
*expired* saved card to `active` takes it out of the archive without putting it anywhere reachable
— the same disappearing act, from the other direction. Rather than promise a return that will not
happen, the confirmation reads the card's own `expires_at` and switches body copy:
`removeBody` for an in-window card, `removeExpiredBody` ("you will not see it in the app again")
for an expired one. The user can still cancel.

## 2 · Reset the weekly deck (Insights tab)

`InsightService.resetCurrentPeriodDeck(userId)` — a restore icon in the Insights header, behind a
confirmation dialog.

**Scope — "this period" is the card's own serving window.** `generate-insights` stamps
`expires_at = now + expiry_days` on every (re)generation and the composer uses
`COMPOSER_EXPIRY_DAYS = 7`, so the week is already recorded on the row. No new notion of a week was
invented. The predicate is character-for-character the one `getInsights` applies
(`expires_at is null OR expires_at > cutoff`), which makes the guarantee exact in both directions:
everything restored is something `getInsights` will then serve, and nothing past its `expires_at`
is matched, so it is not written at all. A test asserts the two requests carry an *identical*
`or=` parameter rather than two strings that happen to agree.

**Statuses restored** — `archived`, `snoozed`, `dismissed`: every value the `status` CHECK allows
except `active`, pinned against the parsed migration chain. `dismissed` is the one that mattered.
Restored saves leave the Archive tab until saved again, and the confirmation says so.

**It cannot create a row.** It is an UPDATE with a WHERE clause — no insert, no upsert — and the
patch body is exactly `{'status': 'active'}`, so it does not re-date or rewrite a card either. A
reset that could conjure a row would be inventing an insight.

It is a *user* action. Placed in the header rather than the empty-deck state because the incident
left two cards in the deck; an empty-only affordance would not have been reachable when needed.

## Copy shipped

All strings pass the shared non-diagnostic gate (`CopyRules.validateCopyString`).

* `ArchiveTabCopy`: `removeTooltip` / `removeTitle` / `removeBody` / `removeExpiredBody` /
  `removeConfirm` / `removeCancel` / `removeFailed`
* `InsightsTabCopy` (new): `resetTooltip` / `resetTitle` / `resetBody` / `resetConfirm` /
  `resetCancel` / `resetNone` / `resetFailed`, plus `resetDone(count)` — reported from the rows the
  update actually returned, never a predicted number. `resetNone` fires when nothing was in scope,
  instead of claiming a success that did not happen.

A gate test also asserts `resetBody` names all three things that surprise people: saved cards come
back too, cards past their window stay out, and no new cards are made.

## Tests

47 new (761 → 808 passing).

* `test/m5b_insight_engine/deck_recovery_service_test.dart` (19) — drives the **real** PostgREST
  query through an offline endpoint backed by an actual row store whose filter interpreter reads
  the request's own query string. Covers: dismissed/archived/snoozed recovery, expired rows left
  untouched, the minute-level boundary, identical `or=` with `getInsights`, PATCH-only (no
  POST/PUT/DELETE), unchanged row ids, single-column patch body, and `InsightCard.isExpiredAt`
  agreeing with `filterEmission` row for row.
* `test/m5b_insight_engine/deck_recovery_widget_test.dart` (20) — both affordances: confirm-before-
  acting, cancel writes nothing, the expired-card copy switch, the SAVED header following a restore,
  reported counts, and both failure paths.
* `insight_status_contract_test.dart` (+5) — `resettableStatuses` vs the parsed migration chain,
  plus a source-text guard that the reset body is a filtered UPDATE with no insert/upsert/delete
  and no column other than `status`.
* `insight_copy_gate_test.dart` (+3), `archive_tab_copy_gate_test.dart` (existing, widened via
  `ArchiveTabCopy.all`).

Mutation-checked: deleting the `.or(...)` expiry filter from the service fails 6 of the service
tests, so they bind to the real query rather than to the fixture.

## Gates

- `flutter analyze` — No issues found
- `flutter test` — 808 passed, 26 skipped (baseline before this change: 761 passed, 26 skipped)
- `context_sync --check` — passed
- `git diff --check` — clean

Not committed: local `pubspec.lock` drift (Flutter 3.44.1 resolves `meta` 1.18.0 / `test` 1.31.0
against a lockfile pinning 1.17.0 / 1.30.0) and CRLF-only churn in the generated plugin
registrants. Both are environment artefacts of running `pub get` on this machine, unrelated to this
change, and were reverted before staging.

memory: none
