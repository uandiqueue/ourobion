// U7 trend view: the chart math is extracted pure (impl/chart_math.dart) so
// scaling and tick placement are testable without a canvas.

import 'package:flutter_test/flutter_test.dart';
import 'package:src/modules/m5a_baselines/impl/chart_math.dart';

void main() {
  group('valueBounds', () {
    test('finds min and max', () {
      final b = valueBounds([3.0, 1.0, 4.0, 1.5]);
      expect(b.min, 1.0);
      expect(b.max, 4.0);
      expect(b.isDegenerate, isFalse);
    });

    test('single value is degenerate', () {
      final b = valueBounds([2.0]);
      expect(b.min, 2.0);
      expect(b.max, 2.0);
      expect(b.isDegenerate, isTrue);
    });
  });

  group('normalizeValue', () {
    const b = ValueBounds(1.0, 5.0);

    test('maps min to 0, max to 1, midpoint to 0.5', () {
      expect(normalizeValue(1.0, b), 0.0);
      expect(normalizeValue(5.0, b), 1.0);
      expect(normalizeValue(3.0, b), 0.5);
    });

    test('degenerate (flat series) maps to the midline', () {
      expect(normalizeValue(2.0, const ValueBounds(2.0, 2.0)), 0.5);
    });
  });

  group('dayFraction', () {
    final first = DateTime.utc(2026, 7, 4);
    final last = DateTime.utc(2026, 7, 24);

    test('endpoints map to 0 and 1', () {
      expect(dayFraction(first, first, last), 0.0);
      expect(dayFraction(last, first, last), 1.0);
    });

    test('is date-proportional (gaps stay honest)', () {
      expect(dayFraction(DateTime.utc(2026, 7, 14), first, last), 0.5);
    });

    test('single-day series maps to the horizontal midpoint', () {
      expect(dayFraction(first, first, first), 0.5);
    });
  });

  group('niceStep', () {
    test('follows the 1/2/5 ladder', () {
      expect(niceStep(0.7), 1.0);
      expect(niceStep(1.0), 1.0);
      expect(niceStep(1.2), 2.0);
      expect(niceStep(3.0), 5.0);
      expect(niceStep(7.0), 10.0);
      expect(niceStep(12.0), 20.0);
      expect(niceStep(60.0), 100.0);
    });

    test('handles sub-unit ranges', () {
      expect(niceStep(0.3), 0.5);
      expect(niceStep(0.09), 0.1);
      expect(niceStep(0.02), 0.02);
    });
  });

  group('niceTicks', () {
    test('covers the range with nice multiples', () {
      final ticks = niceTicks(const ValueBounds(1.0, 5.0));
      expect(ticks.first, lessThanOrEqualTo(1.0));
      expect(ticks.last, greaterThanOrEqualTo(5.0));
      // 1/2/5-ladder step of (5-1)/4 = 1.
      expect(ticks, [1.0, 2.0, 3.0, 4.0, 5.0]);
    });

    test('works for a wearable-scale range (sleep minutes)', () {
      final ticks = niceTicks(const ValueBounds(310.0, 480.0));
      expect(ticks.first, lessThanOrEqualTo(310.0));
      expect(ticks.last, greaterThanOrEqualTo(480.0));
      // Steps are on the 1/2/5 grid.
      final step = ticks[1] - ticks[0];
      expect(step, 50.0);
    });

    test('degenerate range yields a single tick at the value', () {
      expect(niceTicks(const ValueBounds(3.0, 3.0)), [3.0]);
    });

    test('float error is snapped onto the grid', () {
      final ticks = niceTicks(const ValueBounds(0.1, 0.7));
      for (final t in ticks) {
        expect(t, t); // no NaN
        expect((t * 10).roundToDouble(), closeTo(t * 10, 1e-9));
      }
    });
  });

  group('steppedTicks', () {
    test('never invents fractional values for a narrow whole-step range', () {
      expect(steppedTicks(const ValueBounds(1, 2), valueStep: 1), [1, 2]);
    });

    test('flat off-grid input stays on its real degenerate bound', () {
      expect(steppedTicks(const ValueBounds(1.5, 1.5), valueStep: 1), [1.5]);
    });

    test('uses a readable multiple of the declared smallest increment', () {
      final ticks = steppedTicks(const ValueBounds(0, 20), valueStep: 1);
      expect(ticks, [0, 5, 10, 15, 20]);
      for (final tick in ticks) {
        expect(tick % 1, 0);
      }
    });

    test('bounded 0..9 policy never emits an out-of-range 10', () {
      final ticks = steppedTicks(const ValueBounds(0, 9), valueStep: 1);
      expect(ticks, [0, 5]);
      expect(ticks.every((tick) => tick >= 0 && tick <= 9), isTrue);
    });

    test('supports negative and fractional grids within bounds', () {
      expect(steppedTicks(const ValueBounds(-3, 2), valueStep: 1), [-2, 0, 2]);
      expect(steppedTicks(const ValueBounds(0, 1), valueStep: 0.25), [
        0,
        0.25,
        0.5,
        0.75,
        1,
      ]);
    });

    test('huge finite ranges terminate with finite in-range ticks', () {
      final ticks = steppedTicks(const ValueBounds(0, 1e300), valueStep: 1e298);
      expect(ticks, isNotEmpty);
      expect(ticks.length, lessThan(100));
      expect(
        ticks.every((tick) => tick.isFinite && tick >= 0 && tick <= 1e300),
        isTrue,
      );
    });

    test('keeps a binary decimal max boundary instead of omitting it', () {
      expect(steppedTicks(const ValueBounds(0.1, 0.3), valueStep: 0.1), [
        0.1,
        0.2,
        0.3,
      ]);
    });
  });

  group('compactValueLabel', () {
    test('integers drop the decimal point', () {
      expect(compactValueLabel(4.0), '4');
      expect(compactValueLabel(0.0), '0');
      expect(compactValueLabel(480.0), '480');
    });

    test('non-integers keep one decimal', () {
      expect(compactValueLabel(3.5), '3.5');
      expect(compactValueLabel(0.25), '0.3');
    });
  });

  group('steppedValueLabel', () {
    test('preserves fractional valueStep precision', () {
      expect(steppedValueLabel(0.25, 0.25), '0.25');
      expect(steppedValueLabel(0.75, 0.25), '0.75');
      expect(steppedValueLabel(-0.125, 0.125), '-0.125');
    });

    test('whole steps remain compact', () {
      expect(steppedValueLabel(4, 1), '4');
    });
  });
}
