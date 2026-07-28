// Pure formatting shared by the Home signals grid and the metric detail view.
// Home used to format sleep with a private helper and render the step count
// ungrouped; the detail view would otherwise have re-derived both and drifted.

import 'package:flutter_test/flutter_test.dart';
import 'package:src/modules/m5a_baselines/impl/metric_value_format.dart';

void main() {
  group('formatDurationMinutes', () {
    test('renders hours and minutes', () {
      expect(formatDurationMinutes(432), '7h 12m');
      expect(formatDurationMinutes(60), '1h 0m');
      expect(formatDurationMinutes(0), '0h 0m');
      expect(formatDurationMinutes(59), '0h 59m');
    });

    test('rounds to the nearest minute rather than truncating', () {
      // The old private helper did `minutes ~/ 60` with a separately rounded
      // remainder, so 419.7 could read '6h 60m'.
      expect(formatDurationMinutes(431.7), '7h 12m');
      expect(formatDurationMinutes(419.7), '7h 0m');
    });
  });

  group('formatGroupedInt', () {
    test('groups thousands like the design', () {
      expect(formatGroupedInt(8204), '8,204');
      expect(formatGroupedInt(999), '999');
      expect(formatGroupedInt(1000), '1,000');
      expect(formatGroupedInt(1234567), '1,234,567');
      expect(formatGroupedInt(0), '0');
    });

    test('keeps a negative sign outside the grouping', () {
      expect(formatGroupedInt(-1204), '-1,204');
    });
  });

  group('formatMetricValue', () {
    test('formats each rendered metric in its own units', () {
      expect(formatMetricValue(kSleepMetricKey, 432), '7h 12m');
      expect(formatMetricValue(kGutMetricKey, 4), '4.0');
      expect(formatMetricValue(kHrvMetricKey, 61.6), '62');
      expect(formatMetricValue(kStepsMetricKey, 8204), '8,204');
    });

    test('an unknown key gets a plain number, never a guessed unit', () {
      expect(formatMetricValue('mood_score', 3), '3');
      expect(formatMetricValue('mood_score', 3.5), '3.5');
    });
  });

  group('metricValueSuffix', () {
    test('only the metrics that need one carry a suffix', () {
      expect(metricValueSuffix(kGutMetricKey), '/5');
      expect(metricValueSuffix(kHrvMetricKey), 'ms');
      // Sleep's formatted value already carries its units; a step count has none.
      expect(metricValueSuffix(kSleepMetricKey), isNull);
      expect(metricValueSuffix(kStepsMetricKey), isNull);
    });
  });

  group('formatMetricDelta', () {
    test('signs the difference and keeps the metric units', () {
      expect(formatMetricDelta(kSleepMetricKey, 18), '+18m');
      expect(formatMetricDelta(kSleepMetricKey, -18), '-18m');
      expect(formatMetricDelta(kHrvMetricKey, -3), '-3 ms');
      expect(formatMetricDelta(kHrvMetricKey, 3), '+3 ms');
      expect(formatMetricDelta(kStepsMetricKey, 1204), '+1,204');
      expect(formatMetricDelta(kStepsMetricKey, -1204), '-1,204');
    });

    test('a metric with no additive delta returns null, not a fake zero', () {
      expect(formatMetricDelta(kGutMetricKey, 0.4), isNull);
    });
  });
}
