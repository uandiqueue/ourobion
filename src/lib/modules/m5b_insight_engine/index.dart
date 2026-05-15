// app/lib/modules/m5b_insight_engine/index.dart
//
// Public interface for M5b. Other modules (M6, frontend) import from here only.
//
// getInsights(userId)       → Future<List<InsightCard>>   one-shot fetch
// watchInsights(userId)     → Stream<List<InsightCard>>   realtime updates
// updateStatus(id, status)  → Future<void>                snooze / dismiss

export 'impl/insight_service.dart';
