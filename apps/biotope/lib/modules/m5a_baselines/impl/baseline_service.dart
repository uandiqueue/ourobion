import 'package:supabase_flutter/supabase_flutter.dart';

// ─── Model ────────────────────────────────────────────────────────────────────

enum BaselineTrend { rising, falling, stable }

enum BaselineConfidence { insufficient, low, medium, high }

class BaselineSnapshot {
  final int id;
  final String userId;
  final String metricKey;
  final DateTime computedAt;
  final int daysOfData;
  final double? mean;
  final double? stdDev;
  final double? min;
  final double? max;
  final BaselineTrend? trend;
  final BaselineConfidence confidence;
  final List<String> dataSources;

  const BaselineSnapshot({
    required this.id,
    required this.userId,
    required this.metricKey,
    required this.computedAt,
    required this.daysOfData,
    this.mean,
    this.stdDev,
    this.min,
    this.max,
    this.trend,
    required this.confidence,
    required this.dataSources,
  });

  factory BaselineSnapshot.fromJson(Map<String, dynamic> json) {
    return BaselineSnapshot(
      id: json['id'] as int,
      userId: json['user_id'] as String,
      metricKey: json['metric_key'] as String,
      computedAt: DateTime.parse(json['computed_at'] as String),
      daysOfData: json['days_of_data'] as int,
      mean: (json['mean'] as num?)?.toDouble(),
      stdDev: (json['std_dev'] as num?)?.toDouble(),
      min: (json['min'] as num?)?.toDouble(),
      max: (json['max'] as num?)?.toDouble(),
      trend: _parseTrend(json['trend'] as String?),
      confidence: _parseConfidence(json['confidence'] as String),
      dataSources: List<String>.from(json['data_sources'] as List),
    );
  }

  static BaselineTrend? _parseTrend(String? value) => switch (value) {
        'rising' => BaselineTrend.rising,
        'falling' => BaselineTrend.falling,
        'stable' => BaselineTrend.stable,
        _ => null,
      };

  static BaselineConfidence _parseConfidence(String value) => switch (value) {
        'low' => BaselineConfidence.low,
        'medium' => BaselineConfidence.medium,
        'high' => BaselineConfidence.high,
        _ => BaselineConfidence.insufficient,
      };
}

// ─── Service ──────────────────────────────────────────────────────────────────

class BaselineService {
  final SupabaseClient _client;
  BaselineService(this._client);

  /// Returns the current baseline snapshot for a single metric, or null if the
  /// nightly job has not yet computed one (e.g. user has fewer than 3 days of data).
  Future<BaselineSnapshot?> getBaseline(
    String userId,
    String metricKey,
  ) async {
    final data = await _client
        .from('baseline_snapshots')
        .select()
        .eq('user_id', userId)
        .eq('metric_key', metricKey)
        .maybeSingle();
    if (data == null) return null;
    return BaselineSnapshot.fromJson(data);
  }

  /// Returns all current baseline snapshots for a user (one per metric).
  /// Returns an empty list if the nightly job has not run yet.
  Future<List<BaselineSnapshot>> getBaselines(String userId) async {
    final data = await _client
        .from('baseline_snapshots')
        .select()
        .eq('user_id', userId) as List<dynamic>;
    return data
        .map((row) => BaselineSnapshot.fromJson(row as Map<String, dynamic>))
        .toList();
  }
}
