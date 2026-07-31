// Pure chart math for the U7 metric trend view — extracted from the painter so
// scaling and tick placement are unit-testable without a canvas.
//
// No package imports on purpose (same rule as metric_series_models.dart).

/// Inclusive value bounds of a series.
class ValueBounds {
  final double min;
  final double max;
  const ValueBounds(this.min, this.max);

  bool get isDegenerate => min == max;
}

/// Min/max over [values]. Empty input is the caller's bug — the chart never
/// renders an empty series.
ValueBounds valueBounds(List<double> values) {
  assert(values.isNotEmpty);
  var lo = values.first;
  var hi = values.first;
  for (final v in values) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return ValueBounds(lo, hi);
}

/// Normalises [v] into 0..1 within [bounds]; a degenerate (flat) series maps
/// to the vertical midpoint.
double normalizeValue(double v, ValueBounds bounds) {
  if (bounds.isDegenerate) return 0.5;
  return (v - bounds.min) / (bounds.max - bounds.min);
}

/// Horizontal position 0..1 of [date] between [first] and [last] — DATE
/// proportional, so missing days leave honest gaps instead of compressing the
/// x axis. A single-day series maps to the horizontal midpoint.
double dayFraction(DateTime date, DateTime first, DateTime last) {
  final span = last.difference(first).inDays;
  if (span <= 0) return 0.5;
  return date.difference(first).inDays / span;
}

/// The 1/2/5 "nice number" ladder: smallest of {1,2,5,10}×10^k ≥ [rough].
double niceStep(double rough) {
  assert(rough > 0);
  var magnitude = 1.0;
  while (rough > magnitude * 10) {
    magnitude *= 10;
  }
  while (rough <= magnitude) {
    magnitude /= 10;
  }
  for (final m in [1.0, 2.0, 5.0, 10.0]) {
    if (rough <= magnitude * m) return magnitude * m;
  }
  return magnitude * 10; // unreachable; keeps the analyzer certain
}

/// Nice tick values covering [bounds] with roughly [targetCount] steps:
/// multiples of a 1/2/5 step, first tick ≤ min, last tick ≥ max. A degenerate
/// range gets a single tick at the value.
List<double> niceTicks(ValueBounds bounds, {int targetCount = 4}) {
  assert(targetCount >= 1);
  if (bounds.isDegenerate) return [bounds.min];
  final step = niceStep((bounds.max - bounds.min) / targetCount);
  final firstTick = (bounds.min / step).floor() * step;
  final ticks = <double>[];
  for (var t = firstTick; t < bounds.max + step / 2; t += step) {
    // Snap accumulated float error back onto the grid.
    ticks.add(double.parse(t.toStringAsFixed(10)));
  }
  return ticks;
}

/// Tick values aligned to a metric's declared [valueStep].
///
/// The display interval is a nice 1/2/5 multiple of the smallest valid value
/// increment, so a narrow whole-step series such as 1..2 can never invent 1.5.
List<double> steppedTicks(
  ValueBounds bounds, {
  required double valueStep,
  double origin = 0,
  int targetCount = 4,
}) {
  assert(valueStep > 0);
  assert(targetCount >= 1);
  if (!valueStep.isFinite || valueStep <= 0) {
    throw ArgumentError.value(
      valueStep,
      'valueStep',
      'must be finite and positive',
    );
  }
  if (!origin.isFinite ||
      !bounds.min.isFinite ||
      !bounds.max.isFinite ||
      bounds.max < bounds.min) {
    throw ArgumentError.value(bounds, 'bounds', 'must be finite and ordered');
  }
  if (bounds.isDegenerate) {
    // No distinct ticks are possible. Preserve the real bounded value even if
    // corrupt/off-grid input reached this display layer.
    return [bounds.min];
  }

  // Divide before subtracting so very large opposite-signed bounds do not
  // overflow while deriving a readable interval.
  final roughInterval = bounds.max / targetCount - bounds.min / targetCount;
  final roughMultiple = roughInterval / valueStep;
  final double interval;
  if (roughMultiple.isFinite && roughMultiple > 0) {
    final niceMultiple = niceStep(roughMultiple);
    interval = (niceMultiple < 1 ? 1 : niceMultiple.ceil()) * valueStep;
  } else if (roughInterval.isFinite && roughInterval > 0) {
    interval = niceStep(roughInterval);
  } else {
    return [bounds.min, bounds.max];
  }
  if (!interval.isFinite || interval <= 0) {
    return [bounds.min, bounds.max];
  }

  final tolerance = interval.abs() * 1e-12;
  final scaledMin = bounds.min / interval - origin / interval;
  final firstIndex = (scaledMin - tolerance / interval).ceil();
  final ticks = <double>[];
  // Index from the first in-range grid point instead of accumulating floats.
  // The hard cap is defensive only; the nice interval normally emits ~5 ticks.
  for (var i = 0; i < 10000; i++) {
    final tick = origin + (firstIndex + i) * interval;
    if (tick > bounds.max + tolerance) break;
    if (tick >= bounds.min - tolerance) {
      final boundedTick = tick < bounds.min
          ? bounds.min
          : tick > bounds.max
          ? bounds.max
          : tick;
      ticks.add(_snapTick(boundedTick));
    }
  }
  return ticks.isEmpty ? [bounds.min, bounds.max] : ticks;
}

/// Compact value label: integers without a decimal point, otherwise one
/// decimal ('4' not '4.0'; '3.5' stays '3.5').
String compactValueLabel(double v) {
  if (v == v.roundToDouble()) return v.round().toString();
  return v.toStringAsFixed(1);
}

/// Compact label that preserves the decimal precision declared by [valueStep].
String steppedValueLabel(double v, double valueStep) {
  if (!valueStep.isFinite || valueStep <= 0) return compactValueLabel(v);
  var scaledStep = valueStep.abs();
  var decimalPlaces = 0;
  while (decimalPlaces < 10 &&
      (scaledStep - scaledStep.roundToDouble()).abs() > 1e-9) {
    scaledStep *= 10;
    decimalPlaces++;
  }
  if (decimalPlaces == 0) return compactValueLabel(v);
  var label = v.toStringAsFixed(decimalPlaces);
  while (label.contains('.') && label.endsWith('0')) {
    label = label.substring(0, label.length - 1);
  }
  if (label.endsWith('.')) label = label.substring(0, label.length - 1);
  return label == '-0' ? '0' : label;
}

double _snapTick(double value) {
  if (value.abs() >= 1e20) return value;
  return double.parse(value.toStringAsFixed(10));
}

const _shortMonths = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/// Date-axis endpoint label: '24 Jul'. Lives here rather than privately inside
/// one painter so every surface that plots a daily series (the trend section,
/// the metric detail view) labels its axis identically.
String shortDateLabel(DateTime d) => '${d.day} ${_shortMonths[d.month - 1]}';
