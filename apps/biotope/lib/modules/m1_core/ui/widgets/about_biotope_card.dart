import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../../core/theme.dart';
import '../../../../core/widgets/gold_card.dart';

/// Copy the About Biotope card owns. Public so the copy gate test can run
/// every string through the shared non-diagnostic validator — same pattern as
/// `SignalsCopy` (home_tab.dart).
abstract final class AboutBiotopeCopy {
  static const eyebrow = 'ABOUT BIOTOPE';
  static const title = 'What is Biotope?';
  static const body =
      'A personal space for noticing patterns across daily check-ins and '
      'the context around them.';
  static const action = 'How Ourobion works';

  /// Read aloud by assistive tech; findable via `find.bySemanticsLabel` in
  /// tests. Just as user-facing as the painted strings above, so it is gated
  /// alongside them too.
  static const semanticLabel = 'Learn how Ourobion works';

  static const all = <String>[eyebrow, title, body, action, semanticLabel];
}

/// Home teaser card that opens the "How Ourobion works" explainer via
/// [onTap]. Built on [GoldCard] with a full-width `Row` child, matching the
/// pattern `_CoverageCard`/`_StreakCard` (home_tab.dart) use to fill the
/// column's width.
///
/// Independently pumpable: nothing here touches the network or reaches for
/// app state — unlike `HomeTab`, which cannot be pumped in a widget test at
/// all.
class AboutBiotopeCard extends StatelessWidget {
  final VoidCallback onTap;

  const AboutBiotopeCard({super.key, required this.onTap});

  @override
  Widget build(BuildContext context) {
    // One semantic node for the whole card, announced as a button.
    // ExcludeSemantics stops the four inner Texts being read out as four
    // separate unlabelled nodes — same pattern as MetricTile / _DeltaPill.
    return Semantics(
      container: true,
      button: true,
      label: AboutBiotopeCopy.semanticLabel,
      onTap: onTap,
      child: ExcludeSemantics(
        child: GoldCard(
          onTap: onTap,
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      AboutBiotopeCopy.eyebrow,
                      style: GoogleFonts.manrope(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 1.6,
                        color: OurobionColors.primary,
                      ),
                    ),
                    const SizedBox(height: 9),
                    Text(
                      AboutBiotopeCopy.title,
                      style: GoogleFonts.manrope(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        color: OurobionColors.onSurface,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      AboutBiotopeCopy.body,
                      style: GoogleFonts.manrope(
                        fontSize: 13,
                        color: OurobionColors.onSurfaceVariant,
                        height: 1.4,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      AboutBiotopeCopy.action,
                      style: GoogleFonts.manrope(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: OurobionColors.primary,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              // The house "this leads onward" affordance on Home: an arrow
              // glyph in the LIGHTER gold, exactly as `_InsightsTeaser`
              // (home_tab.dart) renders it. The darker `primary` gold is
              // reserved for eyebrows and CTA text.
              Text(
                '→',
                style: GoogleFonts.manrope(
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                  color: OurobionColors.brandGoldLight,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
