import 'dart:io';
import 'package:health/health.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class WearableReading {
  final double? restingHrBpm;
  final double? hrvSdnnMs;
  final int? sleepDurationMin;
  final double? spo2Pct;
  final double? bodyTempC;
  final int? stepCount;

  const WearableReading({
    this.restingHrBpm,
    this.hrvSdnnMs,
    this.sleepDurationMin,
    this.spo2Pct,
    this.bodyTempC,
    this.stepCount,
  });

  bool get hasAnyData =>
      restingHrBpm != null ||
      hrvSdnnMs != null ||
      sleepDurationMin != null ||
      spo2Pct != null ||
      bodyTempC != null ||
      stepCount != null;
}

class WearableService {
  WearableService(this._client);
  final SupabaseClient _client;

  // HRV SDNN is iOS-only; Android Health Connect exposes RMSSD only.
  static const _iosTypes = [
    HealthDataType.RESTING_HEART_RATE,
    HealthDataType.HEART_RATE_VARIABILITY_SDNN,
    HealthDataType.SLEEP_ASLEEP,
    HealthDataType.BLOOD_OXYGEN,
    HealthDataType.BODY_TEMPERATURE,
    HealthDataType.STEPS,
  ];

  static const _androidTypes = [
    HealthDataType.RESTING_HEART_RATE,
    HealthDataType.SLEEP_ASLEEP,
    HealthDataType.BLOOD_OXYGEN,
    HealthDataType.BODY_TEMPERATURE,
    HealthDataType.STEPS,
  ];

  /// Pull today's wearable signals and upsert to wearable_daily.
  /// Returns null if the user declines permissions or no data is available.
  Future<WearableReading?> syncToday(String userId) async {
    final health = Health();
    await health.configure();

    final types = Platform.isIOS ? _iosTypes : _androidTypes;
    final permissions = types.map((_) => HealthDataAccess.READ).toList();

    final authorized = await health.requestAuthorization(types, permissions: permissions);
    if (!authorized) return null;

    final now = DateTime.now();
    final startOfDay = DateTime(now.year, now.month, now.day);

    final points = await health.getHealthDataFromTypes(
      types: types,
      startTime: startOfDay,
      endTime: now,
    );

    final reading = _aggregate(points);
    if (!reading.hasAnyData) return reading;

    final dateStr =
        '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';

    await _client.from('wearable_daily').upsert(
      {
        'user_id': userId,
        'date': dateStr,
        if (reading.restingHrBpm != null) 'resting_hr_bpm': reading.restingHrBpm,
        if (reading.hrvSdnnMs != null) 'hrv_sdnn_ms': reading.hrvSdnnMs,
        if (reading.sleepDurationMin != null) 'sleep_duration_min': reading.sleepDurationMin,
        if (reading.spo2Pct != null) 'spo2_pct': reading.spo2Pct,
        if (reading.bodyTempC != null) 'body_temp_c': reading.bodyTempC,
        if (reading.stepCount != null) 'step_count': reading.stepCount,
        'source': Platform.isIOS ? 'healthkit' : 'health_connect',
        'synced_at': now.toIso8601String(),
      },
      onConflict: 'user_id,date',
    );

    return reading;
  }

  WearableReading _aggregate(List<HealthDataPoint> points) {
    return WearableReading(
      restingHrBpm: _avg(points, HealthDataType.RESTING_HEART_RATE),
      hrvSdnnMs: _avg(points, HealthDataType.HEART_RATE_VARIABILITY_SDNN),
      sleepDurationMin: _sum(points, HealthDataType.SLEEP_ASLEEP),
      spo2Pct: _avg(points, HealthDataType.BLOOD_OXYGEN),
      bodyTempC: _avg(points, HealthDataType.BODY_TEMPERATURE),
      stepCount: _sum(points, HealthDataType.STEPS),
    );
  }

  double? _avg(List<HealthDataPoint> points, HealthDataType type) {
    final vals = points
        .where((p) => p.type == type)
        .map((p) => (p.value as NumericHealthValue).numericValue.toDouble())
        .toList();
    if (vals.isEmpty) return null;
    return vals.reduce((a, b) => a + b) / vals.length;
  }

  int? _sum(List<HealthDataPoint> points, HealthDataType type) {
    final vals = points
        .where((p) => p.type == type)
        .map((p) => (p.value as NumericHealthValue).numericValue.toInt())
        .toList();
    if (vals.isEmpty) return null;
    return vals.reduce((a, b) => a + b);
  }
}
