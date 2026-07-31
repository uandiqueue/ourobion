// Shared harness for the Scan tab's widget coverage. Not a `*_test.dart` file,
// so `flutter test` does not run it as a suite (same convention as
// test/guards/guard_support.dart).
//
// WHY A HARNESS AT ALL: the default `ScanTab` path reads Supabase in `initState`.
// `scan_tab_widgets_test.dart` now pumps the actual tab through deterministic
// callbacks for state sequencing. This harness remains for direct components —
// [ScanGlobe], [GapCard], [EnvironmentRow] — are public exactly so they can be
// pumped directly, and [ScanGapListHost] below re-creates the ONE piece of
// state that lives in `_ScanTabState` rather than in a public widget: the
// single `_openGapKey` that keeps exactly one gap card expanded.
//
// A harness that mirrors the screen is only worth anything if the mirror is
// held to the original, so `scan_tab_widgets_test.dart` carries a source guard
// that asserts scan_tab.dart still wires its cards the way [ScanGapListHost]
// does. If the screen's wiring changes, that guard fails rather than this
// harness quietly testing a fiction.

import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:src/modules/m2_self_report/impl/logging_controller.dart';
import 'package:src/modules/m2_self_report/impl/normaliser.dart';
import 'package:src/modules/m2_self_report/ui/screens/scan_tab.dart';
import 'package:src/modules/m5a_baselines/index.dart' show metricDisplayLabel;

/// The seven daily-core keys, in registry order. Every "for every metric" loop
/// in this directory iterates this rather than a hand-written list.
List<String> get dailyCoreKeys => kDailyCoreDqsWeights.keys.toList();

/// Standard pump target: a scrollable page with the tab's own outer padding.
///
/// [reduceMotion] drives `MediaQuery.disableAnimations`, which the Scan tab
/// reads through `MediaQuery.maybeDisableAnimationsOf`.
Widget scanHarness(
  Widget child, {
  bool reduceMotion = false,
  List<NavigatorObserver> navigatorObservers = const [],
}) => MaterialApp(
  navigatorObservers: navigatorObservers,
  home: MediaQuery(
    data: MediaQueryData(disableAnimations: reduceMotion),
    child: Scaffold(
      body: SingleChildScrollView(
        child: Padding(padding: const EdgeInsets.all(16), child: child),
      ),
    ),
  ),
);

/// Centred pump target for the globe, which the tab renders in a `Center`.
Widget globeHarness(Widget child, {bool reduceMotion = false}) => MaterialApp(
  home: MediaQuery(
    data: MediaQueryData(disableAnimations: reduceMotion),
    child: Scaffold(body: Center(child: child)),
  ),
);

/// A [ScanGlobe] driven by stopped animations — the geometry and presence
/// assertions do not need a ticker.
ScanGlobe stoppedGlobe({
  bool scanning = false,
  bool completed = false,
  int coverage = 68,
  int missingCount = 2,
  double sweep = 0,
  double reveal = 1,
}) => ScanGlobe(
  scanning: scanning,
  completed: completed,
  coverage: coverage,
  missingCount: missingCount,
  sweepAnimation: AlwaysStoppedAnimation(sweep),
  completionAnimation: AlwaysStoppedAnimation(reveal),
);

/// One [GapCard] with the same argument shape `_ScanTabState.build` uses.
GapCard gapCard(
  String metricKey, {
  bool expanded = false,
  bool saving = false,
  int? currentValue,
  VoidCallback? onToggle,
  ValueChanged<int>? onAnswer,
}) => GapCard(
  metricKey: metricKey,
  weight: kDailyCoreDqsWeights[metricKey]!,
  options: kInlineAnswerableOptions[metricKey]!,
  currentValue: currentValue,
  expanded: expanded,
  saving: saving,
  onToggle: onToggle ?? () {},
  onAnswer: onAnswer ?? (_) {},
);

/// The gap-card list exactly as `_ScanTabState` composes it, including the
/// single nullable `_openGapKey` that makes the list one-open-at-a-time.
///
/// Held to scan_tab.dart by the source guard in scan_tab_widgets_test.dart.
class ScanGapListHost extends StatefulWidget {
  final List<String> metricKeys;

