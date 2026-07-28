import 'dart:async';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../../../core/generated_assets.dart';
import '../../../../core/theme.dart';
import '../../../../core/widgets/gold_card.dart';
import '../../impl/profile_service.dart';
import '../../models/user_profile.dart';
import '../../../m5a_baselines/index.dart';
import '../../../m5a_baselines/ui/widgets/metric_tile.dart';
import '../../../m5a_baselines/ui/widgets/metric_trend_section.dart';
import '../../../m5b_insight_engine/index.dart';
import '../../../m6_engagement/index.dart';

/// Home-grid metric keys → real registry keys (shared/metrics/registry.dart).
/// "Gut comfort" is the closest real signal to a composite "gut score" — it's
/// a 1-5 self-report ordinal, not a composite index, so it's labelled and
/// scaled accordingly rather than overclaiming a /10 score the mock implied.
const _kSleepMetric = 'sleep_duration_min';
const _kGutMetric = 'gut_comfort_score';
const _kHrvMetric = 'hrv_sdnn_ms';
const _kStepsMetric = 'step_count';

class HomeTab extends StatefulWidget {
  final VoidCallback onScanTap;
  final VoidCallback onInsightsTap;
  final VoidCallback onProfileTap;
  const HomeTab({
    super.key,
    required this.onScanTap,
    required this.onInsightsTap,
    required this.onProfileTap,
  });

  @override
  State<HomeTab> createState() => HomeTabState();
}

class HomeTabState extends State<HomeTab> with TickerProviderStateMixin {
  late final AnimationController _anim;
  late final Animation<double> _opacity;
  late final Animation<Offset> _slide;
  late final AnimationController _ticker;

  String _displayName = '';
  double? _todayDqs;
  EngagementState _engagement = EngagementState.zero;
  int _activeInsightCount = 0;
  final Map<String, BaselineSnapshot?> _baselines = {};
  final Map<String, List<MetricDailyPoint>> _series = {};
  bool _loading = true;
  bool _refreshing = false;
  final _trendKey = GlobalKey<MetricTrendSectionState>();

  // Decorative only — cycles static, copy-compliant strings. Not derived from
  // any real ingestion/telemetry feed (none exists yet); see session log.
  static const _tickerLines = [
    'Reviewing your last 7 days',
    'Cross-checking sleep and gut patterns',
    'Watching for new research matches',
  ];
  int _tickerIndex = 0;
  Timer? _tickerTimer;

