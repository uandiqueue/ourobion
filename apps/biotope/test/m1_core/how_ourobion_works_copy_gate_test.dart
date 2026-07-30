// Copy gate for the "About Biotope" card and its explainer screen. Every
// user-facing string these surfaces own must pass the shared non-diagnostic
// validator (shared/constants/copy_guidelines.dart) — same pattern as
// signals_detail_copy_gate_test.dart.
//
// A second, stricter gate runs alongside it here: this explainer is not
// allowed to fabricate metrics or claims — no numbers, no percentages, and
// none of the specific words that would imply a study count, a confidence
// score, an encryption guarantee, or a coverage figure the app does not
// compute. That is a stronger bar than CopyRules enforces, so it is checked
// directly against the raw copy lists.

import 'package:flutter_test/flutter_test.dart';
import 'package:src/modules/m1_core/ui/screens/how_ourobion_works_screen.dart';
import 'package:src/modules/m1_core/ui/widgets/about_biotope_card.dart';

import '../../../../shared/constants/copy_guidelines.dart';

void main() {
  void gate(String label, List<String> strings) {
    test('every $label string validates', () {
      expect(strings, isNotEmpty);
      for (final s in strings) {
        expect(
          CopyRules.validateCopyString(s),
          isTrue,
          reason: 'diagnostic language detected in: "$s"',
        );
      }
    });
  }

  group('copy passes the shared non-diagnostic gate', () {
    gate('HowOurobionWorksCopy', HowOurobionWorksCopy.all);
    gate('AboutBiotopeCopy', AboutBiotopeCopy.all);
  });

  group('no fabricated metrics or claims', () {
    final digit = RegExp(r'[0-9]');
    const bannedSubstrings = [
      '%',
      'studies',
      'papers',
      'score',
      'confidence',
      'coverage',
      'encrypted',
      'encryption',
    ];

    void assertClean(String label, List<String> strings) {
      test('$label has no digits and no banned substrings', () {
        expect(strings, isNotEmpty);
        for (final s in strings) {
          expect(
            digit.hasMatch(s),
            isFalse,
            reason: 'a number appeared in: "$s"',
          );
          final lower = s.toLowerCase();
          for (final banned in bannedSubstrings) {
            expect(
              lower.contains(banned),
              isFalse,
              reason: 'banned substring "$banned" found in: "$s"',
            );
          }
        }
      });
    }

    assertClean('HowOurobionWorksCopy.all', HowOurobionWorksCopy.all);
    assertClean('AboutBiotopeCopy.all', AboutBiotopeCopy.all);
  });
}
