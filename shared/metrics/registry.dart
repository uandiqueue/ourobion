// shared/metrics/registry.dart
// Dart mirror of shared/metrics/registry.ts. Held in lockstep by the metrics-registry-ts-dart-parity guard.

class MetricScale {
  final num min;
  final num max;
  const MetricScale({required this.min, required this.max});
}

class MetricDqs {
  final num weight;
  final bool countsTowardDailyCompleteness;
  const MetricDqs({
    required this.weight,
    required this.countsTowardDailyCompleteness,
  });
}

class MetricSignal {
  /// S4 daily 3-state deadband in robust σ̂ = MAD/0.6745 units (ADR-0002):
  /// neutral := |x − median| ≤ deadbandK·σ̂. Typical 1.0 (provisional, pending calibration).
  final num deadbandK;
  const MetricSignal({required this.deadbandK});
}

class MetricUi {
  final String label;
  final String inputType;
  const MetricUi({required this.label, required this.inputType});
}

enum DailyProjectionStorage {
  events('events'),
  stateBands('state_bands');

  final String wireValue;
  const DailyProjectionStorage(this.wireValue);
}

enum DailyProjectionCalendar {
  utc('utc');

  final String wireValue;
  const DailyProjectionCalendar(this.wireValue);
}

enum DailyProjectionSource {
  selfReport('self_report'),
  wearable('wearable'),
  env('env'),
  signal('signal');

  final String wireValue;
  const DailyProjectionSource(this.wireValue);
}

enum EventDailyReducer {
  count('count'),
  sum('sum'),
  mean('mean'),
  latest('latest');

  final String wireValue;
  const EventDailyReducer(this.wireValue);
}

enum StateBandInterval {
  halfOpen('half_open');

  final String wireValue;
  const StateBandInterval(this.wireValue);
}

enum StateBandDailyReducer {
  presence('presence');

  final String wireValue;
  const StateBandDailyReducer(this.wireValue);
}

sealed class DailyProjection {
  final DailyProjectionStorage storage;
  final DailyProjectionCalendar calendar;
  final DailyProjectionSource source;
  const DailyProjection({
    required this.storage,
    required this.calendar,
    required this.source,
  });
}

class EventDailyProjection extends DailyProjection {
  final EventDailyReducer reducer;
  const EventDailyProjection({
    required this.reducer,
    required DailyProjectionSource source,
  }) : super(
         storage: DailyProjectionStorage.events,
         calendar: DailyProjectionCalendar.utc,
         source: source,
       );
}

class StateBandDailyProjection extends DailyProjection {
  final StateBandInterval interval;
  final StateBandDailyReducer reducer;
  const StateBandDailyProjection({
    required this.reducer,
    required this.interval,
    required DailyProjectionSource source,
  }) : super(
         storage: DailyProjectionStorage.stateBands,
         calendar: DailyProjectionCalendar.utc,
         source: source,
       );
}

class MetricDefinition {
  /// Canonical snake_case id — == DB column == BaselineSnapshot.metric_key == rule metricKey.
  final String key;
  final String source;

  /// Storage location — mirrors the TS `MetricTable` union: 'daily_gut_rows' | 'wearable_daily'
  /// | 'env_daily' (grandfathered first instances) | 'events' | 'state_bands' | 'signals'
  /// | 'derived_metrics' (the continuity-based primitives, phase-2-plan §3).
  final String table;

  /// Collection tier (logging budget): 'T0'..'T5'. Only T1 (daily core) counts toward daily completeness.
  final String tier;

  /// Data shape over time: 'continuous' | 'episodic' | 'state' | 'static'.
  final String continuity;

  final String type;

  /// { min, max } for numeric/ordinal; null otherwise.
  final MetricScale? scale;

  /// Display unit, when meaningful.
  final String? unit;

  /// Allowed values for enum / multi_select; null otherwise.
  final List<String>? enumValues;

