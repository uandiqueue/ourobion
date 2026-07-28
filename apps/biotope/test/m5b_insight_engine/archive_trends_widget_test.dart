// Issue #200 — ArchiveTab's new historical-metric-trends section.
//
// Archive previously only rendered saved insight cards (getArchivedInsights).
// It now also renders a real per-metric trend history via the SAME reused
// MetricTrendSection/MetricSeriesService/chart_math Home's TRENDS section
// uses — no new axis math, no synthetic series.
//
// Covers, per the issue's hard constraints:
//   * trends render from real series data;
//   * an empty series renders the explicit no-history state, never a chart;
//   * a failed load (both the archived-cards read and the trend read) shows
//     an error state with a retry, never an endless spinner;
//   * the two sections are labelled with distinguishing eyebrows.
//
// Same fake-client construction as archive_status_widget_test.dart —
// Supabase.instance cannot be initialised under flutter test, so both
// services are injected.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:src/modules/m5a_baselines/impl/metric_series_models.dart';
import 'package:src/modules/m5a_baselines/impl/metric_series_service.dart';
import 'package:src/modules/m5a_baselines/ui/widgets/metric_trend_section.dart';
import 'package:src/modules/m5b_insight_engine/impl/insight_service.dart';
import 'package:src/modules/m5b_insight_engine/ui/screens/archive_tab.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class _FakeInsightService extends InsightService {
  _FakeInsightService({this.archived = const [], this.failFirstCalls = 0})
      : super(SupabaseClient(
          'http://localhost',
          'test-key',
          authOptions: const AuthClientOptions(autoRefreshToken: false),
        ));

  final List<InsightCard> archived;

  /// Number of leading calls to [getArchivedInsights] that throw before it
  /// starts succeeding — lets a test exercise both the failure state AND a
  /// successful retry with one fake.
  final int failFirstCalls;
  int _calls = 0;

  @override
  Future<List<InsightCard>> getInsights(String userId) async => const [];

  @override
  Future<List<InsightCard>> getArchivedInsights(String userId) async {
    _calls++;
    if (_calls <= failFirstCalls) {
      throw Exception('simulated archive read failure');
    }
    return archived;
  }
}

class _FakeSeriesService extends MetricSeriesService {
  _FakeSeriesService({
    this.keys = const [],
    this.points = const [],
    this.failFirstCalls = 0,
  }) : super(SupabaseClient(
          'http://localhost',
          'test-key',
          authOptions: const AuthClientOptions(autoRefreshToken: false),
        ));

  final List<String> keys;
  final List<MetricDailyPoint> points;

  /// Number of leading calls to [getMetricKeys] that throw before succeeding.
  final int failFirstCalls;
  int _calls = 0;

  @override
  Future<List<String>> getMetricKeys(String userId, {int windowDays = 30}) async {
    _calls++;
    if (_calls <= failFirstCalls) {
      throw Exception('simulated trend read failure');
    }
    return keys;
  }

  @override
  Future<List<MetricDailyPoint>> getSeries(
    String userId,
    String metricKey, {
    int windowDays = 30,
  }) async => points;
}

InsightCard _card({int id = 1, String title = 'Hydration pattern'}) {
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
    status: InsightStatus.archived,
    phaseGenerated: 'p2s9',
  );
}

List<MetricDailyPoint> _realSeries() => [
      for (var d = 1; d <= 10; d++)
        MetricDailyPoint(
          date: DateTime.utc(2026, 7, d),
          value: 3 + (d % 3).toDouble(),
          source: 'self_report',
        ),
    ];

Widget _harness(Widget child) => MaterialApp(home: child);

