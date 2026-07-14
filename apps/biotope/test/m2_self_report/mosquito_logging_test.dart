import 'package:flutter_test/flutter_test.dart';
import 'package:src/modules/m2_self_report/impl/behaviour/mosquito_logging.dart';

void main() {
  group('isStandingWaterPromptDue', () {
    final today = DateTime(2026, 7, 8);

    test('never answered -> due', () {
      expect(isStandingWaterPromptDue(null, today), isTrue);
    });

    test('answered today -> not due', () {
      expect(isStandingWaterPromptDue(DateTime(2026, 7, 8), today), isFalse);
    });

    test('answered 6 days ago -> not due', () {
      expect(isStandingWaterPromptDue(DateTime(2026, 7, 2), today), isFalse);
    });

    test('answered exactly 7 days ago -> due', () {
      expect(isStandingWaterPromptDue(DateTime(2026, 7, 1), today), isTrue);
    });

    test('answered long ago -> due', () {
      expect(isStandingWaterPromptDue(DateTime(2026, 5, 1), today), isTrue);
    });
  });
}
