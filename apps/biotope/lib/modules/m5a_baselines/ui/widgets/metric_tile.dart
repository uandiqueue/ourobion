import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../../core/theme.dart';
import '../../impl/chart_math.dart';
import '../../impl/metric_series_models.dart';

enum MetricSparklineStyle { line, bars, progress }

/// Fixed main-axis height of one [MetricTile] cell in the Home signals grid.
///
/// The tile's content height does not depend on its width, so the grid must not
/// derive the cell height from the tile width (a `childAspectRatio`) — doing so
/// overflowed the column by 9.5px on a 1080x2340 device and by more on narrower
/// screens. This is the measured content height plus headroom. Keep it in step
/// with the paddings and `SizedBox` heights in [MetricTile.build].
const double kMetricTileExtent = 158;

/// Compact Home-grid metric card: value, delta, and a small sparkline/bar/
/// progress visual built from a real [MetricDailyPoint] series (reuses
/// chart_math.dart's scaling helpers — the same math `TrendChartPainter`
/// uses in metric_trend_section.dart — rather than re-deriving axis math).
///
/// Per-metric formatting/delta semantics differ enough (sleep = duration,
/// steps = goal progress, gut score = 0-10 mini-bars) that this widget takes
/// already-formatted strings/values from the caller rather than guessing.
class MetricTile extends StatelessWidget {
  final String label;
  final String value;
  final String? valueSuffix;
  final String deltaLabel;
  final Color deltaColor;
  final List<MetricDailyPoint> series;
  final MetricSparklineStyle style;
  final double? progressFraction;
  final VoidCallback? onTap;

  const MetricTile({
    super.key,
    required this.label,
    required this.value,
    this.valueSuffix,
    required this.deltaLabel,
    required this.deltaColor,
    this.series = const [],
    this.style = MetricSparklineStyle.line,
    this.progressFraction,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.fromLTRB(15, 16, 15, 14),
        decoration: BoxDecoration(
          color: OurobionColors.surfaceLowest,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: OurobionColors.primary.withValues(alpha: 0.36)),
          boxShadow: [
            BoxShadow(
              color: OurobionColors.primary.withValues(alpha: 0.14),
              blurRadius: 28,
              offset: const Offset(0, 14),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              label.toUpperCase(),
              style: GoogleFonts.manrope(
                fontSize: 9,
                fontWeight: FontWeight.w700,
                letterSpacing: 1.4,
                color: OurobionColors.brandGoldLight,
              ),
            ),
            const SizedBox(height: 10),
            Row(
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: [
                Text(
                  value,
                  style: GoogleFonts.manrope(
                    fontSize: 21,
                    fontWeight: FontWeight.w600,
                    letterSpacing: -0.5,
                    color: OurobionColors.onSurface,
                  ),
                ),
                if (valueSuffix != null) ...[
                  const SizedBox(width: 2),
                  Text(
                    valueSuffix!,
                    style: GoogleFonts.manrope(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: OurobionColors.onSurfaceVariant,
                    ),
                  ),
                ],
              ],
            ),
            const SizedBox(height: 7),
            Text(
              deltaLabel,
              style: GoogleFonts.manrope(
                fontSize: 10,
                fontWeight: FontWeight.w600,
                color: deltaColor,
              ),
            ),
            const SizedBox(height: 11),
            // Flexible, not a bare SizedBox: at a large accessibility text scale
            // the text rows above grow and would otherwise push this past the
            // cell. Letting the visual compress keeps the numbers readable and
            // the tile inside its bounds instead of throwing a RenderFlex
            // overflow.
            Flexible(
              child: SizedBox(
                height: 22,
                child: _buildVisual(),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildVisual() {
    switch (style) {
      case MetricSparklineStyle.progress:
        return _ProgressBar(fraction: progressFraction ?? 0);
      case MetricSparklineStyle.bars:
        return _MiniBars(series: series);
      case MetricSparklineStyle.line:
        return series.length >= 2
            ? CustomPaint(painter: _SparklinePainter(series: series), size: Size.infinite)
            : const SizedBox.shrink();
    }
  }
}

class _ProgressBar extends StatelessWidget {
  final double fraction;
  const _ProgressBar({required this.fraction});

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.bottomLeft,
      child: Container(
        height: 5,
        width: double.infinity,
        decoration: BoxDecoration(
          color: OurobionColors.primary.withValues(alpha: 0.22),
          borderRadius: BorderRadius.circular(3),
        ),
        child: FractionallySizedBox(
          alignment: Alignment.centerLeft,
          widthFactor: fraction.clamp(0, 1),
          child: Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(3),
              gradient: LinearGradient(
                colors: [OurobionColors.brandGoldLight, OurobionColors.brandGold],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _MiniBars extends StatelessWidget {
  final List<MetricDailyPoint> series;
  const _MiniBars({required this.series});

  @override
  Widget build(BuildContext context) {
    if (series.isEmpty) return const SizedBox.shrink();
    final bounds = valueBounds([for (final p in series) p.value]);
    final recent = series.length > 7 ? series.sublist(series.length - 7) : series;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        for (final p in recent) ...[
          Expanded(
            child: FractionallySizedBox(
              heightFactor: (0.28 + normalizeValue(p.value, bounds) * 0.72).clamp(0.0, 1.0),
              alignment: Alignment.bottomCenter,
              child: Container(
                decoration: BoxDecoration(
                  color: OurobionColors.primary.withValues(alpha: 0.35 + normalizeValue(p.value, bounds) * 0.45),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
          ),
          if (p != recent.last) const SizedBox(width: 4),
        ],
      ],
    );
  }
}

class _SparklinePainter extends CustomPainter {
  final List<MetricDailyPoint> series;
  _SparklinePainter({required this.series});

  @override
  void paint(Canvas canvas, Size size) {
    final bounds = valueBounds([for (final p in series) p.value]);
    final line = Paint()
      ..color = OurobionColors.brandGoldLight
      ..strokeWidth = 1.6
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..style = PaintingStyle.stroke;

    final path = Path();
    for (var i = 0; i < series.length; i++) {
      final x = series.length == 1 ? 0.0 : size.width * i / (series.length - 1);
      final y = size.height - normalizeValue(series[i].value, bounds) * size.height;
      if (i == 0) {
        path.moveTo(x, y);
      } else {
        path.lineTo(x, y);
      }
    }
    canvas.drawPath(path, line);

    final lastX = size.width;
    final lastY = size.height - normalizeValue(series.last.value, bounds) * size.height;
    canvas.drawCircle(
      Offset(lastX, lastY),
      2.6,
      Paint()..color = Colors.white,
    );
    canvas.drawCircle(
      Offset(lastX, lastY),
      2.6,
      Paint()
        ..color = OurobionColors.brandGold
        ..strokeWidth = 1.6
        ..style = PaintingStyle.stroke,
    );
  }

  @override
  bool shouldRepaint(_SparklinePainter oldDelegate) => oldDelegate.series != series;
}
