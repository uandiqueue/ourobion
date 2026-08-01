import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../../../core/theme.dart';
import '../../index.dart';
import '../widgets/insight_deck.dart';
import 'insight_provenance_screen.dart';

/// User-facing copy this tab owns directly. Public so the copy gate test can run
/// every string through the shared non-diagnostic validator
/// (shared/constants/copy_guidelines.dart) — same pattern as `ArchiveTabCopy`
/// and `InsightCardCopy`.
abstract final class InsightsTabCopy {
  /// The deck-reset affordance. Named for the window it actually restores —
  /// a card's `expires_at` is its serving window and the engine's is a week —
  /// rather than for "everything", which it is not.
  static const resetTooltip = "Bring back this week's cards";
  static const resetTitle = "Bring back this week's cards?";

  /// Confirmation body. Three things it has to be straight about, because all
  /// three surprise people: saved cards come back too (and so leave the
  /// archive), cards past their window do not come back, and nothing new is
  /// made — this only un-holds cards you already had.
  static const resetBody =
      'Every card from this week that you swiped away or saved goes back to '
      'your deck. Saved ones leave your archive until you save them again. '
      'Cards past their window stay out, and no new cards are made.';
  static const resetConfirm = 'Bring them back';
  static const resetCancel = 'Cancel';

  /// Nothing matched the filter — no rows were written. Says that, rather than
  /// reporting a success that did not happen.
  static const resetNone = 'There are no cards from this week to bring back.';
  static const resetFailed =
      'Your cards could not be brought back right now — check your connection and try again.';

  /// Reports the rows that actually moved, straight from the update's own
  /// response — never an assumed or predicted number.
  static String resetDone(int count) => count == 1
      ? '1 card is back in your deck.'
      : '$count cards are back in your deck.';

  static const all = [
    resetTooltip,
    resetTitle,
    resetBody,
    resetConfirm,
    resetCancel,
    resetNone,
    resetFailed,
  ];

  /// [resetDone] is a function, so the gate test cannot read it off [all].
  /// Both branches are listed here and gated alongside the constants.
  static final allGenerated = [resetDone(1), resetDone(4)];
}

class InsightsTab extends StatefulWidget {
  /// [service] / [userId] are injectable for widget tests only — production
  /// passes neither and falls back to `Supabase.instance`, which cannot be
  /// touched under `flutter test` (no initialize). Same seam as
  /// InsightProvenanceScreen's.
  const InsightsTab({
    super.key,
    this.service,
    this.provenanceService,
    this.userId,
  });

  final InsightService? service;
  final ProvenanceService? provenanceService;
  final String? userId;

  @override
  State<InsightsTab> createState() => _InsightsTabState();
}

class _InsightsTabState extends State<InsightsTab> {
  late final InsightService _service;
  late final ProvenanceService? _provenanceService;
  List<InsightCard> _cards = [];
  int _savedCount = 0;
  bool _loading = true;

  /// A reset is in flight. Disables the affordance so a double tap cannot queue
  /// a second bulk update over rows the first one is already moving.
  bool _resetting = false;

  @override
  void initState() {
    super.initState();
    _service = widget.service ?? InsightService(Supabase.instance.client);
    _provenanceService =
        widget.provenanceService ??
        (widget.service == null
            ? ProvenanceService(Supabase.instance.client)
            : null);
    _load();
  }

  String get _uid =>
      widget.userId ?? Supabase.instance.client.auth.currentUser!.id;

