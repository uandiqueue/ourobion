import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../../core/app_preferences.dart';
import '../../../../core/generated_assets.dart';
import '../../../../core/theme.dart';
import '../widgets/living_backdrop.dart';

/// Transient screen shown while `AuthGate` resolves onboarding state after
/// sign-in. Per docs/biotope/ui/ui-design-context.md "Living Backdrop on all
/// full-screen moments" — reuses [LivingBackdrop] rather than a bare spinner.
class WakingScreen extends StatefulWidget {
  const WakingScreen({super.key});

  @override
  State<WakingScreen> createState() => _WakingScreenState();
}

class _WakingScreenState extends State<WakingScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _breathe;

  @override
  void initState() {
    super.initState();
    _breathe = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 4),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _breathe.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          Positioned.fill(
            child: ValueListenableBuilder<bool>(
              valueListenable: AppPreferences.backdropEnabled,
              builder: (context, enabled, child) => enabled
                  ? const LivingBackdrop()
                  : const ColoredBox(color: OurobionColors.background),
            ),
          ),
          SafeArea(
            child: Center(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 42),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    AnimatedBuilder(
                      animation: _breathe,
                      builder: (context, child) {
                        final scale = 1.0 + _breathe.value * 0.06;
                        return Transform.scale(scale: scale, child: child);
                      },
                      child: Image.asset(
                        BiotopeGeneratedAssets.decoSmallBiomechBloom,
                        width: 136,
                        height: 136,
                        errorBuilder: (context, error, stack) => const SizedBox(
                          width: 136,
                          height: 136,
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),
                    Text(
                      'SIGNED IN',
                      style: GoogleFonts.manrope(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 1.6,
                        color: OurobionColors.primary,
                      ),
                    ),
                    const SizedBox(height: 11),
                    Text(
                      'Waking your biotope',
                      textAlign: TextAlign.center,
                      style: GoogleFonts.manrope(
                        fontSize: 24,
                        fontWeight: FontWeight.w600,
                        letterSpacing: -0.5,
                        color: OurobionColors.onSurface,
                      ),
                    ),
                    const SizedBox(height: 9),
                    Text(
                      'Loading your patterns and today’s signals',
                      textAlign: TextAlign.center,
                      style: GoogleFonts.manrope(
                        fontSize: 13,
                        fontWeight: FontWeight.w400,
                        height: 1.6,
                        color: OurobionColors.onSurfaceVariant,
                      ),
                    ),
                    const SizedBox(height: 24),
                    _GrowingLine(controller: _breathe),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _GrowingLine extends StatelessWidget {
  final AnimationController controller;
  const _GrowingLine({required this.controller});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 160,
      height: 2,
      decoration: BoxDecoration(
        color: OurobionColors.primary.withValues(alpha: 0.2),
        borderRadius: BorderRadius.circular(2),
      ),
      child: TweenAnimationBuilder<double>(
        tween: Tween(begin: 0, end: 1),
        duration: const Duration(milliseconds: 1500),
        curve: const Cubic(0.2, 0, 0, 1),
        builder: (context, value, child) {
          return FractionallySizedBox(
            alignment: Alignment.centerLeft,
            widthFactor: value,
            child: Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(2),
                gradient: LinearGradient(
                  colors: [
                    OurobionColors.brandGoldLight,
                    OurobionColors.brandGold,
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
