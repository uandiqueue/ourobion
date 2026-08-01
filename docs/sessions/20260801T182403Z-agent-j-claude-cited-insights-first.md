---
title: Cited insights lead the deck — one comparator for every M5b read path
summary: The insight deck had no ordering at all (`getInsights` had no `.order()`, `watchInsights` mapped the emission straight through), so on the live 44-card demo user the single `producer='edge'` cited card could land anywhere among ~41 `personal` and 2 `rules` cards. Added `InsightService.compareForDeck` / `sortedForDeck` — research-linked first, then confidence desc, generatedAt desc, id desc — and routed all three read paths through it. Sorted in Dart, not PostgREST, because the predicate is a conjunction over `producer` and a jsonb array's emptiness and the stream's `.order()` is single-column. Nothing is filtered out.
type: session
scope: shared
status: canonical
updated: 2026-08-01
---

# Cited insights first (M5b · insight deck ordering)

Branch: `feat/biotope/cited-insights-first`; base and exact head at branch cut: `5d2d39e`
(`origin/main`); device: `agent-j`; agent: `claude` (Opus 5, 1M context). Isolated git worktree; the
main checkout was not touched (a Flutter build was running there).

Territory: `apps/biotope/lib/modules/m5b_insight_engine/impl/insight_service.dart`,
`apps/biotope/test/m5b_insight_engine/insight_deck_order_test.dart` (new), this log.

## Attempted

Owner request: "ensure cited insights are shown first in the deck". Ordering only — no card is
removed, hidden, or demoted out of the deck.

## Confirmed, before changing anything

- **There was no ordering anywhere.** `getInsights` built its PostgREST query with `.eq(...)` /
  `.or(...)` and no `.order()`; `watchInsights` mapped each emission through `filterEmission` and
  returned it as-is; `getArchivedInsights` likewise. Card order was therefore whatever PostgREST
  happened to return, and it is not stable across requests.
- **The predicate already existed.** `InsightCard.isResearchLinked` is
  `producer == InsightProducer.edge && edgeRefs.isNotEmpty` — a conjunction, not just the producer
  column. An `edge` row whose `edge_refs` came back empty renders no citation affordance
  (`insight_deck.dart` gates the citation block on `isResearchLinked`), so leading the deck with one
  would put an uncited card at the head.
- **The deck reads index 0 first** (`insight_deck.dart`: `widget.cards[_idx]`, `_idx` starting at 0),
  and the widget never re-sorts, so list order *is* deck order.
- **`home_tab.dart` also calls `getInsights`** but only uses `insights.length`, so it is unaffected.
- **`SupabaseStreamBuilder.order()` cannot express the rule** (`supabase-2.10.6`,
  `supabase_stream_builder.dart`): it takes ONE column, and for realtime deltas it re-sorts the
  in-memory list itself (`_sortData`) with a raw `num`/`String` compare that returns 0 for anything
  else — a jsonb column would silently order as all-equal.

## Changed

### `insight_service.dart` — one comparator, three call sites

- **`static int compareForDeck(InsightCard a, InsightCard b)`** — the ordering rule:
  1. `isResearchLinked` first;
  2. `confidenceScore` descending;
  3. `generatedAt` descending;
  4. `id` descending.
- **`static List<InsightCard> sortedForDeck(List<InsightCard>)`** — returns a NEW list
  (`List.of(cards)..sort(...)`), so no caller's list is mutated.
- `getInsights`, `watchInsights` and `getArchivedInsights` all return through `sortedForDeck`.
  `watchInsights` applies it to `filterEmission`'s output, so the sort re-runs on every emission.

`filterEmission` itself is unchanged: it stays a pure *filter* with its own A27 contract tests, and
ordering is applied around it. That keeps the existing expiry tests asserting exactly what they were
written to assert.

## Decided

