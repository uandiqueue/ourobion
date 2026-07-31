import 'dart:async';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../../../core/generated_assets.dart';
import '../../../../core/theme.dart';
import '../../../../core/widgets/gold_card.dart';
import '../../impl/profile_service.dart';
import '../../models/user_profile.dart';
import '../widgets/about_biotope_card.dart';
import 'how_ourobion_works_screen.dart';
import '../../../m5a_baselines/index.dart';
import '../../../m5a_baselines/ui/screens/metric_detail_screen.dart';
import '../../../m5a_baselines/ui/widgets/metric_tile.dart';
import '../../../m5a_baselines/ui/widgets/metric_trend_section.dart';
import '../../../m5b_insight_engine/index.dart';
import '../../../m6_engagement/index.dart';

// The four registry keys the signals grid renders now live with the module that
// owns metric formatting (m5a_baselines/impl/metric_value_format.dart) so this
// screen and the metric detail view cannot disagree about a key or a unit:
// kSleepMetricKey, kGutMetricKey, kHrvMetricKey, kStepsMetricKey.
//
// The decision recorded when those keys were first chosen still stands:
// "Gut comfort" is the closest real signal to the design's composite "gut
// score" — a 1-5 self-report ordinal, not a composite index, so it is labelled
// and scaled accordingly rather than overclaiming the "/10" the mock implied.

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

  String _displayName = '';
  double? _todayDqs;
  EngagementState _engagement = EngagementState.zero;
  int _activeInsightCount = 0;
  final Map<String, BaselineSnapshot?> _baselines = {};
  final Map<String, List<MetricDailyPoint>> _series = {};
  bool _loading = true;
  bool _refreshing = false;
  final _trendKey = GlobalKey<MetricTrendSectionState>();

  /// Real counts from `get_knowledge_base_stats()`. Null means the read failed
  /// or has not returned — the row stays hidden in that case rather than
  /// asserting an empty corpus it never actually read.
  KnowledgeBaseStats? _kbStats;

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
    // No ambient repeating controller here. The one that used to live on this
    // line drove the rotating knowledge-base ticker removed in PR #202; it
    // outlived its only reader and kept repeating forever — burning frames, and
    // (unlike _Breathe) with no reduce-motion gate. Deleted with the ticker.
    _load();
  }

  @override
  void dispose() {
    _anim.dispose();
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
    const metricKeys = [
      kSleepMetricKey,
      kGutMetricKey,
      kHrvMetricKey,
      kStepsMetricKey,
    ];

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
      // Returns null on failure rather than throwing, so a knowledge-base
      // outage hides one row instead of breaking the whole Home load.
      KnowledgeBaseService(client).getStats(),
      for (final key in metricKeys) baselineService.getBaseline(userId, key),
      for (final key in metricKeys)
        seriesService.getSeries(userId, key, windowDays: 14),
    ]);

    var i = 0;
    final profile = results[i++] as UserProfile?;
    final todayRow = results[i++] as Map<String, dynamic>?;
    final engagement = results[i++] as EngagementState?;
    final insights = results[i++] as List<InsightCard>;
    final kbStats = results[i++] as KnowledgeBaseStats?;
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
      _kbStats = kbStats;
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

  /// Short greeting for the design's `Morning, <name>` line.
  String get _greetingShort {
    final h = DateTime.now().hour;
    if (h < 12) return 'Morning';
    if (h < 18) return 'Afternoon';
    return 'Evening';
  }

  /// "TUESDAY · 28 JULY" — the design's eyebrow. Real date, no formatting
  /// package needed for two fixed lists.
  String get _dateEyebrow {
    const days = [
      'MONDAY',
      'TUESDAY',
      'WEDNESDAY',
      'THURSDAY',
      'FRIDAY',
      'SATURDAY',
      'SUNDAY',
    ];
    const months = [
      'JANUARY',
      'FEBRUARY',
      'MARCH',
      'APRIL',
      'MAY',
      'JUNE',
      'JULY',
      'AUGUST',
      'SEPTEMBER',
      'OCTOBER',
      'NOVEMBER',
      'DECEMBER',
    ];
    final now = DateTime.now();
    return '${days[now.weekday - 1]} · ${now.day} ${months[now.month - 1]}';
  }

  /// Change in the coverage index against the 7-day average, in whole points.
  ///
  /// Null unless BOTH numbers genuinely exist — the design shows a "▲ 4 PTS /
  /// 7-DAY" pill, and inventing that delta when there is no baseline would be
  /// exactly the fabricated-composite problem the status word avoids.
  int? get _indexDelta {
    final avg = _engagement.dqs7DayAvg;
    final today = _todayDqs;
    if (avg == null || today == null) return null;
    final delta = (today - avg).round();
    return delta == 0 ? null : delta;
  }

  /// Coverage bucket derived from the same real score the hero displays.
  String get _statusWord {
    final v = _engagement.dqs7DayAvg ?? _todayDqs;
    return HomeCoverageCopy.bucket(v);
  }

  String get _coverageBasis => _engagement.dqs7DayAvg != null
      ? HomeCoverageCopy.sevenDayBasis
      : HomeCoverageCopy.todayBasis;

  String get _coverageRange =>
      HomeCoverageCopy.bucketRange(_engagement.dqs7DayAvg ?? _todayDqs);

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
                // The reference canvas is 390 logical pixels wide and holds
                // its content 22px from each edge. Keeping that geometry here
                // makes the status card and two-column signals grid land at
                // the same proportions while still scaling naturally on wider
                // phones.
                padding: const EdgeInsets.symmetric(horizontal: 22),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: 12),

                    // ── Header ────────────────────────────────────────
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              // Design puts the real date in the eyebrow and
                              // the greeting on the display line.
                              Text(
                                _dateEyebrow,
                                style: GoogleFonts.manrope(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: 1.6,
                                  color: OurobionColors.primary,
                                ),
                              ),
                              const SizedBox(height: 9),
                              Text(
                                _displayName.isNotEmpty
                                    ? '$_greetingShort, $_displayName'
                                    : _greeting,
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
                        GestureDetector(
                          onTap: widget.onProfileTap,
                          child: Container(
                            width: 46,
                            height: 46,
                            decoration: BoxDecoration(
                              color: OurobionColors.surfaceLowest,
                              border: Border.all(
                                color: OurobionColors.primary.withValues(
                                  alpha: 0.5,
                                ),
                              ),
                              borderRadius: BorderRadius.circular(16),
                            ),
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(15),
                              child: Image.asset(
                                BiotopeGeneratedAssets.profileBotanicalCrest,
                                fit: BoxFit.cover,
                                errorBuilder: (context, error, stack) =>
                                    const Icon(
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

                    const SizedBox(height: 20),

                    // ── System status hero ─────────────────────────────
                    SystemStatusHero(
                      statusWord: _statusWord,
                      index: (_engagement.dqs7DayAvg ?? _todayDqs)?.round(),
                      scoreBasis: _coverageBasis,
                      bucketRange: _coverageRange,
                      streak: _engagement.currentStreakDays,
                      indexDelta: _indexDelta,
                    ),

                    // ── Knowledge base (real counts, or nothing) ───────
                    // Rendered only when a real read returned real content. An
                    // empty corpus or a failed read shows no row at all, rather
                    // than a pulsing animation implying work that is not
                    // happening.
                    if (_kbStats?.hasContent ?? false) ...[
                      const SizedBox(height: 13),
                      _KnowledgeBaseRow(
                        stats: _kbStats!,
                        refreshing: _refreshing,
                      ),
                    ],

                    const SizedBox(height: 20),

                    // ── About Biotope ───────────────────────────────────
                    AboutBiotopeCard(
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => const HowOurobionWorksScreen(),
                        ),
                      ),
                    ),

                    const SizedBox(height: 22),

                    // ── Signals grid ────────────────────────────────────
                    _Eyebrow('SIGNALS TODAY', rule: true),
                    const SizedBox(height: 12),
                    _SignalsGrid(baselines: _baselines, series: _series),

                    // Design line 244: the Coverage card sits 13px under the
                    // grid, not 20 — the grid and the card read as one block.
                    const SizedBox(height: 13),

                    // ── Coverage / Scan CTA ─────────────────────────────
                    CoverageCard(dqs: _todayDqs, onTap: widget.onScanTap),

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
                      _TitlesRow(unlockedTitles: _engagement.unlockedTitles),
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

  /// Design pairs section eyebrows with a gold hairline that fades out across
  /// the remaining width.
  final bool rule;
  const _Eyebrow(this.label, {this.rule = false});

  @override
  Widget build(BuildContext context) {
    final text = Text(
      label,
      style: GoogleFonts.manrope(
        fontSize: 10,
        fontWeight: FontWeight.w700,
        letterSpacing: 1.6,
        color: OurobionColors.primary,
      ),
    );
    if (!rule) return text;
    return Row(
      children: [
        text,
        const SizedBox(width: 10),
        Expanded(
          child: Container(
            height: 1,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  OurobionColors.brandGold.withValues(alpha: 0.7),
                  OurobionColors.brandGold.withValues(alpha: 0),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// The design's slow `breathe` on the hero artwork.
///
/// Honours [MediaQueryData.disableAnimations]: when the user has turned motion
/// off at the OS level this renders the child still, rather than animating
/// anyway. A continuous ambient loop is exactly the kind of motion that setting
/// exists to stop.
class _Breathe extends StatefulWidget {
  final Widget child;
  const _Breathe({required this.child});

  @override
  State<_Breathe> createState() => _BreatheState();
}

class _BreatheState extends State<_Breathe>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 7),
  );

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final reduced = MediaQuery.maybeDisableAnimationsOf(context) ?? false;
    if (reduced) {
      if (_c.isAnimating) _c.stop();
      return widget.child;
    }
    if (!_c.isAnimating) _c.repeat(reverse: true);
    return ScaleTransition(
      scale: Tween<double>(
        begin: 1.0,
        end: 1.035,
      ).animate(CurvedAnimation(parent: _c, curve: Curves.easeInOut)),
      alignment: Alignment.bottomCenter,
      child: widget.child,
    );
  }
}

/// "▲ 4 PTS · 7-DAY" — movement of the coverage index against its own 7-day
/// average. Only built when that delta is genuinely known and non-zero.
class _DeltaPill extends StatelessWidget {
  final int points;
  const _DeltaPill({required this.points});

  @override
  Widget build(BuildContext context) {
    final rising = points > 0;
    final tint = rising
        ? OurobionColors.deltaPositive
        : OurobionColors.deltaNegative;
    final magnitude = points.abs();
    return Semantics(
      label:
          '${rising ? 'Up' : 'Down'} $magnitude '
          '${magnitude == 1 ? 'point' : 'points'} against the 7 day average',
      child: ExcludeSemantics(
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          decoration: BoxDecoration(
            color: tint.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: tint.withValues(alpha: 0.18)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                '${rising ? '▲' : '▼'} $magnitude ${magnitude == 1 ? 'PT' : 'PTS'}',
                style: GoogleFonts.manrope(
                  fontSize: 9,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1,
                  color: tint,
                ),
              ),
              const SizedBox(width: 6),
              Text(
                '7-DAY',
                style: GoogleFonts.manrope(
                  fontSize: 9,
                  fontWeight: FontWeight.w500,
                  color: OurobionColors.onSurfaceVariant,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Truthful labels for the weighted logging-completeness score on Home.
abstract final class HomeCoverageCopy {
  static const sevenDayBasis = '7-day weighted logging completeness';
  static const todayBasis = 'Today’s weighted logging completeness';

  static String bucket(double? value) {
    if (value == null) return 'No coverage yet';
    if (value >= 80) return 'High coverage';
    if (value >= 60) return 'Steady coverage';
    if (value >= 40) return 'Partial coverage';
    return 'Early coverage';
  }

  static String bucketRange(double? value) {
    if (value == null) return 'Log-weight score appears after your first entry';
    if (value >= 80) return '80–100 weighted points';
    if (value >= 60) return '60–79 weighted points';
    if (value >= 40) return '40–59 weighted points';
    return '0–39 weighted points';
  }
}

/// Full-width Home status card with its visual treatment kept behind live data.
///
/// This stays independently pumpable because HomeTab itself reads Supabase
/// directly during initialization.
class SystemStatusHero extends StatelessWidget {
  final String statusWord;
  final int? index;
  final String scoreBasis;
  final String bucketRange;
  final int streak;
  final int? indexDelta;
  const SystemStatusHero({
    super.key,
    required this.statusWord,
    required this.index,
    required this.scoreBasis,
    required this.bucketRange,
    required this.streak,
    required this.indexDelta,
  });

  @override
  Widget build(BuildContext context) {
    // The Home scroll view retains its 22px gutters. Explicitly filling the
    // remaining constraint keeps this card 316dp wide at 360dp and 368dp wide
    // at 412dp, instead of allowing its fractional text column to shrink-wrap.
    return GoldCard(
      key: const ValueKey('system-status-hero'),
      emphasized: true,
      radius: 24,
      padding: EdgeInsets.zero,
      child: ClipRRect(
        key: const ValueKey('system-status-hero-clip'),
        // GoldCard's border is 1dp wide, so this inner content clip follows
        // the visible outer 24dp curve without clipping the card's shadow.
        borderRadius: BorderRadius.circular(23),
        child: SizedBox(
          width: double.infinity,
          // GoldCard's 1dp border sits outside this child on every edge, so a
          // 242dp inner frame produces the specified 244dp outer card.
          height: 242,
          child: Stack(
            children: [
              // The inset clip follows the outer radius-24 card and contains
              // the entire artwork layer, not just the padded status column.
              Positioned.fill(
                child: Stack(
                  children: [
                    // home_hero_robot_hand_main.png is RGB with NO alpha channel — an
                    // opaque near-white rectangle, not a cutout. Dropped in raw it showed
                    // a hard rectangular seam against the porcelain card and escaped the
                    // card's rounded corner. (Nobody saw this until the asset actually
                    // shipped: the whole generated set was missing from the bundle, and
                    // this Image.asset's errorBuilder is an INVISIBLE SizedBox.)
                    //
                    // So: clip to the card's radius, and feather the two inner edges with
                    // a ShaderMask so the rectangle dissolves into the surface instead of
                    // ending in a line. Replace this with a transparent-background asset
                    // and the mask becomes a no-op rather than a problem.
                    Positioned(
                      right: -30,
                      bottom: -18,
                      child: _Breathe(
                        child: ShaderMask(
                          // The generated source has an opaque porcelain field,
                          // so feather only its left edge. This retains the large
                          // botanical hand visible in the HTML composition rather
                          // than making it read as a small, faded watermark.
                          shaderCallback: (rect) => const LinearGradient(
                            begin: Alignment.centerLeft,
                            end: Alignment.centerRight,
                            colors: [Colors.transparent, Colors.white],
                            stops: [0.14, 0.60],
                          ).createShader(rect),
                          blendMode: BlendMode.dstIn,
                          child: Opacity(
                            opacity: 0.96,
                            child: Image.asset(
                              key: const ValueKey('system-status-hero-artwork'),
                              BiotopeGeneratedAssets.homeHeroRobotHandMain,
                              excludeFromSemantics: true,
                              width: 214,
                              height: 262,
                              fit: BoxFit.contain,
                              errorBuilder: (context, error, stack) =>
                                  const SizedBox(width: 214, height: 262),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              // Live content has its own padding above the artwork layer. The
              // 200dp available height is the 244dp outer card less its border
              // and 22/20dp content padding.
              Positioned.fill(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 22, 20, 20),
                  child: FractionallySizedBox(
                    alignment: Alignment.topLeft,
                    widthFactor: 0.58,
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
                        FittedBox(
                          fit: BoxFit.scaleDown,
                          alignment: Alignment.centerLeft,
                          child: Text(
                            statusWord,
                            style: GoogleFonts.manrope(
                              fontSize: 30,
                              fontWeight: FontWeight.w600,
                              letterSpacing: -1,
                              color: OurobionColors.onSurface,
                            ),
                          ),
                        ),
                        const SizedBox(height: 10),
                        // Design's gold hairline fading to nothing, rather than a hard
                        // 60px rule.
                        Container(
                          height: 1,
                          margin: const EdgeInsets.only(right: 8),
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              colors: [
                                OurobionColors.brandGold,
                                OurobionColors.brandGold.withValues(alpha: 0),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(height: 10),
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
                              Flexible(
                                child: Text(
                                  '/100 weighted points',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: GoogleFonts.manrope(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w600,
                                    color: OurobionColors.onSurfaceVariant,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        if (index != null) ...[
                          const SizedBox(height: 4),
                          Text(
                            '$scoreBasis\n$bucketRange',
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: GoogleFonts.manrope(
                              fontSize: 9,
                              fontWeight: FontWeight.w600,
                              height: 1.2,
                              color: OurobionColors.onSurfaceVariant,
                            ),
                          ),
                        ],
                        // Real movement against the 7-day average. Rendered only when
                        // both numbers exist, so an absent baseline shows no pill
                        // rather than a fabricated "▲ 0".
                        if (indexDelta != null) ...[
                          const SizedBox(height: 6),
                          _DeltaPill(points: indexDelta!),
                        ],
                        if (streak > 0) ...[
                          const SizedBox(height: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 5,
                            ),
                            decoration: BoxDecoration(
                              color: OurobionColors.deltaPositive.withValues(
                                alpha: 0.08,
                              ),
                              borderRadius: BorderRadius.circular(999),
                              border: Border.all(
                                color: OurobionColors.deltaPositive.withValues(
                                  alpha: 0.18,
                                ),
                              ),
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
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Copy for the knowledge-base row. Every string here must describe something
/// the row actually read; nothing may imply indexing that is not happening.
abstract final class KnowledgeBaseCopy {
  static const eyebrow = 'KNOWLEDGE BASE';

  /// Singular matters: the Run 4 corpus really is one paper, and rounding that
  /// up to a vaguer plural would overstate the evidence base.
  static String studies(int n) =>
      n == 1 ? '1 study indexed' : '$n studies indexed';

  static String relationships(int n) =>
      n == 1 ? '1 verified relationship' : '$n verified relationships';

  static String lastIndexed(String date) => 'Last indexed $date';

  static const ingesting = 'Refreshing the index…';

  static const all = <String>[eyebrow, ingesting];
}

/// Home's knowledge-base row, backed by `get_knowledge_base_stats()`.
///
/// This used to rotate three hardcoded strings on a five-second timer with
/// nothing behind them. The caller now renders it ONLY when a real read
/// returned real content, so an empty corpus or a failed read shows nothing
/// rather than a comforting animation.
class _KnowledgeBaseRow extends StatelessWidget {
  final KnowledgeBaseStats stats;
  final bool refreshing;
  const _KnowledgeBaseRow({required this.stats, required this.refreshing});

  static String _dateOnly(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  @override
  Widget build(BuildContext context) {
    final detail = refreshing
        ? KnowledgeBaseCopy.ingesting
        : stats.lastIndexedAt != null
        ? KnowledgeBaseCopy.lastIndexed(_dateOnly(stats.lastIndexedAt!))
        : KnowledgeBaseCopy.relationships(stats.edgesVerified);

    return Semantics(
      container: true,
      label:
          '${KnowledgeBaseCopy.eyebrow}. '
          '${KnowledgeBaseCopy.studies(stats.studiesIndexed)}. $detail',
      child: ExcludeSemantics(
        child: GoldCard(
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
                      KnowledgeBaseCopy.eyebrow,
                      style: GoogleFonts.manrope(
                        fontSize: 9,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 1.4,
                        color: OurobionColors.brandGoldLight,
                      ),
                    ),
                    const SizedBox(height: 5),
                    Text(
                      KnowledgeBaseCopy.studies(stats.studiesIndexed),
                      style: GoogleFonts.manrope(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: OurobionColors.onSurface,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      detail,
                      style: GoogleFonts.manrope(
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                        color: OurobionColors.primary,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Copy the signals grid owns. Public so the copy gate test can run every string
/// through the shared non-diagnostic validator — see
/// test/m5a_baselines/signals_detail_copy_gate_test.dart.
abstract final class SignalsCopy {
  static const sleepLabel = 'Sleep';
  static const gutLabel = 'Gut comfort';
  static const hrvLabel = 'HRV';
  static const movementLabel = 'Movement';

  /// The em dash the value falls back to when the metric has no readings. The
  /// tile's delta line then says so in words ([noData]) — the dash alone would
  /// be ambiguous.
  static const noValue = '—';

  static const noData = 'No data yet';
  static const buildingBaseline = 'Building baseline';
  static const vsAvgSuffix = ' vs avg';
  static const rising = 'Rising';
  static const falling = 'Falling';
  static const steady = 'Steady';

  static const all = <String>[
    sleepLabel,
    gutLabel,
    hrvLabel,
    movementLabel,
    noValue,
    noData,
    buildingBaseline,
    vsAvgSuffix,
    rising,
    falling,
    steady,
  ];

  /// The tile label for a metric key, so the detail view can be titled with the
  /// same word the user pressed.
  static String labelFor(String metricKey) => switch (metricKey) {
    kSleepMetricKey => sleepLabel,
    kGutMetricKey => gutLabel,
    kHrvMetricKey => hrvLabel,
    kStepsMetricKey => movementLabel,
    _ => metricDisplayLabel(metricKey),
  };
}

class _SignalsGrid extends StatelessWidget {
  final Map<String, BaselineSnapshot?> baselines;
  final Map<String, List<MetricDailyPoint>> series;
  const _SignalsGrid({required this.baselines, required this.series});

  /// Colour of the delta line, taken from the delta the tile actually SHOWS.
  ///
  /// This used to be the baseline's own `trend` field, which meant a tile could
  /// render "+18m vs avg" in the falling colour — the number and its colour
  /// disagreeing. Gut comfort keeps the trend colouring because its delta line
  /// IS the trend word (Rising/Falling/Steady), so the two agree by construction.
  Color _deltaColor(
    String metricKey,
    List<MetricDailyPoint> pts,
    BaselineSnapshot? b,
  ) {
    if (pts.isEmpty || b?.mean == null) return OurobionColors.onSurfaceVariant;
    if (metricKey == kGutMetricKey) {
      return switch (b!.trend) {
        BaselineTrend.rising => OurobionColors.deltaPositive,
        BaselineTrend.falling => OurobionColors.deltaNegative,
        // A steady signal gets the neutral colour: the design tints "Steady"
        // green (design line 219), but green would read as movement in a good
        // direction where there was none.
        _ => OurobionColors.onSurfaceVariant,
      };
    }
    final delta = pts.last.value - b!.mean!;
    if (delta > 0) return OurobionColors.deltaPositive;
    if (delta < 0) return OurobionColors.deltaNegative;
    return OurobionColors.onSurfaceVariant;
  }

  String _deltaLabel(
    String metricKey,
    List<MetricDailyPoint> pts,
    BaselineSnapshot? b,
  ) {
    if (pts.isEmpty) return SignalsCopy.noData;
    if (b?.mean == null) return SignalsCopy.buildingBaseline;
    final delta = pts.last.value - b!.mean!;
    if (metricKey == kGutMetricKey) {
      return switch (b.trend) {
        BaselineTrend.rising => SignalsCopy.rising,
        BaselineTrend.falling => SignalsCopy.falling,
        _ => SignalsCopy.steady,
      };
    }
    final formatted = formatMetricDelta(metricKey, delta);
    return formatted == null ? '' : '$formatted${SignalsCopy.vsAvgSuffix}';
  }

  /// The tile press destination (design line 210 makes every tile pressable;
  /// nothing was wired to it). Pushes on the root navigator so the detail view
  /// covers the bottom bar and pops back to Home.
  void _open(BuildContext context, String metricKey) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => MetricDetailScreen(
          metricKey: metricKey,
          title: SignalsCopy.labelFor(metricKey),
        ),
      ),
    );
  }

  /// One tile, wired to its own detail view. Every tile gets an [onTap] — a tile
  /// that looks pressable and is not was the defect this replaces.
  Widget _tile(
    BuildContext context,
    String metricKey, {
    MetricSparklineStyle style = MetricSparklineStyle.line,
  }) {
    final pts = series[metricKey] ?? const <MetricDailyPoint>[];
    final baseline = baselines[metricKey];
    final hasValue = pts.isNotEmpty;
    return MetricTile(
      label: SignalsCopy.labelFor(metricKey),
      value: hasValue
          ? formatMetricValue(metricKey, pts.last.value)
          : SignalsCopy.noValue,
      valueSuffix: hasValue ? metricValueSuffix(metricKey) : null,
      deltaLabel: _deltaLabel(metricKey, pts, baseline),
      deltaColor: _deltaColor(metricKey, pts, baseline),
      series: pts,
      style: style,
      onTap: () => _open(context, metricKey),
    );
  }

  @override
  Widget build(BuildContext context) {
    return GridView(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      // A MetricTile's content is FIXED height (label + value + delta + a 22px
      // visual). `childAspectRatio` derived the cell height from the tile WIDTH,
      // so the row height shrank with the screen and the column overflowed —
      // 9.5px on a 1080x2340 device, and worse the narrower the phone. Pin the
      // main-axis extent instead so the cell matches the content it holds and is
      // independent of device width. `kMetricTileExtent` is the measured
      // content height plus headroom; the tile's visual is Flexible, so a large
      // text scale compresses that rather than overflowing.
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        mainAxisSpacing: 11,
        crossAxisSpacing: 11,
        mainAxisExtent: kMetricTileExtent,
      ),
      children: [
        _tile(context, kSleepMetricKey),
        _tile(context, kGutMetricKey, style: MetricSparklineStyle.bars),
        _tile(context, kHrvMetricKey),
        _tile(context, kStepsMetricKey),
      ],
    );
  }
}

/// Home coverage CTA with an intentionally cropped decorative flower accent.
class CoverageCard extends StatelessWidget {
  final double? dqs;
  final VoidCallback onTap;
  const CoverageCard({super.key, required this.dqs, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final logged = dqs != null;
    final streakWorthy = (dqs ?? 0) >= 60;
    final fullyCaptured = dqs == 100;

    return GoldCard(
      key: const ValueKey('coverage-card'),
      onTap: streakWorthy ? null : onTap,
      emphasized: !streakWorthy,
      padding: EdgeInsets.zero,
      child: ClipRRect(
        key: const ValueKey('coverage-card-clip'),
        borderRadius: BorderRadius.circular(kCardRadius - 1),
        child: Stack(
          clipBehavior: Clip.hardEdge,
          children: [
            Positioned(
              right: -28,
              top: -42,
              child: IgnorePointer(
                child: Opacity(
                  opacity: 0.34,
                  child: Image.asset(
                    key: const ValueKey('coverage-flower-artwork'),
                    BiotopeGeneratedAssets.homeFlowerClusterCard,
                    excludeFromSemantics: true,
                    width: 142,
                    height: 142,
                    fit: BoxFit.contain,
                    errorBuilder: (context, error, stack) =>
                        const SizedBox(width: 142, height: 142),
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(20),
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
                            streakWorthy
                                ? Icons.check_circle_rounded
                                : Icons.radar_rounded,
                            color: streakWorthy
                                ? OurobionColors.primary
                                : OurobionColors.outline,
                            size: 22,
                          ),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                fullyCaptured
                                    ? 'Every channel captured today'
                                    : 'Coverage recorded today',
                                style: GoogleFonts.manrope(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                  color: OurobionColors.onSurface,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                fullyCaptured
                                    ? '100 pts — every channel captured'
                                    : '${dqs!.toInt()} / 100 pts — add a sweep to capture more today',
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
            ),
          ],
        ),
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
                  color: streak > 0
                      ? OurobionColors.primary
                      : OurobionColors.outline,
                  size: 22,
                ),
              ),
              const SizedBox(width: 14),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    streak > 0
                        ? '$streak day${streak == 1 ? '' : 's'}'
                        : 'No streak yet',
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
            Divider(
              height: 1,
              color: OurobionColors.primary.withValues(alpha: 0.2),
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                if (longestStreak > 0)
                  Expanded(
                    child: _StatChip(
                      label: 'Personal best',
                      value:
                          '$longestStreak day${longestStreak == 1 ? '' : 's'}',
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
        .map(
          (t) => _TitleChip(
            label: t.label,
            subtitle: t.subtitle,
            icon: t.icon,
            earned: unlockedTitles.contains(t.id),
          ),
        )
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
            color: earned
                ? OurobionColors.primary
                : OurobionColors.outlineVariant,
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
              border: Border.all(
                color: OurobionColors.primary.withValues(alpha: 0.4),
              ),
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
