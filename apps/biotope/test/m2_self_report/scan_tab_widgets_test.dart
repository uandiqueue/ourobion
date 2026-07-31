import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:src/modules/m2_self_report/impl/logging_controller.dart';
import 'package:src/modules/m2_self_report/impl/normaliser.dart';
import 'package:src/modules/m2_self_report/ui/screens/scan_tab.dart';
import 'package:src/modules/m2_self_report/ui/widgets/daily_scale_visuals.dart';
import 'package:src/modules/m3_passive_health/index.dart';
import 'package:src/modules/m5a_baselines/index.dart' show metricDisplayLabel;
import 'scan_test_support.dart';
class _RouteLog extends NavigatorObserver {
  final pushed = <Route<dynamic>>[];
  @override
  void didPush(Route<dynamic> route, Route<dynamic>? previousRoute) {
    pushed.add(route);
    super.didPush(route, previousRoute);
  }
}
class _AnsweringList extends StatefulWidget {
  final List<String> metricKeys;
  const _AnsweringList(this.metricKeys);
  @override
  State<_AnsweringList> createState() => _AnsweringListState();
}
class _AnsweringListState extends State<_AnsweringList> {
  final Map<String, int?> _row = {};
  @override
  Widget build(BuildContext context) => ScanGapListHost(
    metricKeys: widget.metricKeys,
    answered: _row,
    onAnswer: (key, value) => setState(() => _row[key] = value),
  );
}
class _ScanRuntime {
  _ScanRuntime({required this.row, this.failSave = false});
  final Map<String, dynamic> row;
  final bool failSave;
  final List<(String, int)> saves = [];
  final List<double> engagementUpdates = [];
  Future<Map<String, dynamic>?> loadToday() async => {...row};
  Future<WearableReading?> syncWearable() async => null;
  Future<double> saveFieldAnswer(String key, int value) async {
    saves.add((key, value));
    if (failSave) throw StateError('simulated save failure');
    row[key] = value;
    final total = kDailyCoreDqsWeights.entries
        .where((entry) => row[entry.key] != null)
        .fold<int>(0, (sum, entry) => sum + entry.value);
    row['log_completeness'] = total.toDouble();
    return total.toDouble();
  }
  Future<void> updateEngagement(double completeness) async {
    engagementUpdates.add(completeness);
  }
}
Map<String, dynamic> _scanRowWithGaps(Iterable<String> gaps) => {
  for (final key in kDailyCoreDqsWeights.keys)
    key: gaps.contains(key) ? null : 3,
  'log_completeness': kDailyCoreDqsWeights.entries
      .where((entry) => !gaps.contains(entry.key))
      .fold<int>(0, (sum, entry) => sum + entry.value)
      .toDouble(),
};
Widget _realScanHarness(_ScanRuntime runtime, {_RouteLog? routes}) =>
    MaterialApp(
      navigatorObservers: routes == null ? const [] : [routes],
      home: MediaQuery(
        data: const MediaQueryData(size: Size(390, 844)),
        child: ScanTab(
          loadToday: runtime.loadToday,
          syncWearable: runtime.syncWearable,
          saveFieldAnswer: runtime.saveFieldAnswer,
          updateEngagement: runtime.updateEngagement,
          sweepFloor: Duration.zero,
        ),
      ),
    );
