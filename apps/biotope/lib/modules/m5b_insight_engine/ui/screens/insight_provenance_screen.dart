import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/theme.dart';
import '../../index.dart';

/// User-facing copy for the provenance screen. Public so the copy gate test
/// can run every string through the shared non-diagnostic validator
/// (shared/constants/copy_guidelines.dart) — same pattern as InsightCardCopy.
abstract final class ProvenanceCopy {
  static const screenTitle = 'How this was generated';
  static const generatedPrefix = 'Generated ';

  // Producer explainers — observational, never research decoration where none
  // exists.
  static const producerRules =
      'Produced by a built-in rule over your own logged data.';
  static const producerEdge =
      'Produced from a research-linked relationship over your data.';
  static const producerPersonal =
      'Produced from a pattern seen in your own data.';

  static const patternLabel = 'PATTERN';
  static const branchPrefix = 'Branch: ';

  static const coverageLabel = 'DATA COVERAGE';
  static const daysWithDataSuffix = ' days with data in the window';
  static const daySuffix = ' days';

  static const yourDataLabel = 'YOUR DATA';
  static const effectiveDaysSuffix = ' effective days';
  static const stableWord = 'stable';
  static const notYetStableWord = 'not yet stable';

  static const researchLinksLabel = 'RESEARCH LINKS';
  // Honesty requirement (O12 locked): the uncited case renders plainly — no
  // research decoration.
  static const noEdgesPersonal =
      'This pattern comes from your own data. No published research link yet.';
  static const noEdgesRules =
      'This card comes from a built-in rule over your own logged data. '
      'No research citation is attached.';

  static const verdictPrefix = 'Verifier verdict: ';
  static const verifiedAsOfPrefix = 'as of ';

  /// TEST-MODE verdict posture stamp. Hardcoded mirror of TEST_MODE_LABEL in
  /// tools/llm-router/src/types.ts (no cross-language import exists — keep
  /// the wording in lockstep). Load-bearing Run 2.0 posture decision: verdicts
  /// produced under TEST-MODE come from a single-provider setup with the
  /// synthesis↔verifier decorrelation invariant OFF, i.e. NOT an independent
  /// check — so the UI says "scaffolded + unit-tested", never
  /// "verified/proven".
  static const testModeVerdictLabel =
      'scaffolded + unit-tested (TEST-MODE: single-provider, decorrelation OFF)';

  static const servingBandPrefix = 'serving band ';
  static const edgeScorePrefix = 'score ';
  static const directionConsistent = 'direction consistent';
  static const directionInconsistent = 'direction inconsistent';

  static const evidenceTierPrefix = 'evidence tier ';

  static const derivationLabel = 'HOW THIS LINK WAS DERIVED';
  static const populationPrefix = 'Studied scope: ';
  static const quotesLabel = 'SOURCE QUOTES';
  static const citationsLabel = 'PAPER EVIDENCE';
  static const verbatimEvidenceLabel = 'VERBATIM EVIDENCE';
  static const mechanismLabel = "PAPER'S STATED MECHANISM";
  static const evidenceUnavailable =
      'No verbatim evidence sentence was supplied for this paper.';
  static const mechanismUnavailable =
      'No mechanism sentence was supplied for this paper.';
  static const evidenceLabel = 'Verifier evidence passages';
  static const openPaper = 'Open paper';
  static const openPaperExternal = 'Open paper externally';
  static const paperLinkUnavailable = 'Paper link unavailable';
  static const paperLinkFailed = 'Paper link could not be opened.';

  static const notVisibleBody =
      'There is no provenance to show for this card on this account.';
  static const loadErrorBody = 'Provenance could not be loaded right now.';

  static const all = [
    screenTitle,
    generatedPrefix,
    producerRules,
    producerEdge,
    producerPersonal,
    patternLabel,
    branchPrefix,
    coverageLabel,
    daysWithDataSuffix,
    daySuffix,
    yourDataLabel,
    effectiveDaysSuffix,
    stableWord,
    notYetStableWord,
    researchLinksLabel,
    noEdgesPersonal,
    noEdgesRules,
    verdictPrefix,
    verifiedAsOfPrefix,
    testModeVerdictLabel,
    servingBandPrefix,
    edgeScorePrefix,
    directionConsistent,
    directionInconsistent,
    evidenceTierPrefix,
    derivationLabel,
    populationPrefix,
    quotesLabel,
    citationsLabel,
    evidenceLabel,
    verbatimEvidenceLabel,
    mechanismLabel,
    evidenceUnavailable,
    mechanismUnavailable,
    openPaper,
    openPaperExternal,
    paperLinkUnavailable,
    paperLinkFailed,
    notVisibleBody,
    loadErrorBody,
  ];
}

