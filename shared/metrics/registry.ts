// shared/metrics/registry.ts
//
// THE single source of truth for every metric biotope collects.
// Adding or removing a metric is a localized, guard-protected change: the parity / schema /
// baselines / engine guards (src/test/guards/, docs/graph/couplings.yaml) fail the build if any
// consumer drifts from this list. See shared/metrics/README.md for the add / remove runbook.
//
// TRUTH tier (git-tracked, 2-reviewer PR per docs/memory/0002). Keep registry.ts and registry.dart
// in lockstep — the metrics-registry-ts-dart-parity guard enforces it.

export type MetricSource = 'self_report' | 'wearable' | 'env';
export type MetricTable = 'daily_gut_rows' | 'wearable_daily' | 'env_daily';
export type MetricType =
  | 'numeric'
  | 'ordinal'
  | 'boolean'
  | 'enum'
  | 'multi_select'
  | 'text';
export type MetricStatus = 'active' | 'deprecated';

export interface MetricDefinition {
  /** Canonical snake_case id — == DB column == BaselineSnapshot.metric_key == rule metricKey. */
  key: string;
  source: MetricSource;
  table: MetricTable;
  type: MetricType;
  /** { min, max } for numeric/ordinal; null otherwise. */
  scale: { min: number; max: number } | null;
  /** Display unit, when meaningful. */
  unit: string | null;
  /** Allowed values for enum / multi_select; null otherwise. */
  enumValues: readonly string[] | null;
  /** Does M5a compute mean/std/trend for it? (true only for numeric/ordinal). */
  baselineApplicable: boolean;
  /** M6 Data-Quality-Score contribution. */
  dqs: { weight: number; countsTowardDailyCompleteness: boolean };
  /** Optional hint for the M2 self-report screens. */
  ui: { label: string; inputType: string } | null;
  status: MetricStatus;
  introducedIn: string;
  deprecatedAt: string | null;
}

// ─── Self-report (daily_gut_rows) ───────────────────────────────────────────────
const SELF_REPORT: MetricDefinition[] = [
  {
    key: 'urine_colour',
    source: 'self_report',
    table: 'daily_gut_rows',
    type: 'ordinal',
    scale: { min: 1, max: 8 },
    unit: null,
    enumValues: null,
    baselineApplicable: true,
    dqs: { weight: 1, countsTowardDailyCompleteness: true },
    ui: { label: 'Urine colour', inputType: 'armstrong_1_8' },
    status: 'active',
    introducedIn: 'phase1',
    deprecatedAt: null,
  },
  {
    key: 'stool_form',
    source: 'self_report',
    table: 'daily_gut_rows',
    type: 'ordinal',
    scale: { min: 1, max: 7 },
    unit: null,
    enumValues: null,
    baselineApplicable: true,
    dqs: { weight: 1, countsTowardDailyCompleteness: true },
    ui: { label: 'Stool form', inputType: 'bristol_1_7' },
    status: 'active',
    introducedIn: 'phase1',
    deprecatedAt: null,
  },
  {
    key: 'stool_count',
    source: 'self_report',
    table: 'daily_gut_rows',
    type: 'numeric',
    scale: { min: 0, max: 10 },
    unit: null,
    enumValues: null,
    baselineApplicable: true,
    dqs: { weight: 1, countsTowardDailyCompleteness: true },
    ui: { label: 'Stool count', inputType: 'stepper_0_10' },
    status: 'active',
    introducedIn: 'phase1',
    deprecatedAt: null,
  },
  {
    // Derived by M2 (max - min Bristol of the day); stored, baselined, not user-entered.
    key: 'stool_variability',
    source: 'self_report',
    table: 'daily_gut_rows',
    type: 'numeric',
    scale: { min: 0, max: 6 },
    unit: null,
    enumValues: null,
    baselineApplicable: true,
    dqs: { weight: 0, countsTowardDailyCompleteness: false },
    ui: null,
    status: 'active',
    introducedIn: 'phase1',
    deprecatedAt: null,
  },
  {
    key: 'outside_meals',
    source: 'self_report',
    table: 'daily_gut_rows',
    type: 'ordinal',
    scale: { min: 0, max: 3 },
    unit: null,
    enumValues: null,
    baselineApplicable: true,
    dqs: { weight: 1, countsTowardDailyCompleteness: true },
    ui: { label: 'Meals outside home', inputType: 'segmented_0_3' },
    status: 'active',
    introducedIn: 'phase1',
    deprecatedAt: null,
  },
  {
    key: 'mosquito_bites',
    source: 'self_report',
    table: 'daily_gut_rows',
    type: 'numeric',
    scale: { min: 0, max: 20 },
    unit: null,
    enumValues: null,
    baselineApplicable: true,
    dqs: { weight: 1, countsTowardDailyCompleteness: true },
    ui: { label: 'Mosquito bites', inputType: 'stepper_0_20' },
    status: 'active',
    introducedIn: 'phase1',
    deprecatedAt: null,
  },
  {
    key: 'energy_score',
    source: 'self_report',
    table: 'daily_gut_rows',
    type: 'ordinal',
    scale: { min: 1, max: 5 },
    unit: null,
    enumValues: null,
    baselineApplicable: true,
    dqs: { weight: 1, countsTowardDailyCompleteness: true },
    ui: { label: 'Energy', inputType: 'likert_1_5' },
    status: 'active',
    introducedIn: 'phase1',
    deprecatedAt: null,
  },
  {
    key: 'mood_score',
    source: 'self_report',
    table: 'daily_gut_rows',
    type: 'ordinal',
    scale: { min: 1, max: 5 },
    unit: null,
    enumValues: null,
    baselineApplicable: true,
    dqs: { weight: 1, countsTowardDailyCompleteness: true },
    ui: { label: 'Mood', inputType: 'likert_1_5' },
    status: 'active',
    introducedIn: 'phase1',
    deprecatedAt: null,
  },
  {
    key: 'gut_comfort_score',
    source: 'self_report',
    table: 'daily_gut_rows',
    type: 'ordinal',
    scale: { min: 1, max: 5 },
    unit: null,
    enumValues: null,
    baselineApplicable: true,
    dqs: { weight: 1, countsTowardDailyCompleteness: true },
    ui: { label: 'Gut comfort', inputType: 'likert_1_5' },
    status: 'active',
    introducedIn: 'phase1',
    deprecatedAt: null,
  },
  {
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
    dqs: { weight: 0, countsTowardDailyCompleteness: false },
    ui: { label: 'Symptoms', inputType: 'multi_select' },
    status: 'active',
    introducedIn: 'phase1',
    deprecatedAt: null,
  },
  {
    key: 'standing_water_present',
    source: 'self_report',
    table: 'daily_gut_rows',
    type: 'boolean',
    scale: null,
    unit: null,
    enumValues: null,
    baselineApplicable: false,
    dqs: { weight: 0, countsTowardDailyCompleteness: false },
    ui: { label: 'Standing water nearby', inputType: 'toggle' },
    status: 'active',
    introducedIn: 'phase1',
    deprecatedAt: null,
  },
  {
    key: 'notes',
    source: 'self_report',
    table: 'daily_gut_rows',
    type: 'text',
    scale: null,
    unit: null,
    enumValues: null,
    baselineApplicable: false,
    dqs: { weight: 0, countsTowardDailyCompleteness: false },
    ui: { label: 'Notes', inputType: 'text' },
    status: 'active',
    introducedIn: 'phase1',
    deprecatedAt: null,
  },
  {
    // The DQS itself, persisted per row and baselined for trend display.
    key: 'log_completeness',
    source: 'self_report',
    table: 'daily_gut_rows',
    type: 'numeric',
    scale: { min: 0, max: 100 },
    unit: null,
    enumValues: null,
    baselineApplicable: true,
    dqs: { weight: 0, countsTowardDailyCompleteness: false },
    ui: null,
    status: 'active',
    introducedIn: 'phase1',
    deprecatedAt: null,
  },
];

