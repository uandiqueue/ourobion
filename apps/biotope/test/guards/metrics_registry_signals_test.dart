// Coupling guard: metrics-registry-to-signals
// See docs/graph/couplings.yaml. The evaluate-signals edge function (S4 3-state signal + S5
// n=1 evaluator) must derive its metric key list AND its per-metric deadband from
// shared/metrics/registry.ts — never from hardcoded key literals — and must read day-series
// through the S2 metric_daily_values view, not the wide tables (same seam rule as
// compute-baselines since baseline v2).
//
// status: active.

import 'package:flutter_test/flutter_test.dart';

import 'guard_support.dart';

void main() {
  group('coupling guard: metrics-registry-to-signals', () {
    final fn = readRepoFile('supabase/functions/evaluate-signals/index.ts');
    final registry = parseRegistry(readRepoFile('shared/metrics/registry.ts'));

    test('evaluate-signals imports the registry', () {
      expect(fn.contains('shared/metrics/registry'), isTrue,
          reason: 'evaluate-signals must import the metrics registry');
    });

    test('metric keys + deadbands derive from the registry; reads go through the S2 view',
        () {
      expect(fn.contains('m.baselineApplicable'), isTrue,
          reason: 'SIGNAL_METRICS must derive from registry baselineApplicable');
      expect(fn.contains('m.status === "active"'), isTrue,
          reason: 'SIGNAL_METRICS must filter to active registry metrics');
      expect(fn.contains('deadbandK'), isTrue,
          reason:
              'the S4 deadband must come from the registry signal.deadbandK field (ADR-0002)');
      expect(fn.contains('"metric_daily_values"'), isTrue,
          reason: 'S4/S5 must read the S2 metric_daily_values view (architecture §S4/§S5)');
      expect(fn.contains('"daily_gut_rows"') || fn.contains('"wearable_daily"'), isFalse,
          reason: 'evaluate-signals must not read the wide tables — the S2 view is the seam');
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
