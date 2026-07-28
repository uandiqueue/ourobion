// UI gap 4 — the Archive round trip, at the widget layer.
//
// Two behaviours the source-level contract test (insight_status_contract_test.dart) cannot see:
//   * the deck's swipe-right writes InsightStatus.archived — NOT the old `snoozed` stand-in;
//   * the Archive tab reads through getArchivedInsights and renders what comes back.
//
// No image goldens (deferred by O37) — these assert behaviour and rendered text only.
//
// InsightsTab/ArchiveTab take an injectable service + userId for exactly this reason; production
// passes neither. Same seam, and the same fake-client construction, as
// provenance_screen_widget_test.dart (Supabase.instance cannot be initialised under flutter test).

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:src/modules/m5b_insight_engine/impl/insight_service.dart';
import 'package:src/modules/m5b_insight_engine/ui/screens/archive_tab.dart';
import 'package:src/modules/m5b_insight_engine/ui/screens/insights_tab.dart';
import 'package:src/modules/m5b_insight_engine/ui/widgets/insight_deck.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class _FakeInsightService extends InsightService {
  _FakeInsightService({this.active = const [], this.archived = const []})
      // autoRefreshToken off: the default GoTrue timer trips the test binding's
      // pending-timers invariant.
      : super(SupabaseClient(
          'http://localhost',
          'test-key',
          authOptions: const AuthClientOptions(autoRefreshToken: false),
        ));

  final List<InsightCard> active;
  final List<InsightCard> archived;

  final List<String> getInsightsCalls = [];
  final List<String> getArchivedCalls = [];
  final List<({int cardId, InsightStatus status})> statusWrites = [];

  @override
  Future<List<InsightCard>> getInsights(String userId) async {
    getInsightsCalls.add(userId);
    return active;
  }

  @override
  Future<List<InsightCard>> getArchivedInsights(String userId) async {
    getArchivedCalls.add(userId);
    return archived;
  }

  @override
  Future<void> updateStatus(int cardId, InsightStatus status) async {
    statusWrites.add((cardId: cardId, status: status));
  }
}

InsightCard _card({
  int id = 1,
  String title = 'Hydration pattern',
  InsightStatus status = InsightStatus.active,
}) {
  return InsightCard(
    id: id,
    userId: 'u-1',
    ruleId: 'hydration_dark_urine',
    generatedAt: DateTime.utc(2026, 7, 28, 2),
    title: title,
    body: 'Your data shows a drift from your usual range this week.',
    category: InsightCategory.hydration,
    severity: InsightSeverity.info,
    contributingMetrics: const ['urine_colour'],
    confidenceScore: 0.7,
    confidenceSources: const ['self_report'],
    status: status,
    phaseGenerated: 'p2s9',
  );
}

