import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:src/modules/m2_self_report/impl/logging_controller.dart';
import 'package:src/modules/m2_self_report/impl/normaliser.dart';
import 'package:src/modules/m2_self_report/ui/screens/scan_tab.dart';
import 'package:src/modules/m5a_baselines/index.dart' show metricDisplayLabel;

List<String> get dailyCoreKeys => kDailyCoreDqsWeights.keys.toList();
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
Widget globeHarness(Widget child, {bool reduceMotion = false}) => MaterialApp(
  home: MediaQuery(
    data: MediaQueryData(disableAnimations: reduceMotion),
    child: Scaffold(body: Center(child: child)),
  ),
);
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

class ScanGapListHost extends StatefulWidget {
  final List<String> metricKeys;
  final Map<String, int?> answered;
  final Set<String> savingKeys;
  final void Function(String metricKey, int value)? onAnswer;
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
            setState(() => openGapKey = null);
          },
        ),
        const SizedBox(height: 11),
      ],
    ],
  );
}

String expandedProbe(String metricKey) => ScanTabCopy.inlineHints[metricKey]!;

enum ScanControl { chips, armstrong, bristol, quickCount }

ScanControl controlFor(String metricKey) => switch (metricKey) {
  'urine_colour' => ScanControl.armstrong,
  'stool_form' => ScanControl.bristol,
  'outside_meals' || 'mosquito_bites' => ScanControl.quickCount,
  _ => ScanControl.chips,
};
bool hasPerValueButtons(String metricKey) =>
    controlFor(metricKey) != ScanControl.quickCount;
String optionSemanticLabel(String metricKey, int value) =>
    switch (controlFor(metricKey)) {
      ScanControl.armstrong || ScanControl.bristol =>
        '${metricDisplayLabel(metricKey)} '
            '${ScanTabCopy.answerLabel(metricKey, value)}',
      ScanControl.chips ||
      ScanControl.quickCount => '${metricDisplayLabel(metricKey)} $value',
    };
String stepperReadoutLabel(int value) => 'Mosquito bites, $value selected';
String scanTabSource() => File(
  'lib/modules/m2_self_report/ui/screens/scan_tab.dart',
).readAsStringSync();
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

String squashWhitespace(String source) =>
    source.replaceAll(RegExp(r'\s+'), ' ');
Finder findGapCard(String metricKey) => find.byWidgetPredicate(
  (w) => w is GapCard && w.metricKey == metricKey,
  description: 'GapCard($metricKey)',
);
Finder findExpandedArea(String metricKey) => find.descendant(
  of: findGapCard(metricKey),
  matching: find.text(expandedProbe(metricKey)),
);
Finder findOption(String metricKey, int value) {
  final matching = switch (controlFor(metricKey)) {
    ScanControl.chips => find.text('$value'),
    ScanControl.armstrong => find.byKey(ValueKey('armstrong-target-$value')),
    ScanControl.bristol => find.byKey(ValueKey('bristol-option-$value')),
    ScanControl.quickCount => find.byKey(
      ValueKey('quick-count-$metricKey-$value'),
    ),
  };
  return find.descendant(of: findGapCard(metricKey), matching: matching);
}

Finder findQuickOther(String metricKey) =>
    find.byKey(ValueKey('quick-count-$metricKey-other'));
Finder findQuickField(String metricKey) =>
    find.byKey(ValueKey('quick-count-$metricKey-field'));
Finder findQuickApply(String metricKey) =>
    find.byKey(ValueKey('quick-count-$metricKey-apply'));
Future<void> answerWith(
  WidgetTester tester,
  String metricKey,
  int value,
) async {
  if (controlFor(metricKey) == ScanControl.quickCount && value > 3) {
    await tester.ensureVisible(findQuickOther(metricKey));
    await tester.tap(findQuickOther(metricKey));
    await tester.pump();
    await tester.enterText(findQuickField(metricKey), '$value');
    await tester.tap(findQuickApply(metricKey));
    await tester.pump();
    return;
  }
  final target = findOption(metricKey, value);
  await tester.ensureVisible(target);
  await tester.tap(target);
  await tester.pump();
}

Future<void> tapGapCard(WidgetTester tester, String metricKey) async {
  await tester.tap(
    find.descendant(
      of: findGapCard(metricKey),
      matching: find.text(metricDisplayLabel(metricKey)),
    ),
  );
  await tester.pump();
}
