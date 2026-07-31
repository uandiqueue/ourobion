// U7 trend view widget test. The section takes an injectable service +
// userId, so this never touches Supabase.instance (the initialize blocker
// that keeps other screens out of widget tests).

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:src/modules/m5a_baselines/impl/metric_series_models.dart';
import 'package:src/modules/m5a_baselines/impl/metric_series_service.dart';
import 'package:src/modules/m5a_baselines/ui/widgets/metric_trend_section.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class _FakeSeriesService extends MetricSeriesService {
  final List<String> keys;
  final List<MetricDailyPoint> points;
  final List<String> seriesRequests = [];

  // autoRefreshToken off: the default GoTrue auto-refresh timer trips the
  // test binding's pending-timers invariant.
  _FakeSeriesService({required this.keys, required this.points})
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
  }) async => keys;

  @override
  Future<List<MetricDailyPoint>> getSeries(
    String userId,
    String metricKey, {
    int windowDays = 30,
  }) async {
    seriesRequests.add(metricKey);
    return points;
  }
}

Widget _harness(Widget child) {
  return MaterialApp(
    home: Scaffold(body: SingleChildScrollView(child: child)),
  );
}

List<MetricDailyPoint> _series() => [
  for (var d = 4; d <= 24; d++)
    MetricDailyPoint(
      date: DateTime.utc(2026, 7, d),
      value: 3 + (d % 3).toDouble(),
      source: 'self_report',
    ),
];

void main() {
  group('metric-aware y-axis', () {
    test('urine and stool stay on labelled ordinal categories', () {
      expect(trendAxisTicks('urine_colour', [2, 5, 7]), [1, 4, 8]);
      expect(trendAxisLabel('urine_colour', 1), '1 pale');
      expect(trendAxisLabel('urine_colour', 8), '8 dark');
      expect(trendAxisBounds('urine_colour', [2, 5, 7], [1, 4, 8]).min, 1);
      expect(trendAxisBounds('urine_colour', [2, 5, 7], [1, 4, 8]).max, 8);

      expect(trendAxisTicks('stool_form', [2, 4, 6]), [1, 4, 7]);
      expect(trendAxisLabel('stool_form', 1), '1 firm');
      expect(trendAxisLabel('stool_form', 4), '4 smooth');
      expect(trendAxisLabel('stool_form', 7), '7 watery');
    });

    test('continuous metrics keep numeric ticks with their units', () {
      final ticks = trendAxisTicks('sleep_duration_min', [360, 390, 420]);
      expect(ticks, isNotEmpty);
      for (final tick in ticks) {
        expect(trendAxisLabel('sleep_duration_min', tick), endsWith(' min'));
      }
      expect(trendAxisLabel('resting_hr_bpm', 62), '62 bpm');
      expect(trendAxisLabel('hrv_sdnn_ms', 44), '44 ms');
    });
  });

  testWidgets('renders picker + chart and preselects gut_comfort_score', (
    tester,
  ) async {
    final service = _FakeSeriesService(
      keys: ['energy_score', 'gut_comfort_score', 'mood_score'],
      points: _series(),
    );
    await tester.pumpWidget(
      _harness(MetricTrendSection(service: service, userId: 'u-test')),
    );
    await tester.pumpAndSettle();

    // Demo hero metric preselected.
    expect(service.seriesRequests, ['gut_comfort_score']);
    expect(find.text('Gut comfort score'), findsOneWidget);
    expect(find.text(TrendCopy.windowLabel), findsOneWidget);
    expect(find.byType(CustomPaint), findsWidgets);
    // Date axis endpoints of the 21-day series.
    expect(find.text('4 Jul'), findsOneWidget);
    expect(find.text('24 Jul'), findsOneWidget);
  });

  testWidgets('empty data renders the empty state, no chart', (tester) async {
    final service = _FakeSeriesService(keys: [], points: []);
    await tester.pumpWidget(
      _harness(MetricTrendSection(service: service, userId: 'u-test')),
    );
    await tester.pumpAndSettle();

    expect(find.text(TrendCopy.emptyTitle), findsOneWidget);
    expect(find.text(TrendCopy.emptyBody), findsOneWidget);
    expect(find.byType(DropdownButton<String>), findsNothing);
  });

  testWidgets('reload() re-fetches the selected series', (tester) async {
    final service = _FakeSeriesService(
      keys: ['gut_comfort_score'],
      points: _series(),
    );
    final key = GlobalKey<MetricTrendSectionState>();
    await tester.pumpWidget(
      _harness(
        MetricTrendSection(key: key, service: service, userId: 'u-test'),
      ),
    );
    await tester.pumpAndSettle();
    expect(service.seriesRequests, hasLength(1));

    await key.currentState!.reload();
    await tester.pumpAndSettle();
    expect(service.seriesRequests, hasLength(2));
  });
}
