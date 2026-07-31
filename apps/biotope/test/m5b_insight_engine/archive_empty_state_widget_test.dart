import 'package:flutter/material.dart'; import 'package:flutter_test/flutter_test.dart'; import 'package:src/core/generated_assets.dart'; import 'package:src/modules/m5a_baselines/index.dart';
import 'package:src/modules/m5b_insight_engine/impl/insight_service.dart'; import 'package:src/modules/m5b_insight_engine/ui/screens/archive_tab.dart';
import 'package:supabase_flutter/supabase_flutter.dart'; const kEmptyArchiveTitle = 'Nothing saved yet'; const kEmptyArchiveBody =
    'Swipe right on a card in Insights to press it into your archive.'; SupabaseClient _inertClient() => SupabaseClient(
  'http://localhost',
  'test-key',
  authOptions: const AuthClientOptions(autoRefreshToken: false),
); class _FakeInsightService extends InsightService {
  _FakeInsightService({List<InsightCard> archived = const []})
    : archived = List.of(archived),
      super(_inertClient()); final List<InsightCard> archived; @override
  Future<List<InsightCard>> getArchivedInsights(String userId) async =>
      List.of(archived); }
class _FakeSeriesService extends MetricSeriesService {
  _FakeSeriesService() : super(_inertClient()); @override
  Future<List<String>> getMetricKeys(
    String userId, {
    int windowDays = 30,
  }) async => const []; @override
  Future<List<MetricDailyPoint>> getSeries(
    String userId,
    String metricKey, {
    int windowDays = 30,
  }) async => const []; }
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
); Set<String> _renderedAssetPaths(WidgetTester tester) {
  return {
    for (final image in tester.widgetList<Image>(find.byType(Image)))
      if (image.image case final AssetImage asset) asset.assetName,
  }; }
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
  ); await tester.pumpAndSettle(); }
void main() {
  group('empty archive', () {
    testWidgets('renders the intended empty-state specimen and its copy', (
      tester,
    ) async {
      await _pumpArchive(tester); expect(find.text(kEmptyArchiveTitle), findsOneWidget); expect(find.text(kEmptyArchiveBody), findsOneWidget); expect(
        _renderedAssetPaths(tester),
        contains(BiotopeGeneratedAssets.emptyArchiveSpecimen),
      ); }); testWidgets('does NOT render the herbarium decorative composite', (
      tester,
    ) async {
      await _pumpArchive(tester); expect(
        _renderedAssetPaths(tester),
        isNot(contains(BiotopeGeneratedAssets.archiveHerbariumSpecimen)),
        reason:
            'the reference empty state holds exactly one specimen image; a '
            'second botanical composite reads as a saved specimen on a screen '
            'that says nothing has been saved',
      ); }); testWidgets('renders exactly ONE image asset in the empty state', (
      tester,
    ) async {
      await _pumpArchive(tester); expect(
        _renderedAssetPaths(tester),
        {BiotopeGeneratedAssets.emptyArchiveSpecimen},
        reason: 'one card, one specimen — matching the design reference',
      ); }); testWidgets('stays empty — no fabricated archive rows', (tester) async {
      await _pumpArchive(tester); expect(find.text('Hydration pattern'), findsNothing); expect(
        _renderedAssetPaths(tester),
        isNot(contains(BiotopeGeneratedAssets.archivePreservedFlowerFragment)),
        reason: 'the per-row pressed-flower thumbnail belongs to a real saved '
            'card; drawing one with no rows would invent a specimen',
      ); }); }); group('populated archive', () {
    testWidgets('keeps its herbarium collection strip', (tester) async {
      await _pumpArchive(tester, archived: [_card()]); expect(find.text('Hydration pattern'), findsOneWidget); expect(
        _renderedAssetPaths(tester),
        contains(BiotopeGeneratedAssets.archiveHerbariumSpecimen),
        reason: '_ArchiveCollectionArtwork is the POPULATED strip — dropping '
            'it while fixing the empty state would be a regression',
      ); }); testWidgets('does not render the empty-state specimen or its copy', (
      tester,
    ) async {
      await _pumpArchive(tester, archived: [_card()]); expect(find.text(kEmptyArchiveTitle), findsNothing); expect(find.text(kEmptyArchiveBody), findsNothing); expect(
        _renderedAssetPaths(tester),
        isNot(contains(BiotopeGeneratedAssets.emptyArchiveSpecimen)),
      ); }); testWidgets('the two states share no artwork', (tester) async {
      await _pumpArchive(tester, instance: 'empty'); final empty = _renderedAssetPaths(tester); await _pumpArchive(
        tester,
        archived: [_card()],
        instance: 'populated',
      ); final populated = _renderedAssetPaths(tester); expect(empty, isNotEmpty); expect(populated, isNotEmpty); expect(
        empty.intersection(populated),
        isEmpty,
        reason: 'an image shared by both states cannot be telling the user '
            'which state they are in',
      ); }); }); }
