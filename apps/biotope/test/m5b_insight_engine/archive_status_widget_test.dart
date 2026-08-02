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
import 'package:src/core/generated_assets.dart';
import 'package:src/modules/m5a_baselines/index.dart';
import 'package:src/modules/m5b_insight_engine/impl/insight_service.dart';
import 'package:src/modules/m5b_insight_engine/ui/screens/archive_tab.dart';
import 'package:src/modules/m5b_insight_engine/ui/screens/insights_tab.dart';
import 'package:src/modules/m5b_insight_engine/ui/widgets/insight_card_visual.dart';
import 'package:src/modules/m5b_insight_engine/ui/widgets/insight_deck.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// Models the two queries and the status write against a tiny in-memory row set.
///
/// It is STATEFUL on purpose. A fake whose `getArchivedInsights` returned a
/// frozen list could not tell an honest re-read from an optimistic local
/// increment — both would render the same number — which is exactly the drift
/// the SAVED header used to have. Here `updateStatus(archived)` moves the card
/// out of the active set and into the archived set, and — like the real
/// `UPDATE ... SET status` — is IDEMPOTENT: archiving an already-archived card
/// changes no row, so the archived count must not move.
class _FakeInsightService extends InsightService {
  _FakeInsightService({
    List<InsightCard> active = const [],
    List<InsightCard> archived = const [],
  }) : active = List.of(active),
       archived = List.of(archived),
       // autoRefreshToken off: the default GoTrue timer trips the test
       // binding's pending-timers invariant.
       super(
         SupabaseClient(
           'http://localhost',
           'test-key',
           authOptions: const AuthClientOptions(autoRefreshToken: false),
         ),
       );

  final List<InsightCard> active;
  final List<InsightCard> archived;

  final List<String> getInsightsCalls = [];
  final List<String> getArchivedCalls = [];
  final List<({int cardId, InsightStatus status})> statusWrites = [];

  @override
  Future<List<InsightCard>> getInsights(String userId) async {
    getInsightsCalls.add(userId);
    return List.of(active);
  }

  @override
  Future<List<InsightCard>> getArchivedInsights(String userId) async {
    getArchivedCalls.add(userId);
    return List.of(archived);
  }

  @override
  Future<void> updateStatus(int cardId, InsightStatus status) async {
    statusWrites.add((cardId: cardId, status: status));

    final held = active.where((c) => c.id == cardId).toList();
    active.removeWhere((c) => c.id == cardId);
    if (status != InsightStatus.archived || held.isEmpty) return;
    // Idempotent, like the real UPDATE: one row per id, however many times it
    // is written.
    if (archived.any((c) => c.id == cardId)) return;
    archived.add(
      _card(
        id: cardId,
        title: held.first.title,
        status: InsightStatus.archived,
      ),
    );
  }
}

