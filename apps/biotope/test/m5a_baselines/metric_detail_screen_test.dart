// Metric detail view: the destination of a Home "Signals today" tile press.
//
// The screen takes injectable services + userId + clock, so this never touches
// Supabase.instance (the initialize blocker that keeps other screens out of
// widget tests).
//
// The load-bearing assertions here are the HONEST-STATE ones: a metric with no
// history must render its own words and paint NO chart, so an absent series can
// never be mistaken for a measured flat line; and a real-but-old reading must
// say how old it is rather than passing itself off as current.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:src/modules/m5a_baselines/impl/baseline_service.dart';
import 'package:src/modules/m5a_baselines/impl/metric_series_models.dart';
import 'package:src/modules/m5a_baselines/impl/metric_series_service.dart';
import 'package:src/modules/m5a_baselines/impl/metric_value_format.dart';
import 'package:src/modules/m5a_baselines/ui/screens/metric_detail_screen.dart';
import 'package:src/modules/m5a_baselines/ui/widgets/metric_trend_section.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

// autoRefreshToken off: the default GoTrue auto-refresh timer trips the test
// binding's pending-timers invariant (same as metric_trend_section_widget_test).
SupabaseClient _inertClient() => SupabaseClient(
  'http://localhost',
  'test-key',
  authOptions: const AuthClientOptions(autoRefreshToken: false),
);

class _FakeSeriesService extends MetricSeriesService {
  final List<MetricDailyPoint> points;

  /// Fails the first N calls, then succeeds — so a retry can be proven to
  /// RECOVER, not merely to show an error.
  int failFirst;
  int calls = 0;

  _FakeSeriesService({this.points = const [], this.failFirst = 0})
    : super(_inertClient());

  @override
  Future<List<MetricDailyPoint>> getSeries(
    String userId,
    String metricKey, {
    int windowDays = 30,
  }) async {
    calls++;
    if (failFirst > 0) {
      failFirst--;
      throw Exception('read failed');
    }
    return points;
  }
}

class _FakeBaselineService extends BaselineService {
  final BaselineSnapshot? snapshot;
  _FakeBaselineService({this.snapshot}) : super(_inertClient());

  @override
  Future<BaselineSnapshot?> getBaseline(String userId, String metricKey) async =>
      snapshot;
}

BaselineSnapshot _baseline({
  double? mean = 430,
  double? min = 380,
  double? max = 470,
  int daysOfData = 12,
  BaselineTrend? trend = BaselineTrend.rising,
  BaselineConfidence confidence = BaselineConfidence.medium,
}) {
  return BaselineSnapshot(
    id: 1,
    userId: 'u-test',
    metricKey: kSleepMetricKey,
    computedAt: DateTime.utc(2026, 7, 28),
    daysOfData: daysOfData,
    mean: mean,
    min: min,
    max: max,
    trend: trend,
    confidence: confidence,
    dataSources: const ['self_report'],
  );
}

/// Seven real days of sleep minutes ending on [lastDay] of July 2026.
List<MetricDailyPoint> _sleepSeries({int lastDay = 28, int days = 7}) => [
  for (var i = days - 1; i >= 0; i--)
    MetricDailyPoint(
      date: DateTime.utc(2026, 7, lastDay - i),
      value: 420 + (i * 3).toDouble(),
      source: 'self_report',
    ),
];

DateTime Function() _clock([int day = 28]) =>
    () => DateTime.utc(2026, 7, day, 9);

Widget _host({
  required MetricSeriesService series,
  BaselineService? baseline,
  DateTime Function()? nowUtc,
  String metricKey = kSleepMetricKey,
  String title = 'Sleep',
}) {
  return MaterialApp(
    home: MetricDetailScreen(
      metricKey: metricKey,
      title: title,
      seriesService: series,
      baselineService: baseline ?? _FakeBaselineService(),
      userId: 'u-test',
      nowUtc: nowUtc ?? _clock(),
    ),
  );
}

Finder get _chart => find.byWidgetPredicate(
  (w) => w is CustomPaint && w.painter is TrendChartPainter,
);

/// A viewport tall enough to hold the whole scroll view, so an assertion about
/// a row being ABSENT cannot pass merely because the ListView never built it.
void _tallSurface(WidgetTester tester) {
  tester.view.physicalSize = const Size(1080, 3200);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);
}

