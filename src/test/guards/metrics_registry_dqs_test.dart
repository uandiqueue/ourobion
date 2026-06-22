// Coupling guard: metrics-registry-to-dqs
// See docs/graph/couplings.yaml. The M2 normaliser's daily-core DQS weights must equal the registry's
// weights for the metrics flagged countsTowardDailyCompleteness (the T1 spine). The normaliser can't
// import shared/metrics (it's a cross-language parity mirror), so this guard keeps the two in lockstep
// — the registry stays the single source of truth for the DQS. status: active.

import 'package:flutter_test/flutter_test.dart';

import 'guard_support.dart';

void main() {
  group('coupling guard: metrics-registry-to-dqs', () {
    test('normaliser daily-core weights == registry countsTowardDailyCompleteness weights', () {
      final registryWeights =
          registryDailyCoreWeights(readRepoFile('shared/metrics/registry.ts'));
      final normaliserWeights = dartIntMap(
        readRepoFile('src/lib/modules/m2_self_report/impl/normaliser.dart'),
        'kDailyCoreDqsWeights',
      );

      expect(registryWeights, isNotEmpty, reason: 'no daily-core weights found in registry');
      expect(
        normaliserWeights,
        equals(registryWeights),
        reason: 'normaliser DQS weights drifted from the registry. '
            'registry: $registryWeights; normaliser: $normaliserWeights',
      );
    });
  });
}
