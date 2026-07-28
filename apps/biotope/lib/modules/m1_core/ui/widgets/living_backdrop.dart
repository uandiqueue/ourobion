import 'dart:math';

import 'package:flutter/material.dart';

import '../../../../../core/theme.dart';

/// Soft, independently drifting orbs for full-screen hero moments.
///
/// It is intentionally visual-only. Whether it is visible is decided by the
/// device-local [AppPreferences.backdropEnabled] listener at each host screen.
class LivingBackdrop extends StatefulWidget {
  const LivingBackdrop({super.key});

  @override
  State<LivingBackdrop> createState() => _LivingBackdropState();
}

class _LivingBackdropState extends State<LivingBackdrop>
    with TickerProviderStateMixin {
  late final List<AnimationController> _controllers;
  bool _reduceMotion = false;

  @override
  void initState() {
    super.initState();
    _controllers = [
      AnimationController(vsync: this, duration: const Duration(seconds: 28)),
      AnimationController(vsync: this, duration: const Duration(seconds: 34)),
      AnimationController(vsync: this, duration: const Duration(seconds: 30)),
      AnimationController(vsync: this, duration: const Duration(seconds: 26)),
    ];
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final reduceMotion = MediaQuery.disableAnimationsOf(context);
    if (_reduceMotion == reduceMotion && _controllers.first.isAnimating == !reduceMotion) {
      return;
    }
    _reduceMotion = reduceMotion;
    for (final controller in _controllers) {
      if (reduceMotion) {
        controller.stop();
      } else {
        controller.repeat();
      }
    }
  }

  @override
  void dispose() {
    for (final controller in _controllers) {
      controller.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: Listenable.merge(_controllers),
      builder: (context, child) => SizedBox.expand(
        child: ColoredBox(
          color: OurobionColors.surfaceCard,
          child: CustomPaint(
            painter: _OrbPainter(
              _controllers
                  .asMap()
                  .entries
                  .map((entry) => _phase(entry.value.value, _Orb.values[entry.key].delay))
                  .toList(growable: false),
            ),
          ),
        ),
      ),
    );
  }

  double _phase(double value, double delay) {
    final phase = value + delay;
    return phase - phase.floorToDouble();
  }
}

class _OrbPainter extends CustomPainter {
  final List<double> progress;

  const _OrbPainter(this.progress);

  @override
  void paint(Canvas canvas, Size size) {
    for (final (index, orb) in _Orb.values.indexed) {
      final amount = Curves.easeInOut.transform((sin(progress[index] * 2 * pi - pi / 2) + 1) / 2);
      final center = orb.center(size);
      final paint = Paint()
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 60)
        ..color = orb.color.withValues(alpha: orb.opacity);

      canvas.save();
      canvas.translate(
        center.dx + orb.drift.dx * amount,
        center.dy + orb.drift.dy * amount,
      );
      canvas.scale(orb.startScale + (orb.endScale - orb.startScale) * amount);
      canvas.drawCircle(Offset.zero, orb.radius, paint);
      canvas.restore();
    }

    // The porcelain veil lets the orbs remain present without competing with
    // text and form controls, matching the reference's radial overlay.
    final veil = Paint()
      ..shader = RadialGradient(
        center: const Alignment(0, -0.1),
        radius: 0.95,
        colors: [
          Colors.white.withValues(alpha: 0.28),
          OurobionColors.surfaceCard.withValues(alpha: 0.86),
        ],
      ).createShader(Offset.zero & size);
    canvas.drawRect(Offset.zero & size, veil);
  }

  @override
  bool shouldRepaint(covariant _OrbPainter oldDelegate) => oldDelegate.progress != progress;
}

enum _Orb {
  primary(
    radius: 240,
    color: OurobionColors.primaryFixedDim,
    opacity: 0.42,
    drift: Offset(40, 30),
    delay: 0,
    startScale: 1,
    endScale: 1.1,
  ),
  secondary(
    radius: 180,
    color: OurobionColors.secondaryFixedDim,
    opacity: 0.34,
    drift: Offset(-30, -40),
    delay: -8 / 34,
    startScale: 1.05,
    endScale: 0.95,
  ),
  tertiary(
    radius: 150,
    color: OurobionColors.tertiaryFixedDim,
    opacity: 0.34,
    drift: Offset(50, -30),
    delay: -14 / 30,
    startScale: 1,
    endScale: 1.08,
  ),
  accent(
    radius: 110,
    color: OurobionColors.primaryFixed,
    opacity: 0.5,
    drift: Offset(-40, 40),
    delay: -4 / 26,
    startScale: 0.95,
    endScale: 1.05,
  );

  final double radius;
  final Color color;
  final double opacity;
  final Offset drift;
  final double delay;
  final double startScale;
  final double endScale;

  const _Orb({
    required this.radius,
    required this.color,
    required this.opacity,
    required this.drift,
    required this.delay,
    required this.startScale,
    required this.endScale,
  });

  Offset center(Size size) => switch (this) {
        _Orb.primary => Offset(-size.width * 0.15 + radius, -size.height * 0.2 + radius),
        _Orb.secondary => Offset(size.width + size.width * 0.2 - radius, size.height * 0.4 + radius),
        _Orb.tertiary => Offset(size.width * 0.2 + radius, size.height + size.height * 0.15 - radius),
        _Orb.accent => Offset(size.width - size.width * 0.25 - radius, size.height * 0.15 + radius),
      };
}