/// Provenance detail screen (demo main-loop step 5): how one insight card was
/// generated — producer, branch, data coverage, personal stats, and the cited
/// edges with claim derivation, quotes, and citations. Pushed from the
/// insight card tile.
class InsightProvenanceScreen extends StatefulWidget {
  final InsightCard card;

  /// Injectable for widget tests (the default touches Supabase.instance,
  /// which tests cannot initialize).
  final ProvenanceService? service;
  final Future<bool> Function(Uri uri)? openExternalLink;

  const InsightProvenanceScreen({
    super.key,
    required this.card,
    this.service,
    this.openExternalLink,
  });

  @override
  State<InsightProvenanceScreen> createState() =>
      _InsightProvenanceScreenState();
}

class _InsightProvenanceScreenState extends State<InsightProvenanceScreen> {
  late final ProvenanceService _service;
  InsightProvenance? _provenance;
  bool _loading = true;
  bool _error = false;

  @override
  void initState() {
    super.initState();
    _service = widget.service ?? ProvenanceService(Supabase.instance.client);
    _load();
  }

  Future<void> _load() async {
    try {
      final provenance = await _service.getProvenance(widget.card.id);
      if (!mounted) return;
      setState(() {
        _provenance = provenance;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = true;
      });
    }
  }

  Future<void> _openPaper(Uri uri) async {
    final opened =
        await (widget.openExternalLink?.call(uri) ??
            launchUrl(uri, mode: LaunchMode.externalApplication));
    if (opened || !mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text(ProvenanceCopy.paperLinkFailed)),
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
                      ProvenanceCopy.screenTitle,
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
            Expanded(child: _body()),
          ],
        ),
      ),
    );
  }

  Widget _body() {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_error) return _centeredNote(ProvenanceCopy.loadErrorBody);
    final provenance = _provenance;
    if (provenance == null) {
      return _centeredNote(ProvenanceCopy.notVisibleBody);
    }
    return ListView(
      padding: const EdgeInsets.fromLTRB(24, 8, 24, 32),
      children: [
        _CardHeader(card: provenance.card),
        if (provenance.patternKey != null || provenance.branch != null) ...[
          const SizedBox(height: 12),
          _PatternSection(
            patternKey: provenance.patternKey,
            branch: provenance.branch,
          ),
        ],
        if (provenance.completeness != null) ...[
          const SizedBox(height: 12),
          _CompletenessSection(completeness: provenance.completeness!),
        ],
        if (provenance.personal != null) ...[
          const SizedBox(height: 12),
          _PersonalSection(personal: provenance.personal!),
        ],
        const SizedBox(height: 20),
        _eyebrow(ProvenanceCopy.researchLinksLabel),
        const SizedBox(height: 10),
        if (provenance.edges.isEmpty)
          // Honest empty state — plain text, no research decoration.
          _PlainNote(
            text: provenance.card.producer == 'personal'
                ? ProvenanceCopy.noEdgesPersonal
                : ProvenanceCopy.noEdgesRules,
          )
        else
          for (final edge in provenance.edges) ...[
            _EdgeCard(edge: edge, onOpenPaper: _openPaper),
            const SizedBox(height: 12),
          ],
      ],
    );
  }

  Widget _centeredNote(String text) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 40),
        child: Text(
          text,
          textAlign: TextAlign.center,
          style: GoogleFonts.manrope(
            fontSize: 13,
            color: OurobionColors.outline,
            height: 1.5,
          ),
        ),
      ),
    );
  }
}

// ── Shared bits ────────────────────────────────────────────────────────────────

Widget _eyebrow(String label) {
  return Text(
    label,
    style: GoogleFonts.manrope(
      fontSize: 10,
      fontWeight: FontWeight.w700,
      letterSpacing: 1.6,
      color: OurobionColors.primary,
    ),
  );
}

BoxDecoration _panelDecoration() {
  return BoxDecoration(
    color: OurobionColors.surfaceLowest,
    borderRadius: BorderRadius.circular(16),
    border: Border.all(color: OurobionColors.outlineVariant),
  );
}

class _Chip extends StatelessWidget {
  final String label;
  final Color background;
  final Color foreground;
  const _Chip({
    required this.label,
    this.background = OurobionColors.surfaceContainer,
    this.foreground = OurobionColors.onSurfaceVariant,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        label.toUpperCase(),
        style: GoogleFonts.manrope(
          fontSize: 10,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.8,
          color: foreground,
        ),
      ),
    );
  }
}

