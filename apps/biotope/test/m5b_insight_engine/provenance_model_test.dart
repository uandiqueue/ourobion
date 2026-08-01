// U7 provenance view: the RPC JSON → Dart parsing for get_insight_provenance
// (contract in supabase/migrations/20260724085023_create_o12_insight_provenance_rpc.sql).
// Fixtures cover the three real shapes: a fully-cited edge card, the honest
// "from your own data" personal card (edges [] + personal present), and a
// plain rules card (all composition fields null).

import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:src/modules/m5b_insight_engine/impl/provenance_models.dart';

Map<String, dynamic> _json(String s) => jsonDecode(s) as Map<String, dynamic>;

const _edgeCardJson = '''
{
  "card": {
    "id": 4711,
    "ruleId": "edge:sleep_duration_min->gut_comfort_score",
    "title": "Research-linked pattern: sleep duration and gut comfort",
    "body": "Your sleep duration data shifted downward today.",
    "producer": "edge",
    "category": "relationship",
    "severity": "info",
    "generatedAt": "2026-07-24T06:00:00+00:00"
  },
  "patternKey": "signal:sleep_duration_min:down",
  "branch": "agree",
  "completeness": {
    "score": 0.75,
    "daysPresent": 21,
    "windowDays": 28,
    "perMetric": {"sleep_duration_min": 21, "gut_comfort_score": 20}
  },
  "personal": {"rho": 0.948, "nEff": 16.4, "qValue": 0.00001, "stable": true},
  "edges": [
    {
      "edgeId": "sleep_duration_min->gut_comfort_score",
      "subject": "sleep_duration_min",
      "object": "gut_comfort_score",
      "relation": "increases",
      "direction": "consistent",
      "servingBand": "core",
      "edgeScore": 0.82,
      "verdict": "agree",
      "verifiedAt": "2026-07-10T00:00:00Z",
      "caveat": "The evidence comes from one observational cohort, so the relationship may not transfer to every setting.",
      "derivation": "Synthesised from two cohort studies reporting the association.",
      "population": "healthy adults 18-40",
      "quoteSpans": [
        {
          "paperId": "paper-1",
          "quote": "Shorter sleep was associated with lower next-day comfort scores.",
          "locator": "Results, p. 4",
          "charStart": 1042,
          "charEnd": 1105
        },
        {
          "paperId": "paper-2",
          "quote": "We observed a dose-response relationship.",
          "locator": null,
          "charStart": null,
          "charEnd": null
        }
      ],
      "citations": [
        {
          "paperId": "paper-1",
          "title": "Sleep and gastrointestinal comfort: a cohort study",
          "year": 2023,
          "population": "shift workers, n=412",
          "evidenceTier": 4,
          "impactTier": "moderate",
          "stance": "supports",
          "evidence": [
            {"text": "Comfort declined 0.4 points per lost hour.", "locator": "Table 2"}
          ]
        },
        {
          "paperId": "paper-2",
          "title": null,
          "year": null,
          "population": null,
          "evidenceTier": 3,
          "impactTier": "low",
          "stance": "mentions"
        }
      ]
    }
  ]
}
''';

const _personalCardJson = '''
{
  "card": {
    "id": 4712,
    "ruleId": "personal:gut_comfort_score|mood_score",
    "title": "Pattern in your data: gut comfort and mood",
    "body": "These two metrics move together in your logs.",
    "producer": "personal",
    "category": "relationship",
    "severity": "info",
    "generatedAt": "2026-07-24T06:00:00+00:00"
  },
  "patternKey": "personal:gut_comfort_score|mood_score",
  "branch": "idiosyncratic",
  "completeness": {
    "score": 0.9,
    "daysPresent": 27,
    "windowDays": 28,
    "perMetric": {"gut_comfort_score": 27, "mood_score": 27}
  },
  "personal": {"rho": -0.61, "nEff": 27, "qValue": 0.004, "stable": false},
  "edges": []
}
''';

