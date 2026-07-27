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
import '../../impl/logging_controller.dart';
import '../../impl/normaliser.dart';
import 'daily_log_screen.dart';

enum _SweepState { idle, scanning, done }

/// Coverage-sweep screen — new concept, no direct real-infra precedent. Built
/// on top of two real signals: [kDailyCoreDqsWeights] (the T1 daily-core keys
/// that already drive log_completeness) and [WearableService.syncToday] (only
/// ever called from the explicit "Run sweep" tap here, never on screen load —
/// see wearable_sync_row.dart for why). The environmental row has no backing
/// module yet (m4_environmental is a deferred stub) and renders disabled.
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

  Future<void> _openGap(String key) async {
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => const DailyLogScreen()),
    );
    await _loadQuiet();
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
                const _EnvironmentRow(),
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
                    _GapCard(
                      metricKey: key,
                      weight: kDailyCoreDqsWeights[key]!,
                      onTap: () => _openGap(key),
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

class _EnvironmentRow extends StatelessWidget {
  const _EnvironmentRow();

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: 0.55,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 13),
        decoration: BoxDecoration(
          color: OurobionColors.surfaceLowest.withValues(alpha: 0.6),
          border: Border.all(color: OurobionColors.outlineVariant),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Row(
          children: [
            const Icon(Icons.public_outlined, size: 16, color: OurobionColors.outline),
            const SizedBox(width: 11),
            Expanded(
              child: Text(
                'Environment',
                style: GoogleFonts.manrope(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w600,
                  color: OurobionColors.onSurfaceVariant,
                ),
              ),
            ),
            const BadgeChip.disabled(),
          ],
        ),
      ),
    );
  }
}

class _GapCard extends StatelessWidget {
  final String metricKey;
  final int weight;
  final VoidCallback onTap;
  const _GapCard({required this.metricKey, required this.weight, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GoldCard(
      onTap: onTap,
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
                  'SELF-REPORT',
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
                  'Not logged today — worth $weight of your 100 daily points.',
                  style: GoogleFonts.manrope(
                    fontSize: 11.5,
                    height: 1.5,
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
