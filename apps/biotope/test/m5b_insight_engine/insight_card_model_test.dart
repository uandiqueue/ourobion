// U21 (audit A25): the app-local InsightCard model parses the §S8 producer
// columns and the 'relationship' category, and distinguishes research-linked
// (edge producer + citations) from still-researching (personal producer, none).
//
// The model is a field-for-field twin of the shared Dart mirror
// (shared/types/index.dart) until the D18 import lands — see the TODO(D18) in
// impl/insight_service.dart.

import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:src/modules/m5b_insight_engine/impl/insight_service.dart';

Map<String, dynamic> _row(String json) =>
    jsonDecode(json) as Map<String, dynamic>;

const _edgeRowJson = '''
{
  "id": 4711,
  "user_id": "8f14e45f-ceea-467f-a1d2-91a2b3c4d5e6",
  "generated_at": "2026-07-17T06:00:00.000Z",
  "title": "Research-linked pattern: sleep duration and gut comfort",
  "body": "Your sleep duration data shifted downward today.",
  "category": "relationship",
  "severity": "info",
  "contributing_metrics": ["sleep_duration_min", "gut_comfort_score"],
  "confidence_score": 0.82,
  "confidence_sources": ["brain", "self_report", "signal"],
  "status": "active",
  "expires_at": "2026-07-20T06:00:00.000Z",
  "rule_id": "edge:sleep_duration_min->gut_comfort_score",
  "phase_generated": "p2s8",
  "producer": "edge",
  "insight_id": "3f7a2c9d1e5b8a4c",
  "edge_refs": [
    {"edgeId": "sleep_duration_min->gut_comfort_score", "verifiedAt": "2026-07-10T00:00:00Z"}
  ]
}
''';

void main() {
  group('InsightCard §S8 parsing (A25)', () {
    test('edge-producer relationship row parses category, producer, edge_refs', () {
      final card = InsightCard.fromJson(_row(_edgeRowJson));

      expect(card.category, InsightCategory.relationship);
      expect(card.producer, InsightProducer.edge);
      expect(card.insightId, '3f7a2c9d1e5b8a4c');
      expect(card.edgeRefs, hasLength(1));
      expect(card.edgeRefs.single.edgeId,
          'sleep_duration_min->gut_comfort_score');
      expect(card.edgeRefs.single.verifiedAt, '2026-07-10T00:00:00Z');

      // The card owes the user a citation affordance.
      expect(card.isResearchLinked, isTrue);
      expect(card.isStillResearching, isFalse);
    });

    test('personal-producer relationship row is the still-researching state', () {
      final row = _row(_edgeRowJson)
        ..['producer'] = 'personal'
        ..['insight_id'] = null
        ..['edge_refs'] = <dynamic>[];
      final card = InsightCard.fromJson(row);

      expect(card.category, InsightCategory.relationship);
      expect(card.producer, InsightProducer.personal);
      expect(card.edgeRefs, isEmpty);
      expect(card.isStillResearching, isTrue);
      expect(card.isResearchLinked, isFalse);
    });

    test('legacy pre-migration row (no producer keys) gets the DB defaults', () {
      final row = _row(_edgeRowJson)
        ..['category'] = 'hydration'
        ..remove('producer')
        ..remove('insight_id')
        ..remove('edge_refs');
      final card = InsightCard.fromJson(row);

      expect(card.category, InsightCategory.hydration);
      expect(card.producer, InsightProducer.rules);
      expect(card.insightId, isNull);
      expect(card.edgeRefs, isEmpty);
      expect(card.isResearchLinked, isFalse);
      expect(card.isStillResearching, isFalse);
    });

    test('unknown category still falls back to descriptive', () {
      final row = _row(_edgeRowJson)..['category'] = 'some_future_category';
      expect(InsightCard.fromJson(row).category, InsightCategory.descriptive);
    });
  });
}
