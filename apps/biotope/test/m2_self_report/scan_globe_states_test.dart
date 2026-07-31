// Reference-driven state coverage for the Scan dial (#268 acceptance item 1).
//
// The design reference ("Biotope Biomech Botanical.dc.html" §SCAN) gives the
// globe four states, and this file pins the geometry and the presence rules of
// each one:
//
//   idle         262 logical px · no sweep band · no result overlay
//   scanning     262 logical px · sweep band    · no result overlay
//   completed    190 logical px · no sweep band · result overlay
//   expanded-gap the completed dial, unchanged, with one gap card open
//
// and the transition between them: 420 ms on Cubic(.2, 0, 0, 1).
//
// `ScanTab` itself reads `Supabase.instance.client` in `initState`, so it
// cannot be pumped here; [ScanGlobe] is public precisely so the dial can be
// driven directly. See scan_test_support.dart.

import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:src/modules/m2_self_report/ui/screens/scan_tab.dart';

import 'scan_test_support.dart';

final _globe = find.byKey(ScanGlobe.globeKey);
final _band = find.byKey(ScanGlobe.sweepBandKey);
final _overlay = find.byKey(ScanGlobe.completionOverlayKey);

/// The `Opacity` the completion reveal drives.
double _overlayOpacity(WidgetTester tester) => tester
    .widgetList<Opacity>(find.ancestor(of: _overlay, matching: find.byType(Opacity)))
    .first
    .opacity;