- **The tie-break is confidence, not severity, and it terminates in the primary key.**
  `generate-insights` hardcodes `severity: 'info'` for every edge and personal card (only `rules`
  cards carry a rule's severity), so severity is near-constant across a live deck and would sort
  almost nothing; and floating a low-confidence `watch` above a high-confidence card would work
  against the change itself. Confidence descending is the same idea as "cited first" continued one
  step: after *which cards are cited*, the next question is *how strongly is this one backed*.
- **The comparator is a TOTAL order on purpose.** `List.sort` carries no stability guarantee, so a
  comparator that returned 0 for two distinct cards would let the deck reorder itself between two
  sorts of the same rows — which reads as a bug. Exact ties are ordinary here, not a corner case:
  the nightly pass writes a whole batch with one `generated_at`, and `confidence_score` is rounded
  to 3 dp. `id` (bigserial PK) is unique, so the fourth key makes ties impossible.
- **Sorted in Dart, not with PostgREST `.order()`.** Server-side ordering is the usual right answer
  and `producer` / `edge_refs` are real columns — but `isResearchLinked` is a conjunction over
  `producer` AND a jsonb array's emptiness, which is not an orderable expression without a generated
  column or a view (a live migration), and the stream path could not honour it anyway (single
  column, client-side re-sort of deltas). The trade-off accepted: the client sorts ~44 rows per read
  instead of the database doing it, in exchange for the one-shot fetch and the realtime stream
  producing a bit-identical deck from one comparator.
- **The archive is ordered with the same comparator.** It is a list, not a deck, so "cited first" is
  less load-bearing there — but it was previously served in arbitrary PostgREST order, which is the
  same defect, and there is no `saved_at` column to offer the more natural "most recently saved
  first". Reusing the comparator also keeps a saved card in the same relative position the user last
  saw it in.
- **Nothing is filtered.** `producer='personal'` "still researching" cards remain in the deck; they
  now follow the cited card instead of preceding it by luck. Three tests assert output length, the
  id set, and the continued presence of `isStillResearching` cards.

## Tests

New `apps/biotope/test/m5b_insight_engine/insight_deck_order_test.dart` (19 tests):

- cited-first on a live-shaped deck (1 edge / 3 personal / 2 rules, cited card buried mid-list);
  a 0.42-confidence cited card still beats a 0.99 uncited one; the cited tier is a contiguous
  prefix; an `edge` card with EMPTY `edge_refs` does **not** lead.
- tie-break: confidence desc; severity explicitly does not participate; equal confidence falls
  through to the fresher card; all-equal soft keys still give a fixed order (`id` desc); the
  comparator never returns 0 for two distinct cards (checked pairwise); four different input
  permutations produce the identical deck; sorting is idempotent and does not mutate the input.
- ordering-only: length and id-set preserved, `isStillResearching` cards still present, empty deck
  stays empty.
- source-text guard (same technique as `insight_status_contract_test.dart`): all three read-path
  bodies contain `sortedForDeck(`, none hand-rolls its own `.sort(`, and `insight_deck.dart` still
  renders `widget.cards[_idx]` with no sort of its own.

## Gates

- `flutter analyze`: **No issues found.**
- `flutter test` (full suite): **+780 ~26, all tests passed** (761 before, plus the 19 new).
  The first attempt reported 6 "did not complete" timeouts in
  `test/m1_core/coverage_card_truthfulness_test.dart` — that file passes in 1 s on its own
  (`+10, All tests passed`) and imports nothing this change touches; it was machine load (a Flutter
  build was running in the main checkout). Re-running with `--concurrency=2` is green.
- `node tools/context_sync.mjs --check` passed; `git diff --check` clean.
- `flutter pub get` in a fresh worktree rewrites `pubspec.lock` (a missing `ourobion_metrics` path
  entry plus `meta`/`test` bumps) and re-emits the linux/macos generated plugin registrants as
  CRLF. None of that is part of this change, so all five files were reverted before committing.

## Left

- **Not verified against the hosted database.** The reasoning about the live 44-card mix comes from
  the dispatch brief, not from a query run here (no DB access from the worktree). The ordering is
  data-independent, but "the cited card is now on top for the demo user" is only true if that user
  still has exactly the one `producer='edge'` row.
- **`confidence_score` is not the same quantity across producers** — edge cards carry `edge_score`,
  personal cards carry `|rho|`. Within the cited tier that is like-for-like, and the uncited tier is
  dominated by personal cards, so the comparison is mostly fair; but a future mixed tier would be
  ranking two different scales against each other. Worth revisiting if `rules` cards ever grow real
  confidence values.
- **`pubspec.lock` is stale on `main`** — it does not list the `ourobion_metrics` path dependency
  that `pubspec.yaml` declares, so every fresh `flutter pub get` dirties it. Left alone (out of
  scope), but it will keep showing up as phantom churn for anyone working in a new worktree.

memory: The M5b insight deck had NO ordering on any read path (`getInsights` had no `.order()`,
`watchInsights` mapped emissions straight through) — cards arrived in arbitrary PostgREST order, so
the single cited card among 44 could appear anywhere. Fixed with ONE comparator,
`InsightService.compareForDeck` + `sortedForDeck`, used by `getInsights`, `watchInsights` AND
`getArchivedInsights`: `isResearchLinked` first, then confidence desc, generatedAt desc, `id` desc.
The `id` key is not decoration — `List.sort` is not stable in Dart, and the nightly pass writes
batches sharing one `generated_at` with 3-dp confidences, so a partial order would visibly reshuffle
the deck between rebuilds. Severity was rejected as the tie-break because generate-insights
hardcodes `severity: 'info'` for every edge and personal card. Sorted in DART, not PostgREST:
`isResearchLinked` is `producer == edge && edgeRefs.isNotEmpty` (a jsonb-emptiness conjunction, not
an orderable column), and `SupabaseStreamBuilder.order()` is single-column and re-sorts realtime
deltas client-side with a raw num/String compare. Nothing is filtered — `personal` "still
researching" cards stay in the deck.
