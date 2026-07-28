// UI gaps 1 and 5 — the Scan tab's two reworked rows.
//
// ScanTab itself needs Supabase.instance, so these pump the two widgets it is
// built from directly. Both were made public for exactly that reason.
//
// No image goldens (O37 defers them): everything below is a widget-tree or
// semantics assertion.

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

void main() {
  group('gap 1 · EnvironmentRow is inert and says why', () {
    testWidgets('states that no source is connected, not "coming soon"',
        (tester) async {
      await tester.pumpWidget(_harness(const EnvironmentRow()));

      expect(find.text(ScanTabCopy.environmentLabel), findsOneWidget);
      expect(find.text(ScanTabCopy.environmentDetail), findsOneWidget);
      // The badge uppercases its label.
      expect(find.text(ScanTabCopy.environmentStatus.toUpperCase()),
          findsOneWidget);

      // The old copy promised a delivery nobody has scheduled.
      expect(find.textContaining('Coming soon', findRichText: true),
          findsNothing);
      expect(find.textContaining('COMING SOON'), findsNothing);
    });

    testWidgets('offers nothing to tap — no control wired to nothing',
        (tester) async {
      await tester.pumpWidget(_harness(const EnvironmentRow()));

      final row = find.byType(EnvironmentRow);
      for (final interactive in <Type>[
        GestureDetector,
        InkWell,
        Switch,
        TextButton,
        FilledButton,
        ElevatedButton,
        OutlinedButton,
        IconButton,
      ]) {
        expect(
          find.descendant(of: row, matching: find.byType(interactive)),
          findsNothing,
          reason: 'a $interactive here would be a control with no data source '
              'behind it — m4_environmental is a comment-only stub',
        );
      }
    });

    testWidgets('is exposed to assistive tech as one disabled node',
        (tester) async {
      final handle = tester.ensureSemantics();
      await tester.pumpWidget(_harness(const EnvironmentRow()));

      expect(
        tester.getSemantics(find.byType(EnvironmentRow)),
        matchesSemantics(
          label: ScanTabCopy.environmentSemanticLabel,
          hasEnabledState: true,
          isEnabled: false,
        ),
      );

      handle.dispose();
    });
  });

  group('gap 5 · GapCard answers inline where a chip can express the value',
      () {
    testWidgets('renders one chip per option and reports the tapped value',
        (tester) async {
      final answers = <int>[];
      await tester.pumpWidget(_harness(GapCard(
        metricKey: 'mood_score',
        weight: 7,
        inlineOptions: kInlineAnswerableOptions['mood_score'],
        onAnswer: answers.add,
        onOpenFullLog: () {},
      )));

      for (final option in const [1, 2, 3, 4, 5]) {
        expect(find.text('$option'), findsOneWidget);
      }
      expect(find.text(ScanTabCopy.gapAnswerHere), findsOneWidget);
      expect(find.text(ScanTabCopy.inlineHints['mood_score']!), findsOneWidget);

      await tester.tap(find.text('4'));
      await tester.pump();

      expect(answers, [4]);
    });

    testWidgets('keeps the full log reachable from a chip-answerable card',
        (tester) async {
      var opened = 0;
      await tester.pumpWidget(_harness(GapCard(
        metricKey: 'energy_score',
        weight: 7,
        inlineOptions: kInlineAnswerableOptions['energy_score'],
        onAnswer: (_) {},
        onOpenFullLog: () => opened++,
      )));

      await tester.tap(find.text(ScanTabCopy.gapOpenFullLog));
      await tester.pump();

      expect(opened, 1);
    });

    testWidgets('a metric no chip can express stays a tap-through to the form',
        (tester) async {
      var opened = 0;
      var answered = 0;
      await tester.pumpWidget(_harness(GapCard(
        metricKey: 'urine_colour',
        weight: 25,
        // Deliberately absent from kInlineAnswerableOptions.
        inlineOptions: kInlineAnswerableOptions['urine_colour'],
        onAnswer: (_) => answered++,
        onOpenFullLog: () => opened++,
      )));

      expect(find.text(ScanTabCopy.gapAnswerHere), findsNothing);
      expect(find.text(ScanTabCopy.gapOpenFullLog), findsNothing);

      await tester.tap(find.byType(GapCard));
      await tester.pump();

      expect(opened, 1);
      expect(answered, 0);
    });

    testWidgets('goes inert while a write is in flight', (tester) async {
      final answers = <int>[];
      var opened = 0;
      await tester.pumpWidget(_harness(GapCard(
        metricKey: 'gut_comfort_score',
        weight: 6,
        inlineOptions: kInlineAnswerableOptions['gut_comfort_score'],
        saving: true,
        onAnswer: answers.add,
        onOpenFullLog: () => opened++,
      )));

      await tester.tap(find.text('3'));
      await tester.tap(find.text(ScanTabCopy.gapOpenFullLog));
      await tester.pump();

      expect(answers, isEmpty,
          reason: 'a second tap must not queue a second write to the column');
      expect(opened, 0);
    });

    testWidgets('each chip is a labelled button for assistive tech',
        (tester) async {
      final handle = tester.ensureSemantics();
      await tester.pumpWidget(_harness(GapCard(
        metricKey: 'outside_meals',
        weight: 20,
        inlineOptions: kInlineAnswerableOptions['outside_meals'],
        onAnswer: (_) {},
        onOpenFullLog: () {},
      )));

      // metricDisplayLabel('outside_meals') prefixes each chip's label, so a
      // screen reader announces "Outside meals 2", not a bare "2".
      for (final option in const [0, 1, 2, 3]) {
        expect(find.bySemanticsLabel('Outside meals $option'), findsOneWidget);
      }
      expect(
        tester.getSemantics(find.bySemanticsLabel('Outside meals 2')),
        matchesSemantics(
          label: 'Outside meals 2',
          isButton: true,
          hasEnabledState: true,
          isEnabled: true,
          hasTapAction: true,
        ),
      );

      handle.dispose();
    });

    testWidgets('the semantics tap action answers, not just the pointer',
        (tester) async {
      final handle = tester.ensureSemantics();
      final answers = <int>[];
      await tester.pumpWidget(_harness(GapCard(
        metricKey: 'mood_score',
        weight: 7,
        inlineOptions: kInlineAnswerableOptions['mood_score'],
        onAnswer: answers.add,
        onOpenFullLog: () {},
      )));

      tester.semantics.performAction(
        find.semantics.byLabel('Mood score 5'),
        SemanticsAction.tap,
      );
      await tester.pump();

      expect(answers, [5]);

      handle.dispose();
    });
  });
}
