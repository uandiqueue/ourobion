import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../../core/theme.dart';
import '../../../../core/widgets/gold_card.dart';
import '../../impl/baseline_service.dart';
import '../../impl/chart_math.dart';
import '../../impl/metric_series_models.dart';
import '../../impl/metric_series_service.dart';
import '../../impl/metric_value_format.dart';
import '../widgets/metric_trend_section.dart';

/// User-facing copy for the metric detail view. Public so the copy gate test can
/// run every string through the shared non-diagnostic validator
/// (shared/constants/copy_guidelines.dart) — same pattern as [TrendCopy].
///
/// The window label, load-error and retry strings are deliberately NOT
/// re-declared here: they are reused from [TrendCopy], so Home's trend section,
/// Archive's trend section and this screen cannot drift apart.
abstract final class MetricDetailCopy {
  static const eyebrow = 'SIGNAL HISTORY';

  static const latestLabel = 'LATEST READING';
  static const historyLabel = 'DAILY HISTORY';
  static const baselineLabel = 'YOUR BASELINE';

  /// Honest empty state. No chart is painted in this branch at all — a flat or
  /// blank axis would read as "we measured nothing", which is not the same claim
  /// as "nothing was logged".
  static const emptyTitle = 'No readings for this signal yet';
  static const emptyBody =
      'Nothing was logged or synced for this signal in the last 30 days, so '
      'there is no history to chart. Values appear here as soon as they arrive.';

  /// One real point is drawn as one real dot, with this note instead of a line
  /// joining a point to nothing.
  static const singlePointNote =
      'One reading so far. A line needs at least two days.';

  static const noBaselineTitle = 'No baseline yet';
  static const noBaselineBody =
      'A baseline is computed once this signal has at least three days of '
      'values, then it appears here.';

  static const meanLabel = 'Average';
  static const rangeLabel = 'Range';
  static const daysLabel = 'Days of data';
  static const confidenceLabel = 'Confidence';
  static const directionLabel = 'Direction';

  static const confidenceInsufficient = 'Not enough data yet';
  static const confidenceLow = 'Low';
  static const confidenceMedium = 'Medium';
  static const confidenceHigh = 'High';

  static const directionRising = 'Rising';
  static const directionFalling = 'Falling';
  static const directionSteady = 'Steady';
  static const directionUnknown = 'Not established yet';

  static const recordedToday = 'Recorded today';
  static const recordedYesterday = 'Recorded yesterday';

  /// Stale, said plainly. The number on screen is real but old, and the user is
  /// told how old rather than being left to assume it is current.
  static String recordedDaysAgo(int days) => 'Recorded $days days ago';

  static const sourceSelfReport = 'From your own log';
  static const sourceWearable = 'From a connected wearable';
  static const sourceSignal = 'From a derived signal';

  /// The unit the chart's own axis numbers are in — the chart plots stored
  /// values, so sleep's gridlines are minutes even though the headline reads
  /// '7h 12m'. Saying so beats silently mixing units.
  static String axisUnit(String metricKey) => switch (metricKey) {
    kSleepMetricKey => 'minutes asleep',
    kHrvMetricKey => 'milliseconds',
    kStepsMetricKey => 'steps',
    kGutMetricKey => 'comfort out of 5',
    _ => 'stored value',
  };

  static const all = <String>[
    eyebrow,
    latestLabel,
    historyLabel,
    baselineLabel,
    emptyTitle,
    emptyBody,
    singlePointNote,
    noBaselineTitle,
    noBaselineBody,
    meanLabel,
    rangeLabel,
    daysLabel,
    confidenceLabel,
    directionLabel,
    confidenceInsufficient,
    confidenceLow,
    confidenceMedium,
    confidenceHigh,
    directionRising,
    directionFalling,
    directionSteady,
    directionUnknown,
    recordedToday,
    recordedYesterday,
    sourceSelfReport,
    sourceWearable,
    sourceSignal,
  ];
}

