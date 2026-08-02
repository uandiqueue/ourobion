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

  /// Whether this card's serving window has already closed at [nowUtc]. A row
  /// with no `expires_at` never closes.
  ///
  /// Deliberately the same relation [InsightService.getInsights] and
  /// [InsightService.filterEmission] apply (`expires_at > cutoff` keeps the
  /// row), so "expired" here means exactly "the deck would not serve this even
  /// if it read `active`". The Archive tab needs that distinction: returning an
  /// expired saved card to the deck takes it out of the archive without putting
  /// it anywhere the user can see, and the confirmation has to say so instead
  /// of promising a return that will not happen.
  bool isExpiredAt(DateTime nowUtc) {
    final expiry = expiresAt;
    return expiry != null && !expiry.toUtc().isAfter(nowUtc.toUtc());
  }

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

  // ─── Session status overlay ─────────────────────────────────────────────
  //
  // Save / dismiss / return-to-deck are shown from THIS MAP, not from the row
  // the database hands back. The database write still happens and still has to
  // succeed — the overlay is only recorded after `updateStatus` returns without
  // throwing — but the read paths no longer depend on the write having CHANGED
  // anything for the UI to move.
  //
  // Why: the shared demo account (`test@ourobion.com`) has its writes silently
  // discarded by a database trigger (migration 20260802030000), so its cards
  // never actually change status. Without an overlay a viewer swipes a card and
  // the SAVED count does not move and the Archive tab stays empty, which reads
  // as a broken app. With it, every deck interaction is demonstrable, and none
  // of it persists: the map dies with the process, so the next viewer opens the
  // seeded deck exactly as it was.
  //
  // For a NORMAL account the overlay and the database always agree — the write
  // lands, and the overlay says the same thing the next fetch would — so this
  // changes nothing about real behaviour. It is not a cache: nothing is served
  // from it that the database was not already asked for, and a failed write
  // (which throws) records no override, so a genuine error is never masked.
  //
  // STATIC because insights_tab, archive_tab and home_tab each construct their
  // own [InsightService]; a per-instance map would let the Archive tab disagree
  // with the deck about the card just saved. Cleared by [resetSessionOverrides].

  static final Map<int, InsightStatus> _sessionStatus = {};
  static final Map<int, InsightCard> _sessionSeen = {};

  /// Drops every session override. Called by the deck reset, and by tests that
  /// need a clean slate between cases (the maps are static, so they otherwise
  /// outlive a single test).
  static void resetSessionOverrides() {
    _sessionStatus.clear();
    _sessionSeen.clear();
  }

  /// The status a card should be TREATED as having right now: the session
  /// override if the user moved it, otherwise whatever the database says.
  static InsightStatus _effectiveStatus(InsightCard card) =>
      _sessionStatus[card.id] ?? card.status;

  /// Remember every card we have seen, so a card the user saved can still be
  /// listed in the Archive tab even when the database never recorded the move.
  static List<InsightCard> _remember(List<InsightCard> cards) {
    for (final card in cards) {
      _sessionSeen[card.id] = card;
    }
    return cards;
  }

  /// Expiry cutoff for the PostgREST filter, always UTC with an explicit `Z`.
  /// A naive local ISO string (the old `DateTime.now().toIso8601String()`) is
  /// read as UTC by the timestamptz comparison, skewing the cutoff by the local
  /// offset (~8h for SGT users) — audit finding A27.
  static String expiryCutoffUtcIso(DateTime now) =>
      now.toUtc().toIso8601String();

  // ─── Deck order ─────────────────────────────────────────────────────────
  //
  // Every read path orders through [sortedForDeck] / [compareForDeck]. There is
  // exactly one comparator on purpose: the one-shot fetch and the realtime
  // stream feed the SAME deck widget, so two independent sorts would let the
  // deck visibly reshuffle the moment a realtime emission replaced the list.

  /// Deck order. Total, not partial — see [sortedForDeck].
  ///
  /// 1. **Research-linked cards lead.** [InsightCard.isResearchLinked] is the
  ///    model's own predicate for "this card carries a verified-edge citation"
  ///    (edge producer AND at least one ref). It is deliberately the whole
  ///    primary key: an `edge` card whose `edge_refs` came back empty has no
  ///    citation to show, so it sorts with everything else rather than leading
  ///    a deck on the strength of its producer column alone.
  /// 2. **Confidence descending.** The continuation of the same idea — after
  ///    "which cards are cited", the next question is "how strongly is this
  ///    one backed". Severity was considered and rejected as the second key:
  ///    the engine hardcodes `severity: 'info'` for every edge and personal
  ///    card (only `rules` cards carry a rule's severity), so it is near-
  ///    constant across a live deck, and letting a low-confidence `watch` card
  ///    outrank a high-confidence one would contradict the change itself.
  /// 3. **Freshest first** (`generatedAt` descending) — same evidence strength,
  ///    so prefer the reading about today.
  /// 4. **`id` descending.** Unique by construction (bigserial PK), which makes
  ///    this a TOTAL order: no two distinct cards ever compare equal.
  static int compareForDeck(InsightCard a, InsightCard b) {
    if (a.isResearchLinked != b.isResearchLinked) {
      return a.isResearchLinked ? -1 : 1;
    }
    final byConfidence = b.confidenceScore.compareTo(a.confidenceScore);
    if (byConfidence != 0) return byConfidence;
    final byRecency = b.generatedAt.compareTo(a.generatedAt);
    if (byRecency != 0) return byRecency;
    return b.id.compareTo(a.id);
  }

  /// A new list in [compareForDeck] order. The single ordering seam: every read
  /// path returns through this, and nothing here drops a card — the deck still
  /// carries the "still researching" personal cards, they just follow the
  /// cited ones.
  ///
  /// The comparator has to be a TOTAL order because `List.sort` makes no
  /// stability guarantee: if two distinct cards compared equal, their relative
  /// order could differ between two sorts of the same data and the deck would
  /// look like it shuffled itself. Ties are therefore broken all the way down
  /// to the primary key.
  ///
  /// Sorted in Dart rather than with PostgREST `.order()` because the rule is
  /// not expressible server-side on BOTH paths. `isResearchLinked` is a
  /// conjunction over `producer` and a jsonb array's emptiness (no such
  /// column), and `SupabaseStreamBuilder.order()` takes a single column and
  /// re-applies it client-side to realtime deltas by raw num/String compare —
  /// a jsonb value there compares as "equal" and the ordering silently
  /// degrades. One Dart comparator gives both paths the identical deck.
  static List<InsightCard> sortedForDeck(List<InsightCard> cards) =>
      List<InsightCard>.of(cards)..sort(compareForDeck);

  /// Client-side serve filter for one realtime emission: `active` and not
  /// expired at [nowUtc]. Static and pure so tests can drive it with an
  /// advancing clock — the cutoff must move per emission, not freeze at
  /// subscription time (A27).
  ///
  /// Filtering only. Ordering is [sortedForDeck]'s job and [watchInsights]
  /// applies it to this output — kept apart so each stays a small pure
  /// function with its own contract test.
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

  /// Fetches active, non-expired insight cards for the user, in [sortedForDeck]
  /// order — research-linked cards lead. Nothing is filtered out beyond the
  /// existing active/unexpired serve filter.
  Future<List<InsightCard>> getInsights(String userId) async {
    final cutoff = expiryCutoffUtcIso(_nowUtc());
    final data = await _client
        .from('insight_cards')
        .select()
        .eq('user_id', userId)
        .eq('status', 'active')
        .or('expires_at.is.null,expires_at.gt.$cutoff') as List<dynamic>;
    final rows = _remember(data
        .map((row) => InsightCard.fromJson(row as Map<String, dynamic>))
        .toList());
    // A card the user saved or swiped away this session leaves the deck even if
    // the database still reports it active (the demo account's writes are
    // discarded). Everything else is served exactly as fetched.
    return sortedForDeck(rows
        .where((card) => _effectiveStatus(card) == InsightStatus.active)
        .toList());
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
  ///
  /// Ordered with the deck's own comparator. The archive is a list, not a deck,
  /// so "cited first" is less load-bearing here — but it was previously served
  /// in whatever order PostgREST happened to return, which is the same defect,
  /// and there is no `saved_at` column to offer the more natural "most recently
  /// saved first". One comparator over two orderings also keeps a saved card in
  /// the same relative position the user last saw it in the deck.
  Future<List<InsightCard>> getArchivedInsights(String userId) async {
    final data = await _client
        .from('insight_cards')
        .select()
        .eq('user_id', userId)
        .inFilter('status', archiveStatuses.map(statusValue).toList())
            as List<dynamic>;
    _remember(data
        .map((row) => InsightCard.fromJson(row as Map<String, dynamic>))
        .toList());
    // Built from every card seen this session, not just the rows the database
    // returned, so a card saved against the demo account appears here too.
    // Keyed by id, so a card the database already reports archived is not also
    // added by the overlay.
    final archived = <int, InsightCard>{};
    for (final card in _sessionSeen.values) {
      if (archiveStatuses.contains(_effectiveStatus(card))) {
        archived[card.id] = card;
      }
    }
    return sortedForDeck(archived.values.toList());
  }

  /// Realtime stream of active insight cards. Updates whenever the nightly job
  /// writes new cards or the user changes a card's status. The expiry cutoff is
  /// re-evaluated on every emission (not frozen at subscription — A27), and
  /// every emission is re-ordered with [sortedForDeck] — the same comparator
  /// [getInsights] uses, so a realtime push cannot reorder the deck under the
  /// user.
  Stream<List<InsightCard>> watchInsights(String userId) {
    return _client
        .from('insight_cards')
        .stream(primaryKey: ['id'])
        .eq('user_id', userId)
        .map((rows) => sortedForDeck(filterEmission(rows, _nowUtc())));
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
  ///
  /// The session override is recorded ONLY after the write returns. A write
  /// that throws — a real network or permission failure — records nothing and
  /// still propagates, so the overlay can never paper over a genuine error. A
  /// write that succeeds but changes no row (the demo account, whose writes the
  /// database discards) is indistinguishable from a normal success here, which
  /// is exactly why the UI can be driven from the override.
  Future<void> updateStatus(int cardId, InsightStatus status) async {
    await _client
        .from('insight_cards')
        .update({'status': statusValue(status)})
        .eq('id', cardId);
    _sessionStatus[cardId] = status;
  }

  /// The user-held statuses [resetCurrentPeriodDeck] returns to
  /// [InsightStatus.active] — every value the `status` CHECK allows EXCEPT
  /// `active` itself.
  ///
  /// [InsightStatus.dismissed] is the one that matters. A dismissed card is
  /// visible nowhere: [getInsights] filters on `active`, [archiveStatuses]
  /// deliberately excludes it, and generate-insights counts it in
  /// `dismissedSkipped` so the nightly pass never brings it back either. Before
  /// this reset, a single swipe-left was unrecoverable inside the app — only a
  /// direct database write got the card back. [InsightStatus.archived] /
  /// [InsightStatus.snoozed] are included because the reset is "put this
  /// period's deck back the way it was", which includes cards the user saved;
  /// those leave the Archive tab until they are saved again, and the
  /// confirmation copy says so.
  ///
  /// Order is fixed so the PostgREST filter is deterministic in tests.
  /// insight_status_contract_test.dart pins this against the DB CHECK: a new
  /// held status that reset cannot reach would be a new black hole.
  static const resettableStatuses = <InsightStatus>[
    InsightStatus.archived,
    InsightStatus.snoozed,
    InsightStatus.dismissed,
  ];

  /// Returns THIS PERIOD's held cards to [InsightStatus.active] and answers
  /// with the rows that actually moved.
  ///
  /// ── What "this period" means ────────────────────────────────────────────
  /// A card's period is its own serving window: generate-insights stamps
  /// `expires_at = now + expiry_days` on every (re)generation, and the composer
  /// uses `COMPOSER_EXPIRY_DAYS = 7`. So "this week's deck" is already recorded
  /// on the row — the unexpired set IS the current period — and no new notion
  /// of a week is invented here. The predicate is CHARACTER-FOR-CHARACTER the
  /// one [getInsights] applies (`expires_at is null OR expires_at > cutoff`),
  /// which is what makes the guarantee exact in both directions:
  ///   * everything this restores is something [getInsights] will then serve;
  ///   * nothing past its `expires_at` is resurrected — an expired row is not
  ///     matched, so it is not written at all.
  ///
  /// ── What it cannot do ───────────────────────────────────────────────────
  /// This is an UPDATE with a WHERE clause. It has no INSERT and no upsert, so
  /// it cannot create a card; it flips `status` on rows that already exist. A
  /// reset that could conjure a row would be inventing an insight. It is also
  /// non-destructive: no row is deleted, and re-running it is a no-op once
  /// everything in scope already reads `active`.
  ///
  /// RLS: an ordinary authenticated write over the user's own rows, through the
  /// same `Users can update own insight card status` policy the deck's swipe
  /// uses. `.eq('user_id', userId)` narrows the statement; the policy is what
  /// enforces it.
  Future<List<InsightCard>> resetCurrentPeriodDeck(String userId) async {
    final cutoff = expiryCutoffUtcIso(_nowUtc());
    final rows = await _client
        .from('insight_cards')
        .update({'status': statusValue(InsightStatus.active)})
        .eq('user_id', userId)
        .inFilter('status', resettableStatuses.map(statusValue).toList())
        .or('expires_at.is.null,expires_at.gt.$cutoff')
        .select();

    // Cards held only in the session overlay are restored too, and counted
    // once. Without this the demo account's reset reports "0 cards" — the
    // database moved nothing, because nothing had moved in it to begin with.
    // Keyed by id so a card both written AND overridden is reported once.
    final restored = <int, InsightCard>{};
    for (final card in rows.map(InsightCard.fromJson)) {
      restored[card.id] = card;
    }
    for (final entry in _sessionStatus.entries) {
      if (!resettableStatuses.contains(entry.value)) continue;
      final card = _sessionSeen[entry.key];
      if (card == null) continue;
      restored.putIfAbsent(card.id, () => card);
    }
    resetSessionOverrides();
    return sortedForDeck(restored.values.toList());
  }
}
