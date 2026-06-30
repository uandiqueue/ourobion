// Coupling guard: metrics-registry-ts-dart-parity
// See docs/graph/couplings.yaml. Holds shared/metrics/registry.ts and registry.dart in lockstep —
// the registry is the single source of truth for every metric, duplicated across the language seam.
//
// status: active — asserts both files declare the same metric keys, in the same order, with the same
// table / status / baselineApplicable per key. A metric added to one side but not the other fails here.

import 'package:flutter_test/flutter_test.dart';

import 'guard_support.dart';

void main() {
  group('coupling guard: metrics-registry-ts-dart-parity', () {
    final tsEntries = parseRegistry(readRepoFile('shared/metrics/registry.ts'));
    final dartEntries = parseRegistry(readRepoFile('shared/metrics/registry.dart'));

    test('registry.ts and registry.dart declare the same keys in the same order', () {
      expect(
        dartEntries.map((e) => e.key).toList(),
        equals(tsEntries.map((e) => e.key).toList()),
        reason: 'metric key set/order drift between registry.ts and registry.dart',
      );
    });

    test('per-key table / status / baselineApplicable agree', () {
      final tsByKey = {for (final e in tsEntries) e.key: e};
      for (final d in dartEntries) {
        final t = tsByKey[d.key]!;
        expect(d.table, t.table, reason: '${d.key}: table drift');
        expect(d.status, t.status, reason: '${d.key}: status drift');
        expect(d.baselineApplicable, t.baselineApplicable,
            reason: '${d.key}: baselineApplicable drift');
      }
    });
  });
}
