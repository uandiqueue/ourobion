import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../../core/generated_assets.dart';
import '../../../../core/theme.dart';
import '../../../../core/widgets/badge_chip.dart';
import '../../../../core/widgets/gold_card.dart';
import '../../../m3_passive_health/index.dart';
import '../../../m5a_baselines/index.dart' show metricDisplayLabel;
import '../../../m6_engagement/index.dart';
import '../../impl/logging_controller.dart';
import '../../impl/normaliser.dart';

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
  static const gapAnswerHere = 'Choose the closest value for today.';
  static const gapSaveFailed = 'Could not save that answer. Please try again.';
  static const gapLogged = 'LOGGED';
  static const gapChange = 'Change';
  static const gapSaving = 'Saving…';
  static const gapSaved = 'Saved to today’s self-report.';

  /// One-line hint above an inline chip row, per answerable metric.
  static const Map<String, String> inlineHints = {
    'urine_colour': 'Armstrong scale · 1 = very pale · 8 = dark brown',
    'stool_form': 'Bristol scale · 1 = firm pieces · 7 = watery',
    'outside_meals': 'Meals eaten out today',
    'mosquito_bites': 'Number of bites noticed today',
    'energy_score': '1 = drained · 5 = energised',
    'mood_score': '1 = low · 5 = great',
    'gut_comfort_score': '1 = uncomfortable · 5 = comfortable',
  };

  static const _urineLabels = [
    'Very pale',
    'Pale yellow',
    'Yellow',
    'Dark yellow',
    'Amber',
    'Dark amber',
    'Orange-brown',
    'Dark brown',
  ];

  static const _stoolLabels = [
    'Separate firm pieces',
    'Lumpy',
    'Cracked',
    'Smooth',
    'Soft blobs',
    'Fluffy pieces',
    'Watery',
  ];

  static String answerLabel(String metricKey, int value) => switch (metricKey) {
    'urine_colour' => '$value · ${_urineLabels[value - 1]}',
    'stool_form' => 'Type $value · ${_stoolLabels[value - 1]}',
    'outside_meals' => '$value meal${value == 1 ? '' : 's'} out',
    'mosquito_bites' => '$value bite${value == 1 ? '' : 's'}',
    _ => '$value / 5',
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
    gapLogged,
    gapChange,
    gapSaving,
    gapSaved,
    gapSaveFailed,
    ...inlineHints.values,
    ..._urineLabels,
    ..._stoolLabels,
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
///  - [GapCard] answers every daily-core scalar inline from the complete
///    [kInlineAnswerableOptions] domain, and
///    writes through [DailyLogService.saveFieldAnswer] — a targeted UPDATE of
///    the one answered column. It must never go through `saveDailyLog`, whose
///    whole-row upsert would null out every other field logged today.
class ScanTab extends StatefulWidget {
  /// The optional callbacks make the stateful tab testable without a global
  /// Supabase singleton. Production supplies none and retains the normal
  /// service-backed paths below; tests inject only deterministic equivalents
  /// for those same reads/writes.
  final Future<Map<String, dynamic>?> Function()? loadToday;
  final Future<WearableReading?> Function()? syncWearable;
  final Future<double> Function(String metricKey, int value)? saveFieldAnswer;
  final Future<void> Function(double completeness)? updateEngagement;
  final Duration sweepFloor;

  const ScanTab({
    super.key,
    this.loadToday,
    this.syncWearable,
    this.saveFieldAnswer,
    this.updateEngagement,
    this.sweepFloor = const Duration(milliseconds: 2400),
  });

  @override
  State<ScanTab> createState() => _ScanTabState();
}

class _ScanTabState extends State<ScanTab> with TickerProviderStateMixin {
  late final AnimationController _sweepAnim;
  late final AnimationController _completionAnim;
  _SweepState _state = _SweepState.idle;
  Map<String, dynamic>? _todayRow;
  WearableReading? _wearableReading;
  bool _hasSweptThisSession = false;
  List<String> _gapKeys = const [];
  String? _openGapKey;

  /// Metric keys with an inline write in flight — one card can be saving while
  /// the others stay tappable.
  final Set<String> _savingKeys = <String>{};

  @override
  void initState() {
    super.initState();
    _sweepAnim = AnimationController(
      vsync: this,
      duration: ScanGlobe.sweepDuration,
    );
    _completionAnim = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 380),
    );
    _loadQuiet();
  }

  @override
  void dispose() {
    _sweepAnim.dispose();
    _completionAnim.dispose();
    super.dispose();
  }

  String get _today {
    final d = DateTime.now();
    return '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
  }

  Future<Map<String, dynamic>?> _readToday() {
    final injected = widget.loadToday;
    if (injected != null) return injected();
    final client = Supabase.instance.client;
    return DailyLogService(
      client,
    ).getTodayLog(client.auth.currentUser!.id, _today);
  }

  Future<WearableReading?> _syncToday() {
    final injected = widget.syncWearable;
    if (injected != null) return injected();
    final client = Supabase.instance.client;
    return WearableService(client).syncToday(client.auth.currentUser!.id);
  }

  /// Passive re-fetch of today's self-report row only — never triggers the
  /// wearable OS permission prompt. Used on first render and after returning
  /// from DailyLogScreen.
  Future<void> _loadQuiet() async {
    final row = await _readToday();
    if (!mounted) return;
    setState(() => _todayRow = row);
  }

  List<String> get _missingKeys {
    return _missingKeysFor(_todayRow);
  }

  List<String> _missingKeysFor(Map<String, dynamic>? row) =>
      kDailyCoreDqsWeights.keys
          .where((key) => row == null || row[key] == null)
          .toList();

  int get _coverage {
    final v = (_todayRow?['log_completeness'] as num?)?.round();
    return v ?? 0;
  }

  Future<void> _runSweep() async {
    // Read before the first await: reduce-motion is an OS setting, not
    // something that can flip mid-sweep, and MediaQuery.of needs a still-live
    // context. A perpetual `.repeat()` is exactly what that setting exists to
    // suppress. The reference's 1.5 second sweep repeats only inside the globe
    // while the real reads finish.
    final reduced = MediaQuery.maybeDisableAnimationsOf(context) ?? false;
    setState(() => _state = _SweepState.scanning);
    if (!reduced) _sweepAnim.repeat();

    final results = await Future.wait<dynamic>([
      _readToday(),
      _syncToday(),
      Future.delayed(widget.sweepFloor),
    ]);

    if (!mounted) return;
    final row = results[0] as Map<String, dynamic>?;
    if (_sweepAnim.isAnimating) {
      _sweepAnim
        ..stop()
        ..reset();
    }
    setState(() {
      _todayRow = row;
      _wearableReading = results[1] as WearableReading?;
      _hasSweptThisSession = true;
      _gapKeys = _missingKeysFor(row);
      _openGapKey = null;
      _state = _SweepState.done;
    });
    if (!reduced) _completionAnim.forward(from: 0);
  }

  /// Inline scalar answer — a targeted single-column UPDATE, never the whole-row
  /// upsert (see [DailyLogService.saveFieldAnswer]).
  Future<void> _answerInline(String key, int value) async {
    if (_savingKeys.contains(key)) return;
    setState(() => _savingKeys.add(key));
    final messenger = ScaffoldMessenger.of(context);
    try {
      final save = widget.saveFieldAnswer;
      final completeness = save != null
          ? await save(key, value)
          : await (() {
              final client = Supabase.instance.client;
              return DailyLogService(client).saveFieldAnswer(
                client.auth.currentUser!.id,
                _today,
                key,
                value,
              );
            })();
      // Same streak/DQS bookkeeping DailyLogScreen does on save, so a coverage
      // change made here is not invisible to M6.
      final update = widget.updateEngagement;
      if (update != null) {
        await update(completeness);
      } else {
        final client = Supabase.instance.client;
        await EngagementService(
          client,
        ).updateOnLogWrite(client.auth.currentUser!.id, _today, completeness);
      }
      await _loadQuiet();
      if (mounted) setState(() => _openGapKey = null);
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
                child: _ScanDialBreathe(
                  active: _state != _SweepState.done,
                  child: ScanGlobe(
                    scanning: _state == _SweepState.scanning,
                    completed: _state == _SweepState.done,
                    coverage: _coverage,
                    missingCount: missing.length,
                    sweepAnimation: _sweepAnim,
                    completionAnimation: _completionAnim,
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
                        _SweepState.done =>
                          missing.isEmpty
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

              if (_state == _SweepState.idle ||
                  _state == _SweepState.scanning) ...[
                const SizedBox(height: 20),
                WearableSyncRow(
                  reading: _wearableReading,
                  hasSyncedThisSession: _hasSweptThisSession,
                ),
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
                if (missing.isEmpty) ...[
                  Center(
                    child: Column(
                      children: [
                        Image.asset(
                          BiotopeGeneratedAssets.emptyScanBloom,
                          width: 120,
                          height: 120,
                          errorBuilder: (context, error, stack) =>
                              const SizedBox(width: 120, height: 120),
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
                  ),
                  if (_gapKeys.isNotEmpty) const SizedBox(height: 24),
                ],
                if (_gapKeys.isNotEmpty) ...[
                  Row(
                    children: [
                      Text(
                        missing.isEmpty
                            ? 'LOGGED TODAY'
                            : 'NEEDS YOU · ${missing.length}',
                        style: GoogleFonts.manrope(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 1.6,
                          color: OurobionColors.primary,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Container(
                          height: 1,
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              colors: [
                                OurobionColors.brandGoldLight.withValues(
                                  alpha: 0.7,
                                ),
                                OurobionColors.brandGoldLight.withValues(
                                  alpha: 0,
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 13),
                  for (final key in _gapKeys) ...[
                    _GapReveal(
                      delay: Duration(milliseconds: 55 * _gapKeys.indexOf(key)),
                      child: GapCard(
                        metricKey: key,
                        weight: kDailyCoreDqsWeights[key]!,
                        options: kInlineAnswerableOptions[key]!,
                        currentValue: (_todayRow?[key] as num?)?.toInt(),
                        expanded: _openGapKey == key,
                        saving: _savingKeys.contains(key),
                        onToggle: () => setState(
                          () => _openGapKey = _openGapKey == key ? null : key,
                        ),
                        onAnswer: (value) => _answerInline(key, value),
                      ),
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

/// Reference-driven Scan globe, independently pumpable without Supabase.
///
/// Idle and scanning remain 262dp. Completion shrinks to 190dp over 420ms,
/// the 1.5s cubic sweep is clipped by the circular globe itself, and the result
/// uses the reference's 380ms opacity/scale reveal over an opaque radial-white
/// reading surface.
class ScanGlobe extends StatelessWidget {
  static const idleSize = 262.0;
  static const completedSize = 190.0;
  static const shrinkDuration = Duration(milliseconds: 420);
  static const sweepDuration = Duration(milliseconds: 1500);
  static const resultDuration = Duration(milliseconds: 380);
  static const globeKey = ValueKey('scan-globe');
  static const sweepBandKey = ValueKey('scan-globe-sweep-band');
  static const completionOverlayKey = ValueKey('scan-globe-completion-overlay');

  final bool scanning;
  final bool completed;
  final int coverage;
  final int missingCount;
  final Animation<double> sweepAnimation;
  final Animation<double> completionAnimation;

  const ScanGlobe({
    super.key,
    required this.scanning,
    required this.completed,
    required this.coverage,
    required this.missingCount,
    required this.sweepAnimation,
    required this.completionAnimation,
  });

  @override
  Widget build(BuildContext context) {
    final reduced = MediaQuery.maybeDisableAnimationsOf(context) ?? false;
    final size = completed ? completedSize : idleSize;
    return AnimatedContainer(
      key: globeKey,
      duration: shrinkDuration,
      curve: const Cubic(0.2, 0, 0, 1),
      width: size,
      height: size,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: RadialGradient(
          center: const Alignment(0, -0.24),
          colors: [
            Colors.white,
            OurobionColors.primaryContainer.withValues(alpha: 0.6),
          ],
        ),
        border: Border.all(
          color: OurobionColors.primary.withValues(alpha: 0.6),
        ),
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
          Positioned.fill(
            child: Image.asset(
              BiotopeGeneratedAssets.scanCircularBloom,
              fit: BoxFit.cover,
              excludeFromSemantics: true,
              errorBuilder: (context, error, stack) => const SizedBox.shrink(),
            ),
          ),
          if (scanning && !reduced)
            Positioned.fill(
              child: IgnorePointer(
                child: AnimatedBuilder(
                  animation: sweepAnimation,
                  builder: (context, child) {
                    final sweep = const Cubic(
                      0.4,
                      0,
                      0.6,
                      1,
                    ).transform(sweepAnimation.value);
                    return Align(
                      alignment: Alignment(0, -1.2 + sweep * 3.4),
                      child: child,
                    );
                  },
                  child: Container(
                    key: sweepBandKey,
                    width: size,
                    height: size * 0.34,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          OurobionColors.primary.withValues(alpha: 0),
                          OurobionColors.primary.withValues(alpha: 0.42),
                          OurobionColors.primary.withValues(alpha: 0),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          Positioned.fill(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: DecoratedBox(
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: OurobionColors.primary.withValues(alpha: 0.45),
                  ),
                ),
              ),
            ),
          ),
          if (completed)
            Positioned.fill(
              child: AnimatedBuilder(
                animation: completionAnimation,
                builder: (context, child) {
                  final progress = reduced ? 1.0 : completionAnimation.value;
                  return Opacity(
                    opacity: progress,
                    child: Transform.scale(
                      scale: 0.94 + (0.06 * progress),
                      child: child,
                    ),
                  );
                },
                child: DecoratedBox(
                  key: completionOverlayKey,
                  decoration: const BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: RadialGradient(
                      colors: [Color(0xFFFFFFFF), Color(0xF2FFFFFF)],
                      stops: [0.42, 1],
                    ),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
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
                        '$coverage%',
                        style: GoogleFonts.manrope(
                          fontSize: 34,
                          fontWeight: FontWeight.w600,
                          letterSpacing: -1.2,
                          color: OurobionColors.brandGoldDark,
                        ),
                      ),
                      const SizedBox(height: 7),
                      Text(
                        missingCount == 0
                            ? 'All channels in'
                            : '$missingCount channel${missingCount == 1 ? '' : 's'} open',
                        style: GoogleFonts.manrope(
                          fontSize: 10.5,
                          fontWeight: FontWeight.w600,
                          color: OurobionColors.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// The bloom has the same quiet, seven-second breathing cadence as the design
/// reference. It is presentation-only: the sweep's real service calls remain
/// entirely in [_ScanTabState].
class _ScanDialBreathe extends StatefulWidget {
  final bool active;
  final Widget child;

  const _ScanDialBreathe({required this.active, required this.child});

  @override
  State<_ScanDialBreathe> createState() => _ScanDialBreatheState();
}

class _ScanDialBreatheState extends State<_ScanDialBreathe>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 7),
  );

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final reduced = MediaQuery.maybeDisableAnimationsOf(context) ?? false;
    final shouldMove = widget.active && !reduced;
    if (shouldMove && !_controller.isAnimating) {
      _controller.repeat(reverse: true);
    }
    if (!shouldMove && _controller.isAnimating) _controller.stop();

    if (!shouldMove) return widget.child;
    return AnimatedBuilder(
      animation: CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
      child: widget.child,
      builder: (context, child) =>
          Transform.scale(scale: 1 + (_controller.value * 0.035), child: child),
    );
  }
}

/// Gives each returned gap card the reference's short fade-and-expand reveal
/// without changing where a card routes or how it writes an inline answer.
class _GapReveal extends StatelessWidget {
  final Duration delay;
  final Widget child;

  const _GapReveal({required this.delay, required this.child});

  @override
  Widget build(BuildContext context) {
    final reduced = MediaQuery.maybeDisableAnimationsOf(context) ?? false;
    if (reduced) return child;
    return TweenAnimationBuilder<double>(
      // A tiny increasing duration keeps the cards from landing in lockstep
      // while avoiding a timer that could outlive a resumed screen.
      duration: const Duration(milliseconds: 380) + delay,
      curve: const Cubic(0.2, 0, 0, 1),
      tween: Tween(begin: 0, end: 1),
      child: child,
      builder: (context, progress, revealed) => Opacity(
        opacity: progress,
        child: Transform.scale(
          alignment: Alignment.topCenter,
          scale: 0.96 + (0.04 * progress),
          child: Transform.translate(
            offset: Offset(0, (1 - progress) * 14),
            child: revealed,
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
        border: Border.all(
          color: OurobionColors.primary.withValues(alpha: 0.4),
        ),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          Container(
            width: 7,
            height: 7,
            decoration: BoxDecoration(
              color: logged
                  ? OurobionColors.deltaPositive
                  : OurobionColors.brandGold,
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
                    const Icon(
                      Icons.public_outlined,
                      size: 16,
                      color: OurobionColors.outline,
                    ),
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
/// Collapsed one-metric logger matching the reference interaction. Only the
/// selected card expands; choosing a value calls [onAnswer], which the tab
/// routes to [DailyLogService.saveFieldAnswer] for a one-column update.
class GapCard extends StatelessWidget {
  final String metricKey;
  final int weight;
  final List<int> options;
  final int? currentValue;
  final bool expanded;
  final ValueChanged<int> onAnswer;
  final VoidCallback onToggle;
  final bool saving;

  const GapCard({
    super.key,
    required this.metricKey,
    required this.weight,
    required this.options,
    required this.onAnswer,
    required this.onToggle,
    this.currentValue,
    this.expanded = false,
    this.saving = false,
  });

  @override
  Widget build(BuildContext context) {
    return GoldCard(
      onTap: expanded || saving ? null : onToggle,
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
              border: Border.all(
                color: OurobionColors.primary.withValues(alpha: 0.6),
              ),
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
                  currentValue == null
                      ? ScanTabCopy.gapWeight(weight)
                      : ScanTabCopy.gapSaved,
                  style: GoogleFonts.manrope(
                    fontSize: 11.5,
                    height: 1.5,
                    color: OurobionColors.onSurfaceVariant,
                  ),
                ),
                if (currentValue != null && !expanded) ...[
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Text(
                        ScanTabCopy.gapLogged,
                        style: GoogleFonts.manrope(
                          fontSize: 9,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 1.4,
                          color: OurobionColors.deltaPositive,
                        ),
                      ),
                      const SizedBox(width: 9),
                      Expanded(
                        child: Text(
                          ScanTabCopy.answerLabel(metricKey, currentValue!),
                          style: GoogleFonts.manrope(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: OurobionColors.onSurface,
                          ),
                        ),
                      ),
                      Text(
                        ScanTabCopy.gapChange,
                        style: GoogleFonts.manrope(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: OurobionColors.outline,
                        ),
                      ),
                    ],
                  ),
                ] else if (!expanded) ...[
                  const SizedBox(height: 6),
                  Text(
                    ScanTabCopy.gapAnswerHere,
                    style: GoogleFonts.manrope(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w600,
                      color: OurobionColors.primary,
                    ),
                  ),
                ],
                if (expanded) ...[
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
                  if (saving) ...[
                    const SizedBox(height: 8),
                    Text(
                      ScanTabCopy.gapSaving,
                      style: GoogleFonts.manrope(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: OurobionColors.outline,
                      ),
                    ),
                  ],
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
    return Wrap(
      spacing: 7,
      runSpacing: 7,
      children: [
        for (final option in options)
          Semantics(
            container: true,
            button: true,
            enabled: !saving,
            label: '${metricDisplayLabel(metricKey)} $option',
            onTap: saving ? null : () => onAnswer(option),
            child: ExcludeSemantics(
              child: GestureDetector(
                onTap: saving ? null : () => onAnswer(option),
                child: Container(
                  width: 43,
                  height: 36,
                  decoration: BoxDecoration(
                    color: OurobionColors.surfaceContainer,
                    borderRadius: BorderRadius.circular(9),
                    border: Border.all(
                      color: OurobionColors.primary.withValues(alpha: 0.35),
                    ),
                  ),
                  child: Center(
                    child: Text(
                      '$option',
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
      ],
    );
  }
}
