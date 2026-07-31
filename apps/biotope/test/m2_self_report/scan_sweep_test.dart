import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:src/modules/m2_self_report/ui/screens/scan_tab.dart';
import 'package:src/modules/m3_passive_health/index.dart';
import 'scan_test_support.dart';
final _globe = find.byKey(ScanGlobe.globeKey);
final _band = find.byKey(ScanGlobe.sweepBandKey);
final _clip = find.descendant(of: _globe, matching: find.byType(ClipPath));
class _SweepingGlobe extends StatefulWidget {
  const _SweepingGlobe();
  @override
  State<_SweepingGlobe> createState() => _SweepingGlobeState();
}
class _SweepingGlobeState extends State<_SweepingGlobe>
    with TickerProviderStateMixin {
  late final AnimationController _sweep = AnimationController(
    vsync: this,
    duration: ScanGlobe.sweepDuration,
  )..repeat();
  late final AnimationController _reveal = AnimationController(
    vsync: this,
    duration: ScanGlobe.resultDuration,
  );
  @override
  void dispose() {
    _sweep.dispose();
    _reveal.dispose();
    super.dispose();
  }
  @override
  Widget build(BuildContext context) => ScanGlobe(
    scanning: true,
    completed: false,
    coverage: 68,
    missingCount: 2,
    sweepAnimation: _sweep,
    completionAnimation: _reveal,
  );
}
void main() {
  group('the band renders only while a sweep is actually running', () {
    testWidgets('present while scanning with motion enabled', (tester) async {
      await tester.pumpWidget(globeHarness(const _SweepingGlobe()));
      await tester.pump(const Duration(milliseconds: 100));
      expect(_band, findsOneWidget);
      await tester.pumpWidget(const SizedBox());
    });
    testWidgets('absent while idle', (tester) async {
      await tester.pumpWidget(globeHarness(stoppedGlobe()));
      await tester.pump(const Duration(milliseconds: 400));
      expect(
        _band,
        findsNothing,
        reason: 'an idle tab must never show a sweep in progress',
      );
    });
    testWidgets('absent once the sweep is done', (tester) async {
      await tester.pumpWidget(globeHarness(stoppedGlobe(completed: true)));
      await tester.pump(const Duration(milliseconds: 400));
      expect(
        _band,
        findsNothing,
        reason: 'a finished sweep must not keep sweeping behind the result',
      );
    });
    testWidgets('absent under reduce-motion, not merely slower', (
      tester,
    ) async {
      await tester.pumpWidget(
        globeHarness(
          stoppedGlobe(scanning: true, sweep: 0.5),
          reduceMotion: true,
        ),
      );
      await tester.pump(const Duration(milliseconds: 400));
      await tester.pump(const Duration(milliseconds: 400));
      expect(
        _band,
        findsNothing,
        reason:
            'a perpetual repeat() is exactly what MediaQuery.disableAnimations '
            'exists to suppress',
      );
    });
    testWidgets('the band never takes a pointer away from the dial', (
      tester,
    ) async {
      await tester.pumpWidget(globeHarness(stoppedGlobe(scanning: true)));
      expect(
        find.ancestor(of: _band, matching: find.byType(IgnorePointer)),
        findsAtLeastNWidgets(1),
      );
    });
  });
  group('the band moves, and it repeats for the whole scan', () {
    testWidgets('it travels through the dial', (tester) async {
      await tester.pumpWidget(globeHarness(const _SweepingGlobe()));
      await tester.pump(const Duration(milliseconds: 100));
      final startY = tester.getTopLeft(_band).dy;
      await tester.pump(const Duration(milliseconds: 400));
      final midY = tester.getTopLeft(_band).dy;
      await tester.pump(const Duration(milliseconds: 400));
      final laterY = tester.getTopLeft(_band).dy;
      expect(midY, isNot(equals(startY)));
      expect(laterY, isNot(equals(midY)));
      await tester.pumpWidget(const SizedBox());
    });
    testWidgets('one full sweepDuration later it is back at the same offset', (
      tester,
    ) async {
      await tester.pumpWidget(globeHarness(const _SweepingGlobe()));
      await tester.pump(const Duration(milliseconds: 100));
      final firstCycle = tester.getTopLeft(_band).dy;
      await tester.pump(ScanGlobe.sweepDuration);
      final secondCycle = tester.getTopLeft(_band).dy;
      expect(
        secondCycle,
        closeTo(firstCycle, 1.0),
        reason: 'the sweep must loop while the scan runs, not run once',
      );
      await tester.pump(ScanGlobe.sweepDuration);
      expect(tester.getTopLeft(_band).dy, closeTo(firstCycle, 1.0));
      await tester.pumpWidget(const SizedBox());
    });
    testWidgets('the sweep is eased, not linear', (tester) async {
      await tester.pumpWidget(
        globeHarness(stoppedGlobe(scanning: true, sweep: 0)),
      );
      final atStart = tester.getTopLeft(_band).dy;
      await tester.pumpWidget(
        globeHarness(stoppedGlobe(scanning: true, sweep: 0.25)),
      );
      final atQuarter = tester.getTopLeft(_band).dy;
      await tester.pumpWidget(
        globeHarness(stoppedGlobe(scanning: true, sweep: 0.5)),
      );
      final atHalf = tester.getTopLeft(_band).dy;
      expect(
        atQuarter - atStart,
        lessThan(atHalf - atQuarter),
        reason: 'an ease-in-out accelerates through the middle of its travel',
      );
    });
  });
  group('the band cannot paint outside the circle', () {
    testWidgets('it is a descendant of the dial\'s clip', (tester) async {
      await tester.pumpWidget(globeHarness(stoppedGlobe(scanning: true)));
      expect(_clip, findsOneWidget);
      expect(
        tester.widget<ClipPath>(_clip).clipBehavior,
        isNot(Clip.none),
        reason: 'a clip with Clip.none would not clip anything',
      );
      expect(
        find.descendant(of: _clip, matching: _band),
        findsOneWidget,
        reason:
            'the reference relies on the dial\'s overflow:hidden to shape the '
            'band; a band outside the clip would paint over the page',
      );
    });
    testWidgets('the clip is exactly the size of the dial', (tester) async {
      await tester.pumpWidget(globeHarness(stoppedGlobe(scanning: true)));
      expect(tester.getSize(_globe), const Size.square(ScanGlobe.idleSize));
      expect(
        tester.getSize(_clip),
        tester.getSize(_globe),
        reason:
            'a clip smaller or larger than the dial would shape the sweep '
            'into something other than the circle',
      );
      expect(
        (tester.widget<AnimatedContainer>(_globe).decoration! as BoxDecoration)
            .shape,
        BoxShape.circle,
        reason:
            'the clip path is derived from the decoration, so the '
            'decoration is what makes the band circular',
      );
    });
    testWidgets('the clip is load-bearing: the band\'s own box overhangs the '
        'dial during the sweep', (tester) async {
      await tester.pumpWidget(globeHarness(const _SweepingGlobe()));
      await tester.pump(const Duration(milliseconds: 1));
      final dial = tester.getRect(_globe);
      var everEscaped = false;
      for (var frame = 0; frame < 16; frame++) {
        final band = tester.getRect(_band);
        if (band.top < dial.top - 0.5 || band.bottom > dial.bottom + 0.5) {
          everEscaped = true;
        }
        expect(band.left, greaterThanOrEqualTo(dial.left - 0.5));
        expect(band.right, lessThanOrEqualTo(dial.right + 0.5));
        await tester.pump(const Duration(milliseconds: 100));
      }
      expect(
        everEscaped,
        isTrue,
        reason:
            'if the band never left the dial box, the clip assertions above '
            'would prove nothing — the sweep must genuinely overhang',
      );
      await tester.pumpWidget(const SizedBox());
    });
  });
  group('nothing sweeps over the channel / source rows', () {
    testWidgets('the rows the tab shows while idle carry no animated band', (
      tester,
    ) async {
      const rowsKey = ValueKey('channel-rows');
      await tester.pumpWidget(
        scanHarness(
          const Column(
            key: rowsKey,
            children: [
              WearableSyncRow(reading: null, hasSyncedThisSession: false),
              SizedBox(height: 9),
              EnvironmentRow(),
            ],
          ),
        ),
      );
      await tester.pump(const Duration(milliseconds: 400));
      await tester.pump(const Duration(milliseconds: 400));
      final rows = find.byKey(rowsKey);
      expect(find.byKey(ScanGlobe.sweepBandKey), findsNothing);
      for (final animated in <Type>[
        AnimatedBuilder,
        SlideTransition,
        FadeTransition,
        TweenAnimationBuilder<double>,
        AnimatedContainer,
        AnimatedOpacity,
      ]) {
        expect(
          find.descendant(of: rows, matching: find.byType(animated)),
          findsNothing,
          reason:
              'a $animated over a source row would animate a channel that is '
              'not being polled',
        );
      }
    });
    test('the sweep band belongs to ScanGlobe and to nothing else', () {
      final source = scanTabSource();
      expect(
        'sweepBandKey'.allMatches(source).length,
        2,
        reason: 'the key is declared once and used once, both inside ScanGlobe',
      );
      final globe = declarationBody(source, 'ScanGlobe');
      expect(globe.contains('static const sweepBandKey'), isTrue);
      expect(globe.contains('key: sweepBandKey'), isTrue);
    });
    test('no row widget animates anything', () {
      final source = scanTabSource();
      for (final name in ['_SelfReportRow', 'EnvironmentRow']) {
        final body = declarationBody(source, name);
        for (final token in [
          'Animation',
          'AnimatedBuilder',
          'AnimatedContainer',
          'Transform',
          'sweep',
        ]) {
          expect(
            body.contains(token),
            isFalse,
            reason:
                '$name mentions "$token" — the reference sweeps the dial '
                'only, never the rows beneath it',
          );
        }
      }
    });
    test('the removed Flutter-only channel sweep does not return', () {
      final source = scanTabSource();
      expect(source.contains('class ChannelScanSweep'), isFalse);
      expect(source.contains('channel-scan-sweep-band'), isFalse);
    });
    test('the tab starts the sweep with repeat(), and only with motion on', () {
      final source = scanTabSource();
      expect(
        source.contains('if (!reduced) _sweepAnim.repeat();'),
        isTrue,
        reason: 'the loop must be gated on MediaQuery.disableAnimations',
      );
      expect(
        source.contains('_sweepAnim.forward'),
        isFalse,
        reason: 'a one-shot sweep would stop while the reads are still running',
      );
    });
  });
  test('reduce-motion removes only the artificial scan floor', () {
    expect(
      ScanGlobe.sweepFloorFor(reducedMotion: false),
      ScanGlobe.sweepFloorDuration,
    );
    expect(ScanGlobe.sweepFloorDuration, const Duration(milliseconds: 2400));
    expect(ScanGlobe.sweepFloorFor(reducedMotion: true), Duration.zero);
  });
}
