import 'package:flutter/material.dart'; import 'package:flutter_test/flutter_test.dart'; import 'package:src/modules/m5a_baselines/impl/baseline_service.dart';
import 'package:src/modules/m5a_baselines/impl/metric_series_models.dart'; import 'package:src/modules/m5a_baselines/impl/metric_series_service.dart';
import 'package:src/modules/m5a_baselines/ui/screens/metric_detail_screen.dart'; import 'package:src/modules/m5a_baselines/ui/widgets/metric_trend_section.dart';
import 'package:supabase_flutter/supabase_flutter.dart'; SupabaseClient _inertClient() => SupabaseClient(
  'http://localhost',
  'test-key',
  authOptions: const AuthClientOptions(autoRefreshToken: false),
); class _FakeSeriesService extends MetricSeriesService {
  _FakeSeriesService({required this.keys, required this.series})
    : super(_inertClient()); final List<String> keys; final Map<String, List<MetricDailyPoint>> series; @override
  Future<List<String>> getMetricKeys(
    String userId, {
    int windowDays = 30,
  }) async => keys; @override
  Future<List<MetricDailyPoint>> getSeries(
    String userId,
    String metricKey, {
    int windowDays = 30,
  }) async => series[metricKey] ?? const []; }
class _FakeBaselineService extends BaselineService {
  _FakeBaselineService() : super(_inertClient()); @override
  Future<BaselineSnapshot?> getBaseline(String userId, String metricKey) async =>
      null; }
List<MetricDailyPoint> _points(List<(int, double)> days, String source) => [
  for (final (d, v) in days)
    MetricDailyPoint(date: DateTime.utc(2026, 7, d), value: v, source: source),
]; List<MetricDailyPoint> _bristolSeries() => _points(const [
  (4, 4.0),
  (5, 3.0),
  (6, 5.0),
  (8, 4.0),
  (9, 3.0),
], 'self_report'); List<MetricDailyPoint> _armstrongSeries() =>
    _points(const [(4, 2.0), (5, 3.0), (6, 2.0)], 'self_report'); List<MetricDailyPoint> _hrvSeries() =>
    _points(const [(4, 41.0), (5, 47.5), (6, 52.0), (7, 38.0)], 'wearable'); Widget _harness(Widget child) =>
    MaterialApp(home: Scaffold(body: SingleChildScrollView(child: child))); TrendChartPainter _painter(WidgetTester tester) {
  final paint = tester
      .widgetList<CustomPaint>(find.byType(CustomPaint))
      .firstWhere((w) => w.painter is TrendChartPainter); return paint.painter! as TrendChartPainter; }
List<String> _axisLabels(TrendChartPainter painter) {
  final values = [for (final p in painter.points) p.value]; return [
    for (final t in trendAxisTicks(painter.metricKey, values))
      trendAxisLabel(painter.metricKey, t),
  ]; }
Future<void> _pumpSection(
  WidgetTester tester,
  _FakeSeriesService service,
) async {
  await tester.pumpWidget(
    _harness(MetricTrendSection(service: service, userId: 'u-test')),
  ); await tester.pumpAndSettle(); }
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
      ); final painter = _painter(tester); expect(
        painter.metricKey,
        'stool_form',
        reason:
            'the section must tell the painter WHICH metric it is drawing, '
            'otherwise the axis falls back to the metric-agnostic ladder',
      ); final values = [for (final p in painter.points) p.value]; final ticks = trendAxisTicks(painter.metricKey, values); expect(ticks, isNotEmpty); for (final t in ticks) {
        expect(
          t,
          t.roundToDouble(),
          reason: 'a Bristol axis has no half-types',
        ); }
      for (final label in _axisLabels(painter)) {
        expect(
          label,
          isNot(contains('.')),
          reason:
              'rendered "$label" — an interpolated ordinal label is a number '
              'the user never logged',
        ); }
      expect(_axisLabels(painter), ['1 firm', '4 smooth', '7 watery']); }); testWidgets('the ordinal axis spans the whole scale, not the data', (
      tester,
    ) async {
      await _pumpSection(
        tester,
        _FakeSeriesService(
          keys: const ['urine_colour'],
          series: {'urine_colour': _armstrongSeries()},
        ),
      ); final painter = _painter(tester); expect(painter.metricKey, 'urine_colour'); final values = [for (final p in painter.points) p.value]; final bounds = trendAxisBounds(
        painter.metricKey,
        values,
        trendAxisTicks(painter.metricKey, values),
      ); expect(bounds.min, 1); expect(
        bounds.max,
        8,
        reason: 'two logged shades out of eight must not read as the full range',
      ); expect(_axisLabels(painter), ['1 pale', '4 yellow', '8 dark']); }); testWidgets('a continuous series keeps numeric ticks and states its unit', (
      tester,
    ) async {
      await _pumpSection(
        tester,
        _FakeSeriesService(
          keys: const ['hrv_sdnn_ms'],
          series: {'hrv_sdnn_ms': _hrvSeries()},
        ),
      ); final painter = _painter(tester); expect(painter.metricKey, 'hrv_sdnn_ms'); final labels = _axisLabels(painter); expect(labels, isNotEmpty); for (final label in labels) {
        expect(
          label,
          endsWith(' ms'),
          reason: 'a continuous axis must carry the metric unit',
        ); }
      expect(labels, isNot(contains('1 firm'))); }); testWidgets('switching metric re-points the axis at the new metric', (
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
      ); expect(_axisLabels(_painter(tester)).first, '1 firm'); await tester.tap(find.byType(DropdownButton<String>)); await tester.pumpAndSettle(); await tester.tap(find.text('Urine colour').last);
      await tester.pumpAndSettle(); final painter = _painter(tester); expect(painter.metricKey, 'urine_colour'); expect(_axisLabels(painter), ['1 pale', '4 yellow', '8 dark']); }); });
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
      ); await tester.pumpAndSettle(); }
    testWidgets('an ordinal metric gets the ordinal axis here too', (
      tester,
    ) async {
      await pumpDetail(
        tester,
        metricKey: 'stool_form',
        title: 'Stool form',
        points: _bristolSeries(),
      ); final painter = _painter(tester); expect(painter.metricKey, 'stool_form'); for (final label in _axisLabels(painter)) {
        expect(label, isNot(contains('.'))); }
    }); testWidgets('a continuous metric states its unit beside the chart', (
      tester,
    ) async {
      await pumpDetail(
        tester,
        metricKey: 'hrv_sdnn_ms',
        title: 'HRV',
        points: _hrvSeries(),
      ); final axisUnit = MetricDetailCopy.axisUnit('hrv_sdnn_ms'); expect(find.text(axisUnit), findsOneWidget); expect(
        axisUnit,
        contains('ms'),
        reason:
            'the chart plots stored values, so the line above it has to say '
            'which unit those numbers are in',
      ); for (final label in _axisLabels(_painter(tester))) {
        expect(label, endsWith(' ms')); }
    }); }); }
