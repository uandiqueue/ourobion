import 'package:flutter/material.dart'; import 'package:flutter_test/flutter_test.dart'; import 'package:src/modules/m5b_insight_engine/impl/insight_service.dart';
import 'package:src/modules/m5b_insight_engine/impl/provenance_models.dart'; import 'package:src/modules/m5b_insight_engine/impl/provenance_service.dart';
import 'package:src/modules/m5b_insight_engine/ui/screens/insight_provenance_screen.dart'; import 'package:supabase_flutter/supabase_flutter.dart'; const kRealDoi = '10.1016/j.isci.2026.116224';
const kRealDoiUrl = 'https://doi.org/10.1016/j.isci.2026.116224'; const kRealDoiTitle =
    'Unraveling the gut microbiota-brain axis: Mechanisms, pathophysiology, '
    'and therapeutic opportunities.'; const kRealDoiYear = 2026; const kCorpusId = 'corpus:gut-mood-cohort-2024'; const kCorpusTitle = 'Gut comfort and mood in a longitudinal cohort';
const kCorpusYear = 2024; class _FakeProvenanceService extends ProvenanceService {
  final InsightProvenance? result; _FakeProvenanceService(this.result)
    : super(
        SupabaseClient(
          'http://localhost',
          'test-key',
          authOptions: const AuthClientOptions(autoRefreshToken: false),
        ),
      ); @override
  Future<InsightProvenance?> getProvenance(int cardId) async => result; }
class _RecordingLauncher {
  _RecordingLauncher({this.succeeds = true}); final bool succeeds; final List<Uri> opened = []; Future<bool> call(Uri uri) async {
    opened.add(uri); return succeeds; }
}
InsightCard _card() => InsightCard(
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
  producer: InsightProducer.rules,
); ProvenanceCardInfo _cardInfo({String producer = 'edge'}) => ProvenanceCardInfo(
  id: 2,
  ruleId: 'gut_comfort_trending_down',
  title: 'Gut comfort trending down',
  body: 'Your gut comfort scores have drifted lower this week.',
  producer: producer,
  category: 'gut',
  severity: 'info',
  generatedAt: '2026-07-24T09:37:53.975+00:00',
); ProvenanceEdge _acceptedDoiEdge({
  String citationPaperId = kRealDoi,
}) => ProvenanceEdge(
  edgeId: 'gut_comfort_score|correlates|mood_score',
  subject: 'gut_comfort_score',
  object: 'mood_score',
  relation: 'correlates',
  derivation:
      'The review states the bidirectional gut-brain nature of IBS (Q1) '
      'and reports a parallel RCT in which an FMT intervention reduced '
      'both IBS severity scores and anxiety/depression scores together '
      '(Q2), asserted as a correlation rather than a directed causal '
      'claim between the two subjective metrics. Strongest supporting '
      'evidence described is an RCT (tier 4), reported within a narrative '
      'review; scope kept narrow to the studied IBS population.',
  population: 'IBS patients comorbid with anxiety and depression',
  quoteSpans: [
    ProvenanceQuoteSpan(
      paperId: kRealDoi,
      quote:
          'In IBS, psychological stress activates the HPA axis, releasing '
          'CORT which affects gut motility and sensitivity, while dysbiotic '
          'microbiota independently generates neuroactive metabolites '
          'acting on the ENS, illustrating the bidirectional gut-brain '
          'nature of IBS pathophysiology.',
      locator: 'gut-brain axis / IBS pathophysiology',
      charStart: 52301,
      charEnd: 52578,
    ),
    ProvenanceQuoteSpan(
      paperId: kRealDoi,
      quote:
          'A parallel RCT in IBS patients comorbid with anxiety and '
          'depression demonstrated that 12 weeks of oral FMT capsules '
          'significantly reduced both IBS severity scores and '
          'anxiety/depression scores compared to empty capsule controls, '
          'reinforcing the gut-brain-behavior connection in this population.',
      locator: 'therapeutic opportunities / FMT RCT',
      charStart: 53297,
      charEnd: 53591,
    ),
  ],
  citations: [
    ProvenanceCitation(
      paperId: citationPaperId,
      title: kRealDoiTitle,
      year: kRealDoiYear,
      evidenceTier: 4,
      impactTier: 'high',
      stance: 'supports',
      population: 'IBS patients comorbid with anxiety and depression',
    ),
  ],
); const _committedCorpusEdge = ProvenanceEdge(
  edgeId: 'gut_comfort_score|correlates|mood_score',
  subject: 'gut_comfort_score',
  object: 'mood_score',
  relation: 'correlates',
  derivation:
      'The cohort sentence associates gut comfort with mood, so the two correlate.',
  population: 'IBS patients comorbid with anxiety and depression',
  quoteSpans: [
    ProvenanceQuoteSpan(
      paperId: kCorpusId,
      quote:
          'Higher self-reported gut comfort was associated with better mood on validated scales.',
    ),
  ],
  citations: [
    ProvenanceCitation(
      paperId: kCorpusId,
      title: kCorpusTitle,
      year: kCorpusYear,
      population: 'adults with digestive symptoms',
      evidenceTier: 3,
      impactTier: 'high',
      stance: 'supports',
    ),
  ],
); InsightProvenance _withEdges(List<ProvenanceEdge> edges) =>
    InsightProvenance(card: _cardInfo(), edges: edges); InsightProvenance _doiProvenance([String paperId = kRealDoi]) =>
    _withEdges([_acceptedDoiEdge(citationPaperId: paperId)]); InsightProvenance _corpusProvenance() => _withEdges([_committedCorpusEdge]); InsightProvenance _mixedAccurateProvenance() =>
    _withEdges([_acceptedDoiEdge(), _committedCorpusEdge]); InsightProvenance _negativeInputProvenance(String paperId) => _withEdges([
  ProvenanceEdge(
    edgeId: 'test-only-negative-paper-id',
    citations: [ProvenanceCitation(paperId: paperId)],
  ),
]); InsightProvenance _fullyCitedProvenance() => _doiProvenance(); Finder _linkFor(String paperId) =>
    find.byKey(ValueKey('citation-link-$paperId')); int _pumpSeq = 0; Future<_RecordingLauncher> _pump(
  WidgetTester tester,
  InsightProvenance? provenance, {
  bool launchSucceeds = true,
}) async {
  final launcher = _RecordingLauncher(succeeds: launchSucceeds); await tester.pumpWidget(
    MaterialApp(
      home: InsightProvenanceScreen(
        key: ValueKey('provenance-${_pumpSeq++}'),
        card: _card(),
        service: _FakeProvenanceService(provenance),
        openExternalLink: launcher.call,
      ),
    ),
  ); await tester.pumpAndSettle(); return launcher; }
