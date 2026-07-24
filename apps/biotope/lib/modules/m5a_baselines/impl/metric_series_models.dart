// Pure-Dart models + parsing for the metric daily series (U7 trend view).
//
// Source of the rows: the `metric_daily_values` view (S2 joint-series
// projection, migration 20260715154000) — one row per (user, metric, day) with
// a non-null value; columns user_id, log_date, metric_key, value, source. The
// view is security_invoker so an app read only ever sees the caller's rows.
//
// This file deliberately has NO package imports so it can be executed outside
// the Flutter package (live-proof scripts, plain `dart` VM) — keep it pure.

/// One (day, value) point of a metric's daily series.
class MetricDailyPoint {
  /// Date-only, pinned to UTC midnight (log_date is a Postgres `date`).
  final DateTime date;
  final double value;

  /// Truth-table provenance from the view: 'self_report' | 'wearable' | 'signal'.
  final String source;

  const MetricDailyPoint({
    required this.date,
    required this.value,
    required this.source,
  });

  factory MetricDailyPoint.fromJson(Map<String, dynamic> json) {
    return MetricDailyPoint(
      date: parseDateOnly(json['log_date'] as String),
      value: (json['value'] as num).toDouble(),
      source: json['source'] as String? ?? '',
    );
  }

  /// Parses a `date`-column wire value ('2026-07-24') as a UTC midnight
  /// instant. `DateTime.parse` on a zone-less string yields LOCAL time — for a
  /// calendar date that skews day boundaries for non-UTC users (A27 family).
  static DateTime parseDateOnly(String v) {
    final d = DateTime.parse(v);
    return DateTime.utc(d.year, d.month, d.day);
  }
}

/// PostgREST rows → typed series. Pure so tests and the live-proof script can
/// drive it with captured JSON.
List<MetricDailyPoint> parseSeriesRows(List<dynamic> rows) => rows
    .map((r) => MetricDailyPoint.fromJson(Map<String, dynamic>.from(r as Map)))
    .toList();

/// Distinct `metric_key` values from a bare `select('metric_key')` result,
/// sorted alphabetically (PostgREST has no DISTINCT — dedupe client-side).
List<String> distinctMetricKeys(List<dynamic> rows) {
  final keys = <String>{
    for (final r in rows) (r as Map)['metric_key'] as String,
  };
  return keys.toList()..sort();
}

/// Date-only ISO string for the window's inclusive start: [windowDays] ending
/// today (UTC). windowDays=30 → today and the 29 days before it.
String windowStartDateIso(DateTime nowUtc, int windowDays) {
  final utc = nowUtc.toUtc();
  final start = DateTime.utc(
    utc.year,
    utc.month,
    utc.day,
  ).subtract(Duration(days: windowDays - 1));
  final m = start.month.toString().padLeft(2, '0');
  final d = start.day.toString().padLeft(2, '0');
  return '${start.year}-$m-$d';
}

/// Human label for a metric key, for the picker: 'gut_comfort_score' →
/// 'Gut comfort score'. Derived from the key (data, not copy) so any metric
/// the user has rows for gets a readable label without duplicating the
/// registry (shared/metrics/registry.ts ui.label is not importable from lib/ —
/// see TODO(D18) in insight_service.dart).
String metricDisplayLabel(String key) {
  final words = key.split('_').where((w) => w.isNotEmpty).toList();
  if (words.isEmpty) return key;
  final first = words.first;
  words[0] = first[0].toUpperCase() + first.substring(1);
  return words.join(' ');
}
