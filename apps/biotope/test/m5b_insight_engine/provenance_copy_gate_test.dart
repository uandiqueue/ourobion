// U7 copy gate: every user-facing string shipped with the provenance screen
// must pass the shared non-diagnostic copy validator (Product Principle #1,
// docs/memory/0003) — same pattern as insight_copy_gate_test.dart.
//
// Also pins the TEST-MODE verdict stamp: interim-verifier honesty (D15 / Run
// 2.0 posture) requires verdict wording to say "scaffolded + unit-tested",
// never "verified/proven". The Dart const must stay in lockstep with
// TEST_MODE_LABEL in tools/llm-router/src/types.ts (no cross-language import
// exists, so the wording is asserted here verbatim).

import 'package:flutter_test/flutter_test.dart';
import 'package:src/modules/m5b_insight_engine/ui/screens/insight_provenance_screen.dart';

import '../../../../shared/constants/copy_guidelines.dart';

void main() {
  group('provenance-screen copy passes the non-diagnostic gate', () {
    test('every ProvenanceCopy string validates', () {
      expect(ProvenanceCopy.all, isNotEmpty);
      for (final s in ProvenanceCopy.all) {
        expect(
          CopyRules.validateCopyString(s),
          isTrue,
          reason: 'diagnostic language detected in: "$s"',
        );
      }
    });
  });

  group('TEST-MODE verdict posture (D15 honesty)', () {
    test('the stamp mirrors tools/llm-router/src/types.ts TEST_MODE_LABEL', () {
      expect(
        ProvenanceCopy.testModeVerdictLabel,
        'scaffolded + unit-tested '
        '(TEST-MODE: single-provider, decorrelation OFF)',
      );
    });

    test('the stamp is in the gated string list', () {
      expect(ProvenanceCopy.all, contains(ProvenanceCopy.testModeVerdictLabel));
    });
  });
}
