import 'package:flutter_test/flutter_test.dart';
import 'package:src/modules/m5b_insight_engine/impl/provenance_models.dart';
const kRealDoi = '10.1016/j.isci.2026.116224';
const kRealDoiUrl = 'https://doi.org/10.1016/j.isci.2026.116224';
const kRepoDois = <String>[
  '10.1371/journal.pone.0211200',
  '10.1099/mic.0.001234',
  '10.1099/MIC.0.001234',
  '10.3390/s26041325',
  '10.48550/arXiv.2103.00020',
];
const kCorpusId = 'corpus:gut-mood-cohort-2024';
const kCorpusTitle = 'Gut comfort and mood in a longitudinal cohort';
const kCorpusYear = 2024;
const kControlCodePoints = [0x00, 0x07, 0x09, 0x0a, 0x0d, 0x1b, 0x7f, 0x9f];
Uri? _uriFor(String paperId) => ProvenanceCitation(paperId: paperId).paperUri;
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
    test('a cleartext http:// doi.org URL is rejected outright (#286)', () {
      expect(_uriFor('http://doi.org/$kRealDoi'), isNull);
      expect(_uriFor('http://dx.doi.org/$kRealDoi'), isNull);
    });
    test('ordinary surrounding spaces are trimmed safely', () {
      expect(_urlFor('  $kRealDoi  '), kRealDoiUrl);
    });
    test('control-character wrappers are rejected before trimming (#286)', () {
      for (final paperId in ['$kRealDoi\n', '\t$kRealDoi', '$kRealDoi\r\n']) {
        expect(_uriFor(paperId), isNull, reason: paperId.codeUnits.toString());
      }
    });
    test('DOI case is canonicalised, so one paper has one URL (#286)', () {
      final upper = _uriFor('10.1016/J.ISCI.2026.116224');
      expect(upper, isNotNull);
      expect(upper!.host, 'doi.org');
      expect(upper.toString(), kRealDoiUrl);
      expect(_urlFor('10.1099/MIC.0.001234'), _urlFor('10.1099/mic.0.001234'));
    });
    test('other genuine DOI shapes from this repo resolve too', () {
      for (final doi in kRepoDois) {
        final uri = _uriFor(doi);
        expect(uri, isNotNull, reason: doi);
        expect(uri!.scheme, 'https', reason: doi);
        expect(uri.host, 'doi.org', reason: doi);
        expect(uri.path, '/${doi.toLowerCase()}', reason: doi);
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
        expect(
          _uriFor('10.1038/s41586${c}020-2649-2'),
          isNull,
          reason: '${_u(code)} in the suffix',
        );
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
      for (final code in [0x00, 0x07, 0x1b, 0x7f, 0x9f]) {
        expect(
          _uriFor('$kRealDoi${String.fromCharCode(code)}'),
          isNull,
          reason: '${_u(code)} trailing a real DOI',
        );
      }
    });
    test('whenever a Uri IS produced it is https on exactly doi.org', () {
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
    test('dot segments are rejected, not resolved away (#286)', () {
      for (final id in [
        '10.1234/../../evil',
        '10.1234/../evil',
        '10.1234/./evil',
        'https://doi.org/10.1234/../evil',
      ]) {
        expect(_uriFor(id), isNull, reason: id);
      }
    });
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
        'title': kCorpusTitle,
        'year': kCorpusYear,
      });
      expect(citation.paperUri, isNull);
      expect(
        citation.title,
        kCorpusTitle,
        reason: 'unlinkable is not invisible — the citation still renders',
      );
    });
  });
}
