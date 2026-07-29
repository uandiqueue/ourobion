import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

// ─── Ourobion color tokens (M3) ────────────────────────────────────────────────
// Source of truth: docs/biotope/ui/ui-design-context.md
//
// biomech-botanical reskin (2026-07-28): primary/primaryContainer/primaryFixed*
// now carry the gold/porcelain brand ramp. The old forest-green and cyan tokens
// are kept as `deltaPositive`/`deltaNegative` — semantic-only colors for trend
// deltas (never brand chrome). See ui-design-context.md "Semantic-only colors".
abstract final class OurobionColors {
  static const primary             = Color(0xFFA87840); // brand gold
  static const onPrimary           = Color(0xFFffffff);
  static const primaryContainer    = Color(0xFFf4ecdc);
  static const onPrimaryContainer  = Color(0xFF6E4C1E);
  static const primaryFixed        = Color(0xFFe8d3a8);
  static const primaryFixedDim     = Color(0xFFC8A878);

  static const brandGold           = Color(0xFFA87840);
  static const brandGoldLight      = Color(0xFFC8A878);
  static const brandGoldDark       = Color(0xFF6E4C1E);

  static const secondary           = Color(0xFF2f647d);
  static const onSecondary         = Color(0xFFffffff);
  static const secondaryContainer  = Color(0xFFade1fd);
  static const onSecondaryContainer= Color(0xFF30657d);
  static const secondaryFixedDim   = Color(0xFF9acee9);

  static const tertiary            = Color(0xFF00696b);
  static const onTertiary          = Color(0xFFffffff);
  static const tertiaryContainer   = Color(0xFF5aadaf);
  static const onTertiaryContainer = Color(0xFF002021);
  static const tertiaryFixedDim    = Color(0xFF81d4d6);

  // Semantic-only: trend deltas (up/down), never used as brand/chrome color.
  static const deltaPositive       = Color(0xFF3c6752); // old primary green
  static const deltaNegative       = Color(0xFF2f647d); // old secondary blue

  static const background          = Color(0xFFefece5);
  static const surface             = Color(0xFFefece5);
  static const surfaceCard         = Color(0xFFfdfcf9);
  static const surfaceLowest       = Color(0xFFffffff);
  static const surfaceLow          = Color(0xFFf3f4f3);
  static const surfaceContainer    = Color(0xFFedeeed);
  static const surfaceHigh         = Color(0xFFe7e8e7);

  static const onSurface           = Color(0xFF191c1c);
  static const onSurfaceVariant    = Color(0xFF414943);
  static const outline             = Color(0xFF717973);
  static const outlineVariant      = Color(0xFFc1c8c2);
}

/// Card / button corner radii per docs/biotope/ui/ui-design-context.md.
const double kCardRadius = 22;
const double kButtonRadius = 16;

/// Shared geometry for the porcelain-and-gold shell.
///
/// These values intentionally mirror the reference implementation rather than
/// relying on Material defaults, which are designed for a full-width bar.
abstract final class BiotopeGeometry {
  static const screenHorizontalPadding = 24.0;
  static const navigationHorizontalInset = 12.0;
  static const navigationRadius = 26.0;
  static const navigationHeight = 64.0;
}

/// Shared motion timings for the biomech-botanical visual language.
///
/// Keep visual motion here so screens do not slowly diverge from the reference
/// timing. Every caller must still respect [MediaQuery.disableAnimations].
abstract final class BiotopeMotion {
  static const expressiveCurve = Cubic(0.2, 0, 0, 1);
  static const screenEnter = Duration(milliseconds: 480);
  static const screenEnterOffset = 16.0;
  static const navigationSettle = Duration(milliseconds: 260);
  static const authBreathe = Duration(seconds: 6);
  static const wakingBreathe = Duration(seconds: 4);
}

// ─── Theme ────────────────────────────────────────────────────────────────────
ThemeData ourobionTheme() {
  final base = ThemeData(
    useMaterial3: true,
    colorScheme: const ColorScheme(
      brightness: Brightness.light,
      primary:              OurobionColors.primary,
      onPrimary:            OurobionColors.onPrimary,
      primaryContainer:     OurobionColors.primaryContainer,
      onPrimaryContainer:   OurobionColors.onPrimaryContainer,
      secondary:            OurobionColors.secondary,
      onSecondary:          OurobionColors.onSecondary,
      secondaryContainer:   OurobionColors.secondaryContainer,
      onSecondaryContainer: OurobionColors.onSecondaryContainer,
      tertiary:             OurobionColors.tertiary,
      onTertiary:           OurobionColors.onTertiary,
      tertiaryContainer:    OurobionColors.tertiaryContainer,
      onTertiaryContainer:  OurobionColors.onTertiaryContainer,
      surface:              OurobionColors.surface,
      onSurface:            OurobionColors.onSurface,
      onSurfaceVariant:     OurobionColors.onSurfaceVariant,
      outline:              OurobionColors.outline,
      outlineVariant:       OurobionColors.outlineVariant,
      error:                Color(0xFFba1a1a),
      onError:              Color(0xFFffffff),
      errorContainer:       Color(0xFFffdad6),
      onErrorContainer:     Color(0xFF410002),
    ),
  );

  final manrope = GoogleFonts.manropeTextTheme(base.textTheme);

  return base.copyWith(
    textTheme: manrope,
    scaffoldBackgroundColor: OurobionColors.surface,

    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: OurobionColors.surfaceLowest,
      contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: OurobionColors.outlineVariant, width: 1.5),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: OurobionColors.outlineVariant, width: 1.5),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: OurobionColors.primary, width: 1.5),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: Color(0xFFba1a1a), width: 1.5),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: Color(0xFFba1a1a), width: 1.5),
      ),
      hintStyle: GoogleFonts.manrope(
        fontSize: 16, fontWeight: FontWeight.w400, color: OurobionColors.outline,
      ),
      labelStyle: GoogleFonts.manrope(
        fontSize: 16, fontWeight: FontWeight.w500, color: OurobionColors.onSurfaceVariant,
      ),
    ),

    filledButtonTheme: FilledButtonThemeData(
      style: ButtonStyle(
        backgroundColor: WidgetStateProperty.resolveWith((states) =>
          states.contains(WidgetState.disabled)
            ? OurobionColors.surfaceContainer
            : OurobionColors.primary,
        ),
        foregroundColor: WidgetStateProperty.resolveWith((states) =>
          states.contains(WidgetState.disabled)
            ? OurobionColors.outline
            : OurobionColors.onPrimary,
        ),
        minimumSize: const WidgetStatePropertyAll(Size(double.infinity, 56)),
        shape: const WidgetStatePropertyAll(
          RoundedRectangleBorder(borderRadius: BorderRadius.all(Radius.circular(16))),
        ),
        textStyle: WidgetStatePropertyAll(GoogleFonts.manrope(
          fontSize: 14, fontWeight: FontWeight.w600, letterSpacing: 0.3,
        )),
        elevation: WidgetStateProperty.resolveWith((states) =>
          states.contains(WidgetState.disabled) ? 0 : 2,
        ),
        shadowColor: const WidgetStatePropertyAll(Color(0x40A87840)),
      ),
    ),

    textButtonTheme: TextButtonThemeData(
      style: ButtonStyle(
        foregroundColor: const WidgetStatePropertyAll(OurobionColors.primary),
        textStyle: WidgetStatePropertyAll(GoogleFonts.manrope(
          fontSize: 13, fontWeight: FontWeight.w600,
        )),
      ),
    ),
  );
}
