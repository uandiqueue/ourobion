import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:ourobion_metrics/ourobion_metrics.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../../core/theme.dart';
import '../../../m2_self_report/index.dart';
import '../../index.dart';

/// User-facing copy for the trend section. Public so the copy gate test can
/// run every string through the shared non-diagnostic validator
/// (shared/constants/copy_guidelines.dart) — same pattern as InsightCardCopy.
abstract final class TrendCopy {
  static const eyebrow = 'TRENDS';
  static const windowLabel = 'Last 30 days';
  static const emptyTitle = 'No trend data yet';
  static const emptyBody =
      'Charts appear here once your daily logs build up metric history.';
  static const noValuesForMetric =
      'No values for this metric in the last 30 days.';
  static const loadError = 'Trend data could not be loaded right now.';
  static const retry = 'Try again';

  static const all = [
    eyebrow,
    windowLabel,
    emptyTitle,
    emptyBody,
    noValuesForMetric,
    loadError,
    retry,
  ];
}

/// Home-tab section: a simple per-metric line chart of the user's
/// `metric_daily_values` over the trailing 30 days (demo main-loop step 2).
/// Functional, not pretty — hand-rolled CustomPaint, no charting package.
class MetricTrendSection extends StatefulWidget {
  /// Injectable for widget tests (the default touches Supabase.instance,
  /// which tests cannot initialize).
  final MetricSeriesService? service;

  /// Injectable for widget tests; the default is the signed-in user.
  final String? userId;

  const MetricTrendSection({super.key, this.service, this.userId});

  @override
  State<MetricTrendSection> createState() => MetricTrendSectionState();
}

class MetricTrendSectionState extends State<MetricTrendSection> {
  /// The demo hero metric — preselected when present in the user's data.
  static const _preferredKey = 'gut_comfort_score';

  late final MetricSeriesService _service;
  late final String _userId;

  List<String> _keys = [];
  String? _selected;
  List<MetricDailyPoint> _points = [];
  bool _loading = true;
  bool _error = false;

  @override
  void initState() {
    super.initState();
    _service = widget.service ?? MetricSeriesService(Supabase.instance.client);
    _userId = widget.userId ?? Supabase.instance.client.auth.currentUser!.id;
    _load();
  }

  /// Re-fetches keys + series. Called by HomeTab on tab re-focus (the
  /// reload-on-focus pattern in app_shell.dart) so the chart follows fresh
  /// data loads without pull-to-refresh plumbing.
  Future<void> reload() => _load();

  Future<void> _load() async {
    try {
      final keys = await _service.getMetricKeys(_userId);
      var selected = _selected;
      if (selected == null || !keys.contains(selected)) {
        selected = keys.contains(_preferredKey)
            ? _preferredKey
            : keys.firstOrNull;
      }
      final points = selected == null
          ? <MetricDailyPoint>[]
          : await _service.getSeries(_userId, selected);
      if (!mounted) return;
      setState(() {
        _keys = keys;
        _selected = selected;
        _points = points;
        _loading = false;
        _error = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = true;
      });
    }
  }

  Future<void> _select(String key) async {
    setState(() {
      _selected = key;
      _loading = true;
    });
    try {
      final points = await _service.getSeries(_userId, key);
      if (!mounted) return;
      setState(() {
        _points = points;
        _loading = false;
        _error = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = true;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: OurobionColors.surfaceLowest,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: OurobionColors.outlineVariant),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0A191c1c),
            blurRadius: 24,
            offset: Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(child: _picker()),
              Text(
                TrendCopy.windowLabel,
                style: GoogleFonts.manrope(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: OurobionColors.outline,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          SizedBox(height: 168, child: _body()),
        ],
      ),
    );
  }

  Widget _picker() {
    if (_keys.isEmpty) return const SizedBox.shrink();
    return DropdownButton<String>(
      value: _selected,
      isDense: true,
      underline: const SizedBox.shrink(),
      icon: const Icon(
        Icons.keyboard_arrow_down_rounded,
        size: 18,
        color: OurobionColors.onSurfaceVariant,
      ),
      style: GoogleFonts.manrope(
        fontSize: 14,
        fontWeight: FontWeight.w600,
        color: OurobionColors.onSurface,
      ),
      items: [
        for (final key in _keys)
          DropdownMenuItem(value: key, child: Text(metricDisplayLabel(key))),
      ],
      onChanged: (key) {
        if (key != null && key != _selected) _select(key);
      },
    );
  }

