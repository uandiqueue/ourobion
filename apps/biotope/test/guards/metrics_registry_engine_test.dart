// Coupling guard: metrics-registry-to-engine
// See docs/graph/couplings.yaml. Since the U12 engine refactor, generate-insights is DATA-DRIVEN:
// rules live in data/rules/** blueprints (loaded into the `rules` table), so the engine source
// must contain ZERO hardcoded rules or metric-key literals — it derives its metric surface from
// shared/metrics/registry.ts and reads rules/edges/signals from their tables. The rule↔registry
// coupling now binds the BLUEPRINTS: every metric key a blueprint references must be an active
// registry metric, so a rule can never read a metric that no longer exists or was never defined.
//
// status: active.

import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

import 'guard_support.dart';

void main() {
  group('coupling guard: metrics-registry-to-engine', () {
    final engineFiles = [
      'supabase/functions/generate-insights/index.ts',
      'supabase/functions/generate-insights/evaluators.ts',
      'supabase/functions/generate-insights/composer.ts',
      'supabase/functions/generate-insights/render.ts',
    ];
    final engine = readRepoFile('supabase/functions/generate-insights/index.ts');
    final registry = parseRegistry(readRepoFile('shared/metrics/registry.ts'));
    final activeKeys = registry
        .where((e) => e.status == 'active')
        .map((e) => e.key)
        .toSet();

    test('the engine contains no hardcoded rules or metric-key literals', () {
      // The MVP shape (`RULES: Rule[]` + `metricKey: "urine_colour"` closures) must never return.
      final metricLiteral = RegExp('''metricKey:\\s*['"][a-z0-9_]+['"]''');
      for (final file in engineFiles) {
        final source = readRepoFile(file);
        expect(metricLiteral.hasMatch(source), isFalse,
            reason: '$file hardcodes a metric key — rules are data (data/rules/**)');
        expect(source.contains('RULES: Rule[]'), isFalse,
            reason: '$file reintroduces the hardcoded MVP rules array');
      }
    });

    test('the engine derives metrics from the registry and reads the data-driven surfaces', () {
      expect(engine.contains('shared/metrics/registry.ts'), isTrue,
          reason: 'generate-insights must import the metrics registry');
      for (final table in [
        '.from("rules")',
        '.from("baseline_snapshots")',
        '.from("verified_edges")',
        '.from("personal_signals")',
        '.from("metric_daily_values")',
        '.from("composed_insights")',
        '.from("insight_cards")',
      ]) {
        expect(engine.contains(table), isTrue,
            reason: 'generate-insights must read/write $table');
      }
    });

    test('every blueprint metric key resolves to an active registry metric', () {
      final rulesDir = Directory('${repoRoot().path}/data/rules');
      final blueprintFiles = rulesDir
          .listSync(recursive: true)
          .whereType<File>()
          .where((f) => f.path.endsWith('.json'))
          // _candidates/ (B4 extract output) is not loadable truth — only single/ and cross/ are.
          .where((f) => !f.path.replaceAll('\\', '/').contains('/_candidates/'))
          .toList();
      expect(blueprintFiles, isNotEmpty,
          reason: 'no rule blueprints found under data/rules');

      final referenced = <String>{};
      for (final file in blueprintFiles) {
        final blueprint = jsonDecode(file.readAsStringSync()) as Map<String, dynamic>;
        for (final key in (blueprint['metricKeys'] as List<dynamic>)) {
          referenced.add(key as String);
        }
        final condition = blueprint['condition'] as Map<String, dynamic>;
        if (condition['metricKey'] != null) referenced.add(condition['metricKey'] as String);
        if (condition['metricKeys'] != null) {
          for (final key in (condition['metricKeys'] as List<dynamic>)) {
            referenced.add(key as String);
          }
        }
      }
      expect(referenced, isNotEmpty, reason: 'no metric keys found in blueprints');
      for (final key in referenced) {
        expect(activeKeys.contains(key), isTrue,
            reason: 'blueprint metric key "$key" is not an active registry metric');
      }
    });
  });
}
