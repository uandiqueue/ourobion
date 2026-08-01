// Deck order: research-backed (cited) cards lead, and the rest of the deck has
// a deterministic order.
//
// Before this, neither read path ordered at all — `getInsights` had no
// `.order()` and `watchInsights` mapped the emission straight through — so the
// deck arrived in whatever order PostgREST happened to return. On the live demo
// user that is 44 active cards of which exactly ONE is research-linked, so the
// single cited card could land anywhere in the stack.
//
// Two things are pinned here:
//   * the primary key — `isResearchLinked` first (edge producer AND at least
//     one edge_ref; a bare `edge` row with no refs has no citation to show);
//   * the tie-break is a TOTAL order. `List.sort` is not documented as stable,
//     so a comparator that returned 0 for two distinct cards would let the deck
//     reshuffle between rebuilds. Ties resolve confidence desc → generatedAt
//     desc → id desc, and `id` is unique.
//
// Also asserted: ordering never DROPS a card. "Still researching" personal
// cards stay in the deck; this is ordering only.

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:src/modules/m5b_insight_engine/impl/insight_service.dart';

import '../guards/guard_support.dart';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/// A card built straight from the constructor — the comparator reads the model,
/// not the wire, so there is no need to go through `fromJson` here.
InsightCard _card({
  required int id,
  InsightProducer producer = InsightProducer.personal,
  bool cited = false,
  double confidence = 0.5,
  DateTime? generatedAt,
  InsightSeverity severity = InsightSeverity.info,
}) {
  return InsightCard(
    id: id,
    userId: '8f14e45f-ceea-467f-a1d2-91a2b3c4d5e6',
    ruleId: 'rule_$id',
    generatedAt: generatedAt ?? DateTime.utc(2026, 7, 17, 6),
    title: 'Card $id',
    body: 'Body $id',
    category: InsightCategory.relationship,
    severity: severity,
    contributingMetrics: const ['sleep_duration_min'],
    confidenceScore: confidence,
    confidenceSources: const ['signal'],
    status: InsightStatus.active,
    phaseGenerated: 'p2s8',
    producer: producer,
    insightId: cited ? 'insight_$id' : null,
    edgeRefs: cited
        ? const [
            InsightCardEdgeRef(
              edgeId: 'sleep_duration_min->gut_comfort_score',
              verifiedAt: '2026-07-10T00:00:00Z',
            ),
          ]
        : const [],
  );
}

/// The shape of the live hosted deck: 1 edge card, many personal, a couple of
/// rules cards — with the cited one buried in the middle, which is exactly the
/// arrangement the unordered query could produce.
List<InsightCard> _liveShapedDeck() => [
      _card(id: 10, confidence: 0.71),
      _card(id: 11, producer: InsightProducer.rules, confidence: 0.9),
      _card(id: 12, confidence: 0.33),
      _card(
          id: 13,
          producer: InsightProducer.edge,
          cited: true,
          confidence: 0.42),
      _card(id: 14, confidence: 0.88),
      _card(id: 15, producer: InsightProducer.rules, confidence: 0.6),
    ];

List<int> _ids(List<InsightCard> cards) => cards.map((c) => c.id).toList();

/// The body of a Dart method, by brace matching from the `{` after [signature].
/// (Same technique as insight_status_contract_test.dart's source guards;
/// re-declared locally so the two test files stay independent.)
String _methodBody(String src, String signature) {
  final start = src.indexOf(signature);
  if (start < 0) throw StateError('method not found: $signature');
  final open = src.indexOf('{', start);
  if (open < 0) throw StateError('no body for: $signature');
  var depth = 0;
  for (var i = open; i < src.length; i++) {
    if (src[i] == '{') depth++;
    if (src[i] == '}') {
      depth--;
      if (depth == 0) return src.substring(open + 1, i);
    }
  }
  throw StateError('unbalanced braces after: $signature');
}

// ─── Tests ────────────────────────────────────────────────────────────────────

