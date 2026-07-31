// The Scan tab's inline controls may never narrow what a column accepts
// (#268 acceptance items 5 and 6).
//
// A gap card answers EVERY daily-core metric in place. That is only safe if the
// control offers the metric's full accepted range: a 1..5 chip row for a 1..8
// scale would silently make the top three values unreachable from Scan, and the
// user would have no way to tell a missing value from an unofferable one.
//
// `lib/` cannot import `shared/` — the registry is a cross-language parity
// mirror living outside the Flutter package, which is why kDailyCoreDqsWeights
// mirrors its DQS weights rather than reading them. So the ranges are held to
// shared/metrics/registry.dart HERE, by parsing the registry source exactly as
// the guards in test/guards/ do. Nothing below hardcodes a range: if the
// registry moves and kInlineAnswerableOptions does not, these fail.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:src/modules/m2_self_report/impl/logging_controller.dart';
import 'package:src/modules/m2_self_report/impl/normaliser.dart';
import 'package:src/modules/m2_self_report/ui/screens/scan_tab.dart';

import '../guards/guard_support.dart';
import 'scan_test_support.dart';

/// `{key: (min, max)}` for every registry entry that declares a numeric scale.
Map<String, ({int min, int max})> _registryScales(String source) {
  final keyRe = RegExp('''key:\\s*['"]([a-z0-9_]+)['"]''');
  final matches = keyRe.allMatches(source).toList();
  final out = <String, ({int min, int max})>{};
  for (var i = 0; i < matches.length; i++) {
    final end = (i + 1 < matches.length) ? matches[i + 1].start : source.length;
    final block = source.substring(matches[i].start, end);
    final scale = RegExp(
      r'scale:\s*MetricScale\(min:\s*(\d+),\s*max:\s*(\d+)\)',
    ).firstMatch(block);
    if (scale == null) continue;
    out[matches[i].group(1)!] = (
      min: int.parse(scale.group(1)!),
      max: int.parse(scale.group(2)!),
    );
  }
  return out;
}

/// `{key: ui.inputType}` for every registry entry that declares one.
Map<String, String> _registryInputTypes(String source) {
  final keyRe = RegExp('''key:\\s*['"]([a-z0-9_]+)['"]''');
  final matches = keyRe.allMatches(source).toList();
  final out = <String, String>{};
  for (var i = 0; i < matches.length; i++) {
    final end = (i + 1 < matches.length) ? matches[i + 1].start : source.length;
    final block = source.substring(matches[i].start, end);
    final ui = RegExp(
      '''inputType:\\s*['"]([a-z0-9_]+)['"]''',
    ).firstMatch(block);
    if (ui != null) out[matches[i].group(1)!] = ui.group(1)!;
  }
  return out;
}

