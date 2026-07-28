import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../../core/generated_assets.dart';
import '../../../../core/theme.dart';
import '../../../../core/widgets/badge_chip.dart';
import '../../../../core/widgets/gold_card.dart';
import '../../../m3_passive_health/index.dart';
import '../../../m3_passive_health/ui/widgets/wearable_sync_row.dart';
import '../../../m5a_baselines/index.dart' show metricDisplayLabel;
import '../../../m6_engagement/index.dart';
import '../../impl/logging_controller.dart';
import '../../impl/normaliser.dart';
import 'daily_log_screen.dart';

enum _SweepState { idle, scanning, done }

/// Every user-facing string the Scan tab's rows and gap cards own.
///
/// Enumerated in one place so the non-diagnostic copy gate can assert over the
/// whole set (test/m2_self_report/scan_tab_copy_gate_test.dart).
abstract final class ScanTabCopy {
  // ── Environmental channel ──────────────────────────────────────────────
  // GAP-CLOSE NOTE — do not "finish" this by wiring the row to a toggle.
  // There is no M4 module, table, edge function or environmental API anywhere
  // in this repo: `modules/m4_environmental/index.dart` is a comment-only stub.
  // A control here would do nothing, so the row states its own status instead
  // and stays inert. Make it live only once a real source exists.
  static const environmentLabel = 'Environment';
  static const environmentStatus = 'Not built';
  static const environmentDetail =
      'No environmental data source is connected, so this channel never '
      'reports in. Your coverage is not affected by it.';
  static const environmentSemanticLabel =
      'Environment channel. Not built: no environmental data source is '
      'connected, so this row does nothing and cannot be switched on.';

  // ── Gap cards ──────────────────────────────────────────────────────────
  static const gapEyebrow = 'SELF-REPORT';
  static const gapAnswerHere = 'Answer here, or open the full log for more.';
  static const gapOpenFullLog = 'Open full log';
  static const gapSaveFailed = 'Could not save that answer. Please try again.';

  /// One-line hint above an inline chip row, per answerable metric.
  static const Map<String, String> inlineHints = {
    'outside_meals': 'Meals eaten out today',
    'energy_score': '1 = drained · 5 = energised',
    'mood_score': '1 = low · 5 = great',
    'gut_comfort_score': '1 = uncomfortable · 5 = comfortable',
  };

  static String gapWeight(int weight) =>
      'Not logged today — worth $weight of your 100 daily points.';

  static final all = <String>[
    environmentLabel,
    environmentStatus,
    environmentDetail,
    environmentSemanticLabel,
    gapEyebrow,
    gapAnswerHere,
    gapOpenFullLog,
    gapSaveFailed,
    ...inlineHints.values,
    // The weight sentence is templated, so gate a representative rendering
    // rather than the format string.
    gapWeight(25),
  ];
}

/// Coverage-sweep screen — new concept, no direct real-infra precedent. Built
/// on top of two real signals: [kDailyCoreDqsWeights] (the T1 daily-core keys
/// that already drive log_completeness) and [WearableService.syncToday] (only
/// ever called from the explicit "Run sweep" tap here, never on screen load —
/// see wearable_sync_row.dart for why).
///
/// Two deliberate honesty choices live here:
///  - [EnvironmentRow] is inert and says so. `m4_environmental` is a
///    comment-only stub with no service, table or API behind it, so the row
///    labels the absence rather than rendering a control that does nothing.
///  - [GapCard] answers inline only for [kInlineAnswerableOptions] keys, and
///    writes through [DailyLogService.saveFieldAnswer] — a targeted UPDATE of
///    the one answered column. It must never go through `saveDailyLog`, whose
///    whole-row upsert would null out every other field logged today.
class ScanTab extends StatefulWidget {
  const ScanTab({super.key});

  @override
  State<ScanTab> createState() => _ScanTabState();
}

class _ScanTabState extends State<ScanTab> with SingleTickerProviderStateMixin {
  late final AnimationController _sweepAnim;
  _SweepState _state = _SweepState.idle;
  Map<String, dynamic>? _todayRow;
  WearableReading? _wearableReading;
  bool _hasSweptThisSession = false;

  /// Metric keys with an inline write in flight — one card can be saving while
  /// the others stay tappable.
  final Set<String> _savingKeys = <String>{};

  @override
  void initState() {
    super.initState();
    _sweepAnim = AnimationController(vsync: this, duration: const Duration(seconds: 3));
    _loadQuiet();
  }

