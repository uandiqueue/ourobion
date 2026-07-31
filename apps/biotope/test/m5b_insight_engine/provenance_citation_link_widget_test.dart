// Citation links on the provenance screen, end to end.
//
// citation_link_test.dart pins the pure resolver (ProvenanceCitation.paperUri);
// this pins that the SCREEN uses it honestly:
//   * a citation whose paperId is a real DOI renders a real, tappable control
//     that opens exactly https://doi.org/<doi> externally;
//   * a citation whose paperId is an internal corpus id renders the plain
//     "Paper link unavailable" sentence and NO link at all;
//   * a failed launch says so instead of appearing inert;
//   * and none of this displaces the existing provenance / trust labels —
//     evidence tier, impact tier, stance, verdict, serving band, the TEST-MODE
//     stamp, the uncited personal state and the plain-rules no-citation note.
//     Those were the whole point of the screen and must survive.
//
// THE FIXTURE DOI IS REAL: 10.1016/j.isci.2026.116224 resolves to
// "Unraveling the gut microbiota-brain axis" (iScience, 2026). The fixture is
// project-relevant, and its genuine title and year are used here. No paper,
// title, DOI or URL is invented in this file.
//
// The screen exposes each link as ValueKey('citation-link-<paperId>'), so a
// link can be located per-citation rather than by its shared label.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:src/modules/m5b_insight_engine/impl/insight_service.dart';
import 'package:src/modules/m5b_insight_engine/impl/provenance_models.dart';
import 'package:src/modules/m5b_insight_engine/impl/provenance_service.dart';
import 'package:src/modules/m5b_insight_engine/ui/screens/insight_provenance_screen.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

const kRealDoi = '10.1016/j.isci.2026.116224';
const kRealDoiUrl = 'https://doi.org/10.1016/j.isci.2026.116224';

/// The genuine title and year of the paper that DOI resolves to.
const kRealDoiTitle = 'Unraveling the gut microbiota-brain axis';
const kRealDoiYear = 2026;

/// A stable internal corpus id — the other half of the `Citation.paperId`
/// contract, and deliberately NOT resolvable to any page.
const kCorpusId = 'corpus:01JQZK4E1N7Y8B2W9T3M5X6R0A';

class _FakeProvenanceService extends ProvenanceService {
  final InsightProvenance? result;

  // autoRefreshToken off: the default GoTrue auto-refresh timer trips the test
  // binding's pending-timers invariant (same seam as
  // provenance_screen_widget_test.dart).
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

/// Records what would be opened, and can simulate a launch that fails.
class _RecordingLauncher {
  _RecordingLauncher({this.succeeds = true});
  final bool succeeds;
  final List<Uri> opened = [];

