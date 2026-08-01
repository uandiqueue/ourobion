import 'package:supabase_flutter/supabase_flutter.dart';

// ─── Model ────────────────────────────────────────────────────────────────────
//
// TODO(D18): retire this module-local model in favour of the shared Dart mirror
// (shared/types/index.dart), per sign-off decision D18. Blocked for lib/ code: a
// relative import cannot escape the package's lib/ directory (analyzer:
// uri_does_not_exist), so importing the mirror needs shared/ to gain a pubspec +
// a path dependency here — a shared/ change outside this unit's scope. Until
// then this model is held field-for-field aligned with the shared mirror
// (id, user_id, generated_at, title, body, category, severity,
// contributing_metrics, confidence_score, confidence_sources, status,
// expires_at, rule_id, phase_generated, producer, insight_id, edge_refs).

enum InsightCategory { hydration, gut, vector, behaviour, descriptive, relationship }

enum InsightSeverity { info, notice, watch }

/// Card lifecycle status. Mirrors the `insight_cards.status` CHECK
/// (20260515110000 + 20260728040000) and `shared/types/index.ts`'s union —
/// held in lockstep by insight_status_contract_test.dart, which parses all
/// three sources rather than restating the list.
///
/// * [active] — servable in the deck.
/// * [snoozed] — held by the user. Pre-dates [archived] and was the Archive
///   tab's stand-in for "saved"; existing rows keep this value (see the
///   20260728040000 migration comment). Nothing in the app writes it today.
/// * [dismissed] — held by the user; never regenerated.
/// * [archived] — the user saved the card to the Archive tab (swipe-right).
///
/// Every value except [active] must also be listed in `USER_HELD_STATUSES` in
/// supabase/functions/generate-insights/index.ts, or the nightly regeneration
/// pass silently flips the card back to [active].
enum InsightStatus { active, snoozed, dismissed, archived }

/// Who produced the card (§S8 producer column): plain rules engine, a verified
/// research edge, or the user's own personal-signal evaluator.
enum InsightProducer { rules, edge, personal }

/// One card ↔ verified-edge reference inside [InsightCard.edgeRefs]. Mirrors the
/// shared `InsightCardEdgeRef` (jsonb payload written by generate-insights —
/// keys stay camelCase on the wire). `verifiedAt` pins the edge VERSION (§S6).
class InsightCardEdgeRef {
  final String edgeId;
  final String verifiedAt;

  const InsightCardEdgeRef({required this.edgeId, required this.verifiedAt});

  factory InsightCardEdgeRef.fromJson(Map<String, dynamic> json) {
    return InsightCardEdgeRef(
      edgeId: json['edgeId'] as String,
      verifiedAt: json['verifiedAt'] as String,
    );
  }
}

class InsightCard {
  final int id;
  final String userId;
  final String ruleId;
  final DateTime generatedAt;
  final String title;
  final String body;
  final InsightCategory category;
  final InsightSeverity severity;
  final List<String> contributingMetrics;
  final double confidenceScore;
  final List<String> confidenceSources;
  final InsightStatus status;
  final DateTime? expiresAt;
  final String phaseGenerated;

  /// §S8 producer columns. Optional-with-default (docs/memory/0002): rows
  /// serialized before migration 20260716050639 lack them; fromJson tolerates
  /// the missing keys with the DB-backfill defaults ('rules' / null / []).
  final InsightProducer producer;
  final String? insightId; // composed_insights FK; null for plain rules cards
  final List<InsightCardEdgeRef> edgeRefs; // always [] for producer 'personal'

  const InsightCard({
    required this.id,
    required this.userId,
    required this.ruleId,
    required this.generatedAt,
    required this.title,
    required this.body,
    required this.category,
    required this.severity,
    required this.contributingMetrics,
    required this.confidenceScore,
    required this.confidenceSources,
    required this.status,
    this.expiresAt,
    required this.phaseGenerated,
    this.producer = InsightProducer.rules,
    this.insightId,
    this.edgeRefs = const [],
  });

  /// Research-linked: an edge-producer card carrying at least one verified-edge
  /// citation — the UI owes it a citation affordance.
  bool get isResearchLinked =>
      producer == InsightProducer.edge && edgeRefs.isNotEmpty;

  /// Still researching: a personal-producer card — a pattern seen in the user's
  /// own data with no published-research citation (yet).
  bool get isStillResearching =>
      producer == InsightProducer.personal && edgeRefs.isEmpty;

  factory InsightCard.fromJson(Map<String, dynamic> json) {
    return InsightCard(
      id: (json['id'] as num).toInt(),
      userId: json['user_id'] as String,
      ruleId: json['rule_id'] as String,
      generatedAt: DateTime.parse(json['generated_at'] as String),
      title: json['title'] as String,
      body: json['body'] as String,
      category: _parseCategory(json['category'] as String),
      severity: _parseSeverity(json['severity'] as String),
      contributingMetrics: List<String>.from(json['contributing_metrics'] as List),
      confidenceScore: (json['confidence_score'] as num).toDouble(),
      confidenceSources: List<String>.from(json['confidence_sources'] as List),
      status: _parseStatus(json['status'] as String),
      expiresAt: json['expires_at'] != null
          ? DateTime.parse(json['expires_at'] as String)
          : null,
      phaseGenerated: json['phase_generated'] as String,
      producer: _parseProducer(json['producer'] as String? ?? 'rules'),
      insightId: json['insight_id'] as String?,
      edgeRefs: (json['edge_refs'] as List?)
              ?.map((e) => InsightCardEdgeRef.fromJson(
                  Map<String, dynamic>.from(e as Map)))
              .toList() ??
          const [],
    );
  }

