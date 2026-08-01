// shared/metrics/registry.ts
//
// THE single source of truth for every metric ourobion collects.
// Adding or removing a metric is a localized, guard-protected change: the parity / schema /
// baselines / engine / dqs guards (apps/biotope/test/guards/, docs/graph/couplings.yaml) fail the build if any
// consumer drifts from this list. See shared/metrics/README.md for the add / remove runbook.
//
// TRUTH tier (git-tracked, 2-reviewer PR per docs/memory/0002). Keep registry.ts and the
// ourobion_metrics Dart package mirror in lockstep; the parity guard enforces it.
//
// v2 (the metric platform): each metric carries the scale dimensions phase-2-plan's platform needs —
// source economy, collection tier, continuity, reliability, derivation inputs, platform availability,
// and the semi-passive preferred source. `table` is the storage location: the continuity-based
// primitives (events / state_bands / signals / derived_metrics — see the
// create_continuity_storage_primitives migration) are what new metrics declare; the legacy tables
// stay as grandfathered first instances of the primitives (no re-homing of existing metrics).

/** Source economy — what it costs the user and where the value originates. */
export type MetricSource = 'manual' | 'semi_passive' | 'sensor' | 'api' | 'derived';
/**
 * Storage location. daily_gut_rows / wearable_daily / env_daily are the grandfathered first
 * instances; events / state_bands / signals / derived_metrics are the continuity-based
 * primitives (phase-2-plan §3) new metrics declare.
 */
export type MetricTable =
  | 'daily_gut_rows'
  | 'wearable_daily'
  | 'env_daily'
  | 'events'
  | 'state_bands'
  | 'signals'
  | 'derived_metrics';
/** Collection tier (logging budget): T0 passive · T1 daily core · T2 optional · T3 event · T4 state · T5 profile. */
export type MetricTier = 'T0' | 'T1' | 'T2' | 'T3' | 'T4' | 'T5';
/** Data shape over time — drives the storage primitive a metric lands in. */
export type MetricContinuity = 'continuous' | 'episodic' | 'state' | 'static';
export type MetricType =
  | 'numeric'
  | 'ordinal'
  | 'boolean'
  | 'enum'
  | 'multi_select'
  | 'text';
/** Confidence weight (Part F reliability ladder): 4 device-measured · 3 in-moment/observation · 2 subjective/count · 1 free-text. */
export type MetricReliability = 1 | 2 | 3 | 4;
/** Platform availability — graceful-degradation tier. */
export type MetricAvailability = 'both' | 'ios_only' | 'android_only' | 'hardware_gated';
export type MetricStatus = 'active' | 'deprecated';

/** Explicit UTC daily reducer for an episodic primitive. Payload reducers accept JSON numbers only. */
export type EventDailyProjection = {
  storage: 'events';
  calendar: 'utc';
  source: 'self_report' | 'wearable' | 'env' | 'signal';
  reducer: 'count' | 'sum' | 'mean' | 'latest';
};

/** Presence means 1 for each touched UTC day; bands use the half-open [start, end) interval. */
export type StateBandDailyProjection = {
  storage: 'state_bands';
  calendar: 'utc';
  source: 'self_report' | 'wearable' | 'env' | 'signal';
  reducer: 'presence';
  interval: 'half_open';
};

export type DailyProjection = EventDailyProjection | StateBandDailyProjection;

