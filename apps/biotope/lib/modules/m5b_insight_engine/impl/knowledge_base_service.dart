import 'package:supabase_flutter/supabase_flutter.dart';

/// Real counts behind the Home "Knowledge base" row.
///
/// This replaced a hardcoded three-line ticker that rotated every five seconds
/// and was backed by nothing — no paper count, no ingest state. It implied live
/// indexing activity that was not happening. Everything here comes from
/// `get_knowledge_base_stats()` (migration 20260728050000), which reads the
/// brain projection tables through the caller's own RLS.
class KnowledgeBaseStats {
  /// Distinct `citations[].paperId` across every relationship claim — a DOI, or
  /// a stable internal corpus id. Papers, not claims: one paper commonly
  /// supports several edges, so counting claims would inflate this.
  final int studiesIndexed;

  /// Relationships holding an active verification. An edge is a claim ABOUT
  /// papers, so this is deliberately not the same number as [studiesIndexed].
  final int edgesVerified;

  /// When the corpus was last loaded. Null when nothing has ever been loaded —
  /// the row must then say nothing rather than imply a recent refresh.
  final DateTime? lastIndexedAt;

  const KnowledgeBaseStats({
    required this.studiesIndexed,
    required this.edgesVerified,
    required this.lastIndexedAt,
  });

  /// Nothing indexed. Distinct from "we failed to look" — see
  /// [KnowledgeBaseService.getStats], which returns null on failure so the UI
  /// can hide the row instead of claiming an empty corpus it never read.
  static const empty = KnowledgeBaseStats(
    studiesIndexed: 0,
    edgesVerified: 0,
    lastIndexedAt: null,
  );

  /// True when there is genuinely something to report. The row should not
  /// render otherwise: a "0 studies indexed" line is honest but tells a user
  /// nothing useful, and the pulsing treatment would still imply activity.
  bool get hasContent => studiesIndexed > 0 || edgesVerified > 0;

  factory KnowledgeBaseStats.fromMap(Map<String, dynamic> map) {
    final raw = map['lastIndexedAt'];
    return KnowledgeBaseStats(
      studiesIndexed: (map['studiesIndexed'] as num?)?.toInt() ?? 0,
      edgesVerified: (map['edgesVerified'] as num?)?.toInt() ?? 0,
      lastIndexedAt: raw is String ? DateTime.tryParse(raw)?.toLocal() : null,
    );
  }
}

class KnowledgeBaseService {
  final SupabaseClient _client;

  KnowledgeBaseService(this._client);

  /// Returns null when the read fails, rather than throwing or pretending the
  /// corpus is empty. A failed read and an empty corpus are different claims,
  /// and the row must not make the second one on the strength of the first.
  Future<KnowledgeBaseStats?> getStats() async {
    try {
      final value = await _client.rpc('get_knowledge_base_stats');
      if (value is Map) return KnowledgeBaseStats.fromMap(Map<String, dynamic>.from(value));
      return null;
    } catch (_) {
      return null;
    }
  }
}
