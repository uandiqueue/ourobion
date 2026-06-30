import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/user_profile.dart';

/// M1 Profile Service — reads and writes to the `profiles` table.
class ProfileService {
  final SupabaseClient _client;

  ProfileService(this._client);

  /// Get a user's profile by their ID.
  /// Returns null if no profile row exists (e.g. if the auto-create trigger
  /// failed), so the caller can redirect to profile setup instead of crashing.
  Future<UserProfile?> getProfile(String userId) async {
    try {
      final data = await _client
          .from('profiles')
          .select()
          .eq('user_id', userId)
          .single();
      return UserProfile.fromMap(data);
    } on PostgrestException catch (e) {
      if (e.code == 'PGRST116') return null; // no rows — trigger didn't fire
      rethrow;
    }
  }

  /// Update profile fields. Only pass the fields you want to change.
  Future<void> updateProfile(String userId, Map<String, dynamic> updates) async {
    final data = {
      ...updates,
      'updated_at': DateTime.now().toIso8601String(),
    };
    await _client
        .from('profiles')
        .update(data)
        .eq('user_id', userId);
  }
}
