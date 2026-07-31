// Archive artwork — which specimen image belongs to which archive state.
//
// The design reference renders the EMPTY archive as one card holding exactly
// one breathing specimen image, a title and a body line. A second botanical
// composite in an empty archive is not merely off-reference, it is dishonest:
// a herbarium plate on a screen whose entire message is "you have saved
// nothing yet" reads as a preserved specimen the user already has.
//
// The herbarium plate belongs to the POPULATED archive's strip
// (_ArchiveCollectionArtwork), which must keep rendering when real saved cards
// exist — removing it would be the opposite regression. Both halves are pinned
// here.
//
// archive_status_widget_test.dart pins the archive QUERY behaviour (which rows
// are read and rendered); this suite pins only the artwork/empty-state seam, so
// a change to either cannot silently pass on the strength of the other.
//
// No archive row is invented: the single populated fixture is the same
// hydration card the other archive suites use, and the empty case has no rows
// at all.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:src/core/generated_assets.dart';
import 'package:src/modules/m5a_baselines/impl/metric_series_models.dart';
import 'package:src/modules/m5a_baselines/impl/metric_series_service.dart';
import 'package:src/modules/m5b_insight_engine/impl/insight_service.dart';
import 'package:src/modules/m5b_insight_engine/ui/screens/archive_tab.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// The empty archive's own copy, as the screen renders it verbatim.
const kEmptyArchiveTitle = 'Nothing saved yet';
const kEmptyArchiveBody =
    'Swipe right on a card in Insights to press it into your archive.';

// autoRefreshToken off: the default GoTrue auto-refresh timer trips the test
// binding's pending-timers invariant.
SupabaseClient _inertClient() => SupabaseClient(
  'http://localhost',
  'test-key',
  authOptions: const AuthClientOptions(autoRefreshToken: false),
);

class _FakeInsightService extends InsightService {
  _FakeInsightService({List<InsightCard> archived = const []})
    : archived = List.of(archived),
      super(_inertClient());

  final List<InsightCard> archived;

  @override
  Future<List<InsightCard>> getArchivedInsights(String userId) async =>
      List.of(archived);
}

/// Inert trends section — this suite is about the archive's own artwork, and
/// the trend section carries no images. Series fixtures live in
/// archive_trends_widget_test.dart instead.
class _FakeSeriesService extends MetricSeriesService {
  _FakeSeriesService() : super(_inertClient());

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

InsightCard _card() => InsightCard(
  id: 1,
  userId: 'u-1',
  ruleId: 'hydration_dark_urine',
  generatedAt: DateTime.utc(2026, 7, 28, 2),
  title: 'Hydration pattern',
  body: 'Your data shows a drift from your usual range this week.',
  category: InsightCategory.hydration,
  severity: InsightSeverity.info,
  contributingMetrics: const ['urine_colour'],
  confidenceScore: 0.7,
  confidenceSources: const ['self_report'],
  status: InsightStatus.archived,
  phaseGenerated: 'p2s9',
);

/// Every asset path rendered by an Image.asset currently in the tree.
Set<String> _renderedAssetPaths(WidgetTester tester) {
  return {
    for (final image in tester.widgetList<Image>(find.byType(Image)))
      if (image.image case final AssetImage asset) asset.assetName,
  };
}

/// Pumps a FRESH ArchiveTab. The key is mandatory-by-construction: without a
/// distinct one, a second pump in the same test reuses the existing State and
/// its `late final` service, so the newly injected rows are never read.
Future<void> _pumpArchive(
  WidgetTester tester, {
  List<InsightCard> archived = const [],
  String instance = 'only',
}) async {
  await tester.pumpWidget(
    MaterialApp(
      home: ArchiveTab(
        key: ValueKey('archive-$instance'),
        service: _FakeInsightService(archived: archived),
        seriesService: _FakeSeriesService(),
        userId: 'u-1',
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  group('empty archive', () {
    testWidgets('renders the intended empty-state specimen and its copy', (
      tester,
    ) async {
      await _pumpArchive(tester);

      expect(find.text(kEmptyArchiveTitle), findsOneWidget);
      expect(find.text(kEmptyArchiveBody), findsOneWidget);
      expect(
        _renderedAssetPaths(tester),
        contains(BiotopeGeneratedAssets.emptyArchiveSpecimen),
      );
    });

    testWidgets('does NOT render the herbarium decorative composite', (
      tester,
    ) async {
      await _pumpArchive(tester);

      expect(
        _renderedAssetPaths(tester),
        isNot(contains(BiotopeGeneratedAssets.archiveHerbariumSpecimen)),
        reason:
            'the reference empty state holds exactly one specimen image; a '
            'second botanical composite reads as a saved specimen on a screen '
            'that says nothing has been saved',
      );
    });

    testWidgets('renders exactly ONE image asset in the empty state', (
      tester,
    ) async {
      await _pumpArchive(tester);

      expect(
        _renderedAssetPaths(tester),
        {BiotopeGeneratedAssets.emptyArchiveSpecimen},
        reason: 'one card, one specimen — matching the design reference',
      );
    });

    testWidgets('stays empty — no fabricated archive rows', (tester) async {
      await _pumpArchive(tester);

      expect(find.text('Hydration pattern'), findsNothing);
      expect(
        _renderedAssetPaths(tester),
        isNot(contains(BiotopeGeneratedAssets.archivePreservedFlowerFragment)),
        reason: 'the per-row pressed-flower thumbnail belongs to a real saved '
            'card; drawing one with no rows would invent a specimen',
      );
    });
  });

  group('populated archive', () {
    testWidgets('keeps its herbarium collection strip', (tester) async {
      await _pumpArchive(tester, archived: [_card()]);

      expect(find.text('Hydration pattern'), findsOneWidget);
      expect(
        _renderedAssetPaths(tester),
        contains(BiotopeGeneratedAssets.archiveHerbariumSpecimen),
        reason: '_ArchiveCollectionArtwork is the POPULATED strip — dropping '
            'it while fixing the empty state would be a regression',
      );
    });

    testWidgets('does not render the empty-state specimen or its copy', (
      tester,
    ) async {
      await _pumpArchive(tester, archived: [_card()]);

      expect(find.text(kEmptyArchiveTitle), findsNothing);
      expect(find.text(kEmptyArchiveBody), findsNothing);
      expect(
        _renderedAssetPaths(tester),
        isNot(contains(BiotopeGeneratedAssets.emptyArchiveSpecimen)),
      );
    });

    testWidgets('the two states share no artwork', (tester) async {
      await _pumpArchive(tester, instance: 'empty');
      final empty = _renderedAssetPaths(tester);

      await _pumpArchive(
        tester,
        archived: [_card()],
        instance: 'populated',
      );
      final populated = _renderedAssetPaths(tester);

      expect(empty, isNotEmpty);
      expect(populated, isNotEmpty);
      expect(
        empty.intersection(populated),
        isEmpty,
        reason: 'an image shared by both states cannot be telling the user '
            'which state they are in',
      );
    });
  });
}
