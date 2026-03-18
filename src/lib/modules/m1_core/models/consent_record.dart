/// Consent scope enum — matches m1-context.md definition.
enum ConsentScope {
  gutTracking,        // M2 core self-report — required for app to function
  behaviourTracking,  // M2 extended fields (mosquito, food, antibiotics)
  wearableData,       // M3 — future, shown greyed out in MVP with "coming soon"
  communityData,      // M7 — future, not shown in MVP UI
}

/// Maps enum values to/from the database string representation.
extension ConsentScopeX on ConsentScope {
  String get dbKey {
    switch (this) {
      case ConsentScope.gutTracking:       return 'gut_tracking';
      case ConsentScope.behaviourTracking: return 'behaviour_tracking';
      case ConsentScope.wearableData:      return 'wearable_data';
      case ConsentScope.communityData:     return 'community_data';
    }
  }

  static ConsentScope fromDbKey(String key) {
    switch (key) {
      case 'gut_tracking':        return ConsentScope.gutTracking;
      case 'behaviour_tracking':  return ConsentScope.behaviourTracking;
      case 'wearable_data':       return ConsentScope.wearableData;
      case 'community_data':      return ConsentScope.communityData;
      default: throw ArgumentError('Unknown consent scope: $key');
    }
  }
}

/// A single consent record row from the database.
class ConsentRecord {
  final int id;
  final String userId;
  final ConsentScope scope;
  final bool granted;
  final DateTime recordedAt;

  const ConsentRecord({
    required this.id,
    required this.userId,
    required this.scope,
    required this.granted,
    required this.recordedAt,
  });

  factory ConsentRecord.fromMap(Map<String, dynamic> map) {
    return ConsentRecord(
      id: map['id'] as int,
      userId: map['user_id'] as String,
      scope: ConsentScopeX.fromDbKey(map['scope'] as String),
      granted: map['granted'] as bool,
      recordedAt: DateTime.parse(map['recorded_at'] as String),
    );
  }
}