  @override
  void dispose() {
    _sweepAnim.dispose();
    super.dispose();
  }

  String get _today {
    final d = DateTime.now();
    return '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
  }

  /// Passive re-fetch of today's self-report row only — never triggers the
  /// wearable OS permission prompt. Used on first render and after returning
  /// from DailyLogScreen.
  Future<void> _loadQuiet() async {
    final client = Supabase.instance.client;
    final userId = client.auth.currentUser!.id;
    final row = await DailyLogService(client).getTodayLog(userId, _today);
    if (!mounted) return;
    setState(() => _todayRow = row);
  }

  List<String> get _missingKeys {
    final row = _todayRow;
    return kDailyCoreDqsWeights.keys.where((k) => row == null || row[k] == null).toList();
  }

  int get _coverage {
    final v = (_todayRow?['log_completeness'] as num?)?.round();
    return v ?? 0;
  }

  Future<void> _runSweep() async {
    setState(() => _state = _SweepState.scanning);
    _sweepAnim.repeat();

    final client = Supabase.instance.client;
    final userId = client.auth.currentUser!.id;

    final results = await Future.wait<dynamic>([
      DailyLogService(client).getTodayLog(userId, _today),
      WearableService(client).syncToday(userId),
      Future.delayed(const Duration(milliseconds: 2400)),
    ]);

    if (!mounted) return;
    _sweepAnim.stop();
    setState(() {
      _todayRow = results[0] as Map<String, dynamic>?;
      _wearableReading = results[1] as WearableReading?;
      _hasSweptThisSession = true;
      _state = _SweepState.done;
    });
  }