void main() {
  final registry = readRepoFile('shared/metrics/registry.dart');
  final scales = _registryScales(registry);
  final inputTypes = _registryInputTypes(registry);
  final weights = registryDailyCoreWeights(registry);

  group('the registry is the source of truth for what is answerable', () {
    test('sanity: the registry parsed', () {
      expect(scales, isNotEmpty);
      expect(inputTypes, isNotEmpty);
      expect(weights, isNotEmpty);
    });

    test('the seven daily-core keys are the registry\'s, not a local list', () {
      expect(
        kDailyCoreDqsWeights.keys.toSet(),
        equals(weights.keys.toSet()),
        reason:
            'countsTowardDailyCompleteness in the registry decides which '
            'metrics a gap card can appear for',
      );
      expect(kDailyCoreDqsWeights.length, 7);
    });

    test('every daily-core key has an inline control, and nothing else does', () {
      expect(
        kInlineAnswerableOptions.keys.toSet(),
        equals(kDailyCoreDqsWeights.keys.toSet()),
        reason:
            'a daily-core key without an inline control would have to route to '
            'the full Daily Log, which the Scan tab never does',
      );
    });

    test('every daily-core key declares a scale in the registry', () {
      for (final key in dailyCoreKeys) {
        expect(
          scales.containsKey(key),
          isTrue,
          reason: '"$key" counts toward completeness but declares no scale',
        );
      }
    });

    test('each control offers every value in the registry range, in order', () {
      for (final key in dailyCoreKeys) {
        final scale = scales[key]!;
        expect(
          kInlineAnswerableOptions[key],
          equals([for (var v = scale.min; v <= scale.max; v++) v]),
          reason:
              '"$key" accepts ${scale.min}..${scale.max} but the inline '
              'control offers ${kInlineAnswerableOptions[key]} — an inline '
              'answer must never narrow the column',
        );
      }
    });

    test('the ranges the acceptance criteria name are the ranges in force', () {
      // Spelled out once, as a readable cross-check on the parser above: if the
      // parse silently returned nothing these would be the assertions that
      // noticed. The loop above is what actually guards against drift.
      expect(scales['urine_colour'], (min: 1, max: 8));
      expect(scales['stool_form'], (min: 1, max: 7));
      expect(scales['outside_meals'], (min: 0, max: 3));
      expect(scales['mosquito_bites'], (min: 0, max: 20));
      for (final key in ['energy_score', 'mood_score', 'gut_comfort_score']) {
        expect(scales[key], (min: 1, max: 5));
      }
    });

    test('every control is a contiguous run with no gaps or repeats', () {
      for (final key in dailyCoreKeys) {
        final options = kInlineAnswerableOptions[key]!;
        expect(options.toSet().length, options.length, reason: '$key repeats');
        for (var i = 1; i < options.length; i++) {
          expect(
            options[i],
            options[i - 1] + 1,
            reason: '$key skips a value the column accepts',
          );
        }
      }
    });

    test('the registry\'s declared affordance still fits a chip row', () {
      // The merged Scan tab renders one compact chip per value for every
      // metric. That is only honest while every daily-core inputType is a
      // small, discrete, wrappable scale — a free-text or multi-select
      // inputType appearing here would mean a chip row is the wrong control.
      const wrappable = {
        'armstrong_1_8',
        'bristol_1_7',
        'segmented_0_3',
        'stepper_0_20',
        'likert_1_5',
      };
      for (final key in dailyCoreKeys) {
        expect(
          wrappable.contains(inputTypes[key]),
          isTrue,
          reason:
              '"$key" declares inputType "${inputTypes[key]}", which no chip '
              'row can represent',
        );
      }
    });
  });

  group('every metric is answerable inline over its FULL range', () {
    for (final key in kDailyCoreDqsWeights.keys) {
      testWidgets('$key offers every accepted value, and each one answers', (
        tester,
      ) async {
        final scale = scales[key]!;
        final answers = <int>[];
        await tester.pumpWidget(
          scanHarness(gapCard(key, expanded: true, onAnswer: answers.add)),
        );

        for (var value = scale.min; value <= scale.max; value++) {
          expect(
            findChip(key, value),
            findsOneWidget,
            reason: '$key must offer $value inline',
          );
          await tester.tap(findChip(key, value));
          await tester.pump();
        }

        expect(
          answers,
          equals([for (var v = scale.min; v <= scale.max; v++) v]),
          reason: 'every offered value must write that exact value',
        );
      });

      testWidgets('$key offers nothing outside its accepted range', (
        tester,
      ) async {
        final scale = scales[key]!;
        await tester.pumpWidget(scanHarness(gapCard(key, expanded: true)));

        expect(
          findChip(key, scale.min - 1),
          findsNothing,
          reason: '$key must not offer ${scale.min - 1}, which the column '
              'would reject',
        );
        expect(findChip(key, scale.max + 1), findsNothing);
      });
    }

    testWidgets('the long scales are not abbreviated behind a "more" link', (
      tester,
    ) async {
      // urine_colour (8), stool_form (7) and mosquito_bites (21) are the ones a
      // compact control is tempted to truncate.
      for (final key in ['urine_colour', 'stool_form', 'mosquito_bites']) {
        await tester.pumpWidget(scanHarness(gapCard(key, expanded: true)));
        final chips = tester.widgetList<GestureDetector>(
          find.descendant(
            of: findGapCard(key),
            matching: find.byType(GestureDetector),
          ),
        );
        expect(
          chips.length,
          kInlineAnswerableOptions[key]!.length,
          reason: '$key must render one tappable chip per accepted value',
        );
        expect(find.textContaining('More'), findsNothing);
        expect(find.textContaining('full log', findRichText: true), findsNothing);
      }
    });

    testWidgets('a collapsed card offers no values at all', (tester) async {
      await tester.pumpWidget(scanHarness(gapCard('mood_score')));
      for (final value in kInlineAnswerableOptions['mood_score']!) {
        expect(findChip('mood_score', value), findsNothing);
      }
      expect(findExpandedArea('mood_score'), findsNothing);
    });

    testWidgets('every metric carries a hint naming what its numbers mean', (
      tester,
    ) async {
      for (final key in dailyCoreKeys) {
        expect(
          ScanTabCopy.inlineHints[key],
          isNotNull,
          reason: '"$key" would expand into an unexplained row of digits',
        );
        await tester.pumpWidget(scanHarness(gapCard(key, expanded: true)));
        expect(findExpandedArea(key), findsOneWidget);
      }
    });
  });
}
