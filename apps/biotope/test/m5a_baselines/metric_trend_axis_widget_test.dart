// The metric-aware axis, as actually wired up by the surfaces that draw it.
//
// metric_trend_axis_test.dart pins the axis POLICY against the registry; this
// pins that the widgets hand the SELECTED metric key to the painter, so a
// Bristol series really is drawn on the ordinal axis on screen and never on the
// metric-agnostic ladder that would put a gridline at 2.5.
//
// Readback note: TrendChartPainter draws its tick labels straight onto the
// canvas (TextPainter), not as Text widgets, and exposes no tick getter — so
// the ticks cannot be read back out of the render tree. What IS observable is
// the `metricKey` the painter was constructed with, which is the single input
// that selects the axis; the labels it will therefore draw are derived here
// through the same public `trendAxisTicks` / `trendAxisLabel` functions
// `paint()` calls. A painter handed the wrong key is caught; a painter that
// ignored its own key would not be, which is why the policy suite exists too.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:src/modules/m5a_baselines/impl/baseline_service.dart';
import 'package:src/modules/m5a_baselines/impl/metric_series_models.dart';
import 'package:src/modules/m5a_baselines/impl/metric_series_service.dart';
import 'package:src/modules/m5a_baselines/ui/screens/metric_detail_screen.dart';
import 'package:src/modules/m5a_baselines/ui/widgets/metric_trend_section.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

// autoRefreshToken off: the default GoTrue auto-refresh timer trips the test
// binding's pending-timers invariant.
SupabaseClient _inertClient() => SupabaseClient(
  'http://localhost',
  'test-key',
  authOptions: const AuthClientOptions(autoRefreshToken: false),
);

class _FakeSeriesService extends MetricSeriesService {
  _FakeSeriesService({required this.keys, required this.series})
    : super(_inertClient());

  final List<String> keys;
  final Map<String, List<MetricDailyPoint>> series;

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
  }) async => series[metricKey] ?? const [];
}

class _FakeBaselineService extends BaselineService {
  _FakeBaselineService() : super(_inertClient());

  @override
  Future<BaselineSnapshot?> getBaseline(String userId, String metricKey) async =>
      null;
}

List<MetricDailyPoint> _points(List<(int, double)> days, String source) => [
  for (final (d, v) in days)
    MetricDailyPoint(date: DateTime.utc(2026, 7, d), value: v, source: source),
];

/// A real-shaped ordinal series: whole Bristol types, one per day, with a
/// missing day so the x axis keeps its honest gap. The 3..5 span is exactly the
/// window that would otherwise produce a half-step gridline.
List<MetricDailyPoint> _bristolSeries() => _points(const [
  (4, 4.0),
  (5, 3.0),
  (6, 5.0),
  (8, 4.0),
  (9, 3.0),
], 'self_report');

/// An Armstrong shade series confined to two adjacent shades — the narrow
/// window a metric-agnostic ladder would split in half.
List<MetricDailyPoint> _armstrongSeries() =>
    _points(const [(4, 2.0), (5, 3.0), (6, 2.0)], 'self_report');

List<MetricDailyPoint> _hrvSeries() =>
    _points(const [(4, 41.0), (5, 47.5), (6, 52.0), (7, 38.0)], 'wearable');

Widget _harness(Widget child) =>
    MaterialApp(home: Scaffold(body: SingleChildScrollView(child: child)));

TrendChartPainter _painter(WidgetTester tester) {
  final paint = tester
      .widgetList<CustomPaint>(find.byType(CustomPaint))
      .firstWhere((w) => w.painter is TrendChartPainter);
  return paint.painter! as TrendChartPainter;
}

/// The labels the painter will draw for the series it holds — derived through
/// the same public functions `paint()` uses.
List<String> _axisLabels(TrendChartPainter painter) {
  final values = [for (final p in painter.points) p.value];
  return [
    for (final t in trendAxisTicks(painter.metricKey, values))
      trendAxisLabel(painter.metricKey, t),
  ];
}

Future<void> _pumpSection(
  WidgetTester tester,
  _FakeSeriesService service,
) async {
  await tester.pumpWidget(
    _harness(MetricTrendSection(service: service, userId: 'u-test')),
  );
  await tester.pumpAndSettle();
}

