// Coupling guard: copy-guidelines-ts-dart-parity
// See docs/graph/couplings.yaml. Holds shared/constants/copy_guidelines.ts and copy_guidelines.dart
// in lockstep so the non-diagnostic word lists/severity labels match on both sides. docs/memory/0003.
//
// status: planned — runnable placeholder so the existence check in
// `node tools/context_sync.mjs --check` is honest now. Real assertions land in P1S2: compare the
// forbidden/allowed word lists and severity labels across the two files.

import 'package:flutter_test/flutter_test.dart';

void main() {
  group('coupling guard: copy-guidelines-ts-dart-parity', () {
    test('TS and Dart copy_guidelines expose identical forbidden/allowed lists + severity labels', () {
      // TODO(P1S2): load both word lists and assert set-equality; assert severity labels match.
    }, skip: 'Guard placeholder (status: planned) — see docs/graph/couplings.yaml.');
  });
}
