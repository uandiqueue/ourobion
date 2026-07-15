import 'package:supabase_flutter/supabase_flutter.dart';

// ─── Model ────────────────────────────────────────────────────────────────────

enum InsightCategory { hydration, gut, vector, behaviour, descriptive }

enum InsightSeverity { info, notice, watch }

enum InsightStatus { active, snoozed, dismissed }

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
  });

  factory InsightCard.fromJson(Map<String, dynamic> json) {
    return InsightCard(
      id: json['id'] as int,
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
    );
  }

  static InsightCategory _parseCategory(String v) => switch (v) {
        'hydration' => InsightCategory.hydration,
        'gut' => InsightCategory.gut,
        'vector' => InsightCategory.vector,
        'behaviour' => InsightCategory.behaviour,
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
        _ => InsightStatus.active,
      };
}

// ─── Service ──────────────────────────────────────────────────────────────────

class InsightService {
  final SupabaseClient _client;
  InsightService(this._client);

  /// Fetches active, non-expired insight cards for the user.
  Future<List<InsightCard>> getInsights(String userId) async {
    final now = DateTime.now().toIso8601String();
    final data = await _client
        .from('insight_cards')
        .select()
        .eq('user_id', userId)
        .eq('status', 'active')
        .or('expires_at.is.null,expires_at.gt.$now') as List<dynamic>;
    return data
        .map((row) => InsightCard.fromJson(row as Map<String, dynamic>))
        .toList();
  }

  /// Realtime stream of active insight cards. Updates whenever the nightly job
  /// writes new cards or the user changes a card's status.
  Stream<List<InsightCard>> watchInsights(String userId) {
    final now = DateTime.now();
    return _client
        .from('insight_cards')
        .stream(primaryKey: ['id'])
        .eq('user_id', userId)
        .map((rows) => rows
            .where((r) {
              if (r['status'] != 'active') return false;
              final exp = r['expires_at'] as String?;
              if (exp != null && DateTime.parse(exp).isBefore(now)) return false;
              return true;
            })
            .map((r) => InsightCard.fromJson(r))
            .toList());
  }

  /// Updates a card's status to snoozed or dismissed.
  Future<void> updateStatus(int cardId, InsightStatus status) async {
    final value = switch (status) {
      InsightStatus.snoozed => 'snoozed',
      InsightStatus.dismissed => 'dismissed',
      InsightStatus.active => 'active',
    };
    await _client
        .from('insight_cards')
        .update({'status': value})
        .eq('id', cardId);
  }
}