void main() {
  group('a citation with a REAL DOI renders a working external link', () {
    testWidgets('the link is present and names the action', (tester) async {
      await _pump(tester, _doiProvenance()); expect(_linkFor(kRealDoi), findsOneWidget); expect(find.text(ProvenanceCopy.openPaper), findsOneWidget);
      expect(find.byIcon(Icons.open_in_new_rounded), findsOneWidget); expect(find.text(ProvenanceCopy.paperLinkUnavailable), findsNothing); expect(
        find.textContaining('$kRealDoiTitle ($kRealDoiYear)'),
        findsOneWidget,
      ); }); testWidgets('tapping it opens the canonical doi.org URL externally', (
      tester,
    ) async {
      final launcher = await _pump(tester, _doiProvenance()); await tester.ensureVisible(_linkFor(kRealDoi)); await tester.pumpAndSettle(); await tester.tap(_linkFor(kRealDoi));
      await tester.pumpAndSettle(); expect(launcher.opened, hasLength(1)); expect(launcher.opened.single.toString(), kRealDoiUrl); expect(launcher.opened.single.scheme, 'https');
      expect(launcher.opened.single.host, 'doi.org'); }); testWidgets('the external-paper control is a semantic link (#286)', (
      tester,
    ) async {
      final semantics = tester.ensureSemantics(); await _pump(tester, _doiProvenance()); expect(
        tester.getSemantics(_linkFor(kRealDoi)).flagsCollection.isLink,
        isTrue,
        reason:
            'a control that leaves the app for doi.org must announce itself as '
            'a link, not as an ordinary button',
      ); semantics.dispose(); }); testWidgets('a doi:-prefixed stored id still opens the canonical URL', (
      tester,
    ) async {
      const stored = 'doi:$kRealDoi'; final launcher = await _pump(tester, _doiProvenance(stored)); await tester.ensureVisible(_linkFor(stored)); await tester.pumpAndSettle();
      await tester.tap(_linkFor(stored)); await tester.pumpAndSettle(); expect(launcher.opened.single.toString(), kRealDoiUrl); });
    testWidgets('an upper-cased stored DOI opens the same paper on doi.org', (
      tester,
    ) async {
      const stored = '10.1016/J.ISCI.2026.116224'; final launcher = await _pump(tester, _doiProvenance(stored)); await tester.ensureVisible(_linkFor(stored)); await tester.pumpAndSettle();
      await tester.tap(_linkFor(stored)); await tester.pumpAndSettle(); final opened = launcher.opened.single; expect(opened.scheme, 'https'); expect(opened.host, 'doi.org');
      expect(opened.toString().toLowerCase(), kRealDoiUrl); }); testWidgets('a failed launch says so rather than doing nothing', (
      tester,
    ) async {
      await _pump(tester, _doiProvenance(), launchSucceeds: false); await tester.ensureVisible(_linkFor(kRealDoi)); await tester.pumpAndSettle(); await tester.tap(_linkFor(kRealDoi));
      await tester.pumpAndSettle(); expect(find.text(ProvenanceCopy.paperLinkFailed), findsOneWidget); await tester.pumpAndSettle(const Duration(seconds: 5)); });
    testWidgets('a successful launch shows no failure notice', (tester) async {
      await _pump(tester, _doiProvenance()); await tester.ensureVisible(_linkFor(kRealDoi)); await tester.pumpAndSettle(); await tester.tap(_linkFor(kRealDoi)); await tester.pumpAndSettle();
      expect(find.text(ProvenanceCopy.paperLinkFailed), findsNothing); }); }); group('a non-DOI paperId renders the honest unavailable state', () {
    testWidgets('an internal corpus id gets a sentence, never a link', (
      tester,
    ) async {
      final launcher = await _pump(tester, _corpusProvenance()); expect(find.text(ProvenanceCopy.paperLinkUnavailable), findsOneWidget); expect(_linkFor(kCorpusId), findsNothing);
      expect(find.text(ProvenanceCopy.openPaper), findsNothing); expect(find.byIcon(Icons.open_in_new_rounded), findsNothing); expect(launcher.opened, isEmpty);
      expect(find.textContaining(kCorpusTitle), findsOneWidget); }); testWidgets('hostile and malformed paperIds never render a link', (
      tester,
    ) async {
      final hostile = <String>[
        'javascript:alert(1)',
        'data:text/html,<script>1</script>',
        'file:///etc/passwd',
        'https://evil.example/$kRealDoi',
        'https://doi.org.evil.example/$kRealDoi',
        'https://doi.org@evil.example/$kRealDoi',
        'https://doi.org:8443/$kRealDoi',
        'https://doi.org/$kRealDoi?redirect=evil',
        '',
        '   ',
        'paper-1',
        String.fromCharCode(0x00),
        '10.1038/s41586${String.fromCharCode(0x0d)}020',
      ]; for (final paperId in hostile) {
        final launcher = await _pump(tester, _negativeInputProvenance(paperId)); expect(
          _linkFor(paperId),
          findsNothing,
          reason: 'rendered a link for hostile paperId ${paperId.codeUnits}',
        ); expect(
          find.text(ProvenanceCopy.openPaper),
          findsNothing,
          reason: 'open-paper affordance for ${paperId.codeUnits}',
        ); expect(find.text(ProvenanceCopy.paperLinkUnavailable), findsOneWidget); expect(launcher.opened, isEmpty); }
    }); testWidgets('mixed artifacts link only the DOI, never the corpus id', (
      tester,
    ) async {
      final launcher = await _pump(tester, _mixedAccurateProvenance()); expect(_linkFor(kRealDoi), findsOneWidget); expect(_linkFor(kCorpusId), findsNothing);
      expect(find.text(ProvenanceCopy.openPaper), findsOneWidget); await tester.scrollUntilVisible(find.textContaining(kCorpusTitle), 300); await tester.pumpAndSettle();
      expect(find.text(ProvenanceCopy.paperLinkUnavailable), findsOneWidget); await tester.scrollUntilVisible(_linkFor(kRealDoi), -300); await tester.pumpAndSettle();
      await tester.tap(_linkFor(kRealDoi)); await tester.pumpAndSettle(); expect(launcher.opened.single.toString(), kRealDoiUrl); }); });
  group('provenance and trust labels survive the link affordance', () {
    testWidgets('a fully cited edge renders every label AND the one link', (
      tester,
    ) async {
      final launcher = await _pump(tester, _fullyCitedProvenance()); expect(_linkFor(kRealDoi), findsOneWidget); expect(find.text(ProvenanceCopy.openPaper), findsOneWidget);
      expect(find.text(ProvenanceCopy.paperLinkUnavailable), findsNothing); expect(find.textContaining(kRealDoiTitle), findsOneWidget); expect(find.textContaining('($kRealDoiYear)'), findsOneWidget);
      expect(find.text(ProvenanceCopy.citationsLabel), findsOneWidget); expect(
        find.textContaining('${ProvenanceCopy.evidenceTierPrefix}4'),
        findsOneWidget,
      ); expect(find.textContaining('supports'), findsOneWidget); expect(find.textContaining('· high ·'), findsOneWidget); expect(
        find.textContaining(ProvenanceCopy.populationPrefix),
        findsOneWidget,
      ); expect(find.text(ProvenanceCopy.derivationLabel), findsOneWidget); expect(find.text(ProvenanceCopy.researchLinksLabel), findsOneWidget);
      expect(find.text(ProvenanceCopy.noEdgesRules), findsNothing); expect(find.text(ProvenanceCopy.noEdgesPersonal), findsNothing); await tester.ensureVisible(_linkFor(kRealDoi));
      await tester.pumpAndSettle(); await tester.tap(_linkFor(kRealDoi)); await tester.pumpAndSettle(); expect(launcher.opened.single.toString(), kRealDoiUrl); });
    testWidgets('a plain rules card keeps its honest no-citation note', (
      tester,
    ) async {
      final launcher = await _pump(
        tester,
        InsightProvenance(card: _cardInfo(producer: 'rules')),
      ); expect(find.text(ProvenanceCopy.noEdgesRules), findsOneWidget); expect(find.text(ProvenanceCopy.researchLinksLabel), findsOneWidget);
      expect(find.text(ProvenanceCopy.openPaper), findsNothing); expect(find.text(ProvenanceCopy.paperLinkUnavailable), findsNothing);
      expect(find.textContaining(ProvenanceCopy.verdictPrefix), findsNothing); expect(find.text(ProvenanceCopy.testModeVerdictLabel), findsNothing); expect(launcher.opened, isEmpty); });
    testWidgets('the uncited personal card says it is from your own data', (
      tester,
    ) async {
      await _pump(
        tester,
        InsightProvenance(
          card: _cardInfo(producer: 'personal'),
          patternKey: 'personal:gut_comfort_score|mood_score',
          branch: 'idiosyncratic',
          personal: const ProvenancePersonal(
            rho: 0.95,
            nEff: 27,
            qValue: 0.004,
            stable: true,
          ),
        ),
      ); expect(find.text(ProvenanceCopy.noEdgesPersonal), findsOneWidget); expect(find.text(ProvenanceCopy.yourDataLabel), findsOneWidget); expect(find.textContaining('ρ 0.95'), findsOneWidget);
      expect(find.text(ProvenanceCopy.openPaper), findsNothing); expect(find.text(ProvenanceCopy.paperLinkUnavailable), findsNothing);
      expect(find.textContaining(ProvenanceCopy.verdictPrefix), findsNothing); expect(find.text(ProvenanceCopy.testModeVerdictLabel), findsNothing); }); }); }
