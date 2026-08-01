// Deck recovery, at the widget layer.
//
// Two affordances, both answers to the same incident: 54 of 56 cards were
// swiped away on a device and none of them could be found again. Swipe-right
// at least landed in the Archive tab; swipe-left (`dismissed`) landed nowhere,
// and the pipeline's `dismissedSkipped` meant re-running it did not help. The
// only recovery was a manual database write.
//
//   1. ArchiveTab — remove a saved card (returns it to the deck).
//   2. InsightsTab — reset this period's deck (returns held cards to `active`).
//
// The query-layer promises (no row is created, nothing expired is resurrected)
// are proved against the REAL PostgREST query in deck_recovery_service_test.dart.
// This file covers what only a widget can show: the confirmation step, what the
// copy actually says, and that a cancel writes nothing.
//
// Same injectable-service seam as archive_status_widget_test.dart — production
// passes neither service nor userId.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:src/modules/m5a_baselines/index.dart';
import 'package:src/modules/m5b_insight_engine/impl/insight_service.dart';
import 'package:src/modules/m5b_insight_engine/ui/screens/archive_tab.dart';
import 'package:src/modules/m5b_insight_engine/ui/screens/insights_tab.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

final _now = DateTime.utc(2026, 8, 2, 9, 0);

InsightCard _card({
  int id = 1,
  String title = 'Hydration pattern',
  InsightStatus status = InsightStatus.active,
  DateTime? expiresAt,
}) => InsightCard(
  id: id,
  userId: 'u-1',
  ruleId: 'hydration_dark_urine_$id',
  generatedAt: DateTime.utc(2026, 7, 30, 2),
  title: title,
  body: 'Your data shows a drift from your usual range this week.',
  category: InsightCategory.hydration,
  severity: InsightSeverity.info,
  contributingMetrics: const ['urine_colour'],
  confidenceScore: 0.7,
  confidenceSources: const ['self_report'],
  status: status,
  expiresAt: expiresAt,
  phaseGenerated: 'p2s9',
);

/// Stateful fake over a single row set, so the two tabs read back what a write
/// actually did rather than a frozen fixture.
///
/// [resetCurrentPeriodDeck] here is DELIBERATELY the thinnest possible stand-in:
/// it flips held rows and records the call. It is not evidence about scoping or
/// expiry — the real query is what carries those, and it is exercised directly
/// in deck_recovery_service_test.dart. What these tests use it for is proving
/// the UI calls it exactly when the user confirms, and reports the rows it
/// returned rather than a guess.
class _FakeInsightService extends InsightService {
  _FakeInsightService({List<InsightCard> rows = const []})
    : rows = List.of(rows),
      super(
        SupabaseClient(
          'http://localhost',
          'test-key',
          authOptions: const AuthClientOptions(autoRefreshToken: false),
        ),
      );

  final List<InsightCard> rows;
  final List<({int cardId, InsightStatus status})> statusWrites = [];
  int resetCalls = 0;

  /// Rows the fake will hand back from a reset, if the test wants to pin the
  /// reported number independently of the fake's own flipping.
  List<InsightCard>? resetResult;

  List<InsightCard> _withStatus(int id, InsightStatus status) {
    final index = rows.indexWhere((c) => c.id == id);
    if (index < 0) return rows;
    final old = rows[index];
    rows[index] = _card(
      id: old.id,
      title: old.title,
      status: status,
      expiresAt: old.expiresAt,
    );
    return rows;
  }

  @override
  Future<List<InsightCard>> getInsights(String userId) async => [
    for (final c in rows)
      if (c.status == InsightStatus.active &&
          !c.isExpiredAt(_now))
        c,
  ];

  @override
  Future<List<InsightCard>> getArchivedInsights(String userId) async => [
    for (final c in rows)
      if (InsightService.archiveStatuses.contains(c.status)) c,
  ];

  @override
  Future<void> updateStatus(int cardId, InsightStatus status) async {
    statusWrites.add((cardId: cardId, status: status));
    _withStatus(cardId, status);
  }

