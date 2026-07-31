import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:src/modules/m2_self_report/ui/screens/scan_tab.dart';

Widget _harness(Widget child, {bool reduceMotion = false}) => MaterialApp(
  home: MediaQuery(
    data: MediaQueryData(disableAnimations: reduceMotion),
    child: Scaffold(body: Center(child: child)),
  ),
);

ScanGlobe _globe({
  bool scanning = false,
  bool completed = false,
  double sweep = 0,
  double reveal = 1,
}) => ScanGlobe(
  scanning: scanning,
  completed: completed,
  coverage: 82,
  missingCount: 2,
  sweepAnimation: AlwaysStoppedAnimation(sweep),
  completionAnimation: AlwaysStoppedAnimation(reveal),
);

void main() {
  group('reference Scan globe states', () {
    testWidgets('idle is 262dp with no sweep or result surface', (
      tester,
    ) async {
      await tester.pumpWidget(_harness(_globe()));

      expect(
        tester.getSize(find.byKey(ScanGlobe.globeKey)),
        const Size.square(ScanGlobe.idleSize),
      );
      expect(find.byKey(ScanGlobe.sweepBandKey), findsNothing);
      expect(find.byKey(ScanGlobe.completionOverlayKey), findsNothing);
    });

    testWidgets('scan sweep moves inside the clipped 262dp globe', (
      tester,
    ) async {
      await tester.pumpWidget(_harness(_globe(scanning: true, sweep: 0)));
      final globe = find.byKey(ScanGlobe.globeKey);
      final band = find.byKey(ScanGlobe.sweepBandKey);
      final startY = tester.getTopLeft(band).dy;

      expect(tester.getSize(globe), const Size.square(ScanGlobe.idleSize));
      expect(
        tester.widget<AnimatedContainer>(globe).clipBehavior,
        isNot(Clip.none),
      );

      await tester.pumpWidget(_harness(_globe(scanning: true, sweep: 0.65)));
      final laterY = tester.getTopLeft(band).dy;
      expect(laterY, isNot(startY));
      expect(
        find.descendant(of: globe, matching: band),
        findsOneWidget,
        reason:
            'the moving band is clipped by the globe, never the channel list',
      );
    });

    testWidgets(
      'completed state shrinks to 190dp and uses an opaque result surface',
      (tester) async {
        await tester.pumpWidget(_harness(_globe(completed: true)));

        expect(
          tester.getSize(find.byKey(ScanGlobe.globeKey)),
          const Size.square(ScanGlobe.completedSize),
        );
        expect(find.text('82%'), findsOneWidget);
        expect(find.text('2 channels open'), findsOneWidget);

        final overlay = tester.widget<DecoratedBox>(
          find.byKey(ScanGlobe.completionOverlayKey),
        );
        final gradient =
            (overlay.decoration as BoxDecoration).gradient! as RadialGradient;
        expect(gradient.colors.first.a, 1);
        expect(gradient.colors.last.a, greaterThanOrEqualTo(0.94));
        expect(ScanGlobe.shrinkDuration, const Duration(milliseconds: 420));
        expect(ScanGlobe.resultDuration, const Duration(milliseconds: 380));
        expect(ScanGlobe.sweepDuration, const Duration(milliseconds: 1500));
      },
    );

    testWidgets('reduce motion suppresses the sweep band', (tester) async {
      await tester.pumpWidget(
        _harness(_globe(scanning: true, sweep: 0.5), reduceMotion: true),
      );
      expect(find.byKey(ScanGlobe.sweepBandKey), findsNothing);
    });
  });

  test('the removed Flutter-only channel sweep does not return', () {
    final source = File(
      'lib/modules/m2_self_report/ui/screens/scan_tab.dart',
    ).readAsStringSync();
    expect(source.contains('class ChannelScanSweep'), isFalse);
    expect(source.contains('channel-scan-sweep-band'), isFalse);
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
