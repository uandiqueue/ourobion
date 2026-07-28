/// Full user profile as defined in m1-context.md.
/// Maps to the `profiles` table in Supabase.
///
/// The daily-digest preference is deliberately NOT a field here. It lives in
/// `public.profile_notification_prefs` and is reached through
/// `ProfileService.getDailyDigestEnabled` / `setDailyDigestEnabled`, because
/// R4-U2's non-regression suite pins the `profiles` column-privilege map —
/// see the header of migration 20260728040001_profile_daily_digest.sql.
class UserProfile {
  final String userId;
  final String displayName;
  final String region; // country name e.g. 'Singapore'
  final String city;
  final String? email;
  final bool wearableOwned; // toggle only — no integration in MVP
  final DateTime createdAt;
  final DateTime updatedAt;

  const UserProfile({
    required this.userId,
    required this.displayName,
    required this.region,
    required this.city,
    this.email,
    this.wearableOwned = false,
    required this.createdAt,
    required this.updatedAt,
  });

  /// Returns a copy with the given fields replaced.
  ///
  /// The Profile tab's toggles used to rebuild `UserProfile` by hand, re-listing
  /// every field at the call site — so any field added later would have been
  /// silently dropped on the next toggle. This keeps the copy exhaustive in one
  /// place; the guard test asserts every untouched field survives.
  UserProfile copyWith({bool? wearableOwned}) {
    return UserProfile(
      userId: userId,
      displayName: displayName,
      region: region,
      city: city,
      email: email,
      wearableOwned: wearableOwned ?? this.wearableOwned,
      createdAt: createdAt,
      updatedAt: DateTime.now(),
    );
  }

  /// Create a UserProfile from a Supabase row (Map).
  factory UserProfile.fromMap(Map<String, dynamic> map) {
    return UserProfile(
      userId: map['user_id'] as String,
      displayName: map['display_name'] as String? ?? '',
      region: map['region'] as String? ?? '',
      city: map['city'] as String? ?? '',
      email: map['email'] as String?,
      wearableOwned: map['wearable_owned'] as bool? ?? false,
      createdAt: DateTime.parse(map['created_at'] as String),
      updatedAt: DateTime.parse(map['updated_at'] as String),
    );
  }

  /// Convert this profile to a Map for Supabase upsert.
  Map<String, dynamic> toMap() {
    return {
      'user_id': userId,
      'display_name': displayName,
      'region': region,
      'city': city,
      'email': email,
      'wearable_owned': wearableOwned,
      'updated_at': DateTime.now().toIso8601String(),
    };
  }
}