  /// Today's stored value per key — `null` means the gap is still open.
  final Map<String, int?> answered;
  final Set<String> savingKeys;
  final void Function(String metricKey, int value)? onAnswer;

  /// Set to a key to open that card before the first frame, mirroring a tab
  /// resumed with a card already expanded.
  final String? initiallyOpen;

  const ScanGapListHost({
    super.key,
    required this.metricKeys,
    this.answered = const {},
    this.savingKeys = const {},
    this.onAnswer,
    this.initiallyOpen,
  });

  @override
  State<ScanGapListHost> createState() => ScanGapListHostState();
}

class ScanGapListHostState extends State<ScanGapListHost> {
  /// Mirrors `_ScanTabState._openGapKey`.
  String? openGapKey;

  @override
  void initState() {
    super.initState();
    openGapKey = widget.initiallyOpen;
  }

  @override
  Widget build(BuildContext context) => Column(
    children: [
      for (final key in widget.metricKeys) ...[
        gapCard(
          key,
          currentValue: widget.answered[key],
          expanded: openGapKey == key,
          saving: widget.savingKeys.contains(key),
          onToggle: () =>
              setState(() => openGapKey = openGapKey == key ? null : key),
          onAnswer: (value) {
            widget.onAnswer?.call(key, value);
            // `_answerInline` closes the card once the write lands.
            setState(() => openGapKey = null);
          },
        ),
        const SizedBox(height: 11),
      ],
    ],
  );
}

/// The one-line hint a card only renders while expanded — the cheapest
/// unambiguous "this card is open" probe on the merged surface.
String expandedProbe(String metricKey) => ScanTabCopy.inlineHints[metricKey]!;

/// Which inline control a metric answers with. `_InlineAnswerControl` in
/// scan_tab.dart dispatches on the metric key to honour the registry's declared
/// affordance, so the finders below follow the same split rather than assuming
/// every scale is a chip row. A "for every metric" loop has to branch on this,
/// which is the point: it cannot silently assert chip-shaped things about the
/// colour, shape and counter controls.
enum ScanControl {
  /// A wrapped row of numbered chips — one tap target per accepted value.
  chips,

  /// Named Armstrong colour swatches — one tap target per accepted value.
  armstrong,

  /// Named, shape-led Bristol rows — one tap target per accepted value.
  bristol,

  /// A -/readout/+/Save stepper. No per-value tap target exists: a value is
  /// reached by stepping and then deliberately committed.
  stepper,
}

ScanControl controlFor(String metricKey) => switch (metricKey) {
  'urine_colour' => ScanControl.armstrong,
  'stool_form' => ScanControl.bristol,
  'mosquito_bites' => ScanControl.stepper,
  _ => ScanControl.chips,
};

/// True when [metricKey]'s control exposes one button per accepted value.
bool hasPerValueButtons(String metricKey) =>
    controlFor(metricKey) != ScanControl.stepper;

/// What a screen reader is meant to announce for the control offering [value].
/// The descriptive scales carry their name as well as the number, because
/// "Urine colour 6" alone says nothing about what 6 looks like.
String optionSemanticLabel(String metricKey, int value) =>
    switch (controlFor(metricKey)) {
      ScanControl.armstrong || ScanControl.bristol =>
        '${metricDisplayLabel(metricKey)} '
            '${ScanTabCopy.answerLabel(metricKey, value)}',
      ScanControl.chips => '${metricDisplayLabel(metricKey)} $value',
      ScanControl.stepper => throw StateError(
        '$metricKey answers with a stepper, which has no per-value button — '
        'assert stepperReadoutLabel() and the labelled +/- instead',
      ),
    };

/// What the stepper's live readout announces while [value] is pending.
String stepperReadoutLabel(int value) => 'Mosquito bites, $value selected';

// ── Source guards ──────────────────────────────────────────────────────────
// The screen's own state (`_openGapKey`, `_sweepAnim`) is private and
// unpumpable, so the harnesses above stand in for it. These let each suite
// hold the stand-in to the real thing instead of trusting it.

/// The merged Scan tab's source. `flutter test` runs from the package root.
String scanTabSource() => File(
  'lib/modules/m2_self_report/ui/screens/scan_tab.dart',
).readAsStringSync();

