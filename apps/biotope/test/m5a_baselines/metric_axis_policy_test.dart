import 'package:flutter_test/flutter_test.dart';
import 'package:ourobion_metrics/ourobion_metrics.dart';
import 'package:src/modules/m5a_baselines/impl/metric_axis_policy.dart';

void main() {
  group('registry-driven axis tick labels', () {
    test('named categories follow the registry input type', () {
      expect(metricAxisTickLabel('urine_colour', 1), '1 pale');
      expect(metricAxisTickLabel('urine_colour', 8), '8 dark');
      expect(metricAxisTickLabel('stool_form', 1), '1 firm');
      expect(metricAxisTickLabel('stool_form', 4), '4 smooth');
      expect(metricAxisTickLabel('stool_form', 7), '7 watery');
    });

    test('every declared numeric unit is appended without a key policy', () {
      final unitMetrics = kMetrics.where(
        (metric) =>
            metric.status == 'active' &&
            metric.baselineApplicable &&
            metric.unit != null,
      );
      expect(unitMetrics, isNotEmpty);
      for (final metric in unitMetrics) {
        expect(
          metricAxisTickLabel(metric.key, 42),
          endsWith(' ${metric.unit}'),
          reason: '${metric.key} did not use its registry unit',
        );
      }
      expect(metricAxisTickLabel('future_numeric_metric', 4.5), '4.5');
    });
  });

  group('registry-driven detail descriptions', () {
    test('names Armstrong and Bristol scales with their endpoints', () {
      expect(
        metricAxisDescription('urine_colour'),
        'Armstrong urine-colour scale: 1 pale to 8 dark',
      );
      expect(
        metricAxisDescription('stool_form'),
        'Bristol stool-form scale: 1 firm to 7 watery',
      );
    });

    test('uses registry label, scale, and unit for ordinary metrics', () {
      expect(
        metricAxisDescription('gut_comfort_score'),
        'Gut comfort out of 5',
      );
      expect(metricAxisDescription('stool_count'), 'Stool count, 0 to 10');
      expect(
        metricAxisDescription('sleep_duration_min'),
        'Recorded value (min)',
      );
      expect(metricAxisDescription('step_count'), 'Recorded value (steps)');
    });

    test('unknown metadata has a truthful generic fallback', () {
      expect(metricAxisDescription('future_numeric_metric'), 'Recorded value');
    });
  });
}
