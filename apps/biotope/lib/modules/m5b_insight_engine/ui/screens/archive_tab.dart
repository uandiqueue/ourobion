import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../../core/generated_assets.dart';
import '../../../../core/theme.dart';
import '../../../../core/widgets/gold_card.dart';
import '../../../m5a_baselines/index.dart';
import '../../../m5a_baselines/ui/widgets/metric_trend_section.dart';
import '../../index.dart';
import '../widgets/insight_card_visual.dart';
import 'insight_provenance_screen.dart';

/// User-facing copy this tab owns directly (the reused [MetricTrendSection]
/// carries its own gated copy in [TrendCopy] — not duplicated here). Every
/// string must pass the shared non-diagnostic validator; see
/// test/m5b_insight_engine/archive_tab_copy_gate_test.dart.
abstract final class ArchiveTabCopy {
  static const savedEyebrow = 'SAVED INSIGHTS';

  /// The archived-cards read failing used to leave this tab spinning
  /// forever — same class of bug fixed in profile_tab.dart's _load(). Now
  /// caught, surfaced, and recoverable.
  static const loadFailed =
      'Your saved insights could not load right now — check your connection and try again.';
  static const retry = 'Try again';

  static const all = [savedEyebrow, loadFailed, retry];
}

/// Archive tab — the deck's "saved" (swipe-right) cards, now backed by the real
/// [InsightStatus.archived] status (migration 20260728040000) rather than the
/// old `snoozed` stand-in. The query still includes `snoozed` so cards saved
/// before that migration stay visible; see [InsightService.archiveStatuses].
///
/// Also the tab's real look-back surface for metric history (issue #200):
/// alongside the saved-insight cards, it renders [MetricTrendSection] — the
/// same reused trend widget/service/chart-math as Home's "TRENDS" section —
/// under its own eyebrow, so PRESERVED covers both halves of "look back".
class ArchiveTab extends StatefulWidget {
  /// [service] / [seriesService] / [userId] are injectable for widget tests
  /// only — production passes none and falls back to `Supabase.instance`.
  const ArchiveTab({super.key, this.service, this.seriesService, this.userId});

  final InsightService? service;
  final MetricSeriesService? seriesService;
  final String? userId;

  @override
  State<ArchiveTab> createState() => _ArchiveTabState();
}

class _ArchiveTabState extends State<ArchiveTab> {
  late final InsightService _service;
  late final MetricSeriesService _seriesService;
  late final String _userId;
  List<InsightCard> _cards = [];
  bool _loading = true;
  bool _loadFailed = false;

  @override
  void initState() {
    super.initState();
    _service = widget.service ?? InsightService(Supabase.instance.client);
    _seriesService =
        widget.seriesService ?? MetricSeriesService(Supabase.instance.client);
    _userId = widget.userId ?? Supabase.instance.client.auth.currentUser!.id;
    _load();
  }

  /// Never let a failed read leave this tab on a spinner forever — the exact
  /// bug just fixed in profile_tab.dart's _load(). Clears `_loading` on every
  /// path and offers an explicit retry via [_retryLoad].
  Future<void> _load() async {
    try {
      final cards = await _service.getArchivedInsights(_userId);
      if (!mounted) return;
      setState(() {
        _cards = cards;
        _loading = false;
        _loadFailed = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _loadFailed = true;
      });
    }
  }

  Future<void> _retryLoad() async {
    setState(() {
      _loading = true;
      _loadFailed = false;
    });
    await _load();
  }

