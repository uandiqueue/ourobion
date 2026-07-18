// A8 copy-gate word boundaries: the forbidden-term matcher must trip only on standalone
// diagnostic words (plus plain plurals), never on benign words that merely contain one.
// Table vectors are kept in lockstep with the TS side
// (tools/rules/tests/copy_guidelines.test.ts) — same strings, same expectations; the parity
// guard (test/guards/copy_guidelines_parity_test.dart) pins that both implementations build
// the identical regex.

import 'package:flutter_test/flutter_test.dart';

import '../../../../shared/constants/copy_guidelines.dart';

/// Benign copy that the pre-A8 substring matcher wrongly rejected (or would have).
const trueNegatives = <String>[
  'Try short stillness breaks after meals.',
  'Your conditioning routine looks steady.',
  'The air-conditioned room stayed cooler overnight.',
  'Mistreatment of outliers is avoided in this view.',
  'Preconditioning shows up in your data.',
];

/// Diagnostic copy that must still fail the gate — standalone words and plain plurals.
const truePositives = <String>[
  'This may be an illness pattern.',
  'Your condition is improving.',
  'Consider treatment options.',
  'These conditions come and go.',
  'Recurring illnesses were reported.',
  'Two diseases share this signal.',
  'Several treatments exist.',
  'You were diagnosed last year.',
  'A treatment-plan was suggested.', // hyphen is a word boundary
  'Illness detected.', // case-insensitive
];

void main() {
  group('A8 copy gate is word-boundary-aware (Dart)', () {
    test('benign containing words pass', () {
      for (final s in trueNegatives) {
        expect(CopyRules.validateCopyString(s), isTrue,
            reason: 'false positive — benign copy rejected: "$s"');
      }
    });

    test('standalone diagnostic words (and plurals) still fail', () {
      for (final s in truePositives) {
        expect(CopyRules.validateCopyString(s), isFalse,
            reason: 'false negative — diagnostic copy accepted: "$s"');
      }
    });
  });
}