class _PlainNote extends StatelessWidget {
  final String text;
  const _PlainNote({required this.text});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: OurobionColors.surfaceLow,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        text,
        style: GoogleFonts.manrope(
          fontSize: 12,
          color: OurobionColors.onSurfaceVariant,
          height: 1.5,
        ),
      ),
    );
  }
}

String _dateOnly(String iso) => iso.contains('T') ? iso.split('T').first : iso;

// ── Sections ───────────────────────────────────────────────────────────────────

class _CardHeader extends StatelessWidget {
  final ProvenanceCardInfo card;
  const _CardHeader({required this.card});

  String get _producerExplainer => switch (card.producer) {
    'edge' => ProvenanceCopy.producerEdge,
    'personal' => ProvenanceCopy.producerPersonal,
    _ => ProvenanceCopy.producerRules,
  };

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: _panelDecoration(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              _Chip(
                label: card.category,
                background: OurobionColors.primaryFixed,
                foreground: OurobionColors.primary,
              ),
              _Chip(label: card.producer),
              // Severity is info/notice/watch styling at most — a neutral
              // chip, never medical urgency.
              _Chip(label: card.severity),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            card.title,
            style: GoogleFonts.manrope(
              fontSize: 15,
              fontWeight: FontWeight.w600,
              color: OurobionColors.onSurface,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            card.body,
            style: GoogleFonts.manrope(
              fontSize: 13,
              color: OurobionColors.onSurfaceVariant,
              height: 1.5,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            _producerExplainer,
            style: GoogleFonts.manrope(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: OurobionColors.outline,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            '${ProvenanceCopy.generatedPrefix}${_dateOnly(card.generatedAt)}',
            style: GoogleFonts.manrope(
              fontSize: 11,
              color: OurobionColors.outline,
            ),
          ),
        ],
      ),
    );
  }
}

