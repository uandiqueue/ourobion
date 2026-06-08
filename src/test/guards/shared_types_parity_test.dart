// Coupling guard: shared-types-ts-dart-parity
// See docs/graph/couplings.yaml. Holds shared/types/index.ts and shared/types/index.dart in lockstep
// (no import links the two languages, so only a test catches drift). docs/memory/0002.
//
// status: planned — this is a runnable placeholder so the existence check in
// `node tools/context_sync.mjs --check` is honest now. Real assertions land in P1S2: parse both files
// (or generated field manifests) and assert each contract type exposes the same field names/optionality.

import 'package:flutter_test/flutter_test.dart';

void main() {
  group('coupling guard: shared-types-ts-dart-parity', () {
    test('shared/types index.ts and index.dart declare the same fields per contract type', () {
      // TODO(P1S2): assert TS<->Dart field parity for DailyGutRow, DailyPhysioRow, DailyEnvRow,
      // BaselineSnapshot, InsightCard, InsightFiredEvent, EngagementState.
    }, skip: 'Guard placeholder (status: planned) — see docs/graph/couplings.yaml.');
  });
}