/// Companion fake for ArchiveTab's new trends section (issue #200). Always
/// inert (no metric keys) — these archive-card-focused tests only need the
/// trend section to render its real "no history yet" state without crashing
/// on an uninitialised Supabase.instance; series fixtures live in
/// archive_trends_widget_test.dart instead.
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
        MaterialApp(
          home: InsightsTab(service: fake, userId: 'u-1'),
        ),
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
        reason:
            'swipe-right is "keep this" — it must write the real archived status. '
            'Writing snoozed (the pre-20260728040000 stand-in) makes the deck unable to '
            'ever offer a genuine snooze and mislabels the row.',
      );
    });

    testWidgets(
      'SAVED count seeds from getArchivedInsights and re-reads on save',
      (tester) async {
        final fake = _FakeInsightService(
          active: [_card(id: 7)],
          archived: [_card(id: 90, status: InsightStatus.archived)],
        );
        await tester.pumpWidget(
          MaterialApp(
            home: InsightsTab(service: fake, userId: 'u-1'),
          ),
        );
        await tester.pumpAndSettle();

        expect(fake.getArchivedCalls, ['u-1']);
        expect(find.text('SAVED'), findsOneWidget);
        expect(find.text('1'), findsOneWidget);

        await tester.drag(find.byType(InsightDeck), const Offset(240, 0));
        await tester.pumpAndSettle();

        expect(find.text('2'), findsOneWidget);
        expect(
          fake.getArchivedCalls,
          ['u-1', 'u-1'],
          reason:
              'the count after a save must come from the archive query, not '
              'from a local += 1 — an optimistic counter drifts above the true '
              'row count and never re-syncs within the session',
        );
      },
    );

    testWidgets(
      'SAVED count does not drift when the same card is saved twice',
      (tester) async {
        // The status write is an idempotent UPDATE: re-archiving an already
        // archived card changes no row. The old `_savedCount += 1` incremented
        // anyway, so the header climbed past the real archive size.
        final fake = _FakeInsightService(
          active: [
            _card(id: 7),
            _card(id: 7, title: 'Same row again'),
          ],
        );
        await tester.pumpWidget(
          MaterialApp(
            home: InsightsTab(service: fake, userId: 'u-1'),
          ),
        );
        await tester.pumpAndSettle();
        expect(find.text('0'), findsOneWidget);

        await tester.drag(find.byType(InsightDeck), const Offset(240, 0));
        await tester.pumpAndSettle();
        expect(find.text('1'), findsOneWidget);

        await tester.drag(find.byType(InsightDeck), const Offset(240, 0));
        await tester.pumpAndSettle();

        expect(
          find.text('1'),
          findsOneWidget,
          reason:
              'two saves of the same row are one archived row; the header '
              'must report the archive, not the number of swipes',
        );
        expect(find.text('2'), findsNothing);
      },
    );

    testWidgets('a partial right drag shows the SAVE affordance without writing', (
      tester,
    ) async {
      final fake = _FakeInsightService(active: [_card(id: 5)]);
      await tester.pumpWidget(
        MaterialApp(
          home: InsightsTab(service: fake, userId: 'u-1'),
        ),
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
      expect(
        fake.statusWrites,
        isEmpty,
        reason:
            'a drag that never crosses the threshold must not archive anything',
      );
    });

    testWidgets(
      'the empty-deck action re-reads Supabase instead of replaying held cards',
      (tester) async {
        // `_resetDeck()` used to just set `_idx = 0`, which resurrected cards whose
        // row already read archived/dismissed and served them as fresh insights.
        final fake = _FakeInsightService(
          active: [_card(id: 11, title: 'Only card')],
        );
        await tester.pumpWidget(
          MaterialApp(
            home: InsightsTab(service: fake, userId: 'u-1'),
          ),
        );
        await tester.pumpAndSettle();
        expect(find.text('Only card'), findsOneWidget);

        await tester.drag(find.byType(InsightDeck), const Offset(240, 0));
        await tester.pumpAndSettle();

        expect(find.text('Only card'), findsNothing);
        expect(find.text(InsightCardCopy.allCaughtUpTitle), findsOneWidget);

        final readsBefore = fake.getInsightsCalls.length;
        await tester.tap(find.text(InsightCardCopy.replayDeck));
        await tester.pumpAndSettle();

        expect(
          fake.getInsightsCalls.length,
          readsBefore + 1,
          reason: 'the action must ask insight_cards what is still active',
        );
        expect(
          find.text('Only card'),
          findsNothing,
          reason:
              'the card is archived — re-serving it would present a card the '
              'user has already held as a fresh, swipeable insight',
        );
        expect(
          fake.statusWrites,
          hasLength(1),
          reason: 'no card came back, so nothing more could be swiped',
        );
      },
    );

    testWidgets(
      'the empty-deck action serves a card the backend still calls active',
      (tester) async {
        // The flip side: re-reading must actually re-populate the deck when the
        // backend does still have something servable.
        final fake = _FakeInsightService(
          active: [_card(id: 12, title: 'First card')],
        );
        await tester.pumpWidget(
          MaterialApp(
            home: InsightsTab(service: fake, userId: 'u-1'),
          ),
        );
        await tester.pumpAndSettle();

        await tester.drag(find.byType(InsightDeck), const Offset(240, 0));
        await tester.pumpAndSettle();
        expect(find.text(InsightCardCopy.allCaughtUpTitle), findsOneWidget);

        // A nightly generate-insights run lands a new card between the two taps.
        fake.active.add(_card(id: 13, title: 'Freshly generated'));

        await tester.tap(find.text(InsightCardCopy.replayDeck));
        await tester.pumpAndSettle();

        expect(find.text('Freshly generated'), findsOneWidget);
        expect(find.text('First card'), findsNothing);
      },
    );

    testWidgets('swipe-left still dismisses', (tester) async {
      final fake = _FakeInsightService(active: [_card(id: 8)]);
      await tester.pumpWidget(
        MaterialApp(
          home: InsightsTab(service: fake, userId: 'u-1'),
        ),
      );
      await tester.pumpAndSettle();

      await tester.drag(find.byType(InsightDeck), const Offset(-240, 0));
      await tester.pumpAndSettle();

      expect(fake.statusWrites.single.status, InsightStatus.dismissed);
    });
  });

  group('ArchiveTab', () {
    testWidgets('re-reads saved cards when its shell tab becomes active', (
      tester,
    ) async {
      final fake = _FakeInsightService();
      final archiveKey = GlobalKey();

      Future<void> pumpArchive({required bool active}) async {
        await tester.pumpWidget(
          MaterialApp(
            home: ArchiveTab(
              key: archiveKey,
              active: active,
              service: fake,
              seriesService: _FakeSeriesService(),
              userId: 'u-1',
            ),
          ),
        );
        await tester.pumpAndSettle();
      }

      await pumpArchive(active: false);
      expect(find.text('Nothing saved yet'), findsOneWidget);
      expect(fake.getArchivedCalls, ['u-1']);

      fake.archived.add(
        _card(
          id: 2,
          title: 'Saved while Archive was hidden',
          status: InsightStatus.archived,
        ),
      );
      await pumpArchive(active: true);

      expect(fake.getArchivedCalls, ['u-1', 'u-1']);
      expect(find.text('Saved while Archive was hidden'), findsOneWidget);
      expect(find.text('Nothing saved yet'), findsNothing);
    });

    testWidgets('reads the archive query, never the active-cards query', (
      tester,
    ) async {
      final fake = _FakeInsightService(
        active: [_card(id: 1, title: 'Should not appear')],
        archived: [
          _card(id: 2, title: 'Saved card', status: InsightStatus.archived),
        ],
      );
      await tester.pumpWidget(
        MaterialApp(
          home: ArchiveTab(
            service: fake,
            seriesService: _FakeSeriesService(),
            userId: 'u-1',
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(fake.getArchivedCalls, ['u-1']);
      expect(
        fake.getInsightsCalls,
        isEmpty,
        reason: 'the Archive tab must not list servable (active) cards',
      );
      expect(find.text('Saved card'), findsOneWidget);
      expect(find.text('Should not appear'), findsNothing);
    });

    testWidgets(
      'renders a legacy pre-migration snoozed save alongside an archived one',
      (tester) async {
        // Migration 20260728040000 deliberately does not relabel rows saved before it; the Archive
        // query keeps them visible via InsightService.archiveStatuses.
        final fake = _FakeInsightService(
          archived: [
            _card(id: 2, title: 'New save', status: InsightStatus.archived),
            _card(id: 3, title: 'Legacy save', status: InsightStatus.snoozed),
          ],
        );
        await tester.pumpWidget(
          MaterialApp(
            home: ArchiveTab(
              service: fake,
              seriesService: _FakeSeriesService(),
              userId: 'u-1',
            ),
          ),
        );
        await tester.pumpAndSettle();

        expect(find.text('New save'), findsOneWidget);
        expect(find.text('Legacy save'), findsOneWidget);
      },
    );

    testWidgets('empty archive shows the saved-nothing-yet state', (
      tester,
    ) async {
      final fake = _FakeInsightService();
      await tester.pumpWidget(
        MaterialApp(
          home: ArchiveTab(
            service: fake,
            seriesService: _FakeSeriesService(),
            userId: 'u-1',
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Nothing saved yet'), findsOneWidget);
      final images = tester.widgetList<Image>(find.byType(Image)).toList();
      final assetNames = [
        for (final image in images)
          if (image.image case final AssetImage asset) asset.assetName,
      ];
      expect(assetNames, contains(BiotopeGeneratedAssets.emptyArchiveSpecimen));
      expect(
        assetNames,
        isNot(contains(BiotopeGeneratedAssets.archiveHerbariumSpecimen)),
      );
      expect(
        assetNames,
        hasLength(1),
        reason: 'the empty archive owns one intended pressed-flower specimen',
      );
    });
  });
}
