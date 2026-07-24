import 'package:supabase_flutter/supabase_flutter.dart';

import 'provenance_models.dart';

/// Read service for a card's provenance (U7 / backlog O12 app side), over the
/// `get_insight_provenance(p_card_id bigint)` RPC (migration 20260724085023).
/// SECURITY INVOKER: the caller's RLS applies — a null result means the card
/// is not visible to this user (not-found and not-owned are indistinguishable
/// by design; render both as "nothing to show").
class ProvenanceService {
  final SupabaseClient _client;
  ProvenanceService(this._client);

  Future<InsightProvenance?> getProvenance(int cardId) async {
    final data = await _client.rpc(
      'get_insight_provenance',
      params: {'p_card_id': cardId},
    );
    if (data == null) return null;
    return InsightProvenance.fromJson(Map<String, dynamic>.from(data as Map));
  }
}
