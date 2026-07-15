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
// (source: 'wearable') and match the wearable_daily table columns exactly. All metrics
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
  data_sources: ('self_report' | 'wearable' | 'env')[];
}

export interface InsightCard {
  id: string;
  user_id: string;
  generated_at: string;
  title: string;
  body: string;
  category: 'hydration' | 'gut' | 'vector' | 'behaviour' | 'descriptive';
  severity: 'info' | 'notice' | 'watch';
  contributing_metrics: string[];
  confidence_score: number;
  confidence_sources: ('self_report' | 'wearable' | 'env')[];
  status: 'active' | 'snoozed' | 'dismissed';
  expires_at: string | null;
  rule_id: string;
  phase_generated: string;
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
