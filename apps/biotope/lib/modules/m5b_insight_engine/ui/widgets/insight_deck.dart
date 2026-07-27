import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../../core/generated_assets.dart';
import '../../../../core/theme.dart';
import '../../index.dart';
import 'insight_card_visual.dart';

/// Swipeable insight-card deck (drag right = save into Archive, drag left =
/// dismiss). Confidence is shown via [InsightCardVisual.confidenceLabel] —
/// a bucketed category (High/Medium/Low/Building data), never a bare
/// percentage — and the evidence panel reuses [ResearchBasis]/
/// [StillResearchingNote] as-is rather than re-deriving citation rendering.
class InsightDeck extends StatefulWidget {
  final List<InsightCard> cards;
  final Future<void> Function(InsightCard card) onSave;
  final Future<void> Function(InsightCard card) onDismiss;
  final void Function(InsightCard card) onOpenDetail;

  const InsightDeck({
    super.key,
    required this.cards,
    required this.onSave,
    required this.onDismiss,
    required this.onOpenDetail,
  });

  @override
  State<InsightDeck> createState() => _InsightDeckState();
}

class _InsightDeckState extends State<InsightDeck> {
  int _idx = 0;
  double _dx = 0;
  bool _busy = false;

  @override
  void didUpdateWidget(covariant InsightDeck oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.cards.length != oldWidget.cards.length) {
      _idx = _idx.clamp(0, widget.cards.length);
    }
  }

  void _advance() => setState(() {
        _idx += 1;
        _dx = 0;
      });

  Future<void> _save(InsightCard card) async {
    if (_busy) return;
    setState(() => _busy = true);
    await widget.onSave(card);
    if (!mounted) return;
    setState(() => _busy = false);
    _advance();
  }

  Future<void> _dismiss(InsightCard card) async {
    if (_busy) return;
    setState(() => _busy = true);
    await widget.onDismiss(card);
    if (!mounted) return;
    setState(() => _busy = false);
    _advance();
  }

  void _resetDeck() => setState(() => _idx = 0);

  @override
  Widget build(BuildContext context) {
    final left = widget.cards.length - _idx;
    final current = left > 0 ? widget.cards[_idx] : null;
    final next1 = left > 1 ? widget.cards[_idx + 1] : null;
    final next2 = left > 2 ? widget.cards[_idx + 2] : null;

    if (current == null) {
      return _EmptyDeck(hasAnyCards: widget.cards.isNotEmpty, onReplay: _resetDeck);
    }

    return Stack(
      children: [
        if (next2 != null) _GhostCard(opacity: 0.5, inset: 22),
        if (next1 != null) _GhostCard(opacity: 0.8, inset: 11),
        Positioned.fill(
          child: GestureDetector(
            onPanUpdate: (d) => setState(() => _dx += d.delta.dx),
            onPanEnd: (_) {
              final d = _dx;
              if (d > 92) {
                _save(current);
              } else if (d < -92) {
                _dismiss(current);
              } else {
                setState(() => _dx = 0);
              }
            },
            onTap: _busy ? null : () => widget.onOpenDetail(current),
            child: Transform.translate(
              offset: Offset(_dx, 0),
              child: Transform.rotate(
                angle: _dx * 0.00035,
                child: _FrontCard(card: current, dx: _dx),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _GhostCard extends StatelessWidget {
  final double opacity;
  final double inset;
  const _GhostCard({required this.opacity, required this.inset});

  @override
  Widget build(BuildContext context) {
    return Positioned(
      left: inset,
      right: inset,
      top: inset * 0.6,
      bottom: 0,
      child: Opacity(
        opacity: opacity,
        child: Container(
          decoration: BoxDecoration(
            color: OurobionColors.surfaceLowest,
            borderRadius: BorderRadius.circular(kCardRadius),
            border: Border.all(color: OurobionColors.primary.withValues(alpha: 0.3)),
          ),
        ),
      ),
    );
  }
}

class _FrontCard extends StatelessWidget {
  final InsightCard card;
  final double dx;
  const _FrontCard({required this.card, required this.dx});

  @override
  Widget build(BuildContext context) {
    final stampSave = dx > 40;
    final stampDismiss = dx < -40;
    final iconColor = InsightCardVisual.iconColor(card.category);

    return Container(
      decoration: BoxDecoration(
        color: OurobionColors.surfaceLowest,
        borderRadius: BorderRadius.circular(kCardRadius),
        border: Border.all(color: OurobionColors.primary.withValues(alpha: 0.5)),
        boxShadow: [
          BoxShadow(
            color: OurobionColors.primary.withValues(alpha: 0.22),
            blurRadius: 54,
            offset: const Offset(0, 30),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                height: 130,
                width: double.infinity,
                color: InsightCardVisual.iconBg(card.category),
                child: Center(
                  child: Icon(InsightCardVisual.icon(card.category), size: 44, color: iconColor),
                ),
              ),
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 18),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: OurobionColors.surfaceContainer,
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(
                          InsightCardVisual.categoryLabel(card.category),
                          style: GoogleFonts.manrope(
                            fontSize: 9,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 1.4,
                            color: iconColor,
                          ),
                        ),
                      ),
                      const SizedBox(height: 13),
                      Text(
                        card.title,
                        style: GoogleFonts.manrope(
                          fontSize: 19,
                          fontWeight: FontWeight.w600,
                          letterSpacing: -0.4,
                          color: OurobionColors.onSurface,
                        ),
                      ),
                      const SizedBox(height: 9),
                      Text(
                        card.body,
                        style: GoogleFonts.manrope(
                          fontSize: 12.5,
                          height: 1.6,
                          color: OurobionColors.onSurfaceVariant,
                        ),
                      ),
                      if (card.isResearchLinked) ...[
                        const SizedBox(height: 13),
                        ResearchBasis(edgeRefs: card.edgeRefs),
                      ] else if (card.isStillResearching) ...[
                        const SizedBox(height: 13),
                        const StillResearchingNote(),
                      ],
                      const SizedBox(height: 14),
                      Container(height: 1, color: OurobionColors.primary.withValues(alpha: 0.25)),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                            decoration: BoxDecoration(
                              color: OurobionColors.surfaceContainer,
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              InsightCardVisual.confidenceLabel(card.confidenceScore),
                              style: GoogleFonts.manrope(
                                fontSize: 10,
                                fontWeight: FontWeight.w600,
                                color: OurobionColors.onSurfaceVariant,
                              ),
                            ),
                          ),
                          const Spacer(),
                          Text(
                            'Tap for details →',
                            style: GoogleFonts.manrope(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: OurobionColors.primary,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          if (stampSave || stampDismiss)
            Positioned(
              top: 16,
              left: stampDismiss ? 16 : null,
              right: stampSave ? 16 : null,
              child: Opacity(
                opacity: (dx.abs() / 95).clamp(0.0, 1.0),
                child: Transform.rotate(
                  angle: stampSave ? 0.16 : -0.16,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                    decoration: BoxDecoration(
                      border: Border.all(
                        color: stampSave ? OurobionColors.brandGold : const Color(0xFFb26844),
                        width: 2,
                      ),
                      borderRadius: BorderRadius.circular(10),
                      color: Colors.white.withValues(alpha: 0.92),
                    ),
                    child: Text(
                      stampSave ? 'SAVE' : 'DISMISS',
                      style: GoogleFonts.manrope(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 2,
                        color: stampSave ? OurobionColors.brandGoldDark : const Color(0xFF8a4a2c),
                      ),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _EmptyDeck extends StatelessWidget {
  final bool hasAnyCards;
  final VoidCallback onReplay;
  const _EmptyDeck({required this.hasAnyCards, required this.onReplay});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 18),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Image.asset(
              BiotopeGeneratedAssets.emptyInsightsSeedpod,
              width: 126,
              height: 174,
              errorBuilder: (context, error, stack) => const SizedBox(width: 126, height: 174),
            ),
            const SizedBox(height: 20),
            Text(
              InsightCardCopy.allCaughtUpTitle,
              style: GoogleFonts.manrope(
                fontSize: 19,
                fontWeight: FontWeight.w600,
                letterSpacing: -0.4,
                color: OurobionColors.onSurface,
              ),
            ),
            const SizedBox(height: 9),
            Text(
              InsightCardCopy.allCaughtUpBody,
              textAlign: TextAlign.center,
              style: GoogleFonts.manrope(
                fontSize: 13,
                height: 1.6,
                color: OurobionColors.onSurfaceVariant,
              ),
            ),
            if (hasAnyCards) ...[
              const SizedBox(height: 20),
              OutlinedButton(
                onPressed: onReplay,
                child: Text(InsightCardCopy.replayDeck),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
