-- M5b: a real `archived` insight-card status (UI gap 4).
--
-- Until now the biotope Archive tab ("saved" = swipe-right on the Insights deck) had no status
-- of its own: it reused `snoozed` as a stand-in, because `snoozed` was the only non-`active`,
-- non-`dismissed` value the CHECK below allowed. That conflated two different user intents —
-- "put this away for now" (snooze) and "keep this" (archive) — and left the deck unable to ever
-- offer a genuine snooze. This migration adds the fourth value so the two can be told apart.
--
-- Additive-only, per sign-off decision D19 (shipped migrations are append-only even while
-- unreleased — never edited in place). The original inline CHECK in
-- 20260515110000_create_m5b_insight_cards.sql:30 stays exactly as it shipped; it is dropped and
-- re-added here by its Postgres-generated name.
--
-- ── DATA MIGRATION: DELIBERATELY NONE ────────────────────────────────────────────────────────
-- Existing `snoozed` rows are LEFT UNTOUCHED. No backfill, no UPDATE.
--
-- Rationale, stated explicitly rather than guessed: the app's only writer of `snoozed` was the
-- deck's swipe-right save handler (insights_tab.dart), so in practice every existing `snoozed`
-- row is a save — but `snoozed` is also a legitimate, user-meaningful status that the DB, the
-- shared contract and the edge function have all allowed since 20260515, and nothing in the row
-- records WHICH intent produced it. Rewriting user rows on a guess is not reversible; leaving
-- them is. So:
--   * new saves are written `archived` (the deck's swipe-right now targets `archived`);
--   * pre-existing `snoozed` rows stay `snoozed` and REMAIN VISIBLE in the Archive tab — the
--     Archive query widens from `status = 'snoozed'` to `status in ('archived','snoozed')`, so
--     no user loses a card they had saved;
--   * both values stay user-held in generate-insights' USER_HELD_STATUSES, so neither is ever
--     regenerated back to `active`.
-- If a later decision wants the old rows relabelled, that is its own migration with its own
-- reviewers.
--
-- ⚠ CROSS-LANGUAGE MIRRORS this value must stay in lockstep with (all changed in the same diff;
-- apps/biotope/test/m5b_insight_engine/insight_status_contract_test.dart fails if any drifts):
--   * shared/types/index.ts InsightCard.status  ← `shared/` contract type: PR NEEDS 2 REVIEWERS
--     (AGENTS.md §3 SHARED-CONTEXT / docs/memory/0002)
--   * apps/biotope/lib/modules/m5b_insight_engine/impl/insight_service.dart `InsightStatus`
--   * supabase/functions/generate-insights/index.ts `USER_HELD_STATUSES`

-- ═══════════════════════════════════════════════════════════════
-- 1. insight_cards.status — allow 'archived'
-- ═══════════════════════════════════════════════════════════════

-- `insight_cards_status_check` is the name Postgres generates for the inline column CHECK in
-- 20260515110000 (<table>_<column>_check). Dropped WITHOUT `if exists` on purpose: if the name
-- ever drifts, this migration must fail loudly rather than silently leave the old three-value
-- constraint in place alongside a same-named new one.
alter table public.insight_cards
  drop constraint insight_cards_status_check;

alter table public.insight_cards
  add constraint insight_cards_status_check
  check (status in ('active', 'snoozed', 'dismissed', 'archived'));

comment on constraint insight_cards_status_check on public.insight_cards is
  'active = servable; snoozed = held by the user (pre-archive stand-in, kept for existing rows); '
  'dismissed = never regenerated; archived = the user saved it to the Archive tab. '
  'Mirrored in shared/types/index.ts, insight_service.dart InsightStatus, and '
  'generate-insights USER_HELD_STATUSES.';

-- The RLS update policy (20260515110000:50-53) is value-agnostic — `using (auth.uid() = user_id)
-- with check (auth.uid() = user_id)` — so archiving needs no policy change. Verified, not assumed.
-- The (user_id, status) index likewise covers the new value with no change.
