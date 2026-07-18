// shared/rules/rule.schema.ts
//
// Runtime + compile-time drift guard for the rule-blueprint contract, mirroring the zod +
// type-equality pattern of shared/metrics/registry.schema.ts. Two layers:
//   1. zod schemas validate blueprint JSON at runtime — the loader (B3) and the blueprint guard
//      (B5) both parse through here, so an invalid blueprint can never reach the `rules` table.
//   2. AssertExact<> (shared/rules/_assert.ts) asserts the hand-written types in rule.ts and the
//      zod-inferred types stay structurally identical — a field added to one but not the other
//      fails `tsc`.
//
// Structural invariants encoded below (rules-engine-design §B1 + memory 0003):
//   - ruleId / metric keys are snake_case; blueprint metricKeys are unique.
//   - scope 'single' ⟺ exactly 1 metricKey; 'cross' ⟺ 2+ and a `coincidence` condition whose
//     keys equal the blueprint's metricKeys (leaf i tests metricKeys[i], keys distinct).
//   - status 'deprecated' ⟺ deprecatedAt set; effectiveFrom ≤ effectiveTo when both set.
//   - every template passes validateCopyString (non-diagnostic gate) and uses well-formed
//     snake_case {{placeholder}}s.
// Registry-key membership (metric keys must exist in shared/metrics) is deliberately NOT a schema
// invariant — the schema stays self-contained; the loader and the blueprint guard enforce it.

import { z } from 'zod';
import { validateCopyString } from '../constants/copy_guidelines';
import type { AssertExact } from './_assert';
import type {
  CoincidenceCondition,
  RuleBlueprint,
  RuleCondition,
  ThresholdCondition,
  TrendCondition,
} from './rule';

const SNAKE_CASE = /^[a-z][a-z0-9_]*$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const ruleCategorySchema = z.enum([
  'hydration',
  'gut',
  'vector',
  'behaviour',
  'descriptive',
]);
export const ruleSeveritySchema = z.enum(['info', 'notice', 'watch']);
export const ruleScopeSchema = z.enum(['single', 'cross']);
export const ruleStatusSchema = z.enum(['active', 'deprecated']);
export const ruleProvenanceTierSchema = z.enum(['hand_authored', 'extracted']);
export const minConfidenceSchema = z.enum(['low', 'medium', 'high']);
export const trendDirectionSchema = z.enum(['rising', 'falling', 'stable']);
export const thresholdFieldSchema = z.enum(['mean', 'std_dev', 'min', 'max']);
export const thresholdOpSchema = z.enum(['lt', 'lte', 'gt', 'gte', 'eq']);

const metricKeySchema = z.string().regex(SNAKE_CASE, 'metric key must be snake_case');

export const trendConditionSchema = z.object({
  type: z.literal('trend'),
  metricKey: metricKeySchema,
  equals: trendDirectionSchema,
  minConfidence: minConfidenceSchema,
});

export const thresholdConditionSchema = z.object({
  type: z.literal('threshold'),
  metricKey: metricKeySchema,
  field: thresholdFieldSchema,
  op: thresholdOpSchema,
  value: z.number(),
  minConfidence: minConfidenceSchema,
});

export const coincidenceLeafSchema = z.discriminatedUnion('type', [
  trendConditionSchema,
  thresholdConditionSchema,
]);

export const coincidenceConditionSchema = z.object({
  type: z.literal('coincidence'),
  metricKeys: z.tuple([metricKeySchema, metricKeySchema]).readonly(),
  both: z.tuple([coincidenceLeafSchema, coincidenceLeafSchema]).readonly(),
  lagDays: z.number().int().min(1).nullable(),
  minConfidence: minConfidenceSchema,
});

export const ruleConditionSchema = z.discriminatedUnion('type', [
  trendConditionSchema,
  thresholdConditionSchema,
  coincidenceConditionSchema,
]);

export const ruleProvenanceSchema = z.object({
  tier: ruleProvenanceTierSchema,
  sourceNote: z.string().min(1),
  citation: z
    .object({ paperId: z.string().min(1), locator: z.string().nullable() })
    .nullable(),
});

export const ruleTemplateSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
});

/** All condition `type` discriminators the contract knows — the engine must evaluate every one. */
export const CONDITION_TYPES = ['trend', 'threshold', 'coincidence'] as const;

// ─── Template placeholder + copy gate ────────────────────────────────────────────

const PLACEHOLDER = /\{\{([^{}]*)\}\}/g;

/**
 * A template is well-formed when every `{{...}}` names a snake_case placeholder and no unbalanced
 * `{{` / `}}` remains outside a valid placeholder. Returns the problem, or null when fine.
 */
export function templateSyntaxError(text: string): string | null {
  for (const m of text.matchAll(PLACEHOLDER)) {
    const name = m[1] ?? '';
    if (!SNAKE_CASE.test(name)) return `placeholder "{{${name}}}" is not snake_case`;
  }
  const stripped = text.replace(PLACEHOLDER, '');
  if (stripped.includes('{{') || stripped.includes('}}')) {
    return 'unbalanced {{ }} placeholder braces';
  }
  return null;
}

function gateTemplate(ctx: z.core.$RefinementCtx, field: 'title' | 'body', text: string): void {
  if (!validateCopyString(text)) {
    ctx.addIssue({
      code: 'custom',
      path: ['template', field],
      message: `template.${field} fails validateCopyString (diagnostic language — memory 0003)`,
    });
  }
  const syntax = templateSyntaxError(text);
  if (syntax) {
    ctx.addIssue({ code: 'custom', path: ['template', field], message: `template.${field}: ${syntax}` });
  }
}

// ─── Blueprint ───────────────────────────────────────────────────────────────────

