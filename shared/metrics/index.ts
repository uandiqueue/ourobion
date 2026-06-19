// shared/metrics/index.ts
//
// Typed accessors over the metrics registry. Every consumer (compute-baselines, the engine,
// M6 DQS, the seed script) reads the metric list through here instead of hardcoding keys.

import { METRICS, type MetricDefinition, type MetricTable } from './registry';

export * from './registry';

/** Active (non-deprecated) metrics. */
export function active(): MetricDefinition[] {
  return METRICS.filter((m) => m.status === 'active');
}

/** Look up one metric by canonical key. */
export function byKey(key: string): MetricDefinition | undefined {
  return METRICS.find((m) => m.key === key);
}

/** All metrics for a table (active + deprecated, so historical rows still resolve). */
export function byTable(table: MetricTable): MetricDefinition[] {
  return METRICS.filter((m) => m.table === table);
}

/**
 * The ordered metric keys M5a should baseline for a table: active + baselineApplicable.
 * This is what `compute-baselines` derives its per-table key list (and SELECT) from —
 * the single line that previously drifted from the contract.
 */
export function baselineKeys(table: MetricTable): string[] {
  return METRICS.filter(
    (m) => m.table === table && m.status === 'active' && m.baselineApplicable,
  ).map((m) => m.key);
}

/** Active keys for a table (all collected signals, not just baseline-applicable). */
export function activeKeys(table: MetricTable): string[] {
  return METRICS.filter((m) => m.table === table && m.status === 'active').map((m) => m.key);
}

/** True if `key` is a known, active registry metric — used to validate rule metricKeys. */
export function isActiveMetric(key: string): boolean {
  return METRICS.some((m) => m.key === key && m.status === 'active');
}

/** Per-key DQS weights for M6 (active metrics only). */
export function dqsWeights(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of METRICS) {
    if (m.status === 'active') out[m.key] = m.dqs.weight;
  }
  return out;
}

/** Active keys that count toward a day's completeness (M6 DQS denominator). */
export function dailyCompletenessKeys(): string[] {
  return METRICS.filter(
    (m) => m.status === 'active' && m.dqs.countsTowardDailyCompleteness,
  ).map((m) => m.key);
}
