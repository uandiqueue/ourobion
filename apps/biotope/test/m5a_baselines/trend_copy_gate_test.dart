// U7 copy gate: every user-facing string shipped with the trend view must
// pass the shared non-diagnostic copy validator (Product Principle #1,
// docs/memory/0003) — same pattern as insight_copy_gate_test.dart.

import 'package:flutter_test/flutter_test.dart';
import 'package:src/modules/m5a_baselines/ui/widgets/metric_trend_section.dart';

import '../../../../shared/constants/copy_guidelines.dart';

void main() {
  group('trend-view copy passes the non-diagnostic gate', () {
    test('every TrendCopy string validates', () {
      expect(TrendCopy.all, isNotEmpty);
      for (final s in TrendCopy.all) {
        expect(
          CopyRules.validateCopyString(s),
          isTrue,
          reason: 'diagnostic language detected in: "$s"',
        );
      }
    });
  });
}