class _PatternSection extends StatelessWidget {
  final String? patternKey;
  final String? branch;
  const _PatternSection({required this.patternKey, required this.branch});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: _panelDecoration(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _eyebrow(ProvenanceCopy.patternLabel),
          const SizedBox(height: 6),
          if (patternKey != null)
            Text(
              patternKey!,
              style: GoogleFonts.manrope(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: OurobionColors.onSurface,
              ),
            ),
          if (branch != null) ...[
            const SizedBox(height: 4),
            Text(
              '${ProvenanceCopy.branchPrefix}$branch',
              style: GoogleFonts.manrope(
                fontSize: 12,
                color: OurobionColors.onSurfaceVariant,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _CompletenessSection extends StatelessWidget {
  final ProvenanceCompleteness completeness;
  const _CompletenessSection({required this.completeness});

  @override
  Widget build(BuildContext context) {
    final entries = completeness.perMetric.entries.toList()
      ..sort((a, b) => a.key.compareTo(b.key));
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: _panelDecoration(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _eyebrow(ProvenanceCopy.coverageLabel),
          const SizedBox(height: 6),
          Text(
            '${completeness.daysPresent} / ${completeness.windowDays}'
            '${ProvenanceCopy.daysWithDataSuffix}',
            style: GoogleFonts.manrope(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: OurobionColors.onSurface,
            ),
          ),
          for (final entry in entries) ...[
            const SizedBox(height: 3),
            Text(
              '${entry.key} · ${entry.value}${ProvenanceCopy.daySuffix}',
              style: GoogleFonts.manrope(
                fontSize: 11,
                color: OurobionColors.onSurfaceVariant,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _PersonalSection extends StatelessWidget {
  final ProvenancePersonal personal;
  const _PersonalSection({required this.personal});

  @override
  Widget build(BuildContext context) {
    // Observational language only: the user's own pair statistics, plainly.
    final stability = personal.stable
        ? ProvenanceCopy.stableWord
        : ProvenanceCopy.notYetStableWord;
    final line =
        'ρ ${personal.rho.toStringAsFixed(2)}'
        ' · ${personal.nEff.toStringAsFixed(1)}'
        '${ProvenanceCopy.effectiveDaysSuffix}'
        ' · q ${personal.qValue.toStringAsPrecision(2)}'
        ' · $stability';
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: _panelDecoration(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _eyebrow(ProvenanceCopy.yourDataLabel),
          const SizedBox(height: 6),
          Text(
            line,
            style: GoogleFonts.manrope(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: OurobionColors.onSurface,
            ),
          ),
        ],
      ),
    );
  }
}

class _EdgeCard extends StatelessWidget {
  final ProvenanceEdge edge;
  final ValueChanged<Uri> onOpenPaper;
  const _EdgeCard({required this.edge, required this.onOpenPaper});

  String get _title {
    if (edge.subject != null && edge.object != null) {
      final relation = edge.relation ?? '→';
      return '${edge.subject} · $relation · ${edge.object}';
    }
    return edge.edgeId;
  }

  String get _metaLine {
    final parts = <String>[
      if (edge.direction == 'consistent') ProvenanceCopy.directionConsistent,
      if (edge.direction == 'inconsistent')
        ProvenanceCopy.directionInconsistent,
      if (edge.servingBand != null)
        '${ProvenanceCopy.servingBandPrefix}${edge.servingBand}',
      if (edge.edgeScore != null)
        '${ProvenanceCopy.edgeScorePrefix}${edge.edgeScore!.toStringAsFixed(2)}',
    ];
    return parts.join(' · ');
  }

  @override
  Widget build(BuildContext context) {
    final unmatchedSpans = edge.quoteSpans
        .where(
          (span) => !edge.citations.any(
            (citation) => citation.matchesPaperId(span.paperId),
          ),
        )
        .toList();
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: _panelDecoration(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            _title,
            style: GoogleFonts.manrope(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: OurobionColors.onSurface,
            ),
          ),
          if (_metaLine.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              _metaLine,
              style: GoogleFonts.manrope(
                fontSize: 11,
                color: OurobionColors.onSurfaceVariant,
              ),
            ),
          ],
          if (edge.verdict != null) ...[
            const SizedBox(height: 10),
            Text(
              '${ProvenanceCopy.verdictPrefix}${edge.verdict}'
              '${edge.verifiedAt != null ? ' (${ProvenanceCopy.verifiedAsOfPrefix}${_dateOnly(edge.verifiedAt!)})' : ''}',
              style: GoogleFonts.manrope(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: OurobionColors.onSurface,
              ),
            ),
            const SizedBox(height: 2),
            // Interim-verifier honesty (D15 / Run 2.0 posture): every verdict
            // carries the TEST-MODE stamp — scaffolded + unit-tested, not
            // independently verified.
            Text(
              ProvenanceCopy.testModeVerdictLabel,
              style: GoogleFonts.manrope(
                fontSize: 10,
                fontWeight: FontWeight.w600,
                color: OurobionColors.outline,
                height: 1.4,
              ),
            ),
          ],
          if (edge.derivation != null && edge.derivation!.isNotEmpty) ...[
            const SizedBox(height: 10),
            _eyebrow(ProvenanceCopy.derivationLabel),
            const SizedBox(height: 4),
            Text(
              edge.derivation!,
              style: GoogleFonts.manrope(
                fontSize: 12,
                color: OurobionColors.onSurfaceVariant,
                height: 1.5,
              ),
            ),
          ],
          if (edge.population != null && edge.population!.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              '${ProvenanceCopy.populationPrefix}${edge.population}',
              style: GoogleFonts.manrope(
                fontSize: 11,
                color: OurobionColors.onSurfaceVariant,
                height: 1.4,
              ),
            ),
          ],
          if (edge.citations.isNotEmpty) ...[
            const SizedBox(height: 10),
            _eyebrow(ProvenanceCopy.citationsLabel),
            for (final citation in edge.citations) ...[
              const SizedBox(height: 6),
              _CitationTile(
                citation: citation,
                quoteSpans: edge.quoteSpans
                    .where((span) => citation.matchesPaperId(span.paperId))
                    .toList(),
                onOpenPaper: onOpenPaper,
              ),
            ],
          ],
          if (unmatchedSpans.isNotEmpty) ...[
            const SizedBox(height: 10),
            _eyebrow(ProvenanceCopy.quotesLabel),
            for (final span in unmatchedSpans) ...[
              const SizedBox(height: 6),
              _QuoteSpanTile(span: span),
            ],
          ],
        ],
      ),
    );
  }
}

class _QuoteSpanTile extends StatelessWidget {
  final ProvenanceQuoteSpan span;
  const _QuoteSpanTile({required this.span});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: OurobionColors.surfaceLow,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '“${span.quote}”',
            style: GoogleFonts.manrope(
              fontSize: 11,
              fontStyle: FontStyle.italic,
              color: OurobionColors.onSurfaceVariant,
              height: 1.5,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            [span.paperId, if (span.locator != null) span.locator!].join(' · '),
            style: GoogleFonts.manrope(
              fontSize: 10,
              color: OurobionColors.outline,
            ),
          ),
        ],
      ),
    );
  }
}