  /// Does M5a compute mean/std/trend for it? (true only for numeric/ordinal).
  final bool baselineApplicable;

  /// Confidence weight for the engine: 1..4 (4 device-measured · 3 in-moment/observation · 2 subjective/count · 1 free-text).
  final int reliability;

  /// For source:'derived' — the metric keys it is computed from. null otherwise.
  final List<String>? derivedFrom;

  /// Platform availability: 'both' | 'ios_only' | 'android_only' | 'hardware_gated'.
  final String availability;

  /// Semi-passive: fetch from this source first, falling back to `source`. null = collected directly.
  final String? preferredSource;

  /// M6 Data-Quality-Score contribution.
  final MetricDqs dqs;

  /// S4 anomaly-signal parameters (ADR-0002). Set for every baselineApplicable metric;
  /// null for metrics S4 never signals on.
  final MetricSignal? signal;

  /// Optional hint for the M2 self-report screens.
  final MetricUi? ui;

  /// Explicit primitive-to-day policy. Null until a primitive-homed metric is selected.
  final DailyProjection? dailyProjection;

  final String status;
  final String introducedIn;
  final String? deprecatedAt;

  const MetricDefinition({
    required this.key,
    required this.source,
    required this.table,
    required this.tier,
    required this.continuity,
    required this.type,
    this.scale,
    this.unit,
    this.enumValues,
    required this.baselineApplicable,
    required this.reliability,
    this.derivedFrom,
    required this.availability,
    this.preferredSource,
    required this.dqs,
    this.signal,
    this.ui,
    this.dailyProjection,
    required this.status,
    required this.introducedIn,
    this.deprecatedAt,
  });
}

