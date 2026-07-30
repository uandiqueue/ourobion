// AboutBiotopeCard is independently pumpable — no services, no Supabase, no
// async — unlike HomeTab, which cannot be pumped in a widget test at all
// (it reaches for Supabase.instance.client with no injection seam). This
// harness reproduces Home's own layout (SingleChildScrollView with the real
// 22px gutter, inside a start-aligned Column) so the width assertion below
// exercises the same constraints the card sees on the real Home screen.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:src/modules/m1_core/ui/widgets/about_biotope_card.dart';

Widget _harness(VoidCallback onTap) {
  return MaterialApp(
    home: Scaffold(
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 22),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            AboutBiotopeCard(onTap: onTap),
          ],
        ),
      ),
    ),
  );
}

void main() {
  for (final size in [const Size(360, 780), const Size(412, 915)]) {
    group('at ${size.width.toInt()}x${size.height.toInt()}', () {
      testWidgets('fills the column width minus the real 22px gutters', (
        tester,
      ) async {
        tester.view.physicalSize = size;
        tester.view.devicePixelRatio = 1.0;
        addTearDown(tester.view.reset);

        await tester.pumpWidget(_harness(() {}));
        await tester.pumpAndSettle();

        final cardWidth = tester.getSize(find.byType(AboutBiotopeCard)).width;
        expect(cardWidth, size.width - 44);
        expect(tester.takeException(), isNull);
      });

      testWidgets('renders the four visible strings', (tester) async {
        tester.view.physicalSize = size;
        tester.view.devicePixelRatio = 1.0;
        addTearDown(tester.view.reset);

        await tester.pumpWidget(_harness(() {}));
        await tester.pumpAndSettle();

        expect(find.text(AboutBiotopeCopy.eyebrow), findsOneWidget);
        expect(find.text(AboutBiotopeCopy.title), findsOneWidget);
        expect(find.text(AboutBiotopeCopy.body), findsOneWidget);
        expect(find.text(AboutBiotopeCopy.action), findsOneWidget);
        expect(tester.takeException(), isNull);
      });

      testWidgets('exposes a findable semantic label', (tester) async {
        tester.view.physicalSize = size;
        tester.view.devicePixelRatio = 1.0;
        addTearDown(tester.view.reset);

        final handle = tester.ensureSemantics();
        await tester.pumpWidget(_harness(() {}));
        await tester.pumpAndSettle();

        expect(
          find.bySemanticsLabel(AboutBiotopeCopy.semanticLabel),
          findsOneWidget,
        );
        expect(tester.takeException(), isNull);
        handle.dispose();
      });

      testWidgets('tapping invokes the callback exactly once', (
        tester,
      ) async {
        tester.view.physicalSize = size;
        tester.view.devicePixelRatio = 1.0;
        addTearDown(tester.view.reset);

        var tapCount = 0;
        await tester.pumpWidget(_harness(() => tapCount++));
        await tester.pumpAndSettle();

        await tester.tap(find.byType(AboutBiotopeCard));
        await tester.pumpAndSettle();

        expect(tapCount, 1);
        expect(tester.takeException(), isNull);
      });
    });
  }
}
