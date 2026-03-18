import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/user_profile.dart';

/// M1 Profile Service — reads and writes to the `profiles` table.
class ProfileService {
  final SupabaseClient _client;

  ProfileService(this._client);

  /// Get a user's profile by their ID.
  /// The profile row is auto-created on sign-up via a database trigger,
  /// so this should always return a result for authenticated users.
  Future<UserProfile> getProfile(String userId) async {
    final data = await _client
        .from('profiles')
        .select()
        .eq('user_id', userId)
        .single();
    return UserProfile.fromMap(data);
  }

  /// Update profile fields. Only pass the fields you want to change.
  Future<void> updateProfile(String userId, Map<String, dynamic> updates) async {
    updates['updated_at'] = DateTime.now().toIso8601String();
    await _client
        .from('profiles')
        .update(updates)
        .eq('user_id', userId);
  }
}
