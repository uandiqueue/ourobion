// Pure-Dart models for the `get_insight_provenance` RPC result (U7 provenance
// view, backlog O12 app side).
//
// The JSON contract is STABLE and documented in the RPC's migration header —
// supabase/migrations/20260724085023_create_o12_insight_provenance_rpc.sql.
// A null top-level result means the card is not visible to the caller
// (not-found and not-owned are deliberately indistinguishable).
//
// The edge sub-objects come from LEFT joins (claim / verification / payload
// entry may each be missing), so every edge field except edgeId is nullable —
// the parsers must tolerate any of them being absent.
//
// This file deliberately has NO package imports so it can be executed outside
// the Flutter package (live-proof scripts, plain `dart` VM) — keep it pure.

Map<String, dynamic>? _asMap(dynamic v) =>
    v == null ? null : Map<String, dynamic>.from(v as Map);

List<dynamic> _asList(dynamic v) => v == null ? const [] : v as List<dynamic>;

/// The `card` object: the insight card the provenance belongs to.
class ProvenanceCardInfo {
  final int id;
  final String ruleId;
  final String title;
  final String body;

  /// 'rules' | 'edge' | 'personal' (§S8 producer column).
  final String producer;
  final String category;

  /// 'info' | 'notice' | 'watch' — styling at most, never medical urgency.
  final String severity;
  final String generatedAt;

  const ProvenanceCardInfo({
    required this.id,
    required this.ruleId,
    required this.title,
    required this.body,
    required this.producer,
    required this.category,
    required this.severity,
    required this.generatedAt,
  });

  factory ProvenanceCardInfo.fromJson(Map<String, dynamic> json) {
    return ProvenanceCardInfo(
      id: (json['id'] as num).toInt(),
      ruleId: json['ruleId'] as String,
      title: json['title'] as String,
      body: json['body'] as String,
      producer: json['producer'] as String,
      category: json['category'] as String,
      severity: json['severity'] as String,
      generatedAt: json['generatedAt'] as String,
    );
  }
}

/// §S7 data-coverage score for the pattern window.
class ProvenanceCompleteness {
  final double score;
  final int daysPresent;
  final int windowDays;

  /// Days-with-data per contributing metric key.
  final Map<String, int> perMetric;

  const ProvenanceCompleteness({
    required this.score,
    required this.daysPresent,
    required this.windowDays,
    required this.perMetric,
  });

  factory ProvenanceCompleteness.fromJson(Map<String, dynamic> json) {
    final per = _asMap(json['perMetric']) ?? const {};
    return ProvenanceCompleteness(
      score: (json['score'] as num).toDouble(),
      daysPresent: (json['daysPresent'] as num).toInt(),
      windowDays: (json['windowDays'] as num).toInt(),
      perMetric: per.map((k, v) => MapEntry(k, (v as num).toInt())),
    );
  }
}

/// The user's own pair statistics backing the card (D2 personal signal).
/// Present only when a gate-passing personal signal backs the branch — honest:
/// null otherwise.
class ProvenancePersonal {
  final double rho;
  final double nEff;
  final double qValue;
  final bool stable;

  const ProvenancePersonal({
    required this.rho,
    required this.nEff,
    required this.qValue,
    required this.stable,
  });

  factory ProvenancePersonal.fromJson(Map<String, dynamic> json) {
    return ProvenancePersonal(
      rho: (json['rho'] as num).toDouble(),
      nEff: (json['nEff'] as num).toDouble(),
      qValue: (json['qValue'] as num).toDouble(),
      stable: json['stable'] as bool,
    );
  }
}

/// One bounded evidence passage carried on a citation (O15/B1) — what the
/// verifier was actually shown.
class ProvenanceEvidencePassage {
  final String text;
  final String? locator;

  const ProvenanceEvidencePassage({required this.text, this.locator});

  factory ProvenanceEvidencePassage.fromJson(Map<String, dynamic> json) {
    return ProvenanceEvidencePassage(
      text: json['text'] as String,
      locator: json['locator'] as String?,
    );
  }
}

/// One cited source on a claim (shared/brain/relationships.ts `Citation`).
class ProvenanceCitation {
  final String paperId;
  final String? title;
  final int? year;

  /// Per-paper studied population, verbatim; null when the source states none.
  final String? population;

  /// Study-design strength 1..5 (shared/brain `EvidenceTier` — a NUMBER on the
  /// wire; U12 fix: this was mistyped `String?` and threw on real pipeline data).
  final int? evidenceTier;
  final String? impactTier;

  /// 'supports' | 'refutes' | 'mixed' | 'mentions'.
  final String? stance;

  /// Additive-optional (legacy records have none) — parses to [] when absent.
  final List<ProvenanceEvidencePassage> evidence;

  const ProvenanceCitation({
    required this.paperId,
    this.title,
    this.year,
    this.population,
    this.evidenceTier,
    this.impactTier,
    this.stance,
    this.evidence = const [],
  });

