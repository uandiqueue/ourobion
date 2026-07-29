// shared/brain/trust_labels.dart
//
// Hand-maintained Dart mirror of `shared/brain/trust_labels.ts` — the single TypeScript source of
// truth for user-facing trust/claim-strength vocabulary. Parity between the two files is enforced
// by `apps/biotope/test/guards/brain_trust_labels_parity_test.dart`, which fails if they drift.
//
// There is deliberately NO cross-language import here (O38). `shared/` is the only cross-language
// seam, and a Dart file may not import TypeScript, so the two files are kept identical by an
// executable guard rather than by a build step or a direct import. To keep that guard simple and
// total, BOTH files quote every map key and list every entry in the same order — the guard
// compares the ordered sequence of string literals inside each named constant. If you add an
// entry to trust_labels.ts, add it to this mirror in the same position.

class TrustLabels {
  // ─── Claim strength ───────────────────────────────────────────────────────────────────────

  /// What each claim kind means to a reader. These are the words a card may use ABOUT a claim;
  /// the words used INSIDE a sentence are `relationPhrases`.
  static const Map<String, String> claimKindLabels = {
    'correlational': 'Observed association',
    'mechanistic': 'Proposed mechanism',
    'causal': 'Reported causal effect',
  };

  /// One-line plain-language expansion, for progressive disclosure under the label.
  static const Map<String, String> claimKindDescriptions = {
    'correlational':
        'These moved together in the research. Direction of influence was not established.',
    'mechanistic':
        'A plausible biological route was proposed. Effects in people were not established.',
    'causal': 'The research reports one changing the other, under the study conditions stated.',
  };

  /// THE B-SCI1 FIX. The verb phrase a card may use for a monotonic relation, keyed by the
  /// EFFECTIVE claim kind. Only `causal` gets a directional verb; `correlational` gets
  /// association wording and `mechanistic` gets explicitly hedged mechanism wording.
  ///
  /// Non-monotonic relations (`modulates`, `correlates`, `confounds`, `no_effect`) are absent on
  /// purpose: a lookup miss must fail loudly rather than fall back to a directional default.
  static const Map<String, Map<String, String>> relationPhrases = {
    'correlational': {
      'increases': 'is associated with higher',
      'decreases': 'is associated with lower',
    },
    'mechanistic': {
      'increases': 'has a proposed route to higher',
      'decreases': 'has a proposed route to lower',
    },
    'causal': {
      'increases': 'tends to raise',
      'decreases': 'tends to lower',
    },
  };

  /// Verbs and phrases that assert one thing changing another. Matched on word boundaries, with
  /// an optional trailing `s`/`es`.
  ///
  /// Two deliberate omissions, both load-bearing:
  ///   * bare `lower` is absent — it is the comparative ADJECTIVE in this vocabulary's own
  ///     non-causal phrasing ("is associated with lower"), so listing it would make correlational
  ///     copy fail the very gate that is supposed to permit it. The verb forms `lowers` /
  ///     `lowering` and the explicit causal template phrase `tends to lower` are listed instead.
  ///   * bare `higher` is not a verb in any form and is absent for the same reason.
  static const List<String> causalVerbs = [
    'cause',
    'caused',
    'causing',
    'raise',
    'raised',
    'raising',
    'lowers',
    'lowered',
    'lowering',
    'increase',
    'increased',
    'increasing',
    'decrease',
    'decreased',
    'decreasing',
    'reduce',
    'reduced',
    'reducing',
    'boost',
    'boosted',
    'boosting',
    'trigger',
    'triggered',
    'triggering',
    'improve',
    'improved',
    'improving',
    'worsen',
    'worsened',
    'worsening',
    'prevent',
    'prevented',
    'preventing',
    'leads to',
    'led to',
    'results in',
    'resulted in',
    'brings on',
    'makes you',
    'tends to lower',
  ];

  // ─── Artifact trust posture ───────────────────────────────────────────────────────────────

  /// What a card says about where its underlying artifact came from (B-UI9).
  static const Map<String, String> postureLabels = {
    'fixture': 'Demo fixture',
    'live': 'Live source',
  };

  /// The disclosure that must appear BEFORE the claim on any card derived from a fixture artifact.
  static const Map<String, String> postureDisclosures = {
    'fixture': 'Demo fixture — built from stored sample data, not a live source.',
    'live': 'Built from a live source run.',
  };

  /// Whether the returned model identity was proven or merely configured (B-BR1).
  static const Map<String, String> attestationLabels = {
    'attested': 'Model identity returned by the provider',
    'unattested': 'Model identity not confirmed by the provider',
  };

  /// Whether the checking model came from a different family than the proposing one (O7).
  static const Map<String, String> decorrelationLabels = {
    'decorrelated': 'Checked by a different model family',
    'correlated': 'Checked by the same model family',
  };

  // ─── Study-design tier (renamed from "evidence tier" — B-SCI2) ────────────────────────────

  /// The user-facing NAME of the ladder. Never "evidence tier", never "quality".
  static const String studyDesignTierName = 'Study-design tier';

  /// What each rung of the ladder is, in plain words.
  static const Map<String, String> studyDesignTierLabels = {
    '1': 'Laboratory or mechanism study',
    '2': 'Cross-sectional or observational study',
    '3': 'Cohort or long-term follow-up study',
    '4': 'Randomised trial',
    '5': 'Review across many studies',
  };

