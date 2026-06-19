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
  const MetricDqs({required this.weight, required this.countsTowardDailyCompleteness});
}

class MetricUi {
  final String label;
  final String inputType;
  const MetricUi({required this.label, required this.inputType});
}

class MetricDefinition {
  /// Canonical snake_case id — == DB column == BaselineSnapshot.metric_key == rule metricKey.
  final String key;
  final String source;
  final String table;
  final String type;

  /// { min, max } for numeric/ordinal; null otherwise.
  final MetricScale? scale;

  /// Display unit, when meaningful.
  final String? unit;

  /// Allowed values for enum / multi_select; null otherwise.
  final List<String>? enumValues;

  /// Does M5a compute mean/std/trend for it? (true only for numeric/ordinal).
  final bool baselineApplicable;

  /// M6 Data-Quality-Score contribution.
  final MetricDqs dqs;

  /// Optional hint for the M2 self-report screens.
  final MetricUi? ui;

  final String status;
  final String introducedIn;
  final String? deprecatedAt;

  const MetricDefinition({
    required this.key,
    required this.source,
    required this.table,
    required this.type,
    this.scale,
    this.unit,
    this.enumValues,
    required this.baselineApplicable,
    required this.dqs,
    this.ui,
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
    source: 'self_report',
    table: 'daily_gut_rows',
    type: 'ordinal',
    scale: MetricScale(min: 1, max: 8),
    unit: null,
    enumValues: null,
    baselineApplicable: true,
    dqs: MetricDqs(weight: 1, countsTowardDailyCompleteness: true),
    ui: MetricUi(label: 'Urine colour', inputType: 'armstrong_1_8'),
    status: 'active',
    introducedIn: 'phase1',
    deprecatedAt: null,
  ),
  MetricDefinition(
    key: 'stool_form',
    source: 'self_report',
    table: 'daily_gut_rows',
    type: 'ordinal',
    scale: MetricScale(min: 1, max: 7),
    unit: null,
    enumValues: null,
    baselineApplicable: true,
    dqs: MetricDqs(weight: 1, countsTowardDailyCompleteness: true),
    ui: MetricUi(label: 'Stool form', inputType: 'bristol_1_7'),
    status: 'active',
    introducedIn: 'phase1',
    deprecatedAt: null,
  ),
  MetricDefinition(
    key: 'stool_count',
    source: 'self_report',
    table: 'daily_gut_rows',
    type: 'numeric',
    scale: MetricScale(min: 0, max: 10),
    unit: null,
    enumValues: null,
    baselineApplicable: true,
    dqs: MetricDqs(weight: 1, countsTowardDailyCompleteness: true),
    ui: MetricUi(label: 'Stool count', inputType: 'stepper_0_10'),
    status: 'active',
    introducedIn: 'phase1',
    deprecatedAt: null,
  ),
  MetricDefinition(
    // Derived by M2 (max - min Bristol of the day); stored, baselined, not user-entered.
    key: 'stool_variability',
    source: 'self_report',
    table: 'daily_gut_rows',
    type: 'numeric',
    scale: MetricScale(min: 0, max: 6),
    unit: null,
    enumValues: null,
    baselineApplicable: true,
    dqs: MetricDqs(weight: 0, countsTowardDailyCompleteness: false),
    ui: null,
    status: 'active',
    introducedIn: 'phase1',
    deprecatedAt: null,
  ),
  MetricDefinition(
    key: 'outside_meals',
    source: 'self_report',
    table: 'daily_gut_rows',
    type: 'ordinal',
    scale: MetricScale(min: 0, max: 3),
    unit: null,
    enumValues: null,
    baselineApplicable: true,
    dqs: MetricDqs(weight: 1, countsTowardDailyCompleteness: true),
    ui: MetricUi(label: 'Meals outside home', inputType: 'segmented_0_3'),
    status: 'active',
    introducedIn: 'phase1',
    deprecatedAt: null,
  ),
  MetricDefinition(
    key: 'mosquito_bites',
    source: 'self_report',
    table: 'daily_gut_rows',
    type: 'numeric',
    scale: MetricScale(min: 0, max: 20),
    unit: null,
    enumValues: null,
    baselineApplicable: true,
    dqs: MetricDqs(weight: 1, countsTowardDailyCompleteness: true),
    ui: MetricUi(label: 'Mosquito bites', inputType: 'stepper_0_20'),
    status: 'active',
    introducedIn: 'phase1',
    deprecatedAt: null,
  ),
  MetricDefinition(
    key: 'energy_score',
    source: 'self_report',
    table: 'daily_gut_rows',
    type: 'ordinal',
    scale: MetricScale(min: 1, max: 5),
    unit: null,
    enumValues: null,
    baselineApplicable: true,
    dqs: MetricDqs(weight: 1, countsTowardDailyCompleteness: true),
    ui: MetricUi(label: 'Energy', inputType: 'likert_1_5'),
    status: 'active',
    introducedIn: 'phase1',
    deprecatedAt: null,
  ),
  MetricDefinition(
    key: 'mood_score',
    source: 'self_report',
    table: 'daily_gut_rows',
    type: 'ordinal',
    scale: MetricScale(min: 1, max: 5),
    unit: null,
    enumValues: null,
    baselineApplicable: true,
    dqs: MetricDqs(weight: 1, countsTowardDailyCompleteness: true),
    ui: MetricUi(label: 'Mood', inputType: 'likert_1_5'),
    status: 'active',
    introducedIn: 'phase1',
    deprecatedAt: null,
  ),
  MetricDefinition(
    key: 'gut_comfort_score',
    source: 'self_report',
    table: 'daily_gut_rows',
    type: 'ordinal',
    scale: MetricScale(min: 1, max: 5),
    unit: null,
    enumValues: null,
    baselineApplicable: true,
    dqs: MetricDqs(weight: 1, countsTowardDailyCompleteness: true),
    ui: MetricUi(label: 'Gut comfort', inputType: 'likert_1_5'),
    status: 'active',
    introducedIn: 'phase1',
    deprecatedAt: null,
  ),
  MetricDefinition(
    key: 'symptom_flags',
    source: 'self_report',
    table: 'daily_gut_rows',
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
    dqs: MetricDqs(weight: 0, countsTowardDailyCompleteness: false),
    ui: MetricUi(label: 'Symptoms', inputType: 'multi_select'),
    status: 'active',
    introducedIn: 'phase1',
    deprecatedAt: null,
  ),
  MetricDefinition(
    key: 'standing_water_present',
    source: 'self_report',
    table: 'daily_gut_rows',
    type: 'boolean',
    scale: null,
    unit: null,
    enumValues: null,
    baselineApplicable: false,
    dqs: MetricDqs(weight: 0, countsTowardDailyCompleteness: false),
    ui: MetricUi(label: 'Standing water nearby', inputType: 'toggle'),
    status: 'active',
    introducedIn: 'phase1',
    deprecatedAt: null,
  ),
  MetricDefinition(
    key: 'notes',
    source: 'self_report',
    table: 'daily_gut_rows',
    type: 'text',
    scale: null,
    unit: null,
    enumValues: null,
    baselineApplicable: false,
    dqs: MetricDqs(weight: 0, countsTowardDailyCompleteness: false),
    ui: MetricUi(label: 'Notes', inputType: 'text'),
    status: 'active',
    introducedIn: 'phase1',
    deprecatedAt: null,
  ),
  MetricDefinition(
    // The DQS itself, persisted per row and baselined for trend display.
    key: 'log_completeness',
    source: 'self_report',
    table: 'daily_gut_rows',
    type: 'numeric',
    scale: MetricScale(min: 0, max: 100),
    unit: null,
    enumValues: null,
    baselineApplicable: true,
    dqs: MetricDqs(weight: 0, countsTowardDailyCompleteness: false),
    ui: null,
    status: 'active',
    introducedIn: 'phase1',
    deprecatedAt: null,
  ),
  // ─── Wearable (wearable_daily) ──────────────────────────────────────────────────
  MetricDefinition(
    key: 'resting_hr_bpm',
    source: 'wearable',
    table: 'wearable_daily',
    type: 'numeric',
    scale: null,
    unit: 'bpm',
    enumValues: null,
    baselineApplicable: true,
    dqs: MetricDqs(weight: 0, countsTowardDailyCompleteness: false),
    ui: null,
    status: 'active',
    introducedIn: 'phase2',
    deprecatedAt: null,
  ),
  MetricDefinition(
    key: 'hrv_sdnn_ms',
    source: 'wearable',
    table: 'wearable_daily',
    type: 'numeric',
    scale: null,
    unit: 'ms',
    enumValues: null,
    baselineApplicable: true,
    dqs: MetricDqs(weight: 0, countsTowardDailyCompleteness: false),
    ui: null,
    status: 'active',
    introducedIn: 'phase2',
    deprecatedAt: null,
  ),
  MetricDefinition(
    key: 'sleep_duration_min',
    source: 'wearable',
    table: 'wearable_daily',
    type: 'numeric',
    scale: null,
    unit: 'min',
    enumValues: null,
    baselineApplicable: true,
    dqs: MetricDqs(weight: 0, countsTowardDailyCompleteness: false),
    ui: null,
    status: 'active',
    introducedIn: 'phase2',
    deprecatedAt: null,
  ),
  MetricDefinition(
    key: 'spo2_pct',
    source: 'wearable',
    table: 'wearable_daily',
    type: 'numeric',
    scale: MetricScale(min: 0, max: 100),
    unit: '%',
    enumValues: null,
    baselineApplicable: true,
    dqs: MetricDqs(weight: 0, countsTowardDailyCompleteness: false),
    ui: null,
    status: 'active',
    introducedIn: 'phase2',
    deprecatedAt: null,
  ),
  MetricDefinition(
    key: 'body_temp_c',
    source: 'wearable',
    table: 'wearable_daily',
    type: 'numeric',
    scale: null,
    unit: '°C',
    enumValues: null,
    baselineApplicable: true,
    dqs: MetricDqs(weight: 0, countsTowardDailyCompleteness: false),
    ui: null,
    status: 'active',
    introducedIn: 'phase2',
    deprecatedAt: null,
  ),
  MetricDefinition(
    key: 'step_count',
    source: 'wearable',
    table: 'wearable_daily',
    type: 'numeric',
    scale: null,
    unit: 'steps',
    enumValues: null,
    baselineApplicable: true,
    dqs: MetricDqs(weight: 0, countsTowardDailyCompleteness: false),
    ui: null,
    status: 'active',
    introducedIn: 'phase2',
    deprecatedAt: null,
  ),
];