  Widget _body() {
    if (_loading) {
      return const Center(
        child: SizedBox(
          width: 24,
          height: 24,
          child: CircularProgressIndicator(strokeWidth: 2.5),
        ),
      );
    }
    // Never a bare note-and-stall: a failed load must offer a way back in,
    // not just an inert sentence (the profile_tab.dart fix this mirrors).
    if (_error) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              TrendCopy.loadError,
              textAlign: TextAlign.center,
              style: GoogleFonts.manrope(
                fontSize: 12,
                color: OurobionColors.outline,
                height: 1.5,
              ),
            ),
            const SizedBox(height: 10),
            OutlinedButton(
              onPressed: _load,
              style: OutlinedButton.styleFrom(
                minimumSize: const Size(0, 32),
                padding: const EdgeInsets.symmetric(horizontal: 16),
                visualDensity: VisualDensity.compact,
              ),
              child: Text(TrendCopy.retry),
            ),
          ],
        ),
      );
    }
    if (_keys.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              TrendCopy.emptyTitle,
              style: GoogleFonts.manrope(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: OurobionColors.onSurface,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              TrendCopy.emptyBody,
              textAlign: TextAlign.center,
              style: GoogleFonts.manrope(
                fontSize: 12,
                color: OurobionColors.outline,
                height: 1.5,
              ),
            ),
          ],
        ),
      );
    }
    if (_points.isEmpty) return _note(TrendCopy.noValuesForMetric);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(
          child: CustomPaint(
            painter: TrendChartPainter(metricKey: _selected!, points: _points),
            child: const SizedBox.expand(),
          ),
        ),
        const SizedBox(height: 6),
        Row(
          children: [
            Text(shortDateLabel(_points.first.date), style: _axisStyle),
            const Spacer(),
            if (_points.length > 1)
              Text(shortDateLabel(_points.last.date), style: _axisStyle),
          ],
        ),
      ],
    );
  }

  Widget _note(String text) {
    return Center(
      child: Text(
        text,
        textAlign: TextAlign.center,
        style: GoogleFonts.manrope(
          fontSize: 12,
          color: OurobionColors.outline,
          height: 1.5,
        ),
      ),
    );
  }

  static final _axisStyle = GoogleFonts.manrope(
    fontSize: 10,
    fontWeight: FontWeight.w600,
    color: OurobionColors.outline,
  );
}

// ── Chart painter ──────────────────────────────────────────────────────────────

/// Metric-aware y-axis ticks. The shared registry owns whether values are
/// continuous or step-aligned; adding a metric never requires a chart key list.
List<double> trendAxisTicks(String metricKey, List<double> values) {
  final metric = metricByKey(metricKey);
  final valueStep = metric?.valueStep?.toDouble();
  if (metric == null || valueStep == null) {
    return niceTicks(valueBounds(values));
  }

  final scale = metric.scale;
  if (metric.type == 'ordinal' && scale != null) {
    return _ordinalTicks(scale, valueStep);
  }

  final bounds = scale == null
      ? valueBounds(values)
      : ValueBounds(scale.min.toDouble(), scale.max.toDouble());
  return steppedTicks(
    bounds,
    valueStep: valueStep,
    origin: scale?.min.toDouble() ?? 0,
  );
}

List<double> _ordinalTicks(MetricScale scale, double valueStep) {
  final min = scale.min.toDouble();
  final max = scale.max.toDouble();
  final categoryCount = ((max - min) / valueStep).round() + 1;
  if (categoryCount <= 4) {
    return [for (var i = 0; i < categoryCount; i++) min + i * valueStep];
  }
  final midpoint = min + ((categoryCount - 1) ~/ 2) * valueStep;
  return [min, midpoint, max];
}

ValueBounds trendAxisBounds(
  String metricKey,
  List<double> values,
  List<double> ticks,
) {
  final metric = metricByKey(metricKey);
  final scale = metric == null || metric.valueStep == null
      ? null
      : metric.scale;
  if (scale != null) {
    return ValueBounds(scale.min.toDouble(), scale.max.toDouble());
  }
  final dataBounds = valueBounds(values);
  return ValueBounds(
    math.min(dataBounds.min, ticks.first),
    math.max(dataBounds.max, ticks.last),
  );
}

String trendAxisLabel(String metricKey, double tick) =>
    metricAxisTickLabel(metricKey, tick);

/// Hand-rolled daily-series chart: nice-tick gridlines with value labels, a
/// date-proportional polyline, and a dot per day. All math lives in
/// impl/chart_math.dart (pure, unit-tested); this painter only draws.
class TrendChartPainter extends CustomPainter {
  final String metricKey;
  final List<MetricDailyPoint> points;

  TrendChartPainter({required this.metricKey, required this.points});

  @override
  void paint(Canvas canvas, Size size) {
    if (points.isEmpty) return;

    final values = [for (final p in points) p.value];
    final ticks = trendAxisTicks(metricKey, values);
    final scale = trendAxisBounds(metricKey, values, ticks);

    // Tick labels first — their width fixes the plot area's left edge.
    final labels = _buildTickVisuals(metricKey, ticks);
    final labelWidth = labels.fold<double>(
      0,
      (width, label) => math.max(width, label.width),
    );

    final plotLeft = labelWidth + 8;
    final plotRight = size.width - 4;
    const plotTop = 6.0;
    final plotBottom = size.height - 6;
    if (plotRight <= plotLeft || plotBottom <= plotTop) return;

    double yFor(double v) =>
        plotBottom - normalizeValue(v, scale) * (plotBottom - plotTop);
    double xFor(DateTime d) =>
        plotLeft +
        dayFraction(d, points.first.date, points.last.date) *
            (plotRight - plotLeft);

    // Gridlines + value labels at the nice ticks.
    final grid = Paint()
      ..color = OurobionColors.outlineVariant.withValues(alpha: 0.6)
      ..strokeWidth = 1;
    for (var i = 0; i < ticks.length; i++) {
      final y = yFor(ticks[i]);
      canvas.drawLine(Offset(plotLeft, y), Offset(plotRight, y), grid);
      labels[i].paint(canvas, y);
    }

    // Polyline.
    final line = Paint()
      ..color = OurobionColors.primary
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2
      ..strokeJoin = StrokeJoin.round
      ..strokeCap = StrokeCap.round;
    final path = Path()
      ..moveTo(xFor(points.first.date), yFor(points.first.value));
    for (final p in points.skip(1)) {
      path.lineTo(xFor(p.date), yFor(p.value));
    }
    if (points.length > 1) canvas.drawPath(path, line);

    // One dot per day.
    final dot = Paint()..color = OurobionColors.primary;
    final r = points.length > 40 ? 2.0 : 2.5;
    for (final p in points) {
      canvas.drawCircle(Offset(xFor(p.date), yFor(p.value)), r, dot);
    }
  }

