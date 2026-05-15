import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../../../core/theme.dart';
import '../../index.dart';

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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: BiotopeColors.surface,
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
                  color: BiotopeColors.onSurface,
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
                          color: BiotopeColors.primary,
                          child: ListView.separated(
                            padding: const EdgeInsets.fromLTRB(24, 0, 24, 32),
                            itemCount: _cards.length,
                            separatorBuilder: (_, _) =>
                                const SizedBox(height: 12),
                            itemBuilder: (_, i) => _InsightCardTile(
                              card: _cards[i],
                              onDismiss: () => _dismiss(_cards[i]),
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
                color: BiotopeColors.primaryFixed,
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Icon(
                Icons.lightbulb_outline_rounded,
                size: 32,
                color: BiotopeColors.primary,
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'No patterns yet',
              style: GoogleFonts.manrope(
                fontSize: 20,
                fontWeight: FontWeight.w600,
                letterSpacing: -0.2,
                color: BiotopeColors.onSurface,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Keep logging daily. Pattern cards appear here once your data shows a trend worth noting.',
              textAlign: TextAlign.center,
              style: GoogleFonts.manrope(
                fontSize: 13,
                color: BiotopeColors.outline,
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
  const _InsightCardTile({required this.card, required this.onDismiss});

  static IconData _icon(InsightCategory cat) => switch (cat) {
        InsightCategory.hydration => Icons.water_drop_outlined,
        InsightCategory.gut => Icons.spa_outlined,
        InsightCategory.behaviour => Icons.directions_walk_outlined,
        InsightCategory.vector => Icons.pest_control_outlined,
        InsightCategory.descriptive => Icons.lightbulb_outline_rounded,
      };

  static Color _iconColor(InsightCategory cat) => switch (cat) {
        InsightCategory.hydration => BiotopeColors.secondary,
        InsightCategory.gut => BiotopeColors.primary,
        InsightCategory.behaviour => BiotopeColors.tertiary,
        InsightCategory.vector => BiotopeColors.onSurfaceVariant,
        InsightCategory.descriptive => BiotopeColors.onSurfaceVariant,
      };

  static Color _iconBg(InsightCategory cat) => switch (cat) {
        InsightCategory.hydration => BiotopeColors.secondaryContainer,
        InsightCategory.gut => BiotopeColors.primaryFixed,
        InsightCategory.behaviour => BiotopeColors.surfaceContainer,
        InsightCategory.vector => BiotopeColors.surfaceContainer,
        InsightCategory.descriptive => BiotopeColors.surfaceContainer,
      };

  static String _categoryLabel(InsightCategory cat) => switch (cat) {
        InsightCategory.hydration => 'HYDRATION',
        InsightCategory.gut => 'GUT',
        InsightCategory.behaviour => 'BEHAVIOUR',
        InsightCategory.vector => 'VECTOR',
        InsightCategory.descriptive => 'INSIGHT',
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

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: BiotopeColors.surfaceLowest,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: BiotopeColors.outlineVariant),
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
                child: Icon(_icon(card.category), size: 22, color: iconColor),
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
                        color: BiotopeColors.onSurface,
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
              color: BiotopeColors.onSurfaceVariant,
              height: 1.5,
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: BiotopeColors.surfaceContainer,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  _confidenceLabel(card.confidenceScore),
                  style: GoogleFonts.manrope(
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                    color: BiotopeColors.onSurfaceVariant,
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
                    color: BiotopeColors.outline,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
