// Coupling guard: shared-types-ts-dart-parity
// See docs/graph/couplings.yaml. Holds shared/types/index.ts and shared/types/index.dart in lockstep
// (no import links the two languages, so only a test catches drift). docs/memory/0002.
//
// status: active — asserts every contract type declares the same wire fields on both sides, by
// comparing each TS interface's field names against the Dart class's toJson() keys (which are pinned
// to the snake_case wire names).

import 'package:flutter_test/flutter_test.dart';

import 'guard_support.dart';

void main() {
  group('coupling guard: shared-types-ts-dart-parity', () {
    final ts = readRepoFile('shared/types/index.ts');
    final dart = readRepoFile('shared/types/index.dart');
    final dartKeys = dartClassToJsonKeys(dart);

    const contractTypes = [
      'DailyGutRow',
      'DailyPhysioRow',
      'DailyEnvRow',
      'BaselineSnapshot',
      'InsightCardEdgeRef', // the InsightCard.edge_refs jsonb payload shape (camelCase wire keys)
      'InsightCard',
      'InsightFiredEvent',
      'EngagementState',
    ];

    for (final type in contractTypes) {
      test('$type fields match across TS and Dart', () {
        final tsFields = tsInterfaceFields(ts, type);
        final dartJson = dartKeys[type];
        expect(dartJson, isNotNull, reason: '$type has no toJson() in index.dart');
        expect(
          dartJson,
          equals(tsFields),
          reason: 'TS/Dart field drift for $type. '
              'TS-only: ${tsFields.difference(dartJson!)}; '
              'Dart-only: ${dartJson.difference(tsFields)}',
        );
      });
    }
  });
}