  /// Full-form route. Still the only path for anything a chip cannot express
  /// (urine colour, stool form, mosquito bites) and always available as an
  /// escape hatch from a chip-answerable card.
  Future<void> _openGap(String key) async {
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => const DailyLogScreen()),
    );
    await _loadQuiet();
  }

  /// Inline chip answer — a targeted single-column UPDATE, never the whole-row
  /// upsert (see [DailyLogService.saveFieldAnswer]).
  Future<void> _answerInline(String key, int value) async {
    if (_savingKeys.contains(key)) return;
    setState(() => _savingKeys.add(key));
    final messenger = ScaffoldMessenger.of(context);
    try {
      final client = Supabase.instance.client;
      final userId = client.auth.currentUser!.id;
      final completeness =
          await DailyLogService(client).saveFieldAnswer(userId, _today, key, value);
      // Same streak/DQS bookkeeping DailyLogScreen does on save, so a coverage
      // change made here is not invisible to M6.
      await EngagementService(client)
          .updateOnLogWrite(userId, _today, completeness);
      await _loadQuiet();
    } catch (_) {
      if (!mounted) return;
      messenger.showSnackBar(
        SnackBar(
          content: Text(
            ScanTabCopy.gapSaveFailed,
            style: GoogleFonts.manrope(fontWeight: FontWeight.w600),
          ),
          backgroundColor: Theme.of(context).colorScheme.error,
          behavior: SnackBarBehavior.floating,
          margin: const EdgeInsets.all(16),
        ),
      );
    } finally {
      if (mounted) setState(() => _savingKeys.remove(key));
    }
  }

  @override
  Widget build(BuildContext context) {
    final missing = _missingKeys;
    final dialSize = _state == _SweepState.done ? 190.0 : 262.0;

    return Scaffold(
      backgroundColor: OurobionColors.background,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(24, 24, 24, 110),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'SYSTEM SWEEP',
                style: GoogleFonts.manrope(
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.6,
                  color: OurobionColors.primary,
                ),
              ),
              const SizedBox(height: 9),
              Text(
                'Scan',
                style: GoogleFonts.manrope(
                  fontSize: 27,
                  fontWeight: FontWeight.w600,
                  letterSpacing: -0.7,
                  color: OurobionColors.onSurface,
                ),
              ),
              const SizedBox(height: 24),

              Center(
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 420),
                  curve: const Cubic(0.2, 0, 0, 1),
                  width: dialSize,
                  height: dialSize,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: RadialGradient(
                      colors: [Colors.white, OurobionColors.primaryContainer.withValues(alpha: 0.6)],
                    ),
                    border: Border.all(color: OurobionColors.primary.withValues(alpha: 0.6)),
                    boxShadow: [
                      BoxShadow(
                        color: OurobionColors.primary.withValues(alpha: 0.28),
                        blurRadius: 56,
                        offset: const Offset(0, 28),
                      ),
                    ],
                  ),
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      ClipOval(
                        child: Image.asset(
                          BiotopeGeneratedAssets.scanCircularBloom,
                          fit: BoxFit.cover,
                          width: double.infinity,
                          height: double.infinity,
                          errorBuilder: (context, error, stack) => const SizedBox.shrink(),
                        ),
                      ),
                      if (_state == _SweepState.scanning)
                        AnimatedBuilder(
                          animation: _sweepAnim,
                          builder: (context, child) {
                            return Align(
                              alignment: Alignment(0, -1 + _sweepAnim.value * 3.4),
                              child: Container(
                                height: dialSize * 0.34,
                                width: dialSize,
                                decoration: BoxDecoration(
                                  gradient: LinearGradient(
                                    begin: Alignment.topCenter,
                                    end: Alignment.bottomCenter,
                                    colors: [
                                      OurobionColors.primary.withValues(alpha: 0),
                                      OurobionColors.primary.withValues(alpha: 0.4),
                                      OurobionColors.primary.withValues(alpha: 0),
                                    ],
                                  ),
                                ),
                              ),
                            );
                          },
                        ),
                      if (_state == _SweepState.done)
                        Container(
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: Colors.white.withValues(alpha: 0.9),
                          ),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                'COVERAGE',
                                style: GoogleFonts.manrope(
                                  fontSize: 9,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: 1.5,
                                  color: OurobionColors.brandGoldLight,
                                ),
                              ),
                              const SizedBox(height: 7),
                              Text(
                                '$_coverage%',
                                style: GoogleFonts.manrope(
                                  fontSize: 34,
                                  fontWeight: FontWeight.w600,
                                  letterSpacing: -1.2,
                                  color: OurobionColors.brandGoldDark,
                                ),
                              ),
                              const SizedBox(height: 7),
                              Text(
                                missing.isEmpty
                                    ? 'All channels in'
                                    : '${missing.length} channel${missing.length == 1 ? '' : 's'} open',
                                style: GoogleFonts.manrope(
                                  fontSize: 10.5,
                                  fontWeight: FontWeight.w600,
                                  color: OurobionColors.onSurfaceVariant,
                                ),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
              ),

              const SizedBox(height: 22),
              Center(
                child: Column(
                  children: [
                    Text(
                      switch (_state) {
                        _SweepState.scanning => 'Sweeping your channels',
                        _SweepState.done =>
                          missing.isEmpty ? 'Nothing missing' : 'Gaps found',
                        _SweepState.idle => 'Ready to sweep',
                      },
                      style: GoogleFonts.manrope(
                        fontSize: 18,
                        fontWeight: FontWeight.w600,
                        letterSpacing: -0.3,
                        color: OurobionColors.onSurface,
                      ),
                    ),
                    const SizedBox(height: 9),
                    Text(
                      switch (_state) {
                        _SweepState.scanning =>
                          'Comparing wearable and self-report streams against today’s expected set.',
                        _SweepState.done => missing.isEmpty
                            ? 'Every expected channel has reported in for today.'
                            : 'These self-report channels are still open — log them and your coverage updates immediately.',
                        _SweepState.idle =>
                          'Checks which channels are missing today, then surfaces only what’s worth filling in.',
                      },
                      textAlign: TextAlign.center,
                      style: GoogleFonts.manrope(
                        fontSize: 13,
                        height: 1.6,
                        color: OurobionColors.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),

              if (_state == _SweepState.idle) ...[
                const SizedBox(height: 20),
                WearableSyncRow(reading: _wearableReading, hasSyncedThisSession: _hasSweptThisSession),
                const SizedBox(height: 9),
                _SelfReportRow(logged: _todayRow != null),
                const SizedBox(height: 9),
                const EnvironmentRow(),
              ],

              const SizedBox(height: 24),
              FilledButton(
                onPressed: _state == _SweepState.scanning ? null : _runSweep,
                child: Text(
                  _state == _SweepState.scanning
                      ? 'Sweeping…'
                      : _state == _SweepState.done
                          ? 'Run sweep again'
                          : 'Run sweep',
                ),
              ),

              if (_state == _SweepState.done) ...[
                const SizedBox(height: 26),
                if (missing.isEmpty)
                  Center(
                    child: Column(
                      children: [
                        Image.asset(
                          BiotopeGeneratedAssets.emptyScanBloom,
                          width: 120,
                          height: 120,
                          errorBuilder: (context, error, stack) => const SizedBox(width: 120, height: 120),
                        ),
                        const SizedBox(height: 14),
                        Text(
                          'Today is fully captured',
                          style: GoogleFonts.manrope(
                            fontSize: 17,
                            fontWeight: FontWeight.w600,
                            color: OurobionColors.onSurface,
                          ),
                        ),
                      ],
                    ),
                  )
                else ...[
                  Row(
                    children: [
                      Text(
                        'NEEDS YOU · ${missing.length}',
                        style: GoogleFonts.manrope(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 1.6,
                          color: OurobionColors.primary,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 13),
                  for (final key in missing) ...[
                    GapCard(
                      metricKey: key,
                      weight: kDailyCoreDqsWeights[key]!,
                      inlineOptions: kInlineAnswerableOptions[key],
                      saving: _savingKeys.contains(key),
                      onAnswer: (value) => _answerInline(key, value),
                      onOpenFullLog: () => _openGap(key),
                    ),
                    const SizedBox(height: 11),
                  ],
                ],
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _SelfReportRow extends StatelessWidget {
  final bool logged;
  const _SelfReportRow({required this.logged});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 13),
      decoration: BoxDecoration(
        color: OurobionColors.surfaceLowest.withValues(alpha: 0.8),
        border: Border.all(color: OurobionColors.primary.withValues(alpha: 0.4)),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          Container(
            width: 7,
            height: 7,
            decoration: BoxDecoration(
              color: logged ? OurobionColors.deltaPositive : OurobionColors.brandGold,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 11),
          Expanded(
            child: Text(
              'Self-report',
              style: GoogleFonts.manrope(
                fontSize: 12.5,
                fontWeight: FontWeight.w600,
                color: OurobionColors.onSurface,
              ),
            ),
          ),
          Text(
            logged ? 'Logged today' : 'Gaps likely',
            style: GoogleFonts.manrope(
              fontSize: 10.5,
              fontWeight: FontWeight.w500,
              color: OurobionColors.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }
}

/// The environmental channel's row — permanently inert, and explicit about it.
///
/// This is a gap that is LABELLED, not filled. There is no `m4_environmental`
/// service, model, table, edge function or environmental API in this repo — the
/// module is a comment-only stub — so there is nothing a switch here could
/// toggle. Rather than render a dead control (or a "Coming soon" badge that
/// promises a date nobody has set), the row states what is missing and why the
/// user's coverage is unaffected.
///
/// It has no `onTap`, no `GestureDetector` and no focusable descendant, and is
/// exposed to assistive tech as a single disabled node.
class EnvironmentRow extends StatelessWidget {
  const EnvironmentRow({super.key});

  @override
  Widget build(BuildContext context) {
    return Semantics(
      container: true,
      enabled: false,
      label: ScanTabCopy.environmentSemanticLabel,
      child: ExcludeSemantics(
        child: Opacity(
          opacity: 0.55,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 13),
            decoration: BoxDecoration(
              color: OurobionColors.surfaceLowest.withValues(alpha: 0.6),
              border: Border.all(color: OurobionColors.outlineVariant),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.public_outlined,
                        size: 16, color: OurobionColors.outline),
                    const SizedBox(width: 11),
                    Expanded(
                      child: Text(
                        ScanTabCopy.environmentLabel,
                        style: GoogleFonts.manrope(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w600,
                          color: OurobionColors.onSurfaceVariant,
                        ),
                      ),
                    ),
                    const BadgeChip.disabled(
                      label: ScanTabCopy.environmentStatus,
                    ),
                  ],
                ),
                const SizedBox(height: 7),
                Text(
                  ScanTabCopy.environmentDetail,
                  style: GoogleFonts.manrope(
                    fontSize: 11,
                    height: 1.45,
                    color: OurobionColors.outline,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// One missing daily-core channel.
///
/// When [inlineOptions] is non-null the card answers in place: each chip calls
/// [onAnswer], which the tab routes to [DailyLogService.saveFieldAnswer] — a
/// targeted UPDATE of that one column. When it is null (urine colour, stool
/// form, mosquito bites: values a chip row cannot express without narrowing
/// them) the card is a plain tap-through to the full log. Either way
/// [onOpenFullLog] stays reachable.
class GapCard extends StatelessWidget {
  final String metricKey;
  final int weight;

  /// Chip values this card can answer in place, or null if the metric must be
  /// answered on the full form. Sourced from [kInlineAnswerableOptions].
  final List<int>? inlineOptions;
  final ValueChanged<int> onAnswer;
  final VoidCallback onOpenFullLog;
  final bool saving;

  const GapCard({
    super.key,
    required this.metricKey,
    required this.weight,
    required this.onAnswer,
    required this.onOpenFullLog,
    this.inlineOptions,
    this.saving = false,
  });

  @override
  Widget build(BuildContext context) {
    final options = inlineOptions;
    return GoldCard(
      // With chips present the card must not swallow their taps behind a
      // whole-card gesture; the explicit "Open full log" button carries the
      // route instead.
      onTap: options == null ? onOpenFullLog : null,
      padding: const EdgeInsets.fromLTRB(16, 15, 16, 15),
      radius: 20,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: OurobionColors.surfaceContainer,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: OurobionColors.primary.withValues(alpha: 0.6)),
            ),
            child: const Center(
              child: SizedBox(
                width: 9,
                height: 9,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: OurobionColors.brandGold,
                    shape: BoxShape.circle,
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  ScanTabCopy.gapEyebrow,
                  style: GoogleFonts.manrope(
                    fontSize: 9,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.4,
                    color: OurobionColors.brandGoldLight,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  metricDisplayLabel(metricKey),
                  style: GoogleFonts.manrope(
                    fontSize: 14.5,
                    fontWeight: FontWeight.w600,
                    color: OurobionColors.onSurface,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  ScanTabCopy.gapWeight(weight),
                  style: GoogleFonts.manrope(
                    fontSize: 11.5,
                    height: 1.5,
                    color: OurobionColors.onSurfaceVariant,
                  ),
                ),
                if (options != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    ScanTabCopy.gapAnswerHere,
                    style: GoogleFonts.manrope(
                      fontSize: 11.5,
                      height: 1.5,
                      color: OurobionColors.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    ScanTabCopy.inlineHints[metricKey] ?? '',
                    style: GoogleFonts.manrope(
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                      color: OurobionColors.outline,
                    ),
                  ),
                  const SizedBox(height: 7),
                  _InlineChipRow(
                    metricKey: metricKey,
                    options: options,
                    saving: saving,
                    onAnswer: onAnswer,
                  ),
                  const SizedBox(height: 4),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: TextButton(
                      onPressed: saving ? null : onOpenFullLog,
                      style: TextButton.styleFrom(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 4, vertical: 4),
                        minimumSize: Size.zero,
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      ),
                      child: Text(
                        ScanTabCopy.gapOpenFullLog,
                        style: GoogleFonts.manrope(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w600,
                          color: OurobionColors.primary,
                        ),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// The chips themselves. Each is a real button node for assistive tech, and
/// the whole row goes inert while a write is in flight so a double tap cannot
/// queue two answers for the same column.
class _InlineChipRow extends StatelessWidget {
  final String metricKey;
  final List<int> options;
  final bool saving;
  final ValueChanged<int> onAnswer;

  const _InlineChipRow({
    required this.metricKey,
    required this.options,
    required this.saving,
    required this.onAnswer,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        for (var i = 0; i < options.length; i++)
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(right: i < options.length - 1 ? 6 : 0),
              child: Semantics(
                container: true,
                button: true,
                enabled: !saving,
                label: '${metricDisplayLabel(metricKey)} ${options[i]}',
                // Routed explicitly rather than inherited: the visual subtree
                // is semantically excluded so the node reads as "Mood score 4"
                // instead of a bare "4", and excluding it would otherwise take
                // the GestureDetector's tap action with it.
                onTap: saving ? null : () => onAnswer(options[i]),
                child: ExcludeSemantics(
                  child: GestureDetector(
                    onTap: saving ? null : () => onAnswer(options[i]),
                    child: Container(
                      height: 36,
                      decoration: BoxDecoration(
                        color: OurobionColors.surfaceContainer,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                          color: OurobionColors.primary.withValues(alpha: 0.35),
                        ),
                      ),
                      child: Center(
                        child: Text(
                          '${options[i]}',
                          style: GoogleFonts.manrope(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: saving
                                ? OurobionColors.outlineVariant
                                : OurobionColors.onSurface,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}
