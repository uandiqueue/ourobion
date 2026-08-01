// app/lib/modules/m5a_baselines/index.dart
//
// Public interface for M5a. Other modules (M5b, M6) import from here only —
// never from /impl directly.
//
// getBaseline(userId, metricKey)  → BaselineSnapshot?   single metric lookup
// getBaselines(userId)            → List<BaselineSnapshot>  all metrics for a user
// getMetricKeys(userId)           → List<String>            metrics with data in the window (U7)
// getSeries(userId, metricKey)    → List<MetricDailyPoint>  trailing daily series (U7)

export 'impl/baseline_service.dart';
export 'impl/chart_math.dart';
export 'impl/metric_axis_policy.dart';
export 'impl/metric_series_models.dart';
export 'impl/metric_series_service.dart';
export 'impl/metric_value_format.dart';
