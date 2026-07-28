---
title: Run 4 canonical full-UI integration onto the reconciled gate base
summary: Brought the reconciled Run 4 landing-gate base into the canonical full-UI unit, verified the auto-merged attestation was correct rather than merely conflict-free, and re-ran the Flutter, authorization, and profile-preference suites.
type: session
scope: shared
status: canonical
updated: 2026-07-28
---

# Run 4 canonical full-UI integration onto the reconciled gate base

Issue: #198

Branch: `feat/m1-ui/biomech-botanical-full` (PR #191)

This is Step G of the Run 4 continuation queue. The UI work itself was authored in the two earlier
reskin sessions on this branch; this session integrates it onto the reconciled base and verifies it.

## Attempted

- Merged the reconciled landing-gate base (Step A / PR #197) into the canonical UI branch.
- Verified the resulting `supabase/deploy-attestation.json` was semantically correct, not merely
  free of textual conflict.
- Re-ran every gate the changed surfaces require.
- Checked the `archived` status contract across all four of its mirrors.

## Changed

- One merge commit bringing `ci/run4-unit-base-advance` into the UI branch.
- **Two defects found by physical-device traversal and fixed**, with regression tests:
  - `home_tab.dart` / `metric_tile.dart` — the Home signals grid sized its cells with
    `childAspectRatio: 1.3`, deriving the cell **height** from the tile **width**. A `MetricTile`'s
    content height is fixed, so the cell was too short: the device showed
    `BOTTOM OVERFLOWED BY 9.5 PIXELS` on all four tiles, and the shortfall grows as the screen
    narrows. Replaced with a fixed `mainAxisExtent` (`kMetricTileExtent`) and made the tile's visual
    `Flexible` so it compresses rather than overflows.
  - `profile_tab.dart` — `_load()` had no error handling. Any read failure escaped, `_loading` was
    never cleared, and because the tab is kept alive in the shell's `IndexedStack` the spinner was
    permanent **for the whole session** even after the backend recovered; only force-stopping the
    app cleared it. Added a catch that clears `_loading`, a distinct `_loadFailed` state with
    user-visible copy, and an explicit retry.

## Decided

- **The UI unit never breached the landing budget.** Its own diff is 6,334 added lines across 45
  paths. The 13,449 figure came entirely from the stale gate base. On the reconciled base the
  landing delta is **49 paths / 6,436 added lines**, inside 115 / 8,500 with room to spare. Nothing
  was split, trimmed, or deferred to fit.
- **The attestation merge was checked, not trusted.** `supabase/deploy-attestation.json` was edited
  on both sides — the UI branch changed the `generate-insights` entrypoint and module-graph hashes,
  Step A changed `provenance.unitBaseSha`. Git auto-merged them without conflict, which proves
  nothing on its own. Re-running `attest` against freshly regenerated Deno graphs confirmed the
  merged file carries both the new base SHA and the correct post-UI function hashes.
- **Deferred: the raw `edgeId` provenance string.** `insight_card_visual.dart:174` renders
  `ref.edgeId` verbatim in the expanded provenance section, e.g.
  `sleep_duration_min->gut_comfort_score`. This is honest but not ordinary-user language. It is
  O28 work (plain-language provenance), which the continuation cockpit explicitly keeps partly
  deferred, and the orchestrator prompt states O28 is not complete merely because the reskin added
  accessibility work. Recorded rather than patched, to avoid expanding this unit's scope.

## Verification actually run

macOS, `deno 2.8.1`, repository-local Supabase CLI `2.81.2`, disposable `postgres:17` containers.

| Gate | Result |
|---|---|
| `flutter analyze` | `No issues found!` |
| `flutter test` (before the two fixes) | 176/176 pass — **and both device defects still shipped** |
| `flutter test` (after) | **190 pass, 1 skipped** (the recorded O28 gap) |
| Physical Android traversal (Samsung SM-A165F, 1080x2340) | sign-in → consent → profile setup → all five tabs; overflow reproduced, fixed, and re-verified on device |
| `supabase/tests/authz/run.mjs` (U2 regression) | **443/443 assertions pass**, 0 fail (min required 350) |
| `supabase/tests/profile_prefs/run.mjs` | **34/34 assertions pass**, 0 fail (min required 30) |
| `node tools/run4_release_gate.mjs attest` (fresh graphs) | `run4 local runtime attestation: PASS` |
| `node tools/run4_release_gate.mjs landing` | 49 paths / 6,436 added lines — inside 115 / 8,500 |
| `node --test tools/run4_release_gate.test.mjs` | 9 pass, 0 fail |
| `node tools/run4_release_gate.mjs config` | `run4 config/workflow gate: PASS` |
| `node tools/context_sync.mjs --check` | passed |

### `archived` status contract parity

The shared-contract comment warns that a status missing from `USER_HELD_STATUSES` is silently
un-held and regenerated back to `active` by the nightly pass. All four mirrors were checked and
agree:

- `shared/types/index.ts:110` — `'active' | 'snoozed' | 'dismissed' | 'archived'`
- `supabase/migrations/20260728040000_insight_card_archived_status.sql:52` —
  `check (status in ('active', 'snoozed', 'dismissed', 'archived'))`
- `apps/biotope/.../impl/insight_service.dart:34` — `enum InsightStatus { active, snoozed, dismissed, archived }`
- `supabase/functions/generate-insights/index.ts:136` — `new Set(["dismissed", "snoozed", "archived"])`

## Left

- **Two human reviewers are still required** on the `shared/types/index.ts` `InsightCard.status`
  change before merge. Jayden and Alton are the named reviewers. Test evidence does not substitute
  for that review.
- PR #175 must be closed as superseded; its head `5d1e177` is confirmed an ancestor of #191's head,
  so landing both would duplicate the work.
- The raw `edgeId` provenance string, as recorded above.
- **`MetricTile` still overflows at a 1.6x accessibility text scale** — 17px horizontally (the value
  row) and 15px vertically. This is a pre-existing limitation of the tile's fixed type scale, not
  the grid-sizing bug fixed here, and it reproduces independently of how cells are sized. Fixing it
  means reworking the tile's typography, which is deferred O28 work. Left as an explicitly **skipped
  test with the reason in its name**, so the suite records the gap rather than hiding it.
- **`tools/rules` cannot run on a clean clone**: `shared/rules/rule.schema.ts` imports `zod`, but
  `zod` is declared in neither `tools/rules/package.json` (only `pg` + `tsx`) nor the repo root.
  `node tools/rules/load_rules.mjs` fails with `Cannot find module 'zod'`. Pre-existing and unrelated
  to this PR — worked around locally with an uncommitted `npm install --no-save zod`. Needs its own
  fix; it blocks local insight-engine seeding.

## Blockers

- PR #197 (the gate base advance) is green on all 19 checks but its merge is pending human action.
  Its content is already merged into this branch, so this unit's verification is unaffected.

memory: none
