import 'package:supabase_flutter/supabase_flutter.dart';

/// True once ~7 days have passed since the last answered standing-water check,
/// or if it has never been answered. Keeps the audit weekly, not daily —
/// see m2-context.md "Standing water audit is weekly, not daily".
bool isStandingWaterPromptDue(DateTime? lastAnsweredDate, DateTime today) {
  if (lastAnsweredDate == null) return true;
  final last = DateTime(
    lastAnsweredDate.year,
    lastAnsweredDate.month,
    lastAnsweredDate.day,
  );
  final now = DateTime(today.year, today.month, today.day);
  return now.difference(last).inDays >= 7;
}

class StandingWaterService {
  final SupabaseClient _client;
  StandingWaterService(this._client);

  /// Most recent date the user answered the standing-water question, scanning
  /// `daily_gut_rows` for the latest non-null value. Null if never answered.
  Future<DateTime?> getLastAnsweredDate(String userId) async {
    final data = await _client
        .from('daily_gut_rows')
        .select('log_date')
        .eq('user_id', userId)
        .not('standing_water_present', 'is', null)
        .order('log_date', ascending: false)
        .limit(1) as List<dynamic>;
    if (data.isEmpty) return null;
    return DateTime.parse(data.first['log_date'] as String);
  }
}
