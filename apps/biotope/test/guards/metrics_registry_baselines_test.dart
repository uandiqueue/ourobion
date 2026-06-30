// Coupling guard: metrics-registry-to-baselines
// See docs/graph/couplings.yaml. The compute-baselines edge function must derive its per-table metric
// lists from shared/metrics/registry.ts — never from hardcoded key literals. The original bug was a
// hardcoded WEARABLE_METRIC_KEYS array drifting from the contract; this guard makes that impossible.
//
// status: active.

import 'package:flutter_test/flutter_test.dart';

import 'guard_support.dart';

void main() {
  group('coupling guard: metrics-registry-to-baselines', () {
    final fn = readRepoFile('supabase/functions/compute-baselines/index.ts');
    final registry = parseRegistry(readRepoFile('shared/metrics/registry.ts'));

    test('compute-baselines imports the registry', () {
      expect(fn.contains('shared/metrics/registry'), isTrue,
          reason: 'compute-baselines must import the metrics registry');
    });

    test('metric lists are derived from the registry, not hardcoded', () {
      expect(fn.contains('table === "daily_gut_rows"'), isTrue,
          reason: 'GUT_METRIC_KEYS must derive from the registry by table');
      expect(fn.contains('table === "wearable_daily"'), isTrue,
          reason: 'WEARABLE_METRIC_KEYS must derive from the registry by table');
    });

    test('no wearable metric key appears as a hardcoded literal', () {
      for (final key in baselineKeysFor(registry, 'wearable_daily')) {
        expect(fn.contains('"$key"'), isFalse,
            reason: 'hardcoded metric literal "$key" found — derive from the registry instead');
        expect(fn.contains("'$key'"), isFalse,
            reason: "hardcoded metric literal '$key' found — derive from the registry instead");
      }
    });
  });
}
