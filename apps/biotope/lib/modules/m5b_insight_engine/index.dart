// app/lib/modules/m5b_insight_engine/index.dart
//
// Public interface for M5b. Other modules (M6, frontend) import from here only.
//
// getInsights(userId)         → Future<List<InsightCard>>   one-shot fetch (active only)
// getSnoozedInsights(userId)  → Future<List<InsightCard>>   Archive tab's "saved" list
// watchInsights(userId)       → Stream<List<InsightCard>>   realtime updates
// updateStatus(id, status)    → Future<void>                snooze / dismiss
// getProvenance(cardId)       → Future<InsightProvenance?>  per-card provenance (U7/O12)

export 'impl/insight_service.dart';
export 'impl/provenance_models.dart';
export 'impl/provenance_service.dart';