  @override
  Future<List<InsightCard>> resetCurrentPeriodDeck(String userId) async {
    resetCalls += 1;
    final held = [
      for (final c in rows)
        if (c.status != InsightStatus.active && !c.isExpiredAt(_now)) c.id,
    ];
    for (final id in held) {
      _withStatus(id, InsightStatus.active);
    }
    return resetResult ??
        [for (final c in rows) if (held.contains(c.id)) c];
  }
}

/// Always inert — these tests are about the insight affordances, not trends.
class _FakeSeriesService extends MetricSeriesService {
  _FakeSeriesService()
    : super(
        SupabaseClient(
          'http://localhost',
          'test-key',
          authOptions: const AuthClientOptions(autoRefreshToken: false),
        ),
      );

  @override
  Future<List<String>> getMetricKeys(
    String userId, {
    int windowDays = 30,
  }) async => const [];

  @override
  Future<List<MetricDailyPoint>> getSeries(
    String userId,
    String metricKey, {
    int windowDays = 30,
  }) async => const [];
}

Widget _archive(_FakeInsightService fake) => MaterialApp(
  home: ArchiveTab(
    service: fake,
    seriesService: _FakeSeriesService(),
    userId: 'u-1',
    nowUtc: () => _now,
  ),
);

Widget _insights(_FakeInsightService fake) =>
    MaterialApp(home: InsightsTab(service: fake, userId: 'u-1'));

Future<void> _tapRemove(WidgetTester tester) async {
  await tester.tap(find.byTooltip(ArchiveTabCopy.removeTooltip).first);
  await tester.pumpAndSettle();
}

Future<void> _tapReset(WidgetTester tester) async {
  await tester.tap(find.byTooltip(InsightsTabCopy.resetTooltip));
  await tester.pumpAndSettle();
}

