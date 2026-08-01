import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ourobion_metrics/ourobion_metrics.dart';
import 'package:src/modules/m2_self_report/ui/widgets/quick_count_control.dart';

import '../../../../shared/constants/copy_guidelines.dart';

Widget _harness({
  required String metricKey,
  required int? value,
  required ValueChanged<int?> onChanged,
  bool enabled = true,
  bool allowClear = false,
}) => MaterialApp(
  home: Scaffold(
    body: SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: QuickCountControl(
        metricKey: metricKey,
        value: value,
        enabled: enabled,
        allowClear: allowClear,
        onChanged: onChanged,
      ),
    ),
  ),
);

void main() {
  const bounds = {'stool_count': 10, 'outside_meals': 10, 'mosquito_bites': 20};

  group('registry-driven quick count', () {
    for (final entry in bounds.entries) {
      final metricKey = entry.key;
      final max = entry.value;
      final label = metricByKey(metricKey)!.ui!.label;

      testWidgets(
        '$metricKey offers quick 0-3 and accepts every bounded tail value',
        (tester) async {
          final handle = tester.ensureSemantics();
          final answers = <int?>[];
          await tester.pumpWidget(
            _harness(metricKey: metricKey, value: null, onChanged: answers.add),
          );

          for (var value = 0; value <= 3; value++) {
            final semantic = QuickCountCopy.quickOption(label, value);
            expect(find.bySemanticsLabel(semantic), findsOneWidget);
            expect(
              tester.getSemantics(find.bySemanticsLabel(semantic)),
              matchesSemantics(
                label: semantic,
                isButton: true,
                hasEnabledState: true,
                isEnabled: true,
                hasSelectedState: true,
                isSelected: false,
                hasTapAction: true,
              ),
            );
            final target = find.byKey(
              ValueKey('quick-count-$metricKey-$value'),
            );
            expect(tester.getSize(target).height, greaterThanOrEqualTo(48));
            await tester.tap(target);
            await tester.pump();
          }
          expect(answers, [0, 1, 2, 3]);

          for (var value = 4; value <= max; value++) {
            final other = find.byKey(ValueKey('quick-count-$metricKey-other'));
            await tester.tap(other);
            await tester.pump();
            final field = find.byKey(ValueKey('quick-count-$metricKey-field'));
            expect(field, findsOneWidget);
            expect(tester.widget<TextField>(field).focusNode!.hasFocus, isTrue);
            await tester.enterText(field, '$value');
            await tester.testTextInput.receiveAction(TextInputAction.done);
            await tester.pump();
          }
          expect(answers, [for (var value = 0; value <= max; value++) value]);
          handle.dispose();
        },
      );

      testWidgets('$metricKey rejects a custom value above its registry max', (
        tester,
      ) async {
        final answers = <int?>[];
        await tester.pumpWidget(
          _harness(metricKey: metricKey, value: null, onChanged: answers.add),
        );
        await tester.tap(find.byKey(ValueKey('quick-count-$metricKey-other')));
        await tester.pump();
        final field = find.byKey(ValueKey('quick-count-$metricKey-field'));
        final textField = tester.widget<TextField>(field);
        expect(
          textField.decoration!.labelText,
          QuickCountCopy.customLabel(label),
        );
        expect(textField.decoration!.helperText, QuickCountCopy.helper(0, max));
        await tester.enterText(field, '${max + 1}');
        await tester.tap(find.byKey(ValueKey('quick-count-$metricKey-apply')));
        await tester.pump();
        expect(answers, isEmpty);
        expect(find.text(QuickCountCopy.helper(0, max)), findsWidgets);
      });

      testWidgets('$metricKey restores a custom value without writing it', (
        tester,
      ) async {
        final answers = <int?>[];
        await tester.pumpWidget(
          _harness(metricKey: metricKey, value: max, onChanged: answers.add),
        );
        final field = tester.widget<TextField>(
          find.byKey(ValueKey('quick-count-$metricKey-field')),
        );
        expect(field.controller!.text, '$max');
        expect(answers, isEmpty);
      });
    }

    testWidgets('saving makes quick and custom paths inert', (tester) async {
      final handle = tester.ensureSemantics();
      final answers = <int?>[];
      await tester.pumpWidget(
        _harness(
          metricKey: 'mosquito_bites',
          value: 12,
          enabled: false,
          onChanged: answers.add,
        ),
      );
      final quick = tester.widget<ChoiceChip>(
        find.byKey(const ValueKey('quick-count-mosquito_bites-2')),
      );
      final other = tester.widget<ChoiceChip>(
        find.byKey(const ValueKey('quick-count-mosquito_bites-other')),
      );
      final field = tester.widget<TextField>(
        find.byKey(const ValueKey('quick-count-mosquito_bites-field')),
      );
      final apply = tester.widget<FilledButton>(
        find.byKey(const ValueKey('quick-count-mosquito_bites-apply')),
      );
      expect(quick.onSelected, isNull);
      expect(other.onSelected, isNull);
      expect(field.enabled, isFalse);
      expect(apply.onPressed, isNull);
      expect(answers, isEmpty);
      handle.dispose();
    });

    testWidgets('Daily Log can clear a selected quick value', (tester) async {
      final answers = <int?>[];
      await tester.pumpWidget(
        _harness(
          metricKey: 'stool_count',
          value: 2,
          allowClear: true,
          onChanged: answers.add,
        ),
      );
      final selected = QuickCountCopy.selectedQuickOption('Stool count', 2);
      expect(find.bySemanticsLabel(selected), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('quick-count-stool_count-2')));
      await tester.pump();
      expect(answers, [null]);
    });

    testWidgets('all controls fit the 390x844 target viewport', (tester) async {
      tester.view.physicalSize = const Size(390, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      for (final entry in bounds.entries) {
        await tester.pumpWidget(
          _harness(metricKey: entry.key, value: entry.value, onChanged: (_) {}),
        );
        expect(tester.takeException(), isNull, reason: entry.key);
      }
    });
  });

  test('every quick-count string passes the non-diagnostic copy gate', () {
    for (final metricKey in bounds.keys) {
      final metric = metricByKey(metricKey)!;
      final max = metric.scale!.max.toInt();
      final strings = [
        ...QuickCountCopy.allStatic,
        QuickCountCopy.customLabel(metric.ui!.label),
        QuickCountCopy.helper(metric.scale!.min.toInt(), max),
        QuickCountCopy.customOption(metric.ui!.label),
        for (var value = 0; value <= 3; value++)
          QuickCountCopy.quickOption(metric.ui!.label, value),
        for (var value = 0; value <= 3; value++)
          QuickCountCopy.selectedQuickOption(metric.ui!.label, value),
      ];
      for (final string in strings) {
        expect(
          CopyRules.validateCopyString(string),
          isTrue,
          reason: 'diagnostic language detected in: $string',
        );
      }
    }
  });
}
