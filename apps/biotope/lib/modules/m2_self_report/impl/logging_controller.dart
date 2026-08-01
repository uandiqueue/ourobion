import 'package:flutter/foundation.dart' show visibleForTesting;
import 'package:supabase_flutter/supabase_flutter.dart';

import 'normaliser.dart';

/// Daily-core scalar keys Scan can answer *in full*, with the exact option set
/// its compact controls offer.
///
/// Every list exactly covers the database CHECK range. Scan may wrap the
/// longer ranges, but it must never abbreviate the stored domain or route a
/// scalar answer through a whole-row save.
const Map<String, List<int>> kInlineAnswerableOptions = {
  'urine_colour': [1, 2, 3, 4, 5, 6, 7, 8],
  'stool_form': [1, 2, 3, 4, 5, 6, 7],
  'outside_meals': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  'mosquito_bites': [
    0,
    1,
    2,
    3,
    4,
    5,
    6,
    7,
    8,
    9,
    10,
    11,
    12,
    13,
    14,
    15,
    16,
    17,
    18,
    19,
    20,
  ],
  'energy_score': [1, 2, 3, 4, 5],
  'mood_score': [1, 2, 3, 4, 5],
  'gut_comfort_score': [1, 2, 3, 4, 5],
};

class DailyLogInput {
  final int? urineColour;
  final int? stoolForm;
  final int? stoolCount;
  final int? outsideMeals;
  final int? mosquitoBites;
  final int? energy;
  final int? mood;
  final int? gutComfort;
  final int? appetite;
  final int? anxiety;
  final int? brainClarity;
  final int? focus;
  final int? socialInteractionQuality;
  final List<String> symptomFlags;
  final String? notes;
  final bool? standingWaterPresent;
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
    this.appetite,
    this.anxiety,
    this.brainClarity,
    this.focus,
    this.socialInteractionQuality,
    this.symptomFlags = const [],
    this.notes,
    this.standingWaterPresent,
    required this.logCompleteness,
  });

  bool get hasWellbeingCheckIn => hasWellbeingCheckInValues(
    appetite: appetite,
    anxiety: anxiety,
    brainClarity: brainClarity,
    focus: focus,
    socialInteractionQuality: socialInteractionQuality,
  );
}

/// T2 wellbeing values are optional and deliberately excluded from the daily-core DQS.
bool hasWellbeingCheckInValues({
  int? appetite,
  int? anxiety,
  int? brainClarity,
  int? focus,
  int? socialInteractionQuality,
}) => [
  appetite,
  anxiety,
  brainClarity,
  focus,
  socialInteractionQuality,
].any((value) => value != null);

bool canSaveDailyLog({required int dqs, required bool hasWellbeingCheckIn}) =>
    dqs > 0 || hasWellbeingCheckIn;

/// Values M2 stamps onto a daily row at write time: `region` copied from the
/// profile, and the two antibiotic-derived flags. Derived once
/// ([DailyLogService.rowContext]) and shared by both write paths so the two
/// cannot drift.
class DailyLogRowContext {
  final String region;
  final bool onAntibiotics;
  final bool gutWatchActive;

  const DailyLogRowContext({
    required this.region,
    required this.onAntibiotics,
    required this.gutWatchActive,
  });
}

class DailyLogService {
  final SupabaseClient _client;
  DailyLogService(this._client);

  // ── Pure payload builders ────────────────────────────────────────────────
  // Split out of the write methods so the difference between a WHOLE-ROW
  // upsert and a SINGLE-COLUMN update is provable without a database.
  // See test/m2_self_report/daily_log_partial_write_test.dart.

  /// Payload for the whole-row upsert behind [saveDailyLog].
  ///
  /// Every column is named EXPLICITLY, including the ones the caller left null.
  /// That is exactly what makes it correct for `DailyLogScreen` — which loads
  /// today's row, pre-populates every field, and re-sends all of them — and
  /// dangerous for anyone else: a caller that supplies one field gets a row
  /// where all the others have been overwritten with null.
  ///
  /// If you are writing a single field, you want [buildFieldPatch].
  @visibleForTesting
  static Map<String, dynamic> buildFullRowPayload({
    required String userId,
    required String logDate,
    required DailyLogRowContext context,
    required DailyLogInput input,
    required DateTime now,
  }) {
    final notes = input.notes?.trim();
    return {
      'user_id': userId,
      'log_date': logDate,
      'region': context.region,
      'urine_colour': input.urineColour,
      'stool_form': input.stoolForm,
      'stool_count': input.stoolCount,
      'outside_meals': input.outsideMeals,
      'mosquito_bites': input.mosquitoBites,
      'energy_score': input.energy,
      'mood_score': input.mood,
      'gut_comfort_score': input.gutComfort,
      'appetite_score': input.appetite,
      'anxiety_score': input.anxiety,
      'brain_clarity_score': input.brainClarity,
      'focus_score': input.focus,
      'social_interaction_quality_score': input.socialInteractionQuality,
      'symptom_flags': input.symptomFlags,
      'notes': (notes == null || notes.isEmpty) ? null : notes,
      'standing_water_present': input.standingWaterPresent,
      'on_antibiotics': context.onAntibiotics,
      'gut_watch_active': context.gutWatchActive,
      'log_completeness': input.logCompleteness,
      'updated_at': now.toIso8601String(),
    };
  }

