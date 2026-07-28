// U21 copy gate: every new user-facing string shipped with the relationship-card
// affordances (A25) must pass the shared non-diagnostic copy validator
// (Product Principle #1, docs/memory/0003).
//
// The validator is imported by relative path across the package boundary, the
// same seam test/shared_types/insight_card_roundtrip_test.dart uses.

import 'package:flutter_test/flutter_test.dart';
import 'package:src/modules/m5b_insight_engine/ui/widgets/insight_card_visual.dart';

import '../../../../shared/constants/copy_guidelines.dart';

void main() {
  group('relationship-card copy passes the non-diagnostic gate', () {
    test('every InsightCardCopy string validates', () {
      expect(InsightCardCopy.all, isNotEmpty);
      for (final s in InsightCardCopy.all) {
        expect(CopyRules.validateCopyString(s), isTrue,
            reason: 'diagnostic language detected in: "$s"');
      }
    });
  });
}
