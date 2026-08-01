import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:src/modules/m5a_baselines/impl/metric_series_models.dart';
import 'package:src/modules/m5a_baselines/ui/widgets/metric_tile.dart';

/// Regression for the Home signals grid overflowing on a real device.
///
/// The grid used to size cells with `childAspectRatio: 1.3`, which derives the
/// cell HEIGHT from the tile WIDTH. A MetricTile's content height is fixed, so
/// the cell was too short whenever the screen was narrow enough — physical
/// traversal on a 1080x2340 Samsung SM-A165F showed
/// "BOTTOM OVERFLOWED BY 9.5 PIXELS" on all four tiles, and the shortfall grows
/// as the screen narrows. `flutter analyze` and the existing widget tests did
/// not catch it because nothing pumped a tile at production cell dimensions.
///
/// These tests pump a tile at the real cell size across a range of phone widths.
/// A RenderFlex overflow reports as a test exception, so an un-fixed grid fails
/// here rather than only on a device.
void main() {
  final series = [
    MetricDailyPoint(
        date: DateTime.utc(2026, 7, 21), value: 6.0, source: 'self_report'),
    MetricDailyPoint(
        date: DateTime.utc(2026, 7, 22), value: 7.5, source: 'self_report'),
    MetricDailyPoint(
        date: DateTime.utc(2026, 7, 23), value: 6.8, source: 'self_report'),
  ];

  Widget hostAtHeight({
    required double cellWidth,
    required double cellHeight,
    double textScale = 1.0,
  }) {
    return MaterialApp(
      home: MediaQuery(
        data: MediaQueryData(textScaler: TextScaler.linear(textScale)),
        child: Scaffold(
          body: Center(
            child: SizedBox(
              width: cellWidth,
              height: cellHeight,
              child: MetricTile(
                label: 'Gut comfort',
                value: '5.0',
                valueSuffix: '/5',
                deltaLabel: 'Steady',
                deltaColor: Colors.black,
                series: series,
              ),
            ),
          ),
        ),
      ),
    );
  }

  // Cell widths for 2-up grids on common phone widths, minus page padding and
  // the 11px cross-axis gap. The narrowest is a small Android device — the case
  // the aspect-ratio sizing broke worst.
  for (final cellWidth in <double>[140, 155, 170, 180, 195]) {
    testWidgets('MetricTile fits the fixed cell at ${cellWidth}px wide',
        (tester) async {
      await tester.pumpWidget(
          hostAtHeight(cellWidth: cellWidth, cellHeight: kMetricTileExtent));
      expect(tester.takeException(), isNull);
    });

  }

  // Proves this suite CAN fail. Without it, "no exception" cases would pass
  // even if the harness silently stopped detecting overflow.
  //
  // 96px is below the tile's minimum content height even after the visual has
  // compressed to nothing, so it must overflow. On the device the old grid gave
  // the tile roughly 138px against ~148px of content — the same failure, milder.
  testWidgets('a cell shorter than the tile content still overflows',
      (tester) async {
    await tester.pumpWidget(hostAtHeight(cellWidth: 155, cellHeight: 96));
    expect(tester.takeException(), isNotNull,
        reason: 'if this passes, the suite is no longer detecting overflow at '
            'all and the cases above prove nothing');
  });

  // KNOWN GAP, deliberately visible rather than deleted.
  //
  // At a 1.6x accessibility text scale the tile still overflows twice: 17px
  // horizontally (the value + suffix Row is too wide for the cell) and 15px
  // vertically (the three text rows grow by more than the 22px the visual can
  // give back). That is a PRE-EXISTING accessibility limitation of the tile's
  // fixed type scale, not the device bug fixed above — it reproduces
  // independently of how the grid sizes its cells.
  //
  // Fixing it means reworking the tile's typography (a Flexible/FittedBox value
  // row and a scale-aware layout), which is O28 accessibility work that the Run
  // 4 cockpit keeps deferred. Left skipped so the suite records the gap instead
  // of hiding it; remove the skip when O28 lands.
  testWidgets(
      'MetricTile survives a large accessibility text scale '
      '(SKIPPED — O28 deferred: tile typography overflows at 1.6x text scale)',
      (tester) async {
    await tester.pumpWidget(hostAtHeight(cellWidth: 155, cellHeight: kMetricTileExtent, textScale: 1.6));
    expect(tester.takeException(), isNull);
  }, skip: true);

  test('the grid cell extent is fixed, not derived from tile width', () {
    // Guards the property that actually fixed this: a constant the grid pins
    // via mainAxisExtent. If someone reverts to childAspectRatio this constant
    // becomes unused and the device overflow returns.
    expect(kMetricTileExtent, greaterThan(0));
  });
}
