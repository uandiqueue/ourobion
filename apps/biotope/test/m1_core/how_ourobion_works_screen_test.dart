// HowOurobionWorksScreen is entirely static copy — no service reads, no
// network, no Supabase — so unlike HomeTab it can be pumped with zero
// mocking. That absence of setup IS the assertion for the first group below.
//
// The screen's body is a ListView, which only builds elements near the
// viewport — content this far down a small phone screen is not simply
// "there but scrolled off", it is not built into the tree at all until
// scrolled into range. `scrollUntilVisible` drives that scroll instead of
// asserting against a fixed page height.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:src/modules/m1_core/ui/screens/how_ourobion_works_screen.dart';

void main() {
  for (final size in [const Size(360, 780), const Size(412, 915)]) {
    group('at ${size.width.toInt()}x${size.height.toInt()}', () {
      testWidgets(
        'constructs with no mocking and renders the title, opening and '
        'section headings',
        (tester) async {
          tester.view.physicalSize = size;
          tester.view.devicePixelRatio = 1.0;
          addTearDown(tester.view.reset);

          await tester.pumpWidget(
            const MaterialApp(home: HowOurobionWorksScreen()),
          );
          await tester.pumpAndSettle();

          final scrollable = find.byType(Scrollable).first;

          expect(find.text(HowOurobionWorksCopy.title), findsOneWidget);
          expect(find.text(HowOurobionWorksCopy.opening), findsOneWidget);

          // The five section headings — one eyebrow per section, START WITH
          // YOUR DAY through WHAT YOU CONTROL — scrolled to in order since
          // they render further down the list than the viewport holds.
          for (final heading in [
            HowOurobionWorksCopy.section1Eyebrow,
            HowOurobionWorksCopy.section2Eyebrow,
            HowOurobionWorksCopy.section3Eyebrow,
            HowOurobionWorksCopy.section4Eyebrow,
            HowOurobionWorksCopy.section5Eyebrow,
          ]) {
            await tester.scrollUntilVisible(
              find.text(heading),
              300,
              scrollable: scrollable,
            );
            expect(find.text(heading), findsOneWidget);
          }

          expect(tester.takeException(), isNull);
        },
      );

      testWidgets(
        'the expandables are collapsed by default and reveal their body '
        'on tap',
        (tester) async {
          tester.view.physicalSize = size;
          tester.view.devicePixelRatio = 1.0;
          addTearDown(tester.view.reset);

          await tester.pumpWidget(
            const MaterialApp(home: HowOurobionWorksScreen()),
          );
          await tester.pumpAndSettle();

          final scrollable = find.byType(Scrollable).first;

          await tester.scrollUntilVisible(
            find.text(HowOurobionWorksCopy.expandableAHeader),
            300,
            scrollable: scrollable,
          );

          // Headers are visible; bodies are not, until tapped.
          expect(
            find.text(HowOurobionWorksCopy.expandableAHeader),
            findsOneWidget,
          );
          expect(
            find.text(HowOurobionWorksCopy.expandableALine1),
            findsNothing,
          );

          await tester.tap(
            find.text(HowOurobionWorksCopy.expandableAHeader),
          );
          await tester.pumpAndSettle();

          expect(
            find.text(HowOurobionWorksCopy.expandableALine1),
            findsOneWidget,
          );
          expect(
            find.text(HowOurobionWorksCopy.expandableALine2),
            findsOneWidget,
          );
          expect(
            find.text(HowOurobionWorksCopy.expandableALine3),
            findsOneWidget,
          );

          await tester.scrollUntilVisible(
            find.text(HowOurobionWorksCopy.expandableBHeader),
            300,
            scrollable: scrollable,
          );

          expect(
            find.text(HowOurobionWorksCopy.expandableBHeader),
            findsOneWidget,
          );
          expect(
            find.text(HowOurobionWorksCopy.expandableBLine1),
            findsNothing,
          );

          await tester.tap(
            find.text(HowOurobionWorksCopy.expandableBHeader),
          );
          await tester.pumpAndSettle();

          expect(
            find.text(HowOurobionWorksCopy.expandableBLine1),
            findsOneWidget,
          );
          expect(
            find.text(HowOurobionWorksCopy.expandableBLine2),
            findsOneWidget,
          );

          expect(tester.takeException(), isNull);
        },
      );

      testWidgets('the back button pops the screen', (tester) async {
        tester.view.physicalSize = size;
        tester.view.devicePixelRatio = 1.0;
        addTearDown(tester.view.reset);

        await tester.pumpWidget(
          MaterialApp(
            home: Builder(
              builder: (context) => Scaffold(
                body: Center(
                  child: ElevatedButton(
                    onPressed: () => Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => const HowOurobionWorksScreen(),
                      ),
                    ),
                    child: const Text('open'),
                  ),
                ),
              ),
            ),
          ),
        );

        await tester.tap(find.text('open'));
        await tester.pumpAndSettle();

        expect(find.byType(HowOurobionWorksScreen), findsOneWidget);

        await tester.tap(find.byIcon(Icons.arrow_back_rounded));
        await tester.pumpAndSettle();

        expect(find.byType(HowOurobionWorksScreen), findsNothing);
        expect(find.text('open'), findsOneWidget);
        expect(tester.takeException(), isNull);
      });
    });
  }
}
