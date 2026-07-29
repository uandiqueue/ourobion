// Coupling guard: brain-trust-labels-ts-dart-parity
// See docs/graph/couplings.yaml. The user-facing trust/claim-strength vocabulary
// (shared/brain/trust_labels.ts) exists in both TS (edge functions) and Dart (app) with no import
// linking them — a Dart file may not import TypeScript, so `trust_labels.dart` is a hand-maintained
// mirror instead (O38). If the two drift, the app could show a claim-strength or trust word the
// backend contract does not license, or vice versa. status: active.

import 'package:flutter_test/flutter_test.dart';

import 'guard_support.dart';

void main() {
  group('coupling guard: brain-trust-labels-ts-dart-parity', () {
    final ts = readRepoFile('shared/brain/trust_labels.ts');
    final dart = readRepoFile('shared/brain/trust_labels.dart');

    test('CLAIM_KIND_LABELS match across TS and Dart', () {
      expect(
        quotedBlockAfter(dart, 'claimKindLabels'),
        equals(quotedBlockAfter(ts, 'CLAIM_KIND_LABELS')),
        reason: 'CLAIM_KIND_LABELS drifted between trust_labels.ts and .dart',
      );
    });

    test('CLAIM_KIND_DESCRIPTIONS match across TS and Dart', () {
      expect(
        quotedBlockAfter(dart, 'claimKindDescriptions'),
        equals(quotedBlockAfter(ts, 'CLAIM_KIND_DESCRIPTIONS')),
        reason: 'CLAIM_KIND_DESCRIPTIONS drifted between trust_labels.ts and .dart',
      );
    });

    test('RELATION_PHRASES match across TS and Dart', () {
      expect(
        quotedBlockAfter(dart, 'relationPhrases'),
        equals(quotedBlockAfter(ts, 'RELATION_PHRASES')),
        reason: 'RELATION_PHRASES drifted between trust_labels.ts and .dart — this is the B-SCI1 '
            'fix table, a drift here could let a directional verb render for a correlational edge',
      );
    });

    test('CAUSAL_VERBS match across TS and Dart', () {
      // The TS declaration is `CAUSAL_VERBS: readonly string[] = [ ... ]` — the type annotation's
      // own `[]` would confuse plain quotedListAfter (it would read an empty array), so this uses
      // quotedListAfterEquals, which locates the `[` following the `=` instead.
      expect(
        quotedListAfterEquals(dart, 'causalVerbs'),
        equals(quotedListAfterEquals(ts, 'CAUSAL_VERBS')),
        reason: 'CAUSAL_VERBS drifted between trust_labels.ts and .dart — the causal-verb copy '
            'gate would then accept or reject different copy on each side of the language seam',
      );
    });

    test('POSTURE_LABELS match across TS and Dart', () {
      expect(
        quotedBlockAfter(dart, 'postureLabels'),
        equals(quotedBlockAfter(ts, 'POSTURE_LABELS')),
        reason: 'POSTURE_LABELS drifted between trust_labels.ts and .dart',
      );
    });

    test('POSTURE_DISCLOSURES match across TS and Dart', () {
      expect(
        quotedBlockAfter(dart, 'postureDisclosures'),
        equals(quotedBlockAfter(ts, 'POSTURE_DISCLOSURES')),
        reason: 'POSTURE_DISCLOSURES drifted between trust_labels.ts and .dart',
      );
    });

    test('ATTESTATION_LABELS match across TS and Dart', () {
      expect(
        quotedBlockAfter(dart, 'attestationLabels'),
        equals(quotedBlockAfter(ts, 'ATTESTATION_LABELS')),
        reason: 'ATTESTATION_LABELS drifted between trust_labels.ts and .dart',
      );
    });

    test('DECORRELATION_LABELS match across TS and Dart', () {
      expect(
        quotedBlockAfter(dart, 'decorrelationLabels'),
        equals(quotedBlockAfter(ts, 'DECORRELATION_LABELS')),
        reason: 'DECORRELATION_LABELS drifted between trust_labels.ts and .dart',
      );
    });

    test('STUDY_DESIGN_TIER_NAME matches across TS and Dart', () {
      expect(
        quotedScalarAfter(dart, 'studyDesignTierName'),
        equals(quotedScalarAfter(ts, 'STUDY_DESIGN_TIER_NAME')),
        reason: 'STUDY_DESIGN_TIER_NAME drifted between trust_labels.ts and .dart — B-SCI2 '
            'requires this exact name ("evidence tier" is forbidden) on every surface',
      );
    });

    test('STUDY_DESIGN_TIER_LABELS match across TS and Dart', () {
      expect(
        quotedBlockAfter(dart, 'studyDesignTierLabels'),
        equals(quotedBlockAfter(ts, 'STUDY_DESIGN_TIER_LABELS')),
        reason: 'STUDY_DESIGN_TIER_LABELS drifted between trust_labels.ts and .dart',
      );
    });

    test('STUDY_DESIGN_TIER_DISCLOSURE matches across TS and Dart', () {
      expect(
        quotedScalarAfter(dart, 'studyDesignTierDisclosure'),
        equals(quotedScalarAfter(ts, 'STUDY_DESIGN_TIER_DISCLOSURE')),
        reason: 'STUDY_DESIGN_TIER_DISCLOSURE drifted between trust_labels.ts and .dart',
      );
    });

    test('SUPPORT_RANK_NAME matches across TS and Dart', () {
      expect(
        quotedScalarAfter(dart, 'supportRankName'),
        equals(quotedScalarAfter(ts, 'SUPPORT_RANK_NAME')),
        reason: 'SUPPORT_RANK_NAME drifted between trust_labels.ts and .dart — B-SCI2 forbids '
            '"confidence"/"certainty" for this uncalibrated composite rank',
      );
    });

    test('SUPPORT_BAND_LABELS match across TS and Dart', () {
      expect(
        quotedBlockAfter(dart, 'supportBandLabels'),
        equals(quotedBlockAfter(ts, 'SUPPORT_BAND_LABELS')),
        reason: 'SUPPORT_BAND_LABELS drifted between trust_labels.ts and .dart',
      );
    });

    test('SUPPORT_RANK_DISCLOSURE matches across TS and Dart', () {
      expect(
        quotedScalarAfter(dart, 'supportRankDisclosure'),
        equals(quotedScalarAfter(ts, 'SUPPORT_RANK_DISCLOSURE')),
        reason: 'SUPPORT_RANK_DISCLOSURE drifted between trust_labels.ts and .dart — required '
            'beside any surface that exposes the numeric rank',
      );
    });

    test('CERTAINTY_NOT_ASSESSED matches across TS and Dart', () {
      expect(
        quotedScalarAfter(dart, 'certaintyNotAssessed'),
        equals(quotedScalarAfter(ts, 'CERTAINTY_NOT_ASSESSED')),
        reason: 'CERTAINTY_NOT_ASSESSED drifted between trust_labels.ts and .dart — B-SCI2 '
            'requires this exact sentence on every surface that shows a rank or a tier',
      );
    });

    test('VERDICT_LABELS match across TS and Dart', () {
      expect(
        quotedBlockAfter(dart, 'verdictLabels'),
        equals(quotedBlockAfter(ts, 'VERDICT_LABELS')),
        reason: 'VERDICT_LABELS drifted between trust_labels.ts and .dart',
      );
    });

    test('DISPOSITION_LABELS match across TS and Dart', () {
      expect(
        quotedBlockAfter(dart, 'dispositionLabels'),
        equals(quotedBlockAfter(ts, 'DISPOSITION_LABELS')),
        reason: 'DISPOSITION_LABELS drifted between trust_labels.ts and .dart',
      );
    });

    test('DISPOSITION_STATUS_LABELS match across TS and Dart', () {
      expect(
        quotedBlockAfter(dart, 'dispositionStatusLabels'),
        equals(quotedBlockAfter(ts, 'DISPOSITION_STATUS_LABELS')),
        reason: 'DISPOSITION_STATUS_LABELS drifted between trust_labels.ts and .dart',
      );
    });

    test('INTERIM_LABEL matches across TS and Dart', () {
      expect(
        quotedScalarAfter(dart, 'interimLabel'),
        equals(quotedScalarAfter(ts, 'INTERIM_LABEL')),
        reason: 'INTERIM_LABEL drifted between trust_labels.ts and .dart',
      );
    });

    test('INTERIM_DISCLOSURE matches across TS and Dart', () {
      expect(
        quotedScalarAfter(dart, 'interimDisclosure'),
        equals(quotedScalarAfter(ts, 'INTERIM_DISCLOSURE')),
        reason: 'INTERIM_DISCLOSURE drifted between trust_labels.ts and .dart — an interim result '
            'must never read as final on either side of the language seam',
      );
    });

    // Mirrors how copy_guidelines_parity_test.dart pins its own word-boundary matcher: both files
    // must build the CHARACTER-IDENTICAL regex, not just agree on the term list. The TS source
    // reads `new RegExp(`\\b${escaped}(?:e?s)?\\b`)`; the Dart source must contain the same
    // pattern text after normalising `${escaped}` interpolation syntax (identical in both
    // languages here, so no normalisation is actually needed — that itself is part of what is
    // pinned).
    test('causal-term matcher (word boundary + optional plural) is character-identical across '
        'TS and Dart', () {
      const outerPattern = r'\\b${escaped}(?:e?s)?\\b';
      expect(ts.contains(outerPattern), isTrue,
          reason: 'trust_labels.ts causal-term matcher drifted from the pinned pattern');
      expect(dart.contains(outerPattern), isTrue,
          reason: 'trust_labels.dart causal-term matcher drifted from the pinned pattern');
    });

    // The TS side escapes regex metacharacters in a term before building the word-boundary
    // pattern (`term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')`); the Dart side must escape the same
    // character class the same way, or a term containing one of these characters would match
    // differently (or throw) on one side of the seam.
    test('causal-term escape character class is character-identical across TS and Dart', () {
      const escapeClass = r'[.*+?^${}()|[\]\\]';
      expect(ts.contains(escapeClass), isTrue,
          reason: 'trust_labels.ts regex-escape character class drifted from the pinned pattern');
      expect(dart.contains(escapeClass), isTrue,
          reason: 'trust_labels.dart regex-escape character class drifted from the pinned pattern');
    });

    // Load-bearing omission (see the doc comment on CAUSAL_VERBS / causalVerbs): bare 'lower' is
    // the comparative ADJECTIVE in this vocabulary's own non-causal phrasing ("is associated with
    // lower"), so listing it in CAUSAL_VERBS would make correlational copy fail the very gate that
    // is supposed to permit it. Bare 'higher' is not a verb in any form and is absent for the same
    // reason (it appears only in the non-causal RELATION_PHRASES entries). If either bare word
    // were added back, `causalCopyViolations` would flag every correlational card in the product.
    test("CAUSAL_VERBS does not contain the bare comparative 'lower' or 'higher'", () {
      final tsVerbs = quotedListAfterEquals(ts, 'CAUSAL_VERBS');
      final dartVerbs = quotedListAfterEquals(dart, 'causalVerbs');
      for (final verbs in [tsVerbs, dartVerbs]) {
        expect(
          verbs.contains('lower'),
          isFalse,
          reason: "CAUSAL_VERBS/causalVerbs must not contain bare 'lower' — it is the comparative "
              'adjective in this vocabulary\'s own non-causal phrasing ("is associated with '
              'lower"), so listing it would make correlational copy fail the causal-verb copy '
              'gate that is supposed to permit it. (Verb forms lowers/lowering and the causal '
              'template phrase "tends to lower" are listed instead.)',
        );
        expect(
          verbs.contains('higher'),
          isFalse,
          reason: "CAUSAL_VERBS/causalVerbs must not contain bare 'higher' — it is not a verb in "
              'any form and only appears in the non-causal RELATION_PHRASES entries ("is '
              'associated with higher", "has a proposed route to higher"); listing it would make '
              'correlational and mechanistic copy fail the causal-verb copy gate.',
        );
      }
    });
  });
}
