// Coupling guard: copy-guidelines-ts-dart-parity
// See docs/graph/couplings.yaml. The non-diagnostic copy rules (forbidden/allowed word lists) exist in
// both TS (backend) and Dart (app) with no import linking them. If the lists diverge, a string the
// backend accepts could be rejected by the app or vice versa, weakening Product Principle #1
// (docs/memory/0003). status: active.

import 'package:flutter_test/flutter_test.dart';

import 'guard_support.dart';

void main() {
  group('coupling guard: copy-guidelines-ts-dart-parity', () {
    final ts = readRepoFile('shared/constants/copy_guidelines.ts');
    final dart = readRepoFile('shared/constants/copy_guidelines.dart');

    test('FORBIDDEN_WORDS match across TS and Dart', () {
      expect(
        quotedListAfter(dart, 'forbiddenWords'),
        equals(quotedListAfter(ts, 'FORBIDDEN_WORDS')),
        reason: 'forbidden-word lists drifted between copy_guidelines.ts and .dart',
      );
    });

    test('ALLOWED_PHRASES match across TS and Dart', () {
      expect(
        quotedListAfter(dart, 'allowedPhrases'),
        equals(quotedListAfter(ts, 'ALLOWED_PHRASES')),
        reason: 'allowed-phrase lists drifted between copy_guidelines.ts and .dart',
      );
    });

    // A8: both implementations must build the same word-boundary + optional-plural regex.
    // In source text the TS template literal reads `\b${word}(?:e?s)?\b` and the Dart
    // interpolated string reads '\b$word(?:e?s)?\b' — identical after normalising ${word}.
    test('forbidden-word matcher (word boundary + optional plural) matches across TS and Dart', () {
      const pattern = r'\\b$word(?:e?s)?\\b';
      final tsNormalized = ts.replaceAll(r'${word}', r'$word');
      expect(tsNormalized.contains(pattern), isTrue,
          reason: 'copy_guidelines.ts matcher drifted from the shared word-boundary pattern');
      expect(dart.contains(pattern), isTrue,
          reason: 'copy_guidelines.dart matcher drifted from the shared word-boundary pattern');
    });

    // \b only anchors against word characters — a non-\w list entry would silently never match.
    test('every forbidden term is lowercase word-characters only (boundary-matchable)', () {
      final wordOnly = RegExp(r'^[a-z0-9_]+$');
      for (final term in quotedListAfter(ts, 'FORBIDDEN_WORDS')) {
        expect(wordOnly.hasMatch(term), isTrue,
            reason: 'forbidden term "$term" is not \\w-only — \\b cannot anchor on it');
      }
    });
  });
}
