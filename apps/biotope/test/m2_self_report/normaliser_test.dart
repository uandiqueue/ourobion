import 'package:flutter_test/flutter_test.dart';
import 'package:src/modules/m2_self_report/impl/normaliser.dart';

void main() {
  group('computeDqs', () {
    test('empty map -> 0', () {
      expect(computeDqs({}), 0);
    });

    test('all seven daily-core keys present -> 100', () {
      expect(
        computeDqs({
          'urine_colour': 3,
          'stool_form': 4,
          'outside_meals': 1,
          'mosquito_bites': 0,
          'energy_score': 5,
          'mood_score': 5,
          'gut_comfort_score': 5,
        }),
        100,
      );
    });

    test('weights sum to 100', () {
      final sum = kDailyCoreDqsWeights.values.fold<int>(0, (a, b) => a + b);
      expect(sum, 100);
    });

    test('partial subset -> correct sum', () {
      // urine_colour (25) + stool_form (25) + gut_comfort_score (6) = 56
      expect(
        computeDqs({
          'urine_colour': 2,
          'stool_form': 3,
          'gut_comfort_score': 4,
        }),
        56,
      );
    });

    test('null values do not contribute', () {
      // Only mosquito_bites (10) is non-null.
      expect(
        computeDqs({
          'urine_colour': null,
          'stool_form': null,
          'mosquito_bites': 0,
          'energy_score': null,
        }),
        10,
      );
    });

    test('unknown / non-daily-core key is ignored', () {
      // stool_count, notes, resting_hr_bpm are not daily-core — no contribution.
      expect(
        computeDqs({
          'stool_count': 5,
          'notes': 'something',
          'resting_hr_bpm': 62,
          'bogus_key': 999,
        }),
        0,
      );
      // A non-daily-core key alongside a daily-core key only counts the latter.
      expect(
        computeDqs({
          'urine_colour': 1,
          'stool_count': 5,
        }),
        25,
      );
    });
  });
}
