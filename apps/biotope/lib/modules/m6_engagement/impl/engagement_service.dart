import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

// ── Title registry ─────────────────────────────────────────────────────────────

class TitleInfo {
  final String id;
  final String label;
  final String subtitle;
  final IconData icon;
  final int minStreak;
  final int minTotalLogs;

  const TitleInfo({
    required this.id,
    required this.label,
    required this.subtitle,
    required this.icon,
    this.minStreak = 0,
    this.minTotalLogs = 0,
  });
}

const kTitleRegistry = [
  TitleInfo(
    id: 'pioneer',
    label: 'Pioneer',
    subtitle: 'First log recorded',
    icon: Icons.science_outlined,
    minTotalLogs: 1,
  ),
  TitleInfo(
    id: 'committed',
    label: 'Committed',
    subtitle: '7-day streak',
    icon: Icons.local_fire_department_rounded,
    minStreak: 7,
  ),
  TitleInfo(
    id: 'consistent',
    label: 'Consistent',
    subtitle: '30-day streak',
    icon: Icons.verified_outlined,
    minStreak: 30,
  ),
  TitleInfo(
    id: 'explorer',
    label: 'Explorer',
    subtitle: '30 logs recorded',
    icon: Icons.explore_outlined,
    minTotalLogs: 30,
  ),
];

// ── Model ──────────────────────────────────────────────────────────────────────

class EngagementState {
  final int currentStreakDays;
  final int longestStreakDays;
  final double? dqs7DayAvg;
  final int totalLogs;
  final String? activeTitle;
  final List<String> unlockedTitles;

  const EngagementState({
    required this.currentStreakDays,
    required this.longestStreakDays,
    required this.dqs7DayAvg,
    required this.totalLogs,
    required this.activeTitle,
    required this.unlockedTitles,
  });

  factory EngagementState.fromJson(Map<String, dynamic> json) {
    return EngagementState(
      currentStreakDays: (json['current_streak_days'] as num?)?.toInt() ?? 0,
      longestStreakDays: (json['longest_streak_days'] as num?)?.toInt() ?? 0,
      dqs7DayAvg: (json['dqs_7day_avg'] as num?)?.toDouble(),
      totalLogs: (json['total_logs'] as num?)?.toInt() ?? 0,
      activeTitle: json['active_title'] as String?,
      unlockedTitles: (json['unlocked_titles'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          [],
    );
  }

  static const zero = EngagementState(
    currentStreakDays: 0,
    longestStreakDays: 0,
    dqs7DayAvg: null,
    totalLogs: 0,
    activeTitle: null,
    unlockedTitles: [],
  );
}

// ── Service ────────────────────────────────────────────────────────────────────

class EngagementService {
  final SupabaseClient _client;
  EngagementService(this._client);

  Future<EngagementState?> getEngagementState(String userId) async {
    final row = await _client
        .from('engagement_state')
        .select()
        .eq('user_id', userId)
        .maybeSingle();
    if (row == null) return null;
    return EngagementState.fromJson(row);
  }

  Future<void> updateOnLogWrite(
    String userId,
    String logDate,
    double dqs,
  ) async {
    final streakRowsFuture = _client
        .from('daily_gut_rows')
        .select('log_date, log_completeness')
        .eq('user_id', userId)
        .gte('log_completeness', 60)
        .order('log_date', ascending: false)
        .limit(60);

    final avgRowsFuture = _client
        .from('daily_gut_rows')
        .select('log_completeness')
        .eq('user_id', userId)
        .gte(
          'log_date',
          _dateStr(DateTime.now().subtract(const Duration(days: 6))),
        )
        .order('log_date', ascending: false);

    final countFuture = _client
        .from('daily_gut_rows')
        .select('log_date')
        .eq('user_id', userId);

    final streakRows = await streakRowsFuture as List<dynamic>;
    final avgRows = await avgRowsFuture as List<dynamic>;
    final countRows = await countFuture as List<dynamic>;

    final currentStreak = _computeStreak(
      streakRows.cast<Map<String, dynamic>>(),
    );

    final existingRow = await _client
        .from('engagement_state')
        .select('longest_streak_days')
        .eq('user_id', userId)
        .maybeSingle();
    final prevLongest = (existingRow?['longest_streak_days'] as num?)?.toInt() ?? 0;
    final longestStreak =
        currentStreak > prevLongest ? currentStreak : prevLongest;

    final totalLogs = countRows.length;

    double? avg7Day;
    if (avgRows.isNotEmpty) {
      final sum = avgRows.fold<double>(
        0,
        (acc, r) => acc + ((r['log_completeness'] as num?)?.toDouble() ?? 0),
      );
      avg7Day = sum / avgRows.length;
    }

    final unlocked = kTitleRegistry
        .where((t) =>
            (t.minTotalLogs == 0 || totalLogs >= t.minTotalLogs) &&
            (t.minStreak == 0 || currentStreak >= t.minStreak))
        .map((t) => t.id)
        .toList();

    final activeTitle = unlocked.isNotEmpty ? unlocked.last : null;

    await _client.from('engagement_state').upsert(
      {
        'user_id': userId,
        'current_streak_days': currentStreak,
        'longest_streak_days': longestStreak,
        'dqs_7day_avg': avg7Day,
        'total_logs': totalLogs,
        'active_title': activeTitle,
        'unlocked_titles': unlocked,
        'updated_at': DateTime.now().toIso8601String(),
      },
      onConflict: 'user_id',
    );
  }

  int _computeStreak(List<Map<String, dynamic>> rows) {
    if (rows.isEmpty) return 0;
    final dates = rows.map((r) {
      final d = DateTime.parse(r['log_date'] as String);
      return DateTime(d.year, d.month, d.day);
    }).toList();

    final now = DateTime.now();
    final todayNorm = DateTime(now.year, now.month, now.day);
    var check = dates.contains(todayNorm)
        ? todayNorm
        : todayNorm.subtract(const Duration(days: 1));

    int count = 0;
    for (final date in dates) {
      if (date == check) {
        count++;
        check = check.subtract(const Duration(days: 1));
      } else if (date.isBefore(check)) {
        break;
      }
    }
    return count;
  }

  String _dateStr(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
}
