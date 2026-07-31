// Coupling guard: metrics-registry-ts-dart-parity
// See docs/graph/couplings.yaml. Holds registry.ts and the Dart package mirror in lockstep —
// the registry is the single source of truth for every metric, duplicated across the language seam.
//
// status: active — asserts both files declare the same metric keys, in the same order, with the same
// table / status / baselineApplicable per key. A metric added to one side but not the other fails here.

import 'package:flutter_test/flutter_test.dart';

import 'guard_support.dart';

void main() {
  group('coupling guard: metrics-registry-ts-dart-parity', () {
    final tsEntries = parseRegistry(readRepoFile('shared/metrics/registry.ts'));
    final dartEntries = parseRegistry(
      readRepoFile('shared/metrics/lib/src/registry.dart'),
    );

    test('TS and Dart package registries declare the same ordered keys', () {
      expect(
        dartEntries.map((e) => e.key).toList(),
        equals(tsEntries.map((e) => e.key).toList()),
        reason: 'metric key set/order drift between TS and Dart package registries',
      );
    });

    test('per-key table / status / baselineApplicable / valueStep agree', () {
      final tsByKey = {for (final e in tsEntries) e.key: e};
      for (final d in dartEntries) {
        final t = tsByKey[d.key]!;
        expect(d.table, t.table, reason: '${d.key}: table drift');
        expect(d.status, t.status, reason: '${d.key}: status drift');
        expect(d.baselineApplicable, t.baselineApplicable,
            reason: '${d.key}: baselineApplicable drift');
        expect(d.valueStep, t.valueStep, reason: '${d.key}: valueStep drift');
      }
    });

    test('whole-step metadata covers declared and derived discrete metrics', () {
      final stepped = {
        for (final entry in tsEntries)
          if (entry.valueStep == 1) entry.key,
      };
      expect(
        stepped,
        {
          'urine_colour',
          'stool_form',
          'stool_count',
          'stool_variability',
          'outside_meals',
          'mosquito_bites',
          'energy_score',
          'mood_score',
          'gut_comfort_score',
          'appetite_score',
          'anxiety_score',
          'brain_clarity_score',
          'focus_score',
          'social_interaction_quality_score',
          'log_completeness',
          'step_count',
        },
      );
    });
  });
}
