import 'dart:io';
import 'package:flutter/foundation.dart';
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

/// How long [syncToday] waits for the OS-level wearable authorization call
/// before treating the provider as unavailable.
///
/// On a device with Health Connect (Android) or HealthKit (iOS) installed,
/// `Health().requestAuthorization` resolves in well under a second — this is
/// generous headroom on top of that, so the happy path never trips it. On a
/// device with NO wearable provider installed at all (e.g. Android 10
/// without Health Connect — the demo-phone reproduction that motivated this
/// fix), that same call can hang forever instead of rejecting, because
/// there's no provider on the other end of the platform channel to ever
/// answer. A missing provider is a normal, expected outcome
/// (docs/memory/0006-wearable-sync-best-effort.md), so the Scan-tab sweep
/// (the only route into DailyLogScreen) must not wait on it indefinitely.
const wearableAuthTimeout = Duration(seconds: 5);

/// Runs [authorize] (normally `Health().requestAuthorization`) bounded by
/// [timeout], so an unresponsive provider degrades to "not authorized"
/// (`false`) instead of hanging the caller forever.
///
/// A timeout and a genuine failure are kept distinguishable rather than
/// both being silently swallowed into the same `false`: a timeout is the
/// expected "nothing answered" case and degrades quietly, matching a
/// declined prompt — the Scan tab's WearableSyncRow already renders that as
/// the honest "No data available" state. Any *other* exception is reported
/// through [FlutterError.reportError] first (so it surfaces in logs / crash
/// reporting instead of vanishing) before it, too, degrades to `false` —
/// the sweep must complete either way, and there is only one honest
/// "nothing came back" state to show regardless of which failure occurred.
@visibleForTesting
Future<bool> authorizeWithTimeout(
  Future<bool> Function() authorize, {
  Duration timeout = wearableAuthTimeout,
}) async {
  try {
    return await authorize().timeout(timeout, onTimeout: () => false);
  } catch (error, stackTrace) {
    FlutterError.reportError(FlutterErrorDetails(
      exception: error,
      stack: stackTrace,
      library: 'm3_passive_health',
      context: ErrorDescription(
          'wearable authorization failed during the Scan-tab sweep'),
    ));
    return false;
  }
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
  /// Returns null if the user declines permissions, no wearable provider
  /// answers within [wearableAuthTimeout] (see [authorizeWithTimeout]), or no
  /// data is available.
  Future<WearableReading?> syncToday(String userId) async {
    final health = Health();
    await health.configure();

    final types = Platform.isIOS ? _iosTypes : _androidTypes;
    final permissions = types.map((_) => HealthDataAccess.READ).toList();

    final authorized = await authorizeWithTimeout(
      () => health.requestAuthorization(types, permissions: permissions),
    );
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
