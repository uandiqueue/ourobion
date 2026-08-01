import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../../../core/theme.dart';
import '../../index.dart';
import '../widgets/insight_deck.dart';
import 'insight_provenance_screen.dart';

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
