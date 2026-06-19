// shared/types/index.dart
// Dart mirror of shared/types/index.ts. Held in lockstep by the shared-types-ts-dart-parity guard.

class DailyGutRow {
  final String id;
  final String userId;
  final String date;
  final String region;
  final num? urineColour;
  final num? stoolCount;
  final num? stoolForm;
  final num? stoolVariability;
  final num? outsideMeals;
  final num? mosquitoBites;
  final bool? standingWaterPresent;
  final bool? onAntibiotics;
  final bool? gutWatchActive;
  final num? energyScore;
  final num? moodScore;
  final num? gutComfortScore;
  final List<String> symptomFlags;
  final String? notes;
  final num logCompleteness;
  final String createdAt;
  final String updatedAt;

  const DailyGutRow({
    required this.id,
    required this.userId,
    required this.date,
    required this.region,
    this.urineColour,
    this.stoolCount,
    this.stoolForm,
    this.stoolVariability,
    this.outsideMeals,
    this.mosquitoBites,
    this.standingWaterPresent,
    this.onAntibiotics,
    this.gutWatchActive,
    this.energyScore,
    this.moodScore,
    this.gutComfortScore,
    this.symptomFlags = const [],
    this.notes,
    required this.logCompleteness,
    required this.createdAt,
    required this.updatedAt,
  });

  factory DailyGutRow.fromJson(Map<String, dynamic> json) {
    return DailyGutRow(
      id: json['id'] as String,
      userId: json['user_id'] as String,
      date: json['date'] as String,
      region: json['region'] as String,
      urineColour: json['urine_colour'] as num?,
      stoolCount: json['stool_count'] as num?,
      stoolForm: json['stool_form'] as num?,
      stoolVariability: json['stool_variability'] as num?,
      outsideMeals: json['outside_meals'] as num?,
      mosquitoBites: json['mosquito_bites'] as num?,
      standingWaterPresent: json['standing_water_present'] as bool?,
      onAntibiotics: json['on_antibiotics'] as bool?,
      gutWatchActive: json['gut_watch_active'] as bool?,
      energyScore: json['energy_score'] as num?,
      moodScore: json['mood_score'] as num?,
      gutComfortScore: json['gut_comfort_score'] as num?,
      symptomFlags: (json['symptom_flags'] as List?)?.cast<String>() ?? const [],
      notes: json['notes'] as String?,
      logCompleteness: json['log_completeness'] as num,
      createdAt: json['created_at'] as String,
      updatedAt: json['updated_at'] as String,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'user_id': userId,
      'date': date,
      'region': region,
      'urine_colour': urineColour,
      'stool_count': stoolCount,
      'stool_form': stoolForm,
      'stool_variability': stoolVariability,
      'outside_meals': outsideMeals,
      'mosquito_bites': mosquitoBites,
      'standing_water_present': standingWaterPresent,
      'on_antibiotics': onAntibiotics,
      'gut_watch_active': gutWatchActive,
      'energy_score': energyScore,
      'mood_score': moodScore,
      'gut_comfort_score': gutComfortScore,
      'symptom_flags': symptomFlags,
      'notes': notes,
      'log_completeness': logCompleteness,
      'created_at': createdAt,
      'updated_at': updatedAt,
    };
  }
}

class DailyPhysioRow {
  final String userId;
  final String date;
  final num? restingHrBpm;
  final num? hrvSdnnMs;
  final num? sleepDurationMin;
  final num? spo2Pct;
  final num? bodyTempC;
  final num? stepCount;
  final String? source;
  final String syncedAt;

  const DailyPhysioRow({
    required this.userId,
    required this.date,
    this.restingHrBpm,
    this.hrvSdnnMs,
    this.sleepDurationMin,
    this.spo2Pct,
    this.bodyTempC,
    this.stepCount,
    this.source,
    required this.syncedAt,
  });

  factory DailyPhysioRow.fromJson(Map<String, dynamic> json) {
    return DailyPhysioRow(
      userId: json['user_id'] as String,
      date: json['date'] as String,
      restingHrBpm: json['resting_hr_bpm'] as num?,
      hrvSdnnMs: json['hrv_sdnn_ms'] as num?,
      sleepDurationMin: json['sleep_duration_min'] as num?,
      spo2Pct: json['spo2_pct'] as num?,
      bodyTempC: json['body_temp_c'] as num?,
      stepCount: json['step_count'] as num?,
      source: json['source'] as String?,
      syncedAt: json['synced_at'] as String,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'user_id': userId,
      'date': date,
      'resting_hr_bpm': restingHrBpm,
      'hrv_sdnn_ms': hrvSdnnMs,
      'sleep_duration_min': sleepDurationMin,
      'spo2_pct': spo2Pct,
      'body_temp_c': bodyTempC,
      'step_count': stepCount,
      'source': source,
      'synced_at': syncedAt,
    };
  }
}