void main() {
  group('MetricTrendSection points the painter at the selected metric', () {
    testWidgets('an ordinal series draws NO fractional axis value', (
      tester,
    ) async {
      await _pumpSection(
        tester,
        _FakeSeriesService(
          keys: const ['stool_form'],
          series: {'stool_form': _bristolSeries()},
        ),
      );

      final painter = _painter(tester);
      expect(
        painter.metricKey,
        'stool_form',
        reason:
            'the section must tell the painter WHICH metric it is drawing, '
            'otherwise the axis falls back to the metric-agnostic ladder',
      );

      final values = [for (final p in painter.points) p.value];
      final ticks = trendAxisTicks(painter.metricKey, values);
      expect(ticks, isNotEmpty);
      for (final t in ticks) {
        expect(
          t,
          t.roundToDouble(),
          reason: 'a Bristol axis has no half-types',
        );
      }
      for (final label in _axisLabels(painter)) {
        expect(
          label,
          isNot(contains('.')),
          reason:
              'rendered "$label" — an interpolated ordinal label is a number '
              'the user never logged',
        );
      }
      // The scale's own vocabulary, at both ends of the declared Bristol range.
      expect(_axisLabels(painter), ['1 firm', '4 smooth', '7 watery']);
    });

    testWidgets('the ordinal axis spans the whole scale, not the data', (
      tester,
    ) async {
      await _pumpSection(
        tester,
        _FakeSeriesService(
          keys: const ['urine_colour'],
          series: {'urine_colour': _armstrongSeries()},
        ),
      );

      final painter = _painter(tester);
      expect(painter.metricKey, 'urine_colour');
      final values = [for (final p in painter.points) p.value];
      final bounds = trendAxisBounds(
        painter.metricKey,
        values,
        trendAxisTicks(painter.metricKey, values),
      );
      expect(bounds.min, 1);
      expect(
        bounds.max,
        8,
        reason: 'two logged shades out of eight must not read as the full range',
      );
      expect(_axisLabels(painter), ['1 pale', '4 yellow', '8 dark']);
    });

    testWidgets('a continuous series keeps numeric ticks and states its unit', (
      tester,
    ) async {
      await _pumpSection(
        tester,
        _FakeSeriesService(
          keys: const ['hrv_sdnn_ms'],
          series: {'hrv_sdnn_ms': _hrvSeries()},
        ),
      );

      final painter = _painter(tester);
      expect(painter.metricKey, 'hrv_sdnn_ms');
      final labels = _axisLabels(painter);
      expect(labels, isNotEmpty);
      for (final label in labels) {
        expect(
          label,
          endsWith(' ms'),
          reason: 'a continuous axis must carry the metric unit',
        );
      }
      // HRV is a real continuous quantity — nothing forces it onto integers.
      expect(labels, isNot(contains('1 firm')));
    });

    testWidgets('switching metric re-points the axis at the new metric', (
      tester,
    ) async {
      await _pumpSection(
        tester,
        _FakeSeriesService(
          keys: const ['stool_form', 'urine_colour'],
          series: {
            'stool_form': _bristolSeries(),
            'urine_colour': _armstrongSeries(),
          },
        ),
      );
      expect(_axisLabels(_painter(tester)).first, '1 firm');

      await tester.tap(find.byType(DropdownButton<String>));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Urine colour').last);
      await tester.pumpAndSettle();

      final painter = _painter(tester);
      expect(painter.metricKey, 'urine_colour');
      expect(_axisLabels(painter), ['1 pale', '4 yellow', '8 dark']);
    });
  });

  group('MetricDetailScreen reuses the same axis', () {
    Future<void> pumpDetail(
      WidgetTester tester, {
      required String metricKey,
      required String title,
      required List<MetricDailyPoint> points,
    }) async {
      await tester.pumpWidget(
        MaterialApp(
          home: MetricDetailScreen(
            metricKey: metricKey,
            title: title,
            seriesService: _FakeSeriesService(
              keys: [metricKey],
              series: {metricKey: points},
            ),
            baselineService: _FakeBaselineService(),
            userId: 'u-test',
            nowUtc: () => DateTime.utc(2026, 7, 10),
          ),
        ),
      );
      await tester.pumpAndSettle();
    }

    testWidgets('an ordinal metric gets the ordinal axis here too', (
      tester,
    ) async {
      await pumpDetail(
        tester,
        metricKey: 'stool_form',
        title: 'Stool form',
        points: _bristolSeries(),
      );

      final painter = _painter(tester);
      expect(painter.metricKey, 'stool_form');
      for (final label in _axisLabels(painter)) {
        expect(label, isNot(contains('.')));
      }
    });

    testWidgets('a continuous metric states its unit beside the chart', (
      tester,
    ) async {
      await pumpDetail(
        tester,
        metricKey: 'hrv_sdnn_ms',
        title: 'HRV',
        points: _hrvSeries(),
      );

      // The stored-value unit line the detail screen owns…
      expect(find.text(MetricDetailCopy.axisUnit('hrv_sdnn_ms')), findsOneWidget);
      expect(MetricDetailCopy.axisUnit('hrv_sdnn_ms'), 'milliseconds');
      // …and the same unit on every gridline the painter will draw.
      for (final label in _axisLabels(_painter(tester))) {
        expect(label, endsWith(' ms'));
      }
    });
  });
}
