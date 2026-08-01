---
title: "Session: biomech-botanical UI reskin — part 1 (foundation)"
summary: First slice of the biotope UI reskin from a Claude Design hi-fi prototype (biomech-botanical/gold-porcelain theme) — gold token system, WakingScreen, MetricTile widget. Scan/Insights-deck/Archive/Profile/app_shell rewire deferred to a follow-up session (continuation plan below).
type: session
scope: biotope
status: canonical
updated: 2026-07-27
---

# Session: biomech-botanical UI reskin — part 1 (foundation)

Issue: [#174](https://github.com/uandiqueue/ourobion/issues/174)
Branch: `feat/m1-ui/biomech-botanical-reskin` (worktree, cut from `dev-phase2-run4` — PR targets
`dev-phase2-run4`, not `dev-phase2`, per explicit user instruction for this run).

## Context

User is redesigning the biotope app UI in a "biomechanical botanical garden" theme and had a Claude
Design hi-fi interactive prototype built (`claude.ai/design` project
`df5bfd3e-58d9-420c-852f-2aaf9125892b`, file `Biotope Biomech Botanical.dc.html`). Asked to fit that
design onto the real system infrastructure (metrics, insight engine, module boundaries) rather than
reskin blindly, and to scaffold as much as possible — final data wiring/polish deferred until "the
system is completed."

## Attempted

Read the full `.dc.html` mockup + its `data-dc-script` state model via `DesignSync` (project
`df5bfd3e-58d9-420c-852f-2aaf9125892b`). Researched real infra via an Explore agent: module
inventory, `app_shell.dart` nav (confirmed Squad/World are non-functional `_PlaceholderTab` stubs),
`InsightCard`/`InsightProvenance` shape (`branch`: agree/research-context/idiosyncratic/contradiction
— honest, not a raw percentage), `log_completeness` (DQS), metric registry keys, `copy_guidelines.dart`.
Drafted a file-by-file plan with a Plan subagent, corrected against actual code (module-boundary
rules in `docs/shared/agent-protocol.md` — no cross-module `/impl` imports, index.dart barrels only).
Got explicit user sign-off on 3 architectural forks: (1) fully adopt the new 5-tab IA (Home/Scan/
Insights/Archive/Profile), dropping the Squad/World stubs; (2) make the gold palette canonical,
keeping green/blue as semantic-only trend-delta colors; (3) build the Insights deck for the real
branch/confidenceScore data shape, not the mock's fabricated percentages.

## Changed

- `apps/biotope/lib/core/theme.dart` — `OurobionColors.primary`/`primaryContainer`/`primaryFixed`/
  `primaryFixedDim`/`onPrimaryContainer` repointed to the gold ramp (`#A87840` family); added
  `brandGold`/`brandGoldLight`/`brandGoldDark`, `deltaPositive`/`deltaNegative` (old green/blue,
  semantic-only), `surfaceCard`, `kCardRadius`/`kButtonRadius`. `LivingBackdrop` and both auth
  screens needed zero code changes — they already read only `OurobionColors.*` tokens, no hardcoded
  hex, so they reskin for free.
- `docs/biotope/ui/ui-design-context.md` — updated as the new canonical source of truth: gold color
  tokens, new "Semantic-only colors (trend deltas)" section, tab bar line changed to
  Home/Scan/Insights/Archive/Profile, "Where Files Live" table updated for the cross-module shell,
  new "Reskin Reference Bundle" section pointing at the Claude Design project.
- `apps/biotope/lib/core/widgets/gold_card.dart`, `badge_chip.dart` (new) — shared card/pill
  primitives, extracted from patterns previously copy-pasted across `home_tab.dart`/`insights_tab.dart`.
- `apps/biotope/lib/modules/m1_core/ui/screens/waking_screen.dart` (new) — the mock's "Waking your
  biotope" transient screen; wired into `main.dart`'s `AuthGate` (`_checkOnboardingWithMinDisplay`
  races the real check against a 1.8s minimum so it never just flashes).
- `apps/biotope/lib/modules/m5a_baselines/ui/widgets/metric_tile.dart` (new) — Home-grid metric card
  (line/bars/progress sparkline variants), reuses `chart_math.dart`'s `valueBounds`/`normalizeValue`
  rather than re-deriving axis math.
- `flutter analyze`: clean (1 pre-existing unrelated warning, `.env.public` asset not present locally).

## Decided

1. **Nav IA**: fully adopt Home/Scan/Insights/Archive/Profile, dropping Squad/World from the shell
   entirely (user-approved — both were placeholder stubs, nothing real depends on them).
2. **Color system**: gold is now the canonical primary/brand token; old green (`#3c6752`)/cyan
   (`#2f647d`) survive only as `deltaPositive`/`deltaNegative`, never brand chrome (user-approved).
3. **Insight honesty**: the Insights deck (not yet built — see Left) must use `InsightProvenance.branch`
   for categorical confidence badges, not the mock's raw "86%"-style numbers (user-approved).
4. **Archive "saved" status**: no `InsightStatus.archived` value exists; plan is to reuse `snoozed`
   (relabeled "Saved" in UI copy) for both the deck's swipe-right and Archive's filter — not yet
   implemented, flagged here so the next session doesn't rediscover this gap.
