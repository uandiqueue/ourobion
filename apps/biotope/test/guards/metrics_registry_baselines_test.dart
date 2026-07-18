// Coupling guard: metrics-registry-to-baselines
// See docs/graph/couplings.yaml. The compute-baselines edge function must derive its metric key
// list from shared/metrics/registry.ts — never from hardcoded key literals — and (since S3
// baseline v2) must read day-series through the S2 metric_daily_values view, not the wide tables.
// The original bug was a hardcoded WEARABLE_METRIC_KEYS array drifting from the contract; this
// guard makes that impossible.
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

    test('metric keys derive from the registry and reads go through the S2 view', () {
      expect(fn.contains('m.baselineApplicable'), isTrue,
          reason: 'BASELINE_METRIC_KEYS must derive from registry baselineApplicable');
      expect(fn.contains('m.status === "active"'), isTrue,
          reason: 'BASELINE_METRIC_KEYS must filter to active registry metrics');
      expect(fn.contains('"metric_daily_values"'), isTrue,
          reason: 'baseline v2 must read the S2 metric_daily_values view (architecture §S3)');
      expect(fn.contains('"daily_gut_rows"') || fn.contains('"wearable_daily"'), isFalse,
          reason: 'baseline v2 must not read the wide tables directly — the S2 view is the seam');
    });

    test('no baseline metric key appears as a hardcoded literal', () {
      final keys = [
        ...baselineKeysFor(registry, 'daily_gut_rows'),
        ...baselineKeysFor(registry, 'wearable_daily'),
        ...baselineKeysFor(registry, 'signals'),
      ];
      expect(keys, isNotEmpty, reason: 'registry parse found no baseline keys');
      for (final key in keys) {
        expect(fn.contains('"$key"'), isFalse,
            reason: 'hardcoded metric literal "$key" found — derive from the registry instead');
        expect(fn.contains("'$key'"), isFalse,
            reason: "hardcoded metric literal '$key' found — derive from the registry instead");
      }
    });
  });
}