void main() {
  // ── 1 · Remove a saved insight ──────────────────────────────────────────────

  group('ArchiveTab — remove a saved card', () {
    testWidgets('every saved tile offers the affordance', (tester) async {
      final fake = _FakeInsightService(
        rows: [
          _card(id: 1, title: 'First save', status: InsightStatus.archived),
          _card(id: 2, title: 'Legacy save', status: InsightStatus.snoozed),
        ],
      );
      await tester.pumpWidget(_archive(fake));
      await tester.pumpAndSettle();

      expect(
        find.byTooltip(ArchiveTabCopy.removeTooltip),
        findsNWidgets(2),
        reason:
            'the Archive tab listed saved cards with no way to un-save one; a '
            'legacy snoozed save is just as stuck as a new archived one',
      );
    });

    testWidgets('confirming returns the card to the deck, not to dismissed', (
      tester,
    ) async {
      final fake = _FakeInsightService(
        rows: [_card(id: 7, title: 'Saved card', status: InsightStatus.archived)],
      );
      await tester.pumpWidget(_archive(fake));
      await tester.pumpAndSettle();

      await _tapRemove(tester);
      expect(find.text(ArchiveTabCopy.removeTitle), findsOneWidget);
      expect(fake.statusWrites, isEmpty, reason: 'the dialog has not been answered');

      await tester.tap(find.text(ArchiveTabCopy.removeConfirm));
      await tester.pumpAndSettle();

      expect(fake.statusWrites, hasLength(1));
      expect(fake.statusWrites.single.cardId, 7);
      expect(
        fake.statusWrites.single.status,
        InsightStatus.active,
        reason:
            'the two honest readings of "remove" were active and dismissed. '
            'Dismissed is the status nothing can see and the pipeline never '
            'regenerates — routing the only un-save affordance into it would '
            'push cards into the exact black hole this change closes.',
      );
    });

    testWidgets('the removed card leaves the archive list', (tester) async {
      final fake = _FakeInsightService(
        rows: [
          _card(id: 7, title: 'Saved card', status: InsightStatus.archived),
          _card(id: 8, title: 'Other save', status: InsightStatus.archived),
        ],
      );
      await tester.pumpWidget(_archive(fake));
      await tester.pumpAndSettle();
      expect(find.text('Saved card'), findsOneWidget);

      await _tapRemove(tester);
      await tester.tap(find.text(ArchiveTabCopy.removeConfirm));
      await tester.pumpAndSettle();

      expect(find.text('Saved card'), findsNothing);
      expect(
        find.text('Other save'),
        findsOneWidget,
        reason: 'removing one saved card must not disturb the rest',
      );
    });

    testWidgets('cancelling writes nothing at all', (tester) async {
      final fake = _FakeInsightService(
        rows: [_card(id: 7, title: 'Saved card', status: InsightStatus.archived)],
      );
      await tester.pumpWidget(_archive(fake));
      await tester.pumpAndSettle();

      await _tapRemove(tester);
      await tester.tap(find.text(ArchiveTabCopy.removeCancel));
      await tester.pumpAndSettle();

      expect(fake.statusWrites, isEmpty);
      expect(find.text('Saved card'), findsOneWidget);
    });

    testWidgets('nothing is hard-deleted — the row survives as an active card', (
      tester,
    ) async {
      final fake = _FakeInsightService(
        rows: [
          _card(
            id: 7,
            title: 'Saved card',
            status: InsightStatus.archived,
            expiresAt: _now.add(const Duration(days: 3)),
          ),
        ],
      );
      await tester.pumpWidget(_archive(fake));
      await tester.pumpAndSettle();

      await _tapRemove(tester);
      await tester.tap(find.text(ArchiveTabCopy.removeConfirm));
      await tester.pumpAndSettle();

      expect(fake.rows, hasLength(1));
      expect(fake.rows.single.status, InsightStatus.active);
      expect(
        await fake.getInsights('u-1'),
        hasLength(1),
        reason:
            'insight_cards is the record of what the engine served and '
            'provenance hangs off the row. Remove un-holds it; it never '
            'destroys it, and the user can swipe it back into the archive.',
      );
    });

    testWidgets('an in-window card is promised a return to the deck', (
      tester,
    ) async {
      final fake = _FakeInsightService(
        rows: [
          _card(
            id: 7,
            status: InsightStatus.archived,
            expiresAt: _now.add(const Duration(days: 3)),
          ),
        ],
      );
      await tester.pumpWidget(_archive(fake));
      await tester.pumpAndSettle();

      await _tapRemove(tester);

      expect(find.text(ArchiveTabCopy.removeBody), findsOneWidget);
      expect(find.text(ArchiveTabCopy.removeExpiredBody), findsNothing);
    });

    testWidgets('an expired card is told plainly that it will not come back', (
      tester,
    ) async {
      // getInsights applies an expiry cutoff, so returning an expired saved
      // card to `active` takes it out of the archive without putting it
      // anywhere reachable. Promising a return here would be the same
      // disappearing act the incident was about — from the other direction.
      final fake = _FakeInsightService(
        rows: [
          _card(
            id: 7,
            status: InsightStatus.archived,
            expiresAt: _now.subtract(const Duration(days: 2)),
          ),
        ],
      );
      await tester.pumpWidget(_archive(fake));
      await tester.pumpAndSettle();

      await _tapRemove(tester);

      expect(find.text(ArchiveTabCopy.removeExpiredBody), findsOneWidget);
      expect(find.text(ArchiveTabCopy.removeBody), findsNothing);
    });

    testWidgets('a failed write surfaces and leaves the card saved', (
      tester,
    ) async {
      final fake = _ThrowingInsightService(
        rows: [_card(id: 7, title: 'Saved card', status: InsightStatus.archived)],
      );
      await tester.pumpWidget(_archive(fake));
      await tester.pumpAndSettle();

      await _tapRemove(tester);
      await tester.tap(find.text(ArchiveTabCopy.removeConfirm));
      await tester.pumpAndSettle();

      expect(find.text(ArchiveTabCopy.removeFailed), findsOneWidget);
      expect(find.text('Saved card'), findsOneWidget);
    });
  });

  // ── 2 · Reset the weekly deck ───────────────────────────────────────────────

  group('InsightsTab — reset this period\'s deck', () {
    testWidgets('the affordance is reachable while the deck still has cards', (
      tester,
    ) async {
      // The incident left two cards in the deck out of fifty-six. An
      // empty-deck-only affordance would not have been reachable at the moment
      // it was needed.
      final fake = _FakeInsightService(rows: [_card(id: 1, title: 'Still here')]);
      await tester.pumpWidget(_insights(fake));
      await tester.pumpAndSettle();

      expect(find.text('Still here'), findsOneWidget);
      expect(find.byTooltip(InsightsTabCopy.resetTooltip), findsOneWidget);
    });

    testWidgets('the affordance is reachable when the deck is empty', (
      tester,
    ) async {
      final fake = _FakeInsightService(
        rows: [_card(id: 1, status: InsightStatus.dismissed)],
      );
      await tester.pumpWidget(_insights(fake));
      await tester.pumpAndSettle();

      expect(find.byTooltip(InsightsTabCopy.resetTooltip), findsOneWidget);
    });

    testWidgets('it confirms before acting', (tester) async {
      final fake = _FakeInsightService(
        rows: [_card(id: 1, status: InsightStatus.dismissed)],
      );
      await tester.pumpWidget(_insights(fake));
      await tester.pumpAndSettle();

      await _tapReset(tester);

      expect(find.text(InsightsTabCopy.resetTitle), findsOneWidget);
      expect(find.text(InsightsTabCopy.resetBody), findsOneWidget);
      expect(
        fake.resetCalls,
        0,
        reason: 'a bulk change to what the user sees must not fire on one tap',
      );
    });

    testWidgets('cancelling changes nothing', (tester) async {
      final fake = _FakeInsightService(
        rows: [_card(id: 1, status: InsightStatus.dismissed)],
      );
      await tester.pumpWidget(_insights(fake));
      await tester.pumpAndSettle();

      await _tapReset(tester);
      await tester.tap(find.text(InsightsTabCopy.resetCancel));
      await tester.pumpAndSettle();

      expect(fake.resetCalls, 0);
      expect(fake.rows.single.status, InsightStatus.dismissed);
    });

    testWidgets('confirming brings a dismissed card back into the deck', (
      tester,
    ) async {
      final fake = _FakeInsightService(
        rows: [
          _card(
            id: 1,
            title: 'The research-backed card',
            status: InsightStatus.dismissed,
          ),
        ],
      );
      await tester.pumpWidget(_insights(fake));
      await tester.pumpAndSettle();
      expect(find.text('The research-backed card'), findsNothing);

      await _tapReset(tester);
      await tester.tap(find.text(InsightsTabCopy.resetConfirm));
      await tester.pumpAndSettle();

      expect(fake.resetCalls, 1);
      expect(
        find.text('The research-backed card'),
        findsOneWidget,
        reason:
            'this is the whole point: a dismissed card was recoverable only by '
            'writing to the database directly',
      );
    });

    testWidgets('archived saves come back too, and the SAVED header follows', (
      tester,
    ) async {
      final fake = _FakeInsightService(
        rows: [
          _card(id: 1, title: 'Saved one', status: InsightStatus.archived),
          _card(id: 2, title: 'Dismissed one', status: InsightStatus.dismissed),
        ],
      );
      await tester.pumpWidget(_insights(fake));
      await tester.pumpAndSettle();
      expect(find.text('1'), findsOneWidget); // SAVED count

      await _tapReset(tester);
      await tester.tap(find.text(InsightsTabCopy.resetConfirm));
      await tester.pumpAndSettle();

      expect(
        find.text('0'),
        findsOneWidget,
        reason:
            'a restored save leaves the archive, so the header has to move — '
            'and the confirmation copy says it will',
      );
    });

    testWidgets('it reports the rows the write returned, not a guess', (
      tester,
    ) async {
      final fake = _FakeInsightService(
        rows: [_card(id: 1, status: InsightStatus.dismissed)],
      );
      // The backend moved three rows; the deck's local list knows about one.
      fake.resetResult = [
        _card(id: 1, status: InsightStatus.active),
        _card(id: 2, status: InsightStatus.active),
        _card(id: 3, status: InsightStatus.active),
      ];
      await tester.pumpWidget(_insights(fake));
      await tester.pumpAndSettle();

      await _tapReset(tester);
      await tester.tap(find.text(InsightsTabCopy.resetConfirm));
      await tester.pumpAndSettle();

      expect(find.text(InsightsTabCopy.resetDone(3)), findsOneWidget);
    });

    testWidgets('one restored card is reported in the singular', (tester) async {
      final fake = _FakeInsightService(
        rows: [_card(id: 1, status: InsightStatus.dismissed)],
      );
      await tester.pumpWidget(_insights(fake));
      await tester.pumpAndSettle();

      await _tapReset(tester);
      await tester.tap(find.text(InsightsTabCopy.resetConfirm));
      await tester.pumpAndSettle();

      expect(find.text(InsightsTabCopy.resetDone(1)), findsOneWidget);
    });

    testWidgets('nothing in scope says so instead of claiming a success', (
      tester,
    ) async {
      final fake = _FakeInsightService(rows: [_card(id: 1)]); // already active
      await tester.pumpWidget(_insights(fake));
      await tester.pumpAndSettle();

      await _tapReset(tester);
      await tester.tap(find.text(InsightsTabCopy.resetConfirm));
      await tester.pumpAndSettle();

      expect(find.text(InsightsTabCopy.resetNone), findsOneWidget);
    });

    testWidgets('an expired dismissed card is not brought back', (tester) async {
      final fake = _FakeInsightService(
        rows: [
          _card(
            id: 1,
            title: 'Long gone',
            status: InsightStatus.dismissed,
            expiresAt: _now.subtract(const Duration(days: 3)),
          ),
        ],
      );
      await tester.pumpWidget(_insights(fake));
      await tester.pumpAndSettle();

      await _tapReset(tester);
      await tester.tap(find.text(InsightsTabCopy.resetConfirm));
      await tester.pumpAndSettle();

      expect(find.text('Long gone'), findsNothing);
      expect(find.text(InsightsTabCopy.resetNone), findsOneWidget);
    });

    testWidgets('no card is created — the row set is the same size', (
      tester,
    ) async {
      final fake = _FakeInsightService(
        rows: [
          _card(id: 1, status: InsightStatus.dismissed),
          _card(id: 2, status: InsightStatus.archived),
        ],
      );
      final idsBefore = fake.rows.map((c) => c.id).toList();

      await tester.pumpWidget(_insights(fake));
      await tester.pumpAndSettle();
      await _tapReset(tester);
      await tester.tap(find.text(InsightsTabCopy.resetConfirm));
      await tester.pumpAndSettle();

      expect(
        fake.rows.map((c) => c.id).toList(),
        idsBefore,
        reason:
            'reset flips status on rows that already exist. Generating or '
            'duplicating a card here would be inventing an insight.',
      );
    });

    testWidgets('a failed reset surfaces and leaves the deck as it was', (
      tester,
    ) async {
      final fake = _ThrowingInsightService(
        rows: [_card(id: 1, title: 'Held', status: InsightStatus.dismissed)],
      );
      await tester.pumpWidget(_insights(fake));
      await tester.pumpAndSettle();

      await _tapReset(tester);
      await tester.tap(find.text(InsightsTabCopy.resetConfirm));
      await tester.pumpAndSettle();

      expect(find.text(InsightsTabCopy.resetFailed), findsOneWidget);
      expect(find.text('Held'), findsNothing);
      expect(fake.rows.single.status, InsightStatus.dismissed);
    });
  });
}

/// Both writes fail, so the tabs' failure paths are exercised rather than
/// assumed. Reads still work — a tab that could not load would never reach the
/// affordance under test.
class _ThrowingInsightService extends _FakeInsightService {
  _ThrowingInsightService({super.rows});

  @override
  Future<void> updateStatus(int cardId, InsightStatus status) async =>
      throw Exception('offline');

  @override
  Future<List<InsightCard>> resetCurrentPeriodDeck(String userId) async =>
      throw Exception('offline');
}