  factory ProvenanceCitation.fromJson(Map<String, dynamic> json) {
    return ProvenanceCitation(
      paperId: json['paperId'] as String,
      title: json['title'] as String?,
      year: (json['year'] as num?)?.toInt(),
      population: json['population'] as String?,
      evidenceTier: (json['evidenceTier'] as num?)?.toInt(),
      impactTier: json['impactTier'] as String?,
      stance: json['stance'] as String?,
      evidence: _asList(
        json['evidence'],
      ).map((e) => ProvenanceEvidencePassage.fromJson(_asMap(e)!)).toList(),
    );
  }
}

/// One verbatim quote span backing a claim
/// (shared/brain/relationships.ts `QuoteSpan`).
class ProvenanceQuoteSpan {
  final String paperId;
  final String quote;
  final String? locator;
  final int? charStart;
  final int? charEnd;

  const ProvenanceQuoteSpan({
    required this.paperId,
    required this.quote,
    this.locator,
    this.charStart,
    this.charEnd,
  });

  factory ProvenanceQuoteSpan.fromJson(Map<String, dynamic> json) {
    return ProvenanceQuoteSpan(
      paperId: json['paperId'] as String,
      quote: json['quote'] as String,
      locator: json['locator'] as String?,
      charStart: (json['charStart'] as num?)?.toInt(),
      charEnd: (json['charEnd'] as num?)?.toInt(),
    );
  }
}

/// One cited edge: the claim + the verification version the card was composed
/// against (the verdict at the cited verifiedAt, not whatever is newest).
class ProvenanceEdge {
  final String edgeId;
  final String? subject;
  final String? object;
  final String? relation;

  /// Composition-time direction from the payload: 'consistent' |
  /// 'inconsistent' | null.
  final String? direction;
  final String? servingBand;
  final double? edgeScore;
  final String? verdict;
  final String? verifiedAt;

  /// Synthesis reasoning trace (copy-gated at production time).
  final String? derivation;

  /// Claim-level scope, verbatim.
  final String? population;
  final List<ProvenanceQuoteSpan> quoteSpans;
  final List<ProvenanceCitation> citations;

  const ProvenanceEdge({
    required this.edgeId,
    this.subject,
    this.object,
    this.relation,
    this.direction,
    this.servingBand,
    this.edgeScore,
    this.verdict,
    this.verifiedAt,
    this.derivation,
    this.population,
    this.quoteSpans = const [],
    this.citations = const [],
  });

  factory ProvenanceEdge.fromJson(Map<String, dynamic> json) {
    return ProvenanceEdge(
      edgeId: json['edgeId'] as String,
      subject: json['subject'] as String?,
      object: json['object'] as String?,
      relation: json['relation'] as String?,
      direction: json['direction'] as String?,
      servingBand: json['servingBand'] as String?,
      edgeScore: (json['edgeScore'] as num?)?.toDouble(),
      verdict: json['verdict'] as String?,
      verifiedAt: json['verifiedAt'] as String?,
      derivation: json['derivation'] as String?,
      population: json['population'] as String?,
      quoteSpans: _asList(
        json['quoteSpans'],
      ).map((e) => ProvenanceQuoteSpan.fromJson(_asMap(e)!)).toList(),
      citations: _asList(
        json['citations'],
      ).map((e) => ProvenanceCitation.fromJson(_asMap(e)!)).toList(),
    );
  }
}

/// The full per-card provenance record.
class InsightProvenance {
  final ProvenanceCardInfo card;

  /// Null when the card has no composed insight (plain rules cards).
  final String? patternKey;

  /// 'agree' | 'research-context' | 'idiosyncratic' | 'contradiction' | null.
  final String? branch;
  final ProvenanceCompleteness? completeness;
  final ProvenancePersonal? personal;

  /// [] for the uncited "from your own data" personal card and for plain
  /// rules cards — render that plainly, never decorated as research.
  final List<ProvenanceEdge> edges;

  const InsightProvenance({
    required this.card,
    this.patternKey,
    this.branch,
    this.completeness,
    this.personal,
    this.edges = const [],
  });

  factory InsightProvenance.fromJson(Map<String, dynamic> json) {
    final completeness = _asMap(json['completeness']);
    final personal = _asMap(json['personal']);
    return InsightProvenance(
      card: ProvenanceCardInfo.fromJson(_asMap(json['card'])!),
      patternKey: json['patternKey'] as String?,
      branch: json['branch'] as String?,
      completeness: completeness == null
          ? null
          : ProvenanceCompleteness.fromJson(completeness),
      personal: personal == null ? null : ProvenancePersonal.fromJson(personal),
      edges: _asList(
        json['edges'],
      ).map((e) => ProvenanceEdge.fromJson(_asMap(e)!)).toList(),
    );
  }
}
