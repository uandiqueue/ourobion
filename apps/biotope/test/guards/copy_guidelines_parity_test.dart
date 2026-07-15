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
  });
}