  void _openDetail(InsightCard card) {
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => InsightProvenanceScreen(card: card)),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: OurobionColors.background,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 24, 24, 20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'PRESERVED',
                    style: GoogleFonts.manrope(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1.6,
                      color: OurobionColors.primary,
                    ),
                  ),
                  const SizedBox(height: 9),
                  Text(
                    'Archive',
                    style: GoogleFonts.manrope(
                      fontSize: 27,
                      fontWeight: FontWeight.w600,
                      letterSpacing: -0.7,
                      color: OurobionColors.onSurface,
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator())
                  : _loadFailed
                  ? _ArchiveLoadError(onRetry: _retryLoad)
                  : RefreshIndicator(
                      onRefresh: _load,
                      color: OurobionColors.primary,
                      child: SingleChildScrollView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: const EdgeInsets.fromLTRB(24, 0, 24, 32),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            _Eyebrow(ArchiveTabCopy.savedEyebrow, rule: true),
                            const SizedBox(height: 12),
                            if (_cards.isEmpty)
                              const _EmptyArchive()
                            else ...[
                              const _ArchiveCollectionArtwork(),
                              const SizedBox(height: 12),
                              for (var i = 0; i < _cards.length; i++) ...[
                                if (i > 0) const SizedBox(height: 11),
                                _ArchiveTile(
                                  card: _cards[i],
                                  onTap: () => _openDetail(_cards[i]),
                                ),
                              ],
                            ],

                            // ── Historical metric trends (issue #200) ──
                            // Real per-metric daily series over the same
                            // service/chart-math Home uses. No synthetic
                            // fallback: an empty/failed read renders its
                            // own explicit state (MetricTrendSection),
                            // never a fabricated chart.
                            const SizedBox(height: 28),
                            _Eyebrow(TrendCopy.eyebrow, rule: true),
                            const SizedBox(height: 12),
                            MetricTrendSection(
                              service: _seriesService,
                              userId: _userId,
                            ),
                          ],
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

class _Eyebrow extends StatelessWidget {
  final String label;

  /// Pairs the eyebrow with a gold hairline fading across the remaining
  /// width — same treatment as home_tab.dart's `_Eyebrow` (private there, so
  /// reproduced rather than imported).
  final bool rule;
  const _Eyebrow(this.label, {this.rule = false});

  @override
  Widget build(BuildContext context) {
    final text = Text(
      label,
      style: GoogleFonts.manrope(
        fontSize: 10,
        fontWeight: FontWeight.w700,
        letterSpacing: 1.6,
        color: OurobionColors.primary,
      ),
    );
    if (!rule) return text;
    return Row(
      children: [
        text,
        const SizedBox(width: 10),
        Expanded(
          child: Container(
            height: 1,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  OurobionColors.brandGold.withValues(alpha: 0.7),
                  OurobionColors.brandGold.withValues(alpha: 0),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _ArchiveLoadError extends StatelessWidget {
  final VoidCallback onRetry;
  const _ArchiveLoadError({required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              ArchiveTabCopy.loadFailed,
              textAlign: TextAlign.center,
              style: GoogleFonts.manrope(
                fontSize: 14,
                color: OurobionColors.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 16),
            OutlinedButton(
              onPressed: onRetry,
              child: Text(ArchiveTabCopy.retry),
            ),
          ],
        ),
      ),
    );
  }
}

class _ArchiveTile extends StatelessWidget {
  final InsightCard card;
  final VoidCallback onTap;
  const _ArchiveTile({required this.card, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GoldCard(
      onTap: onTap,
      padding: const EdgeInsets.fromLTRB(16, 15, 16, 15),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(14),
            child: SizedBox(
              width: 58,
              height: 64,
              child: Image.asset(
                BiotopeGeneratedAssets.archivePreservedFlowerFragment,
                fit: BoxFit.cover,
                errorBuilder: (context, error, stack) => Container(
                  color: InsightCardVisual.iconBg(card.category),
                  child: Icon(
                    InsightCardVisual.icon(card.category),
                    size: 21,
                    color: InsightCardVisual.iconColor(card.category),
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(width: 13),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  InsightCardVisual.categoryLabel(card.category),
                  style: GoogleFonts.manrope(
                    fontSize: 9,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.4,
                    color: InsightCardVisual.iconColor(card.category),
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  card.title,
                  style: GoogleFonts.manrope(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: OurobionColors.onSurface,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  card.body,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: GoogleFonts.manrope(
                    fontSize: 12,
                    height: 1.4,
                    color: OurobionColors.onSurfaceVariant,
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

class _EmptyArchive extends StatelessWidget {
  const _EmptyArchive();

  @override
  Widget build(BuildContext context) {
    return GoldCard(
      padding: const EdgeInsets.fromLTRB(24, 24, 24, 23),
      child: Stack(
        clipBehavior: Clip.none,
        alignment: Alignment.center,
        children: [
          Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Image.asset(
                BiotopeGeneratedAssets.emptyArchiveSpecimen,
                width: 132,
                height: 132,
                errorBuilder: (context, error, stack) =>
                    const SizedBox(width: 132, height: 132),
              ),
              const SizedBox(height: 16),
              Text(
                'Nothing saved yet',
                style: GoogleFonts.manrope(
                  fontSize: 20,
                  fontWeight: FontWeight.w600,
                  letterSpacing: -0.2,
                  color: OurobionColors.onSurface,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Swipe right on a card in Insights to press it into your archive.',
                textAlign: TextAlign.center,
                style: GoogleFonts.manrope(
                  fontSize: 13,
                  color: OurobionColors.onSurfaceVariant,
                  height: 1.5,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// A light herbarium strip gives populated archives the same porcelain specimen
/// treatment as the reference without replacing the real saved-card list.
class _ArchiveCollectionArtwork extends StatelessWidget {
  const _ArchiveCollectionArtwork();

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(18),
      child: SizedBox(
        height: 94,
        width: double.infinity,
        child: Stack(
          fit: StackFit.expand,
          children: [
            Image.asset(
              BiotopeGeneratedAssets.archiveHerbariumSpecimen,
              fit: BoxFit.cover,
              alignment: Alignment.centerRight,
              errorBuilder: (context, error, stack) =>
                  const ColoredBox(color: OurobionColors.primaryContainer),
            ),
            DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    OurobionColors.surfaceLowest.withValues(alpha: 0.94),
                    OurobionColors.surfaceLowest.withValues(alpha: 0.22),
                  ],
                ),
              ),
            ),
            Align(
              alignment: Alignment.centerLeft,
              child: Container(
                width: 72,
                height: 1,
                margin: const EdgeInsets.only(left: 18),
                color: OurobionColors.primary.withValues(alpha: 0.55),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