class DailyEnvRow {
  final String id;
  final String userId;
  final String date;
  final String region;
  final num? tempMaxC;
  final num? tempMinC;
  final num? heatIndexC;
  final num? rainfallMm;
  final num? uvIndex;
  final num? ndviScore;
  final String? greenCoverBucket;
  final num? dengueCaseRate;
  final bool outbreakAlertActive;
  final num? timeInGreenMin;
  final String createdAt;

  const DailyEnvRow({
    required this.id,
    required this.userId,
    required this.date,
    required this.region,
    this.tempMaxC,
    this.tempMinC,
    this.heatIndexC,
    this.rainfallMm,
    this.uvIndex,
    this.ndviScore,
    this.greenCoverBucket,
    this.dengueCaseRate,
    required this.outbreakAlertActive,
    this.timeInGreenMin,
    required this.createdAt,
  });

  factory DailyEnvRow.fromJson(Map<String, dynamic> json) {
    return DailyEnvRow(
      id: json['id'] as String,
      userId: json['user_id'] as String,
      date: json['date'] as String,
      region: json['region'] as String,
      tempMaxC: json['temp_max_c'] as num?,
      tempMinC: json['temp_min_c'] as num?,
      heatIndexC: json['heat_index_c'] as num?,
      rainfallMm: json['rainfall_mm'] as num?,
      uvIndex: json['uv_index'] as num?,
      ndviScore: json['ndvi_score'] as num?,
      greenCoverBucket: json['green_cover_bucket'] as String?,
      dengueCaseRate: json['dengue_case_rate'] as num?,
      outbreakAlertActive: json['outbreak_alert_active'] as bool,
      timeInGreenMin: json['time_in_green_min'] as num?,
      createdAt: json['created_at'] as String,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'user_id': userId,
      'date': date,
      'region': region,
      'temp_max_c': tempMaxC,
      'temp_min_c': tempMinC,
      'heat_index_c': heatIndexC,
      'rainfall_mm': rainfallMm,
      'uv_index': uvIndex,
      'ndvi_score': ndviScore,
      'green_cover_bucket': greenCoverBucket,
      'dengue_case_rate': dengueCaseRate,
      'outbreak_alert_active': outbreakAlertActive,
      'time_in_green_min': timeInGreenMin,
      'created_at': createdAt,
    };
  }
}

class BaselineSnapshot {
  final String id;
  final String userId;
  final String metricKey;
  final String computedAt;
  final num daysOfData;
  final num? mean;
  final num? stdDev;
  final num? min;
  final num? max;
  final String? trend;
  final String confidence;
  final List<String> dataSources;

  const BaselineSnapshot({
    required this.id,
    required this.userId,
    required this.metricKey,
    required this.computedAt,
    required this.daysOfData,
    this.mean,
    this.stdDev,
    this.min,
    this.max,
    this.trend,
    required this.confidence,
    this.dataSources = const [],
  });

  factory BaselineSnapshot.fromJson(Map<String, dynamic> json) {
    return BaselineSnapshot(
      id: json['id'] as String,
      userId: json['user_id'] as String,
      metricKey: json['metric_key'] as String,
      computedAt: json['computed_at'] as String,
      daysOfData: json['days_of_data'] as num,
      mean: json['mean'] as num?,
      stdDev: json['std_dev'] as num?,
      min: json['min'] as num?,
      max: json['max'] as num?,
      trend: json['trend'] as String?,
      confidence: json['confidence'] as String,
      dataSources: (json['data_sources'] as List?)?.cast<String>() ?? const [],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'user_id': userId,
      'metric_key': metricKey,
      'computed_at': computedAt,
      'days_of_data': daysOfData,
      'mean': mean,
      'std_dev': stdDev,
      'min': min,
      'max': max,
      'trend': trend,
      'confidence': confidence,
      'data_sources': dataSources,
    };
  }
}

