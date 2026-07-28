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

  // ── Notification preferences ─────────────────────────────────────────────
  // These live in `public.profile_notification_prefs`, NOT on `profiles`, and
  // are reached only through two SECURITY DEFINER RPCs. That table has RLS on,
  // zero policies and no grants for `authenticated`, so there is no table-level
  // read or write path from the app at all. See the header of migration
  // 20260728040001_profile_daily_digest.sql for why the column-on-profiles
  // shape had to be abandoned.
  //
  // NEITHER RPC TAKES A USER ID — the database resolves the subject from
  // auth.uid() itself, so a client cannot name someone else's row. Do not add a
  // userId parameter here "for symmetry" with updateProfile: the asymmetry IS
  // the security property.

  /// The signed-in user's own daily-digest preference; false if never set.
  Future<bool> getDailyDigestEnabled() async {
    final value = await _client.rpc('get_daily_digest_enabled');
    return value as bool? ?? false;
  }

  /// Upserts the signed-in user's own daily-digest preference. Throws on
  /// failure (offline, or 42501 when unauthenticated) — callers must not report
  /// success without awaiting this.
  Future<void> setDailyDigestEnabled(bool enabled) async {
    await _client.rpc(
      'set_daily_digest_enabled',
      params: {'p_enabled': enabled},
    );
  }
}
