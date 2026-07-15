// Coupling guard: metrics-registry-to-engine
// See docs/graph/couplings.yaml. Every rule in the generate-insights engine references a metric by
// `metricKey`. Each such key must resolve to an active metric in shared/metrics/registry.ts — so a
// rule can never read a metric that no longer exists or was never defined.
//
// status: active.

import 'package:flutter_test/flutter_test.dart';

import 'guard_support.dart';

void main() {
  group('coupling guard: metrics-registry-to-engine', () {
    final engine = readRepoFile('supabase/functions/generate-insights/index.ts');
    final registry = parseRegistry(readRepoFile('shared/metrics/registry.ts'));
    final activeKeys = registry
        .where((e) => e.status == 'active')
        .map((e) => e.key)
        .toSet();

    test('every rule metricKey resolves to an active registry metric', () {
      final ruleKeys = RegExp(r'''metricKey:\s*['"]([a-z0-9_]+)['"]''')
          .allMatches(engine)
          .map((m) => m.group(1)!)
          .toSet();
      expect(ruleKeys, isNotEmpty, reason: 'no rule metricKeys found to validate');
      for (final key in ruleKeys) {
        expect(activeKeys.contains(key), isTrue,
            reason: 'rule metricKey "$key" is not an active registry metric');
      }
    });
  });
}