/// The full registry. Order is stable; new metrics append within their source block.
const List<MetricDefinition> kMetrics = [
  // ─── Self-report (daily_gut_rows) ───────────────────────────────────────────────
  MetricDefinition(
    key: 'urine_colour',
    source: 'manual',
    table: 'daily_gut_rows',
    tier: 'T1',
    continuity: 'continuous',
    type: 'ordinal',
    scale: MetricScale(min: 1, max: 8),
    unit: null,
    enumValues: null,
    baselineApplicable: true,
    reliability: 3,
    derivedFrom: null,
    availability: 'both',
    preferredSource: null,
    dqs: MetricDqs(weight: 25, countsTowardDailyCompleteness: true),
    signal: MetricSignal(deadbandK: 1.0),
    ui: MetricUi(label: 'Urine colour', inputType: 'armstrong_1_8'),
    status: 'active',
    introducedIn: 'phase1',
    deprecatedAt: null,
  ),
  MetricDefinition(
    key: 'stool_form',
    source: 'manual',
    table: 'daily_gut_rows',
    tier: 'T1',
    continuity: 'continuous',
    type: 'ordinal',
    scale: MetricScale(min: 1, max: 7),
    unit: null,
    enumValues: null,
    baselineApplicable: true,
    reliability: 3,
    derivedFrom: null,
    availability: 'both',
    preferredSource: null,
    dqs: MetricDqs(weight: 25, countsTowardDailyCompleteness: true),
    signal: MetricSignal(deadbandK: 1.0),
    ui: MetricUi(label: 'Stool form', inputType: 'bristol_1_7'),
    status: 'active',
    introducedIn: 'phase1',
    deprecatedAt: null,
  ),
  MetricDefinition(
    key: 'stool_count',
    source: 'manual',
    table: 'daily_gut_rows',
    tier: 'T2',
    continuity: 'continuous',
    type: 'numeric',
    scale: MetricScale(min: 0, max: 10),
    unit: null,
    enumValues: null,
    baselineApplicable: true,
    reliability: 2,
    derivedFrom: null,
    availability: 'both',
    preferredSource: null,
    dqs: MetricDqs(weight: 0, countsTowardDailyCompleteness: false),
    signal: MetricSignal(deadbandK: 1.0),
    ui: MetricUi(label: 'Stool count', inputType: 'stepper_0_10'),
    status: 'active',
    introducedIn: 'phase1',
    deprecatedAt: null,
  ),
  MetricDefinition(
    // Derived by M2 (max - min Bristol of the day); stored, baselined, not user-entered.
    key: 'stool_variability',
    source: 'derived',
    table: 'daily_gut_rows',
    tier: 'T0',
    continuity: 'continuous',
    type: 'numeric',
    scale: MetricScale(min: 0, max: 6),
    unit: null,
    enumValues: null,
    baselineApplicable: true,
    reliability: 3,
    derivedFrom: ['stool_form'],
    availability: 'both',
    preferredSource: null,
    dqs: MetricDqs(weight: 0, countsTowardDailyCompleteness: false),
    signal: MetricSignal(deadbandK: 1.0),
    ui: null,
    status: 'active',
    introducedIn: 'phase1',
    deprecatedAt: null,
  ),
  MetricDefinition(
    key: 'outside_meals',
    source: 'manual',
    table: 'daily_gut_rows',
    tier: 'T1',
    continuity: 'continuous',
    type: 'ordinal',
    scale: MetricScale(min: 0, max: 3),
    unit: null,
    enumValues: null,
    baselineApplicable: true,
    reliability: 2,
    derivedFrom: null,
    availability: 'both',
    preferredSource: null,
    dqs: MetricDqs(weight: 20, countsTowardDailyCompleteness: true),
    signal: MetricSignal(deadbandK: 1.0),
    ui: MetricUi(label: 'Meals outside home', inputType: 'segmented_0_3'),
    status: 'active',
    introducedIn: 'phase1',
    deprecatedAt: null,
  ),
  MetricDefinition(
    key: 'mosquito_bites',
    source: 'manual',
    table: 'daily_gut_rows',
    tier: 'T1',
    continuity: 'episodic',
    type: 'numeric',
    scale: MetricScale(min: 0, max: 20),
    unit: null,
    enumValues: null,
    baselineApplicable: true,
    reliability: 2,
    derivedFrom: null,
    availability: 'both',
    preferredSource: null,
    dqs: MetricDqs(weight: 10, countsTowardDailyCompleteness: true),
    signal: MetricSignal(deadbandK: 1.0),
    ui: MetricUi(label: 'Mosquito bites', inputType: 'stepper_0_20'),
    status: 'active',
    introducedIn: 'phase1',
    deprecatedAt: null,
  ),
  MetricDefinition(
    key: 'energy_score',
    source: 'manual',
    table: 'daily_gut_rows',
    tier: 'T1',
    continuity: 'continuous',
    type: 'ordinal',
    scale: MetricScale(min: 1, max: 5),
    unit: null,
    enumValues: null,
    baselineApplicable: true,
    reliability: 2,
    derivedFrom: null,
    availability: 'both',
    preferredSource: null,
    dqs: MetricDqs(weight: 7, countsTowardDailyCompleteness: true),
    signal: MetricSignal(deadbandK: 1.0),
    ui: MetricUi(label: 'Energy', inputType: 'likert_1_5'),
    status: 'active',
    introducedIn: 'phase1',
    deprecatedAt: null,
  ),
  MetricDefinition(
    key: 'mood_score',
    source: 'manual',
    table: 'daily_gut_rows',
    tier: 'T1',
    continuity: 'continuous',
    type: 'ordinal',
    scale: MetricScale(min: 1, max: 5),
    unit: null,
    enumValues: null,
    baselineApplicable: true,
    reliability: 2,
    derivedFrom: null,
    availability: 'both',
    preferredSource: null,
    dqs: MetricDqs(weight: 7, countsTowardDailyCompleteness: true),
    signal: MetricSignal(deadbandK: 1.0),
    ui: MetricUi(label: 'Mood', inputType: 'likert_1_5'),
    status: 'active',
    introducedIn: 'phase1',
    deprecatedAt: null,
  ),
  MetricDefinition(
    key: 'gut_comfort_score',
    source: 'manual',
    table: 'daily_gut_rows',
    tier: 'T1',
    continuity: 'continuous',
    type: 'ordinal',
    scale: MetricScale(min: 1, max: 5),
    unit: null,
    enumValues: null,
    baselineApplicable: true,
    reliability: 2,
    derivedFrom: null,
    availability: 'both',
    preferredSource: null,
    dqs: MetricDqs(weight: 6, countsTowardDailyCompleteness: true),
    signal: MetricSignal(deadbandK: 1.0),
    ui: MetricUi(label: 'Gut comfort', inputType: 'likert_1_5'),
    status: 'active',
    introducedIn: 'phase1',
    deprecatedAt: null,
  ),
  MetricDefinition(
    key: 'appetite_score',
    source: 'manual',
    table: 'daily_gut_rows',
    tier: 'T2',
    continuity: 'continuous',
    type: 'ordinal',
    scale: MetricScale(min: 1, max: 5),
    unit: null,
    enumValues: null,
    baselineApplicable: true,
    reliability: 2,
    derivedFrom: null,
    availability: 'both',
    preferredSource: null,
    dqs: MetricDqs(weight: 0, countsTowardDailyCompleteness: false),
    signal: MetricSignal(deadbandK: 1.0),
    ui: MetricUi(label: 'Appetite', inputType: 'likert_1_5'),
    status: 'active',
    introducedIn: 'phase2',
    deprecatedAt: null,
  ),
  MetricDefinition(
    key: 'anxiety_score',
    source: 'manual',
    table: 'daily_gut_rows',
    tier: 'T2',
    continuity: 'continuous',
    type: 'ordinal',
    scale: MetricScale(min: 1, max: 5),
    unit: null,
    enumValues: null,
    baselineApplicable: true,
    reliability: 2,
    derivedFrom: null,
    availability: 'both',
    preferredSource: null,
    dqs: MetricDqs(weight: 0, countsTowardDailyCompleteness: false),
    signal: MetricSignal(deadbandK: 1.0),
    ui: MetricUi(label: 'Feeling anxious', inputType: 'likert_1_5'),
    status: 'active',
    introducedIn: 'phase2',
    deprecatedAt: null,
  ),
  MetricDefinition(
    key: 'brain_clarity_score',
    source: 'manual',
    table: 'daily_gut_rows',
    tier: 'T2',
    continuity: 'continuous',
    type: 'ordinal',
    scale: MetricScale(min: 1, max: 5),
    unit: null,
    enumValues: null,
    baselineApplicable: true,
    reliability: 2,
    derivedFrom: null,
    availability: 'both',
    preferredSource: null,
    dqs: MetricDqs(weight: 0, countsTowardDailyCompleteness: false),
    signal: MetricSignal(deadbandK: 1.0),
    ui: MetricUi(label: 'Mental clarity', inputType: 'likert_1_5'),
    status: 'active',
    introducedIn: 'phase2',
    deprecatedAt: null,
  ),
  MetricDefinition(
    key: 'focus_score',
    source: 'manual',
    table: 'daily_gut_rows',
    tier: 'T2',
    continuity: 'continuous',
    type: 'ordinal',
    scale: MetricScale(min: 1, max: 5),
    unit: null,
    enumValues: null,
    baselineApplicable: true,
    reliability: 2,
    derivedFrom: null,
    availability: 'both',
    preferredSource: null,
    dqs: MetricDqs(weight: 0, countsTowardDailyCompleteness: false),
    signal: MetricSignal(deadbandK: 1.0),
    ui: MetricUi(label: 'Focus', inputType: 'likert_1_5'),
    status: 'active',
    introducedIn: 'phase2',
    deprecatedAt: null,
  ),
  MetricDefinition(
    key: 'social_interaction_quality_score',
    source: 'manual',
    table: 'daily_gut_rows',
    tier: 'T2',
    continuity: 'continuous',
    type: 'ordinal',
    scale: MetricScale(min: 1, max: 5),
    unit: null,
    enumValues: null,
    baselineApplicable: true,
    reliability: 2,
    derivedFrom: null,
    availability: 'both',
    preferredSource: null,
    dqs: MetricDqs(weight: 0, countsTowardDailyCompleteness: false),
    signal: MetricSignal(deadbandK: 1.0),
    ui: MetricUi(label: 'Social interaction quality', inputType: 'likert_1_5'),
    status: 'active',
    introducedIn: 'phase2',
    deprecatedAt: null,
  ),
  MetricDefinition(
    key: 'symptom_flags',
    source: 'manual',
    table: 'daily_gut_rows',
    tier: 'T3',
    continuity: 'episodic',
    type: 'multi_select',
    scale: null,
    unit: null,
    enumValues: [
      'feverish',
      'nausea',
      'body_aches',
      'fatigue',
      'loss_of_appetite',
      'abdominal_cramps',
      'headache',
    ],
    baselineApplicable: false,
    reliability: 2,
    derivedFrom: null,
    availability: 'both',
    preferredSource: null,
    dqs: MetricDqs(weight: 0, countsTowardDailyCompleteness: false),
    signal: null,
    ui: MetricUi(label: 'Symptoms', inputType: 'multi_select'),
    status: 'active',
    introducedIn: 'phase1',
    deprecatedAt: null,
  ),
  MetricDefinition(
    key: 'standing_water_present',
    source: 'manual',
    table: 'daily_gut_rows',
    tier: 'T3',
    continuity: 'episodic',
    type: 'boolean',
    scale: null,
    unit: null,
    enumValues: null,
    baselineApplicable: false,
    reliability: 2,
    derivedFrom: null,
    availability: 'both',
    preferredSource: null,
    dqs: MetricDqs(weight: 0, countsTowardDailyCompleteness: false),
    signal: null,
    ui: MetricUi(label: 'Standing water nearby', inputType: 'toggle'),
    status: 'active',
    introducedIn: 'phase1',
    deprecatedAt: null,
  ),
  MetricDefinition(
    key: 'notes',
    source: 'manual',
    table: 'daily_gut_rows',
    tier: 'T2',
    continuity: 'continuous',
    type: 'text',
    scale: null,
    unit: null,
    enumValues: null,
    baselineApplicable: false,
    reliability: 1,
    derivedFrom: null,
    availability: 'both',
    preferredSource: null,
    dqs: MetricDqs(weight: 0, countsTowardDailyCompleteness: false),
    signal: null,
    ui: MetricUi(label: 'Notes', inputType: 'text'),
    status: 'active',
    introducedIn: 'phase1',
    deprecatedAt: null,
  ),
  MetricDefinition(
    // The DQS itself, persisted per row and baselined for trend display.
    key: 'log_completeness',
    source: 'derived',
    table: 'daily_gut_rows',
    tier: 'T0',
    continuity: 'continuous',
    type: 'numeric',
    scale: MetricScale(min: 0, max: 100),
    unit: null,
    enumValues: null,
    baselineApplicable: true,
    reliability: 4,
    derivedFrom: [
      'urine_colour',
      'stool_form',
      'outside_meals',
      'mosquito_bites',
      'energy_score',
      'mood_score',
      'gut_comfort_score',
    ],
    availability: 'both',
    preferredSource: null,
    dqs: MetricDqs(weight: 0, countsTowardDailyCompleteness: false),
    signal: MetricSignal(deadbandK: 1.0),
    ui: null,
    status: 'active',
    introducedIn: 'phase1',
    deprecatedAt: null,
  ),
  // ─── Wearable (wearable_daily) ──────────────────────────────────────────────────
  MetricDefinition(
    key: 'resting_hr_bpm',
    source: 'sensor',
    table: 'wearable_daily',
    tier: 'T0',
    continuity: 'continuous',
    type: 'numeric',
    scale: null,
    unit: 'bpm',
    enumValues: null,
    baselineApplicable: true,
    reliability: 4,
    derivedFrom: null,
    availability: 'hardware_gated',
    preferredSource: null,
    dqs: MetricDqs(weight: 0, countsTowardDailyCompleteness: false),
    signal: MetricSignal(deadbandK: 1.0),
    ui: null,
    status: 'active',
    introducedIn: 'phase2',
    deprecatedAt: null,
  ),
  MetricDefinition(
    key: 'hrv_sdnn_ms',
    source: 'sensor',
    table: 'wearable_daily',
    tier: 'T0',
    continuity: 'continuous',
    type: 'numeric',
    scale: null,
    unit: 'ms',
    enumValues: null,
    baselineApplicable: true,
    reliability: 4,
    derivedFrom: null,
    availability: 'ios_only',
    preferredSource: null,
    dqs: MetricDqs(weight: 0, countsTowardDailyCompleteness: false),
    signal: MetricSignal(deadbandK: 1.0),
    ui: null,
    status: 'active',
    introducedIn: 'phase2',
    deprecatedAt: null,
  ),
  MetricDefinition(
    key: 'sleep_duration_min',
    source: 'sensor',
    table: 'wearable_daily',
    tier: 'T0',
    continuity: 'continuous',
    type: 'numeric',
    scale: null,
    unit: 'min',
    enumValues: null,
    baselineApplicable: true,
    reliability: 4,
    derivedFrom: null,
    availability: 'hardware_gated',
    preferredSource: null,
    dqs: MetricDqs(weight: 0, countsTowardDailyCompleteness: false),
    signal: MetricSignal(deadbandK: 1.0),
    ui: null,
    status: 'active',
    introducedIn: 'phase2',
    deprecatedAt: null,
  ),
  MetricDefinition(
    key: 'spo2_pct',
    source: 'sensor',
    table: 'wearable_daily',
    tier: 'T0',
    continuity: 'continuous',
    type: 'numeric',
    scale: MetricScale(min: 0, max: 100),
    unit: '%',
    enumValues: null,
    baselineApplicable: true,
    reliability: 4,
    derivedFrom: null,
    availability: 'hardware_gated',
    preferredSource: null,
    dqs: MetricDqs(weight: 0, countsTowardDailyCompleteness: false),
    signal: MetricSignal(deadbandK: 1.0),
    ui: null,
    status: 'active',
    introducedIn: 'phase2',
    deprecatedAt: null,
  ),
  MetricDefinition(
    key: 'body_temp_c',
    source: 'sensor',
    table: 'wearable_daily',
    tier: 'T0',
    continuity: 'continuous',
    type: 'numeric',
    scale: null,
    unit: '°C',
    enumValues: null,
    baselineApplicable: true,
    reliability: 4,
    derivedFrom: null,
    availability: 'hardware_gated',
    preferredSource: null,
    dqs: MetricDqs(weight: 0, countsTowardDailyCompleteness: false),
    signal: MetricSignal(deadbandK: 1.0),
    ui: null,
    status: 'active',
    introducedIn: 'phase2',
    deprecatedAt: null,
  ),
  MetricDefinition(
    key: 'step_count',
    source: 'sensor',
    table: 'wearable_daily',
    tier: 'T0',
    continuity: 'continuous',
    type: 'numeric',
    scale: null,
    unit: 'steps',
    enumValues: null,
    baselineApplicable: true,
    reliability: 4,
    derivedFrom: null,
    availability: 'hardware_gated',
    preferredSource: null,
    dqs: MetricDqs(weight: 0, countsTowardDailyCompleteness: false),
    signal: MetricSignal(deadbandK: 1.0),
    ui: null,
    status: 'active',
    introducedIn: 'phase2',
    deprecatedAt: null,
  ),
];
