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

/// What a screen reader is meant to announce for the chip offering [value].
String chipSemanticLabel(String metricKey, int value) =>
    '${metricDisplayLabel(metricKey)} $value';

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

/// The chip offering [value] inside [metricKey]'s card.
Finder findChip(String metricKey, int value) =>
    find.descendant(of: findGapCard(metricKey), matching: find.text('$value'));

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
