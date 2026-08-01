import 'package:flutter/material.dart';

import 'daily_scale_visuals.dart';

const Size kBristolPainterDesignSize = Size(52, 32);

bool isDailyScaleMetric(String metricKey) =>
    metricKey == 'urine_colour' || metricKey == 'stool_form';

bool isDailyScaleValue(String metricKey, int value) => switch (metricKey) {
  'urine_colour' => value >= 1 && value <= kArmstrongNames.length,
  'stool_form' => value >= 1 && value <= kBristolNames.length,
  _ => false,
};

String? dailyScaleValueLabel(String metricKey, int value) {
  if (!isDailyScaleValue(metricKey, value)) return null;
  return switch (metricKey) {
    'urine_colour' => '$value - ${kArmstrongNames[value - 1]}',
    'stool_form' => 'Type $value - ${kBristolNames[value - 1]}',
    _ => null,
  };
}

String? dailyScaleSemanticLabel(String metricKey, int value) {
  if (!isDailyScaleValue(metricKey, value)) return null;
  return switch (metricKey) {
    'urine_colour' => 'Urine colour $value, ${kArmstrongNames[value - 1]}',
    'stool_form' => 'Stool form type $value, ${kBristolNames[value - 1]}',
    _ => null,
  };
}

/// Scales the one canonical 52 by 32 Bristol painter into a compact glyph.
///
/// The shape itself remains owned by [BristolShapePainter]; this adapter only
/// maps its design coordinate system into the requested canvas size.
class ScaledBristolShapePainter extends CustomPainter {
  final int type;
  final Color color;

  const ScaledBristolShapePainter({required this.type, required this.color})
    : assert(type >= 1 && type <= 7);

  @override
  void paint(Canvas canvas, Size size) {
    if (size.isEmpty) return;
    final scale = (size.width / kBristolPainterDesignSize.width).clamp(
      0.0,
      size.height / kBristolPainterDesignSize.height,
    );
    final paintedSize = Size(
      kBristolPainterDesignSize.width * scale,
      kBristolPainterDesignSize.height * scale,
    );
    canvas.save();
    canvas.translate(
      (size.width - paintedSize.width) / 2,
      (size.height - paintedSize.height) / 2,
    );
    canvas.scale(scale);
    const designSize = kBristolPainterDesignSize;
    BristolShapePainter(type: type, color: color).paint(canvas, designSize);
    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant ScaledBristolShapePainter oldDelegate) =>
      oldDelegate.type != type || oldDelegate.color != color;
}

/// One accessible swatch or shape for a stored named-scale value.
class DailyScaleGlyph extends StatelessWidget {
  final String metricKey;
  final int value;
  final Size size;
  final Color bristolColor;
  final Color borderColor;

  const DailyScaleGlyph({
    super.key,
    required this.metricKey,
    required this.value,
    required this.size,
    required this.bristolColor,
    required this.borderColor,
  }) : assert(metricKey == 'urine_colour' || metricKey == 'stool_form');

  @override
  Widget build(BuildContext context) {
    final label = dailyScaleSemanticLabel(metricKey, value);
    if (label == null) return const SizedBox.shrink();
    final visual = switch (metricKey) {
      'urine_colour' => Container(
        key: ValueKey('daily-scale-urine_colour-$value'),
        width: size.width,
        height: size.height,
        decoration: BoxDecoration(
          color: kArmstrongColors[value - 1],
          borderRadius: BorderRadius.circular(4),
          border: Border.all(color: borderColor),
        ),
      ),
      'stool_form' => SizedBox(
        key: ValueKey('daily-scale-stool_form-$value'),
        width: size.width,
        height: size.height,
        child: CustomPaint(
          painter: ScaledBristolShapePainter(type: value, color: bristolColor),
        ),
      ),
      _ => const SizedBox.shrink(),
    };
    return Semantics(
      image: true,
      label: label,
      child: ExcludeSemantics(child: visual),
    );
  }
}

/// Compact glyph + number + descriptive name used outside the picker itself.
class DailyScaleValueSummary extends StatelessWidget {
  final String metricKey;
  final int value;
  final TextStyle style;
  final Size glyphSize;
  final Color bristolColor;
  final Color borderColor;
  final double gap;

  const DailyScaleValueSummary({
    super.key,
    required this.metricKey,
    required this.value,
    required this.style,
    required this.glyphSize,
    required this.bristolColor,
    required this.borderColor,
    this.gap = 7,
  }) : assert(metricKey == 'urine_colour' || metricKey == 'stool_form');

  @override
  Widget build(BuildContext context) {
    final spoken = dailyScaleSemanticLabel(metricKey, value);
    final visible = dailyScaleValueLabel(metricKey, value);
    if (spoken == null || visible == null) return const SizedBox.shrink();
    return Semantics(
      container: true,
      label: spoken,
      child: ExcludeSemantics(
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            DailyScaleGlyph(
              metricKey: metricKey,
              value: value,
              size: glyphSize,
              bristolColor: bristolColor,
              borderColor: borderColor,
            ),
            SizedBox(width: gap),
            Text(visible, style: style),
          ],
        ),
      ),
    );
  }
}