void main() {
  group('InsightsTab swipe-right', () {
    testWidgets('saves the card as archived, not snoozed', (tester) async {
      final fake = _FakeInsightService(active: [_card(id: 42)]);
      await tester.pumpWidget(
        MaterialApp(home: InsightsTab(service: fake, userId: 'u-1')),
      );
      await tester.pumpAndSettle();

      // Past the deck's 92px right-swipe threshold.
      await tester.drag(find.byType(InsightDeck), const Offset(240, 0));
      await tester.pumpAndSettle();

      expect(fake.statusWrites, hasLength(1));
      expect(fake.statusWrites.single.cardId, 42);
      expect(
        fake.statusWrites.single.status,
        InsightStatus.archived,
        reason: 'swipe-right is "keep this" — it must write the real archived status. '
            'Writing snoozed (the pre-20260728040000 stand-in) makes the deck unable to '
            'ever offer a genuine snooze and mislabels the row.',
      );
    });

    testWidgets('SAVED count seeds from getArchivedInsights and increments on save',
        (tester) async {
      final fake = _FakeInsightService(
        active: [_card(id: 7)],
        archived: [_card(id: 90, status: InsightStatus.archived)],
      );
      await tester.pumpWidget(
        MaterialApp(home: InsightsTab(service: fake, userId: 'u-1')),
      );
      await tester.pumpAndSettle();

      expect(fake.getArchivedCalls, ['u-1']);
      expect(find.text('SAVED'), findsOneWidget);
      expect(find.text('1'), findsOneWidget);

      await tester.drag(find.byType(InsightDeck), const Offset(240, 0));
      await tester.pumpAndSettle();

      expect(find.text('2'), findsOneWidget);
    });

    testWidgets('a partial right drag shows the SAVE affordance without writing',
        (tester) async {
      final fake = _FakeInsightService(active: [_card(id: 5)]);
      await tester.pumpWidget(
        MaterialApp(home: InsightsTab(service: fake, userId: 'u-1')),
      );
      await tester.pumpAndSettle();

      // Above the 40px stamp threshold, below the 92px commit threshold. Stepped, because the
      // pan recognizer swallows the first move (it is spent crossing kTouchSlop, and
      // DragStartBehavior.start reports deltas only from the acceptance point).
      final gesture = await tester.startGesture(
        tester.getCenter(find.byType(InsightDeck)),
      );
      for (var i = 0; i < 4; i++) {
        await gesture.moveBy(const Offset(25, 0));
        await tester.pump();
      }

      expect(find.text('SAVE'), findsOneWidget);
      expect(fake.statusWrites, isEmpty);

      await gesture.up();
      await tester.pumpAndSettle();
      expect(fake.statusWrites, isEmpty,
          reason: 'a drag that never crosses the threshold must not archive anything');
    });

    testWidgets('swipe-left still dismisses', (tester) async {
      final fake = _FakeInsightService(active: [_card(id: 8)]);
      await tester.pumpWidget(
        MaterialApp(home: InsightsTab(service: fake, userId: 'u-1')),
      );
      await tester.pumpAndSettle();

      await tester.drag(find.byType(InsightDeck), const Offset(-240, 0));
      await tester.pumpAndSettle();

      expect(fake.statusWrites.single.status, InsightStatus.dismissed);
    });
  });

  group('ArchiveTab', () {
    testWidgets('reads the archive query, never the active-cards query', (tester) async {
      final fake = _FakeInsightService(
        active: [_card(id: 1, title: 'Should not appear')],
        archived: [_card(id: 2, title: 'Saved card', status: InsightStatus.archived)],
      );
      await tester.pumpWidget(
        MaterialApp(home: ArchiveTab(service: fake, userId: 'u-1')),
      );
      await tester.pumpAndSettle();

      expect(fake.getArchivedCalls, ['u-1']);
      expect(fake.getInsightsCalls, isEmpty,
          reason: 'the Archive tab must not list servable (active) cards');
      expect(find.text('Saved card'), findsOneWidget);
      expect(find.text('Should not appear'), findsNothing);
    });

    testWidgets('renders a legacy pre-migration snoozed save alongside an archived one',
        (tester) async {
      // Migration 20260728040000 deliberately does not relabel rows saved before it; the Archive
      // query keeps them visible via InsightService.archiveStatuses.
      final fake = _FakeInsightService(archived: [
        _card(id: 2, title: 'New save', status: InsightStatus.archived),
        _card(id: 3, title: 'Legacy save', status: InsightStatus.snoozed),
      ]);
      await tester.pumpWidget(
        MaterialApp(home: ArchiveTab(service: fake, userId: 'u-1')),
      );
      await tester.pumpAndSettle();

      expect(find.text('New save'), findsOneWidget);
      expect(find.text('Legacy save'), findsOneWidget);
    });

    testWidgets('empty archive shows the saved-nothing-yet state', (tester) async {
      final fake = _FakeInsightService();
      await tester.pumpWidget(
        MaterialApp(home: ArchiveTab(service: fake, userId: 'u-1')),
      );
      await tester.pumpAndSettle();

      expect(find.text('Nothing saved yet'), findsOneWidget);
    });
  });
}
