import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:url_launcher/url_launcher.dart';

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
  static const paperEvidenceLabel = 'PAPER EVIDENCE';
  static const verbatimEvidenceLabel = 'VERBATIM FROM THE PAPER';
  static const mechanismLabel = "PAPER'S STATED MECHANISM";
  static const openSource = 'Open source';
  static const sourceLinkUnavailable = 'Source link unavailable';
  static const evidenceLoading = 'Loading paper evidence…';
  static const evidenceUnavailable =
      'Paper evidence could not be shown on this card. Tap for details.';
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
    paperEvidenceLabel,
    verbatimEvidenceLabel,
    mechanismLabel,
    openSource,
    sourceLinkUnavailable,
    evidenceLoading,
    evidenceUnavailable,
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

typedef ProvenanceLoader = Future<InsightProvenance?> Function(int cardId);
typedef ExternalPaperOpener = Future<bool> Function(Uri uri);

/// The evidence chain promised on a research-linked deck card: paper title,
/// the paper's own evidence sentence verbatim, a source link when the paper id
/// is a DOI, and the optional paper-stated mechanism. It reads the existing
/// per-card provenance RPC so the deck displays the exact edge version the card
/// cited; no evidence is copied into or re-summarised from the card body.
class ResearchBasis extends StatefulWidget {
  final int cardId;
  final ProvenanceLoader? loadProvenance;
  final ExternalPaperOpener? openExternalPaper;

  const ResearchBasis({
    super.key,
    required this.cardId,
    required this.loadProvenance,
    this.openExternalPaper,
  });

  @override
  State<ResearchBasis> createState() => _ResearchBasisState();
}

class _ResearchBasisState extends State<ResearchBasis> {
  late Future<InsightProvenance?> _provenance;

  @override
  void initState() {
    super.initState();
    _provenance = _load();
  }

  @override
  void didUpdateWidget(covariant ResearchBasis oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.cardId != widget.cardId ||
        oldWidget.loadProvenance != widget.loadProvenance) {
      _provenance = _load();
    }
  }

  Future<InsightProvenance?> _load() =>
      widget.loadProvenance?.call(widget.cardId) ?? Future.value();

  Future<void> _open(Uri uri) async {
    final opener = widget.openExternalPaper ?? _openExternalPaper;
    await opener(uri);
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<InsightProvenance?>(
      future: _provenance,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const _EvidenceStatus(InsightCardCopy.evidenceLoading);
        }
        final evidence = snapshot.hasError
            ? null
            : _DeckPaperEvidence.select(snapshot.data);
        if (evidence == null) {
          return const _EvidenceStatus(InsightCardCopy.evidenceUnavailable);
        }
        return _PaperEvidencePanel(evidence: evidence, onOpen: _open);
      },
    );
  }
}

Future<bool> _openExternalPaper(Uri uri) =>
    launchUrl(uri, mode: LaunchMode.externalApplication);

class _DeckPaperEvidence {
  final ProvenanceCitation citation;
  final ProvenanceQuoteSpan evidence;
  final ProvenanceQuoteSpan? mechanism;

  const _DeckPaperEvidence({
    required this.citation,
    required this.evidence,
    this.mechanism,
  });

  static _DeckPaperEvidence? select(InsightProvenance? provenance) {
    if (provenance == null) return null;
    for (final edge in provenance.edges) {
      for (final citation in edge.citations) {
        if (citation.title == null || citation.title!.trim().isEmpty) continue;
        final spans = edge.quoteSpans
            .where((span) => citation.matchesPaperId(span.paperId))
            .toList();
        ProvenanceQuoteSpan? evidence;
        ProvenanceQuoteSpan? mechanism;
        for (final span in spans) {
          if (span.isMechanism) {
            mechanism ??= span;
          } else {
            evidence ??= span;
          }
        }
        if (evidence != null) {
          return _DeckPaperEvidence(
            citation: citation,
            evidence: evidence,
            mechanism: mechanism,
          );
        }
      }
    }
    return null;
  }
}

class _EvidenceStatus extends StatelessWidget {
  final String text;
  const _EvidenceStatus(this.text);

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: OurobionColors.surfaceLow,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        text,
        style: GoogleFonts.manrope(
          fontSize: 11,
          color: OurobionColors.onSurfaceVariant,
          height: 1.4,
        ),
      ),
    );
  }
}

class _PaperEvidencePanel extends StatelessWidget {
  final _DeckPaperEvidence evidence;
  final ValueChanged<Uri> onOpen;
  const _PaperEvidencePanel({required this.evidence, required this.onOpen});

  @override
  Widget build(BuildContext context) {
    final citation = evidence.citation;
    final uri = citation.paperUri;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: OurobionColors.surfaceLow,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: OurobionColors.outlineVariant),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _evidenceLabel(InsightCardCopy.paperEvidenceLabel),
          const SizedBox(height: 5),
          Text(
            [
              citation.title!,
              if (citation.year != null) '(${citation.year})',
            ].join(' '),
            style: GoogleFonts.manrope(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: OurobionColors.onSurface,
              height: 1.35,
            ),
          ),
          const SizedBox(height: 9),
          _evidenceLabel(InsightCardCopy.verbatimEvidenceLabel),
          const SizedBox(height: 4),
          Text(
            evidence.evidence.quote,
            style: GoogleFonts.manrope(
              fontSize: 11.5,
              fontStyle: FontStyle.italic,
              color: OurobionColors.onSurfaceVariant,
              height: 1.5,
            ),
          ),
          if (evidence.mechanism case final mechanism?) ...[
            const SizedBox(height: 9),
            _evidenceLabel(InsightCardCopy.mechanismLabel),
            const SizedBox(height: 4),
            Text(
              mechanism.quote,
              style: GoogleFonts.manrope(
                fontSize: 11,
                color: OurobionColors.onSurfaceVariant,
                height: 1.45,
              ),
            ),
          ],
          const SizedBox(height: 7),
          if (uri != null)
            TextButton.icon(
              onPressed: () => onOpen(uri),
              style: TextButton.styleFrom(
                padding: EdgeInsets.zero,
                minimumSize: const Size(0, 36),
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              icon: const Icon(Icons.open_in_new_rounded, size: 14),
              label: const Text(InsightCardCopy.openSource),
            )
          else
            Text(
              InsightCardCopy.sourceLinkUnavailable,
              style: GoogleFonts.manrope(
                fontSize: 10.5,
                color: OurobionColors.outline,
              ),
            ),
        ],
      ),
    );
  }

  Widget _evidenceLabel(String text) => Text(
    text,
    style: GoogleFonts.manrope(
      fontSize: 8.5,
      fontWeight: FontWeight.w700,
      letterSpacing: 1.1,
      color: OurobionColors.tertiary,
    ),
  );
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
