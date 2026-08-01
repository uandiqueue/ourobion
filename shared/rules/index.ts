// shared/rules/index.ts
//
// Typed accessors over the rule-blueprint contract. The loader (tools/rules), the blueprint guard,
// and the engine (refactor step C) derive a rule's metric surface and in-force state through here
// instead of re-deriving the semantics.

import type { RuleBlueprint, RuleCondition, MetricKey } from './rule';

export * from './rule';
export * from './rule.schema';
export type { Equals, AssertExact } from './_assert';

/** Every metric key a condition reads (deduplicated, declaration order). */
export function conditionMetricKeys(condition: RuleCondition): MetricKey[] {
  if (condition.type === 'coincidence') return [...new Set(condition.metricKeys)];
  return [condition.metricKey];
}

/** True when the rule reads 2+ metrics (a `coincidence` conjunction). */
export function isCross(rule: RuleBlueprint): boolean {
  return rule.scope === 'cross';
}

/**
 * True when the rule should be evaluated on `isoDate` (YYYY-MM-DD): active, and inside its
 * effective window. Mirrors the engine's read filter (rules-engine-design §B2):
 * `deprecated_at is null and (effective_from is null or <= today) and (effective_to is null or >= today)`.
 */
export function isInForce(rule: RuleBlueprint, isoDate: string): boolean {
  if (rule.status !== 'active') return false;
  if (rule.effectiveFrom !== null && rule.effectiveFrom > isoDate) return false;
  if (rule.effectiveTo !== null && rule.effectiveTo < isoDate) return false;
  return true;
}

/** Blueprint's expected on-disk path relative to `data/rules/` — `<scope>/<category>/<ruleId>.json`. */
export function blueprintRelPath(rule: RuleBlueprint): string {
  return `${rule.scope}/${rule.category}/${rule.ruleId}.json`;
}
