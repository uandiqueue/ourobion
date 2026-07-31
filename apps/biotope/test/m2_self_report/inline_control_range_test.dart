import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:src/modules/m2_self_report/impl/logging_controller.dart';
import 'package:src/modules/m2_self_report/impl/normaliser.dart';
import 'package:src/modules/m2_self_report/ui/screens/scan_tab.dart';
import '../guards/guard_support.dart';
import 'scan_test_support.dart';
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
  final registry = readRepoFile('shared/metrics/lib/src/registry.dart');
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
    test('every declared affordance still fits a compact inline control', () {
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
              '"$key" declares inputType "${inputTypes[key]}", which no '
              'compact inline control can represent',
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
        final range = [for (var v = scale.min; v <= scale.max; v++) v];
        final answers = <int>[];
        if (controlFor(key) == ScanControl.stepper) {
          await tester.pumpWidget(scanHarness(gapCard(key, expanded: true)));
          for (final value in range) {
            await stepStepperTo(tester, value);
            expect(stepperValue(tester), value);
          }
          for (final value in range) {
            await tester.pumpWidget(
              scanHarness(
                gapCard(
                  key,
                  expanded: true,
                  currentValue: value,
                  onAnswer: answers.add,
                ),
              ),
            );
            expect(stepperValue(tester), value);
            await tester.tap(findStepperSave);
            await tester.pump();
          }
        } else {
          await tester.pumpWidget(
            scanHarness(gapCard(key, expanded: true, onAnswer: answers.add)),
          );
          for (final value in range) {
            expect(
              findOption(key, value),
              findsOneWidget,
              reason: '$key must offer $value inline',
            );
            await answerWith(tester, key, value);
          }
        }
        expect(
          answers,
          equals(range),
          reason: 'every offered value must write that exact value',
        );
      });
      testWidgets('$key offers nothing outside its accepted range', (
        tester,
      ) async {
        final scale = scales[key]!;
        await tester.pumpWidget(scanHarness(gapCard(key, expanded: true)));
        if (controlFor(key) == ScanControl.stepper) {
          expect(
            tester.widget<IconButton>(findStepperDecrease).onPressed,
            isNull,
            reason: '$key must not be able to step below ${scale.min}',
          );
          await stepStepperTo(tester, scale.max);
          expect(
            tester.widget<IconButton>(findStepperIncrease).onPressed,
            isNull,
            reason: '$key must not be able to step above ${scale.max}',
          );
          return;
        }
        expect(
          findOption(key, scale.min - 1),
          findsNothing,
          reason:
              '$key must not offer ${scale.min - 1}, which the column '
              'would reject',
        );
        expect(findOption(key, scale.max + 1), findsNothing);
      });
    }
    testWidgets('the long scales are not abbreviated behind a "more" link', (
      tester,
    ) async {
      for (final key in ['urine_colour', 'stool_form']) {
        await tester.pumpWidget(scanHarness(gapCard(key, expanded: true)));
        final options = kInlineAnswerableOptions[key]!;
        for (final value in options) {
          expect(
            findOption(key, value),
            findsOneWidget,
            reason: '$key must offer $value its own target',
          );
        }
        final prefix = key == 'urine_colour'
            ? 'armstrong-target-'
            : 'bristol-option-';
        expect(
          find.byWidgetPredicate((w) {
            final widgetKey = w.key;
            return widgetKey is ValueKey<String> &&
                widgetKey.value.startsWith(prefix);
          }),
          findsNWidgets(options.length),
          reason: '$key must render exactly one target per accepted value',
        );
        expect(find.textContaining('More'), findsNothing);
        expect(
          find.textContaining('full log', findRichText: true),
          findsNothing,
        );
      }
      await tester.pumpWidget(
        scanHarness(gapCard('mosquito_bites', expanded: true)),
      );
      expect(find.textContaining('More'), findsNothing);
      expect(find.textContaining('full log', findRichText: true), findsNothing);
    });
    testWidgets('a collapsed card offers no values at all', (tester) async {
      await tester.pumpWidget(scanHarness(gapCard('mood_score')));
      for (final value in kInlineAnswerableOptions['mood_score']!) {
        expect(findOption('mood_score', value), findsNothing);
      }
      expect(findExpandedArea('mood_score'), findsNothing);
    });
    testWidgets('no control writes anything until a value is picked', (
      tester,
    ) async {
      for (final key in dailyCoreKeys) {
        final answers = <int>[];
        await tester.pumpWidget(
          scanHarness(gapCard(key, expanded: true, onAnswer: answers.add)),
        );
        await tester.pump();
        expect(
          answers,
          isEmpty,
          reason: '$key wrote a value merely by being expanded',
        );
      }
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
