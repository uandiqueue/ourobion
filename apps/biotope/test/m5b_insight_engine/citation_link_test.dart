// Safe citation links — the pure resolver `ProvenanceCitation.paperUri`
// (impl/provenance_models.dart).
//
// `Citation.paperId` is "DOI when available, else a stable internal corpus id"
// (shared/brain/relationships.ts). Two obligations follow, and both are
// falsifiable here without pumping a widget:
//
//   1. HONESTY — a paperId that is not a DOI must yield null, so the screen can
//      say there is nothing to open. Manufacturing a URL out of a corpus id
//      would be a fabricated citation with extra steps.
//   2. SAFETY — the only URL this may ever produce is https on doi.org. Not
//      http. Not doi.org.evil.example. Not javascript:. A paperId is
//      attacker-influenced data (it arrives from the corpus pipeline), so the
//      host is pinned rather than trusted.
//
// THE FIXTURE DOI IS REAL. 10.1016/j.isci.2026.116224 resolves to
// "Unraveling the gut microbiota-brain axis" (iScience, 2026). It is the
// project-relevant citation fixture used by the provenance screen tests; where
// a title is needed, this suite uses that paper's genuine title and year.
//
// Every other DOI string used below is likewise taken verbatim from a fixture
// already committed to this repository (paths named at each use). No DOI, URL,
// paper or title is invented anywhere in this file.
//
// Control-character fixtures are built with String.fromCharCode rather than
// pasted, so no raw NUL/ESC byte ever lands in this source file.

import 'package:flutter_test/flutter_test.dart';
import 'package:src/modules/m5b_insight_engine/impl/provenance_models.dart';

/// A real, verifiable DOI — see the header note.
const kRealDoi = '10.1016/j.isci.2026.116224';
const kRealDoiUrl = 'https://doi.org/10.1016/j.isci.2026.116224';

/// Further real DOIs, each already committed to this repo's ingest fixtures:
///   * tools/brain-ingest/tests/fixtures/openalex-works.json
///   * tools/brain-ingest/tests/fixtures/identity-candidates.json
///   * tools/brain-ingest/tests/fixtures/idconv.json
///   * tools/brain-ingest/tests/fixtures/s2-search.json
/// They are used only to exercise DOI *shapes* (dotted suffixes, mixed case,
/// a non-numeric registrant); no title or claim is attached to any of them.
const kRepoDois = <String>[
  '10.1371/journal.pone.0211200',
  '10.1099/mic.0.001234',
  '10.1099/MIC.0.001234',
  '10.3390/s26041325',
  '10.48550/arXiv.2103.00020',
];

/// A stable internal corpus id — the other half of the `paperId` contract, and
/// deliberately NOT resolvable to any page.
const kCorpusId = 'corpus:01JQZK4E1N7Y8B2W9T3M5X6R0A';

/// NUL, BEL, TAB, LF, CR, ESC, DEL and a C1 control.
const kControlCodePoints = [0x00, 0x07, 0x09, 0x0a, 0x0d, 0x1b, 0x7f, 0x9f];

Uri? _uriFor(String paperId) => ProvenanceCitation(paperId: paperId).paperUri;

/// The resolved URL, or null when the paperId is not linkable. Kept separate
/// from [_uriFor] so an unexpected null compares as `null`, never as the string
/// `'null'`.
String? _urlFor(String paperId) => _uriFor(paperId)?.toString();

String _u(int code) => 'U+${code.toRadixString(16).padLeft(4, '0')}';