  Future<bool> call(Uri uri) async {
    opened.add(uri);
    return succeeds;
  }
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
);

ProvenanceCardInfo _cardInfo({String producer = 'edge'}) => ProvenanceCardInfo(
  id: 2,
  ruleId: 'gut_comfort_trending_down',
  title: 'Gut comfort trending down',
  body: 'Your gut comfort scores have drifted lower this week.',
  producer: producer,
  category: 'gut',
  severity: 'info',
  generatedAt: '2026-07-24T09:37:53.975+00:00',
);

InsightProvenance _withCitations(List<ProvenanceCitation> citations) {
  return InsightProvenance(
    card: _cardInfo(),
    edges: [
      ProvenanceEdge(
        edgeId: 'gut_microbiota->brain_axis',
        subject: 'gut_microbiota',
        object: 'brain_axis',
        relation: 'describes',
        citations: citations,
      ),
    ],
  );
}

/// A fully-cited edge carrying both citation cases at once: one real DOI and
/// one internal corpus id. Every trust label the screen owns is populated, so a
/// regression that drops one is visible here too.
InsightProvenance _fullyCitedProvenance() => const InsightProvenance(
  card: ProvenanceCardInfo(
    id: 2,
    ruleId: 'gut_comfort_trending_down',
    title: 'Gut comfort trending down',
    body: 'Your gut comfort scores have drifted lower this week.',
    producer: 'edge',
    category: 'gut',
    severity: 'info',
    generatedAt: '2026-07-24T09:37:53.975+00:00',
  ),
  patternKey: 'signal:sleep_duration_min:down',
  branch: 'agree',
  edges: [
    ProvenanceEdge(
      edgeId: 'gut_microbiota->brain_axis',
      subject: 'gut_microbiota',
      object: 'brain_axis',
      relation: 'describes',
      direction: 'consistent',
      servingBand: 'core',
      edgeScore: 0.82,
      verdict: 'agree',
      verifiedAt: '2026-07-10T00:00:00Z',
      derivation: 'Synthesised from the cited sources.',
      population: 'healthy adults 18-40',
      citations: [
        ProvenanceCitation(
          paperId: kRealDoi,
          title: kRealDoiTitle,
          year: kRealDoiYear,
          evidenceTier: 4,
          impactTier: 'moderate',
          stance: 'supports',
          population: 'healthy adults 18-40',
        ),
        ProvenanceCitation(
          paperId: kCorpusId,
          title: 'An unindexed record held only in the corpus',
          year: 2019,
          evidenceTier: 2,
          impactTier: 'low',
          stance: 'mentions',
        ),
      ],
    ),
  ],
);

Finder _linkFor(String paperId) =>
    find.byKey(ValueKey('citation-link-$paperId'));

/// Bumped on every pump so a screen pumped twice inside one test really is a
/// FRESH screen. Without a distinct key Flutter reuses the existing State — and
/// `InsightProvenanceScreen` reads its injected service once, in initState — so
/// a loop over fixtures would silently re-assert the first one.
int _pumpSeq = 0;

Future<_RecordingLauncher> _pump(
  WidgetTester tester,
  InsightProvenance? provenance, {
  bool launchSucceeds = true,
}) async {
  final launcher = _RecordingLauncher(succeeds: launchSucceeds);
  await tester.pumpWidget(
    MaterialApp(
      home: InsightProvenanceScreen(
        key: ValueKey('provenance-${_pumpSeq++}'),
        card: _card(),
        service: _FakeProvenanceService(provenance),
        openExternalLink: launcher.call,
      ),
    ),
  );
  await tester.pumpAndSettle();
  return launcher;
}

void main() {
  group('a citation with a REAL DOI renders a working external link', () {
    testWidgets('the link is present and names the action', (tester) async {
      await _pump(
        tester,
        _withCitations(const [
          ProvenanceCitation(
            paperId: kRealDoi,
            title: kRealDoiTitle,
            year: kRealDoiYear,
          ),
        ]),
      );

      expect(_linkFor(kRealDoi), findsOneWidget);
      expect(find.text(ProvenanceCopy.openPaper), findsOneWidget);
      expect(find.byIcon(Icons.open_in_new_rounded), findsOneWidget);
      // The honest-unavailable state must NOT also be shown.
      expect(find.text(ProvenanceCopy.paperLinkUnavailable), findsNothing);
      // The real paper, by its genuine title and year.
      expect(
        find.textContaining('$kRealDoiTitle ($kRealDoiYear)'),
        findsOneWidget,
      );
    });

    testWidgets('tapping it opens the canonical doi.org URL externally', (
      tester,
    ) async {
      final launcher = await _pump(
        tester,
        _withCitations(const [
          ProvenanceCitation(paperId: kRealDoi, title: kRealDoiTitle),
        ]),
      );

      await tester.ensureVisible(_linkFor(kRealDoi));
      await tester.pumpAndSettle();
      await tester.tap(_linkFor(kRealDoi));
      await tester.pumpAndSettle();

      expect(launcher.opened, hasLength(1));
      expect(launcher.opened.single.toString(), kRealDoiUrl);
      expect(launcher.opened.single.scheme, 'https');
      expect(launcher.opened.single.host, 'doi.org');
    });

    testWidgets(
      'KNOWN GAP #286: the rendered external-paper control is not exposed as a semantic link',
      (tester) async {
        final semantics = tester.ensureSemantics();
        await _pump(
          tester,
          _withCitations(const [
            ProvenanceCitation(paperId: kRealDoi, title: kRealDoiTitle),
          ]),
        );
        expect(
          tester.getSemantics(_linkFor(kRealDoi)).flagsCollection.isLink,
          isFalse,
          reason:
              'replace this known-gap pin when #286 adds explicit link semantics',
        );
        semantics.dispose();
      },
    );

    testWidgets('a doi:-prefixed stored id still opens the canonical URL', (
      tester,
    ) async {
      const stored = 'doi:$kRealDoi';
      final launcher = await _pump(
        tester,
        _withCitations(const [
          ProvenanceCitation(paperId: stored, title: kRealDoiTitle),
        ]),
      );

      await tester.ensureVisible(_linkFor(stored));
      await tester.pumpAndSettle();
      await tester.tap(_linkFor(stored));
      await tester.pumpAndSettle();

      expect(launcher.opened.single.toString(), kRealDoiUrl);
    });

    testWidgets('an upper-cased stored DOI opens the same paper on doi.org', (
      tester,
    ) async {
      // Crossref — and this repo's crossref-works.json fixture — store this DOI
      // upper-cased. DOIs are case-insensitive, so it is the same paper.
      const stored = '10.1016/J.ISCI.2026.116224';
      final launcher = await _pump(
        tester,
        _withCitations(const [ProvenanceCitation(paperId: stored)]),
      );

      await tester.ensureVisible(_linkFor(stored));
      await tester.pumpAndSettle();
      await tester.tap(_linkFor(stored));
      await tester.pumpAndSettle();

      final opened = launcher.opened.single;
      expect(opened.scheme, 'https');
      expect(opened.host, 'doi.org');
      expect(opened.toString().toLowerCase(), kRealDoiUrl);
    });

    testWidgets('a failed launch says so rather than doing nothing', (
      tester,
    ) async {
      await _pump(
        tester,
        _withCitations(const [ProvenanceCitation(paperId: kRealDoi)]),
        launchSucceeds: false,
      );

      await tester.ensureVisible(_linkFor(kRealDoi));
      await tester.pumpAndSettle();
      await tester.tap(_linkFor(kRealDoi));
      await tester.pumpAndSettle();

      expect(find.text(ProvenanceCopy.paperLinkFailed), findsOneWidget);

      // Let the SnackBar's own display timer expire so no pending timer
      // outlives the widget tree.
      await tester.pumpAndSettle(const Duration(seconds: 5));
    });

    testWidgets('a successful launch shows no failure notice', (tester) async {
      await _pump(
        tester,
        _withCitations(const [ProvenanceCitation(paperId: kRealDoi)]),
      );

      await tester.ensureVisible(_linkFor(kRealDoi));
      await tester.pumpAndSettle();
      await tester.tap(_linkFor(kRealDoi));
      await tester.pumpAndSettle();

      expect(find.text(ProvenanceCopy.paperLinkFailed), findsNothing);
    });
  });

  group('a non-DOI paperId renders the honest unavailable state', () {
    testWidgets('an internal corpus id gets a sentence, never a link', (
      tester,
    ) async {
      final launcher = await _pump(
        tester,
        _withCitations(const [
          ProvenanceCitation(
            paperId: kCorpusId,
            title: 'An unindexed record held only in the corpus',
            year: 2019,
          ),
        ]),
      );

      expect(find.text(ProvenanceCopy.paperLinkUnavailable), findsOneWidget);
      expect(_linkFor(kCorpusId), findsNothing);
      expect(find.text(ProvenanceCopy.openPaper), findsNothing);
      expect(find.byIcon(Icons.open_in_new_rounded), findsNothing);
      expect(launcher.opened, isEmpty);
      // The citation itself is still shown — unlinkable is not invisible.
      expect(
        find.textContaining('An unindexed record held only in the corpus'),
        findsOneWidget,
      );
    });

    testWidgets('hostile and malformed paperIds never render a link', (
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
        kCorpusId,
        String.fromCharCode(0x00),
        '10.1038/s41586${String.fromCharCode(0x0d)}020',
      ];
      for (final paperId in hostile) {
        final launcher = await _pump(
          tester,
          _withCitations([ProvenanceCitation(paperId: paperId)]),
        );
        expect(
          _linkFor(paperId),
          findsNothing,
          reason: 'rendered a link for hostile paperId ${paperId.codeUnits}',
        );
        expect(
          find.text(ProvenanceCopy.openPaper),
          findsNothing,
          reason: 'open-paper affordance for ${paperId.codeUnits}',
        );
        expect(find.text(ProvenanceCopy.paperLinkUnavailable), findsOneWidget);
        expect(launcher.opened, isEmpty);
      }
    });

    testWidgets('a mixed edge links only the DOI, never the corpus id', (
      tester,
    ) async {
      final launcher = await _pump(
        tester,
        _withCitations(const [
          ProvenanceCitation(paperId: kRealDoi, title: kRealDoiTitle),
          ProvenanceCitation(paperId: kCorpusId, title: 'Corpus-only record'),
        ]),
      );

      expect(_linkFor(kRealDoi), findsOneWidget);
      expect(_linkFor(kCorpusId), findsNothing);
      expect(find.text(ProvenanceCopy.openPaper), findsOneWidget);
      expect(find.text(ProvenanceCopy.paperLinkUnavailable), findsOneWidget);

      await tester.ensureVisible(_linkFor(kRealDoi));
      await tester.pumpAndSettle();
      await tester.tap(_linkFor(kRealDoi));
      await tester.pumpAndSettle();
      expect(launcher.opened.single.toString(), kRealDoiUrl);
    });
  });

