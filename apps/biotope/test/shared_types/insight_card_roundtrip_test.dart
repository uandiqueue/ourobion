// Behavioural test for the shared Dart InsightCard mirror (shared/types/index.dart) — the
// cross-language contract the app will import once the app-local duplicate model is retired
// (signoff decision D18; U20 revives the mirror, U28 does the app-side import).
//
// The shared mirror lives outside the Flutter package, so it is imported by relative path —
// same cross-package seam the text-parsing guards in ../guards/ cover structurally; this test
// covers the runtime behaviour: bigint id decoding, the S8 producer columns, and the
// optional-with-default tolerance for pre-migration rows (docs/memory/0002).

import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';

import '../../../../shared/types/index.dart';

void main() {
  group('shared InsightCard fromJson/toJson', () {
    // A realistic edge-producer row as PostgREST would deliver it (id is a JSON number —
    // the column is bigint identity; edge_refs is the engine's camelCase jsonb payload).
    const edgeRowJson = '''
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

    test('edge-producer row round-trips (bigint id, producer, edge_refs, relationship)', () {
      final decoded = jsonDecode(edgeRowJson) as Map<String, dynamic>;
      final card = InsightCard.fromJson(decoded);

      expect(card.id, 4711);
      expect(card.category, 'relationship');
      expect(card.producer, 'edge');
      expect(card.insightId, '3f7a2c9d1e5b8a4c');
      expect(card.edgeRefs, hasLength(1));
      expect(card.edgeRefs.single.edgeId, 'sleep_duration_min->gut_comfort_score');
      expect(card.edgeRefs.single.verifiedAt, '2026-07-10T00:00:00Z');
      expect(card.confidenceSources, contains('brain'));
      expect(card.confidenceSources, contains('signal'));

      // Round-trip: toJson must emit exactly the wire shape it was built from.
      expect(card.toJson(), equals(decoded));
    });

    test('bigint id survives a decoder that surfaces the number as double', () {
      final decoded = jsonDecode(edgeRowJson) as Map<String, dynamic>;
      decoded['id'] = 4711.0; // e.g. a JS-side re-serialization or web jsonDecode
      final card = InsightCard.fromJson(decoded);
      expect(card.id, 4711);
      expect(card.id, isA<int>());
    });

    test('legacy pre-migration row (no producer columns) gets the DB defaults', () {
      // The exact serialized shape that existed before migration 20260716050639: no
      // producer / insight_id / edge_refs keys. fromJson must tolerate the missing keys
      // with the same defaults the migration backfilled ('rules' / null / []).
      const legacyRowJson = '''
      {
        "id": 12,
        "user_id": "8f14e45f-ceea-467f-a1d2-91a2b3c4d5e6",
        "generated_at": "2026-07-10T06:00:00.000Z",
        "title": "Hydration check-in",
        "body": "Your urine colour readings ran darker than your usual range this week.",
        "category": "hydration",
        "severity": "info",
        "contributing_metrics": ["urine_colour"],
        "confidence_score": 0.6,
        "confidence_sources": ["self_report"],
        "status": "active",
        "expires_at": null,
        "rule_id": "hydration_dark_urine",
        "phase_generated": "p1s1"
      }
      ''';
      final card =
          InsightCard.fromJson(jsonDecode(legacyRowJson) as Map<String, dynamic>);

      expect(card.id, 12);
      expect(card.producer, 'rules');
      expect(card.insightId, isNull);
      expect(card.edgeRefs, isEmpty);

      // A re-serialized legacy card carries the defaults explicitly — the §S8 shape.
      final json = card.toJson();
      expect(json['producer'], 'rules');
      expect(json['insight_id'], isNull);
      expect(json['edge_refs'], isEmpty);
    });
  });
}
