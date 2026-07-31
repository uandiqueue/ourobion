import 'package:ourobion_metrics/ourobion_metrics.dart';

import 'chart_math.dart';

/// Registry-driven wording for M5a chart axes.
///
/// Metric identity is deliberately not policy here. Named category wording is
/// selected by the registry's UI input type; numeric labels and detail copy use
/// its unit, label, scale, and value increment. A newly registered numeric
/// metric therefore needs no chart-source edit.
String metricAxisTickLabel(String metricKey, double tick) {
  final metric = metricByKey(metricKey);
  if (metric == null) return compactValueLabel(tick);

  final categoryLabel = switch (metric.ui?.inputType) {
    'armstrong_1_8' => _armstrongTickLabel(tick),
    'bristol_1_7' => _bristolTickLabel(tick),
    _ => null,
  };
  if (categoryLabel != null) return categoryLabel;

  final valueStep = metric.valueStep?.toDouble();
  final value = valueStep == null
      ? compactValueLabel(tick)
      : steppedValueLabel(tick, valueStep);
  final unit = metric.unit;
  return unit == null || unit.isEmpty ? value : '$value $unit';
}

/// Plain-language description displayed above the detail chart.
String metricAxisDescription(String metricKey) {
  final metric = metricByKey(metricKey);
  if (metric == null) return 'Recorded value';

  final namedScale = switch (metric.ui?.inputType) {
    'armstrong_1_8' => _namedScaleDescription(
      metric,
      name: 'Armstrong urine-colour',
      lowLabel: 'pale',
      highLabel: 'dark',
    ),
    'bristol_1_7' => _namedScaleDescription(
      metric,
      name: 'Bristol stool-form',
      lowLabel: 'firm',
      highLabel: 'watery',
    ),
    _ => null,
  };
  if (namedScale != null) return namedScale;

  final label = metric.ui?.label;
  final scale = metric.scale;
  if (metric.ui?.inputType == 'likert_1_5' && label != null && scale != null) {
    return '$label out of ${compactValueLabel(scale.max.toDouble())}';
  }

  final unit = metric.unit;
  if (unit != null && unit.isNotEmpty) {
    return label == null ? 'Recorded value ($unit)' : '$label ($unit)';
  }

  if (label != null && scale != null) {
    return '$label, ${compactValueLabel(scale.min.toDouble())} to '
        '${compactValueLabel(scale.max.toDouble())}';
  }
  return label ?? 'Recorded value';
}

String? _namedScaleDescription(
  MetricDefinition metric, {
  required String name,
  required String lowLabel,
  required String highLabel,
}) {
  final scale = metric.scale;
  if (scale == null) return null;
  return '$name scale: ${compactValueLabel(scale.min.toDouble())} $lowLabel '
      'to ${compactValueLabel(scale.max.toDouble())} $highLabel';
}

String _armstrongTickLabel(double tick) => switch (tick.round()) {
  1 => '1 pale',
  4 => '4 yellow',
  8 => '8 dark',
  _ => compactValueLabel(tick.roundToDouble()),
};

String _bristolTickLabel(double tick) => switch (tick.round()) {
  1 => '1 firm',
  4 => '4 smooth',
  7 => '7 watery',
  _ => compactValueLabel(tick.roundToDouble()),
};
