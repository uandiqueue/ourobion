import 'package:supabase_flutter/supabase_flutter.dart';

class DailyLogInput {
  final int? urineColour;
  final int? stoolForm;
  final int? stoolCount;
  final int? outsideMeals;
  final int? mosquitoBites;
  final int? energy;
  final int? mood;
  final int? gutComfort;
  final List<String> symptomFlags;
  final String? notes;
  final double logCompleteness;

  const DailyLogInput({
    this.urineColour,
    this.stoolForm,
    this.stoolCount,
    this.outsideMeals,
    this.mosquitoBites,
    this.energy,
    this.mood,
    this.gutComfort,
    this.symptomFlags = const [],
    this.notes,
    required this.logCompleteness,
  });
}

class DailyLogService {
  final SupabaseClient _client;
  DailyLogService(this._client);

  Future<void> saveDailyLog(
    String userId,
    String logDate,
    DailyLogInput input,
  ) async {
    final profileRow = await _client
        .from('profiles')
        .select('region')
        .eq('user_id', userId)
        .single();
    final region = profileRow['region'] as String? ?? '';

    final today = DateTime.parse(logDate);
    final courses = await _client
        .from('antibiotic_courses')
        .select('start_date, end_date')
        .eq('user_id', userId) as List<dynamic>;

    var onAntibiotics = false;
    var gutWatchActive = false;
    for (final course in courses) {
      final start = DateTime.parse(course['start_date'] as String);
      final end = DateTime.parse(course['end_date'] as String);
      if (!today.isBefore(start) && !today.isAfter(end)) onAntibiotics = true;
      final watchEnd = end.add(const Duration(days: 14));
      if (today.isAfter(end) && !today.isAfter(watchEnd)) gutWatchActive = true;
    }

    final notes = input.notes?.trim();
    await _client.from('daily_gut_rows').upsert(
      {
        'user_id': userId,
        'log_date': logDate,
        'region': region,
        'urine_colour': input.urineColour,
        'stool_form': input.stoolForm,
        'stool_count': input.stoolCount,
        'outside_meals': input.outsideMeals,
        'mosquito_bites': input.mosquitoBites,
        'energy_score': input.energy,
        'mood_score': input.mood,
        'gut_comfort_score': input.gutComfort,
        'symptom_flags': input.symptomFlags,
        'notes': (notes == null || notes.isEmpty) ? null : notes,
        'on_antibiotics': onAntibiotics,
        'gut_watch_active': gutWatchActive,
        'log_completeness': input.logCompleteness,
        'updated_at': DateTime.now().toIso8601String(),
      },
      onConflict: 'user_id,log_date',
    );
  }

  Future<Map<String, dynamic>?> getTodayLog(
    String userId,
    String logDate,
  ) async {
    return await _client
        .from('daily_gut_rows')
        .select()
        .eq('user_id', userId)
        .eq('log_date', logDate)
        .maybeSingle();
  }
}
