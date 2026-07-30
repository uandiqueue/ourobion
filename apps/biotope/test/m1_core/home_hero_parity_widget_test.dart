import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:src/core/theme.dart';
import 'package:src/core/widgets/gold_card.dart';
import 'package:src/modules/m1_core/ui/screens/home_tab.dart';

void main() {
  Future<void> pumpHero(
    WidgetTester tester,
    double width, {
    String statusWord = 'Steady',
    int? index = 76,
    int streak = 0,
    int? indexDelta,
  }) async {
    await tester.binding.setSurfaceSize(Size(width, 780));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 22),
            child: SystemStatusHero(
              statusWord: statusWord,
              index: index,
              streak: streak,
              indexDelta: indexDelta,
            ),
          ),
        ),
      ),
    );
  }

  for (final width in [360.0, 412.0]) {
    testWidgets('status hero fills the Home width at ${width.toInt()}dp', (
      tester,
    ) async {
      await pumpHero(tester, width);

      expect(
        tester.getSize(find.byKey(const ValueKey('system-status-hero'))),
        Size(width - 44, 244),
      );
      final artwork = find.byKey(const ValueKey('system-status-hero-artwork'));
      final hero = find.byKey(const ValueKey('system-status-hero'));
      final clip = find.byKey(const ValueKey('system-status-hero-clip'));
      expect(artwork, findsOneWidget);
      expect(clip, findsOneWidget);
      expect(
        tester.widget<ClipRRect>(clip).borderRadius,
        BorderRadius.circular(23),
      );
      expect(tester.widget<GoldCard>(hero).radius, 24);
      expect(find.descendant(of: hero, matching: clip), findsOneWidget);
      expect(
        tester.getSize(clip),
        Size(tester.getSize(hero).width - 2, tester.getSize(hero).height - 2),
      );
      expect(find.descendant(of: clip, matching: artwork), findsOneWidget);
    });
  }

  testWidgets('longest live hero state does not overflow at 360dp', (
    tester,
  ) async {
    await pumpHero(
      tester,
      360,
      statusWord: 'Getting started',
      index: 100,
      streak: 999,
      indexDelta: 99,
    );

    expect(tester.takeException(), isNull);
  });

  Future<void> pumpCoverage(WidgetTester tester, double width) async {
    await tester.binding.setSurfaceSize(Size(width, 780));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 22),
            child: CoverageCard(dqs: null, onTap: () {}),
          ),
        ),
      ),
    );
  }

  for (final width in [360.0, 412.0]) {
    testWidgets(
      'coverage CTA stays clipped and responsive at ${width.toInt()}dp',
      (tester) async {
        await pumpCoverage(tester, width);

        final card = find.byKey(const ValueKey('coverage-card'));
        final clip = find.byKey(const ValueKey('coverage-card-clip'));
        final artwork = find.byKey(const ValueKey('coverage-flower-artwork'));
        expect(tester.getSize(card).width, width - 44);
        expect(clip, findsOneWidget);
        expect(
          tester.widget<ClipRRect>(clip).borderRadius,
          BorderRadius.circular(kCardRadius - 1),
        );
        expect(tester.widget<GoldCard>(card).radius, kCardRadius);
        expect(find.descendant(of: card, matching: clip), findsOneWidget);
        expect(
          tester.getSize(clip),
          Size(tester.getSize(card).width - 2, tester.getSize(card).height - 2),
        );
        expect(find.descendant(of: clip, matching: artwork), findsOneWidget);
        expect(
          (tester.widget<Image>(artwork).image as AssetImage).assetName,
          'assets/images/generated/biomech_botanical/home/home_flower_cluster_card.png',
        );
      },
    );
  }
}
