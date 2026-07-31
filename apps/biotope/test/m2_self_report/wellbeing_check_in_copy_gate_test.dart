import 'package:flutter_test/flutter_test.dart';

import '../../../../shared/constants/copy_guidelines.dart';

void main() {
  test('wellbeing check-in copy stays observational and non-diagnostic', () {
    for (final string in [
      'WELLBEING CHECK-IN (OPTIONAL)',
      'Appetite',
      'Feeling anxious',
      'Mental clarity',
      'Focus',
      'Social interaction quality',
      'Save optional check-in →',
      'Optional check-in saved',
    ]) {
      expect(CopyRules.validateCopyString(string), isTrue, reason: string);
    }
  });
}