/// Detail view for one Home "Signals today" tile: the metric's real daily
/// history over the trailing 30 days, plus its baseline snapshot.
///
/// Every number here comes from a Supabase read — `metric_daily_values` via
/// [MetricSeriesService] and `baseline_snapshots` via [BaselineService]. Nothing
/// is interpolated, smoothed or back-filled: the chart is
/// [TrendChartPainter], the SAME painter Home's and Archive's trend sections
/// use, which positions points by DATE so a missing day leaves an honest gap
/// instead of being compressed away.
///
/// Four distinguishable states, never conflated: loading, load error (with a way
/// back in), no history at all (no chart drawn), and real history — the last of
/// which additionally reports how stale its newest reading is.
class MetricDetailScreen extends StatefulWidget {
  /// Registry key, e.g. [kSleepMetricKey].
  final String metricKey;

  /// The tile's own short label ('Sleep', 'Gut comfort', 'HRV', 'Movement'), so
  /// the detail view is titled the same as the tile the user pressed rather than
  /// with a key-derived string like 'Sleep duration min'.
  final String title;

  /// Injectable for widget tests (the defaults touch `Supabase.instance`, which
  /// tests cannot initialize) — same pattern as [MetricTrendSection].
  final MetricSeriesService? seriesService;
  final BaselineService? baselineService;
  final String? userId;

  /// Injectable clock, used only to say how old the newest reading is.
  final DateTime Function()? nowUtc;

  const MetricDetailScreen({
    super.key,
    required this.metricKey,
    required this.title,
    this.seriesService,
    this.baselineService,
    this.userId,
    this.nowUtc,
  });

  @override
  State<MetricDetailScreen> createState() => _MetricDetailScreenState();
}

class _MetricDetailScreenState extends State<MetricDetailScreen> {
  static const _windowDays = 30;

  late final MetricSeriesService _seriesService;
  late final BaselineService _baselineService;
  late final String _userId;
  late final DateTime Function() _nowUtc;

  List<MetricDailyPoint> _points = const [];
  BaselineSnapshot? _baseline;
  bool _loading = true;
  bool _error = false;

  @override
  void initState() {
    super.initState();
    // Only touch Supabase.instance for the parts the caller did not inject —
    // widget tests inject all of them and must never reach it.
    SupabaseClient client() => Supabase.instance.client;
    _seriesService = widget.seriesService ?? MetricSeriesService(client());
    _baselineService = widget.baselineService ?? BaselineService(client());
    _userId = widget.userId ?? client().auth.currentUser!.id;
    _nowUtc = widget.nowUtc ?? () => DateTime.now().toUtc();
    _load();
  }

  /// Never leaves the screen on a spinner: `_loading` is cleared on every path
  /// and a failure is recoverable (the profile_tab.dart / archive_tab.dart
  /// stuck-spinner class of bug).
  Future<void> _load() async {
    try {
      final results = await Future.wait<dynamic>([
        _seriesService.getSeries(
          _userId,
          widget.metricKey,
          windowDays: _windowDays,
        ),
        _baselineService.getBaseline(_userId, widget.metricKey),
      ]);
      if (!mounted) return;
      setState(() {
        _points = results[0] as List<MetricDailyPoint>;
        _baseline = results[1] as BaselineSnapshot?;
        _loading = false;
        _error = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = true;
      });
    }
  }

  Future<void> _retry() async {
    setState(() {
      _loading = true;
      _error = false;
    });
    await _load();
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
              padding: const EdgeInsets.fromLTRB(12, 12, 24, 8),
              child: Row(
                children: [
                  IconButton(
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const Icon(
                      Icons.arrow_back_rounded,
                      color: OurobionColors.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          MetricDetailCopy.eyebrow,
                          style: GoogleFonts.manrope(
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 1.6,
                            color: OurobionColors.primary,
                          ),
                        ),
                        const SizedBox(height: 7),
                        Text(
                          widget.title,
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
                ],
              ),
            ),
            Expanded(child: _body()),
          ],
        ),
      ),
    );
  }

  Widget _body() {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_error) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 40),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                TrendCopy.loadError,
                textAlign: TextAlign.center,
                style: GoogleFonts.manrope(
                  fontSize: 13,
                  color: OurobionColors.outline,
                  height: 1.5,
                ),
              ),
              const SizedBox(height: 12),
              OutlinedButton(
                onPressed: _retry,
                child: Text(TrendCopy.retry),
              ),
            ],
          ),
        ),
      );
    }

    final points = _points;
    return ListView(
      padding: const EdgeInsets.fromLTRB(24, 8, 24, 32),
      children: [
        if (points.isEmpty)
          // NO chart in this branch — see MetricDetailCopy.emptyTitle.
          const _EmptyHistoryCard()
        else ...[
          _LatestReadingCard(
            metricKey: widget.metricKey,
            latest: points.last,
            nowUtc: _nowUtc(),
          ),
          const SizedBox(height: 13),
          _SectionEyebrow(MetricDetailCopy.historyLabel),
          const SizedBox(height: 10),
          _HistoryCard(metricKey: widget.metricKey, points: points),
        ],
        const SizedBox(height: 20),
        _SectionEyebrow(MetricDetailCopy.baselineLabel),
        const SizedBox(height: 10),
        _BaselineCard(metricKey: widget.metricKey, baseline: _baseline),
      ],
    );
  }
}

