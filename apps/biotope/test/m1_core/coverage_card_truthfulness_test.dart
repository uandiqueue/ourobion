import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:src/modules/m1_core/ui/screens/home_tab.dart';

import '../../../../shared/constants/copy_guidelines.dart';

void main() {
  Future<void> pumpCoverage(WidgetTester tester, double dqs) {
    return tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: CoverageCard(dqs: dqs, onTap: () {}),
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
        expect(find.text('Every channel captured today'), findsNothing);
        expect(
          find.text(
            '${dqs.toInt()} / 100 pts — add a sweep to capture more today',
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
    });
  });

  test('replacement CoverageCard copy passes the non-diagnostic gate', () {
    const replacementCopy = [
      'Coverage recorded today',
      '100 pts — every channel captured',
      '/ 100 pts — add a sweep to capture more today',
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
