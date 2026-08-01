// Coupling guard: metrics-registry-ts-dart-parity
// See docs/graph/couplings.yaml. Holds registry.ts and the Dart package mirror in lockstep —
// the registry is the single source of truth for every metric, duplicated across the language seam.
//
// status: active — asserts both files declare the same metric keys, in the same order, with the same
// runtime axis and UI fields per key. A metric added to one side but not the other fails here.

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
        reason:
            'metric key set/order drift between TS and Dart package registries',
      );
    });

    test(
      'parser reads TS objects and Dart constructors, including quote styles',
      () {
        const tsFixture = '''
        {
          key: 'fixture_ts',
          table: 'events',
          type: 'numeric',
          scale: { min: -0.25, max: 9.5 },
          valueStep: 0.25,
          ui: { label: 'Fixture label', inputType: null },
          baselineApplicable: true,
          status: 'active',
        }
      ''';
        final dartFixture =
            '''
        MetricDefinition(
          key: <q>fixture_dart<q>,
          table: <q>events<q>,
          type: <q>numeric<q>,
          scale: MetricScale(min: -0.25, max: 9.5),
          valueStep: 0.25,
          ui: MetricUi(label: <q>Fixture label<q>, inputType: null),
          baselineApplicable: true,
          status: <q>active<q>,
        )
      '''
                .replaceAll('<q>', String.fromCharCode(34));

        for (final entry in [
          parseRegistry(tsFixture).single,
          parseRegistry(dartFixture).single,
        ]) {
          expect(entry.type, 'numeric');
          expect(entry.scaleMin, -0.25);
          expect(entry.scaleMax, 9.5);
          expect(entry.valueStep, 0.25);
          expect(entry.uiLabel, 'Fixture label');
          expect(entry.inputType, isNull);
        }
      },
    );

    test('per-key contract and runtime axis policy fields agree', () {
      final tsByKey = {for (final e in tsEntries) e.key: e};
      for (final d in dartEntries) {
        final t = tsByKey[d.key]!;
        expect(d.type, isNotEmpty, reason: '${d.key}: type was not parsed');
        expect(d.table, t.table, reason: '${d.key}: table drift');
        expect(d.status, t.status, reason: '${d.key}: status drift');
        expect(
          d.baselineApplicable,
          t.baselineApplicable,
          reason: '${d.key}: baselineApplicable drift',
        );
        expect(d.type, t.type, reason: '${d.key}: type drift');
        expect(d.scaleMin, t.scaleMin, reason: '${d.key}: scale.min drift');
        expect(d.scaleMax, t.scaleMax, reason: '${d.key}: scale.max drift');
        expect(d.valueStep, t.valueStep, reason: '${d.key}: valueStep drift');
        expect(d.uiLabel, t.uiLabel, reason: '${d.key}: ui.label drift');
        expect(
          d.inputType,
          t.inputType,
          reason: '${d.key}: ui.inputType drift',
        );
      }
    });

    test(
      'wearable display labels are parity-locked without input controls',
      () {
        const expected = {
          'resting_hr_bpm': 'Resting heart rate',
          'hrv_sdnn_ms': 'Heart-rate variability (SDNN)',
          'sleep_duration_min': 'Sleep duration',
          'spo2_pct': 'Blood oxygen',
          'body_temp_c': 'Body temperature',
          'step_count': 'Steps',
        };
        final tsByKey = {for (final entry in tsEntries) entry.key: entry};
        final dartByKey = {for (final entry in dartEntries) entry.key: entry};

        for (final MapEntry(key: key, value: label) in expected.entries) {
          expect(tsByKey[key]!.uiLabel, label, reason: '$key: TS label drift');
          expect(
            dartByKey[key]!.uiLabel,
            label,
            reason: '$key: Dart label drift',
          );
          expect(
            tsByKey[key]!.inputType,
            isNull,
            reason: '$key: TS input control invented',
          );
          expect(
            dartByKey[key]!.inputType,
            isNull,
            reason: '$key: Dart input control invented',
          );
        }
      },
    );

    test('parser exposes mutations in every runtime axis field', () {
      final dart = readRepoFile('shared/metrics/lib/src/registry.dart');
      final expected = tsEntries.first;

      final typeMutation = parseRegistry(
        dart.replaceFirst('''type: 'ordinal',''', '''type: 'numeric','''),
      ).first;
      expect(typeMutation.type, isNot(expected.type));

      final minMutation = parseRegistry(
        dart.replaceFirst(
          'MetricScale(min: 1, max: 8)',
          'MetricScale(min: 2, max: 8)',
        ),
      ).first;
      expect(minMutation.scaleMin, isNot(expected.scaleMin));

      final maxMutation = parseRegistry(
        dart.replaceFirst(
          'MetricScale(min: 1, max: 8)',
          'MetricScale(min: 1, max: 9)',
        ),
      ).first;
      expect(maxMutation.scaleMax, isNot(expected.scaleMax));

      final stepMutation = parseRegistry(
        dart.replaceFirst('valueStep: 1', 'valueStep: 0.25'),
      ).first;
      expect(stepMutation.valueStep, isNot(expected.valueStep));
    });

    test(
      'whole-step metadata covers declared and derived discrete metrics',
      () {
        final stepped = {
          for (final entry in tsEntries)
            if (entry.valueStep == 1) entry.key,
        };
        expect(stepped, {
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
          'step_count',
        });
      },
    );
  });
}
