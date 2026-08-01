import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:src/modules/m5b_insight_engine/impl/insight_service.dart';
import 'package:src/modules/m5b_insight_engine/impl/provenance_models.dart';
import 'package:src/modules/m5b_insight_engine/impl/provenance_service.dart';
import 'package:src/modules/m5b_insight_engine/ui/screens/insight_provenance_screen.dart';
import 'package:src/modules/m5b_insight_engine/ui/widgets/insight_card_visual.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

const kPaperId = '10.1016/j.isci.2026.116224';
const kPaperTitle =
    'Unraveling the gut microbiota-brain axis: Mechanisms, pathophysiology, '
    'and therapeutic opportunities.';
const kEvidenceQuote =
    'A parallel RCT in IBS patients comorbid with anxiety and depression '
    'demonstrated that 12 weeks of oral FMT capsules significantly reduced '
    'both IBS severity scores and anxiety/depression scores compared to empty '
    'capsule controls, reinforcing the gut-brain-behavior connection in this '
    'population.';
const kMechanismQuote =
    'In IBS, psychological stress activates the HPA axis, releasing CORT '
    'which affects gut motility and sensitivity, while dysbiotic microbiota '
    'independently generates neuroactive metabolites acting on the ENS, '
    'illustrating the bidirectional gut-brain nature of IBS pathophysiology.';
const kCanonicalPaperExcerpt = '$kEvidenceQuote $kMechanismQuote';
const kCaveat =
    'The evidence comes from one observational cohort, so the relationship '
    'may not transfer to every setting.';

const kEvidenceSpan = ProvenanceQuoteSpan(
  paperId: kPaperId,
  quote: kEvidenceQuote,
  locator: 'Results',
  charStart: 0,
  charEnd: 294,
);
const kMechanismSpan = ProvenanceQuoteSpan(
  paperId: kPaperId,
  quote: kMechanismQuote,
  locator: 'mechanism:Discussion',
  charStart: 295,
  charEnd: 572,
);

class _FakeProvenanceService extends ProvenanceService {
  final InsightProvenance result;

  _FakeProvenanceService(this.result)
    : super(
        SupabaseClient(
          'http://localhost',
          'test-key',
          authOptions: const AuthClientOptions(autoRefreshToken: false),
        ),
      );

  @override
  Future<InsightProvenance?> getProvenance(int cardId) async => result;
}

InsightCard _card() => InsightCard(
  id: 319,
  userId: 'u-test',
  ruleId: 'edge:gut_comfort_score|mood_score',
  generatedAt: DateTime.utc(2026, 8, 1),
  title: 'Gut comfort and mood moved together',
  body: 'Your recent logs show these measures moving together.',
  category: InsightCategory.relationship,
  severity: InsightSeverity.info,
  contributingMetrics: const ['gut_comfort_score', 'mood_score'],
  confidenceScore: 0.8,
  confidenceSources: const ['research'],
  status: InsightStatus.active,
  phaseGenerated: 'p2s8',
  producer: InsightProducer.edge,
);

ProvenanceCardInfo _cardInfo() => const ProvenanceCardInfo(
  id: 319,
  ruleId: 'edge:gut_comfort_score|mood_score',
  title: 'Gut comfort and mood moved together',
  body: 'Your recent logs show these measures moving together.',
  producer: 'edge',
  category: 'relationship',
  severity: 'info',
  generatedAt: '2026-08-01T00:00:00Z',
);

InsightProvenance _provenance({bool includeMechanism = true}) {
  return InsightProvenance(
    card: _cardInfo(),
    edges: [
      ProvenanceEdge(
        edgeId: 'gut_comfort_score|correlates|mood_score',
        subject: 'gut_comfort_score',
        object: 'mood_score',
        relation: 'correlates',
        caveat: kCaveat,
        quoteSpans: [kEvidenceSpan, if (includeMechanism) kMechanismSpan],
        citations: const [
          ProvenanceCitation(
            paperId: kPaperId,
            title: kPaperTitle,
            year: 2026,
            evidenceTier: 4,
            stance: 'supports',
          ),
        ],
      ),
    ],
  );
}

Future<void> _pump(WidgetTester tester, {bool includeMechanism = true}) async {
  await tester.pumpWidget(
    MaterialApp(
      home: InsightProvenanceScreen(
        card: _card(),
        service: _FakeProvenanceService(
          _provenance(includeMechanism: includeMechanism),
        ),
        openExternalLink: (_) async => true,
      ),
    ),
  );
  await tester.pumpAndSettle();
}

