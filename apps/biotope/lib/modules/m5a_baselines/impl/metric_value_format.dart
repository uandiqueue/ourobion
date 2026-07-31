// Per-metric display formatting, shared by the Home signals grid and the metric
// detail screen so one metric never reads differently on the two surfaces
// (Home used to format sleep with a private `_formatSleep` and render steps
// ungrouped; the detail view would have had to re-derive both).
//
// This file deliberately has NO package imports (same rule as
// metric_series_models.dart / chart_math.dart) — it is pure formatting over a
// double and is unit-testable without a canvas or a Flutter binding.

/// The metric registry keys (package:ourobion_metrics/ourobion_metrics.dart) the Home signals
/// grid renders and the detail view drills into.
///
/// "Gut comfort" is the closest real signal to the design's composite "gut
/// score": a 1-5 self-report ordinal, not a 0-10 index, so it is labelled and
/// suffixed accordingly rather than overclaiming the "/10" the mock implied.
const String kSleepMetricKey = 'sleep_duration_min';
const String kGutMetricKey = 'gut_comfort_score';
const String kHrvMetricKey = 'hrv_sdnn_ms';
const String kStepsMetricKey = 'step_count';

/// A metric's stored value as the UI shows it: sleep minutes as a duration,
/// steps grouped, HRV whole milliseconds, gut comfort to one decimal.
///
/// Unknown keys fall back to a plain number — never a guessed unit.
String formatMetricValue(String metricKey, double value) {
  switch (metricKey) {
    case kSleepMetricKey:
      return formatDurationMinutes(value);
    case kGutMetricKey:
      return value.toStringAsFixed(1);
    case kHrvMetricKey:
      return value.round().toString();
    case kStepsMetricKey:
      return formatGroupedInt(value.round());
    default:
      return value == value.roundToDouble()
          ? value.round().toString()
          : value.toStringAsFixed(1);
  }
}

/// The short trailing unit rendered next to the value ('ms', '/5'), or null when
/// the formatted value already carries its own unit (sleep's 'h'/'m') or has
/// none (a step count).
String? metricValueSuffix(String metricKey) => switch (metricKey) {
  kGutMetricKey => '/5',
  kHrvMetricKey => 'ms',
  _ => null,
};

/// A signed difference between a value and its baseline, in the metric's own
/// units — e.g. '+18m', '-3 ms', '+1,204'. Returns null for metrics with no
/// meaningful additive delta.
String? formatMetricDelta(String metricKey, double delta) {
  switch (metricKey) {
    case kSleepMetricKey:
      final m = delta.round();
      return '${m >= 0 ? '+' : ''}${m}m';
    case kHrvMetricKey:
      final m = delta.round();
      return '${m >= 0 ? '+' : ''}$m ms';
    case kStepsMetricKey:
      final m = delta.round();
      return '${m >= 0 ? '+' : ''}${formatGroupedInt(m)}';
    default:
      return null;
  }
}

/// '7h 12m' from a duration in minutes. Rounds to the nearest whole minute
/// rather than truncating, so 431.7 reads 7h 12m and not 7h 11m.
String formatDurationMinutes(double minutes) {
  final total = minutes.round();
  final sign = total < 0 ? '-' : '';
  final abs = total.abs();
  return '$sign${abs ~/ 60}h ${abs % 60}m';
}

/// '8,204' — thousands separated. The design renders the step count grouped
/// (design line 238); an ungrouped '8204' is harder to read at a glance.
String formatGroupedInt(int value) {
  final sign = value < 0 ? '-' : '';
  final digits = value.abs().toString();
  final out = StringBuffer();
  for (var i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 == 0) out.write(',');
    out.write(digits[i]);
  }
  return '$sign$out';
}
