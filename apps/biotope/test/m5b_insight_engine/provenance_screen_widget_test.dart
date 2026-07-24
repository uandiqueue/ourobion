// U7 provenance screen widget test. The screen takes an injectable service,
// so this never touches Supabase.instance (the initialize blocker that keeps
// other screens out of widget tests).
//
// Honesty assertions (O12 locked / D15): the uncited personal case renders
// plainly with no research decoration, and every rendered verdict carries the
// TEST-MODE stamp.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:src/modules/m5b_insight_engine/impl/insight_service.dart';
import 'package:src/modules/m5b_insight_engine/impl/provenance_models.dart';
import 'package:src/modules/m5b_insight_engine/impl/provenance_service.dart';
import 'package:src/modules/m5b_insight_engine/ui/screens/insight_provenance_screen.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class _FakeProvenanceService extends ProvenanceService {
  final InsightProvenance? result;
  _FakeProvenanceService(this.result)
    // autoRefreshToken off: the default GoTrue auto-refresh timer trips the
    // test binding's pending-timers invariant.
    : super(SupabaseClient(
        'http://localhost',
        'test-key',
        authOptions: const AuthClientOptions(autoRefreshToken: false),
      ));

  @override
  Future<InsightProvenance?> getProvenance(int cardId) async => result;
}

InsightCard _card({String producer = 'rules'}) {
  return InsightCard(
    id: 2,
    userId: 'u-test',
    ruleId: 'gut_comfort_trending_down',
    generatedAt: DateTime.utc(2026, 7, 24, 9, 37),
    title: 'Gut comfort trending down',
    body: 'Your gut comfort scores have drifted lower this week.',
    category: InsightCategory.gut,
    severity: InsightSeverity.info,
    contributingMetrics: const ['gut_comfort_score'],
    confidenceScore: 0.8,
    confidenceSources: const ['self_report'],
    status: InsightStatus.active,
    phaseGenerated: 'p2s8',
    producer: producer == 'personal'
        ? InsightProducer.personal
        : InsightProducer.rules,
  );
}

ProvenanceCardInfo _cardInfo({String producer = 'rules'}) {
  return ProvenanceCardInfo(
    id: 2,
    ruleId: 'gut_comfort_trending_down',
    title: 'Gut comfort trending down',
    body: 'Your gut comfort scores have drifted lower this week.',
    producer: producer,
    category: 'gut',
    severity: 'info',
    generatedAt: '2026-07-24T09:37:53.975+00:00',
  );
}

Future<void> _pump(
  WidgetTester tester,
  InsightProvenance? provenance, {
  String producer = 'rules',
}) async {
  await tester.pumpWidget(
    MaterialApp(
      home: InsightProvenanceScreen(
        card: _card(producer: producer),
        service: _FakeProvenanceService(provenance),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('rules card renders honest no-citation note, no verdicts', (
    tester,
  ) async {
    await _pump(tester, InsightProvenance(card: _cardInfo()));

    expect(find.text(ProvenanceCopy.screenTitle), findsOneWidget);
    expect(find.text('Gut comfort trending down'), findsOneWidget);
    expect(find.text(ProvenanceCopy.noEdgesRules), findsOneWidget);
    // No research decoration anywhere.
    expect(find.textContaining(ProvenanceCopy.verdictPrefix), findsNothing);
    expect(find.text(ProvenanceCopy.testModeVerdictLabel), findsNothing);
  });

  testWidgets('personal card renders own-data note + observational stats', (
    tester,
  ) async {
    await _pump(
      tester,
      InsightProvenance(
        card: _cardInfo(producer: 'personal'),
        patternKey: 'personal:gut_comfort_score|mood_score',
        branch: 'idiosyncratic',
        completeness: const ProvenanceCompleteness(
          score: 0.9,
          daysPresent: 27,
          windowDays: 28,
          perMetric: {'gut_comfort_score': 27, 'mood_score': 27},
        ),
        personal: const ProvenancePersonal(
          rho: 0.95,
          nEff: 27,
          qValue: 0.004,
          stable: true,
        ),
      ),
      producer: 'personal',
    );

    expect(find.text(ProvenanceCopy.noEdgesPersonal), findsOneWidget);
    expect(find.textContaining('ρ 0.95'), findsOneWidget);
    expect(
      find.textContaining(ProvenanceCopy.effectiveDaysSuffix),
      findsOneWidget,
    );
    expect(find.textContaining(ProvenanceCopy.stableWord), findsOneWidget);
    expect(
      find.textContaining('27 / 28${ProvenanceCopy.daysWithDataSuffix}'),
      findsOneWidget,
    );
    // Still no verdict decoration.
    expect(find.textContaining(ProvenanceCopy.verdictPrefix), findsNothing);
  });

  testWidgets('edge card renders citation chain + TEST-MODE verdict stamp', (
    tester,
  ) async {
    await _pump(
      tester,
      InsightProvenance(
        card: _cardInfo(producer: 'edge'),
        patternKey: 'signal:sleep_duration_min:down',
        branch: 'agree',
        edges: const [
          ProvenanceEdge(
            edgeId: 'sleep_duration_min->gut_comfort_score',
            subject: 'sleep_duration_min',
            object: 'gut_comfort_score',
            relation: 'increases',
            direction: 'consistent',
            servingBand: 'core',
            edgeScore: 0.82,
            verdict: 'agree',
            verifiedAt: '2026-07-10T00:00:00Z',
            derivation: 'Synthesised from two cohort studies.',
            population: 'healthy adults 18-40',
            quoteSpans: [
              ProvenanceQuoteSpan(
                paperId: 'paper-1',
                quote: 'Shorter sleep was associated with lower comfort.',
                locator: 'Results, p. 4',
              ),
            ],
            citations: [
              ProvenanceCitation(
                paperId: 'paper-1',
                title: 'Sleep and gut comfort: a cohort study',
                year: 2023,
                evidenceTier: 'cohort',
                impactTier: 'mid',
                stance: 'supports',
                evidence: [
                  ProvenanceEvidencePassage(
                    text: 'Comfort declined 0.4 points per lost hour.',
                    locator: 'Table 2',
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
      producer: 'rules',
    );

    expect(
      find.textContaining('sleep_duration_min · increases'),
      findsOneWidget,
    );
    expect(
      find.textContaining('${ProvenanceCopy.verdictPrefix}agree'),
      findsOneWidget,
    );
    // D15 honesty: the verdict carries the TEST-MODE stamp, verbatim.
    expect(find.text(ProvenanceCopy.testModeVerdictLabel), findsOneWidget);
    expect(find.textContaining('Shorter sleep was associated'), findsOneWidget);
    expect(find.textContaining('Sleep and gut comfort'), findsOneWidget);
    expect(find.textContaining('Comfort declined 0.4 points'), findsOneWidget);
    expect(
      find.textContaining(ProvenanceCopy.populationPrefix),
      findsOneWidget,
    );
    // The honest empty-state note must NOT appear when edges exist.
    expect(find.text(ProvenanceCopy.noEdgesRules), findsNothing);
  });

  testWidgets('null provenance (not visible) renders the plain note', (
    tester,
  ) async {
    await _pump(tester, null);
    expect(find.text(ProvenanceCopy.notVisibleBody), findsOneWidget);
  });
}
