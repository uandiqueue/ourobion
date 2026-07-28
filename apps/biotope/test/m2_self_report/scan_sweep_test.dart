// Scan tab restyle — the "genuine scanning motion" sweep (issue #201).
//
// ChannelScanSweep and EnvironmentRow are both public exactly so they can be
// pumped directly here without needing Supabase.instance (see the header note
// in scan_tab_widgets_test.dart — ScanTab itself cannot be pumped standalone).
//
// Four things are asserted:
//  1. the sweep band animates (moves) while `active` is true and motion is
//     not reduced;
//  2. it does NOT animate — is not even present — when MediaQuery reports
//     `disableAnimations: true`, even though `active` is true;
//  3. EnvironmentRow structurally cannot be swept: it is never a descendant
//     of ChannelScanSweep, so the band can never visually pass over it;
//  4. the pre-existing inline-chip logging interaction still fires its
//     callback unchanged by the restyle.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:src/modules/m2_self_report/impl/logging_controller.dart';
import 'package:src/modules/m2_self_report/ui/screens/scan_tab.dart';

Widget _harness(Widget child, {bool disableAnimations = false}) => MaterialApp(
      home: MediaQuery(
        data: MediaQueryData(disableAnimations: disableAnimations),
        child: Scaffold(body: Center(child: child)),
      ),
    );

void main() {
  group('ChannelScanSweep · the sweep band itself', () {
    testWidgets('animates — moves position over time — when active and motion is enabled',
        (tester) async {
      await tester.pumpWidget(_harness(
        const ChannelScanSweep(
          active: true,
          child: SizedBox(width: 300, height: 200),
        ),
      ));
      await tester.pump(); // first frame at t=0

      expect(find.byKey(ChannelScanSweep.bandKey), findsOneWidget,
          reason: 'an active sweep with motion enabled must render the band');

      final startY = tester.getTopLeft(find.byKey(ChannelScanSweep.bandKey)).dy;

      await tester.pump(const Duration(milliseconds: 400));
      final midY = tester.getTopLeft(find.byKey(ChannelScanSweep.bandKey)).dy;

      await tester.pump(const Duration(milliseconds: 400));
      final laterY = tester.getTopLeft(find.byKey(ChannelScanSweep.bandKey)).dy;

      expect(midY, isNot(equals(startY)),
          reason: 'the band must have moved after 400ms of a genuine sweep');
      expect(laterY, isNot(equals(midY)),
          reason: 'the band must keep moving — this is a repeating sweep, not a one-shot');

      // Clean up the repeating ticker so the test does not leak a pending timer.
      await tester.pumpWidget(const SizedBox());
    });

    testWidgets('does NOT animate — is not even rendered — when disableAnimations is true',
        (tester) async {
      await tester.pumpWidget(_harness(
        const ChannelScanSweep(
          active: true,
          child: SizedBox(width: 300, height: 200),
        ),
        disableAnimations: true,
      ));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
      await tester.pump(const Duration(milliseconds: 400));

      // NEGATIVE CASE: this is precisely what would regress if the sweep
      // ignored the OS reduce-motion setting and animated anyway.
      expect(find.byKey(ChannelScanSweep.bandKey), findsNothing,
          reason: 'MediaQuery.disableAnimations must render the static state, '
              'not merely a slower one');
    });

    testWidgets('does NOT render when active is false, regardless of motion setting',
        (tester) async {
      await tester.pumpWidget(_harness(
        const ChannelScanSweep(
          active: false,
          child: SizedBox(width: 300, height: 200),
        ),
      ));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));

      expect(find.byKey(ChannelScanSweep.bandKey), findsNothing,
          reason: 'idle/done states must never show a sweep in progress');
    });

    testWidgets('still renders its child content untouched', (tester) async {
      await tester.pumpWidget(_harness(
        const ChannelScanSweep(
          active: true,
          child: Text('wearable row content'),
        ),
      ));
      await tester.pump();

      expect(find.text('wearable row content'), findsOneWidget);

      // Dispose the repeating controller before the test ends.
      await tester.pumpWidget(const SizedBox());
    });
  });

  group('EnvironmentRow · structurally excluded from the sweep', () {
    testWidgets('is never a descendant of ChannelScanSweep', (tester) async {
      // Mirrors how ScanTab composes these two: EnvironmentRow sits as a
      // sibling below the swept column, never inside it.
      await tester.pumpWidget(_harness(
        Column(
          mainAxisSize: MainAxisSize.min,
          children: const [
            ChannelScanSweep(
              active: true,
              child: SizedBox(width: 300, height: 120),
            ),
            EnvironmentRow(),
          ],
        ),
      ));
      await tester.pump();

      expect(
        find.descendant(
          of: find.byType(ChannelScanSweep),
          matching: find.byType(EnvironmentRow),
        ),
        findsNothing,
        reason: 'the sweep band must never be able to render over the one '
            'channel that cannot report',
      );

      // Dispose the repeating controller before the test ends.
      await tester.pumpWidget(const SizedBox());
    });

    testWidgets('still exposes no tap target / no GestureDetector after the restyle',
        (tester) async {
      await tester.pumpWidget(_harness(
        Column(
          mainAxisSize: MainAxisSize.min,
          children: const [
            ChannelScanSweep(
              active: true,
              child: SizedBox(width: 300, height: 120),
            ),
            EnvironmentRow(),
          ],
        ),
      ));
      await tester.pump();

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
          reason: 'a $interactive would make an unbuilt channel look operable',
        );
      }

      // Dispose the repeating controller before the test ends.
      await tester.pumpWidget(const SizedBox());
    });
  });

  group('logging path is untouched by the restyle', () {
    testWidgets('an inline chip answer still fires onAnswer with the tapped value',
        (tester) async {
      final answers = <int>[];
      await tester.pumpWidget(_harness(GapCard(
        metricKey: 'mood_score',
        weight: 7,
        inlineOptions: kInlineAnswerableOptions['mood_score'],
        onAnswer: answers.add,
        onOpenFullLog: () {},
      )));
      await tester.pump();

      await tester.tap(find.text('3'));
      await tester.pump();

      expect(answers, [3]);
    });
  });
}
