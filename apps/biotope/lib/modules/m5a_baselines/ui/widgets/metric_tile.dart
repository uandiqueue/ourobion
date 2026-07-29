import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../../core/theme.dart';
import '../../impl/chart_math.dart';
import '../../impl/metric_series_models.dart';

/// Secondary visual under a tile's value.
///
/// The design's Movement tile shows an 82%-filled progress bar (design line
/// 240), and this enum used to carry a `progress` case for it. That case had no
/// caller and has been removed: a progress bar needs a GOAL as its denominator,
/// and there is no step-goal column in `shared/metrics/`, in any migration, or
/// anywhere in the app. The dead branch defaulted a missing fraction to `?? 0`,
/// so the only thing it could ever have rendered was a 0%-filled bar — a
/// fabricated "you achieved none of a target you never set". Movement therefore
/// keeps the real sparkline of its own history.
enum MetricSparklineStyle { line, bars }

/// Fixed main-axis height of one [MetricTile] cell in the Home signals grid.
///
/// The tile's content height does not depend on its width, so the grid must not
/// derive the cell height from the tile width (a `childAspectRatio`) — doing so
/// overflowed the column by 9.5px on a 1080x2340 device and by more on narrower
/// screens. This is the measured content height plus headroom. Keep it in step
/// with the paddings and `SizedBox` heights in [_MetricTileState.build].
const double kMetricTileExtent = 158;

/// Copy [MetricTile] owns. A screen-reader label is user-facing copy, so it goes
/// through the shared non-diagnostic validator like every rendered string — see
/// test/m5a_baselines/signals_detail_copy_gate_test.dart.
abstract final class MetricTileCopy {
  /// Announced after the tile's numbers when the tile is pressable, so a
  /// screen-reader user knows the press leads somewhere.
  static const openHint = 'Opens this signal history';

  static const all = <String>[openHint];
}

/// Compact Home-grid metric card: value, delta, and a small sparkline/bar visual
/// built from a real [MetricDailyPoint] series (reuses chart_math.dart's scaling
/// helpers — the same math `TrendChartPainter` uses in
/// metric_trend_section.dart — rather than re-deriving axis math).
///
/// Per-metric formatting/delta semantics differ enough (sleep = duration, steps
/// = a grouped count, gut comfort = a 1-5 ordinal) that this widget takes
/// already-formatted strings from the caller rather than guessing; the shared
/// formatters live in impl/metric_value_format.dart.
///
/// With [onTap] set the tile is a REAL button: `Semantics(button: true)` with a
/// label spoken from its own numbers, and the design's `scale(.985)` press state
/// (design line 210) — gated on `MediaQuery.disableAnimations`, with an
/// instantaneous border brightening so there is still press feedback when motion
/// is off.
class MetricTile extends StatefulWidget {
  final String label;
  final String value;
  final String? valueSuffix;
  final String deltaLabel;
  final Color deltaColor;
  final List<MetricDailyPoint> series;
  final MetricSparklineStyle style;
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
    this.onTap,
  });

  @override
  State<MetricTile> createState() => _MetricTileState();
}

class _MetricTileState extends State<MetricTile> {
  bool _pressed = false;

  void _setPressed(bool value) {
    if (_pressed == value) return;
    setState(() => _pressed = value);
  }

  /// Spoken as one node: the tile's own numbers, then the press hint. Built from
  /// the rendered strings so the announcement can never drift from the display.
  String get _semanticLabel {
    final parts = <String>[
      widget.label,
      widget.valueSuffix != null
          ? '${widget.value} ${widget.valueSuffix}'
          : widget.value,
      widget.deltaLabel,
      if (widget.onTap != null) MetricTileCopy.openHint,
    ];
    return parts.where((p) => p.isNotEmpty).join('. ');
  }

  @override
  Widget build(BuildContext context) {
    final tappable = widget.onTap != null;
    final showPressed = tappable && _pressed;

    final card = Container(
      padding: const EdgeInsets.fromLTRB(15, 16, 15, 14),
      decoration: BoxDecoration(
        color: OurobionColors.surfaceLowest,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          // The design's hover/active border is the brighter gold (line 210's
          // `style-hover` / `style-active`). Instantaneous, so this is the press
          // feedback that survives reduce-motion.
          color: OurobionColors.primary.withValues(
            alpha: showPressed ? 0.75 : 0.36,
          ),
        ),
        boxShadow: [
          BoxShadow(
            color: OurobionColors.primary.withValues(
              alpha: showPressed ? 0.2 : 0.14,
            ),
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
            widget.label.toUpperCase(),
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
                widget.value,
                style: GoogleFonts.manrope(
                  fontSize: 21,
                  fontWeight: FontWeight.w600,
                  letterSpacing: -0.5,
                  color: OurobionColors.onSurface,
                ),
              ),
              if (widget.valueSuffix != null) ...[
                const SizedBox(width: 2),
                Text(
                  widget.valueSuffix!,
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
            widget.deltaLabel,
            style: GoogleFonts.manrope(
              fontSize: 10,
              fontWeight: FontWeight.w600,
              color: widget.deltaColor,
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
    );

    // One semantic node for the whole tile, announced as a button when it leads
    // somewhere. ExcludeSemantics stops the four inner Texts being read out as
    // four separate unlabelled nodes.
    final semantic = Semantics(
      container: true,
      button: tappable,
      label: _semanticLabel,
      onTap: widget.onTap,
      child: ExcludeSemantics(child: card),
    );

    if (!tappable) return semantic;

    final reduced = MediaQuery.maybeDisableAnimationsOf(context) ?? false;
    return GestureDetector(
      // Opaque so the whole cell (kMetricTileExtent tall, half the grid wide) is
      // the hit target, not just the painted glyphs.
      behavior: HitTestBehavior.opaque,
      onTap: widget.onTap,
      onTapDown: (_) => _setPressed(true),
      onTapUp: (_) => _setPressed(false),
      onTapCancel: () => _setPressed(false),
      child: reduced
          ? semantic
          : AnimatedScale(
              scale: _pressed ? 0.985 : 1.0,
              duration: const Duration(milliseconds: 120),
              curve: Curves.easeOut,
              child: semantic,
            ),
    );
  }

  Widget _buildVisual() {
    switch (widget.style) {
      case MetricSparklineStyle.bars:
        return _MiniBars(series: widget.series);
      case MetricSparklineStyle.line:
        return widget.series.length >= 2
            ? CustomPaint(
                painter: _SparklinePainter(series: widget.series),
                size: Size.infinite,
              )
            : const SizedBox.shrink();
    }
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
