import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../../core/generated_assets.dart';
import '../../../../core/theme.dart';
import '../../index.dart';

/// Shared category/confidence presentation for an [InsightCard] — icon, color,
/// label, and the honest confidence bucket (never a bare percentage; the real
/// `confidenceScore` is bucketed into High/Medium/Low/Building-data, matching
/// how the pre-reskin insights_tab.dart already framed it). Extracted so the
/// swipeable deck (insight_deck.dart) and Archive tab render identically
/// rather than duplicating this switch-statement logic.
abstract final class InsightCardVisual {
  static IconData icon(InsightCategory cat) => switch (cat) {
        InsightCategory.hydration => Icons.water_drop_outlined,
        InsightCategory.gut => Icons.spa_outlined,
        InsightCategory.behaviour => Icons.directions_walk_outlined,
        InsightCategory.vector => Icons.pest_control_outlined,
        InsightCategory.descriptive => Icons.lightbulb_outline_rounded,
        InsightCategory.relationship => Icons.hub_outlined,
      };

  static Color iconColor(InsightCategory cat) => switch (cat) {
        InsightCategory.hydration => OurobionColors.secondary,
        InsightCategory.gut => OurobionColors.primary,
        InsightCategory.behaviour => OurobionColors.tertiary,
        InsightCategory.vector => OurobionColors.onSurfaceVariant,
        InsightCategory.descriptive => OurobionColors.onSurfaceVariant,
        InsightCategory.relationship => OurobionColors.tertiary,
      };

  static Color iconBg(InsightCategory cat) => switch (cat) {
        InsightCategory.hydration => OurobionColors.secondaryContainer,
        InsightCategory.gut => OurobionColors.primaryFixed,
        InsightCategory.behaviour => OurobionColors.surfaceContainer,
        InsightCategory.vector => OurobionColors.surfaceContainer,
        InsightCategory.descriptive => OurobionColors.surfaceContainer,
        InsightCategory.relationship => OurobionColors.tertiaryFixedDim,
      };

  /// The deck's photography is deliberately selected from the card category,
  /// never from a server field. That lets the real card model stay unchanged
  /// while replacing the old generic icon panel with the accepted generated
  /// botanical artwork from the HTML reference.
  static String artwork(InsightCategory cat) => switch (cat) {
        InsightCategory.hydration =>
          BiotopeGeneratedAssets.insightsBranchingNodeSystem,
        InsightCategory.gut => BiotopeGeneratedAssets.insightsBiomechHeartBloom,
        InsightCategory.behaviour =>
          BiotopeGeneratedAssets.insightsNeuralBotanicalCluster,
        InsightCategory.vector =>
          BiotopeGeneratedAssets.insightsBranchingNodeSystem,
        InsightCategory.descriptive =>
          BiotopeGeneratedAssets.insightsNeuralBotanicalCluster,
        InsightCategory.relationship =>
          BiotopeGeneratedAssets.insightsBiomechHeartBloom,
      };

  static String categoryLabel(InsightCategory cat) => switch (cat) {
        InsightCategory.hydration => 'HYDRATION',
        InsightCategory.gut => 'GUT',
        InsightCategory.behaviour => 'BEHAVIOUR',
        InsightCategory.vector => 'VECTOR',
        InsightCategory.descriptive => 'INSIGHT',
        InsightCategory.relationship => InsightCardCopy.relationshipCategoryLabel,
      };

  /// Bucketed, not a bare number — the honest framing this app already uses.
  static String confidenceLabel(double score) {
    if (score >= 1.0) return 'High confidence';
    if (score >= 0.66) return 'Medium confidence';
    if (score >= 0.33) return 'Low confidence';
    return 'Building data';
  }
}

