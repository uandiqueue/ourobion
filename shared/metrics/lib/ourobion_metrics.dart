// Public Dart package barrel and typed accessors over the metrics registry.
// Mirrors shared/metrics/index.ts without exposing the private lib/src path.

import 'src/registry.dart';

export 'src/registry.dart';

/// Active (non-deprecated) metrics.
List<MetricDefinition> activeMetrics() {
  return kMetrics.where((m) => m.status == 'active').toList();
}

/// Look up one metric by canonical key.
MetricDefinition? metricByKey(String key) {
  for (final m in kMetrics) {
    if (m.key == key) return m;
  }
  return null;
}

/// All metrics for a table (active + deprecated, so historical rows still resolve).
List<MetricDefinition> metricsByTable(String table) {
  return kMetrics.where((m) => m.table == table).toList();
}

/// The ordered metric keys M5a should baseline for a table: active + baselineApplicable.
List<String> baselineKeys(String table) {
  return kMetrics
      .where((m) => m.table == table && m.status == 'active' && m.baselineApplicable)
      .map((m) => m.key)
      .toList();
}

/// Active keys for a table (all collected signals, not just baseline-applicable).
List<String> activeKeys(String table) {
  return kMetrics
      .where((m) => m.table == table && m.status == 'active')
      .map((m) => m.key)
      .toList();
}

/// True if `key` is a known, active registry metric — used to validate rule metricKeys.
bool isActiveMetric(String key) {
  return kMetrics.any((m) => m.key == key && m.status == 'active');
}

/// Per-key DQS weights for M6 (active metrics only).
Map<String, num> dqsWeights() {
  final out = <String, num>{};
  for (final m in kMetrics) {
    if (m.status == 'active') out[m.key] = m.dqs.weight;
  }
  return out;
}

/// Active keys that count toward a day's completeness (M6 DQS denominator).
List<String> dailyCompletenessKeys() {
  return kMetrics
      .where((m) => m.status == 'active' && m.dqs.countsTowardDailyCompleteness)
      .map((m) => m.key)
      .toList();
}
