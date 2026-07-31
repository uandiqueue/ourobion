import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:src/modules/m2_self_report/impl/logging_controller.dart';
import 'package:src/modules/m2_self_report/ui/screens/scan_tab.dart';

Widget _harness(Widget child) => MaterialApp(
  home: Scaffold(
    body: SingleChildScrollView(
      child: Padding(padding: const EdgeInsets.all(16), child: child),
    ),
  ),
);

GapCard _card(
  String key, {
  bool expanded = false,
  bool saving = false,
  int? currentValue,
  VoidCallback? onToggle,
  ValueChanged<int>? onAnswer,
}) => GapCard(
  metricKey: key,
  weight: 7,
  options: kInlineAnswerableOptions[key]!,
  expanded: expanded,
  saving: saving,
  currentValue: currentValue,
  onToggle: onToggle ?? () {},
  onAnswer: onAnswer ?? (_) {},
);

class _GapPair extends StatefulWidget {
  const _GapPair();

  @override
  State<_GapPair> createState() => _GapPairState();
}

class _GapPairState extends State<_GapPair> {
  String? open;

  @override
  Widget build(BuildContext context) => Column(
    children: [
      _card(
        'mood_score',
        expanded: open == 'mood_score',
        onToggle: () => setState(() => open = 'mood_score'),
      ),
      const SizedBox(height: 10),
      _card(
        'energy_score',
        expanded: open == 'energy_score',
        onToggle: () => setState(() => open = 'energy_score'),
      ),
    ],
  );
}

void main() {
  group('EnvironmentRow stays truthful and inert', () {
    testWidgets('states that no source is connected', (tester) async {
      await tester.pumpWidget(_harness(const EnvironmentRow()));
      expect(find.text(ScanTabCopy.environmentLabel), findsOneWidget);
      expect(find.text(ScanTabCopy.environmentDetail), findsOneWidget);
      expect(
        find.text(ScanTabCopy.environmentStatus.toUpperCase()),
        findsOneWidget,
      );
    });

    testWidgets('offers no tap target and is disabled in semantics', (
      tester,
    ) async {
      final handle = tester.ensureSemantics();
      await tester.pumpWidget(_harness(const EnvironmentRow()));
      final row = find.byType(EnvironmentRow);
      for (final interactive in <Type>[
        GestureDetector,
        InkWell,
        Switch,
        TextButton,
        FilledButton,
        IconButton,
      ]) {
        expect(
          find.descendant(of: row, matching: find.byType(interactive)),
          findsNothing,
        );
      }
      expect(
        tester.getSemantics(row),
        matchesSemantics(
          label: ScanTabCopy.environmentSemanticLabel,
          hasEnabledState: true,
          isEnabled: false,
        ),
      );
      handle.dispose();
    });
  });

  group('Needs you inline metric logger', () {
    test('every accepted metric range is complete', () {
      expect(kInlineAnswerableOptions['urine_colour'], [
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
      ]);
      expect(kInlineAnswerableOptions['stool_form'], [1, 2, 3, 4, 5, 6, 7]);
      expect(kInlineAnswerableOptions['outside_meals'], [0, 1, 2, 3]);
      expect(kInlineAnswerableOptions['mosquito_bites'], [
        for (var value = 0; value <= 20; value++) value,
      ]);
      for (final key in ['energy_score', 'mood_score', 'gut_comfort_score']) {
        expect(kInlineAnswerableOptions[key], [1, 2, 3, 4, 5]);
      }
    });

    testWidgets('only the selected metric expands', (tester) async {
      await tester.pumpWidget(_harness(const _GapPair()));
      expect(find.text(ScanTabCopy.inlineHints['mood_score']!), findsNothing);
      expect(find.text(ScanTabCopy.inlineHints['energy_score']!), findsNothing);

      await tester.tap(find.text('Mood score'));
      await tester.pump();
      expect(find.text(ScanTabCopy.inlineHints['mood_score']!), findsOneWidget);
      expect(find.text(ScanTabCopy.inlineHints['energy_score']!), findsNothing);

      await tester.tap(find.text('Energy score'));
      await tester.pump();
      expect(find.text(ScanTabCopy.inlineHints['mood_score']!), findsNothing);
      expect(
        find.text(ScanTabCopy.inlineHints['energy_score']!),
        findsOneWidget,
      );
      expect(find.textContaining('full log'), findsNothing);
    });

    testWidgets('expanded metric writes only the picked scalar callback', (
      tester,
    ) async {
      final answers = <int>[];
      await tester.pumpWidget(
        _harness(_card('mood_score', expanded: true, onAnswer: answers.add)),
      );
      await tester.tap(find.text('4'));
      await tester.pump();
      expect(answers, [4]);
    });

    testWidgets('logged state collapses with the saved metric value', (
      tester,
    ) async {
      var changes = 0;
      await tester.pumpWidget(
        _harness(
          _card('stool_form', currentValue: 4, onToggle: () => changes++),
        ),
      );
      expect(find.text(ScanTabCopy.gapLogged), findsOneWidget);
      expect(find.text('Type 4 · Smooth'), findsOneWidget);
      expect(find.text(ScanTabCopy.gapChange), findsOneWidget);
      expect(find.text('1'), findsNothing);

      await tester.tap(find.text(ScanTabCopy.gapChange));
      await tester.pump();
      expect(changes, 1);
    });

    testWidgets('each option is a labelled accessible button', (tester) async {
      final handle = tester.ensureSemantics();
      final answers = <int>[];
      await tester.pumpWidget(
        _harness(_card('outside_meals', expanded: true, onAnswer: answers.add)),
      );
      final option = find.bySemanticsLabel('Outside meals 2');
      expect(option, findsOneWidget);
      expect(
        tester.getSemantics(option),
        matchesSemantics(
          label: 'Outside meals 2',
          isButton: true,
          hasEnabledState: true,
          isEnabled: true,
          hasTapAction: true,
        ),
      );
      tester.semantics.performAction(
        find.semantics.byLabel('Outside meals 2'),
        SemanticsAction.tap,
      );
      await tester.pump();
      expect(answers, [2]);
      handle.dispose();
    });

    testWidgets('saving state is inert and says so', (tester) async {
      final answers = <int>[];
      await tester.pumpWidget(
        _harness(
          _card(
            'gut_comfort_score',
            expanded: true,
            saving: true,
            onAnswer: answers.add,
          ),
        ),
      );
      expect(find.text(ScanTabCopy.gapSaving), findsOneWidget);
      await tester.tap(find.text('3'));
      await tester.pump();
      expect(answers, isEmpty);
    });
  });
}