export const ruleBlueprintSchema = z
  .object({
    ruleId: z.string().regex(SNAKE_CASE, 'ruleId must be snake_case'),
    schemaVersion: z.number().int().positive(),
    category: ruleCategorySchema,
    severity: ruleSeveritySchema,
    scope: ruleScopeSchema,
    enabledPhase: z.string().regex(SNAKE_CASE, 'enabledPhase must be snake_case'),
    metricKeys: z.array(metricKeySchema).min(1).readonly(),
    provenance: ruleProvenanceSchema,
    effectiveFrom: z.string().regex(ISO_DATE, 'effectiveFrom must be YYYY-MM-DD').nullable(),
    effectiveTo: z.string().regex(ISO_DATE, 'effectiveTo must be YYYY-MM-DD').nullable(),
    status: ruleStatusSchema,
    deprecatedAt: z.string().nullable(),
    cooldownDays: z.number().int().positive().nullable(),
    expiryDays: z.number().int().positive(),
    condition: ruleConditionSchema,
    template: ruleTemplateSchema,
  })
  .superRefine((rule, ctx) => {
    // metricKeys unique.
    if (new Set(rule.metricKeys).size !== rule.metricKeys.length) {
      ctx.addIssue({ code: 'custom', path: ['metricKeys'], message: 'metricKeys must be unique' });
    }
    // scope ⟺ metric-key count.
    if (rule.scope === 'single' && rule.metricKeys.length !== 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['scope'],
        message: "scope 'single' requires exactly 1 metricKey",
      });
    }
    if (rule.scope === 'cross' && rule.metricKeys.length < 2) {
      ctx.addIssue({
        code: 'custom',
        path: ['scope'],
        message: "scope 'cross' requires 2+ metricKeys",
      });
    }
    // scope ⟺ condition shape.
    if (rule.scope === 'cross' && rule.condition.type !== 'coincidence') {
      ctx.addIssue({
        code: 'custom',
        path: ['condition'],
        message: "cross rules must use a 'coincidence' condition",
      });
    }
    if (rule.scope === 'single') {
      if (rule.condition.type === 'coincidence') {
        ctx.addIssue({
          code: 'custom',
          path: ['condition'],
          message: "single rules cannot use a 'coincidence' condition",
        });
      } else if (rule.condition.metricKey !== rule.metricKeys[0]) {
        ctx.addIssue({
          code: 'custom',
          path: ['condition', 'metricKey'],
          message: 'condition.metricKey must equal the single metricKeys[0]',
        });
      }
    }
    // coincidence internal consistency: distinct keys, leaf i tests metricKeys[i], and the
    // condition's keys are exactly the blueprint's metricKeys.
    if (rule.condition.type === 'coincidence') {
      const c = rule.condition;
      if (c.metricKeys[0] === c.metricKeys[1]) {
        ctx.addIssue({
          code: 'custom',
          path: ['condition', 'metricKeys'],
          message: 'coincidence metricKeys must be two distinct metrics',
        });
      }
      c.both.forEach((leaf, i) => {
        if (leaf.metricKey !== c.metricKeys[i]) {
          ctx.addIssue({
            code: 'custom',
            path: ['condition', 'both', i, 'metricKey'],
            message: `both[${i}] must test condition.metricKeys[${i}] ("${c.metricKeys[i]}")`,
          });
        }
      });
      const blueprintKeys = new Set(rule.metricKeys);
      const conditionKeys = new Set(c.metricKeys);
      if (
        blueprintKeys.size !== conditionKeys.size ||
        [...conditionKeys].some((k) => !blueprintKeys.has(k))
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['metricKeys'],
          message: 'blueprint metricKeys must equal the coincidence condition metricKeys',
        });
      }
    }
    // Lifecycle coherence.
    if ((rule.status === 'deprecated') !== (rule.deprecatedAt !== null)) {
      ctx.addIssue({
        code: 'custom',
        path: ['deprecatedAt'],
        message: "deprecatedAt must be set exactly when status is 'deprecated'",
      });
    }
    if (rule.effectiveFrom && rule.effectiveTo && rule.effectiveFrom > rule.effectiveTo) {
      ctx.addIssue({
        code: 'custom',
        path: ['effectiveTo'],
        message: 'effectiveTo must not precede effectiveFrom',
      });
    }
    // Non-diagnostic copy + placeholder syntax on every user-facing template string.
    gateTemplate(ctx, 'title', rule.template.title);
    gateTemplate(ctx, 'body', rule.template.body);
  });

// ─── Compile-time AssertExact: zod-inferred types === hand-written rule.ts ──────
type ZodTrend = z.infer<typeof trendConditionSchema>;
type ZodThreshold = z.infer<typeof thresholdConditionSchema>;
type ZodCoincidence = z.infer<typeof coincidenceConditionSchema>;
type ZodCondition = z.infer<typeof ruleConditionSchema>;
type ZodBlueprint = z.infer<typeof ruleBlueprintSchema>;

// If any of these lines error, rule.ts and rule.schema.ts have drifted apart.
const _assertTrend: AssertExact<ZodTrend, TrendCondition> = true;
const _assertThreshold: AssertExact<ZodThreshold, ThresholdCondition> = true;
const _assertCoincidence: AssertExact<ZodCoincidence, CoincidenceCondition> = true;
const _assertCondition: AssertExact<ZodCondition, RuleCondition> = true;
const _assertBlueprint: AssertExact<ZodBlueprint, RuleBlueprint> = true;
void _assertTrend;
void _assertThreshold;
void _assertCoincidence;
void _assertCondition;
void _assertBlueprint;

/** Throws (ZodError) if the value is not a valid blueprint. Loader/guard entry point. */
export function validateBlueprint(value: unknown): RuleBlueprint {
  return ruleBlueprintSchema.parse(value) as RuleBlueprint;
}
