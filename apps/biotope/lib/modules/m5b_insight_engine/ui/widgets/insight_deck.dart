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

  /// Re-read the servable set from the backend. Required, not optional: the
  /// empty-deck action MUST go back to `insight_cards` rather than rewind a
  /// local index, or it resurrects cards whose row already reads
  /// `archived`/`dismissed` and presents them as fresh (see [_resetDeck]).
  final Future<void> Function() onReplay;

  const InsightDeck({
    super.key,
    required this.cards,
    required this.onSave,
    required this.onDismiss,
    required this.onOpenDetail,
    required this.onReplay,
  });

  @override
  State<InsightDeck> createState() => _InsightDeckState();
}

class _InsightDeckState extends State<InsightDeck>
    with TickerProviderStateMixin {
  int _idx = 0;
  double _dx = 0;
  bool _busy = false;
  late final AnimationController _settleController;
  late final AnimationController _exitController;
  Animation<double>? _settle;
  double _exitStart = 0;
  int _exitDirection = 0;

  @override
  void initState() {
    super.initState();
    _settleController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 260),
    );
    _exitController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 260),
    );
  }

  @override
  void dispose() {
    _settleController.dispose();
    _exitController.dispose();
    super.dispose();
  }

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
        _exitController.reset();
        _settleController.reset();
      });

  Future<void> _save(InsightCard card) async {
    if (_busy) return;
    setState(() => _busy = true);
    await Future.wait([
      widget.onSave(card),
      _animateAcceptedExit(1),
    ]);
    if (!mounted) return;
    setState(() => _busy = false);
    _advance();
  }

  Future<void> _dismiss(InsightCard card) async {
    if (_busy) return;
    setState(() => _busy = true);
    await Future.wait([
      widget.onDismiss(card),
      _animateAcceptedExit(-1),
    ]);
    if (!mounted) return;
    setState(() => _busy = false);
    _advance();
  }

  /// Re-reads the deck from the backend instead of rewinding [_idx].
  ///
  /// Rewinding the index was a lie about state: every card the user had just
  /// swiped already carried `status = archived` or `dismissed` in
  /// `insight_cards`, and none of them was servable any more — yet they came
  /// back looking like fresh, swipeable insights, and swiping them again wrote
  /// the same status a second time. [InsightService.getInsights] is the only
  /// thing that knows what is still `active` and unexpired, so ask it.
  ///
  /// Order matters: await the re-read FIRST, then zero the index against the
  /// list that came back.
  Future<void> _resetDeck() async {
    if (_busy) return;
    setState(() => _busy = true);
    await widget.onReplay();
    if (!mounted) return;
    setState(() {
      _busy = false;
      _idx = 0;
      _dx = 0;
    });
  }

  /// A rejected drag settles exactly like the HTML deck rather than snapping
  /// back in a single frame. Reduced-motion retains the instant stable state.
  void _settleBack(BuildContext context) {
    if (MediaQuery.maybeDisableAnimationsOf(context) ?? false) {
      setState(() => _dx = 0);
      return;
    }
    _settle = Tween<double>(begin: _dx, end: 0).animate(
      CurvedAnimation(parent: _settleController, curve: Curves.easeOutCubic),
    );
    _settleController.forward(from: 0).whenComplete(() {
      if (mounted) setState(() => _dx = 0);
    });
    setState(() {});
  }

  /// The status write remains exactly the existing callback. This only gives
  /// an accepted gesture a short physical exit while that callback resolves.
  Future<void> _animateAcceptedExit(int direction) async {
    if (MediaQuery.maybeDisableAnimationsOf(context) ?? false) return;
    setState(() {
      _exitStart = _dx;
      _exitDirection = direction;
    });
    await _exitController.forward(from: 0);
  }

  double get _displayDx {
    if (_exitController.isAnimating || _exitController.isCompleted) {
      final progress = Curves.easeInCubic.transform(_exitController.value);
      return _exitStart + (_exitDirection * 520 * progress);
    }
    return _settleController.isAnimating ? _settle!.value : _dx;
  }

  @override
  Widget build(BuildContext context) {
    final left = widget.cards.length - _idx;
    final current = left > 0 ? widget.cards[_idx] : null;
    final next1 = left > 1 ? widget.cards[_idx + 1] : null;
    final next2 = left > 2 ? widget.cards[_idx + 2] : null;

    if (current == null) {
      return _EmptyDeck(
        hasAnyCards: widget.cards.isNotEmpty,
        onReplay: _busy ? null : _resetDeck,
      );
    }

    return AnimatedBuilder(
      animation: Listenable.merge([_settleController, _exitController]),
      builder: (context, _) {
        final dx = _displayDx;
        return Stack(
          children: [
            if (next2 != null) _GhostCard(opacity: 0.46, inset: 20),
            if (next1 != null) _GhostCard(opacity: 0.78, inset: 10),
            Positioned.fill(
              child: GestureDetector(
                onPanUpdate: _busy
                    ? null
                    : (d) => setState(() => _dx += d.delta.dx),
                onPanEnd: _busy
                    ? null
                    : (_) {
                        final d = _dx;
                        if (d > 92) {
                          _save(current);
                        } else if (d < -92) {
                          _dismiss(current);
                        } else {
                          _settleBack(context);
                        }
                      },
                onTap: _busy ? null : () => widget.onOpenDetail(current),
                child: Transform.translate(
                  offset: Offset(dx, 0),
                  child: Transform.rotate(
                    angle: dx * 0.00035,
                    child: _FrontCard(card: current, dx: dx),
                  ),
                ),
              ),
            ),
          ],
        );
      },
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
              SizedBox(
                height: 208,
                width: double.infinity,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    Image.asset(
                      InsightCardVisual.artwork(card.category),
                      fit: BoxFit.cover,
                      alignment: Alignment.center,
                      errorBuilder: (context, error, stack) => Container(
                        color: InsightCardVisual.iconBg(card.category),
                        child: Icon(
                          InsightCardVisual.icon(card.category),
                          size: 44,
                          color: iconColor,
                        ),
                      ),
                    ),
                    DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [
                            Colors.white.withValues(alpha: 0.05),
                            OurobionColors.onSurface.withValues(alpha: 0.20),
                          ],
                        ),
                      ),
                    ),
                    Positioned(
                      left: 16,
                      bottom: 14,
                      child: Container(
                        width: 38,
                        height: 38,
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.88),
                          borderRadius: BorderRadius.circular(13),
                          border: Border.all(
                            color: OurobionColors.primary.withValues(alpha: 0.45),
                          ),
                        ),
                        child: Icon(
                          InsightCardVisual.icon(card.category),
                          size: 20,
                          color: iconColor,
                        ),
                      ),
                    ),
                  ],
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

  /// Null while a re-read is in flight — the button must not queue a second one.
  final VoidCallback? onReplay;
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