// ─── Wearable (wearable_daily) ──────────────────────────────────────────────────
// Canonical keys == wearable_daily columns == WearableService upsert == compute-baselines.
// hrv_sdnn_ms is SDNN, iOS/HealthKit only (null on Android by design — docs/memory/0004).
const WEARABLE: MetricDefinition[] = [
  {
    key: 'resting_hr_bpm',
    source: 'wearable',
    table: 'wearable_daily',
    type: 'numeric',
    scale: null,
    unit: 'bpm',
    enumValues: null,
    baselineApplicable: true,
    dqs: { weight: 0, countsTowardDailyCompleteness: false },
    ui: null,
    status: 'active',
    introducedIn: 'phase2',
    deprecatedAt: null,
  },
  {
    key: 'hrv_sdnn_ms',
    source: 'wearable',
    table: 'wearable_daily',
    type: 'numeric',
    scale: null,
    unit: 'ms',
    enumValues: null,
    baselineApplicable: true,
    dqs: { weight: 0, countsTowardDailyCompleteness: false },
    ui: null,
    status: 'active',
    introducedIn: 'phase2',
    deprecatedAt: null,
  },
  {
    key: 'sleep_duration_min',
    source: 'wearable',
    table: 'wearable_daily',
    type: 'numeric',
    scale: null,
    unit: 'min',
    enumValues: null,
    baselineApplicable: true,
    dqs: { weight: 0, countsTowardDailyCompleteness: false },
    ui: null,
    status: 'active',
    introducedIn: 'phase2',
    deprecatedAt: null,
  },
  {
    key: 'spo2_pct',
    source: 'wearable',
    table: 'wearable_daily',
    type: 'numeric',
    scale: { min: 0, max: 100 },
    unit: '%',
    enumValues: null,
    baselineApplicable: true,
    dqs: { weight: 0, countsTowardDailyCompleteness: false },
    ui: null,
    status: 'active',
    introducedIn: 'phase2',
    deprecatedAt: null,
  },
  {
    key: 'body_temp_c',
    source: 'wearable',
    table: 'wearable_daily',
    type: 'numeric',
    scale: null,
    unit: '°C',
    enumValues: null,
    baselineApplicable: true,
    dqs: { weight: 0, countsTowardDailyCompleteness: false },
    ui: null,
    status: 'active',
    introducedIn: 'phase2',
    deprecatedAt: null,
  },
  {
    key: 'step_count',
    source: 'wearable',
    table: 'wearable_daily',
    type: 'numeric',
    scale: null,
    unit: 'steps',
    enumValues: null,
    baselineApplicable: true,
    dqs: { weight: 0, countsTowardDailyCompleteness: false },
    ui: null,
    status: 'active',
    introducedIn: 'phase2',
    deprecatedAt: null,
  },
];

/** The full registry. Order is stable; new metrics append within their source block. */
export const METRICS: readonly MetricDefinition[] = [...SELF_REPORT, ...WEARABLE];
