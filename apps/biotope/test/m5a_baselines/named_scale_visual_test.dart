import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:src/core/theme.dart';
import 'package:src/modules/m2_self_report/ui/widgets/daily_scale_value_visual.dart';
import 'package:src/modules/m2_self_report/ui/widgets/daily_scale_visuals.dart';
import 'package:src/modules/m5a_baselines/impl/metric_series_models.dart';
import 'package:src/modules/m5a_baselines/ui/widgets/metric_trend_section.dart';

import '../../../../shared/constants/copy_guidelines.dart';

Widget _harness(Widget child) => MaterialApp(
  home: Scaffold(body: Center(child: child)),
);

DailyScaleValueSummary _summary(String metricKey, int value) =>
    DailyScaleValueSummary(
      metricKey: metricKey,
      value: value,
      style: const TextStyle(fontSize: 14),
      glyphSize: const Size(34, 24),
      bristolColor: OurobionColors.primary,
      borderColor: OurobionColors.outlineVariant,
    );

List<MetricDailyPoint> _points(List<double> values) => [
  for (var index = 0; index < values.length; index++)
    MetricDailyPoint(
      date: DateTime.utc(2026, 7, index + 1),
      value: values[index],
      source: 'self_report',
    ),
];

void main() {
  testWidgets('urine summaries reuse the canonical swatch and name', (
    tester,
  ) async {
    final handle = tester.ensureSemantics();
    await tester.pumpWidget(_harness(_summary('urine_colour', 2)));

    final swatch = tester.widget<Container>(
      find.byKey(const ValueKey('daily-scale-urine_colour-2')),
    );
    expect((swatch.decoration! as BoxDecoration).color, kArmstrongColors[1]);
    expect(find.text('2 - Pale yellow'), findsOneWidget);
    expect(
      find.bySemanticsLabel('Urine colour 2, Pale yellow'),
      findsOneWidget,
    );
    handle.dispose();
  });

  testWidgets('stool summaries reuse the canonical Bristol painter and name', (
    tester,
  ) async {
    final handle = tester.ensureSemantics();
    await tester.pumpWidget(_harness(_summary('stool_form', 4)));

    final glyph = find.byKey(const ValueKey('daily-scale-stool_form-4'));
    expect(glyph, findsOneWidget);
    final paint = tester.widget<CustomPaint>(
      find.descendant(of: glyph, matching: find.byType(CustomPaint)),
    );
    expect(paint.painter, isA<ScaledBristolShapePainter>());
    expect((paint.painter! as ScaledBristolShapePainter).type, 4);
    expect(find.text('Type 4 - Smooth sausage'), findsOneWidget);
    expect(
      find.bySemanticsLabel('Stool form type 4, Smooth sausage'),
      findsOneWidget,
    );
    handle.dispose();
  });

  test('trend ticks expose every rendered named-scale category', () {
    List<String?> labelsFor(String metricKey, List<double> values) =>
        TrendChartPainter(metricKey: metricKey, points: _points(values))
            .semanticsBuilder(const Size(320, 180))
            .map((node) => node.properties.label)
            .toList();

    expect(labelsFor('urine_colour', [1, 4, 8]), [
      'Urine colour 1, Very pale',
      'Urine colour 4, Dark yellow',
      'Urine colour 8, Dark brown',
    ]);
    expect(labelsFor('stool_form', [1, 4, 7]), [
      'Stool form type 1, Separate firm pieces',
      'Stool form type 4, Smooth sausage',
      'Stool form type 7, Watery',
    ]);
  });

  testWidgets('rendered trend ticks reach the raw semantics tree', (
    tester,
  ) async {
    final handle = tester.ensureSemantics();
    await tester.pumpWidget(
      _harness(
        CustomPaint(
          size: const Size(320, 180),
          painter: TrendChartPainter(
            metricKey: 'urine_colour',
            points: _points([1, 4, 8]),
          ),
        ),
      ),
    );
    for (final label in [
      'Urine colour 1, Very pale',
      'Urine colour 4, Dark yellow',
      'Urine colour 8, Dark brown',
    ]) {
      expect(find.semantics.byLabel(label), findsOne);
    }

    await tester.pumpWidget(
      _harness(
        CustomPaint(
          size: const Size(320, 180),
          painter: TrendChartPainter(
            metricKey: 'stool_form',
            points: _points([1, 4, 7]),
          ),
        ),
      ),
    );
    for (final label in [
      'Stool form type 1, Separate firm pieces',
      'Stool form type 4, Smooth sausage',
      'Stool form type 7, Watery',
    ]) {
      expect(find.semantics.byLabel(label), findsOne);
    }
    handle.dispose();
  });

  test('every generated named-scale label passes the copy gate', () {
    for (final entry in {
      'urine_colour': kArmstrongNames.length,
      'stool_form': kBristolNames.length,
    }.entries) {
      for (var value = 1; value <= entry.value; value++) {
        for (final label in [
          dailyScaleValueLabel(entry.key, value)!,
          dailyScaleSemanticLabel(entry.key, value)!,
        ]) {
          expect(
            CopyRules.validateCopyString(label),
            isTrue,
            reason: 'diagnostic language detected in: $label',
          );
        }
      }
    }
  });
}
