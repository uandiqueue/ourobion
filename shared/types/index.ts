// shared/types/index.ts

export interface DailyGutRow {
  id: string;
  user_id: string;
  log_date: string;
  region: string;
  urine_colour: number | null;
  stool_count: number | null;
  stool_form: number | null;
  stool_variability: number | null;
  outside_meals: number | null;
  mosquito_bites: number | null;
  standing_water_present: boolean | null;
  on_antibiotics: boolean | null;
  gut_watch_active: boolean | null;
  energy_score: number | null;
  mood_score: number | null;
  gut_comfort_score: number | null;
  symptom_flags: string[];
  notes: string | null;
  log_completeness: number;
  created_at: string;
  updated_at: string;
}

// Wearable signals. Keys are the single source of truth in shared/metrics/registry.ts
// (source: 'sensor') and match the wearable_daily table columns exactly. All metrics
// nullable; hrv_sdnn_ms is SDNN, iOS/HealthKit only — null on Android (docs/memory/0004).
export interface DailyPhysioRow {
  user_id: string;
  date: string;
  resting_hr_bpm: number | null;
  hrv_sdnn_ms: number | null;
  sleep_duration_min: number | null;
  spo2_pct: number | null;
  body_temp_c: number | null;
  step_count: number | null;
  source: string | null;
  synced_at: string;
}

export interface DailyEnvRow {
  id: string;
  user_id: string;
  date: string;
  region: string;
  temp_max_c: number | null;
  temp_min_c: number | null;
  heat_index_c: number | null;
  rainfall_mm: number | null;
  uv_index: number | null;
  ndvi_score: number | null;
  green_cover_bucket: 'low' | 'medium' | 'high' | null;
  dengue_case_rate: number | null;
  outbreak_alert_active: boolean;
  time_in_green_min: number | null;
  created_at: string;
}

export interface BaselineSnapshot {
  id: string;
  user_id: string;
  metric_key: string;
  computed_at: string;
  days_of_data: number;
  mean: number | null;
  std_dev: number | null;
  min: number | null;
  max: number | null;
  trend: 'stable' | 'rising' | 'falling' | null;
  confidence: 'insufficient' | 'low' | 'medium' | 'high';
  // Vocabulary = the S2 metric_daily_values view's source tags: the wide-table unpivot branches
  // emit 'self_report' (daily_gut_rows) / 'wearable' (wearable_daily), the signals long-table
  // branch emits 'signal' (tools/metric-view/lib/view.mjs); 'env' is reserved for env metrics.
  data_sources: ('self_report' | 'wearable' | 'env' | 'signal')[];
}

// One card <-> verified-edge reference inside InsightCard.edge_refs (jsonb payload written by
// generate-insights — keys stay camelCase on the wire, matching the engine's CardRow shape and
// the migration comment "[{edgeId, verifiedAt}]"). verifiedAt pins the edge VERSION (§S6).
export interface InsightCardEdgeRef {
  edgeId: string;
  verifiedAt: string;
}

export interface InsightCard {
  // bigint identity column — arrives as a JSON number over PostgREST.
  id: number;
  user_id: string;
  generated_at: string;
  title: string;
  body: string;
  // 'relationship' = the composer producers' category (§S8 migration CHECK).
  category: 'hydration' | 'gut' | 'vector' | 'behaviour' | 'descriptive' | 'relationship';
  severity: 'info' | 'notice' | 'watch';
  contributing_metrics: string[];
  confidence_score: number;
  // BaselineSnapshot.data_sources vocabulary plus 'brain' (the engine appends it when a card
  // rests on verified research edges — generate-insights/index.ts).
  confidence_sources: ('self_report' | 'wearable' | 'env' | 'signal' | 'brain')[];
  status: 'active' | 'snoozed' | 'dismissed';
  expires_at: string | null;
  rule_id: string;
  phase_generated: string;
  // §S8 producer columns. Optional-with-default (docs/memory/0002): instances serialized before
  // the 20260716050639 migration lack them; the DB backfills reads with the same defaults.
  producer?: 'rules' | 'edge' | 'personal'; // DB default 'rules'
  insight_id?: string | null; // composed_insights FK; null/absent for plain rules cards
  edge_refs?: InsightCardEdgeRef[]; // DB default []; always [] for producer 'personal' (CHECK)
}

export interface InsightFiredEvent {
  event_type: 'insight_fired';
  user_id: string;
  insight_id: string;
  category: InsightCard['category'];
  severity: InsightCard['severity'];
  fired_at: string;
}

export interface EngagementState {
  user_id: string;
  updated_at: string;
  dqs_today: number;
  dqs_7day_avg: number;
  current_streak_days: number;
  longest_streak_days: number;
  streak_threshold_dqs: number;
  active_title: string;
  unlocked_titles: string[];
}

export const SYMPTOM_FLAGS = [
  'feverish',
  'nausea',
  'body_aches',
  'fatigue',
  'loss_of_appetite',
  'abdominal_cramps',
  'headache',
] as const;

export type SymptomFlag = typeof SYMPTOM_FLAGS[number];