export interface MetricDefinition {
  /** Canonical snake_case id — == DB column == BaselineSnapshot.metric_key == rule metricKey. */
  key: string;
  source: MetricSource;
  /** Storage location — a continuity primitive or a grandfathered first-instance table. */
  table: MetricTable;
  /** Collection tier (logging budget). Only T1 (daily core) counts toward daily completeness. */
  tier: MetricTier;
  continuity: MetricContinuity;
  type: MetricType;
  /** { min, max } for numeric/ordinal; null otherwise. */
  scale: { min: number; max: number } | null;
  /** Smallest valid value increment. null/absent means the metric is continuous. */
  valueStep?: number | null;
  /** Display unit, when meaningful. */
  unit: string | null;
  /** Allowed values for enum / multi_select; null otherwise. */
  enumValues: readonly string[] | null;
  /** Does M5a compute mean/std/trend for it? (true only for numeric/ordinal). */
  baselineApplicable: boolean;
  /** Confidence weight for the engine — see MetricReliability. */
  reliability: MetricReliability;
  /** For source:'derived' — the metric keys it is computed from (seeds the relationship graph). null otherwise. */
  derivedFrom: readonly string[] | null;
  availability: MetricAvailability;
  /** Semi-passive: fetch from this source first (health store), falling back to `source`. null = collected directly. */
  preferredSource: MetricSource | null;
  /** M6 Data-Quality-Score contribution. countsTowardDailyCompleteness is true only for the T1 spine. */
  dqs: { weight: number; countsTowardDailyCompleteness: boolean };
  /**
   * S4 anomaly-signal parameters (ADR-0002, docs/shared/decisions/0002-anomaly-definition.md):
   * `deadbandK` is the daily 3-state deadband in robust σ̂ = MAD/0.6745 units —
   * `neutral := |x − median| ≤ deadbandK·σ̂`. Typical value 1.0 (provisional, pending calibration).
   * Set for every baselineApplicable metric; null for metrics S4 never signals on.
   */
  signal: { deadbandK: number } | null;
  /** Optional display metadata; inputType is present only for self-report controls. */
  ui: { label: string; inputType: string | null } | null;
  /** Explicit primitive-to-day policy. Omitted/null until a primitive-homed metric is selected. */
  dailyProjection?: DailyProjection | null;
  status: MetricStatus;
  introducedIn: string;
  deprecatedAt: string | null;
}

