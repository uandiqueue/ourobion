import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../../../core/theme.dart';
import '../../index.dart';
import 'insight_provenance_screen.dart';

/// User-facing copy for the relationship-card affordances. Public so the copy
/// gate test can run every string through the shared non-diagnostic validator
/// (shared/constants/copy_guidelines.dart).
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

  static const all = [
    relationshipCategoryLabel,
    viewResearchBasis,
    hideResearchBasis,
    researchBasisIntro,
    verifiedPrefix,
    stillResearchingLabel,
    stillResearchingBody,
    howGenerated,
  ];
}

class InsightsTab extends StatefulWidget {
  const InsightsTab({super.key});

  @override
  State<InsightsTab> createState() => _InsightsTabState();
}

class _InsightsTabState extends State<InsightsTab> {
  late final InsightService _service;
  List<InsightCard> _cards = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _service = InsightService(Supabase.instance.client);
    _load();
  }

  Future<void> _load() async {
    try {
      final userId = Supabase.instance.client.auth.currentUser!.id;
      final cards = await _service.getInsights(userId);
      if (!mounted) return;
      setState(() {
        _cards = cards;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  Future<void> _dismiss(InsightCard card) async {
    await _service.updateStatus(card.id, InsightStatus.dismissed);
    if (!mounted) return;
    setState(() => _cards.removeWhere((c) => c.id == card.id));
  }

  /// Demo main-loop step 5: tapping a card opens its provenance detail.
  void _openProvenance(InsightCard card) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => InsightProvenanceScreen(card: card),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: OurobionColors.surface,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 24, 24, 20),
              child: Text(
                'Insights',
                style: GoogleFonts.manrope(
                  fontSize: 28,
                  fontWeight: FontWeight.w600,
                  letterSpacing: -0.4,
                  color: OurobionColors.onSurface,
                ),
              ),
            ),
            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator())
                  : _cards.isEmpty
                      ? const _EmptyState()
                      : RefreshIndicator(
                          onRefresh: _load,
                          color: OurobionColors.primary,
                          child: ListView.separated(
                            padding: const EdgeInsets.fromLTRB(24, 0, 24, 32),
                            itemCount: _cards.length,
                            separatorBuilder: (_, _) =>
                                const SizedBox(height: 12),
                            itemBuilder: (_, i) => _InsightCardTile(
                              card: _cards[i],
                              onDismiss: () => _dismiss(_cards[i]),
                              onTap: () => _openProvenance(_cards[i]),
                            ),
                          ),
                        ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Empty state ────────────────────────────────────────────────────────────────

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 40),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                color: OurobionColors.primaryFixed,
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Icon(
                Icons.lightbulb_outline_rounded,
                size: 32,
                color: OurobionColors.primary,
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'No patterns yet',
              style: GoogleFonts.manrope(
                fontSize: 20,
                fontWeight: FontWeight.w600,
                letterSpacing: -0.2,
                color: OurobionColors.onSurface,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Keep logging daily. Pattern cards appear here once your data shows a trend worth noting.',
              textAlign: TextAlign.center,
              style: GoogleFonts.manrope(
                fontSize: 13,
                color: OurobionColors.outline,
                height: 1.5,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Insight card tile ──────────────────────────────────────────────────────────

class _InsightCardTile extends StatelessWidget {
  final InsightCard card;
  final VoidCallback onDismiss;
  final VoidCallback onTap;
  const _InsightCardTile({
    required this.card,
    required this.onDismiss,
    required this.onTap,
  });

  static IconData _icon(InsightCategory cat) => switch (cat) {
        InsightCategory.hydration => Icons.water_drop_outlined,
        InsightCategory.gut => Icons.spa_outlined,
        InsightCategory.behaviour => Icons.directions_walk_outlined,
        InsightCategory.vector => Icons.pest_control_outlined,
        InsightCategory.descriptive => Icons.lightbulb_outline_rounded,
        InsightCategory.relationship => Icons.hub_outlined,
      };

  static Color _iconColor(InsightCategory cat) => switch (cat) {
        InsightCategory.hydration => OurobionColors.secondary,
        InsightCategory.gut => OurobionColors.primary,
        InsightCategory.behaviour => OurobionColors.tertiary,
        InsightCategory.vector => OurobionColors.onSurfaceVariant,
        InsightCategory.descriptive => OurobionColors.onSurfaceVariant,
        InsightCategory.relationship => OurobionColors.tertiary,
      };

  static Color _iconBg(InsightCategory cat) => switch (cat) {
        InsightCategory.hydration => OurobionColors.secondaryContainer,
        InsightCategory.gut => OurobionColors.primaryFixed,
        InsightCategory.behaviour => OurobionColors.surfaceContainer,
        InsightCategory.vector => OurobionColors.surfaceContainer,
        InsightCategory.descriptive => OurobionColors.surfaceContainer,
        InsightCategory.relationship => OurobionColors.tertiaryFixedDim,
      };

  static String _categoryLabel(InsightCategory cat) => switch (cat) {
        InsightCategory.hydration => 'HYDRATION',
        InsightCategory.gut => 'GUT',
        InsightCategory.behaviour => 'BEHAVIOUR',
        InsightCategory.vector => 'VECTOR',
        InsightCategory.descriptive => 'INSIGHT',
        InsightCategory.relationship => InsightCardCopy.relationshipCategoryLabel,
      };

  static String _confidenceLabel(double score) {
    if (score >= 1.0) return 'High confidence';
    if (score >= 0.66) return 'Medium confidence';
    if (score >= 0.33) return 'Low confidence';
    return 'Building data';
  }

  @override
  Widget build(BuildContext context) {
    final iconColor = _iconColor(card.category);

    // Whole tile taps through to the provenance detail (demo step 5); the
    // inner dismiss / research-basis gesture detectors win their hit tests.
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: OurobionColors.surfaceLowest,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: OurobionColors.outlineVariant),
          boxShadow: const [
            BoxShadow(
              color: Color(0x0A191c1c),
              blurRadius: 24,
              offset: Offset(0, 8),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: _iconBg(card.category),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child:
                      Icon(_icon(card.category), size: 22, color: iconColor),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _categoryLabel(card.category),
                        style: GoogleFonts.manrope(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 1.4,
                          color: iconColor,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        card.title,
                        style: GoogleFonts.manrope(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: OurobionColors.onSurface,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              card.body,
              style: GoogleFonts.manrope(
                fontSize: 13,
                color: OurobionColors.onSurfaceVariant,
                height: 1.5,
              ),
            ),
            if (card.isResearchLinked) ...[
              const SizedBox(height: 12),
              _ResearchBasis(edgeRefs: card.edgeRefs),
            ] else if (card.isStillResearching) ...[
              const SizedBox(height: 12),
              const _StillResearchingNote(),
            ],
            const SizedBox(height: 12),
            // Provenance affordance (demo main-loop step 5) — the whole tile
            // is tappable; this line makes the detail screen discoverable.
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  InsightCardCopy.howGenerated,
                  style: GoogleFonts.manrope(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: OurobionColors.primary,
                  ),
                ),
                const Icon(
                  Icons.chevron_right_rounded,
                  size: 16,
                  color: OurobionColors.primary,
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: OurobionColors.surfaceContainer,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    _confidenceLabel(card.confidenceScore),
                    style: GoogleFonts.manrope(
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                      color: OurobionColors.onSurfaceVariant,
                    ),
                  ),
                ),
                const Spacer(),
                GestureDetector(
                  onTap: onDismiss,
                  child: Text(
                    'Dismiss',
                    style: GoogleFonts.manrope(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: OurobionColors.outline,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// ── Research-basis affordance (research-linked relationship cards) ─────────────

/// Citation affordance for a research-linked card: a tap target that expands to
/// list the verified edges backing the card (edge id + verification date).
class _ResearchBasis extends StatefulWidget {
  final List<InsightCardEdgeRef> edgeRefs;
  const _ResearchBasis({required this.edgeRefs});

  @override
  State<_ResearchBasis> createState() => _ResearchBasisState();
}

class _ResearchBasisState extends State<_ResearchBasis> {
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
class _StillResearchingNote extends StatelessWidget {
  const _StillResearchingNote();

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
