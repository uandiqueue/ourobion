// shared/metrics/registry.schema.ts
//
// Runtime + compile-time drift guard for the metrics registry, mirroring the zod +
// type-equality pattern used elsewhere in shared/. Two layers:
//   1. zod schema validates the registry's shape at runtime (used by the guard test / CI).
//   2. AssertExact<> asserts the hand-written MetricDefinition interface and the zod-inferred
//      type stay structurally identical — a field added to one but not the other fails `tsc`.

import { z } from 'zod';
import type { MetricDefinition } from './registry';

export const metricSourceSchema = z.enum(['manual', 'semi_passive', 'sensor', 'api', 'derived']);
export const metricTableSchema = z.enum([
  'daily_gut_rows',
  'wearable_daily',
  'env_daily',
  'events',
  'state_bands',
  'signals',
  'derived_metrics',
]);
export const metricTierSchema = z.enum(['T0', 'T1', 'T2', 'T3', 'T4', 'T5']);
export const metricContinuitySchema = z.enum(['continuous', 'episodic', 'state', 'static']);
export const metricTypeSchema = z.enum([
  'numeric',
  'ordinal',
  'boolean',
  'enum',
  'multi_select',
  'text',
]);
export const metricReliabilitySchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
]);
export const metricAvailabilitySchema = z.enum([
  'both',
  'ios_only',
  'android_only',
  'hardware_gated',
]);
export const metricStatusSchema = z.enum(['active', 'deprecated']);
export const dailyProjectionSourceSchema = z.enum(['self_report', 'wearable', 'env', 'signal']);
export const dailyProjectionSchema = z.discriminatedUnion('storage', [
  z.object({
    storage: z.literal('events'),
    calendar: z.literal('utc'),
    source: dailyProjectionSourceSchema,
    reducer: z.enum(['count', 'sum', 'mean', 'latest']),
  }),
  z.object({
    storage: z.literal('state_bands'),
    calendar: z.literal('utc'),
    source: dailyProjectionSourceSchema,
    reducer: z.literal('presence'),
    interval: z.literal('half_open'),
  }),
]);

export const metricDefinitionSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]*$/, 'key must be snake_case'),
  source: metricSourceSchema,
  table: metricTableSchema,
  tier: metricTierSchema,
  continuity: metricContinuitySchema,
  type: metricTypeSchema,
  scale: z.object({ min: z.number(), max: z.number() }).nullable(),
  valueStep: z.number().positive().nullable().default(null),
  unit: z.string().nullable(),
  enumValues: z.array(z.string()).readonly().nullable(),
  baselineApplicable: z.boolean(),
  reliability: metricReliabilitySchema,
  derivedFrom: z.array(z.string()).readonly().nullable(),
  availability: metricAvailabilitySchema,
  preferredSource: metricSourceSchema.nullable(),
  dqs: z.object({
    weight: z.number(),
    countsTowardDailyCompleteness: z.boolean(),
  }),
  signal: z.object({ deadbandK: z.number().positive() }).nullable(),
  ui: z.object({ label: z.string(), inputType: z.string().nullable() }).nullable(),
  dailyProjection: dailyProjectionSchema.nullable().default(null),
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
      if (m.valueStep !== null && m.type !== 'numeric' && m.type !== 'ordinal') {
        ctx.addIssue({
          code: 'custom',
          message: `${m.key}: valueStep is only valid for numeric|ordinal metrics`,
        });
      }
      if (m.type === 'ordinal' && m.valueStep === null) {
        ctx.addIssue({
          code: 'custom',
          message: `${m.key}: ordinal metrics require valueStep`,
        });
      }
      if (m.scale && m.valueStep !== null) {
        const scaleSteps = (m.scale.max - m.scale.min) / m.valueStep;
        if (scaleSteps <= 0 || Math.abs(scaleSteps - Math.round(scaleSteps)) > 1e-9) {
          ctx.addIssue({
            code: 'custom',
            message: `${m.key}: scale span must be a positive whole multiple of valueStep`,
          });
        }
      }
      // Every baselined metric carries S4 signal params (ADR-0002 deadband).
      if (m.baselineApplicable && m.signal === null) {
        ctx.addIssue({
          code: 'custom',
          message: `${m.key}: baselineApplicable requires signal (S4 deadbandK, ADR-0002)`,
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
      // A derived metric must declare its inputs; nothing else may.
      if (m.source === 'derived' && (!m.derivedFrom || m.derivedFrom.length === 0)) {
        ctx.addIssue({ code: 'custom', message: `${m.key}: source 'derived' needs derivedFrom` });
      }
      if (m.source !== 'derived' && m.derivedFrom) {
        ctx.addIssue({ code: 'custom', message: `${m.key}: derivedFrom only for source 'derived'` });
      }
      // Only the T1 daily-core counts toward daily completeness, and only counted metrics carry weight.
      if (m.dqs.countsTowardDailyCompleteness && m.tier !== 'T1') {
        ctx.addIssue({ code: 'custom', message: `${m.key}: only T1 may count toward daily completeness` });
      }
      if (m.dqs.weight > 0 && !m.dqs.countsTowardDailyCompleteness) {
        ctx.addIssue({ code: 'custom', message: `${m.key}: dqs.weight > 0 requires countsTowardDailyCompleteness` });
      }
      if (m.dailyProjection && m.dailyProjection.storage !== m.table) {
        ctx.addIssue({
          code: 'custom',
          message: `${m.key}: dailyProjection storage must match table ${m.table}`,
        });
      }
      const primitiveTable = m.table === 'events' || m.table === 'state_bands';
      const numericType = m.type === 'numeric' || m.type === 'ordinal';
      if (m.status === 'active' && primitiveTable && numericType && !m.dailyProjection) {
        ctx.addIssue({
          code: 'custom',
          message: `${m.key}: active numeric|ordinal ${m.table} metric requires dailyProjection`,
        });
      }
      if (m.dailyProjection && (!primitiveTable || !numericType)) {
        ctx.addIssue({
          code: 'custom',
          message: `${m.key}: dailyProjection is only supported for numeric|ordinal events|state_bands metrics`,
        });
      }
      if (
        m.dailyProjection?.storage === 'events' &&
        (m.dailyProjection.reducer === 'count' || m.dailyProjection.reducer === 'sum') &&
        m.type !== 'numeric'
      ) {
        ctx.addIssue({ code: 'custom', message: `${m.key}: event ${m.dailyProjection.reducer} requires numeric type` });
      }
      if (m.dailyProjection?.storage === 'state_bands' && m.type !== 'numeric') {
        ctx.addIssue({ code: 'custom', message: `${m.key}: state presence requires numeric type` });
      }
    }
  });

// ─── Compile-time AssertExact: zod-inferred type === MetricDefinition ────────────
// Compare the authored/input shape: dailyProjection is optional there, while parse output
// normalizes absence to null for runtime consumers.
type ZodMetric = z.input<typeof metricDefinitionSchema>;
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
// If this line errors, registry.ts and registry.schema.ts have drifted apart.
const _assertExact: Exact<ZodMetric, MetricDefinition> = true;
void _assertExact;

/** Throws if the registry violates the schema. Used by the parity guard and any tooling. */
export function validateRegistry(metrics: unknown): MetricDefinition[] {
  return registrySchema.parse(metrics) as MetricDefinition[];
}