void main() {
  group('ArchiveTab trends section (issue #200)', () {
    testWidgets('renders both section eyebrows so the halves are distinguishable',
        (tester) async {
      await tester.pumpWidget(_harness(ArchiveTab(
        service: _FakeInsightService(archived: [_card()]),
        seriesService: _FakeSeriesService(
          keys: ['gut_comfort_score'],
          points: _realSeries(),
        ),
        userId: 'u-1',
      )));
      await tester.pumpAndSettle();

      expect(find.text(ArchiveTabCopy.savedEyebrow), findsOneWidget);
      expect(find.text(TrendCopy.eyebrow), findsOneWidget);
    });

    testWidgets('trends render from real series data', (tester) async {
      final series = _FakeSeriesService(
        keys: ['gut_comfort_score'],
        points: _realSeries(),
      );
      await tester.pumpWidget(_harness(ArchiveTab(
        service: _FakeInsightService(archived: [_card()]),
        seriesService: series,
        userId: 'u-1',
      )));
      await tester.pumpAndSettle();

      // The real metric label and window copy came from the fake's actual
      // data — not a placeholder — and a chart was painted for it.
      expect(find.text('Gut comfort score'), findsOneWidget);
      expect(find.text(TrendCopy.windowLabel), findsOneWidget);
      expect(
        find.byWidgetPredicate((w) => w is CustomPaint && w.painter is TrendChartPainter),
        findsOneWidget,
      );
    });

    testWidgets(
        'a metric with no history renders the explicit no-history state, not a chart',
        (tester) async {
      // No metric keys at all in the window — the honest "nothing to show
      // yet" case, not an empty/flat chart implying data exists.
      await tester.pumpWidget(_harness(ArchiveTab(
        service: _FakeInsightService(archived: [_card()]),
        seriesService: _FakeSeriesService(keys: [], points: []),
        userId: 'u-1',
      )));
      await tester.pumpAndSettle();

      expect(find.text(TrendCopy.emptyTitle), findsOneWidget);
      expect(find.text(TrendCopy.emptyBody), findsOneWidget);
      expect(
        find.byWidgetPredicate((w) => w is CustomPaint && w.painter is TrendChartPainter),
        findsNothing,
        reason: 'no metric history exists — nothing should be drawn as if it did',
      );
    });

    testWidgets(
        'a metric selected but with an empty series in-window shows the no-values note, not a chart',
        (tester) async {
      // Keys exist (so the picker renders) but the series read for the
      // selected key came back empty — still must not fabricate a chart.
      await tester.pumpWidget(_harness(ArchiveTab(
        service: _FakeInsightService(archived: [_card()]),
        seriesService: _FakeSeriesService(keys: ['gut_comfort_score'], points: []),
        userId: 'u-1',
      )));
      await tester.pumpAndSettle();

      expect(find.text(TrendCopy.noValuesForMetric), findsOneWidget);
      expect(
        find.byWidgetPredicate((w) => w is CustomPaint && w.painter is TrendChartPainter),
        findsNothing,
      );
    });

    testWidgets(
        'a failed archived-cards load shows an error state with a retry, never an endless spinner',
        (tester) async {
      final service = _FakeInsightService(archived: [_card()], failFirstCalls: 1);
      await tester.pumpWidget(_harness(ArchiveTab(
        service: service,
        seriesService: _FakeSeriesService(),
        userId: 'u-1',
      )));
      await tester.pumpAndSettle();

      expect(find.byType(CircularProgressIndicator), findsNothing,
          reason: 'a thrown read must not leave the tab spinning forever');
      expect(find.text(ArchiveTabCopy.loadFailed), findsOneWidget);
      final retryButton = find.widgetWithText(OutlinedButton, ArchiveTabCopy.retry);
      expect(retryButton, findsOneWidget);

      // Tap retry — the second call succeeds, so the real card must appear.
      await tester.tap(retryButton);
      await tester.pumpAndSettle();

      expect(find.text(ArchiveTabCopy.loadFailed), findsNothing);
      expect(find.text('Hydration pattern'), findsOneWidget);
    });

    testWidgets(
        'a failed trend load shows its own error state with a retry, never an endless spinner',
        (tester) async {
      final series = _FakeSeriesService(
        keys: ['gut_comfort_score'],
        points: _realSeries(),
        failFirstCalls: 1,
      );
      await tester.pumpWidget(_harness(ArchiveTab(
        service: _FakeInsightService(archived: [_card()]),
        seriesService: series,
        userId: 'u-1',
      )));
      await tester.pumpAndSettle();

      expect(find.byType(CircularProgressIndicator), findsNothing,
          reason: 'a thrown trend read must not leave the section spinning forever');
      expect(find.text(TrendCopy.loadError), findsOneWidget);
      final retryButton = find.widgetWithText(OutlinedButton, TrendCopy.retry);
      expect(retryButton, findsOneWidget);

      // Second call succeeds — the retry must actually recover, not just
      // exist decoratively.
      await tester.tap(retryButton);
      await tester.pumpAndSettle();

      expect(find.text(TrendCopy.loadError), findsNothing);
      expect(find.text('Gut comfort score'), findsOneWidget);
    });

    testWidgets('the saved-insights list still renders untouched by the trends addition',
        (tester) async {
      await tester.pumpWidget(_harness(ArchiveTab(
        service: _FakeInsightService(archived: [_card(id: 9, title: 'Kept insight')]),
        seriesService: _FakeSeriesService(),
        userId: 'u-1',
      )));
      await tester.pumpAndSettle();

      expect(find.text('Kept insight'), findsOneWidget);
    });
  });
}
