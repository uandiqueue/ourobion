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

/// Compact value label: integers without a decimal point, otherwise one
/// decimal ('4' not '4.0'; '3.5' stays '3.5').
String compactValueLabel(double v) {
  if (v == v.roundToDouble()) return v.round().toString();
  return v.toStringAsFixed(1);
}