  @override
  void initState() {
    super.initState();
    _anim = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _opacity = CurvedAnimation(parent: _anim, curve: Curves.easeOut);
    _slide = Tween<Offset>(
      begin: const Offset(0, 0.05),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _anim, curve: Curves.easeOut));
    _ticker = AnimationController(vsync: this, duration: const Duration(seconds: 1))
      ..repeat(reverse: true);
    _tickerTimer = Timer.periodic(const Duration(seconds: 5), (_) {
      if (!mounted) return;
      setState(() => _tickerIndex = (_tickerIndex + 1) % _tickerLines.length);
    });
    _load();
  }

  @override
  void dispose() {
    _anim.dispose();
    _ticker.dispose();
    _tickerTimer?.cancel();
    super.dispose();
  }

  Future<void> _load({bool animate = true}) async {
    // Post-analysis hygiene (U7): re-fetch the trend chart whenever the Home
    // tab reloads (tab re-focus via AppShell). Fire-and-forget — the section
    // manages its own loading state.
    _trendKey.currentState?.reload();

    final client = Supabase.instance.client;
    final userId = client.auth.currentUser!.id;
    final today = _dateStr(DateTime.now());

    final baselineService = BaselineService(client);
    final seriesService = MetricSeriesService(client);
    const metricKeys = [_kSleepMetric, _kGutMetric, _kHrvMetric, _kStepsMetric];

    final results = await Future.wait<dynamic>([
      ProfileService(client).getProfile(userId),
      client
          .from('daily_gut_rows')
          .select('log_completeness')
          .eq('user_id', userId)
          .eq('log_date', today)
          .maybeSingle(),
      EngagementService(client).getEngagementState(userId),
      InsightService(client).getInsights(userId),
      for (final key in metricKeys) baselineService.getBaseline(userId, key),
      for (final key in metricKeys) seriesService.getSeries(userId, key, windowDays: 14),
    ]);

    var i = 0;
    final profile = results[i++] as UserProfile?;
    final todayRow = results[i++] as Map<String, dynamic>?;
    final engagement = results[i++] as EngagementState?;
    final insights = results[i++] as List<InsightCard>;
    final baselineResults = results.sublist(i, i + metricKeys.length);
    i += metricKeys.length;
    final seriesResults = results.sublist(i, i + metricKeys.length);

    if (!mounted) return;
    setState(() {
      _displayName = profile?.displayName ?? '';
      _todayDqs = todayRow != null
          ? (todayRow['log_completeness'] as num?)?.toDouble()
          : null;
      _engagement = engagement ?? EngagementState.zero;
      _activeInsightCount = insights.length;
      for (var k = 0; k < metricKeys.length; k++) {
        _baselines[metricKeys[k]] = baselineResults[k] as BaselineSnapshot?;
        _series[metricKeys[k]] = seriesResults[k] as List<MetricDailyPoint>;
      }
      _loading = false;
      _refreshing = false;
    });
    if (animate) _anim.forward();
  }

  Future<void> reload() => _load(animate: false);

  Future<void> _onRefresh() async {
    setState(() => _refreshing = true);
    await _load(animate: false);
  }

  String _dateStr(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  String get _greeting {
    final h = DateTime.now().hour;
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }

  /// Categorical status word derived from a real number (7-day DQS average),
  /// not a fabricated composite — observational per copy_guidelines.dart.
  String get _statusWord {
    final v = _engagement.dqs7DayAvg ?? _todayDqs;
    if (v == null) return 'Getting started';
    if (v >= 80) return 'Thriving';
    if (v >= 60) return 'Balanced';
    if (v >= 40) return 'Settling in';
    return 'Getting started';
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(
        backgroundColor: OurobionColors.background,
        body: Center(child: CircularProgressIndicator()),
      );
    }
    return Scaffold(
      backgroundColor: OurobionColors.background,
      body: SafeArea(
        child: FadeTransition(
          opacity: _opacity,
          child: SlideTransition(
            position: _slide,
            child: RefreshIndicator(
              onRefresh: _onRefresh,
              color: OurobionColors.primary,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: 24),

                    // ── Header ────────────────────────────────────────
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                _greeting.toUpperCase(),
                                style: GoogleFonts.manrope(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: 1.6,
                                  color: OurobionColors.primary,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                _displayName.isNotEmpty ? _displayName : 'Biome',
                                style: GoogleFonts.manrope(
                                  fontSize: 28,
                                  fontWeight: FontWeight.w600,
                                  letterSpacing: -0.4,
                                  color: OurobionColors.onSurface,
                                ),
                              ),
                            ],
                          ),
                        ),
                        GestureDetector(
                          onTap: widget.onProfileTap,
                          child: Container(
                            width: 46,
                            height: 46,
                            decoration: BoxDecoration(
                              color: OurobionColors.surfaceLowest,
                              border: Border.all(
                                color: OurobionColors.primary.withValues(alpha: 0.5),
                              ),
                              borderRadius: BorderRadius.circular(16),
                            ),
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(15),
                              child: Image.asset(
                                BiotopeGeneratedAssets.profileBotanicalCrest,
                                fit: BoxFit.cover,
                                errorBuilder: (context, error, stack) => const Icon(
                                  Icons.person_outline_rounded,
                                  size: 20,
                                  color: OurobionColors.onSurfaceVariant,
                                ),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(height: 24),

                    // ── System status hero ─────────────────────────────
                    _SystemStatusHero(
                      statusWord: _statusWord,
                      index: (_engagement.dqs7DayAvg ?? _todayDqs)?.round(),
                      streak: _engagement.currentStreakDays,
                    ),

                    const SizedBox(height: 13),

                    // ── Knowledge base ticker (decorative) ─────────────
                    _KnowledgeTicker(
                      line: _refreshing ? 'Ingesting new batch…' : _tickerLines[_tickerIndex],
                    ),

                    const SizedBox(height: 22),

                    // ── Signals grid ────────────────────────────────────
                    _Eyebrow('SIGNALS'),
                    const SizedBox(height: 10),
                    _SignalsGrid(baselines: _baselines, series: _series),

                    const SizedBox(height: 20),

                    // ── Coverage / Scan CTA ─────────────────────────────
                    _CoverageCard(dqs: _todayDqs, onTap: widget.onScanTap),

                    const SizedBox(height: 20),

                    // ── Streak ────────────────────────────────────────
                    _Eyebrow('YOUR STREAK'),
                    const SizedBox(height: 10),
                    _StreakCard(
                      streak: _engagement.currentStreakDays,
                      longestStreak: _engagement.longestStreakDays,
                      dqs7DayAvg: _engagement.dqs7DayAvg,
                    ),

                    const SizedBox(height: 20),

                    // ── Metric trends (demo main-loop step 2) ─────────
                    _Eyebrow(TrendCopy.eyebrow),
                    const SizedBox(height: 10),
                    MetricTrendSection(key: _trendKey),

                    const SizedBox(height: 20),

                    // ── Titles ────────────────────────────────────────
                    if (_engagement.totalLogs > 0) ...[
                      const SizedBox(height: 20),
                      _Eyebrow('TITLES'),
                      const SizedBox(height: 10),
                      _TitlesRow(
                        unlockedTitles: _engagement.unlockedTitles,
                      ),
                    ],

                    // ── Insights teaser ───────────────────────────────
                    const SizedBox(height: 20),
                    _Eyebrow('INSIGHTS'),
                    const SizedBox(height: 10),
                    _InsightsTeaser(
                      activeCount: _activeInsightCount,
                      onTap: widget.onInsightsTap,
                    ),

                    const SizedBox(height: 32),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ── Sub-widgets ────────────────────────────────────────────────────────────────

class _Eyebrow extends StatelessWidget {
  final String label;
  const _Eyebrow(this.label);

  @override
  Widget build(BuildContext context) {
    return Text(
      label,
      style: GoogleFonts.manrope(
        fontSize: 10,
        fontWeight: FontWeight.w700,
        letterSpacing: 1.6,
        color: OurobionColors.primary,
      ),
    );
  }
}

class _SystemStatusHero extends StatelessWidget {
  final String statusWord;
  final int? index;
  final int streak;
  const _SystemStatusHero({required this.statusWord, required this.index, required this.streak});

  @override
  Widget build(BuildContext context) {
    return GoldCard(
      emphasized: true,
      padding: const EdgeInsets.fromLTRB(20, 22, 20, 20),
      child: Stack(
        children: [
          Positioned(
            right: -30,
            bottom: -18,
            child: Opacity(
              opacity: 0.9,
              child: Image.asset(
                BiotopeGeneratedAssets.homeHeroRobotHandMain,
                width: 190,
                height: 220,
                fit: BoxFit.contain,
                errorBuilder: (context, error, stack) => const SizedBox(width: 190, height: 220),
              ),
            ),
          ),
          FractionallySizedBox(
            widthFactor: 0.6,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'SYSTEM STATUS',
                  style: GoogleFonts.manrope(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.6,
                    color: OurobionColors.primary,
                  ),
                ),
                const SizedBox(height: 11),
                Text(
                  statusWord,
                  style: GoogleFonts.manrope(
                    fontSize: 30,
                    fontWeight: FontWeight.w600,
                    letterSpacing: -1,
                    color: OurobionColors.onSurface,
                  ),
                ),
                const SizedBox(height: 14),
                Container(
                  height: 1,
                  width: 60,
                  color: OurobionColors.primary.withValues(alpha: 0.5),
                ),
                const SizedBox(height: 12),
                if (index != null)
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.baseline,
                    textBaseline: TextBaseline.alphabetic,
                    children: [
                      Text(
                        '$index',
                        style: GoogleFonts.manrope(
                          fontSize: 24,
                          fontWeight: FontWeight.w700,
                          letterSpacing: -0.6,
                          color: OurobionColors.primary,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        '/100 coverage',
                        style: GoogleFonts.manrope(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: OurobionColors.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ),
                if (streak > 0) ...[
                  const SizedBox(height: 10),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: OurobionColors.deltaPositive.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(color: OurobionColors.deltaPositive.withValues(alpha: 0.18)),
                    ),
                    child: Text(
                      '$streak DAY STREAK',
                      style: GoogleFonts.manrope(
                        fontSize: 9,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 1,
                        color: OurobionColors.deltaPositive,
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

class _KnowledgeTicker extends StatelessWidget {
  final String line;
  const _KnowledgeTicker({required this.line});

  @override
  Widget build(BuildContext context) {
    return GoldCard(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Row(
        children: [
          Container(
            width: 8,
            height: 8,
            decoration: const BoxDecoration(
              color: OurobionColors.brandGold,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 13),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'KNOWLEDGE BASE',
                  style: GoogleFonts.manrope(
                    fontSize: 9,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.4,
                    color: OurobionColors.brandGoldLight,
                  ),
                ),
                const SizedBox(height: 5),
                AnimatedSwitcher(
                  duration: const Duration(milliseconds: 300),
                  child: Text(
                    line,
                    key: ValueKey(line),
                    style: GoogleFonts.manrope(
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
                      color: OurobionColors.primary,
                    ),
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

class _SignalsGrid extends StatelessWidget {
  final Map<String, BaselineSnapshot?> baselines;
  final Map<String, List<MetricDailyPoint>> series;
  const _SignalsGrid({required this.baselines, required this.series});

  Color _trendColor(BaselineTrend? t) => switch (t) {
        BaselineTrend.rising => OurobionColors.deltaPositive,
        BaselineTrend.falling => OurobionColors.deltaNegative,
        _ => OurobionColors.onSurfaceVariant,
      };

  String _deltaLabel(String metricKey, List<MetricDailyPoint> pts, BaselineSnapshot? b) {
    if (pts.isEmpty) return 'No data yet';
    if (b?.mean == null) return 'Building baseline';
    final delta = pts.last.value - b!.mean!;
    switch (metricKey) {
      case _kSleepMetric:
        final m = delta.round();
        return '${m >= 0 ? '+' : ''}${m}m vs avg';
      case _kHrvMetric:
        final m = delta.round();
        return '${m >= 0 ? '+' : ''}$m ms vs avg';
      case _kStepsMetric:
        final m = delta.round();
        return '${m >= 0 ? '+' : ''}$m vs avg';
      case _kGutMetric:
        return switch (b.trend) {
          BaselineTrend.rising => 'Rising',
          BaselineTrend.falling => 'Falling',
          _ => 'Steady',
        };
      default:
        return '';
    }
  }

  String _formatSleep(double minutes) {
    final h = minutes ~/ 60;
    final m = (minutes % 60).round();
    return '${h}h ${m}m';
  }

  @override
  Widget build(BuildContext context) {
    final sleep = series[_kSleepMetric] ?? const [];
    final gut = series[_kGutMetric] ?? const [];
    final hrv = series[_kHrvMetric] ?? const [];
    final steps = series[_kStepsMetric] ?? const [];

    return GridView(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      // A MetricTile's content is FIXED height (label + value + delta + a 22px
      // visual). `childAspectRatio` derived the cell height from the tile WIDTH,
      // so the row height shrank with the screen and the column overflowed —
      // 9.5px on a 1080x2340 device, and worse the narrower the phone. Pin the
      // main-axis extent instead so the cell matches the content it holds and is
      // independent of device width. `_kMetricTileExtent` is the measured
      // content height plus headroom; the tile's visual is Flexible, so a large
      // text scale compresses that rather than overflowing.
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        mainAxisSpacing: 11,
        crossAxisSpacing: 11,
        mainAxisExtent: kMetricTileExtent,
      ),
      children: [
        MetricTile(
          label: 'Sleep',
          value: sleep.isNotEmpty ? _formatSleep(sleep.last.value) : '—',
          deltaLabel: _deltaLabel(_kSleepMetric, sleep, baselines[_kSleepMetric]),
          deltaColor: _trendColor(baselines[_kSleepMetric]?.trend),
          series: sleep,
        ),
        MetricTile(
          label: 'Gut comfort',
          value: gut.isNotEmpty ? gut.last.value.toStringAsFixed(1) : '—',
          valueSuffix: gut.isNotEmpty ? '/5' : null,
          deltaLabel: _deltaLabel(_kGutMetric, gut, baselines[_kGutMetric]),
          deltaColor: _trendColor(baselines[_kGutMetric]?.trend),
          series: gut,
          style: MetricSparklineStyle.bars,
        ),
        MetricTile(
          label: 'HRV',
          value: hrv.isNotEmpty ? hrv.last.value.round().toString() : '—',
          valueSuffix: hrv.isNotEmpty ? 'ms' : null,
          deltaLabel: _deltaLabel(_kHrvMetric, hrv, baselines[_kHrvMetric]),
          deltaColor: _trendColor(baselines[_kHrvMetric]?.trend),
          series: hrv,
        ),
        MetricTile(
          label: 'Movement',
          value: steps.isNotEmpty ? steps.last.value.round().toString() : '—',
          deltaLabel: _deltaLabel(_kStepsMetric, steps, baselines[_kStepsMetric]),
          deltaColor: _trendColor(baselines[_kStepsMetric]?.trend),
          series: steps,
        ),
      ],
    );
  }
}

class _CoverageCard extends StatelessWidget {
  final double? dqs;
  final VoidCallback onTap;
  const _CoverageCard({required this.dqs, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final logged = dqs != null;
    final streakWorthy = (dqs ?? 0) >= 60;

    return GoldCard(
      onTap: streakWorthy ? null : onTap,
      emphasized: !streakWorthy,
      child: logged
          ? Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: streakWorthy
                        ? OurobionColors.primaryFixed
                        : OurobionColors.surfaceContainer,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(
                    streakWorthy ? Icons.check_circle_rounded : Icons.radar_rounded,
                    color: streakWorthy ? OurobionColors.primary : OurobionColors.outline,
                    size: 22,
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        streakWorthy ? 'Every channel captured today' : 'Coverage in progress',
                        style: GoogleFonts.manrope(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: OurobionColors.onSurface,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        streakWorthy
                            ? '${dqs!.toInt()} pts — great work today'
                            : '${dqs!.toInt()} / 100 pts — run a sweep to close the gap',
                        style: GoogleFonts.manrope(
                          fontSize: 12,
                          color: OurobionColors.outline,
                        ),
                      ),
                      if (!streakWorthy) ...[
                        const SizedBox(height: 4),
                        Text(
                          'Run sweep →',
                          style: GoogleFonts.manrope(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: OurobionColors.primary,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            )
          : Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: OurobionColors.primaryFixed,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(
                    Icons.radar_rounded,
                    color: OurobionColors.primary,
                    size: 22,
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        "You haven't swept today",
                        style: GoogleFonts.manrope(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: OurobionColors.onSurface,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Takes under 30 seconds',
                        style: GoogleFonts.manrope(
                          fontSize: 12,
                          color: OurobionColors.outline,
                        ),
                      ),
                    ],
                  ),
                ),
                Text(
                  'Run sweep →',
                  style: GoogleFonts.manrope(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: OurobionColors.primary,
                  ),
                ),
              ],
            ),
    );
  }
}

class _StreakCard extends StatelessWidget {
  final int streak;
  final int longestStreak;
  final double? dqs7DayAvg;
  const _StreakCard({
    required this.streak,
    required this.longestStreak,
    required this.dqs7DayAvg,
  });

  @override
  Widget build(BuildContext context) {
    final showStats = longestStreak > 0 || dqs7DayAvg != null;
    return GoldCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: streak > 0
                      ? OurobionColors.primaryFixed
                      : OurobionColors.surfaceContainer,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  Icons.local_fire_department_rounded,
                  color: streak > 0 ? OurobionColors.primary : OurobionColors.outline,
                  size: 22,
                ),
              ),
              const SizedBox(width: 14),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    streak > 0 ? '$streak day${streak == 1 ? '' : 's'}' : 'No streak yet',
                    style: GoogleFonts.manrope(
                      fontSize: 20,
                      fontWeight: FontWeight.w700,
                      letterSpacing: -0.2,
                      color: streak > 0
                          ? OurobionColors.onSurface
                          : OurobionColors.outline,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    streak > 0
                        ? 'consecutive streak-worthy days'
                        : 'Log 60+ pts to start your streak',
                    style: GoogleFonts.manrope(
                      fontSize: 12,
                      color: OurobionColors.outline,
                    ),
                  ),
                ],
              ),
            ],
          ),
          if (showStats) ...[
            const SizedBox(height: 16),
            Divider(height: 1, color: OurobionColors.primary.withValues(alpha: 0.2)),
            const SizedBox(height: 14),
            Row(
              children: [
                if (longestStreak > 0)
                  Expanded(
                    child: _StatChip(
                      label: 'Personal best',
                      value: '$longestStreak day${longestStreak == 1 ? '' : 's'}',
                    ),
                  ),
                if (longestStreak > 0 && dqs7DayAvg != null)
                  const SizedBox(width: 10),
                if (dqs7DayAvg != null)
                  Expanded(
                    child: _StatChip(
                      label: '7-day avg',
                      value: '${dqs7DayAvg!.round()} pts',
                    ),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _TitlesRow extends StatelessWidget {
  final List<String> unlockedTitles;
  const _TitlesRow({required this.unlockedTitles});

  @override
  Widget build(BuildContext context) {
    final chips = kTitleRegistry
        .map((t) => _TitleChip(
              label: t.label,
              subtitle: t.subtitle,
              icon: t.icon,
              earned: unlockedTitles.contains(t.id),
            ))
        .toList();

    return Column(
      children: [
        for (int i = 0; i < chips.length; i += 2)
          Padding(
            padding: EdgeInsets.only(bottom: i + 2 < chips.length ? 10 : 0),
            child: Row(
              children: [
                Expanded(child: chips[i]),
                const SizedBox(width: 10),
                if (i + 1 < chips.length)
                  Expanded(child: chips[i + 1])
                else
                  const Expanded(child: SizedBox()),
              ],
            ),
          ),
      ],
    );
  }
}

class _TitleChip extends StatelessWidget {
  final String label;
  final String subtitle;
  final IconData icon;
  final bool earned;
  const _TitleChip({
    required this.label,
    required this.subtitle,
    required this.icon,
    required this.earned,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: earned
            ? OurobionColors.primaryFixed
            : OurobionColors.surfaceLowest,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: earned
              ? OurobionColors.primaryContainer
              : OurobionColors.outlineVariant,
        ),
      ),
      child: Row(
        children: [
          Icon(
            icon,
            size: 18,
            color: earned ? OurobionColors.primary : OurobionColors.outlineVariant,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: GoogleFonts.manrope(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: earned
                        ? OurobionColors.primary
                        : OurobionColors.outlineVariant,
                  ),
                ),
                Text(
                  subtitle,
                  style: GoogleFonts.manrope(
                    fontSize: 10,
                    color: earned
                        ? OurobionColors.onSurfaceVariant
                        : OurobionColors.outlineVariant,
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

class _StatChip extends StatelessWidget {
  final String label;
  final String value;
  const _StatChip({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: OurobionColors.surfaceContainer,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label.toUpperCase(),
            style: GoogleFonts.manrope(
              fontSize: 9,
              fontWeight: FontWeight.w700,
              letterSpacing: 1.2,
              color: OurobionColors.outline,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            value,
            style: GoogleFonts.manrope(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              color: OurobionColors.onSurface,
            ),
          ),
        ],
      ),
    );
  }
}

class _InsightsTeaser extends StatelessWidget {
  final int activeCount;
  final VoidCallback onTap;
  const _InsightsTeaser({required this.activeCount, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final hasInsights = activeCount > 0;

    return GoldCard(
      onTap: hasInsights ? onTap : null,
      child: Row(
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: OurobionColors.surfaceContainer,
              borderRadius: BorderRadius.circular(15),
              border: Border.all(color: OurobionColors.primary.withValues(alpha: 0.4)),
            ),
            clipBehavior: Clip.antiAlias,
            child: hasInsights
                ? Image.asset(
                    BiotopeGeneratedAssets.insightsBiomechHeartBloom,
                    fit: BoxFit.cover,
                    errorBuilder: (context, error, stack) => const Icon(
                      Icons.lightbulb_rounded,
                      color: OurobionColors.primary,
                    ),
                  )
                : const Icon(
                    Icons.lock_outline_rounded,
                    color: OurobionColors.outline,
                  ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  hasInsights
                      ? '$activeCount new insight${activeCount == 1 ? '' : 's'}'
                      : 'No new insights yet',
                  style: GoogleFonts.manrope(
                    fontSize: 9,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.4,
                    color: OurobionColors.brandGoldLight,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  hasInsights
                      ? 'Open the Insights deck to review'
                      : 'Keep logging — patterns take a few days to appear',
                  style: GoogleFonts.manrope(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: OurobionColors.onSurface,
                  ),
                ),
              ],
            ),
          ),
          if (hasInsights)
            Text(
              '→',
              style: GoogleFonts.manrope(
                fontSize: 18,
                fontWeight: FontWeight.w600,
                color: OurobionColors.brandGoldLight,
              ),
            ),
        ],
      ),
    );
  }
}
