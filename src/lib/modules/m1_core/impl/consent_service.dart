import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/consent_record.dart';

/// M1 Consent Service — manages the append-only `consent_records` table.
///
/// Per PDPA (Singapore) requirements, consent records are immutable.
/// Each change appends a new row rather than updating an existing one.
class ConsentService {
  final SupabaseClient _client;

  ConsentService(this._client);

  /// Get all consent records for a user (ordered newest first).
  Future<List<ConsentRecord>> getConsentRecords(String userId) async {
    final data = await _client
        .from('consent_records')
        .select()
        .eq('user_id', userId)
        .order('recorded_at', ascending: false);
    return (data as List).map((row) => ConsentRecord.fromMap(row)).toList();
  }

  /// Get the latest consent status for each scope.
  /// Returns a map of scope → granted (true/false).
  Future<Map<ConsentScope, bool>> getCurrentConsent(String userId) async {
    final records = await getConsentRecords(userId);
    final latest = <ConsentScope, bool>{};
    for (final record in records) {
      // Since records are ordered newest-first, the first occurrence
      // of each scope is the most recent decision.
      latest.putIfAbsent(record.scope, () => record.granted);
    }
    return latest;
  }

  /// Check if a user has granted consent for a specific scope.
  Future<bool> hasConsented(String userId, ConsentScope scope) async {
    final consent = await getCurrentConsent(userId);
    return consent[scope] ?? false;
  }

  /// Record a consent change (append-only — does NOT update existing rows).
  Future<void> updateConsent(
    String userId,
    ConsentScope scope,
    bool granted,
  ) async {
    await _client.from('consent_records').insert({
      'user_id': userId,
      'scope': scope.dbKey,
      'granted': granted,
    });
  }

  /// Record multiple consent changes at once (e.g., from the onboarding screen).
  Future<void> updateMultipleConsents(
    String userId,
    Map<ConsentScope, bool> consents,
  ) async {
    final rows = consents.entries.map((e) => {
      'user_id': userId,
      'scope': e.key.dbKey,
      'granted': e.value,
    }).toList();

    await _client.from('consent_records').insert(rows);
  }
}