void main() {
  group('the dial · geometry', () {
    testWidgets('is 262 logical px while idle', (tester) async {
      await tester.pumpWidget(globeHarness(stoppedGlobe()));
      expect(tester.getSize(_globe), const Size.square(ScanGlobe.idleSize));
    });

    testWidgets('is still 262 logical px while scanning', (tester) async {
      await tester.pumpWidget(globeHarness(stoppedGlobe(scanning: true)));
      expect(
        tester.getSize(_globe),
        const Size.square(ScanGlobe.idleSize),
        reason: 'the reference does not resize the dial until the result lands',
      );
    });

    testWidgets('is 190 logical px once the sweep is done', (tester) async {
      await tester.pumpWidget(globeHarness(stoppedGlobe(completed: true)));
      expect(tester.getSize(_globe), const Size.square(ScanGlobe.completedSize));
    });

    test('the reference sizes and timings are the ones the reference declares', () {
      expect(ScanGlobe.idleSize, 262.0);
      expect(ScanGlobe.completedSize, 190.0);
      expect(ScanGlobe.shrinkDuration, const Duration(milliseconds: 420));
      expect(ScanGlobe.sweepDuration, const Duration(milliseconds: 1500));
      expect(ScanGlobe.resultDuration, const Duration(milliseconds: 380));
    });

    testWidgets('the resize is 420ms on Cubic(.2, 0, 0, 1)', (tester) async {
      await tester.pumpWidget(globeHarness(stoppedGlobe()));
      final animated = tester.widget<AnimatedContainer>(_globe);
      expect(animated.duration, const Duration(milliseconds: 420));
      expect(animated.curve, const Cubic(0.2, 0, 0, 1));
    });

    testWidgets('actually animates 262 → 190 rather than jumping', (tester) async {
      final completed = ValueNotifier(false);
      addTearDown(completed.dispose);

      await tester.pumpWidget(
        globeHarness(
          ValueListenableBuilder<bool>(
            valueListenable: completed,
            builder: (_, done, _) => stoppedGlobe(completed: done),
          ),
        ),
      );
      expect(tester.getSize(_globe).width, ScanGlobe.idleSize);

      completed.value = true;
      await tester.pump();
      expect(
        tester.getSize(_globe).width,
        ScanGlobe.idleSize,
        reason: 'the shrink is animated, so frame 0 is still the idle size',
      );

      await tester.pump(const Duration(milliseconds: 210));
      final mid = tester.getSize(_globe).width;
      expect(mid, lessThan(ScanGlobe.idleSize));
      expect(mid, greaterThan(ScanGlobe.completedSize));

      await tester.pump(const Duration(milliseconds: 260));
      expect(
        tester.getSize(_globe).width,
        ScanGlobe.completedSize,
        reason: 'the whole travel must be over inside ScanGlobe.shrinkDuration',
      );
    });
  });

  group('the completed overlay · present only when there is a result', () {
    testWidgets('is absent while idle', (tester) async {
      await tester.pumpWidget(globeHarness(stoppedGlobe()));
      await tester.pump(const Duration(milliseconds: 600));
      expect(_overlay, findsNothing, reason: 'no sweep has produced a result yet');
    });

    testWidgets('is absent while scanning', (tester) async {
      await tester.pumpWidget(globeHarness(stoppedGlobe(scanning: true)));
      await tester.pump(const Duration(milliseconds: 600));
      expect(
        _overlay,
        findsNothing,
        reason: 'a coverage figure shown mid-sweep would be last run\'s number',
      );
    });

    testWidgets('is present when done, and fills the whole dial', (tester) async {
      await tester.pumpWidget(globeHarness(stoppedGlobe(completed: true)));

      expect(_overlay, findsOneWidget);

      // inset:0 — the wash backs the whole reading, not just the text bounding
      // box. It sits inside the dial's 1px rim, so it is the dial's interior:
      // the same box every other layer of the globe is laid out in.
      final interior = tester
          .getSize(find.descendant(of: _globe, matching: find.byType(Stack)).first);
      expect(tester.getSize(_overlay), interior);
      expect(
        tester.getSize(_globe).width - interior.width,
        lessThanOrEqualTo(2.0),
        reason: 'nothing but the rim may sit between the wash and the edge',
      );
    });

    testWidgets('reads back the stored coverage and the open-channel count', (
      tester,
    ) async {
      await tester.pumpWidget(
        globeHarness(stoppedGlobe(completed: true, coverage: 68, missingCount: 2)),
      );
      expect(find.text('COVERAGE'), findsOneWidget);
      expect(find.text('68%'), findsOneWidget);
      expect(find.text('2 channels open'), findsOneWidget);
    });

    testWidgets('singularises one open channel and names a clean sweep', (
      tester,
    ) async {
      await tester.pumpWidget(
        globeHarness(stoppedGlobe(completed: true, coverage: 94, missingCount: 1)),
      );
      expect(find.text('1 channel open'), findsOneWidget);

      await tester.pumpWidget(
        globeHarness(stoppedGlobe(completed: true, coverage: 100, missingCount: 0)),
      );
      expect(find.text('All channels in'), findsOneWidget);
    });

    testWidgets('the reading surface is opaque, so the bloom cannot bleed '
        'through the number', (tester) async {
      await tester.pumpWidget(globeHarness(stoppedGlobe(completed: true)));
      final decoration =
          tester.widget<DecoratedBox>(_overlay).decoration as BoxDecoration;
      final gradient = decoration.gradient! as RadialGradient;
      expect(gradient.colors.first.a, 1);
      expect(gradient.colors.last.a, greaterThanOrEqualTo(0.94));
    });

    testWidgets('the reveal is driven by the completion animation…', (tester) async {
      await tester.pumpWidget(
        globeHarness(stoppedGlobe(completed: true, reveal: 0.0)),
      );
      expect(_overlayOpacity(tester), 0.0);

      await tester.pumpWidget(
        globeHarness(stoppedGlobe(completed: true, reveal: 0.5)),
      );
      expect(_overlayOpacity(tester), closeTo(0.5, 0.001));

      await tester.pumpWidget(
        globeHarness(stoppedGlobe(completed: true, reveal: 1.0)),
      );
      expect(_overlayOpacity(tester), 1.0);
    });

    testWidgets('…and reduce-motion short-circuits it to a legible first frame', (
      tester,
    ) async {
      await tester.pumpWidget(
        globeHarness(
          stoppedGlobe(completed: true, reveal: 0.0),
          reduceMotion: true,
        ),
      );
      expect(
        _overlayOpacity(tester),
        1.0,
        reason: 'suppressing the fade must not hide the result behind it',
      );
      expect(find.text('68%'), findsOneWidget);
    });
  });

  group('the four reference states render the right combination', () {
    testWidgets('idle · full dial, nothing sweeping, no result', (tester) async {
      await tester.pumpWidget(globeHarness(stoppedGlobe()));
      expect(tester.getSize(_globe), const Size.square(ScanGlobe.idleSize));
      expect(_band, findsNothing);
      expect(_overlay, findsNothing);
    });

    testWidgets('scanning · full dial, band present, no result yet', (tester) async {
      await tester.pumpWidget(globeHarness(stoppedGlobe(scanning: true)));
      expect(tester.getSize(_globe), const Size.square(ScanGlobe.idleSize));
      expect(_band, findsOneWidget);
      expect(_overlay, findsNothing);
    });

    testWidgets('completed · shrunk dial, band gone, result shown', (tester) async {
      await tester.pumpWidget(globeHarness(stoppedGlobe(completed: true)));
      expect(tester.getSize(_globe), const Size.square(ScanGlobe.completedSize));
      expect(
        _band,
        findsNothing,
        reason: 'a finished sweep must not keep sweeping behind its own result',
      );
      expect(_overlay, findsOneWidget);
    });

    testWidgets('expanded-gap · the completed dial is unchanged while a gap '
        'card is open', (tester) async {
      await tester.pumpWidget(
        scanHarness(
          Column(
            children: [
              stoppedGlobe(completed: true, coverage: 68, missingCount: 2),
              const SizedBox(height: 22),
              const ScanGapListHost(
                metricKeys: ['mood_score', 'energy_score'],
                initiallyOpen: 'mood_score',
              ),
            ],
          ),
        ),
      );

      // The dial does not move or re-open when a card expands beneath it.
      expect(tester.getSize(_globe), const Size.square(ScanGlobe.completedSize));
      expect(_overlay, findsOneWidget);
      expect(_band, findsNothing);
      expect(find.text('68%'), findsOneWidget);

      // …and exactly one card is open.
      expect(findExpandedArea('mood_score'), findsOneWidget);
      expect(findExpandedArea('energy_score'), findsNothing);
    });
  });

  group('the tab drives the dial with the dial\'s own constants', () {
    // The screen and the widget are in the same file, so a drift here is only
    // ever a copy-paste slip — but resultDuration is currently declared on
    // ScanGlobe and re-typed as a literal in _ScanTabState, which is exactly
    // the shape that drifts silently.
    final source = File(
      'lib/modules/m2_self_report/ui/screens/scan_tab.dart',
    ).readAsStringSync();

    test('the sweep controller runs for ScanGlobe.sweepDuration', () {
      expect(
        source.contains('duration: ScanGlobe.sweepDuration'),
        isTrue,
        reason: 'the sweep controller must not re-type the 1.5s literal',
      );
    });

    test('the completion controller runs for ScanGlobe.resultDuration\'s length', () {
      final match = RegExp(
        r'_completionAnim\s*=\s*AnimationController\([^)]*duration:\s*const Duration\(milliseconds:\s*(\d+)\)',
        dotAll: true,
      ).firstMatch(source);
      expect(match, isNotNull, reason: 'could not find the completion controller');
      expect(
        int.parse(match!.group(1)!),
        ScanGlobe.resultDuration.inMilliseconds,
        reason:
            'the reveal controller and ScanGlobe.resultDuration must agree; '
            'the reference reveals the result over 380ms',
      );
    });
  });
}
