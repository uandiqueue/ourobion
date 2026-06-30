/// Full user profile as defined in m1-context.md.
/// Maps to the `profiles` table in Supabase.
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
