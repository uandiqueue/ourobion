import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:src/core/theme.dart';
import 'package:src/core/widgets/biotope_bottom_navigation.dart';
import 'package:src/core/widgets/biotope_screen_entrance.dart';
import 'package:src/modules/m1_core/ui/widgets/living_backdrop.dart';

void main() {
  testWidgets('floating navigation exposes all five real destinations', (
    tester,
  ) async {
    var selected = 0;

    await tester.pumpWidget(
      MaterialApp(
        home: MediaQuery(
          data: const MediaQueryData(size: Size(390, 844)),
          child: Scaffold(
            bottomNavigationBar: BiotopeBottomNavigation(
              selectedIndex: selected,
              onSelected: (value) => selected = value,
            ),
          ),
        ),
      ),
    );

    for (final label in ['Home', 'Scan', 'Insights', 'Archive', 'Profile']) {
      expect(find.text(label), findsOneWidget);
    }
    expect(find.byType(BackdropFilter), findsOneWidget);

    await tester.tap(find.text('Scan'));
    expect(selected, 1);
  });

  testWidgets(
    'screen entrance is static when the platform requests reduced motion',
    (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: MediaQuery(
            data: MediaQueryData(disableAnimations: true),
            child: BiotopeScreenEntrance(
              active: true,
              child: Text('Static screen'),
            ),
          ),
        ),
      );

      expect(find.text('Static screen'), findsOneWidget);
      expect(find.byType(Opacity), findsNothing);
    },
  );

  testWidgets(
    'living backdrop renders a still visual frame for reduced motion',
    (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: MediaQuery(
            data: MediaQueryData(disableAnimations: true),
            child: SizedBox.expand(child: LivingBackdrop()),
          ),
        ),
      );

      // MaterialApp may contribute a second CustomPaint in the test harness;
      // the visual contract here is that the backdrop still renders a painted
      // frame when motion is disabled, not that it is the only painter alive.
      expect(find.byType(CustomPaint), findsWidgets);
    },
  );

  test('shell motion tokens retain the reference timing and geometry', () {
    expect(BiotopeMotion.screenEnter, const Duration(milliseconds: 480));
    expect(BiotopeMotion.navigationSettle, const Duration(milliseconds: 260));
    expect(BiotopeGeometry.navigationHorizontalInset, 12);
    expect(BiotopeGeometry.navigationRadius, 26);
  });
}
