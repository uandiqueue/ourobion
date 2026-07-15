// app/lib/modules/m5a_baselines/index.dart
//
// Public interface for M5a. Other modules (M5b, M6) import from here only —
// never from /impl directly.
//
// getBaseline(userId, metricKey)  → BaselineSnapshot?   single metric lookup
// getBaselines(userId)            → List<BaselineSnapshot>  all metrics for a user

export 'impl/baseline_service.dart';
