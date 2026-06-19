// shared/metrics/registry.schema.ts
//
// Runtime + compile-time drift guard for the metrics registry, mirroring the zod +
// type-equality pattern used elsewhere in shared/. Two layers:
//   1. zod schema validates the registry's shape at runtime (used by the guard test / CI).
//   2. AssertExact<> asserts the hand-written MetricDefinition interface and the zod-inferred
//      type stay structurally identical — a field added to one but not the other fails `tsc`.

import { z } from 'zod';
import type { MetricDefinition } from './registry';

export const metricSourceSchema = z.enum(['self_report', 'wearable', 'env']);
export const metricTableSchema = z.enum(['daily_gut_rows', 'wearable_daily', 'env_daily']);
export const metricTypeSchema = z.enum([
  'numeric',
  'ordinal',
  'boolean',
  'enum',
  'multi_select',
  'text',
]);
export const metricStatusSchema = z.enum(['active', 'deprecated']);

export const metricDefinitionSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]*$/, 'key must be snake_case'),
  source: metricSourceSchema,
  table: metricTableSchema,
  type: metricTypeSchema,
  scale: z.object({ min: z.number(), max: z.number() }).nullable(),
  unit: z.string().nullable(),
  enumValues: z.array(z.string()).readonly().nullable(),
  baselineApplicable: z.boolean(),
  dqs: z.object({
    weight: z.number(),
    countsTowardDailyCompleteness: z.boolean(),
  }),
  ui: z.object({ label: z.string(), inputType: z.string() }).nullable(),
  status: metricStatusSchema,
  introducedIn: z.string(),
  deprecatedAt: z.string().nullable(),
});

export const registrySchema = z
  .array(metricDefinitionSchema)
  .superRefine((metrics, ctx) => {
    const seen = new Set<string>();
    for (const m of metrics) {
      if (seen.has(m.key)) {
        ctx.addIssue({ code: 'custom', message: `duplicate metric key: ${m.key}` });
      }
      seen.add(m.key);
      // Only numeric/ordinal metrics are baseline-applicable.
      if (m.baselineApplicable && m.type !== 'numeric' && m.type !== 'ordinal') {
        ctx.addIssue({
          code: 'custom',
          message: `${m.key}: baselineApplicable requires numeric|ordinal type`,
        });
      }
      // enum / multi_select must enumerate their values; nothing else may.
      const needsEnum = m.type === 'enum' || m.type === 'multi_select';
      if (needsEnum && (!m.enumValues || m.enumValues.length === 0)) {
        ctx.addIssue({ code: 'custom', message: `${m.key}: ${m.type} needs enumValues` });
      }
      if (!needsEnum && m.enumValues) {
        ctx.addIssue({ code: 'custom', message: `${m.key}: enumValues only for enum|multi_select` });
      }
    }
  });

// ─── Compile-time AssertExact: zod-inferred type === MetricDefinition ────────────
type ZodMetric = z.infer<typeof metricDefinitionSchema>;
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
// If this line errors, registry.ts and registry.schema.ts have drifted apart.
const _assertExact: Exact<ZodMetric, MetricDefinition> = true;
void _assertExact;

/** Throws if the registry violates the schema. Used by the parity guard and any tooling. */
export function validateRegistry(metrics: unknown): MetricDefinition[] {
  return registrySchema.parse(metrics) as MetricDefinition[];
}
