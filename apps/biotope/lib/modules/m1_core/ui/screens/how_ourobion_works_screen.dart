import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../../core/theme.dart';
import '../../../../core/widgets/gold_card.dart';

/// Copy the explainer screen owns. Public so the copy gate test can run every
/// string through the shared non-diagnostic validator — same pattern as
/// `SignalsCopy` (home_tab.dart) and `ProvenanceCopy`
/// (insight_provenance_screen.dart). Every string is used VERBATIM in the
/// build below: no rewording, no numbers, no claims beyond what is written
/// here.
abstract final class HowOurobionWorksCopy {
  static const title = 'How Ourobion works';
  static const opening =
      'Biotope gives you a place to record daily observations and return '
      'to them over time.';

  static const section1Eyebrow = 'START WITH YOUR DAY';
  static const section1Heading = 'You choose what to record';
  static const section1Body =
      'Use the Scan tab for the check-ins that fit your day.';

  static const section2Eyebrow = 'KEEP THE CONTEXT';
  static const section2Heading = 'Your entries stay connected to your account';
  static const section2Body = 'They are shown back to you as your own history.';

  static const section3Eyebrow = 'LOOK FOR PATTERNS';
  static const section3Heading = 'Observations build gradually';
  static const section3Body =
      'When there is enough information, Biotope can present a pattern for '
      'you to review.';

  static const section4Eyebrow = 'RESEARCH CONTEXT';
  static const section4Heading = 'Evidence is prepared separately';
  static const section4Body =
      "Ourobion's expert workspace reviews research context before it can "
      'support an insight.';

  static const section5Eyebrow = 'WHAT YOU CONTROL';
  static const section5Body =
      'You decide what to enter and which phone permissions to grant.';

  static const expandableAHeader = 'Where your information is kept';
  static const expandableALine1 =
      'Your entries are saved to your Ourobion account and are bound to '
      'your sign-in.';
  static const expandableALine2 =
      'The summaries you see are prepared from your own entries and shown '
      'back to you.';
  static const expandableALine3 =
      "Ourobion's expert workspace is a separate application. It does not "
      'read your entries.';

  static const expandableBHeader = 'What is available now';
  static const expandableBLine1 =
      'Ourobion is still being built. Some parts of the app are in place '
      'today and others are planned.';
  static const expandableBLine2 =
      'Where something is not ready, Biotope leaves it out rather than '
      'filling the space with an estimate.';

  static const closing =
      'Biotope is for personal reflection. It is not a substitute for '
      'professional care.';

  static const all = <String>[
    title,
    opening,
    section1Eyebrow,
    section1Heading,
    section1Body,
    section2Eyebrow,
    section2Heading,
    section2Body,
    section3Eyebrow,
    section3Heading,
    section3Body,
    section4Eyebrow,
    section4Heading,
    section4Body,
    section5Eyebrow,
    section5Body,
    expandableAHeader,
    expandableALine1,
    expandableALine2,
    expandableALine3,
    expandableBHeader,
    expandableBLine1,
    expandableBLine2,
    closing,
  ];
}

/// The "How Ourobion works" explainer, pushed from [AboutBiotopeCard] on
/// Home. Entirely static copy — nothing here reaches for the network or app
/// state — so it can be constructed in a widget test with no mocking at
/// all, unlike `HomeTab`.
///
/// Stateful only to hold the two expansion booleans for the progressive
/// disclosure sections at the bottom of the page; nothing else here changes
/// over the widget's lifetime.
class HowOurobionWorksScreen extends StatefulWidget {
  const HowOurobionWorksScreen({super.key});

  @override
  State<HowOurobionWorksScreen> createState() =>
      _HowOurobionWorksScreenState();
}