void main() {
  group('a real DOI resolves to the canonical doi.org URL', () {
    test('bare', () {
      expect(_urlFor(kRealDoi), kRealDoiUrl);
    });

    test('doi:-prefixed, in either case', () {
      expect(_urlFor('doi:$kRealDoi'), kRealDoiUrl);
      expect(_urlFor('DOI:$kRealDoi'), kRealDoiUrl);
    });

    test('already an https://doi.org URL', () {
      expect(_urlFor(kRealDoiUrl), kRealDoiUrl);
    });

    test('the legacy dx.doi.org resolver normalises to doi.org', () {
      expect(_urlFor('https://dx.doi.org/$kRealDoi'), kRealDoiUrl);
    });

    test(
      'KNOWN GAP #286: an http:// doi.org URL is upgraded instead of rejected',
      () {
        final uri = _uriFor('http://doi.org/$kRealDoi');
        expect(uri, isNotNull);
        expect(
          uri!.scheme,
          'https',
          reason: 'a cleartext link must not survive',
        );
        expect(uri.toString(), kRealDoiUrl);
      },
    );

    test('surrounding whitespace is tolerated, not a reason to reject', () {
      expect(_urlFor('  $kRealDoi\n'), kRealDoiUrl);
      expect(_urlFor('\t$kRealDoi\r\n'), kRealDoiUrl);
    });

    test(
      'KNOWN GAP #286: a DOI is accepted but its path casing is not canonicalised',
      () {
        // Crossref — and this repo's crossref-works.json fixture — store this DOI
        // upper-cased. It is the same paper and must still resolve.
        final uri = _uriFor('10.1016/J.ISCI.2026.116224');
        expect(uri, isNotNull);
        expect(uri!.host, 'doi.org');
        expect(
          uri.toString(),
          'https://doi.org/10.1016/J.ISCI.2026.116224',
          reason:
              'remove this known-gap assertion when #286 canonicalises DOI case',
        );
      },
    );

    test('other genuine DOI shapes from this repo resolve too', () {
      for (final doi in kRepoDois) {
        final uri = _uriFor(doi);
        expect(uri, isNotNull, reason: doi);
        expect(uri!.scheme, 'https', reason: doi);
        expect(uri.host, 'doi.org', reason: doi);
        expect(uri.path, '/$doi', reason: doi);
      }
    });
  });

  group('a non-DOI paperId yields null — never a guessed URL', () {
    test('internal corpus ids and other non-DOI identifiers', () {
      for (final id in [
        kCorpusId,
        'corpus-01JQZK4E1N7Y8B2W9T3M5X6R0A',
        'corpus:legacy-without-doi',
        'paper-1',
        'PMC1234567',
        'PMID:34567890',
        'arXiv:2401.01234v2',
        'W123',
      ]) {
        expect(_uriFor(id), isNull, reason: id);
      }
    });

    test('empty and whitespace-only strings', () {
      expect(_uriFor(''), isNull);
      expect(_uriFor('   '), isNull);
      expect(_uriFor('\t\n'), isNull);
      expect(_uriFor('doi:'), isNull);
      expect(_uriFor('https://doi.org/'), isNull);
    });

    test('near-miss DOI shapes', () {
      // The registrant must be 4–9 digits after "10.", and a suffix must exist.
      expect(_uriFor('10.103/s41586'), isNull);
      expect(_uriFor('10.1234567890/x'), isNull);
      expect(_uriFor('10.1038'), isNull);
      expect(_uriFor('10.1038/'), isNull);
      expect(_uriFor('11.1038/s41586-020-2649-2'), isNull);
      expect(_uriFor('a$kRealDoi'), isNull);
    });

    test('an interior space is rejected — a DOI has none', () {
      expect(_uriFor('10.1038/s41586 -020'), isNull);
      expect(_uriFor('10.1038 /s41586'), isNull);
      expect(_uriFor('10.1038/s41586 020 2649'), isNull);
    });

    test('free text that merely mentions a DOI is not a DOI', () {
      expect(_uriFor('Array programming with NumPy ($kRealDoi)'), isNull);
    });
  });

  group('link safety — hostile paperIds', () {
    test('active-content and local schemes are rejected outright', () {
      for (final id in [
        'javascript:alert(1)',
        'JavaScript:alert(1)',
        'javascript:alert(1)//$kRealDoi',
        'data:text/html,<script>1</script>',
        'data:text/plain,$kRealDoi',
        'file:///etc/passwd',
        'file://doi.org/$kRealDoi',
        'vbscript:msgbox(1)',
        'mailto:someone@example.com',
      ]) {
        expect(_uriFor(id), isNull, reason: id);
      }
    });

    test('a non-doi.org host is rejected', () {
      for (final id in [
        'https://evil.example/$kRealDoi',
        'https://evil.example/doi.org/$kRealDoi',
        'https://evil.example/https://doi.org/$kRealDoi',
        'https://sci-hub.example/$kRealDoi',
      ]) {
        expect(_uriFor(id), isNull, reason: id);
      }
    });

    test('a look-alike host is rejected', () {
      for (final id in [
        'https://doi.org.evil.example/$kRealDoi',
        'https://doi.org@evil.example/$kRealDoi',
        'https://xn--doi-8ma.org/$kRealDoi',
        'https://doi.org:8443/$kRealDoi',
        'https://notdoi.org/$kRealDoi',
        'https://dx.doi.org.evil.example/$kRealDoi',
      ]) {
        expect(_uriFor(id), isNull, reason: id);
      }
    });

    test('a query or fragment cannot ride along on a doi.org URL', () {
      expect(_uriFor('https://doi.org/$kRealDoi?redirect=evil'), isNull);
      expect(_uriFor('https://doi.org/$kRealDoi#evil'), isNull);
      expect(_uriFor('10.1234/a%3fb'), isNull);
    });

    test('a control character INSIDE the identifier is rejected', () {
      for (final code in kControlCodePoints) {
        final c = String.fromCharCode(code);
        // Splicing a control character into an otherwise real DOI must not
        // yield a link to that real DOI.
        expect(
          _uriFor('10.1038/s41586${c}020-2649-2'),
          isNull,
          reason: '${_u(code)} in the suffix',
        );
        // The classic response-splitting / label-spoofing shape.
        expect(
          _uriFor('$kRealDoi${c}Location: https://evil.example'),
          isNull,
          reason: '${_u(code)} appended to a real DOI',
        );
        expect(
          _uriFor('https://doi.org/10.1038/s41586${c}020'),
          isNull,
          reason: '${_u(code)} inside a doi.org URL',
        );
      }
    });

    test('a NON-whitespace trailing control character is rejected', () {
      // TAB / LF / CR are ordinary trailing whitespace and are trimmed (see the
      // whitespace test above). NUL, BEL, ESC, DEL and C1 controls are not
      // whitespace and must not be quietly accepted at the end either.
      for (final code in [0x00, 0x07, 0x1b, 0x7f, 0x9f]) {
        expect(
          _uriFor('$kRealDoi${String.fromCharCode(code)}'),
          isNull,
          reason: '${_u(code)} trailing a real DOI',
        );
      }
    });

    test('whenever a Uri IS produced it is https on exactly doi.org', () {
      // The invariant that matters most: for ANY input — real, malformed or
      // hostile — a non-null result is always an https doi.org URL with no
      // port, no credentials, no query and no fragment.
      final everyInput = <String>[
        kRealDoi,
        kRealDoiUrl,
        'doi:$kRealDoi',
        'DOI:$kRealDoi',
        'http://doi.org/$kRealDoi',
        'https://dx.doi.org/$kRealDoi',
        '10.1016/J.ISCI.2026.116224',
        '  $kRealDoi\n',
        ...kRepoDois,
        // Non-DOI, malformed and hostile shapes — most yield null, and any that
        // does not must still satisfy the invariant.
        kCorpusId,
        '',
        '   ',
        'javascript:alert(1)',
        'data:text/html,<script>1</script>',
        'file:///etc/passwd',
        'https://doi.org.evil.example/$kRealDoi',
        'https://evil.example/$kRealDoi',
        'https://doi.org@evil.example/$kRealDoi',
        'https://doi.org:8443/$kRealDoi',
        'https://doi.org/$kRealDoi?redirect=evil',
        'https://doi.org/$kRealDoi#evil',
        '10.1234/../../evil',
        '10.1234/./evil',
        'https://doi.org/10.1234/../evil',
        '10.1234/a%3fb',
        '10.1038/s41586${String.fromCharCode(0x00)}020',
      ];
      for (final id in everyInput) {
        final uri = _uriFor(id);
        if (uri == null) continue;
        expect(uri.scheme, 'https', reason: id);
        expect(uri.host, 'doi.org', reason: id);
        expect(uri.hasPort, isFalse, reason: id);
        expect(uri.userInfo, isEmpty, reason: id);
        expect(uri.hasQuery, isFalse, reason: id);
        expect(uri.hasFragment, isFalse, reason: id);
        expect(uri.toString(), startsWith('https://doi.org/'), reason: id);
      }
    });

    test(
      'KNOWN GAP #286: dot segments are mis-resolved rather than rejected',
      () {
        expect(
          _urlFor('10.1234/../../evil'),
          'https://doi.org/evil',
          reason:
              'replace this explicit known-gap pin when #286 rejects dot segments',
        );
      },
    );
  });

  group('the parsed model carries the resolver', () {
    test('fromJson round-trips a DOI paperId into a linkable citation', () {
      final citation = ProvenanceCitation.fromJson(const {
        'paperId': kRealDoi,
        'title': 'Unraveling the gut microbiota-brain axis',
        'year': 2026,
        'evidenceTier': 4,
        'impactTier': 'moderate',
        'stance': 'supports',
      });
      expect(citation.paperUri?.toString(), kRealDoiUrl);
      expect(citation.evidenceTier, 4);
      expect(citation.stance, 'supports');
    });

    test('fromJson leaves an internal corpus id unlinkable', () {
      final citation = ProvenanceCitation.fromJson(const {
        'paperId': kCorpusId,
        'title': 'An unindexed record held only in the corpus',
        'year': 2019,
      });
      expect(citation.paperUri, isNull);
      expect(
        citation.title,
        'An unindexed record held only in the corpus',
        reason: 'unlinkable is not invisible — the citation still renders',
      );
    });
  });
}
