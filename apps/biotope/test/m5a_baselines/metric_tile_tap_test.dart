// The Home "Signals today" tiles are drawn to look pressable (the design gives
// every tile `cursor:pointer`, a hover lift and a `scale(.985)` active state —
// design line 210) but nothing was ever wired to `MetricTile.onTap`: all four
// were dead. These tests pin the tile down as a REAL button — it fires, it
// announces itself as a button, its press is visible, and the press animation
// respects the OS reduce-motion setting.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:src/modules/m5a_baselines/impl/metric_series_models.dart';
import 'package:src/modules/m5a_baselines/ui/widgets/metric_tile.dart';

final _series = [
  for (var d = 20; d <= 26; d++)
    MetricDailyPoint(
      date: DateTime.utc(2026, 7, d),
      value: 400 + d.toDouble(),
      source: 'self_report',
    ),
];

Widget _host({
  VoidCallback? onTap,
  bool disableAnimations = false,
  String value = '7h 12m',
  String? valueSuffix,
  String deltaLabel = '+18m vs avg',
}) {
  return MaterialApp(
    home: MediaQuery(
      data: MediaQueryData(disableAnimations: disableAnimations),
      child: Scaffold(
        body: Center(
          child: SizedBox(
            width: 170,
            height: kMetricTileExtent,
            child: MetricTile(
              label: 'Sleep',
              value: value,
              valueSuffix: valueSuffix,
              deltaLabel: deltaLabel,
              deltaColor: Colors.black,
              series: _series,
              onTap: onTap,
            ),
          ),
        ),
      ),
    ),
  );
}

/// The tile's own semantics node. `getSemantics(find.byType(MetricTile))` walks
/// UP from the widget and would return an ancestor node (the Scaffold's), so
/// target the ExcludeSemantics the tile wraps its content in: the nearest node
/// above it is exactly the one MetricTile declares.
final Finder _tileSemantics = find.descendant(
  of: find.byType(MetricTile),
  matching: find.byType(ExcludeSemantics),
);

void main() {
  testWidgets('a tile with onTap fires it when pressed', (tester) async {
    var taps = 0;
    await tester.pumpWidget(_host(onTap: () => taps++));

    await tester.tap(find.byType(MetricTile));
    await tester.pumpAndSettle();

    expect(taps, 1, reason: 'the four Home tiles were unwired and inert');
  });

  testWidgets('the whole cell is the hit target, not just the glyphs', (
    tester,
  ) async {
    var taps = 0;
    await tester.pumpWidget(_host(onTap: () => taps++));

    // Bottom-right of the cell: padding, well clear of every Text.
    final rect = tester.getRect(find.byType(MetricTile));
    await tester.tapAt(Offset(rect.right - 4, rect.bottom - 4));
    await tester.pumpAndSettle();

    expect(taps, 1);
  });

  testWidgets('a pressable tile is announced as a button, with its numbers', (
    tester,
  ) async {
    final handle = tester.ensureSemantics();
    await tester.pumpWidget(
      _host(onTap: () {}, value: '62', valueSuffix: 'ms', deltaLabel: '-3 ms vs avg'),
    );

    final node = tester.getSemantics(_tileSemantics);
    expect(node.flagsCollection.isButton, isTrue);
    expect(node.label, contains('Sleep'));
    expect(node.label, contains('62 ms'));
    expect(node.label, contains('-3 ms vs avg'));
    expect(
      node.label,
      contains(MetricTileCopy.openHint),
      reason: 'a screen-reader user must be told the press leads somewhere',
    );

    handle.dispose();
  });

  testWidgets('a tile with no onTap is not a button and carries no press hint', (
    tester,
  ) async {
    final handle = tester.ensureSemantics();
    await tester.pumpWidget(_host());

    final node = tester.getSemantics(_tileSemantics);
    expect(node.flagsCollection.isButton, isFalse);
    expect(node.label, isNot(contains(MetricTileCopy.openHint)));

    handle.dispose();
  });

  testWidgets('pressing scales the tile down, releasing restores it', (
    tester,
  ) async {
    await tester.pumpWidget(_host(onTap: () {}));

    AnimatedScale scale() =>
        tester.widget<AnimatedScale>(find.byType(AnimatedScale));
    expect(scale().scale, 1.0);

    final gesture = await tester.startGesture(
      tester.getCenter(find.byType(MetricTile)),
    );
    await tester.pump();
    // The design's active state (design line 210: `style-active`).
    expect(scale().scale, 0.985);

    await gesture.up();
    await tester.pumpAndSettle();
    expect(scale().scale, 1.0);
  });

  testWidgets('reduce-motion drops the scale animation but keeps the press', (
    tester,
  ) async {
    var taps = 0;
    await tester.pumpWidget(
      _host(onTap: () => taps++, disableAnimations: true),
    );

    expect(
      find.byType(AnimatedScale),
      findsNothing,
      reason: 'MediaQuery.disableAnimations must suppress the press animation',
    );

    await tester.tap(find.byType(MetricTile));
    await tester.pumpAndSettle();
    expect(taps, 1, reason: 'the tile must still be usable with motion off');
  });

  testWidgets('a non-tappable tile is not wrapped in a press gesture', (
    tester,
  ) async {
    await tester.pumpWidget(_host());
    expect(find.byType(AnimatedScale), findsNothing);
    expect(find.byType(GestureDetector), findsNothing);
  });
}
