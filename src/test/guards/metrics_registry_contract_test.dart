// Coupling guard: metrics-registry-to-contract
// See docs/graph/couplings.yaml. Ties the metrics registry to the shared contract row types: every
// active registry key for a table must be a field of that table's contract row (TS + Dart), and every
// non-system field of the row must be a registry metric. This is what would have caught the
// DailyPhysioRow <-> wearable-key drift at build time.
//
// status: active.

import 'package:flutter_test/flutter_test.dart';

import 'guard_support.dart';

void main() {
  group('coupling guard: metrics-registry-to-contract', () {
    final registry = parseRegistry(readRepoFile('shared/metrics/registry.ts'));
    final ts = readRepoFile('shared/types/index.ts');
    final dartKeys = dartClassToJsonKeys(readRepoFile('shared/types/index.dart'));

    // table -> contract row type
    const tableToType = {
      'daily_gut_rows': 'DailyGutRow',
      'wearable_daily': 'DailyPhysioRow',
    };

    Set<String> metricFields(Set<String> rowFields) =>
        rowFields.difference(systemOrDerivedColumns);

    tableToType.forEach((table, type) {
      test('$table registry keys == $type metric fields (TS)', () {
        final regKeys = activeKeysFor(registry, table);
        final tsMetricFields = metricFields(tsInterfaceFields(ts, type));
        expect(tsMetricFields, equals(regKeys),
            reason: 'registry vs TS $type drift. '
                'registry-only: ${regKeys.difference(tsMetricFields)}; '
                'contract-only: ${tsMetricFields.difference(regKeys)}');
      });

      test('$table registry keys == $type metric fields (Dart)', () {
        final regKeys = activeKeysFor(registry, table);
        final dartMetricFields = metricFields(dartKeys[type]!);
        expect(dartMetricFields, equals(regKeys),
            reason: 'registry vs Dart $type drift. '
                'registry-only: ${regKeys.difference(dartMetricFields)}; '
                'contract-only: ${dartMetricFields.difference(regKeys)}');
      });
    });
  });
}
