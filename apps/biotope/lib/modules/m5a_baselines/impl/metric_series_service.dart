import 'package:supabase_flutter/supabase_flutter.dart';

import 'metric_series_models.dart';

/// Read service for the per-metric daily series (U7 trend view), over the
/// `metric_daily_values` view. security_invoker on the view means these reads
/// only ever see the signed-in user's rows.
class MetricSeriesService {
  final SupabaseClient _client;
  final DateTime Function() _nowUtc;

  /// [nowUtc] is injectable for tests; production uses the system UTC clock
  /// (same pattern as InsightService).
  MetricSeriesService(this._client, {DateTime Function()? nowUtc})
    : _nowUtc = nowUtc ?? _systemNowUtc;

  static DateTime _systemNowUtc() => DateTime.now().toUtc();

  /// Distinct metric keys the user actually has data for inside the window —
  /// populates the trend picker. Sorted alphabetically.
  Future<List<String>> getMetricKeys(
    String userId, {
    int windowDays = 30,
  }) async {
    final start = windowStartDateIso(_nowUtc(), windowDays);
    final data =
        await _client
                .from('metric_daily_values')
                .select('metric_key')
                .eq('user_id', userId)
                .gte('log_date', start)
            as List<dynamic>;
    return distinctMetricKeys(data);
  }

  /// The user's daily series for one metric over the trailing window
  /// (default 30 days including today), oldest first.
  Future<List<MetricDailyPoint>> getSeries(
    String userId,
    String metricKey, {
    int windowDays = 30,
  }) async {
    final start = windowStartDateIso(_nowUtc(), windowDays);
    final data =
        await _client
                .from('metric_daily_values')
                .select('log_date, value, source')
                .eq('user_id', userId)
                .eq('metric_key', metricKey)
                .gte('log_date', start)
                .order('log_date', ascending: true)
            as List<dynamic>;
    return parseSeriesRows(data);
  }
}