Future<String> _renderSignature(
  WidgetTester tester,
  Finder boundaryFinder,
) async {
  final boundary = tester.renderObject<RenderRepaintBoundary>(boundaryFinder);
  final signature = await tester.runAsync(() async {
    final image = await boundary.toImage(pixelRatio: 1);
    final data = await image.toByteData(format: ui.ImageByteFormat.rawRgba);
    image.dispose();
    return String.fromCharCodes(data!.buffer.asUint8List());
  });
  return signature!;
}
void main() {
  group('the real ScanTab state machine', () {
    testWidgets(
      'keeps one card open, saves inline, reloads, and never navigates',
      (tester) async {
        final runtime = _ScanRuntime(
          row: _scanRowWithGaps(const ['mood_score', 'energy_score']),
        );
        final routes = _RouteLog();
        await tester.pumpWidget(_realScanHarness(runtime, routes: routes));
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 1));
        final routeCount = routes.pushed.length;
        final runSweep = find.text('Run sweep');
        await tester.ensureVisible(runSweep);
        await tester.tap(runSweep);
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 500));
        expect(find.textContaining('NEEDS YOU'), findsOneWidget);
        await tester.ensureVisible(findGapCard('mood_score'));
        await tapGapCard(tester, 'mood_score');
        expect(findExpandedArea('mood_score'), findsOneWidget);
        await tester.ensureVisible(findGapCard('energy_score'));
        await tapGapCard(tester, 'energy_score');
        expect(findExpandedArea('mood_score'), findsNothing);
        expect(findExpandedArea('energy_score'), findsOneWidget);
        await answerWith(tester, 'energy_score', 5);
        await tester.pumpAndSettle();
        expect(runtime.saves, [('energy_score', 5)]);
        expect(runtime.engagementUpdates, [93.0]);
        expect(
          findExpandedArea('energy_score'),
          findsNothing,
          reason: 'only a landed save followed by reload closes the card',
        );
        expect(
          find.text(ScanTabCopy.answerLabel('energy_score', 5)),
          findsOneWidget,
        );
        expect(
          routes.pushed.length,
          routeCount,
          reason: 'the primary inline action must not open DailyLogScreen',
        );
      },
    );
    testWidgets(
      'a failed save leaves the actual card open and reports the error',
      (tester) async {
        final runtime = _ScanRuntime(
          row: _scanRowWithGaps(const ['mood_score']),
          failSave: true,
        );
        await tester.pumpWidget(_realScanHarness(runtime));
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 1));
        final runSweep = find.text('Run sweep');
        await tester.ensureVisible(runSweep);
        await tester.tap(runSweep);
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 500));
        await tester.ensureVisible(findGapCard('mood_score'));
        await tapGapCard(tester, 'mood_score');
        await answerWith(tester, 'mood_score', 4);
        await tester.pumpAndSettle();
        expect(runtime.saves, [('mood_score', 4)]);
        expect(
          runtime.engagementUpdates,
          isEmpty,
          reason: 'bookkeeping follows a successful persistence only',
        );
        expect(
          findExpandedArea('mood_score'),
          findsOneWidget,
          reason: 'a failed write must not pretend the answer was saved',
        );
        expect(find.text(ScanTabCopy.gapSaveFailed), findsOneWidget);
      },
    );
  });
  group('item 8 · the environment row stays truthfully "Not built"', () {
    testWidgets('it names the absence instead of promising a delivery', (
      tester,
    ) async {
      await tester.pumpWidget(scanHarness(const EnvironmentRow()));
      expect(find.text(ScanTabCopy.environmentLabel), findsOneWidget);
      expect(find.text(ScanTabCopy.environmentDetail), findsOneWidget);
      expect(
        find.text(ScanTabCopy.environmentStatus.toUpperCase()),
        findsOneWidget,
      );
      expect(find.textContaining('Coming soon'), findsNothing);
      expect(find.textContaining('COMING SOON'), findsNothing);
    });
    testWidgets('the word "Synced" never appears in it', (tester) async {
      await tester.pumpWidget(scanHarness(const EnvironmentRow()));
      expect(
        find.textContaining('Synced'),
        findsNothing,
        reason: 'an environmental sync that does not exist must not be claimed',
      );
      expect(find.textContaining('synced'), findsNothing);
      for (final copy in [
        ScanTabCopy.environmentLabel,
        ScanTabCopy.environmentStatus,
        ScanTabCopy.environmentDetail,
        ScanTabCopy.environmentSemanticLabel,
      ]) {
        expect(copy.toLowerCase(), isNot(contains('sync')));
      }
    });
    testWidgets('it is inert — nothing in it can be tapped', (tester) async {
      await tester.pumpWidget(scanHarness(const EnvironmentRow()));
      final row = find.byType(EnvironmentRow);
      for (final interactive in <Type>[
        GestureDetector,
        InkWell,
        Switch,
        Checkbox,
        Radio<Object>,
        TextButton,
        FilledButton,
        ElevatedButton,
        OutlinedButton,
        IconButton,
        Focus,
      ]) {
        expect(
          find.descendant(of: row, matching: find.byType(interactive)),
          findsNothing,
          reason:
              'a $interactive here would be a control with no data source '
              'behind it',
        );
      }
    });
    testWidgets('it is one disabled node for assistive tech', (tester) async {
      final handle = tester.ensureSemantics();
      await tester.pumpWidget(scanHarness(const EnvironmentRow()));
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
    test('the widget itself takes no callback that could make it live', () {
      final body = declarationBody(scanTabSource(), 'EnvironmentRow');
      for (final token in ['onTap', 'onChanged', 'onPressed', 'VoidCallback']) {
        expect(
          body.contains(token),
          isFalse,
          reason:
              'EnvironmentRow exposes "$token" — an unbuilt channel must '
              'not be one argument away from looking operable',
        );
      }
    });
  });
  group('item 4 · a gap card answers in place, then settles into logged', () {
    testWidgets('a collapsed card shows no options and says it can be answered '
        'here', (tester) async {
      await tester.pumpWidget(scanHarness(gapCard('mood_score')));
      expect(findExpandedArea('mood_score'), findsNothing);
      expect(find.text(ScanTabCopy.gapAnswerHere), findsOneWidget);
      expect(
        find.text(ScanTabCopy.gapWeight(kDailyCoreDqsWeights['mood_score']!)),
        findsOneWidget,
      );
    });
    testWidgets('tapping it expands it into the metric\'s options', (
      tester,
    ) async {
      final answers = <String, int>{};
      await tester.pumpWidget(
        scanHarness(
          ScanGapListHost(
            metricKeys: const ['mood_score'],
            onAnswer: (k, v) => answers[k] = v,
          ),
        ),
      );
      await tapGapCard(tester, 'mood_score');
      expect(findExpandedArea('mood_score'), findsOneWidget);
      for (final option in kInlineAnswerableOptions['mood_score']!) {
        expect(findOption('mood_score', option), findsOneWidget);
      }
      await answerWith(tester, 'mood_score', 4);
      expect(answers, {'mood_score': 4});
    });
    testWidgets('an answered card collapses into a logged state naming the '
        'saved value', (tester) async {
      await tester.pumpWidget(
        scanHarness(const _AnsweringList(['stool_form'])),
      );
      await tapGapCard(tester, 'stool_form');
      expect(findExpandedArea('stool_form'), findsOneWidget);
      await answerWith(tester, 'stool_form', 4);
      expect(
        findExpandedArea('stool_form'),
        findsNothing,
        reason:
            'the card must settle itself once the write lands — no extra tap',
      );
      expect(find.text(ScanTabCopy.gapLogged), findsOneWidget);
      expect(
        find.text(ScanTabCopy.answerLabel('stool_form', 4)),
        findsOneWidget,
        reason:
            'a logged card must say WHAT was logged, not just that '
            'something was',
      );
      expect(find.text(ScanTabCopy.gapSaved), findsOneWidget);
      expect(
        find.text(ScanTabCopy.gapWeight(kDailyCoreDqsWeights['stool_form']!)),
        findsNothing,
        reason: 'an answered card must stop claiming it is not logged today',
      );
    });
    testWidgets('the logged state offers a way back in, and it works', (
      tester,
    ) async {
      await tester.pumpWidget(
        scanHarness(const _AnsweringList(['mood_score'])),
      );
      await tapGapCard(tester, 'mood_score');
      await answerWith(tester, 'mood_score', 5);
      expect(find.text(ScanTabCopy.gapChange), findsOneWidget);
      await tapGapCard(tester, 'mood_score');
      expect(
        findExpandedArea('mood_score'),
        findsOneWidget,
        reason: 'a logged answer must stay correctable from the same card',
      );
      await answerWith(tester, 'mood_score', 2);
      expect(
        find.text(ScanTabCopy.answerLabel('mood_score', 2)),
        findsOneWidget,
      );
    });
    testWidgets('a write in flight makes the card inert and says so', (
      tester,
    ) async {
      final answers = <int>[];
      await tester.pumpWidget(
        scanHarness(
          gapCard(
            'gut_comfort_score',
            expanded: true,
            saving: true,
            onAnswer: answers.add,
          ),
        ),
      );
      expect(find.text(ScanTabCopy.gapSaving), findsOneWidget);
      await tester.tap(findOption('gut_comfort_score', 3));
      await tester.pump();
      expect(
        answers,
        isEmpty,
        reason: 'a second tap must not queue a second write to the column',
      );
    });
    testWidgets('one card can be saving while the others stay answerable', (
      tester,
    ) async {
      final answers = <String, int>{};
      await tester.pumpWidget(
        scanHarness(
          ScanGapListHost(
            metricKeys: const ['mood_score', 'energy_score'],
            savingKeys: const {'mood_score'},
            onAnswer: (k, v) => answers[k] = v,
          ),
        ),
      );
      await tapGapCard(tester, 'energy_score');
      await answerWith(tester, 'energy_score', 2);
      expect(answers, {'energy_score': 2});
    });
  });
  group('item 4 · exactly one card is expanded at a time', () {
    testWidgets('the list opens with every card collapsed', (tester) async {
      const keys = ['mood_score', 'energy_score', 'outside_meals'];
      await tester.pumpWidget(
        scanHarness(const ScanGapListHost(metricKeys: keys)),
      );
      for (final key in keys) {
        expect(findExpandedArea(key), findsNothing);
      }
    });
    testWidgets('expanding a second card collapses the first', (tester) async {
      await tester.pumpWidget(
        scanHarness(
          const ScanGapListHost(
            metricKeys: ['mood_score', 'energy_score', 'outside_meals'],
          ),
        ),
      );
      await tapGapCard(tester, 'mood_score');
      expect(findExpandedArea('mood_score'), findsOneWidget);
      expect(findExpandedArea('energy_score'), findsNothing);
      expect(findExpandedArea('outside_meals'), findsNothing);
      await tapGapCard(tester, 'energy_score');
      expect(
        findExpandedArea('mood_score'),
        findsNothing,
        reason: 'the reference keeps exactly one gap open',
      );
      expect(findExpandedArea('energy_score'), findsOneWidget);
      await tapGapCard(tester, 'outside_meals');
      expect(findExpandedArea('energy_score'), findsNothing);
      expect(findExpandedArea('outside_meals'), findsOneWidget);
    });
    testWidgets('never more than one card is open, whatever the tap order', (
      tester,
    ) async {
      final keys = dailyCoreKeys;
      await tester.pumpWidget(scanHarness(ScanGapListHost(metricKeys: keys)));
      for (final key in [...keys, ...keys.reversed]) {
        await tester.ensureVisible(findGapCard(key));
        await tapGapCard(tester, key);
        final open = keys.where(
          (k) => findExpandedArea(k).evaluate().isNotEmpty,
        );
        expect(
          open.length,
          lessThanOrEqualTo(1),
          reason: 'after tapping $key, these were open: $open',
        );
      }
    });
    testWidgets('an expanded card can be tapped shut, so a lone open card is '
        'not a trap', (tester) async {
      final answers = <String, int>{};
      await tester.pumpWidget(
        scanHarness(
          ScanGapListHost(
            metricKeys: const ['mood_score'],
            onAnswer: (k, v) => answers[k] = v,
          ),
        ),
      );
      await tapGapCard(tester, 'mood_score');
      expect(findExpandedArea('mood_score'), findsOneWidget);
      await tapGapCard(tester, 'mood_score');
      expect(
        findExpandedArea('mood_score'),
        findsNothing,
        reason: 'tapping the open card\'s header closes the inline logger',
      );
      expect(
        tester.widget<GapCard>(findGapCard('mood_score')).expanded,
        isFalse,
      );
      expect(
        answers,
        isEmpty,
        reason: 'closing a card must not write an answer nobody picked',
      );
    });
    testWidgets('a card being saved is not tappable, open or shut', (
      tester,
    ) async {
      var toggles = 0;
      await tester.pumpWidget(
        scanHarness(
          gapCard(
            'mood_score',
            expanded: true,
            saving: true,
            onToggle: () => toggles++,
          ),
        ),
      );
      await tapGapCard(tester, 'mood_score');
      expect(
        toggles,
        0,
        reason:
            'collapsing the card mid-write would hide the answer the person '
            'is waiting on',
      );
    });
    testWidgets('answering is what closes the last open card', (tester) async {
      await tester.pumpWidget(
        scanHarness(const _AnsweringList(['mood_score'])),
      );
      await tapGapCard(tester, 'mood_score');
      expect(findExpandedArea('mood_score'), findsOneWidget);
      await answerWith(tester, 'mood_score', 3);
      expect(findExpandedArea('mood_score'), findsNothing);
    });
  });
  group(
    'item 5 · the primary inline action never opens the full Daily Log',
    () {
      for (final metricKey in kDailyCoreDqsWeights.keys) {
        testWidgets('$metricKey expands in place and pushes no route', (
          tester,
        ) async {
          final routes = _RouteLog();
          final answers = <String, int>{};
          await tester.pumpWidget(
            scanHarness(
              ScanGapListHost(
                metricKeys: [metricKey],
                onAnswer: (k, v) => answers[k] = v,
              ),
              navigatorObservers: [routes],
            ),
          );
          final afterMount = routes.pushed.length;
          await tapGapCard(tester, metricKey);
          expect(
            findExpandedArea(metricKey),
            findsOneWidget,
            reason: '$metricKey must be answerable without leaving the tab',
          );
          final first = kInlineAnswerableOptions[metricKey]!.first;
          await answerWith(tester, metricKey, first);
          await tester.pumpAndSettle();
          expect(answers, {metricKey: first});
          expect(
            routes.pushed.length,
            afterMount,
            reason:
                'answering $metricKey pushed a route — the card\'s main '
                'interaction must not open DailyLogScreen',
          );
        });
      }
      testWidgets('no card offers the full log as an escape hatch either', (
        tester,
      ) async {
        for (final key in dailyCoreKeys) {
          await tester.pumpWidget(scanHarness(gapCard(key, expanded: true)));
          expect(find.textContaining('Daily Log'), findsNothing);
          expect(find.textContaining('full log'), findsNothing);
          expect(find.textContaining('Open the'), findsNothing);
        }
      });
      test('the gap card cannot navigate: it holds no route and no screen', () {
        final body = declarationBody(scanTabSource(), 'GapCard');
        for (final token in [
          'Navigator',
          'MaterialPageRoute',
          'DailyLogScreen',
          'onOpenFullLog',
        ]) {
          expect(
            body.contains(token),
            isFalse,
            reason: 'GapCard mentions "$token"',
          );
        }
      });
      test('the whole tab never pushes a route for an inline answer', () {
        final source = scanTabSource();
        expect(source.contains('Navigator.'), isFalse);
        expect(source.contains('MaterialPageRoute'), isFalse);
        expect(
          source.contains("import '../screens/daily_log_screen.dart'"),
          isFalse,
        );
        expect(
          RegExp(
            r'''import\s+['"][^'"]*daily_log_screen\.dart['"]''',
          ).hasMatch(source),
          isFalse,
          reason: 'the Scan tab does not depend on the full Daily Log at all',
        );
      });
    },
  );
  group(
    'item 9 · every inline option is a labelled button for assistive tech',
    () {
      for (final metricKey in dailyCoreKeys.where(hasPerValueButtons)) {
        testWidgets(
          '$metricKey exposes one labelled button per accepted value',
          (tester) async {
            final handle = tester.ensureSemantics();
            await tester.pumpWidget(
              scanHarness(gapCard(metricKey, expanded: true)),
            );
            for (final option in kInlineAnswerableOptions[metricKey]!) {
              final label = optionSemanticLabel(metricKey, option);
              expect(
                find.bySemanticsLabel(label),
                findsOneWidget,
                reason:
                    '"$label" must be announced — a bare "$option" says '
                    'nothing about which scale it belongs to',
              );
              expect(
                tester.getSemantics(find.bySemanticsLabel(label)),
                matchesSemantics(
                  label: label,
                  isButton: true,
                  hasEnabledState: true,
                  isEnabled: true,
                  hasTapAction: true,
                ),
              );
            }
            handle.dispose();
          },
        );
      }
      testWidgets('mosquito_bites is the one stepper, and its increment, '
          'decrement and pending value are all announced', (tester) async {
        final handle = tester.ensureSemantics();
        await tester.pumpWidget(
          scanHarness(gapCard('mosquito_bites', expanded: true)),
        );
        const stepLabels = [
          'Increase mosquito bites',
          'Decrease mosquito bites',
        ];
        for (final label in stepLabels) {
          expect(
            tester.getSemantics(find.bySemanticsLabel(label)),
            isSemantics(label: label, isButton: true),
          );
        }
        final options = kInlineAnswerableOptions['mosquito_bites']!;
        expect(
          tester.getSemantics(
            find.bySemanticsLabel(stepperReadoutLabel(options.first)),
          ),
          isSemantics(
            label: stepperReadoutLabel(options.first),
            isLiveRegion: true,
          ),
          reason:
              'the pending count must be its own live node, not text merged '
              'into the card that announced it once and never again',
        );
        for (final value in options) {
          await stepStepperTo(tester, value);
          expect(
            find.bySemanticsLabel(stepperReadoutLabel(value)),
            findsOneWidget,
            reason: 'stepping to $value must announce $value',
          );
        }
        handle.dispose();
      });
      testWidgets('no other metric grew an unlabelled stepper or slider', (
        tester,
      ) async {
        final handle = tester.ensureSemantics();
        for (final key in dailyCoreKeys.where(hasPerValueButtons)) {
          await tester.pumpWidget(scanHarness(gapCard(key, expanded: true)));
          for (final icon in [
            Icons.add,
            Icons.add_rounded,
            Icons.remove,
            Icons.remove_rounded,
          ]) {
            expect(
              find.byIcon(icon),
              findsNothing,
              reason:
                  '$key grew a stepper control; assert its increment and '
                  'decrement carry labels',
            );
          }
          expect(find.byType(Slider), findsNothing);
          expect(find.bySemanticsLabel(RegExp('^Increase')), findsNothing);
          expect(find.bySemanticsLabel(RegExp('^Decrease')), findsNothing);
        }
        handle.dispose();
      });
      testWidgets('the semantics tap action answers, not just the pointer', (
        tester,
      ) async {
        final handle = tester.ensureSemantics();
        final answers = <String, int>{};
        await tester.pumpWidget(
          scanHarness(
            ScanGapListHost(
              metricKeys: const ['mood_score'],
              onAnswer: (k, v) => answers[k] = v,
            ),
          ),
        );
        await tapGapCard(tester, 'mood_score');
        tester.semantics.performAction(
          find.semantics.byLabel(optionSemanticLabel('mood_score', 5)),
          SemanticsAction.tap,
        );
        await tester.pump();
        expect(answers, {'mood_score': 5});
        handle.dispose();
      });
      testWidgets('a saving card announces its options as disabled', (
        tester,
      ) async {
        final handle = tester.ensureSemantics();
        await tester.pumpWidget(
          scanHarness(gapCard('energy_score', expanded: true, saving: true)),
        );
        final label = optionSemanticLabel('energy_score', 3);
        expect(
          tester.getSemantics(find.bySemanticsLabel(label)),
          matchesSemantics(
            label: label,
            isButton: true,
            hasEnabledState: true,
            isEnabled: false,
          ),
        );
        handle.dispose();
      });
      testWidgets('the option label reads back the metric, not just a digit', (
        tester,
      ) async {
        final handle = tester.ensureSemantics();
        await tester.pumpWidget(
          scanHarness(gapCard('gut_comfort_score', expanded: true)),
        );
        final label = optionSemanticLabel('gut_comfort_score', 1);
        expect(label, 'Gut comfort score 1');
        expect(
          label.startsWith(metricDisplayLabel('gut_comfort_score')),
          isTrue,
        );
        expect(find.bySemanticsLabel(label), findsOneWidget);
        handle.dispose();
      });
      testWidgets('the descriptive scales say what the number looks like', (
        tester,
      ) async {
        final handle = tester.ensureSemantics();
        for (final key in ['urine_colour', 'stool_form']) {
          await tester.pumpWidget(scanHarness(gapCard(key, expanded: true)));
          for (final option in kInlineAnswerableOptions[key]!) {
            final label = optionSemanticLabel(key, option);
            expect(
              label,
              contains('·'),
              reason: '$key option $option must carry its descriptive name',
            );
            expect(find.bySemanticsLabel(label), findsOneWidget);
          }
        }
        handle.dispose();
      });
    },
  );
  group('the registry\'s declared affordance gets the control it asks for', () {
    testWidgets('all Armstrong choices keep palette, semantics, and mapping', (
      tester,
    ) async {
      final handle = tester.ensureSemantics();
      final answers = <int>[];
      await tester.pumpWidget(
        scanHarness(
          gapCard('urine_colour', expanded: true, onAnswer: answers.add),
        ),
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
        scanHarness(
          gapCard('stool_form', expanded: true, onAnswer: answers.add),
        ),
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
      expect(
        signatures,
        hasLength(7),
        reason: 'two Bristol types that rasterise identically are not a scale',
      );
      expect(answers, [1, 2, 3, 4, 5, 6, 7]);
      handle.dispose();
    });
    testWidgets('mosquito stepper covers both bounds with labelled 48dp taps', (
      tester,
    ) async {
      final handle = tester.ensureSemantics();
      final answers = <int>[];
      await tester.pumpWidget(
        scanHarness(
          gapCard('mosquito_bites', expanded: true, onAnswer: answers.add),
        ),
      );
      expect(tester.widget<IconButton>(findStepperDecrease).onPressed, isNull);
      expect(find.bySemanticsLabel(stepperReadoutLabel(0)), findsOneWidget);
      expect(find.bySemanticsLabel('Increase mosquito bites'), findsOneWidget);
      expect(tester.getSize(findStepperIncrease), const Size.square(48));
      expect(tester.getSize(findStepperDecrease), const Size.square(48));
      expect(answers, isEmpty);
      await stepStepperTo(tester, 20);
      expect(find.bySemanticsLabel(stepperReadoutLabel(20)), findsOneWidget);
      expect(tester.widget<IconButton>(findStepperIncrease).onPressed, isNull);
      expect(
        answers,
        isEmpty,
        reason: 'stepping never writes implicitly — Save commits',
      );
      handle.dispose();
    });
    testWidgets(
      'mosquito edit preserves value and commits only once per Save',
      (tester) async {
        final handle = tester.ensureSemantics();
        final answers = <int>[];
        Widget card(int value, {bool saving = false}) => scanHarness(
          gapCard(
            'mosquito_bites',
            expanded: true,
            currentValue: value,
            saving: saving,
            onAnswer: answers.add,
          ),
        );
        await tester.pumpWidget(card(12));
        expect(find.bySemanticsLabel(stepperReadoutLabel(12)), findsOneWidget);
        expect(find.text('12 bites'), findsOneWidget);
        expect(answers, isEmpty);
        final saveSize = tester.getSize(findStepperSave);
        expect(saveSize.width, greaterThanOrEqualTo(48));
        expect(saveSize.height, greaterThanOrEqualTo(48));
        await tester.tap(findStepperSave);
        await tester.tap(findStepperSave);
        await tester.pump();
        expect(answers, [12], reason: 'a rapid duplicate Save is ignored');
        await tester.pumpWidget(card(15));
        expect(find.bySemanticsLabel(stepperReadoutLabel(15)), findsOneWidget);
        await tester.tap(findStepperSave);
        await tester.pump();
        expect(answers, [12, 15]);
        handle.dispose();
      },
    );
    testWidgets('mosquito initial values clamp and saving stays inert', (
      tester,
    ) async {
      final handle = tester.ensureSemantics();
      final answers = <int>[];
      Widget card(int value, {bool saving = false}) => scanHarness(
        gapCard(
          'mosquito_bites',
          expanded: true,
          currentValue: value,
          saving: saving,
          onAnswer: answers.add,
        ),
      );
      await tester.pumpWidget(card(-4));
      expect(find.bySemanticsLabel(stepperReadoutLabel(0)), findsOneWidget);
      await tester.pumpWidget(card(12, saving: true));
      expect(find.bySemanticsLabel(stepperReadoutLabel(12)), findsOneWidget);
      expect(tester.widget<IconButton>(findStepperDecrease).onPressed, isNull);
      expect(tester.widget<IconButton>(findStepperIncrease).onPressed, isNull);
      expect(tester.widget<FilledButton>(findStepperSave).onPressed, isNull);
      expect(answers, isEmpty);
      await tester.pumpWidget(card(12));
      await tester.tap(findStepperSave);
      await tester.pump();
      expect(answers, [12], reason: 'saving completion enables one retry');
      await tester.pumpWidget(card(99));
      expect(find.bySemanticsLabel(stepperReadoutLabel(20)), findsOneWidget);
      handle.dispose();
    });
    testWidgets('special controls fit the 390x844 target viewport', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(390, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      for (final key in ['urine_colour', 'stool_form', 'mosquito_bites']) {
        await tester.pumpWidget(scanHarness(gapCard(key, expanded: true)));
        await tester.pump();
        expect(
          tester.takeException(),
          isNull,
          reason: '$key must not overflow',
        );
      }
    });
  });
  group('the harness above is the screen\'s own wiring, not an invention', () {
    late final String source;
    late final String tabState;
    setUpAll(() {
      source = scanTabSource();
      tabState = squashWhitespace(declarationBody(source, '_ScanTabState'));
    });
    test('the tab tracks ONE open gap key, not a set', () {
      expect(
        RegExp(r'String\?\s+_openGapKey;').hasMatch(source),
        isTrue,
        reason: 'a Set<String> here would allow two cards open at once',
      );
      expect(source.contains('Set<String> _openGapKeys'), isFalse);
    });
    test('a card is expanded exactly when it is THE open key', () {
      expect(tabState.contains('expanded: _openGapKey == key,'), isTrue);
    });
    test('toggling a card swaps the open key rather than adding to it', () {
      expect(
        tabState.contains('_openGapKey = _openGapKey == key ? null : key,'),
        isTrue,
        reason: 'this single line is what makes the list one-at-a-time',
      );
    });
    test('the card\'s own tap can reach that toggle (issue #287)', () {
      final body = squashWhitespace(declarationBody(source, 'GapCard'));
      expect(
        body.contains('onTap: saving ? null : onToggle,'),
        isTrue,
        reason:
            'gating onTap on `expanded` too is what made the collapse branch '
            'above dead code',
      );
      expect(body.contains('expanded || saving ? null : onToggle'), isFalse);
    });
    test('a landed write closes the open card', () {
      final answerInline = squashWhitespace(
        source.substring(source.indexOf('Future<void> _answerInline')),
      );
      expect(
        answerInline.contains('setState(() => _openGapKey = null);'),
        isTrue,
        reason:
            'without this the answered card would stay expanded over its '
            'own logged state',
      );
    });
    test('each card gets its stored value and its full option list', () {
      expect(
        tabState.contains('options: kInlineAnswerableOptions[key]!,'),
        isTrue,
      );
      expect(
        tabState.contains('currentValue: (_todayRow?[key] as num?)?.toInt(),'),
        isTrue,
      );
      expect(tabState.contains('weight: kDailyCoreDqsWeights[key]!,'), isTrue);
    });
    test('an inline answer goes through the single-column write', () {
      expect(
        tabState.contains('onAnswer: (value) => _answerInline(key, value),'),
        isTrue,
      );
      final answerInline = source.substring(
        source.indexOf('Future<void> _answerInline'),
      );
      expect(
        answerInline.contains('.saveFieldAnswer('),
        isTrue,
        reason:
            'saveDailyLog would upsert the whole row and null out '
            'everything else logged today',
      );
      expect(answerInline.contains('saveDailyLog('), isFalse);
    });
  });
}