  /// Said wherever a tier is shown: the tier describes the DESIGN, not the truth of the finding.
  static const String studyDesignTierDisclosure =
      'Describes how the research was designed, not how certain the finding is.';

  // ─── Support rank (never "confidence", never "certainty" — B-SCI2) ────────────────────────

  /// The user-facing NAME of the composite rank.
  static const String supportRankName = 'Prototype support rank';

  /// The band words ordinary users see INSTEAD of the number. `hold` is included so the
  /// vocabulary is total, though a held edge is never surfaced as a card.
  static const Map<String, String> supportBandLabels = {
    'high': 'More supporting research',
    'mid': 'Limited supporting research',
    'hold': 'Not enough supporting research',
  };

  /// Required beside any surface that exposes the NUMERIC rank (reviewer/expert surfaces only).
  static const String supportRankDisclosure =
      'Prototype support rank — an uncalibrated ordering used to sort research links. '
      'It is not a probability and does not measure how well established a finding is.';

  /// Required on every surface that shows a rank or a tier. The single sentence B-SCI2 mandates.
  static const String certaintyNotAssessed = 'Certainty is not assessed.';

  // ─── Verifier verdicts and expert disposition ──────────────────────────────────────────────

  /// Plain-language verdict words.
  static const Map<String, String> verdictLabels = {
    'supported': 'Backed by the sources checked',
    'partial': 'Partly backed by the sources checked',
    'unsupported': 'No supporting sources found',
    'contradicted': 'Sources point the other way',
    'uncertain': 'Could not be checked',
  };

  /// Current expert disposition, shown prominently on provenance (B-UI3).
  static const Map<String, String> dispositionLabels = {
    'accepted': 'Accepted by a reviewer',
    'rejected': 'Rejected by a reviewer',
    'pending': 'Not yet reviewed',
    'unavailable': 'Review status unavailable',
  };

  /// Why a disposition reads as it does. `stale-revision` is the B-BR7 case: a reviewer's
  /// decision was about DIFFERENT artifact bytes, so it does not carry over to what is being
  /// shown now.
  static const Map<String, String> dispositionStatusLabels = {
    'current': 'Reviewed for this version of the research link.',
    'stale-revision': 'An earlier review applied to a previous version and no longer applies.',
    'none': 'No reviewer decision has been recorded.',
  };

  // ─── Interim / held outputs ─────────────────────────────────────────────────────────────────

  /// An INTERIM result is a stand-in, not a finding. It may never set a serving band, bypass a
  /// deterministic gate, or be shown as final — so it gets its own vocabulary rather than
  /// borrowing a verdict word.
  static const String interimLabel = 'Interim — held';
  static const String interimDisclosure =
      'A stand-in step produced this. It is on hold and is not served as a finding.';

  // ─── Lookup helpers (fail loudly, never silently default) ─────────────────────────────────

  /// The verb phrase for a monotonic relation at a given effective claim kind. Throws for a
  /// non-monotonic relation or an unknown kind: a missing phrase must surface as a bug, never
  /// fall back to directional wording (that fallback is precisely how B-SCI1's inflation
  /// happened).
  static String relationPhraseFor(String kind, String relation) {
    final byRelation = relationPhrases[kind];
    if (byRelation == null) {
      throw ArgumentError('relationPhraseFor: unknown claim kind "$kind"');
    }
    final phrase = byRelation[relation];
    if (phrase == null) {
      throw ArgumentError(
        'relationPhraseFor: relation "$relation" is not monotonic and cannot carry a directional phrase',
      );
    }
    return phrase;
  }

  /// Word-boundary matcher for a causal term, allowing a trailing plural/3rd-person `s`.
  static RegExp _causalTermPattern(String term) {
    final escaped = term.replaceAllMapped(
      RegExp(r'[.*+?^${}()|[\]\\]'),
      (m) => '\\${m[0]}',
    );
    return RegExp('\\b${escaped}(?:e?s)?\\b');
  }

  /// Every causal term present in `text` (lowercased match), in `causalVerbs` order.
  static List<String> causalTermsIn(String text) {
    final lower = text.toLowerCase();
    return causalVerbs.where((term) => _causalTermPattern(term).hasMatch(lower)).toList();
  }

  /// True when `text` asserts one thing changing another.
  static bool containsCausalLanguage(String text) => causalTermsIn(text).isNotEmpty;

  /// THE CAUSAL-VERB COPY GATE. Rendered copy is admissible only if its causal language is
  /// licensed by the effective claim kind: anything weaker than `causal` must contain no causal
  /// verb at all.
  ///
  /// Returns the offending terms so a failure names what tripped it. An empty list means the
  /// copy passed — callers must treat a non-empty result as a DROP, never as a warning.
  static List<String> causalCopyViolations(String text, String effectiveKind) {
    if (effectiveKind == 'causal') return [];
    return causalTermsIn(text);
  }

  /// The user-facing study-design tier label for a tier number.
  static String studyDesignTierLabel(int tier) {
    final label = studyDesignTierLabels[tier.toString()];
    if (label == null) {
      throw ArgumentError('studyDesignTierLabel: unknown tier "$tier"');
    }
    return label;
  }
}