Future<List<Uri>> _pumpDeckEvidence(
  WidgetTester tester, {
  bool includeMechanism = true,
}) async {
  final opened = <Uri>[];
  await tester.pumpWidget(
    MaterialApp(
      home: Scaffold(
        body: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: ResearchBasis(
            cardId: 319,
            loadProvenance: (_) async =>
                _provenance(includeMechanism: includeMechanism),
            openExternalPaper: (uri) async {
              opened.add(uri);
              return true;
            },
          ),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
  return opened;
}

void main() {
  group('post-#300 quote-span parity', () {
    test('evidence and mechanism pass the exact-offset quote gate', () {
      expect(
        kCanonicalPaperExcerpt.substring(
          kEvidenceSpan.charStart!,
          kEvidenceSpan.charEnd!,
        ),
        kEvidenceSpan.quote,
      );
      expect(
        kCanonicalPaperExcerpt.substring(
          kMechanismSpan.charStart!,
          kMechanismSpan.charEnd!,
        ),
        kMechanismSpan.quote,
      );
      expect(kEvidenceSpan.isMechanism, isFalse);
      expect(kEvidenceSpan.section, 'Results');
      expect(kMechanismSpan.isMechanism, isTrue);
      expect(kMechanismSpan.section, 'Discussion');
      expect(
        const ProvenanceCitation(
          paperId: 'doi:10.1016/j.isci.2026.116224',
        ).matchesPaperId(kPaperId),
        isTrue,
      );
      final padded = ProvenanceQuoteSpan.tryFromJson({
        'paperId': kPaperId,
        'quote': '  retained exactly  ',
        'locator': 'Results',
      });
      expect(padded?.quote, '  retained exactly  ');
    });

    test(
      'malformed nested provenance is omitted without invented evidence',
      () {
        final edge = ProvenanceEdge.fromJson({
          'edgeId': 'fixture-edge',
          'quoteSpans': [
            null,
            42,
            {'paperId': '', 'quote': 'must not render'},
            {
              'paperId': kPaperId,
              'quote': kMechanismQuote,
              'locator': 'mechanism:Discussion',
              'charStart': 'not-an-offset',
              'charEnd': 572,
            },
          ],
          'citations': [
            null,
            {'paperId': ''},
            {
              'paperId': kPaperId,
              'title': 7,
              'evidence': [
                {'text': ''},
                {'text': 'Retained verifier passage.', 'locator': 9},
              ],
            },
          ],
        });

        expect(edge.quoteSpans, hasLength(1));
        expect(edge.quoteSpans.single.quote, kMechanismQuote);
        expect(edge.quoteSpans.single.charStart, isNull);
        expect(edge.quoteSpans.single.charEnd, 572);
        expect(edge.citations, hasLength(1));
        expect(edge.citations.single.title, isNull);
        expect(edge.citations.single.evidence, hasLength(1));
        expect(
          edge.citations.single.evidence.single.text,
          'Retained verifier passage.',
        );
        expect(edge.citations.single.evidence.single.locator, isNull);
      },
    );
  });

  group('paper evidence-chain rendering', () {
    testWidgets(
      'paper, link, verbatim evidence, and mechanism render together',
      (tester) async {
        await _pump(tester);

        expect(find.text(ProvenanceCopy.citationsLabel), findsOneWidget);
        expect(find.text(ProvenanceCopy.caveatLabel), findsOneWidget);
        expect(find.text(kCaveat), findsOneWidget);
        expect(find.textContaining(kPaperTitle), findsOneWidget);
        expect(find.text(ProvenanceCopy.openPaper), findsOneWidget);
        expect(find.text(ProvenanceCopy.verbatimEvidenceLabel), findsOneWidget);
        expect(find.text(kEvidenceQuote), findsOneWidget);
        expect(find.text('Results'), findsOneWidget);
        expect(find.text(ProvenanceCopy.mechanismLabel), findsOneWidget);
        expect(find.text(kMechanismQuote), findsOneWidget);
        expect(find.text('Discussion'), findsOneWidget);
        expect(find.textContaining('mechanism:'), findsNothing);
        expect(find.text(ProvenanceCopy.evidenceUnavailable), findsNothing);
        expect(find.text(ProvenanceCopy.mechanismUnavailable), findsNothing);
      },
    );

    testWidgets('complete chain remains usable at 390x844', (tester) async {
      tester.view.physicalSize = const Size(390, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await _pump(tester);
      await tester.scrollUntilVisible(find.text(kMechanismQuote), 200);
      await tester.pumpAndSettle();

      expect(find.textContaining(kPaperTitle), findsOneWidget);
      expect(find.text(kCaveat), findsOneWidget);
      expect(find.text(kEvidenceQuote), findsOneWidget);
      expect(find.text(kMechanismQuote), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('an absent mechanism stays explicitly unavailable', (
      tester,
    ) async {
      await _pump(tester, includeMechanism: false);

      expect(find.text(kEvidenceQuote), findsOneWidget);
      expect(find.text(ProvenanceCopy.mechanismLabel), findsOneWidget);
      expect(find.text(ProvenanceCopy.mechanismUnavailable), findsOneWidget);
      expect(find.text(kMechanismQuote), findsNothing);
    });
  });

  group('deck-card evidence chain', () {
    testWidgets(
      'paper title, verbatim sentence, source link, and optional mechanism are surfaced',
      (tester) async {
        final opened = await _pumpDeckEvidence(tester);

        expect(find.text(InsightCardCopy.paperEvidenceLabel), findsOneWidget);
        expect(find.textContaining(kPaperTitle), findsOneWidget);
        expect(
          find.text(InsightCardCopy.verbatimEvidenceLabel),
          findsOneWidget,
        );
        expect(find.text(kEvidenceQuote), findsOneWidget);
        expect(find.text(InsightCardCopy.mechanismLabel), findsOneWidget);
        expect(find.text(kMechanismQuote), findsOneWidget);
        expect(find.text(InsightCardCopy.openSource), findsOneWidget);
        expect(
          find.textContaining('gut_comfort_score|correlates|mood_score'),
          findsNothing,
        );

        await tester.tap(find.text(InsightCardCopy.openSource));
        await tester.pump();
        expect(opened, [Uri.parse('https://doi.org/$kPaperId')]);
      },
    );

    testWidgets('an absent mechanism leaves a complete compact card at 390px', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(390, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await _pumpDeckEvidence(tester, includeMechanism: false);

      expect(find.textContaining(kPaperTitle), findsOneWidget);
      expect(find.text(kEvidenceQuote), findsOneWidget);
      expect(find.text(InsightCardCopy.openSource), findsOneWidget);
      expect(find.text(InsightCardCopy.mechanismLabel), findsNothing);
      expect(find.text(kMechanismQuote), findsNothing);
      expect(tester.takeException(), isNull);
    });
  });
}
