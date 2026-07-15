import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

// ─── Ourobion color tokens (M3) ────────────────────────────────────────────────
// Source of truth: docs/biotope/ui/ui-design-context.md
abstract final class OurobionColors {
  static const primary             = Color(0xFF3c6752);
  static const onPrimary           = Color(0xFFffffff);
  static const primaryContainer    = Color(0xFF7daa92);
  static const onPrimaryContainer  = Color(0xFF123f2c);
  static const primaryFixed        = Color(0xFFbeedd3);
  static const primaryFixedDim     = Color(0xFFa2d1b7);

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

  static const surface             = Color(0xFFf9f9f8);
  static const surfaceLowest       = Color(0xFFffffff);
  static const surfaceLow          = Color(0xFFf3f4f3);
  static const surfaceContainer    = Color(0xFFedeeed);
  static const surfaceHigh         = Color(0xFFe7e8e7);

  static const onSurface           = Color(0xFF191c1c);
  static const onSurfaceVariant    = Color(0xFF414943);
  static const outline             = Color(0xFF717973);
  static const outlineVariant      = Color(0xFFc1c8c2);
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
        shadowColor: const WidgetStatePropertyAll(Color(0x403c6752)),
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