class _PaperQuoteTile extends StatelessWidget {
  final ProvenanceQuoteSpan span;
  const _PaperQuoteTile({required this.span});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: OurobionColors.background,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: OurobionColors.outlineVariant),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            span.quote,
            style: GoogleFonts.manrope(
              fontSize: 11,
              fontStyle: FontStyle.italic,
              color: OurobionColors.onSurfaceVariant,
              height: 1.5,
            ),
          ),
          if (span.section case final section?) ...[
            const SizedBox(height: 3),
            Text(
              section,
              style: GoogleFonts.manrope(
                fontSize: 10,
                color: OurobionColors.outline,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _CitationTile extends StatelessWidget {
  final ProvenanceCitation citation;
  final List<ProvenanceQuoteSpan> quoteSpans;
  final ValueChanged<Uri> onOpenPaper;
  const _CitationTile({
    required this.citation,
    required this.quoteSpans,
    required this.onOpenPaper,
  });

  @override
  Widget build(BuildContext context) {
    final headline = [
      citation.title ?? citation.paperId,
      if (citation.year != null) '(${citation.year})',
    ].join(' ');
    final meta = [
      if (citation.evidenceTier != null)
        '${ProvenanceCopy.evidenceTierPrefix}${citation.evidenceTier}',
      if (citation.impactTier != null) citation.impactTier!,
      if (citation.stance != null) citation.stance!,
      if (citation.population != null) citation.population!,
    ].join(' · ');
    final evidenceSpans = quoteSpans
        .where((span) => !span.isMechanism)
        .toList();
    final mechanismSpans = quoteSpans
        .where((span) => span.isMechanism)
        .toList();
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: OurobionColors.surfaceLow,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            headline,
            style: GoogleFonts.manrope(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: OurobionColors.onSurface,
              height: 1.4,
            ),
          ),
          if (meta.isNotEmpty) ...[
            const SizedBox(height: 2),
            Text(
              meta,
              style: GoogleFonts.manrope(
                fontSize: 10,
                color: OurobionColors.outline,
              ),
            ),
          ],
          const SizedBox(height: 4),
          if (citation.paperUri case final uri?)
            Align(
              alignment: Alignment.centerLeft,
              child: Semantics(
                key: ValueKey('citation-link-${citation.paperId}'),
                container: true,
                link: true,
                label: ProvenanceCopy.openPaperExternal,
                value: uri.toString(),
                onTap: () => onOpenPaper(uri),
                child: ExcludeSemantics(
                  child: TextButton.icon(
                    onPressed: () => onOpenPaper(uri),
                    style: TextButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      minimumSize: const Size(48, 48),
                    ),
                    icon: const Icon(Icons.open_in_new_rounded, size: 14),
                    label: Text(ProvenanceCopy.openPaper),
                  ),
                ),
              ),
            )
          else
            Text(
              ProvenanceCopy.paperLinkUnavailable,
              style: GoogleFonts.manrope(
                fontSize: 10,
                color: OurobionColors.outline,
              ),
            ),
          const SizedBox(height: 10),
          _eyebrow(ProvenanceCopy.verbatimEvidenceLabel),
          if (evidenceSpans.isEmpty)
            Text(
              ProvenanceCopy.evidenceUnavailable,
              style: GoogleFonts.manrope(
                fontSize: 10,
                color: OurobionColors.outline,
              ),
            )
          else
            for (final span in evidenceSpans) ...[
              const SizedBox(height: 4),
              _PaperQuoteTile(span: span),
            ],
          const SizedBox(height: 10),
          _eyebrow(ProvenanceCopy.mechanismLabel),
          if (mechanismSpans.isEmpty)
            Text(
              ProvenanceCopy.mechanismUnavailable,
              style: GoogleFonts.manrope(
                fontSize: 10,
                color: OurobionColors.outline,
              ),
            )
          else
            for (final span in mechanismSpans) ...[
              const SizedBox(height: 4),
              _PaperQuoteTile(span: span),
            ],
          if (citation.evidence.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              ProvenanceCopy.evidenceLabel,
              style: GoogleFonts.manrope(
                fontSize: 10,
                fontWeight: FontWeight.w700,
                color: OurobionColors.onSurfaceVariant,
              ),
            ),
            for (final passage in citation.evidence) ...[
              const SizedBox(height: 3),
              Text(
                [
                  passage.text,
                  if (passage.locator != null) '— ${passage.locator}',
                ].join(' '),
                style: GoogleFonts.manrope(
                  fontSize: 10,
                  color: OurobionColors.onSurfaceVariant,
                  height: 1.4,
                ),
              ),
            ],
          ],
        ],
      ),
    );
  }
}