class InsightCard {
  final String id;
  final String userId;
  final String generatedAt;
  final String title;
  final String body;
  final String category;
  final String severity;
  final List<String> contributingMetrics;
  final num confidenceScore;
  final List<String> confidenceSources;
  final String status;
  final String? expiresAt;
  final String ruleId;
  final String phaseGenerated;

  const InsightCard({
    required this.id,
    required this.userId,
    required this.generatedAt,
    required this.title,
    required this.body,
    required this.category,
    required this.severity,
    this.contributingMetrics = const [],
    required this.confidenceScore,
    this.confidenceSources = const [],
    required this.status,
    this.expiresAt,
    required this.ruleId,
    required this.phaseGenerated,
  });

  factory InsightCard.fromJson(Map<String, dynamic> json) {
    return InsightCard(
      id: json['id'] as String,
      userId: json['user_id'] as String,
      generatedAt: json['generated_at'] as String,
      title: json['title'] as String,
      body: json['body'] as String,
      category: json['category'] as String,
      severity: json['severity'] as String,
      contributingMetrics:
          (json['contributing_metrics'] as List?)?.cast<String>() ?? const [],
      confidenceScore: json['confidence_score'] as num,
      confidenceSources:
          (json['confidence_sources'] as List?)?.cast<String>() ?? const [],
      status: json['status'] as String,
      expiresAt: json['expires_at'] as String?,
      ruleId: json['rule_id'] as String,
      phaseGenerated: json['phase_generated'] as String,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'user_id': userId,
      'generated_at': generatedAt,
      'title': title,
      'body': body,
      'category': category,
      'severity': severity,
      'contributing_metrics': contributingMetrics,
      'confidence_score': confidenceScore,
      'confidence_sources': confidenceSources,
      'status': status,
      'expires_at': expiresAt,
      'rule_id': ruleId,
      'phase_generated': phaseGenerated,
    };
  }
}

class InsightFiredEvent {
  final String eventType;
  final String userId;
  final String insightId;
  final String category;
  final String severity;
  final String firedAt;

  const InsightFiredEvent({
    required this.eventType,
    required this.userId,
    required this.insightId,
    required this.category,
    required this.severity,
    required this.firedAt,
  });

  factory InsightFiredEvent.fromJson(Map<String, dynamic> json) {
    return InsightFiredEvent(
      eventType: json['event_type'] as String,
      userId: json['user_id'] as String,
      insightId: json['insight_id'] as String,
      category: json['category'] as String,
      severity: json['severity'] as String,
      firedAt: json['fired_at'] as String,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'event_type': eventType,
      'user_id': userId,
      'insight_id': insightId,
      'category': category,
      'severity': severity,
      'fired_at': firedAt,
    };
  }
}

class EngagementState {
  final String userId;
  final String updatedAt;
  final num dqsToday;
  final num dqs7DayAvg;
  final num currentStreakDays;
  final num longestStreakDays;
  final num streakThresholdDqs;
  final String activeTitle;
  final List<String> unlockedTitles;

  const EngagementState({
    required this.userId,
    required this.updatedAt,
    required this.dqsToday,
    required this.dqs7DayAvg,
    required this.currentStreakDays,
    required this.longestStreakDays,
    required this.streakThresholdDqs,
    required this.activeTitle,
    this.unlockedTitles = const [],
  });

  factory EngagementState.fromJson(Map<String, dynamic> json) {
    return EngagementState(
      userId: json['user_id'] as String,
      updatedAt: json['updated_at'] as String,
      dqsToday: json['dqs_today'] as num,
      dqs7DayAvg: json['dqs_7day_avg'] as num,
      currentStreakDays: json['current_streak_days'] as num,
      longestStreakDays: json['longest_streak_days'] as num,
      streakThresholdDqs: json['streak_threshold_dqs'] as num,
      activeTitle: json['active_title'] as String,
      unlockedTitles:
          (json['unlocked_titles'] as List?)?.cast<String>() ?? const [],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'user_id': userId,
      'updated_at': updatedAt,
      'dqs_today': dqsToday,
      'dqs_7day_avg': dqs7DayAvg,
      'current_streak_days': currentStreakDays,
      'longest_streak_days': longestStreakDays,
      'streak_threshold_dqs': streakThresholdDqs,
      'active_title': activeTitle,
      'unlocked_titles': unlockedTitles,
    };
  }
}

const List<String> kSymptomFlags = [
  'feverish',
  'nausea',
  'body_aches',
  'fatigue',
  'loss_of_appetite',
  'abdominal_cramps',
  'headache',
];
