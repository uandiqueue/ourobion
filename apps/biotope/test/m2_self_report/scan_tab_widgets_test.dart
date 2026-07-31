import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:src/modules/m2_self_report/impl/logging_controller.dart';
import 'package:src/modules/m2_self_report/ui/screens/scan_tab.dart';
import 'package:src/modules/m2_self_report/ui/widgets/daily_scale_visuals.dart';

Widget _harness(Widget child) => MaterialApp(
  home: Scaffold(
    body: SingleChildScrollView(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
        child: child,
      ),
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
        onToggle: () =>
            setState(() => open = open == 'mood_score' ? null : 'mood_score'),
      ),
      const SizedBox(height: 10),
      _card(
        'energy_score',
        expanded: open == 'energy_score',
        onToggle: () => setState(
          () => open = open == 'energy_score' ? null : 'energy_score',
        ),
      ),
    ],
  );
}

Future<String> _renderSignature(
  WidgetTester tester,
  Finder boundaryFinder,
) async {
  final boundary = tester.renderObject<RenderRepaintBoundary>(boundaryFinder);
  // Layer rasterisation and byte encoding are completed by the engine, not by
  // the test's fake-async zone, so awaiting them inside `pump` time deadlocks.
  // `runAsync` is the only place these futures can complete.
  final signature = await tester.runAsync(() async {
    final image = await boundary.toImage(pixelRatio: 1);
    final data = await image.toByteData(format: ui.ImageByteFormat.rawRgba);
    image.dispose();
    return String.fromCharCodes(data!.buffer.asUint8List());
  });
  return signature!;
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

    testWidgets('an expanded card header closes without saving', (
      tester,
    ) async {
      await tester.pumpWidget(_harness(const _GapPair()));

      await tester.tap(find.text('Mood score'));
      await tester.pump();
      expect(find.text(ScanTabCopy.inlineHints['mood_score']!), findsOneWidget);

      await tester.tap(find.text('Mood score'));
      await tester.pump();
      expect(find.text(ScanTabCopy.inlineHints['mood_score']!), findsNothing);
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
      expect(find.text('Type 4 · Smooth sausage'), findsOneWidget);
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

    testWidgets('all Armstrong choices keep palette, semantics, and mapping', (
      tester,
    ) async {
      final handle = tester.ensureSemantics();
      final answers = <int>[];
      await tester.pumpWidget(
        _harness(_card('urine_colour', expanded: true, onAnswer: answers.add)),
      );

      for (var value = 1; value <= 8; value++) {
        final name = kArmstrongNames[value - 1];
        final semantic = find.bySemanticsLabel('Urine colour $value · $name');
        expect(find.text(name), findsOneWidget);
        expect(semantic, findsOneWidget);
        final swatch = tester.widget<Container>(
          find.byKey(ValueKey('armstrong-option-$value')),
        );
        expect(
          (swatch.decoration! as BoxDecoration).color,
          kArmstrongColors[value - 1],
        );
        final targetSize = tester.getSize(
          find.byKey(ValueKey('armstrong-target-$value')),
        );
        expect(targetSize.width, greaterThanOrEqualTo(48));
        expect(targetSize.height, greaterThanOrEqualTo(48));
        tester.semantics.performAction(
          find.semantics.byLabel('Urine colour $value · $name'),
          SemanticsAction.tap,
        );
      }
      expect(answers, [1, 2, 3, 4, 5, 6, 7, 8]);
      handle.dispose();
    });

    testWidgets('all Bristol choices share names and render distinct shapes', (
      tester,
    ) async {
      final handle = tester.ensureSemantics();
      final answers = <int>[];
      await tester.pumpWidget(
        _harness(_card('stool_form', expanded: true, onAnswer: answers.add)),
      );

      final signatures = <String>{};
      for (var value = 1; value <= 7; value++) {
        final name = kBristolNames[value - 1];
        final semantic = find.bySemanticsLabel(
          'Stool form Type $value · $name',
        );
        expect(find.text(name), findsOneWidget);
        expect(semantic, findsOneWidget);
        final shape = tester.widget<CustomPaint>(
          find.byKey(ValueKey('bristol-shape-$value')),
        );
        final targetSize = tester.getSize(
          find.byKey(ValueKey('bristol-option-$value')),
        );
        expect(targetSize.width, greaterThanOrEqualTo(48));
        expect(targetSize.height, greaterThanOrEqualTo(48));
        final painter = shape.painter! as BristolShapePainter;
        expect(painter.type, value);
        expect(
          tester.getSize(find.byKey(ValueKey('bristol-shape-size-$value'))),
          const Size(52, 32),
        );
        expect(
          tester.getSize(find.byKey(ValueKey('bristol-shape-$value'))),
          const Size(52, 32),
        );
        signatures.add(
          await _renderSignature(
            tester,
            find.byKey(ValueKey('bristol-shape-boundary-$value')),
          ),
        );
        tester.semantics.performAction(
          find.semantics.byLabel('Stool form Type $value · $name'),
          SemanticsAction.tap,
        );
      }
      expect(signatures, hasLength(7));
      expect(answers, [1, 2, 3, 4, 5, 6, 7]);
      handle.dispose();
    });

    testWidgets('mosquito stepper covers both bounds with labelled 48dp taps', (
      tester,
    ) async {
      final answers = <int>[];
      await tester.pumpWidget(
        _harness(
          _card('mosquito_bites', expanded: true, onAnswer: answers.add),
        ),
      );

      final decrease = find.widgetWithIcon(IconButton, Icons.remove_rounded);
      final increase = find.widgetWithIcon(IconButton, Icons.add_rounded);
      expect(tester.widget<IconButton>(decrease).onPressed, isNull);
      expect(
        find.bySemanticsLabel('Mosquito bites, 0 selected'),
        findsOneWidget,
      );
      expect(find.bySemanticsLabel('Increase mosquito bites'), findsOneWidget);
      expect(tester.getSize(increase), const Size.square(48));
      expect(tester.getSize(decrease), const Size.square(48));
      expect(answers, isEmpty);

      for (var value = 1; value <= 20; value++) {
        await tester.tap(increase);
        await tester.pump();
      }
      expect(
        find.bySemanticsLabel('Mosquito bites, 20 selected'),
        findsOneWidget,
      );
      expect(
        tester
            .widget<IconButton>(
              find.widgetWithIcon(IconButton, Icons.add_rounded),
            )
            .onPressed,
        isNull,
      );
      expect(answers, isEmpty, reason: 'stepping never writes implicitly');
    });

    testWidgets(
      'mosquito edit preserves value and commits only once per Save',
      (tester) async {
        final answers = <int>[];
        Widget card(int value, {bool saving = false}) => _harness(
          _card(
            'mosquito_bites',
            expanded: true,
            currentValue: value,
            saving: saving,
            onAnswer: answers.add,
          ),
        );

        await tester.pumpWidget(card(12));
        expect(
          find.bySemanticsLabel('Mosquito bites, 12 selected'),
          findsOneWidget,
        );
        expect(find.text('12 bites'), findsOneWidget);
        expect(answers, isEmpty);

        final save = find.byKey(const ValueKey('mosquito-save'));
        final saveSize = tester.getSize(save);
        expect(saveSize.width, greaterThanOrEqualTo(48));
        expect(saveSize.height, greaterThanOrEqualTo(48));
        await tester.tap(save);
        await tester.tap(save);
        await tester.pump();
        expect(answers, [12], reason: 'a rapid duplicate Save is ignored');

        await tester.pumpWidget(card(15));
        expect(
          find.bySemanticsLabel('Mosquito bites, 15 selected'),
          findsOneWidget,
        );
        await tester.tap(save);
        await tester.pump();
        expect(answers, [12, 15]);
      },
    );

    testWidgets('mosquito initial values clamp and saving stays inert', (
      tester,
    ) async {
      final answers = <int>[];
      await tester.pumpWidget(
        _harness(
          _card(
            'mosquito_bites',
            expanded: true,
            currentValue: -4,
            onAnswer: answers.add,
          ),
        ),
      );
      expect(
        find.bySemanticsLabel('Mosquito bites, 0 selected'),
        findsOneWidget,
      );

      await tester.pumpWidget(
        _harness(
          _card(
            'mosquito_bites',
            expanded: true,
            currentValue: 12,
            saving: true,
            onAnswer: answers.add,
          ),
        ),
      );
      expect(
        find.bySemanticsLabel('Mosquito bites, 12 selected'),
        findsOneWidget,
      );
      expect(
        tester
            .widget<IconButton>(
              find.widgetWithIcon(IconButton, Icons.remove_rounded),
            )
            .onPressed,
        isNull,
      );
      expect(
        tester
            .widget<IconButton>(
              find.widgetWithIcon(IconButton, Icons.add_rounded),
            )
            .onPressed,
        isNull,
      );
      expect(
        tester
            .widget<FilledButton>(find.byKey(const ValueKey('mosquito-save')))
            .onPressed,
        isNull,
      );
      expect(answers, isEmpty);

      await tester.pumpWidget(
        _harness(
          _card(
            'mosquito_bites',
            expanded: true,
            currentValue: 12,
            onAnswer: answers.add,
          ),
        ),
      );
      await tester.tap(find.byKey(const ValueKey('mosquito-save')));
      await tester.pump();
      expect(answers, [12], reason: 'saving completion enables one retry');

      await tester.pumpWidget(
        _harness(
          _card(
            'mosquito_bites',
            expanded: true,
            currentValue: 99,
            onAnswer: answers.add,
          ),
        ),
      );
      expect(
        find.bySemanticsLabel('Mosquito bites, 20 selected'),
        findsOneWidget,
      );
    });

    testWidgets('special controls fit the 390x844 target viewport', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(390, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      for (final key in ['urine_colour', 'stool_form', 'mosquito_bites']) {
        await tester.pumpWidget(_harness(_card(key, expanded: true)));
        await tester.pump();
        expect(
          tester.takeException(),
          isNull,
          reason: '$key must not overflow',
        );
      }
    });
  });
}