const _rulesCardJson = '''
{
  "card": {
    "id": 2,
    "ruleId": "gut_comfort_trending_down",
    "title": "Gut comfort trending down",
    "body": "Your gut comfort scores have drifted lower this week.",
    "producer": "rules",
    "category": "gut",
    "severity": "info",
    "generatedAt": "2026-07-24T09:37:53.975+00:00"
  },
  "patternKey": null,
  "branch": null,
  "completeness": null,
  "personal": null,
  "edges": []
}
''';

void main() {
  group('citation paper links', () {
    test('real DOI metadata becomes the canonical HTTPS resolver', () {
      const citation = ProvenanceCitation(
        paperId: 'doi:10.1016/j.isci.2026.116224',
        title: 'Unraveling the gut microbiota-brain axis',
        year: 2026,
      );
      expect(
        citation.paperUri,
        Uri.parse('https://doi.org/10.1016/j.isci.2026.116224'),
      );
    });

    test('accepted DOI wrappers resolve to one lowercase canonical URI', () {
      const expected = 'https://doi.org/10.1038/s41586-020-2649-2';
      for (final paperId in [
        '10.1038/S41586-020-2649-2',
        'DOI:10.1038/S41586-020-2649-2',
        ' https://doi.org/10.1038/S41586-020-2649-2 ',
        'https://dx.doi.org/10.1038/S41586-020-2649-2',
      ]) {
        expect(
          ProvenanceCitation(paperId: paperId).paperUri.toString(),
          expected,
        );
      }
    });

    test('internal IDs and active-content strings never become links', () {
      for (final paperId in [
        'corpus:01TEST',
        'paper-1',
        'javascript:alert(1)',
        'http://doi.org/10.1038/S41586-020-2649-2',
        'https://example.com/not-a-doi',
        'https://doi.org:443/10.1038/S41586-020-2649-2',
        'https://user@doi.org/10.1038/S41586-020-2649-2',
        'https://doi.org/10.1038/S41586-020-2649-2?x=1',
        'https://doi.org/10.1038/S41586-020-2649-2#section',
        'https://doi.org.example/10.1038/S41586-020-2649-2',
        '10.1234/../../evil',
        '10.1038/ S41586-020-2649-2',
        '10.1038/S41586-020-2649-2\u0000',
        '\n10.1038/S41586-020-2649-2',
        '10.1038/S41586-020-2649-2\r',
        '\t10.1038/S41586-020-2649-2',
        '\u008510.1038/S41586-020-2649-2',
      ]) {
        expect(ProvenanceCitation(paperId: paperId).paperUri, isNull);
      }
    });
  });

  group('InsightProvenance.fromJson — edge card (fully cited)', () {
    final p = InsightProvenance.fromJson(_json(_edgeCardJson));

    test('card fields round-trip', () {
      expect(p.card.id, 4711);
      expect(p.card.ruleId, 'edge:sleep_duration_min->gut_comfort_score');
      expect(p.card.producer, 'edge');
      expect(p.card.category, 'relationship');
      expect(p.card.severity, 'info');
      expect(p.card.generatedAt, '2026-07-24T06:00:00+00:00');
    });

    test('composition fields parse', () {
      expect(p.patternKey, 'signal:sleep_duration_min:down');
      expect(p.branch, 'agree');
      expect(p.completeness!.score, 0.75);
      expect(p.completeness!.daysPresent, 21);
      expect(p.completeness!.windowDays, 28);
      expect(p.completeness!.perMetric, {
        'sleep_duration_min': 21,
        'gut_comfort_score': 20,
      });
      expect(p.personal!.rho, 0.948);
      expect(p.personal!.nEff, 16.4);
      expect(p.personal!.qValue, 0.00001);
      expect(p.personal!.stable, isTrue);
    });

    test('edge parses claim + verification version', () {
      final e = p.edges.single;
      expect(e.edgeId, 'sleep_duration_min->gut_comfort_score');
      expect(e.subject, 'sleep_duration_min');
      expect(e.object, 'gut_comfort_score');
      expect(e.relation, 'increases');
      expect(e.direction, 'consistent');
      expect(e.servingBand, 'core');
      expect(e.edgeScore, 0.82);
      expect(e.verdict, 'agree');
      expect(e.verifiedAt, '2026-07-10T00:00:00Z');
      expect(e.caveat, contains('observational cohort'));
      expect(e.derivation, contains('cohort studies'));
      expect(e.population, 'healthy adults 18-40');
    });

    test('quote spans keep nullable locator/char offsets', () {
      final spans = p.edges.single.quoteSpans;
      expect(spans, hasLength(2));
      expect(spans.first.locator, 'Results, p. 4');
      expect(spans.first.charStart, 1042);
      expect(spans.first.charEnd, 1105);
      expect(spans.last.locator, isNull);
      expect(spans.last.charStart, isNull);
    });

    test('citations parse tiers, stance, and optional evidence passages', () {
      final cites = p.edges.single.citations;
      expect(cites, hasLength(2));
      expect(cites.first.title, contains('cohort study'));
      expect(cites.first.year, 2023);
      expect(cites.first.evidenceTier, 4);
      expect(cites.first.impactTier, 'moderate');
      expect(cites.first.stance, 'supports');
      expect(cites.first.evidence.single.text, contains('0.4 points'));
      expect(cites.first.evidence.single.locator, 'Table 2');
      // Second citation: evidence absent entirely → [] (additive-optional).
      expect(cites.last.title, isNull);
      expect(cites.last.year, isNull);
      expect(cites.last.evidence, isEmpty);
    });
  });

  group('InsightProvenance.fromJson — personal card (honest, uncited)', () {
    final p = InsightProvenance.fromJson(_json(_personalCardJson));

    test('edges are empty, personal is present', () {
      expect(p.card.producer, 'personal');
      expect(p.edges, isEmpty);
      expect(p.personal, isNotNull);
      expect(p.personal!.rho, -0.61);
      expect(p.personal!.nEff, 27.0); // JSON integer → double
      expect(p.personal!.stable, isFalse);
      expect(p.branch, 'idiosyncratic');
    });
  });

  group('InsightProvenance.fromJson — plain rules card', () {
    final p = InsightProvenance.fromJson(_json(_rulesCardJson));

    test('all composition fields null, edges empty', () {
      expect(p.card.id, 2);
      expect(p.card.producer, 'rules');
      expect(p.patternKey, isNull);
      expect(p.branch, isNull);
      expect(p.completeness, isNull);
      expect(p.personal, isNull);
      expect(p.edges, isEmpty);
    });
  });

  group('left-join tolerance', () {
    test('edge with missing claim/verification parses with nulls', () {
      final p = InsightProvenance.fromJson(
        _json('''
      {
        "card": {
          "id": 9, "ruleId": "r", "title": "t", "body": "b",
          "producer": "edge", "category": "relationship",
          "severity": "info", "generatedAt": "2026-07-24T06:00:00Z"
        },
        "patternKey": null, "branch": null,
        "completeness": null, "personal": null,
        "edges": [
          {
            "edgeId": "a->b",
            "subject": null, "object": null, "relation": null,
            "direction": null, "servingBand": null, "edgeScore": null,
            "verdict": null, "verifiedAt": "2026-07-10T00:00:00Z",
            "caveat": null,
            "derivation": null, "population": null,
            "quoteSpans": [], "citations": []
          }
        ]
      }
      '''),
      );
      final e = p.edges.single;
      expect(e.edgeId, 'a->b');
      expect(e.subject, isNull);
      expect(e.verdict, isNull);
      expect(e.caveat, isNull);
      expect(e.edgeScore, isNull);
      expect(e.quoteSpans, isEmpty);
      expect(e.citations, isEmpty);
    });
  });
}