  /// Reads both halves of this screen from Supabase: the servable deck and the
  /// true archived-row count behind the SAVED header. Also the deck's replay
  /// handler — see [InsightDeck.onReplay].
  Future<void> _load() async {
    try {
      final userId = _uid;
      final results = await Future.wait([
        _service.getInsights(userId),
        _service.getArchivedInsights(userId),
      ]);
      if (!mounted) return;
      setState(() {
        _cards = results[0];
        _savedCount = results[1].length;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  /// Swipe-right = "keep this". Writes the real [InsightStatus.archived] — it
  /// used to write `snoozed` as a stand-in (no `archived` value existed before
  /// migration 20260728040000).
  Future<void> _save(InsightCard card) async {
    await _service.updateStatus(card.id, InsightStatus.archived);
    await _refreshSavedCount();
  }

  /// Re-reads the archived rows rather than incrementing a local counter.
  ///
  /// `_savedCount += 1` drifted above the truth within a single session: the
  /// status write is an idempotent UPDATE, so saving a card that already reads
  /// `archived` changes no row — but the counter went up anyway. The header
  /// says SAVED, so it has to mean "rows in the archive", which only
  /// [InsightService.getArchivedInsights] knows.
  Future<void> _refreshSavedCount() async {
    try {
      final archived = await _service.getArchivedInsights(_uid);
      if (!mounted) return;
      setState(() => _savedCount = archived.length);
    } catch (_) {
      // Keep the last count that came from the backend. Falling back to a
      // local increment here would reintroduce exactly the drift this replaces.
    }
  }

  Future<void> _dismiss(InsightCard card) async {
    await _service.updateStatus(card.id, InsightStatus.dismissed);
  }

  /// Returns this period's held cards to the deck, after confirming.
  ///
  /// This exists because swipe-left was a one-way door. `dismissed` is servable
  /// nowhere — not the deck, not the Archive tab — and generate-insights counts
  /// it in `dismissedSkipped`, so the nightly pass does not bring it back
  /// either. Recovering a wrongly-dismissed card meant writing to the database
  /// by hand. This is the in-app way back.
  ///
  /// It is deliberately a USER action only. The pipeline's `dismissedSkipped`
  /// behaviour is untouched: the engine still never resurrects a dismissed
  /// card on its own.
  ///
  /// Scope, confirmation and the no-insert guarantee all live in
  /// [InsightService.resetCurrentPeriodDeck]; this method owns the confirm step
  /// and reporting the true number of rows the update returned.
  Future<void> _confirmResetDeck() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(
          InsightsTabCopy.resetTitle,
          style: GoogleFonts.manrope(fontWeight: FontWeight.w600),
        ),
        content: Text(
          InsightsTabCopy.resetBody,
          style: GoogleFonts.manrope(
            fontSize: 13,
            height: 1.5,
            color: OurobionColors.onSurfaceVariant,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text(InsightsTabCopy.resetCancel),
          ),
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: Text(
              InsightsTabCopy.resetConfirm,
              style: GoogleFonts.manrope(),
            ),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    final messenger = ScaffoldMessenger.of(context);
    setState(() => _resetting = true);
    List<InsightCard> restored;
    try {
      restored = await _service.resetCurrentPeriodDeck(_uid);
    } catch (_) {
      if (!mounted) return;
      setState(() => _resetting = false);
      messenger.showSnackBar(
        const SnackBar(content: Text(InsightsTabCopy.resetFailed)),
      );
      return;
    }
    // Re-read both halves: the restored rows left the archive, so the SAVED
    // header moved too. `_load()` is the only thing that knows either number.
    await _load();
    if (!mounted) return;
    setState(() => _resetting = false);
    messenger.showSnackBar(
      SnackBar(
        content: Text(
          restored.isEmpty
              ? InsightsTabCopy.resetNone
              : InsightsTabCopy.resetDone(restored.length),
        ),
      ),
    );
  }

  /// Demo main-loop step 5: tapping a card opens its provenance detail.
  void _openProvenance(InsightCard card) {
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
              padding: const EdgeInsets.fromLTRB(24, 24, 24, 0),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'DISCOVERY',
                          style: GoogleFonts.manrope(
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 1.6,
                            color: OurobionColors.primary,
                          ),
                        ),
                        const SizedBox(height: 9),
                        Text(
                          'Insights',
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
                  // Lives in the header, not in the empty-deck state: the
                  // incident that needed it left two cards in the deck, so an
                  // empty-only affordance would not have been reachable.
                  IconButton(
                    onPressed: _resetting ? null : _confirmResetDeck,
                    tooltip: InsightsTabCopy.resetTooltip,
                    visualDensity: VisualDensity.compact,
                    icon: const Icon(
                      Icons.restore_rounded,
                      size: 21,
                      color: OurobionColors.primary,
                    ),
                  ),
                  const SizedBox(width: 6),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        'SAVED',
                        style: GoogleFonts.manrope(
                          fontSize: 9,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 1.4,
                          color: OurobionColors.brandGoldLight,
                        ),
                      ),
                      const SizedBox(height: 7),
                      Text(
                        '$_savedCount',
                        style: GoogleFonts.manrope(
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                          color: OurobionColors.primary,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator())
                  : Padding(
                      padding: const EdgeInsets.fromLTRB(15, 0, 15, 20),
                      child: InsightDeck(
                        cards: _cards,
                        onSave: _save,
                        onDismiss: _dismiss,
                        onOpenDetail: _openProvenance,
                        loadProvenance: _provenanceService?.getProvenance,
                        // The empty-deck action re-reads Supabase; it must not
                        // rewind a local index over already-held cards.
                        onReplay: _load,
                      ),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