class _HowOurobionWorksScreenState extends State<HowOurobionWorksScreen> {
  bool _whereExpanded = false;
  bool _availableExpanded = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: OurobionColors.surface,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 12, 24, 8),
              child: Row(
                children: [
                  IconButton(
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const Icon(
                      Icons.arrow_back_rounded,
                      color: OurobionColors.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      HowOurobionWorksCopy.title,
                      style: GoogleFonts.manrope(
                        fontSize: 20,
                        fontWeight: FontWeight.w600,
                        letterSpacing: -0.2,
                        color: OurobionColors.onSurface,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(24, 8, 24, 32),
                children: [
                  Text(
                    HowOurobionWorksCopy.opening,
                    style: GoogleFonts.manrope(
                      fontSize: 14,
                      color: OurobionColors.onSurfaceVariant,
                      height: 1.5,
                    ),
                  ),
                  const SizedBox(height: 24),
                  _section(
                    eyebrow: HowOurobionWorksCopy.section1Eyebrow,
                    heading: HowOurobionWorksCopy.section1Heading,
                    body: HowOurobionWorksCopy.section1Body,
                  ),
                  const SizedBox(height: 20),
                  _section(
                    eyebrow: HowOurobionWorksCopy.section2Eyebrow,
                    heading: HowOurobionWorksCopy.section2Heading,
                    body: HowOurobionWorksCopy.section2Body,
                  ),
                  const SizedBox(height: 20),
                  _section(
                    eyebrow: HowOurobionWorksCopy.section3Eyebrow,
                    heading: HowOurobionWorksCopy.section3Heading,
                    body: HowOurobionWorksCopy.section3Body,
                  ),
                  const SizedBox(height: 20),
                  _section(
                    eyebrow: HowOurobionWorksCopy.section4Eyebrow,
                    heading: HowOurobionWorksCopy.section4Heading,
                    body: HowOurobionWorksCopy.section4Body,
                  ),
                  const SizedBox(height: 20),
                  _section(
                    eyebrow: HowOurobionWorksCopy.section5Eyebrow,
                    body: HowOurobionWorksCopy.section5Body,
                  ),
                  const SizedBox(height: 24),
                  _expandable(
                    header: HowOurobionWorksCopy.expandableAHeader,
                    lines: const [
                      HowOurobionWorksCopy.expandableALine1,
                      HowOurobionWorksCopy.expandableALine2,
                      HowOurobionWorksCopy.expandableALine3,
                    ],
                    expanded: _whereExpanded,
                    onToggle: () =>
                        setState(() => _whereExpanded = !_whereExpanded),
                  ),
                  const SizedBox(height: 12),
                  _expandable(
                    header: HowOurobionWorksCopy.expandableBHeader,
                    lines: const [
                      HowOurobionWorksCopy.expandableBLine1,
                      HowOurobionWorksCopy.expandableBLine2,
                    ],
                    expanded: _availableExpanded,
                    onToggle: () => setState(
                      () => _availableExpanded = !_availableExpanded,
                    ),
                  ),
                  const SizedBox(height: 24),
                  Text(
                    HowOurobionWorksCopy.closing,
                    style: GoogleFonts.manrope(
                      fontSize: 12,
                      fontStyle: FontStyle.italic,
                      color: OurobionColors.onSurfaceVariant,
                      height: 1.4,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// One eyebrow/heading/body block. [heading] is optional — the last
  /// section ("WHAT YOU CONTROL") is a single body line under its eyebrow
  /// with no separate heading.
  Widget _section({required String eyebrow, String? heading, required String body}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          eyebrow,
          style: GoogleFonts.manrope(
            fontSize: 10,
            fontWeight: FontWeight.w700,
            letterSpacing: 1.6,
            color: OurobionColors.primary,
          ),
        ),
        const SizedBox(height: 8),
        if (heading != null) ...[
          Text(
            heading,
            style: GoogleFonts.manrope(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: OurobionColors.onSurface,
            ),
          ),
          const SizedBox(height: 6),
        ],
        Text(
          body,
          style: GoogleFonts.manrope(
            fontSize: 14,
            color: OurobionColors.onSurfaceVariant,
            height: 1.45,
          ),
        ),
      ],
    );
  }

  /// One dot-bullet row: a small gold dot, then the statement. Matches the
  /// design system's evidence-block grammar rather than inventing a new list
  /// style. The dot is decorative, so it is hidden from assistive tech.
  Widget _bullet(String line) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 5,
          height: 5,
          margin: const EdgeInsets.only(top: 7),
          decoration: const BoxDecoration(
            color: OurobionColors.brandGoldLight,
            shape: BoxShape.circle,
          ),
        ),
        const SizedBox(width: 9),
        Expanded(
          child: Text(
            line,
            style: GoogleFonts.manrope(
              fontSize: 13,
              color: OurobionColors.onSurfaceVariant,
              height: 1.45,
            ),
          ),
        ),
      ],
    );
  }

  /// A tap-to-toggle disclosure section, collapsed by default. Built on
  /// [GoldCard] rather than `ExpansionTile` so there is no default Material
  /// divider to clash with the dark tokens, and so the whole card — not just
  /// the header text — is the tap target.
  Widget _expandable({
    required String header,
    required List<String> lines,
    required bool expanded,
    required VoidCallback onToggle,
  }) {
    return GoldCard(
      onTap: onToggle,
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Semantics(
            container: true,
            button: true,
            expanded: expanded,
            label: header,
            child: ExcludeSemantics(
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      header,
                      style: GoogleFonts.manrope(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: OurobionColors.onSurface,
                      ),
                    ),
                  ),
                  Icon(
                    expanded
                        ? Icons.expand_less_rounded
                        : Icons.expand_more_rounded,
                    color: OurobionColors.primary,
                    size: 22,
                  ),
                ],
              ),
            ),
          ),
          if (expanded) ...[
            const SizedBox(height: 12),
            // Hairline divider above the revealed block, then the dot-bullet
            // rows. Both come from the design system's only "list of
            // statements" grammar (the expanded insight card's evidence
            // block): a 5px gold dot, 9px from its text, 9px between rows.
            Container(
              height: 1,
              color: OurobionColors.brandGoldLight.withValues(alpha: 0.45),
            ),
            const SizedBox(height: 12),
            for (final line in lines) ...[
              _bullet(line),
              if (line != lines.last) const SizedBox(height: 9),
            ],
          ],
        ],
      ),
    );
  }
}