void main() {
  testWidgets('real history renders the shared trend chart and the latest value', (
    tester,
  ) async {
    await tester.pumpWidget(
      _host(
        series: _FakeSeriesService(points: _sleepSeries()),
        baseline: _FakeBaselineService(snapshot: _baseline()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Sleep'), findsOneWidget);
    expect(find.text(MetricDetailCopy.eyebrow), findsOneWidget);

    // Reuses TrendChartPainter — the same painter Home's and Archive's trend
    // sections use. A second charting path would fail this.
    expect(_chart, findsOneWidget);

    // Latest point is 420 minutes, formatted through the shared formatter.
    expect(find.text('7h 0m'), findsOneWidget);
    // Recency and the reading's own date share one line.
    expect(
      find.text('${MetricDetailCopy.recordedToday} · 28 Jul'),
      findsOneWidget,
    );

    // Date axis endpoints of the seven real days.
    expect(find.textContaining('22 Jul'), findsWidgets);
    expect(find.textContaining('28 Jul'), findsWidgets);
  });

  testWidgets('a metric with NO history says so and paints no chart', (
    tester,
  ) async {
    await tester.pumpWidget(_host(series: _FakeSeriesService(points: const [])));
    await tester.pumpAndSettle();

    expect(find.text(MetricDetailCopy.emptyTitle), findsOneWidget);
    expect(find.text(MetricDetailCopy.emptyBody), findsOneWidget);
    expect(
      _chart,
      findsNothing,
      reason: 'an empty or flat chart would imply a measurement that never '
          'happened',
    );
    expect(find.text(MetricDetailCopy.historyLabel), findsNothing);
  });

  testWidgets('a stale newest reading says how old it is', (tester) async {
    await tester.pumpWidget(
      _host(
        // Newest point is 24 Jul; "today" is 28 Jul.
        series: _FakeSeriesService(points: _sleepSeries(lastDay: 24)),
        nowUtc: _clock(28),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.textContaining(MetricDetailCopy.recordedDaysAgo(4)), findsOneWidget);
    expect(find.textContaining(MetricDetailCopy.recordedToday), findsNothing);
  });

  testWidgets('yesterday is named, not counted', (tester) async {
    await tester.pumpWidget(
      _host(
        series: _FakeSeriesService(points: _sleepSeries(lastDay: 27)),
        nowUtc: _clock(28),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.textContaining(MetricDetailCopy.recordedYesterday), findsOneWidget);
  });

  testWidgets('one reading is drawn as one point, with a note instead of a line', (
    tester,
  ) async {
    await tester.pumpWidget(
      _host(series: _FakeSeriesService(points: _sleepSeries(days: 1))),
    );
    await tester.pumpAndSettle();

    expect(_chart, findsOneWidget);
    expect(find.text(MetricDetailCopy.singlePointNote), findsOneWidget);
  });

  testWidgets('a failed read is recoverable, not a dead end', (tester) async {
    final service = _FakeSeriesService(points: _sleepSeries(), failFirst: 1);
    await tester.pumpWidget(_host(series: service));
    await tester.pumpAndSettle();

    expect(find.text(TrendCopy.loadError), findsOneWidget);
    expect(_chart, findsNothing);

    await tester.tap(find.text(TrendCopy.retry));
    await tester.pumpAndSettle();

    expect(service.calls, 2);
    expect(find.text(TrendCopy.loadError), findsNothing);
    expect(_chart, findsOneWidget);
  });

  testWidgets('a load never leaves the screen on a spinner', (tester) async {
    final service = _FakeSeriesService(points: _sleepSeries(), failFirst: 5);
    await tester.pumpWidget(_host(series: service));
    await tester.pumpAndSettle();

    expect(find.byType(CircularProgressIndicator), findsNothing);
  });

  testWidgets('a computed baseline renders only the fields it actually has', (
    tester,
  ) async {
    _tallSurface(tester);
    await tester.pumpWidget(
      _host(
        series: _FakeSeriesService(points: _sleepSeries()),
        baseline: _FakeBaselineService(
          snapshot: _baseline(mean: null, min: null, max: null),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(
      find.text(MetricDetailCopy.meanLabel),
      findsNothing,
      reason: 'a snapshot with no mean must show no Average row, not a 0',
    );
    expect(find.text(MetricDetailCopy.rangeLabel), findsNothing);
    expect(find.text(MetricDetailCopy.daysLabel), findsOneWidget);
    expect(find.text(MetricDetailCopy.directionRising), findsOneWidget);
    expect(find.text(MetricDetailCopy.confidenceMedium), findsOneWidget);
  });

  testWidgets('a baseline formats its numbers in the metric own units', (
    tester,
  ) async {
    _tallSurface(tester);
    await tester.pumpWidget(
      _host(
        series: _FakeSeriesService(points: _sleepSeries()),
        baseline: _FakeBaselineService(snapshot: _baseline()),
      ),
    );
    await tester.pumpAndSettle();

    // 430 / 380 / 470 minutes as durations, not raw minute counts.
    expect(find.text('7h 10m'), findsOneWidget);
    expect(find.text('6h 20m – 7h 50m'), findsOneWidget);
  });

  testWidgets('no baseline yet says so plainly', (tester) async {
    _tallSurface(tester);
    await tester.pumpWidget(
      _host(
        series: _FakeSeriesService(points: _sleepSeries()),
        baseline: _FakeBaselineService(),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text(MetricDetailCopy.noBaselineTitle), findsOneWidget);
    expect(find.text(MetricDetailCopy.noBaselineBody), findsOneWidget);
  });
}