/// User-facing copy for the relationship-card affordances. Public so the copy
/// gate test can run every string through the shared non-diagnostic validator
/// (shared/constants/copy_guidelines.dart). Moved here (was insights_tab.dart)
/// since both the deck and Archive now render these affordances.
abstract final class InsightCardCopy {
  static const relationshipCategoryLabel = 'RELATIONSHIP';
  static const viewResearchBasis = 'View research basis';
  static const hideResearchBasis = 'Hide research basis';
  static const researchBasisIntro = 'This pattern is linked to verified research:';
  static const verifiedPrefix = 'verified ';
  static const stillResearchingLabel = 'Still researching';
  static const stillResearchingBody =
      'This pattern comes from your own data. No published research link yet.';
  static const howGenerated = 'How this was generated';
  static const savedLabel = 'Saved into your archive';
  static const dismissedLabel = 'Card dismissed';
  static const allCaughtUpTitle = 'All caught up';
  static const allCaughtUpBody =
      'New cards grow as the knowledge base ingests studies. Check back soon.';
  /// The empty-deck action. Named for what it now does: re-read `insight_cards`
  /// and show whatever is genuinely still `active`. It was 'Replay deck' while
  /// the action rewound a local index and re-served already-archived/dismissed
  /// cards as if they were fresh — a label that described a replay because the
  /// implementation was one.
  static const replayDeck = 'Check for new cards';

  static const all = [
    relationshipCategoryLabel,
    viewResearchBasis,
    hideResearchBasis,
    researchBasisIntro,
    verifiedPrefix,
    stillResearchingLabel,
    stillResearchingBody,
    howGenerated,
    savedLabel,
    dismissedLabel,
    allCaughtUpTitle,
    allCaughtUpBody,
    replayDeck,
  ];
}

// ── Research-basis affordance (research-linked relationship cards) ─────────────

/// Citation affordance for a research-linked card: a tap target that expands to
/// list the verified edges backing the card (edge id + verification date).
class ResearchBasis extends StatefulWidget {
  final List<InsightCardEdgeRef> edgeRefs;
  const ResearchBasis({super.key, required this.edgeRefs});

  @override
  State<ResearchBasis> createState() => _ResearchBasisState();
}

class _ResearchBasisState extends State<ResearchBasis> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        GestureDetector(
          onTap: () => setState(() => _expanded = !_expanded),
          behavior: HitTestBehavior.opaque,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.menu_book_outlined,
                size: 14,
                color: OurobionColors.tertiary,
              ),
              const SizedBox(width: 6),
              Text(
                _expanded
                    ? InsightCardCopy.hideResearchBasis
                    : InsightCardCopy.viewResearchBasis,
                style: GoogleFonts.manrope(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: OurobionColors.tertiary,
                ),
              ),
              Icon(
                _expanded
                    ? Icons.keyboard_arrow_up_rounded
                    : Icons.keyboard_arrow_down_rounded,
                size: 16,
                color: OurobionColors.tertiary,
              ),
            ],
          ),
        ),
        if (_expanded) ...[
          const SizedBox(height: 8),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: OurobionColors.surfaceLow,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  InsightCardCopy.researchBasisIntro,
                  style: GoogleFonts.manrope(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: OurobionColors.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: 6),
                for (final ref in widget.edgeRefs)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      '${ref.edgeId} — '
                      '${InsightCardCopy.verifiedPrefix}'
                      '${_dateOnly(ref.verifiedAt)}',
                      style: GoogleFonts.manrope(
                        fontSize: 11,
                        color: OurobionColors.onSurfaceVariant,
                        height: 1.4,
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ],
    );
  }

  /// `verifiedAt` is an ISO instant; the date part is enough for the citation line.
  static String _dateOnly(String iso) =>
      iso.contains('T') ? iso.split('T').first : iso;
}

// ── Still-researching note (personal-producer relationship cards) ──────────────

/// Affordance for a personal-producer card: the pattern comes from the user's
/// own data and carries no research citation yet.
class StillResearchingNote extends StatelessWidget {
  const StillResearchingNote({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: OurobionColors.surfaceLow,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(
            Icons.travel_explore_outlined,
            size: 14,
            color: OurobionColors.outline,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  InsightCardCopy.stillResearchingLabel,
                  style: GoogleFonts.manrope(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: OurobionColors.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  InsightCardCopy.stillResearchingBody,
                  style: GoogleFonts.manrope(
                    fontSize: 11,
                    color: OurobionColors.outline,
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