// ─── Self-report (daily_gut_rows) ───────────────────────────────────────────────
// dqs weights for the T1 daily-core sum to 100 (urine 25 + stool_form 25 + outside_meals 20 +
// mosquito_bites 10 + energy 7 + mood 7 + gut_comfort 6) — the canonical DQS the normaliser reads.
const SELF_REPORT: MetricDefinition[] = [
  {
    key: 'urine_colour',
    source: 'manual',
    table: 'daily_gut_rows',
    tier: 'T1',
    continuity: 'continuous',
    type: 'ordinal',
    scale: { min: 1, max: 8 },
    valueStep: 1,
    unit: null,
    enumValues: null,
    baselineApplicable: true,
    reliability: 3,
    derivedFrom: null,
    availability: 'both',
    preferredSource: null,
    dqs: { weight: 25, countsTowardDailyCompleteness: true },
    signal: { deadbandK: 1.0 },
    ui: { label: 'Urine colour', inputType: 'armstrong_1_8' },
    status: 'active',
    introducedIn: 'phase1',
    deprecatedAt: null,
  },
  {
    key: 'stool_form',
    source: 'manual',
    table: 'daily_gut_rows',
    tier: 'T1',
    continuity: 'continuous',
    type: 'ordinal',
    scale: { min: 1, max: 7 },
    valueStep: 1,
    unit: null,
    enumValues: null,
    baselineApplicable: true,
    reliability: 3,
    derivedFrom: null,
    availability: 'both',
    preferredSource: null,
    dqs: { weight: 25, countsTowardDailyCompleteness: true },
    signal: { deadbandK: 1.0 },
    ui: { label: 'Stool form', inputType: 'bristol_1_7' },
    status: 'active',
    introducedIn: 'phase1',
    deprecatedAt: null,
  },
  {
    key: 'stool_count',
    source: 'manual',
    table: 'daily_gut_rows',
    tier: 'T2',
    continuity: 'continuous',
    type: 'numeric',
    scale: { min: 0, max: 10 },
    valueStep: 1,
    unit: null,
    enumValues: null,
    baselineApplicable: true,
    reliability: 2,
    derivedFrom: null,
    availability: 'both',
    preferredSource: null,
    dqs: { weight: 0, countsTowardDailyCompleteness: false },
    signal: { deadbandK: 1.0 },
    ui: { label: 'Stool count', inputType: 'stepper_0_10' },
    status: 'active',
    introducedIn: 'phase1',
    deprecatedAt: null,
  },
  {
    // Derived by M2 (max - min Bristol of the day); stored, baselined, not user-entered.
    key: 'stool_variability',
    source: 'derived',
    table: 'daily_gut_rows',
    tier: 'T0',
    continuity: 'continuous',
    type: 'numeric',
    scale: { min: 0, max: 6 },
    valueStep: 1,
    unit: null,
    enumValues: null,
    baselineApplicable: true,
    reliability: 3,
    derivedFrom: ['stool_form'],
    availability: 'both',
    preferredSource: null,
    dqs: { weight: 0, countsTowardDailyCompleteness: false },
    signal: { deadbandK: 1.0 },
    ui: null,
    status: 'active',
    introducedIn: 'phase1',
    deprecatedAt: null,
  },
  {
    key: 'outside_meals',
    source: 'manual',
    table: 'daily_gut_rows',
    tier: 'T1',
    continuity: 'continuous',
    type: 'ordinal',
    scale: { min: 0, max: 3 },
    valueStep: 1,
    unit: null,
    enumValues: null,
    baselineApplicable: true,
    reliability: 2,
    derivedFrom: null,
    availability: 'both',
    preferredSource: null,
    dqs: { weight: 20, countsTowardDailyCompleteness: true },
    signal: { deadbandK: 1.0 },
    ui: { label: 'Meals outside home', inputType: 'segmented_0_3' },
    status: 'active',
    introducedIn: 'phase1',
    deprecatedAt: null,
  },
  {
    key: 'mosquito_bites',
    source: 'manual',
    table: 'daily_gut_rows',
    tier: 'T1',
    continuity: 'episodic',
    type: 'numeric',
    scale: { min: 0, max: 20 },
    valueStep: 1,
    unit: null,
    enumValues: null,
    baselineApplicable: true,
    reliability: 2,
    derivedFrom: null,
    availability: 'both',
    preferredSource: null,
    dqs: { weight: 10, countsTowardDailyCompleteness: true },
    signal: { deadbandK: 1.0 },
    ui: { label: 'Mosquito bites', inputType: 'stepper_0_20' },
    status: 'active',
    introducedIn: 'phase1',
    deprecatedAt: null,
  },
  {
    key: 'energy_score',
    source: 'manual',
    table: 'daily_gut_rows',
    tier: 'T1',
    continuity: 'continuous',
    type: 'ordinal',
    scale: { min: 1, max: 5 },
    valueStep: 1,
    unit: null,
    enumValues: null,
    baselineApplicable: true,
    reliability: 2,
    derivedFrom: null,
    availability: 'both',
    preferredSource: null,
    dqs: { weight: 7, countsTowardDailyCompleteness: true },
    signal: { deadbandK: 1.0 },
    ui: { label: 'Energy', inputType: 'likert_1_5' },
    status: 'active',
    introducedIn: 'phase1',
    deprecatedAt: null,
  },
  {
    key: 'mood_score',
    source: 'manual',
    table: 'daily_gut_rows',
    tier: 'T1',
    continuity: 'continuous',
    type: 'ordinal',
    scale: { min: 1, max: 5 },
    valueStep: 1,
    unit: null,
    enumValues: null,
    baselineApplicable: true,
    reliability: 2,
    derivedFrom: null,
    availability: 'both',
    preferredSource: null,
    dqs: { weight: 7, countsTowardDailyCompleteness: true },
    signal: { deadbandK: 1.0 },
    ui: { label: 'Mood', inputType: 'likert_1_5' },
    status: 'active',
    introducedIn: 'phase1',
    deprecatedAt: null,
  },
  {
    key: 'gut_comfort_score',
    source: 'manual',
    table: 'daily_gut_rows',
    tier: 'T1',
    continuity: 'continuous',
    type: 'ordinal',
    scale: { min: 1, max: 5 },
    valueStep: 1,
    unit: null,
    enumValues: null,
    baselineApplicable: true,
    reliability: 2,
    derivedFrom: null,
    availability: 'both',
    preferredSource: null,
    dqs: { weight: 6, countsTowardDailyCompleteness: true },
    signal: { deadbandK: 1.0 },
    ui: { label: 'Gut comfort', inputType: 'likert_1_5' },
    status: 'active',
    introducedIn: 'phase1',
    deprecatedAt: null,
  },
  {
    key: 'appetite_score', source: 'manual', table: 'daily_gut_rows', tier: 'T2',
    continuity: 'continuous', type: 'ordinal', scale: { min: 1, max: 5 }, valueStep: 1, unit: null,
    enumValues: null, baselineApplicable: true, reliability: 2, derivedFrom: null,
    availability: 'both', preferredSource: null,
    dqs: { weight: 0, countsTowardDailyCompleteness: false }, signal: { deadbandK: 1.0 },
    ui: { label: 'Appetite', inputType: 'likert_1_5' }, status: 'active', introducedIn: 'phase2', deprecatedAt: null,
  },
  {
    key: 'anxiety_score', source: 'manual', table: 'daily_gut_rows', tier: 'T2',
    continuity: 'continuous', type: 'ordinal', scale: { min: 1, max: 5 }, valueStep: 1, unit: null,
    enumValues: null, baselineApplicable: true, reliability: 2, derivedFrom: null,
    availability: 'both', preferredSource: null,
    dqs: { weight: 0, countsTowardDailyCompleteness: false }, signal: { deadbandK: 1.0 },
    ui: { label: 'Feeling anxious', inputType: 'likert_1_5' }, status: 'active', introducedIn: 'phase2', deprecatedAt: null,
  },
  {
    key: 'brain_clarity_score', source: 'manual', table: 'daily_gut_rows', tier: 'T2',
    continuity: 'continuous', type: 'ordinal', scale: { min: 1, max: 5 }, valueStep: 1, unit: null,
    enumValues: null, baselineApplicable: true, reliability: 2, derivedFrom: null,
    availability: 'both', preferredSource: null,
    dqs: { weight: 0, countsTowardDailyCompleteness: false }, signal: { deadbandK: 1.0 },
    ui: { label: 'Mental clarity', inputType: 'likert_1_5' }, status: 'active', introducedIn: 'phase2', deprecatedAt: null,
  },
  {
    key: 'focus_score', source: 'manual', table: 'daily_gut_rows', tier: 'T2',
    continuity: 'continuous', type: 'ordinal', scale: { min: 1, max: 5 }, valueStep: 1, unit: null,
    enumValues: null, baselineApplicable: true, reliability: 2, derivedFrom: null,
    availability: 'both', preferredSource: null,
    dqs: { weight: 0, countsTowardDailyCompleteness: false }, signal: { deadbandK: 1.0 },
    ui: { label: 'Focus', inputType: 'likert_1_5' }, status: 'active', introducedIn: 'phase2', deprecatedAt: null,
  },
  {
    key: 'social_interaction_quality_score', source: 'manual', table: 'daily_gut_rows', tier: 'T2',
    continuity: 'continuous', type: 'ordinal', scale: { min: 1, max: 5 }, valueStep: 1, unit: null,
    enumValues: null, baselineApplicable: true, reliability: 2, derivedFrom: null,
    availability: 'both', preferredSource: null,
    dqs: { weight: 0, countsTowardDailyCompleteness: false }, signal: { deadbandK: 1.0 },
    ui: { label: 'Social interaction quality', inputType: 'likert_1_5' }, status: 'active', introducedIn: 'phase2', deprecatedAt: null,
  },
  {
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
    dqs: { weight: 0, countsTowardDailyCompleteness: false },
    signal: null,
    ui: { label: 'Symptoms', inputType: 'multi_select' },
    status: 'active',
    introducedIn: 'phase1',
    deprecatedAt: null,
  },
  {
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
    dqs: { weight: 0, countsTowardDailyCompleteness: false },
    signal: null,
    ui: { label: 'Standing water nearby', inputType: 'toggle' },
    status: 'active',
    introducedIn: 'phase1',
    deprecatedAt: null,
  },
  {
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
    dqs: { weight: 0, countsTowardDailyCompleteness: false },
    signal: null,
    ui: { label: 'Notes', inputType: 'text' },
    status: 'active',
    introducedIn: 'phase1',
    deprecatedAt: null,
  },
  {
    // The DQS itself, persisted per row and baselined for trend display.
    key: 'log_completeness',
    source: 'derived',
    table: 'daily_gut_rows',
    tier: 'T0',
    continuity: 'continuous',
    type: 'numeric',
    scale: { min: 0, max: 100 },
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
    dqs: { weight: 0, countsTowardDailyCompleteness: false },
    signal: { deadbandK: 1.0 },
    ui: null,
    status: 'active',
    introducedIn: 'phase1',
    deprecatedAt: null,
  },
];