/// The text of one top-level declaration in [source], from `class X` / `enum X`
/// up to the next top-level declaration.
String declarationBody(String source, String name) {
  final decl = RegExp(
    r'^(?:abstract final )?(?:class|enum) (\w+)',
    multiLine: true,
  );
  final matches = decl.allMatches(source).toList();
  for (var i = 0; i < matches.length; i++) {
    if (matches[i].group(1) != name) continue;
    final end = (i + 1 < matches.length) ? matches[i + 1].start : source.length;
    return source.substring(matches[i].start, end);
  }
  throw StateError('declaration "$name" not found in scan_tab.dart');
}

/// Collapses runs of whitespace so a source assertion survives reformatting.
/// (Named `squash…` because `matcher` already exports a `collapseWhitespace`.)
String squashWhitespace(String source) =>
    source.replaceAll(RegExp(r'\s+'), ' ');

// ── Finders ────────────────────────────────────────────────────────────────

Finder findGapCard(String metricKey) => find.byWidgetPredicate(
  (w) => w is GapCard && w.metricKey == metricKey,
  description: 'GapCard($metricKey)',
);

/// True when [metricKey]'s card is rendering its inline chip row.
Finder findExpandedArea(String metricKey) => find.descendant(
  of: findGapCard(metricKey),
  matching: find.text(expandedProbe(metricKey)),
);

/// The tap target offering [value] inside [metricKey]'s card, whichever control
/// the metric got. Throws for the stepper, which has no per-value target — see
/// [stepStepperTo].
Finder findOption(String metricKey, int value) {
  final matching = switch (controlFor(metricKey)) {
    ScanControl.chips => find.text('$value'),
    ScanControl.armstrong => find.byKey(ValueKey('armstrong-target-$value')),
    ScanControl.bristol => find.byKey(ValueKey('bristol-option-$value')),
    ScanControl.stepper => throw StateError(
      '$metricKey answers with a stepper — step to the value instead of '
      'looking for a button that offers it',
    ),
  };
  return find.descendant(of: findGapCard(metricKey), matching: matching);
}

// ── The mosquito stepper ───────────────────────────────────────────────────

Finder get findStepperIncrease =>
    find.widgetWithIcon(IconButton, Icons.add_rounded);
Finder get findStepperDecrease =>
    find.widgetWithIcon(IconButton, Icons.remove_rounded);
Finder get findStepperSave => find.byKey(const ValueKey('mosquito-save'));

/// The value the stepper is currently showing, read off its own readout rather
/// than tracked separately by the test.
int stepperValue(WidgetTester tester) {
  final readout = tester.widget<Text>(
    find.descendant(
      of: find.byKey(const ValueKey('mosquito-selected-value')),
      matching: find.byType(Text),
    ),
  );
  return int.parse(readout.data!.split(' ').first);
}

/// Walks the stepper's +/- from wherever it sits to [value], failing loudly if
/// a bound stops it short instead of looping forever.
Future<void> stepStepperTo(WidgetTester tester, int value) async {
  var current = stepperValue(tester);
  while (current != value) {
    final button = current < value ? findStepperIncrease : findStepperDecrease;
    await tester.ensureVisible(button);
    await tester.tap(button);
    await tester.pump();
    final next = stepperValue(tester);
    if (next == current) {
      throw StateError('the stepper will not move past $current toward $value');
    }
    current = next;
  }
}

/// Answers [metricKey] with [value] the way a person would: one tap on the
/// per-value controls, step-then-Save on the stepper. The expanded Armstrong
/// and Bristol controls are tall, so every target is scrolled into view first.
Future<void> answerWith(
  WidgetTester tester,
  String metricKey,
  int value,
) async {
  final target = controlFor(metricKey) == ScanControl.stepper
      ? findStepperSave
      : findOption(metricKey, value);
  if (controlFor(metricKey) == ScanControl.stepper) {
    await stepStepperTo(tester, value);
  }
  await tester.ensureVisible(target);
  await tester.tap(target);
  await tester.pump();
}

/// Taps a card's own body (its metric name), which is what a user taps to
/// open it — the card centre can land on a chip once it is already open.
Future<void> tapGapCard(WidgetTester tester, String metricKey) async {
  await tester.tap(
    find.descendant(
      of: findGapCard(metricKey),
      matching: find.text(metricDisplayLabel(metricKey)),
    ),
  );
  await tester.pump();
}