  /// Patch for a single answered daily-core field.
  ///
  /// Contains ONLY the answered column plus the two columns that are a function
  /// of it (`log_completeness`, recomputed from the existing row merged with the
  /// new answer, and `updated_at`). Every other column is ABSENT from the map,
  /// so the `UPDATE` this feeds leaves each of them exactly as it was — that
  /// absence is the whole safety property, not an oversight.
  ///
  /// [existingRow] may be null (nothing logged today yet); completeness is then
  /// computed from the single answer alone.
  @visibleForTesting
  static Map<String, dynamic> buildFieldPatch({
    required Map<String, dynamic>? existingRow,
    required String metricKey,
    required Object? value,
    required DateTime now,
  }) {
    if (!kDailyCoreDqsWeights.containsKey(metricKey)) {
      throw ArgumentError.value(
        metricKey,
        'metricKey',
        'not a daily-core DQS key — inline answers may only write columns that '
            'count toward log_completeness',
      );
    }
    final dqsInputs = <String, Object?>{
      for (final key in kDailyCoreDqsWeights.keys) key: existingRow?[key],
      metricKey: value,
    };
    return {
      metricKey: value,
      'log_completeness': computeDqs(dqsInputs).toDouble(),
      'updated_at': now.toIso8601String(),
    };
  }

  // ── Writes ───────────────────────────────────────────────────────────────

  /// Derives `region` and the antibiotic flags for a given log date.
  @visibleForTesting
  Future<DailyLogRowContext> rowContext(String userId, String logDate) async {
    final profileRow = await _client
        .from('profiles')
        .select('region')
        .eq('user_id', userId)
        .single();
    final region = profileRow['region'] as String? ?? '';

    final today = DateTime.parse(logDate);
    final courses =
        await _client
                .from('antibiotic_courses')
                .select('start_date, end_date')
                .eq('user_id', userId)
            as List<dynamic>;

    var onAntibiotics = false;
    var gutWatchActive = false;
    for (final course in courses) {
      final start = DateTime.parse(course['start_date'] as String);
      final end = DateTime.parse(course['end_date'] as String);
      if (!today.isBefore(start) && !today.isAfter(end)) onAntibiotics = true;
      final watchEnd = end.add(const Duration(days: 14));
      if (today.isAfter(end) && !today.isAfter(watchEnd)) gutWatchActive = true;
    }

    return DailyLogRowContext(
      region: region,
      onAntibiotics: onAntibiotics,
      gutWatchActive: gutWatchActive,
    );
  }

  /// Whole-row save from `DailyLogScreen`. Safe only because that screen loads
  /// today's row first and re-sends every field.
  Future<void> saveDailyLog(
    String userId,
    String logDate,
    DailyLogInput input,
  ) async {
    final context = await rowContext(userId, logDate);
    await _client
        .from('daily_gut_rows')
        .upsert(
          buildFullRowPayload(
            userId: userId,
            logDate: logDate,
            context: context,
            input: input,
            now: DateTime.now(),
          ),
          onConflict: 'user_id,log_date',
        );
  }

  /// Writes ONE daily-core field and touches nothing else. Backs the Scan tab's
  /// inline chip answers.
  ///
  /// Deliberately not routed through [saveDailyLog]: that upserts the whole row,
  /// so answering one chip through it would null out everything already logged
  /// today. When today has no row yet there is nothing to preserve, so the patch
  /// is INSERTed alongside the stamped context columns.
  ///
  /// Returns the row's new `log_completeness`.
  Future<double> saveFieldAnswer(
    String userId,
    String logDate,
    String metricKey,
    Object? value,
  ) async {
    final existing = await getTodayLog(userId, logDate);
    final patch = buildFieldPatch(
      existingRow: existing,
      metricKey: metricKey,
      value: value,
      now: DateTime.now(),
    );

    if (existing == null) {
      final context = await rowContext(userId, logDate);
      await _client.from('daily_gut_rows').insert({
        'user_id': userId,
        'log_date': logDate,
        'region': context.region,
        'on_antibiotics': context.onAntibiotics,
        'gut_watch_active': context.gutWatchActive,
        ...patch,
      });
    } else {
      await _client
          .from('daily_gut_rows')
          .update(patch)
          .eq('user_id', userId)
          .eq('log_date', logDate);
    }

    return patch['log_completeness'] as double;
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