// ── Sub-widgets ────────────────────────────────────────────────────────────────

/// The design's section eyebrow with its fading gold hairline (design line 204).
class _SectionEyebrow extends StatelessWidget {
  final String label;
  const _SectionEyebrow(this.label);

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Text(
          label,
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

class _EmptyHistoryCard extends StatelessWidget {
  const _EmptyHistoryCard();

  @override
  Widget build(BuildContext context) {
    return GoldCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            MetricDetailCopy.emptyTitle,
            style: GoogleFonts.manrope(
              fontSize: 17,
              fontWeight: FontWeight.w600,
              letterSpacing: -0.3,
              color: OurobionColors.onSurface,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            MetricDetailCopy.emptyBody,
            style: GoogleFonts.manrope(
              fontSize: 12.5,
              color: OurobionColors.outline,
              height: 1.6,
            ),
          ),
        ],
      ),
    );
  }
}

class _LatestReadingCard extends StatelessWidget {
  final String metricKey;
  final MetricDailyPoint latest;
  final DateTime nowUtc;
  const _LatestReadingCard({
    required this.metricKey,
    required this.latest,
    required this.nowUtc,
  });

  /// How stale the newest reading is, from the real gap between its `log_date`
  /// and today. Today / yesterday / N days ago — never silence, which would let
  /// an old number read as current.
  String get _recency {
    final today = DateTime.utc(nowUtc.year, nowUtc.month, nowUtc.day);
    final days = today.difference(latest.date).inDays;
    if (days <= 0) return MetricDetailCopy.recordedToday;
    if (days == 1) return MetricDetailCopy.recordedYesterday;
    return MetricDetailCopy.recordedDaysAgo(days);
  }

  String? get _sourceLine => switch (latest.source) {
    'self_report' => MetricDetailCopy.sourceSelfReport,
    'wearable' => MetricDetailCopy.sourceWearable,
    'signal' => MetricDetailCopy.sourceSignal,
    _ => null,
  };