  group('provenance and trust labels survive the link affordance', () {
    testWidgets('a fully cited edge renders every label AND the one link', (
      tester,
    ) async {
      final launcher = await _pump(tester, _fullyCitedProvenance());

      // Two citations, exactly one of which is linkable.
      expect(_linkFor(kRealDoi), findsOneWidget);
      expect(_linkFor(kCorpusId), findsNothing);
      expect(find.text(ProvenanceCopy.openPaper), findsOneWidget);
      expect(find.text(ProvenanceCopy.paperLinkUnavailable), findsOneWidget);

      // The real paper, by its genuine title and year.
      expect(find.textContaining(kRealDoiTitle), findsOneWidget);
      expect(find.textContaining('($kRealDoiYear)'), findsOneWidget);

      // Every provenance / trust label the screen owns.
      expect(find.text(ProvenanceCopy.citationsLabel), findsOneWidget);
      expect(
        find.textContaining('${ProvenanceCopy.verdictPrefix}agree'),
        findsOneWidget,
      );
      // D15 honesty: the verdict carries the TEST-MODE stamp, verbatim.
      expect(find.text(ProvenanceCopy.testModeVerdictLabel), findsOneWidget);
      expect(
        find.textContaining('${ProvenanceCopy.evidenceTierPrefix}4'),
        findsOneWidget,
      );
      expect(
        find.textContaining('${ProvenanceCopy.evidenceTierPrefix}2'),
        findsOneWidget,
      );
      expect(find.textContaining('supports'), findsOneWidget);
      expect(find.textContaining('mentions'), findsOneWidget);
      expect(find.textContaining('· moderate ·'), findsOneWidget);
      // '· low ·' rather than 'low': the card body contains the word "lower".
      expect(find.textContaining('· low ·'), findsOneWidget);
      expect(
        find.textContaining('${ProvenanceCopy.servingBandPrefix}core'),
        findsOneWidget,
      );
      expect(
        find.textContaining(ProvenanceCopy.directionConsistent),
        findsOneWidget,
      );
      expect(
        find.textContaining(ProvenanceCopy.populationPrefix),
        findsOneWidget,
      );
      expect(find.text(ProvenanceCopy.derivationLabel), findsOneWidget);
      expect(find.text(ProvenanceCopy.researchLinksLabel), findsOneWidget);
      // Edges exist, so neither honest no-citation note may appear.
      expect(find.text(ProvenanceCopy.noEdgesRules), findsNothing);
      expect(find.text(ProvenanceCopy.noEdgesPersonal), findsNothing);

      // And the one link that does exist goes exactly where it says.
      await tester.ensureVisible(_linkFor(kRealDoi));
      await tester.pumpAndSettle();
      await tester.tap(_linkFor(kRealDoi));
      await tester.pumpAndSettle();
      expect(launcher.opened.single.toString(), kRealDoiUrl);
    });

    testWidgets('a plain rules card keeps its honest no-citation note', (
      tester,
    ) async {
      final launcher = await _pump(
        tester,
        InsightProvenance(card: _cardInfo(producer: 'rules')),
      );

      expect(find.text(ProvenanceCopy.noEdgesRules), findsOneWidget);
      expect(find.text(ProvenanceCopy.researchLinksLabel), findsOneWidget);
      // No research decoration and no link anywhere.
      expect(find.text(ProvenanceCopy.openPaper), findsNothing);
      expect(find.text(ProvenanceCopy.paperLinkUnavailable), findsNothing);
      expect(find.textContaining(ProvenanceCopy.verdictPrefix), findsNothing);
      expect(find.text(ProvenanceCopy.testModeVerdictLabel), findsNothing);
      expect(launcher.opened, isEmpty);
    });

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
      );

      expect(find.text(ProvenanceCopy.noEdgesPersonal), findsOneWidget);
      expect(find.text(ProvenanceCopy.yourDataLabel), findsOneWidget);
      expect(find.textContaining('ρ 0.95'), findsOneWidget);
      // Never decorated as research.
      expect(find.text(ProvenanceCopy.openPaper), findsNothing);
      expect(find.text(ProvenanceCopy.paperLinkUnavailable), findsNothing);
      expect(find.textContaining(ProvenanceCopy.verdictPrefix), findsNothing);
      expect(find.text(ProvenanceCopy.testModeVerdictLabel), findsNothing);
    });
  });
}
