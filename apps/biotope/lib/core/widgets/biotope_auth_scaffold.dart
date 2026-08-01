import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:google_fonts/google_fonts.dart';

import '../brand_assets.dart';
import '../generated_assets.dart';
import '../theme.dart';

/// Shared, visual-only auth frame.
///
/// It keeps sign-in and account creation as their existing functional routes;
/// the segmented control only navigates between those routes and never invents
/// guest, password-reset, legal-document, or data behaviours.
class BiotopeAuthScaffold extends StatelessWidget {
  final bool signingIn;
  final VoidCallback onSwitchMode;
  final Widget background;
  final Widget child;

  const BiotopeAuthScaffold({
    super.key,
    required this.signingIn,
    required this.onSwitchMode,
    required this.background,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.transparent,
      body: Stack(
        fit: StackFit.expand,
        children: [
          Positioned.fill(
            child: background,
          ),
          Positioned(
            top: -10,
            left: -34,
            child: IgnorePointer(
              child: Opacity(
                opacity: 0.55,
                child: Image.asset(
                  BiotopeGeneratedAssets.decoVineCornerLeft,
                  width: 196,
                  height: 196,
                  fit: BoxFit.contain,
                ),
              ),
            ),
          ),
          Positioned(
            right: -38,
            bottom: -18,
            child: IgnorePointer(
              child: Opacity(
                opacity: 0.42,
                child: Image.asset(
                  BiotopeGeneratedAssets.decoVineCornerRight,
                  width: 206,
                  height: 206,
                  fit: BoxFit.contain,
                ),
              ),
            ),
          ),
          SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(
                horizontal: BiotopeGeometry.screenHorizontalPadding + 2,
              ),
              child: _AuthEntrance(
                child: Column(
                  children: [
                    const SizedBox(height: 30),
                    const _BiotopeBrandLockup(),
                    const SizedBox(height: 24),
                    _AuthModeControl(
                      signingIn: signingIn,
                      onSwitchMode: onSwitchMode,
                    ),
                    const SizedBox(height: 20),
                    child,
                    const SizedBox(height: 26),
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

class _AuthEntrance extends StatefulWidget {
  final Widget child;
  const _AuthEntrance({required this.child});

  @override
  State<_AuthEntrance> createState() => _AuthEntranceState();
}

class _AuthEntranceState extends State<_AuthEntrance>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: BiotopeMotion.screenEnter)
      ..forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (MediaQuery.disableAnimationsOf(context)) return widget.child;
    return AnimatedBuilder(
      animation: _controller,
      child: widget.child,
      builder: (context, child) {
        final value = CurvedAnimation(
          parent: _controller,
          curve: BiotopeMotion.expressiveCurve,
        ).value;
        return Opacity(
          opacity: value,
          child: Transform.translate(
            offset: Offset(0, (1 - value) * BiotopeMotion.screenEnterOffset),
            child: child,
          ),
        );
      },
    );
  }
}

class _BiotopeBrandLockup extends StatefulWidget {
  const _BiotopeBrandLockup();

  @override
  State<_BiotopeBrandLockup> createState() => _BiotopeBrandLockupState();
}

class _BiotopeBrandLockupState extends State<_BiotopeBrandLockup>
    with SingleTickerProviderStateMixin {
  late final AnimationController _breathe;

  @override
  void initState() {
    super.initState();
    _breathe = AnimationController(vsync: this, duration: BiotopeMotion.authBreathe)
      ..repeat(reverse: true);
  }

  @override
  void dispose() {
    _breathe.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final reducedMotion = MediaQuery.disableAnimationsOf(context);
    final mark = Container(
      width: 78,
      height: 78,
      padding: const EdgeInsets.all(11),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Colors.white, Color(0xFFFDFAF3), OurobionColors.primaryContainer],
        ),
        borderRadius: BorderRadius.circular(26),
        border: Border.all(color: OurobionColors.primaryFixedDim.withValues(alpha: 0.55)),
        boxShadow: [
          BoxShadow(
            color: OurobionColors.primary.withValues(alpha: 0.42),
            blurRadius: 28,
            offset: const Offset(0, 12),
            spreadRadius: -12,
          ),
          const BoxShadow(color: Colors.white, blurRadius: 1, offset: Offset(0, 1)),
        ],
      ),
      child: SvgPicture.asset(
        BiotopeBrandAssets.markLight,
        fit: BoxFit.contain,
        semanticsLabel: 'Biotope',
      ),
    );

    return Column(
      children: [
        reducedMotion
            ? mark
            : AnimatedBuilder(
                animation: _breathe,
                child: mark,
                builder: (context, child) => Transform.scale(
                  scale: 1 + _breathe.value * 0.035,
                  child: child,
                ),
              ),
        const SizedBox(height: 15),
        Text(
          'biotope',
          style: GoogleFonts.manrope(
            fontSize: 28,
            height: 1,
            fontWeight: FontWeight.w600,
            letterSpacing: -0.9,
            color: OurobionColors.brandGoldDark,
          ),
        ),
        const SizedBox(height: 9),
        FittedBox(
          fit: BoxFit.scaleDown,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            mainAxisSize: MainAxisSize.min,
            children: [
              const _GoldRule(reverse: true),
              const SizedBox(width: 9),
              Text(
                'Your health, your ecosystem',
                style: GoogleFonts.manrope(
                  fontSize: 11.5,
                  fontWeight: FontWeight.w500,
                  letterSpacing: 0.2,
                  color: OurobionColors.outline,
                ),
              ),
              const SizedBox(width: 9),
              const _GoldRule(),
            ],
          ),
        ),
      ],
    );
  }
}

class _GoldRule extends StatelessWidget {
  final bool reverse;
  const _GoldRule({this.reverse = false});

  @override
  Widget build(BuildContext context) => Container(
        width: 22,
        height: 1,
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: reverse
                ? [Colors.transparent, OurobionColors.primaryFixedDim]
                : [OurobionColors.primaryFixedDim, Colors.transparent],
          ),
        ),
      );
}

class _AuthModeControl extends StatelessWidget {
  final bool signingIn;
  final VoidCallback onSwitchMode;

  const _AuthModeControl({required this.signingIn, required this.onSwitchMode});

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: const Color(0xFFFAF7F0).withValues(alpha: 0.9),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: OurobionColors.primaryFixedDim.withValues(alpha: 0.45)),
      ),
      child: Row(
        children: [
          Expanded(
            child: _ModeButton(
              label: 'Sign in',
              selected: signingIn,
              onTap: signingIn ? null : onSwitchMode,
            ),
          ),
          Expanded(
            child: _ModeButton(
              label: 'Create account',
              selected: !signingIn,
              onTap: signingIn ? onSwitchMode : null,
            ),
          ),
        ],
      ),
    );
  }
}

class _ModeButton extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback? onTap;

  const _ModeButton({required this.label, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: onTap != null,
      selected: selected,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: AnimatedContainer(
          duration: MediaQuery.disableAnimationsOf(context)
              ? Duration.zero
              : BiotopeMotion.navigationSettle,
          curve: BiotopeMotion.expressiveCurve,
          margin: const EdgeInsets.all(4),
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: selected ? OurobionColors.surfaceLowest : Colors.transparent,
            borderRadius: BorderRadius.circular(10),
            boxShadow: selected
                ? const [BoxShadow(color: Color(0x14000000), blurRadius: 3, offset: Offset(0, 1))]
                : null,
          ),
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: GoogleFonts.manrope(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: selected ? OurobionColors.onSurface : OurobionColors.onSurfaceVariant,
            ),
          ),
        ),
      ),
    );
  }
}
