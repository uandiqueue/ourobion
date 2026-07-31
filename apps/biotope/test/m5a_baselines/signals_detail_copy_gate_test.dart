// Copy gate for the signals grid, the tile's screen-reader label and the metric
// detail view. Every user-facing string these surfaces own — including the
// SEMANTIC label, which is read aloud and is therefore just as user-facing as
// painted text — must pass the shared non-diagnostic validator. Same pattern as
// insight_copy_gate_test.dart / trend_copy_gate_test.dart.
//
// The detail view's window/error/retry strings come from TrendCopy and are gated
// by trend_copy_gate_test.dart, so they are not duplicated here.

import 'package:flutter_test/flutter_test.dart';
import 'package:ourobion_metrics/ourobion_metrics.dart';
import 'package:src/modules/m1_core/ui/screens/home_tab.dart';
import 'package:src/modules/m5a_baselines/impl/metric_value_format.dart';
import 'package:src/modules/m5a_baselines/ui/screens/metric_detail_screen.dart';
import 'package:src/modules/m5a_baselines/ui/widgets/metric_tile.dart';

import '../../../../shared/constants/copy_guidelines.dart';

void main() {
  void gate(String label, List<String> strings) {
    test('every $label string validates', () {
      expect(strings, isNotEmpty);
      for (final s in strings) {
        expect(
          CopyRules.validateCopyString(s),
          isTrue,
          reason: 'diagnostic language detected in: "$s"',
        );
      }
    });
  }

  group('signals + detail copy passes the non-diagnostic gate', () {
    gate('SignalsCopy', SignalsCopy.all);
    gate('MetricTileCopy', MetricTileCopy.all);
    gate('MetricDetailCopy', MetricDetailCopy.all);

    // The parameterised strings, which `all` cannot hold.
    gate('MetricDetailCopy.recordedDaysAgo', [
      MetricDetailCopy.recordedDaysAgo(2),
      MetricDetailCopy.recordedDaysAgo(29),
    ]);

    gate('MetricDetailCopy.axisUnit', [
      for (final metric in kMetrics.where(
        (metric) => metric.status == 'active' && metric.baselineApplicable,
      ))
        MetricDetailCopy.axisUnit(metric.key),
      MetricDetailCopy.axisUnit('future_numeric_metric'),
    ]);
  });

  group('detail axis wording follows registry metadata', () {
    test('names the two established self-report scales and endpoints', () {
      expect(
        MetricDetailCopy.axisUnit('urine_colour'),
        'Armstrong urine-colour scale: 1 pale to 8 dark',
      );
      expect(
        MetricDetailCopy.axisUnit('stool_form'),
        'Bristol stool-form scale: 1 firm to 7 watery',
      );
    });

    test('keeps honest ordinal, count, sensor, and fallback wording', () {
      expect(MetricDetailCopy.axisUnit(kGutMetricKey), 'Gut comfort out of 5');
      expect(MetricDetailCopy.axisUnit('stool_count'), 'Stool count, 0 to 10');
      expect(
        MetricDetailCopy.axisUnit(kSleepMetricKey),
        'Recorded value (min)',
      );
      expect(
        MetricDetailCopy.axisUnit('future_numeric_metric'),
        'Recorded value',
      );
    });
  });

  group('the grid and the detail view agree on a tile label', () {
    test('every rendered metric has an explicit label', () {
      expect(SignalsCopy.labelFor(kSleepMetricKey), 'Sleep');
      expect(SignalsCopy.labelFor(kGutMetricKey), 'Gut comfort');
      expect(SignalsCopy.labelFor(kHrvMetricKey), 'HRV');
      expect(SignalsCopy.labelFor(kStepsMetricKey), 'Movement');
    });

    test('gut comfort is never labelled with the design\'s /10 scale', () {
      // The mock's "8.4/10" implied a composite index the data does not
      // support; the real signal is a 1-5 self-report ordinal.
      expect(metricValueSuffix(kGutMetricKey), '/5');
      for (final s in SignalsCopy.all) {
        expect(s.contains('/10'), isFalse);
      }
    });

    test(
      'an unknown key falls back to a derived label, never a guessed one',
      () {
        expect(SignalsCopy.labelFor('mood_score'), 'Mood score');
      },
    );
  });
}