  @override
  Widget build(BuildContext context) {
    final suffix = metricValueSuffix(metricKey);
    final source = _sourceLine;
    return GoldCard(
      emphasized: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            MetricDetailCopy.latestLabel,
            style: GoogleFonts.manrope(
              fontSize: 9,
              fontWeight: FontWeight.w700,
              letterSpacing: 1.4,
              color: OurobionColors.brandGoldLight,
            ),
          ),
          const SizedBox(height: 10),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(
                formatMetricValue(metricKey, latest.value),
                style: GoogleFonts.manrope(
                  fontSize: 31,
                  fontWeight: FontWeight.w600,
                  letterSpacing: -1,
                  color: OurobionColors.onSurface,
                ),
              ),
              if (suffix != null) ...[
                const SizedBox(width: 4),
                Text(
                  suffix,
                  style: GoogleFonts.manrope(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: OurobionColors.onSurfaceVariant,
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 9),
          Text(
            '$_recency · ${shortDateLabel(latest.date)}',
            style: GoogleFonts.manrope(
              fontSize: 11.5,
              fontWeight: FontWeight.w600,
              color: OurobionColors.primary,
            ),
          ),
          if (source != null) ...[
            const SizedBox(height: 4),
            Text(
              source,
              style: GoogleFonts.manrope(
                fontSize: 11,
                color: OurobionColors.outline,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _HistoryCard extends StatelessWidget {
  final String metricKey;
  final List<MetricDailyPoint> points;
  const _HistoryCard({required this.metricKey, required this.points});

  static final _axisStyle = GoogleFonts.manrope(
    fontSize: 10,
    fontWeight: FontWeight.w600,
    color: OurobionColors.outline,
  );

  @override
  Widget build(BuildContext context) {
    return GoldCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  MetricDetailCopy.axisUnit(metricKey),
                  style: GoogleFonts.manrope(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: OurobionColors.onSurfaceVariant,
                  ),
                ),
              ),
              Text(TrendCopy.windowLabel, style: _axisStyle),
            ],
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 190,
            // The shared painter — not a second charting path. It plots one dot
            // per real day at a DATE-proportional x, so gaps stay gaps.
            child: CustomPaint(
              painter: TrendChartPainter(points: points),
              child: const SizedBox.expand(),
            ),
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              Text(shortDateLabel(points.first.date), style: _axisStyle),
              const Spacer(),
              if (points.length > 1)
                Text(shortDateLabel(points.last.date), style: _axisStyle),
            ],
          ),
          if (points.length < 2) ...[
            const SizedBox(height: 10),
            Text(
              MetricDetailCopy.singlePointNote,
              style: GoogleFonts.manrope(
                fontSize: 11.5,
                color: OurobionColors.outline,
                height: 1.5,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _BaselineCard extends StatelessWidget {
  final String metricKey;
  final BaselineSnapshot? baseline;
  const _BaselineCard({required this.metricKey, required this.baseline});

  static String _confidence(BaselineConfidence c) => switch (c) {
    BaselineConfidence.high => MetricDetailCopy.confidenceHigh,
    BaselineConfidence.medium => MetricDetailCopy.confidenceMedium,
    BaselineConfidence.low => MetricDetailCopy.confidenceLow,
    BaselineConfidence.insufficient => MetricDetailCopy.confidenceInsufficient,
  };

  static String _direction(BaselineTrend? t) => switch (t) {
    BaselineTrend.rising => MetricDetailCopy.directionRising,
    BaselineTrend.falling => MetricDetailCopy.directionFalling,
    BaselineTrend.stable => MetricDetailCopy.directionSteady,
    null => MetricDetailCopy.directionUnknown,
  };

  @override
  Widget build(BuildContext context) {
    final b = baseline;
    if (b == null) {
      return GoldCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              MetricDetailCopy.noBaselineTitle,
              style: GoogleFonts.manrope(
                fontSize: 15,
                fontWeight: FontWeight.w600,
                color: OurobionColors.onSurface,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              MetricDetailCopy.noBaselineBody,
              style: GoogleFonts.manrope(
                fontSize: 12,
                color: OurobionColors.outline,
                height: 1.6,
              ),
            ),
          ],
        ),
      );
    }

    // Only rows whose number genuinely exists on the snapshot are rendered — a
    // baseline computed without a mean shows no "Average" row rather than a 0.
    final rows = <(String, String)>[
      if (b.mean != null)
        (MetricDetailCopy.meanLabel, formatMetricValue(metricKey, b.mean!)),
      if (b.min != null && b.max != null)
        (
          MetricDetailCopy.rangeLabel,
          '${formatMetricValue(metricKey, b.min!)} – '
              '${formatMetricValue(metricKey, b.max!)}',
        ),
      (MetricDetailCopy.daysLabel, b.daysOfData.toString()),
      (MetricDetailCopy.confidenceLabel, _confidence(b.confidence)),
      (MetricDetailCopy.directionLabel, _direction(b.trend)),
    ];

    return GoldCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (var i = 0; i < rows.length; i++) ...[
            if (i > 0)
              Divider(
                height: 21,
                color: OurobionColors.primary.withValues(alpha: 0.15),
              ),
            Row(
              children: [
                Expanded(
                  child: Text(
                    rows[i].$1,
                    style: GoogleFonts.manrope(
                      fontSize: 12.5,
                      color: OurobionColors.outline,
                    ),
                  ),
                ),
                Text(
                  rows[i].$2,
                  style: GoogleFonts.manrope(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w700,
                    color: OurobionColors.onSurface,
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