5. **Scan gap-card answering**: mock's inline chip-answer-in-place is out of scope for scaffold — gap
   cards will route to the existing `DailyLogScreen` instead (the individual field pickers only
   return values into `DailyLogScreen`'s local draft state, no standalone persistence path).
6. Module-boundary compliance: all cross-module reads go through each module's `index.dart` barrel
   only (verified m1/m2/m3/m5a/m5b `index.dart` exports before planning file placement); same-module
   `/impl` access (e.g. Scan tab, which will live in m2, reading m2's own `normaliser.dart`) is fine.

## Left

**Not started** (tasks #7–#16 of the 18-task plan; task IDs refer to this session's task list):

7. Reskin `home_tab.dart`: gold hero card (System status/index/7-day delta), 2×2 `MetricTile` grid
   (sleep→`sleep_duration_min`, gut→`gut_comfort_score`, HRV→`hrv_sdnn_ms`, movement→`step_count`,
   all via `m5a_baselines/index.dart`), coverage card (`log_completeness` via `m2_self_report/index.dart`,
   routes to Scan), insights teaser (active `InsightCard` count via `m5b_insight_engine/index.dart`),
   decorative "knowledge base" ticker (static copy-compliant strings, explicitly not real telemetry),
   `RefreshIndicator` (copy the pattern already in `insights_tab.dart`), avatar button retargeted to
   navigate to the new Profile tab instead of triggering sign-out directly.
8. `apps/biotope/lib/modules/m3_passive_health/ui/widgets/wearable_sync_row.dart` (new `ui/` folder
   for m3) — read-only "last synced" row via `WearableService.syncToday` (m3's `index.dart`).
9. `apps/biotope/lib/modules/m2_self_report/ui/screens/scan_tab.dart` (new) — sweep dial, source rows
   (wearable via m3 index; self-report via same-module `getRow`; environment row rendered
   disabled/"coming soon" — `m4_environmental` is a deferred stub, do not fabricate sync data), gap
   cards derived from `kDailyCoreDqsWeights` (m2-internal, same-module import is fine) vs today's row,
   routing taps to `DailyLogScreen`.
10. `apps/biotope/lib/modules/m5b_insight_engine/ui/widgets/insight_card_visual.dart` — extract the
    category icon/color/badge rendering currently inline in `insights_tab.dart`'s `_InsightCardTile`
    so the new deck and Archive share it.
11. Add a status-parameterized fetch method to `insight_service.dart` (same-module edit) — current
    `getInsights` hardcodes `.eq('status', 'active')`; Archive needs a `snoozed` variant.
12. `apps/biotope/lib/modules/m5b_insight_engine/ui/widgets/insight_deck.dart` (new) — swipeable card
    deck (drag right = save/`snoozed`, drag left = dismiss), branch-based honest confidence badges
    (map `branch` → copy-compliant labels: agree→"Matches research", research-context→"Research
    context", idiosyncratic→"From your data", contradiction→"Mixed signal", null→"Building evidence"),
    expandable evidence (reuse `insight_provenance_screen.dart`'s evidence tiles rather than
    reinventing), empty-deck state.
13. Rewrite `insights_tab.dart` to use the new deck (keep `InsightService`/`watchInsights` wiring).
14. `apps/biotope/lib/modules/m5b_insight_engine/ui/screens/archive_tab.dart` (new) — snoozed-status
    list/grid using `InsightCardVisual`, tap-through to `insight_provenance_screen.dart`.
15. `apps/biotope/lib/modules/m1_core/ui/screens/profile_tab.dart` (new) — real `UserProfile` bindings
    via `ProfileService`, `backdrop`/`digest` toggles as local-only preferences (no backend field for
    either — `digest` especially has no `ConsentScope` mapping, flagged as a real open question for
    later, not silently fabricated), sign-out moved here from `home_tab.dart`.
16. `app_shell.dart` — delete `_PlaceholderTab`, wire the 5 finished tab screens, new
    `NavigationDestination`s/icons. **Do this last** — it's the step that actually cuts over
    navigation, so doing it after 7–15 are done keeps the app running on the old nav throughout.
17. `flutter analyze` (must stay clean) + run
    `apps/biotope/test/guards/copy_guidelines_parity_test.dart` once new copy constants exist.
18. Final session log for part 2 + `gh pr create --base dev-phase2-run4`.

**Known scaffolding gaps to carry forward (not silently fabricated):**
- Environmental sync row (Scan) — `m4_environmental` deferred stub, renders disabled only.
- `digest` toggle (Profile) — no real backend field found anywhere; local-only for now.
- `backdrop` toggle (Profile) — intentionally local-only, no backend field expected.
- Archive "saved" reuses `InsightStatus.snoozed` (see Decided #4) — a real `archived` enum value
  would need a DB migration, out of scope for a UI-only scaffold pass.
- Scan gap-card answering routes to `DailyLogScreen` rather than true inline chip-answering (see
  Decided #5).
- Home's "Knowledge base · live" ticker is decorative/static copy, not derived from real telemetry.

## Continuation prompt (paste into a fresh session to resume)

> Continue the biotope biomech-botanical UI reskin (issue #174, branch
> `feat/m1-ui/biomech-botanical-reskin`, worktree at `../ourobion-biomech-reskin` off
> `dev-phase2-run4`). Read
> `docs/sessions/20260727T200710Z-uandiqueue-claude-biomech-botanical-reskin-part1.md` (this file) in
> full — it has the complete plan, the decisions already approved by the user, and the exact list of
> remaining files (tasks 7–18). Start with task 7 (`home_tab.dart` reskin), then proceed in the listed
> order — task 16 (`app_shell.dart` rewire) must be last. Keep `flutter analyze` clean at every step.
> When done, run the copy_guidelines parity test, write a part-2 session log, and open the PR with
> `gh pr create --base dev-phase2-run4`.

## Blockers

None — clear path forward, just remaining implementation volume.

memory: none