// ─── Wearable (wearable_daily) — sensor source ──────────────────────────────────
// Canonical keys == wearable_daily columns == WearableService upsert == compute-baselines.
// hrv_sdnn_ms is SDNN, iOS/HealthKit only (null on Android by design — docs/memory/0004).
const WEARABLE: MetricDefinition[] = [
  {
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
    dqs: { weight: 0, countsTowardDailyCompleteness: false },
    signal: { deadbandK: 1.0 },
    ui: { label: 'Resting heart rate', inputType: null },
    status: 'active',
    introducedIn: 'phase2',
    deprecatedAt: null,
  },
  {
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
    dqs: { weight: 0, countsTowardDailyCompleteness: false },
    signal: { deadbandK: 1.0 },
    ui: { label: 'Heart-rate variability (SDNN)', inputType: null },
    status: 'active',
    introducedIn: 'phase2',
    deprecatedAt: null,
  },
  {
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
    dqs: { weight: 0, countsTowardDailyCompleteness: false },
    signal: { deadbandK: 1.0 },
    ui: { label: 'Sleep duration', inputType: null },
    status: 'active',
    introducedIn: 'phase2',
    deprecatedAt: null,
  },
  {
    key: 'spo2_pct',
    source: 'sensor',
    table: 'wearable_daily',
    tier: 'T0',
    continuity: 'continuous',
    type: 'numeric',
    scale: { min: 0, max: 100 },
    unit: '%',
    enumValues: null,
    baselineApplicable: true,
    reliability: 4,
    derivedFrom: null,
    availability: 'hardware_gated',
    preferredSource: null,
    dqs: { weight: 0, countsTowardDailyCompleteness: false },
    signal: { deadbandK: 1.0 },
    ui: { label: 'Blood oxygen', inputType: null },
    status: 'active',
    introducedIn: 'phase2',
    deprecatedAt: null,
  },
  {
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
    dqs: { weight: 0, countsTowardDailyCompleteness: false },
    signal: { deadbandK: 1.0 },
    ui: { label: 'Body temperature', inputType: null },
    status: 'active',
    introducedIn: 'phase2',
    deprecatedAt: null,
  },
  {
    key: 'step_count',
    source: 'sensor',
    table: 'wearable_daily',
    tier: 'T0',
    continuity: 'continuous',
    type: 'numeric',
    scale: null,
    valueStep: 1,
    unit: 'steps',
    enumValues: null,
    baselineApplicable: true,
    reliability: 4,
    derivedFrom: null,
    availability: 'hardware_gated',
    preferredSource: null,
    dqs: { weight: 0, countsTowardDailyCompleteness: false },
    signal: { deadbandK: 1.0 },
    ui: { label: 'Steps', inputType: null },
    status: 'active',
    introducedIn: 'phase2',
    deprecatedAt: null,
  },
];

/** The full registry. Order is stable; new metrics append within their source block. */
export const METRICS: readonly MetricDefinition[] = [...SELF_REPORT, ...WEARABLE];