void main() {
  group('sortedForDeck — cited cards lead', () {
    test('the research-linked card is first in a live-shaped deck', () {
      final sorted = InsightService.sortedForDeck(_liveShapedDeck());

      expect(sorted.first.id, 13);
      expect(sorted.first.isResearchLinked, isTrue,
          reason: 'the deck must open on the card that carries a citation');
      expect(sorted.skip(1).any((c) => c.isResearchLinked), isFalse);
    });

    test('a cited card leads even when it is the least confident card', () {
      // Confidence is the tie-break, never a way past the citation tier: the
      // 0.42 cited card still outranks a 0.99 uncited one.
      final sorted = InsightService.sortedForDeck([
        _card(id: 1, confidence: 0.99),
        _card(
            id: 2,
            producer: InsightProducer.edge,
            cited: true,
            confidence: 0.42),
      ]);

      expect(_ids(sorted), [2, 1]);
    });

    test('every research-linked card precedes every other card', () {
      final sorted = InsightService.sortedForDeck([
        _card(id: 1, confidence: 0.95),
        _card(
            id: 2, producer: InsightProducer.edge, cited: true, confidence: 0.2),
        _card(id: 3, producer: InsightProducer.rules, confidence: 0.8),
        _card(
            id: 4, producer: InsightProducer.edge, cited: true, confidence: 0.5),
        _card(id: 5, confidence: 0.6),
      ]);

      final lastCited = sorted.lastIndexWhere((c) => c.isResearchLinked);
      final firstUncited = sorted.indexWhere((c) => !c.isResearchLinked);
      expect(lastCited, lessThan(firstUncited),
          reason: 'the cited tier must be a contiguous prefix of the deck');
      expect(_ids(sorted.take(2).toList()), [4, 2],
          reason: 'inside the cited tier the tie-break still applies');
    });

    test('an edge card with no edge_refs does NOT lead — it has no citation', () {
      // `producer == 'edge'` alone is not the predicate. A row whose edge_refs
      // came back empty renders no citation affordance, so ordering it first
      // would put an uncited card at the head of the deck.
      final sorted = InsightService.sortedForDeck([
        _card(id: 1, confidence: 0.9),
        _card(id: 2, producer: InsightProducer.edge, confidence: 0.1),
      ]);

      expect(_ids(sorted), [1, 2]);
      expect(sorted.first.isResearchLinked, isFalse);
    });
  });

  group('sortedForDeck — tie-break is deterministic', () {
    test('within a tier, confidence descends', () {
      final sorted = InsightService.sortedForDeck([
        _card(id: 1, confidence: 0.30),
        _card(id: 2, confidence: 0.90),
        _card(id: 3, confidence: 0.60),
      ]);

      expect(_ids(sorted), [2, 3, 1]);
    });

    test('severity is deliberately NOT a key — confidence still decides', () {
      // Considered and rejected as the second key: generate-insights hardcodes
      // `severity: 'info'` for every edge and personal card (only `rules` cards
      // carry a rule's severity), so it is near-constant on a live deck — and
      // floating a low-confidence `watch` above a high-confidence card would
      // work against the very ordering this file exists to pin.
      final sorted = InsightService.sortedForDeck([
        _card(id: 1, confidence: 0.9, severity: InsightSeverity.info),
        _card(id: 2, confidence: 0.3, severity: InsightSeverity.watch),
      ]);

      expect(_ids(sorted), [1, 2]);
    });

    test('equal confidence falls through to the fresher card', () {
      final sorted = InsightService.sortedForDeck([
        _card(id: 1, confidence: 0.6, generatedAt: DateTime.utc(2026, 7, 15)),
        _card(id: 2, confidence: 0.6, generatedAt: DateTime.utc(2026, 7, 17)),
        _card(id: 3, confidence: 0.6, generatedAt: DateTime.utc(2026, 7, 16)),
      ]);

      expect(_ids(sorted), [2, 3, 1]);
    });

    test('cards equal on every soft key still get a fixed order (id desc)', () {
      // The nightly pass writes a whole batch with the same generated_at, and
      // confidence_score is rounded to 3dp, so exact ties are ordinary — not a
      // corner case. Without the id key these three would compare equal and
      // `List.sort` could return them in any order.
      final sorted = InsightService.sortedForDeck([
        _card(id: 7),
        _card(id: 9),
        _card(id: 8),
      ]);

      expect(_ids(sorted), [9, 8, 7]);
    });

    test('the comparator is a TOTAL order — no two distinct cards tie', () {
      final deck = _liveShapedDeck()..addAll([_card(id: 20), _card(id: 21)]);

      for (final a in deck) {
        for (final b in deck) {
          if (identical(a, b)) continue;
          expect(InsightService.compareForDeck(a, b), isNot(0),
              reason: 'cards ${a.id} and ${b.id} compare equal, so their '
                  'relative order is left to an unstable sort');
        }
      }
    });

    test('every input permutation produces the identical deck', () {
      // The real anti-shuffle assertion: PostgREST can hand back the same rows
      // in a different order on any request, and a realtime emission rebuilds
      // the list from scratch. All of those must render the same deck.
      final base = _liveShapedDeck();
      final expected = _ids(InsightService.sortedForDeck(base));

      final permutations = <List<InsightCard>>[
        base,
        base.reversed.toList(),
        [...base.skip(3), ...base.take(3)],
        [...expected.map((id) => base.firstWhere((c) => c.id == id))],
      ];

      for (final permutation in permutations) {
        expect(_ids(InsightService.sortedForDeck(permutation)), expected);
      }
    });

    test('sorting is idempotent and does not mutate the caller\'s list', () {
      final original = _liveShapedDeck();
      final asGiven = _ids(original);

      final once = InsightService.sortedForDeck(original);
      final twice = InsightService.sortedForDeck(once);

      expect(_ids(original), asGiven, reason: 'sortedForDeck returns a new list');
      expect(_ids(twice), _ids(once));
    });
  });

  group('sortedForDeck — ordering only, nothing is filtered', () {
    test('a still-researching personal card stays in the deck', () {
      final deck = _liveShapedDeck();
      final sorted = InsightService.sortedForDeck(deck);

      expect(sorted, hasLength(deck.length));
      expect(_ids(sorted).toSet(), _ids(deck).toSet());
      expect(sorted.where((c) => c.isStillResearching), isNotEmpty,
          reason: 'personal gap-surfacing cards are kept on purpose — this '
              'change reorders the deck, it does not prune it');
    });

    test('an all-uncited deck is reordered, not emptied', () {
      final deck = [
        _card(id: 1, confidence: 0.2),
        _card(id: 2, confidence: 0.4),
      ];
      expect(_ids(InsightService.sortedForDeck(deck)), [2, 1]);
    });

    test('an empty deck sorts to an empty deck', () {
      expect(InsightService.sortedForDeck(const []), isEmpty);
    });
  });

  group('read paths all order through the one comparator', () {
    // Source-text guard. A fake SupabaseClient cannot observe the ordering of a
    // PostgREST response, and the stream path cannot be driven at all under
    // `flutter test` — but the defect being fixed is precisely "one read path
    // forgot to sort", so the coupling is asserted on the source itself.
    final dartService = readRepoFile(
        'apps/biotope/lib/modules/m5b_insight_engine/impl/insight_service.dart');

    const signatures = <String>[
      'Future<List<InsightCard>> getInsights(String userId)',
      'Future<List<InsightCard>> getArchivedInsights(String userId)',
      'Stream<List<InsightCard>> watchInsights(String userId)',
    ];

    for (final signature in signatures) {
      test('$signature returns through sortedForDeck', () {
        final body =
            _methodBody(dartService, signature).replaceAll(RegExp(r'\s+'), ' ');
        expect(body, contains('sortedForDeck('),
            reason: 'this read path feeds the same deck as the others; an '
                'unsorted one puts the cited card back in the middle');
      });
    }

    test('no read path hand-rolls its own .sort()', () {
      // Duplicated sorts are how the deck and the stream drift apart.
      for (final signature in signatures) {
        final body = _methodBody(dartService, signature);
        expect(body, isNot(contains('.sort(')),
            reason: '$signature must delegate to sortedForDeck, not sort '
                'inline');
      }
    });

    test('the deck widget renders the list in the order it is handed', () {
      // sortedForDeck is only worth anything if the deck reads index 0 first.
      final deckSource = File(
              '${repoRoot().path}/apps/biotope/lib/modules/m5b_insight_engine/'
              'ui/widgets/insight_deck.dart')
          .readAsStringSync();

      expect(deckSource, contains('widget.cards[_idx]'));
      expect(deckSource, isNot(contains('.sort(')),
          reason: 'a second sort in the widget would silently override the '
              'service order');
    });
  });
}
