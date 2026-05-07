import 'dart:math';
import 'package:flutter/material.dart';
import '../../../../../core/theme.dart';

// Soft drifting orbs behind auth and onboarding screens.
// Each orb slowly oscillates — calming, never distracting.
class LivingBackdrop extends StatefulWidget {
  const LivingBackdrop({super.key});

  @override
  State<LivingBackdrop> createState() => _LivingBackdropState();
}

class _LivingBackdropState extends State<LivingBackdrop>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 34),
    )..repeat();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _ctrl,
      builder: (_, __) {
        final t = _ctrl.value * 2 * pi;
        return SizedBox.expand(
          child: ColoredBox(
            color: BiotopeColors.surface,
            child: CustomPaint(
              painter: _OrbPainter(t),
            ),
          ),
        );
      },
    );
  }
}

class _OrbPainter extends CustomPainter {
  final double t;
  _OrbPainter(this.t);

  static const _orbs = [
    _Orb(radius: 240, ax: -0.15, ay: -0.20, color: BiotopeColors.primaryFixedDim,  driftX: 40, driftY: 30, speed: 1.0,  phase: 0),
    _Orb(radius: 180, ax:  0.80, ay:  0.40, color: BiotopeColors.secondaryFixedDim, driftX:-30, driftY:-40, speed: 0.82, phase: 2.4),
    _Orb(radius: 150, ax:  0.20, ay:  0.85, color: BiotopeColors.tertiaryFixedDim,  driftX: 50, driftY:-30, speed: 0.92, phase: 4.4),
    _Orb(radius: 110, ax:  0.75, ay:  0.15, color: BiotopeColors.primaryFixed,       driftX:-40, driftY: 40, speed: 1.07, phase: 1.2),
  ];

  @override
  void paint(Canvas canvas, Size size) {
    for (final orb in _orbs) {
      final cx = orb.ax * size.width  + sin(t * orb.speed + orb.phase) * orb.driftX;
      final cy = orb.ay * size.height + cos(t * orb.speed + orb.phase) * orb.driftY;

      final paint = Paint()
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 60)
        ..color = orb.color.withValues(alpha: 0.55);

      canvas.drawCircle(Offset(cx, cy), orb.radius.toDouble(), paint);
    }
  }

  @override
  bool shouldRepaint(_OrbPainter old) => old.t != t;
}

class _Orb {
  final int radius;
  final double ax, ay;
  final Color color;
  final double driftX, driftY, speed, phase;
  const _Orb({
    required this.radius, required this.ax, required this.ay,
    required this.color,  required this.driftX, required this.driftY,
    required this.speed,  required this.phase,
  });
}
