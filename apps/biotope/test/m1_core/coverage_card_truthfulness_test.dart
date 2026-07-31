import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:src/modules/m1_core/ui/screens/home_tab.dart';

import '../../../../shared/constants/copy_guidelines.dart';

void main() {
  Future<void> pumpCoverage(
    WidgetTester tester,
    double? dqs, {
    VoidCallback? onTap,
  }) {
    return tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: CoverageCard(dqs: dqs, onTap: onTap ?? () {}),
        ),
      ),
    );
  }

  group('CoverageCard completion truthfulness', () {
    for (final dqs in [60.0, 70.0, 80.0, 85.0, 99.0]) {
      testWidgets('$dqs is high coverage, not completed coverage', (
        tester,
      ) async {
        await pumpCoverage(tester, dqs);

        expect(find.text('Coverage recorded today'), findsOneWidget);
        expect(find.text('Coverage in progress'), findsNothing);
        expect(find.text('Every channel captured today'), findsNothing);
        expect(
          find.text(
            '${dqs.toInt()} / 100 pts — run a sweep to capture more today',
          ),
          findsOneWidget,
        );
        expect(find.byIcon(Icons.check_circle_rounded), findsOneWidget);
      });
    }

    testWidgets('100 alone reports every channel captured', (tester) async {
      await pumpCoverage(tester, 100);

      expect(find.text('Every channel captured today'), findsOneWidget);
      expect(find.text('100 pts — every channel captured'), findsOneWidget);
      expect(find.text('Coverage recorded today'), findsNothing);
      expect(find.text('Coverage in progress'), findsNothing);
    });

    for (final dqs in [0.0, 59.0]) {
      testWidgets('$dqs preserves the established in-progress state', (
        tester,
      ) async {
        var taps = 0;
        await pumpCoverage(tester, dqs, onTap: () => taps++);

        expect(find.text('Coverage in progress'), findsOneWidget);
        expect(find.text('Coverage recorded today'), findsNothing);
        expect(find.text('Every channel captured today'), findsNothing);
        expect(
          find.text('${dqs.toInt()} / 100 pts — run a sweep to close the gap'),
          findsOneWidget,
        );
        expect(find.byIcon(Icons.radar_rounded), findsOneWidget);
        expect(find.byIcon(Icons.check_circle_rounded), findsNothing);

        await tester.tap(find.text('Run sweep →'));
        await tester.pump();
        expect(taps, 1);
      });
    }

    testWidgets('null preserves the established not-swept state', (
      tester,
    ) async {
      var taps = 0;
      await pumpCoverage(tester, null, onTap: () => taps++);

      expect(find.text("You haven't swept today"), findsOneWidget);
      expect(find.text('Takes under 30 seconds'), findsOneWidget);
      expect(find.text('Coverage in progress'), findsNothing);
      expect(find.text('Coverage recorded today'), findsNothing);
      expect(find.text('Every channel captured today'), findsNothing);

      await tester.tap(find.text('Run sweep →'));
      await tester.pump();
      expect(taps, 1);
    });
  });

  test('replacement CoverageCard copy passes the non-diagnostic gate', () {
    const replacementCopy = [
      'Coverage recorded today',
      '100 pts — every channel captured',
      '/ 100 pts — run a sweep to capture more today',
    ];
    for (final text in replacementCopy) {
      expect(
        CopyRules.validateCopyString(text),
        isTrue,
        reason: 'diagnostic language detected in: $text',
      );
    }
  });
}