  @override
  SemanticsBuilderCallback get semanticsBuilder => (size) {
    if (points.isEmpty) return const <CustomPainterSemantics>[];
    final values = [for (final point in points) point.value];
    final ticks = trendAxisTicks(metricKey, values);
    final scale = trendAxisBounds(metricKey, values, ticks);
    final labels = _buildTickVisuals(metricKey, ticks);
    final labelWidth = labels.fold<double>(
      0,
      (width, label) => math.max(width, label.width),
    );
    final plotLeft = labelWidth + 8;
    const plotTop = 6.0;
    final plotBottom = size.height - 6;
    if (size.width - 4 <= plotLeft || plotBottom <= plotTop) {
      return const <CustomPainterSemantics>[];
    }
    double yFor(double value) =>
        plotBottom - normalizeValue(value, scale) * (plotBottom - plotTop);
    return [
      for (var index = 0; index < ticks.length; index++)
        CustomPainterSemantics(
          rect: Rect.fromLTWH(
            0,
            math.max(0, yFor(ticks[index]) - 12),
            labelWidth,
            24,
          ),
          properties: SemanticsProperties(
            label: labels[index].semanticLabel,
            textDirection: TextDirection.ltr,
          ),
        ),
    ];
  };

  @override
  bool shouldRebuildSemantics(TrendChartPainter oldDelegate) =>
      shouldRepaint(oldDelegate);
  @override
  bool shouldRepaint(TrendChartPainter oldDelegate) =>
      oldDelegate.metricKey != metricKey ||
      !identical(oldDelegate.points, points);
}

List<_TrendTickVisual> _buildTickVisuals(
  String metricKey,
  List<double> ticks,
) => [
  for (final tick in ticks) _TrendTickVisual(metricKey: metricKey, tick: tick),
];

class _TrendTickVisual {
  final String metricKey;
  final double tick;
  late final TextPainter text = TextPainter(
    text: TextSpan(
      text: trendAxisLabel(metricKey, tick),
      style: GoogleFonts.manrope(
        fontSize: 9,
        fontWeight: FontWeight.w600,
        color: OurobionColors.outline,
      ),
    ),
    textDirection: TextDirection.ltr,
  )..layout();

  _TrendTickVisual({required this.metricKey, required this.tick});

  int? get scaleValue {
    final rounded = tick.round();
    return (tick - rounded).abs() < 1e-9 &&
            isDailyScaleValue(metricKey, rounded)
        ? rounded
        : null;
  }

  String? get inputType => metricByKey(metricKey)?.ui?.inputType;

  double get glyphWidth {
    if (scaleValue == null) return 0;
    return switch (inputType) {
      'armstrong_1_8' => 11,
      'bristol_1_7' => 22,
      _ => 0,
    };
  }

  double get width => text.width + (glyphWidth == 0 ? 0 : glyphWidth + 4);

  String get semanticLabel => scaleValue == null
      ? trendAxisLabel(metricKey, tick)
      : dailyScaleSemanticLabel(metricKey, scaleValue!)!;

  void paint(Canvas canvas, double centerY) {
    final value = scaleValue;
    if (value == null) {
      text.paint(canvas, Offset(0, centerY - text.height / 2));
      return;
    }
    if (inputType == 'armstrong_1_8') {
      final rect = RRect.fromRectAndRadius(
        Rect.fromLTWH(0, centerY - 5.5, 11, 11),
        const Radius.circular(3),
      );
      canvas.drawRRect(rect, Paint()..color = kArmstrongColors[value - 1]);
      canvas.drawRRect(
        rect,
        Paint()
          ..color = OurobionColors.outlineVariant
          ..style = PaintingStyle.stroke
          ..strokeWidth = 0.8,
      );
    } else if (inputType == 'bristol_1_7') {
      canvas.save();
      canvas.translate(0, centerY - 7);
      ScaledBristolShapePainter(
        type: value,
        color: OurobionColors.primary,
      ).paint(canvas, const Size(22, 14));
      canvas.restore();
    }
    text.paint(canvas, Offset(glyphWidth + 4, centerY - text.height / 2));
  }
}
