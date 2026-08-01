import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../theme.dart';

/// Small pill/badge — confidence label, category label, disabled-row label.
/// Extracted from the ad-hoc `Container(padding: ..., decoration: BoxDecoration(...))`
/// repeated across insights_tab.dart; generalized so new screens (Scan, Archive,
/// Profile) don't re-inline the same shape.
class BadgeChip extends StatelessWidget {
  final String label;
  final Color background;
  final Color foreground;
  final bool uppercase;

  const BadgeChip({
    super.key,
    required this.label,
    required this.background,
    required this.foreground,
    this.uppercase = true,
  });

  /// Neutral disabled variant used by rows with no real backing data yet (e.g.
  /// the Scan tab's environmental channel row, which passes 'Not built').
  ///
  /// [label] is REQUIRED on purpose. It used to default to 'Coming soon', which
  /// put a delivery promise nobody has made one omitted argument away from
  /// rendering. The caller has to state what is actually true of its channel.
  const BadgeChip.disabled({super.key, required this.label})
      : background = const Color(0x148d8578), // subtle neutral, not gold/green
        foreground = OurobionColors.onSurfaceVariant,
        uppercase = true;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        uppercase ? label.toUpperCase() : label,
        style: GoogleFonts.manrope(
          fontSize: 9,
          fontWeight: FontWeight.w700,
          letterSpacing: 1.2,
          color: foreground,
        ),
      ),
    );
  }
}