  static InsightCategory _parseCategory(String v) => switch (v) {
        'hydration' => InsightCategory.hydration,
        'gut' => InsightCategory.gut,
        'vector' => InsightCategory.vector,
        'behaviour' => InsightCategory.behaviour,
        'relationship' => InsightCategory.relationship,
        _ => InsightCategory.descriptive,
      };

  static InsightSeverity _parseSeverity(String v) => switch (v) {
        'notice' => InsightSeverity.notice,
        'watch' => InsightSeverity.watch,
        _ => InsightSeverity.info,
      };

  static InsightStatus _parseStatus(String v) => switch (v) {
        'snoozed' => InsightStatus.snoozed,
        'dismissed' => InsightStatus.dismissed,
        'archived' => InsightStatus.archived,
        _ => InsightStatus.active,
      };

  static InsightProducer _parseProducer(String v) => switch (v) {
        'edge' => InsightProducer.edge,
        'personal' => InsightProducer.personal,
        _ => InsightProducer.rules,
      };
}

// ─── Service ──────────────────────────────────────────────────────────────────

class InsightService {
  final SupabaseClient _client;
  final DateTime Function() _nowUtc;

  /// [nowUtc] is injectable for tests; production uses the system UTC clock.
  InsightService(this._client, {DateTime Function()? nowUtc})
      : _nowUtc = nowUtc ?? _systemNowUtc;

  static DateTime _systemNowUtc() => DateTime.now().toUtc();

  /// Expiry cutoff for the PostgREST filter, always UTC with an explicit `Z`.
  /// A naive local ISO string (the old `DateTime.now().toIso8601String()`) is
  /// read as UTC by the timestamptz comparison, skewing the cutoff by the local
  /// offset (~8h for SGT users) — audit finding A27.
  static String expiryCutoffUtcIso(DateTime now) =>
      now.toUtc().toIso8601String();

  /// Client-side serve filter for one realtime emission: `active` and not
  /// expired at [nowUtc]. Static and pure so tests can drive it with an
  /// advancing clock — the cutoff must move per emission, not freeze at
  /// subscription time (A27).
  static List<InsightCard> filterEmission(
      List<Map<String, dynamic>> rows, DateTime nowUtc) {
    return rows
        .where((r) {
          if (r['status'] != 'active') return false;
          final exp = r['expires_at'] as String?;
          if (exp != null && !_parseDbTimestamp(exp).isAfter(nowUtc.toUtc())) {
            return false;
          }
          return true;
        })
        .map(InsightCard.fromJson)
        .toList();
  }

  /// Parses a DB timestamp defensively: timestamptz wire values normally carry
  /// an offset, but a zone-less string must be read as a UTC instant —
  /// `DateTime.parse` alone would read it as LOCAL time (A27's skew).
  static DateTime _parseDbTimestamp(String v) {
    final parsed = DateTime.parse(v);
    if (parsed.isUtc) return parsed;
    // Zone-less string: reinterpret the wall-clock components as UTC.
    return DateTime.utc(parsed.year, parsed.month, parsed.day, parsed.hour,
        parsed.minute, parsed.second, parsed.millisecond, parsed.microsecond);
  }

  /// Fetches active, non-expired insight cards for the user.
  Future<List<InsightCard>> getInsights(String userId) async {
    final cutoff = expiryCutoffUtcIso(_nowUtc());
    final data = await _client
        .from('insight_cards')
        .select()
        .eq('user_id', userId)
        .eq('status', 'active')
        .or('expires_at.is.null,expires_at.gt.$cutoff') as List<dynamic>;
    return data
        .map((row) => InsightCard.fromJson(row as Map<String, dynamic>))
        .toList();
  }

  /// Statuses the Archive tab shows. [InsightStatus.archived] is the real
  /// status the deck's swipe-right writes today; [InsightStatus.snoozed] is
  /// included ONLY to keep rows saved before migration 20260728040000 visible
  /// — that migration deliberately does not relabel them (see its comment).
  /// Order is fixed so the PostgREST filter is deterministic in tests.
  static const archiveStatuses = <InsightStatus>[
    InsightStatus.archived,
    InsightStatus.snoozed,
  ];

  /// Fetches the user's archived ("saved") insight cards — the Archive tab's
  /// list, and the source of the Insights header's SAVED count.
  Future<List<InsightCard>> getArchivedInsights(String userId) async {
    final data = await _client
        .from('insight_cards')
        .select()
        .eq('user_id', userId)
        .inFilter('status', archiveStatuses.map(statusValue).toList())
            as List<dynamic>;
    return data
        .map((row) => InsightCard.fromJson(row as Map<String, dynamic>))
        .toList();
  }

  /// Realtime stream of active insight cards. Updates whenever the nightly job
  /// writes new cards or the user changes a card's status. The expiry cutoff is
  /// re-evaluated on every emission (not frozen at subscription — A27).
  Stream<List<InsightCard>> watchInsights(String userId) {
    return _client
        .from('insight_cards')
        .stream(primaryKey: ['id'])
        .eq('user_id', userId)
        .map((rows) => filterEmission(rows, _nowUtc()));
  }

  /// The DB literal for an [InsightStatus]. Exhaustive by construction: adding
  /// an enum value without a case here is an analyzer error, which is the
  /// cheapest of the four mirrors to get wrong-proof.
  static String statusValue(InsightStatus status) => switch (status) {
        InsightStatus.active => 'active',
        InsightStatus.snoozed => 'snoozed',
        InsightStatus.dismissed => 'dismissed',
        InsightStatus.archived => 'archived',
      };

  /// Writes a card's status (archive / dismiss / reactivate).
  Future<void> updateStatus(int cardId, InsightStatus status) async {
    await _client
        .from('insight_cards')
        .update({'status': statusValue(status)})
        .eq('id', cardId);
  }
}
