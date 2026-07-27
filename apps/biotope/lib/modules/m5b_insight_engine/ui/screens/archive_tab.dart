import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../../core/generated_assets.dart';
import '../../../../core/theme.dart';
import '../../../../core/widgets/gold_card.dart';
import '../../index.dart';
import '../widgets/insight_card_visual.dart';
import 'insight_provenance_screen.dart';

/// Archive tab — the deck's "saved" (swipe-right) cards. Reuses the same
/// `snoozed` status the deck writes (see insight_service.dart's
/// getSnoozedInsights doc comment — no dedicated `archived` status exists yet).
class ArchiveTab extends StatefulWidget {
  const ArchiveTab({super.key});

  @override
  State<ArchiveTab> createState() => _ArchiveTabState();
}

class _ArchiveTabState extends State<ArchiveTab> {
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
    final userId = Supabase.instance.client.auth.currentUser!.id;
    final cards = await _service.getSnoozedInsights(userId);
    if (!mounted) return;
    setState(() {
      _cards = cards;
      _loading = false;
    });
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
                  : _cards.isEmpty
                      ? const _EmptyArchive()
                      : RefreshIndicator(
                          onRefresh: _load,
                          color: OurobionColors.primary,
                          child: ListView.separated(
                            padding: const EdgeInsets.fromLTRB(24, 0, 24, 32),
                            itemCount: _cards.length,
                            separatorBuilder: (_, _) => const SizedBox(height: 11),
                            itemBuilder: (_, i) => _ArchiveTile(
                              card: _cards[i],
                              onTap: () => _openDetail(_cards[i]),
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

class _ArchiveTile extends StatelessWidget {
  final InsightCard card;
  final VoidCallback onTap;
  const _ArchiveTile({required this.card, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final iconColor = InsightCardVisual.iconColor(card.category);
    return GoldCard(
      onTap: onTap,
      padding: const EdgeInsets.fromLTRB(16, 15, 16, 15),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 46,
            height: 46,
            decoration: BoxDecoration(
              color: InsightCardVisual.iconBg(card.category),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(InsightCardVisual.icon(card.category), size: 21, color: iconColor),
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
                    color: iconColor,
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
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 40),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Image.asset(
              BiotopeGeneratedAssets.emptyArchiveSpecimen,
              width: 120,
              height: 120,
              errorBuilder: (context, error, stack) => const SizedBox(width: 120, height: 120),
            ),
            const SizedBox(height: 18),
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
      ),
    );
  }
}
