// U21 copy gate: every new user-facing string shipped with the relationship-card
// affordances (A25) must pass the shared non-diagnostic copy validator
// (Product Principle #1, docs/memory/0003).
//
// The validator is imported by relative path across the package boundary, the
// same seam test/shared_types/insight_card_roundtrip_test.dart uses.

import 'package:flutter_test/flutter_test.dart';
import 'package:src/modules/m5b_insight_engine/ui/screens/insights_tab.dart';
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

  // The deck-reset affordance's copy. Its interpolated variant (resetDone) is a
  // function rather than a constant, so `all` alone cannot reach it — both
  // branches are exposed as allGenerated and gated here too.
  group('deck-reset copy passes the non-diagnostic gate', () {
    test('every InsightsTabCopy string validates', () {
      expect(InsightsTabCopy.all, isNotEmpty);
      for (final s in InsightsTabCopy.all) {
        expect(CopyRules.validateCopyString(s), isTrue,
            reason: 'diagnostic language detected in: "$s"');
      }
    });

    test('every generated InsightsTabCopy string validates', () {
      expect(InsightsTabCopy.allGenerated, isNotEmpty);
      for (final s in InsightsTabCopy.allGenerated) {
        expect(CopyRules.validateCopyString(s), isTrue,
            reason: 'diagnostic language detected in: "$s"');
      }
    });

    test('the confirmation states the three things reset actually does', () {
      // All three surprise people, and the copy gate cannot see an omission:
      // saved cards come back too, expired ones do not, and nothing new is made.
      final body = InsightsTabCopy.resetBody.toLowerCase();
      expect(body, contains('archive'),
          reason: 'restored saves leave the archive — say so before acting');
      expect(body, contains('window'),
          reason: 'cards past their expires_at stay out');
      expect(body, contains('no new cards'),
          reason: 'reset never generates or duplicates a card, and a bulk '
              '"bring back" button reads like it might');
    });
  });
}
