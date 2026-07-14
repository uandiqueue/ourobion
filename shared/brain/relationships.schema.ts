// shared/brain/relationships.schema.ts
//
// Runtime + compile-time guard for the brain's relationship contract, mirroring the zod +
// type-equality pattern used in shared/metrics/registry.schema.ts. Two layers:
//   1. zod schemas validate a RelationshipClaim / EdgeVerification at runtime — the synthesis and
//      verification jobs parse their own output through these before persisting, so a malformed
//      edge fails the job instead of poisoning the graph.
//   2. AssertExact<> asserts the hand-written interfaces and the zod-inferred types stay structurally
//      identical — a field added to one but not the other fails `tsc`.
//
// The superRefine invariants are where the SAFEGUARD's philosophy is made executable: a verdict can
// only be `supported` / `contradicted` if the verifier actually retrieved evidence independently
// (no grounding ⇒ `uncertain`), `supported`/`partial` require corroboration, `contradicted` requires
// a contradicting source, and scores stay in range. See docs/nao/brain-synthesis-design.md.

import { z } from 'zod';
import type {
  Citation,
  QuoteSpan,
  RelationshipClaim,
  EdgeVerification,
} from './relationships';

export const relationKindSchema = z.enum([
  'increases',
  'decreases',
  'modulates',
  'correlates',
  'confounds',
  'no_effect',
]);
export const claimKindSchema = z.enum(['causal', 'correlational', 'mechanistic']);
export const verdictSchema = z.enum([
  'supported',
  'partial',
  'unsupported',
  'contradicted',
  'uncertain',
]);
export const evidenceTierSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);
export const impactTierSchema = z.enum(['high', 'moderate', 'low', 'preprint']);
export const verificationStatusSchema = z.enum(['active', 'stale', 'superseded']);

export const citationSchema = z.object({
  paperId: z.string().min(1),
  title: z.string(),
  year: z.number().int().nullable(),
  evidenceTier: evidenceTierSchema,
  impactTier: impactTierSchema,
  stance: z.enum(['supports', 'refutes', 'mixed', 'mentions']),
});

export const quoteSpanSchema = z.object({
  paperId: z.string().min(1),
  quote: z.string().min(1),
  locator: z.string().nullable(),
});

const metricKeySchema = z.string().regex(/^[a-z][a-z0-9_]*$/, 'metric key must be snake_case');

export const relationshipClaimSchema = z
  .object({
    edgeId: z.string().min(1),
    subject: metricKeySchema,
    object: metricKeySchema,
    relation: relationKindSchema,
    claimKind: claimKindSchema,
    effect: z.object({
      size: z.number().nullable(),
      unit: z.string().nullable(),
      ci: z.tuple([z.number(), z.number()]).readonly().nullable(),
    }),
    population: z.string().nullable(),
    citations: z.array(citationSchema).readonly(),
    quoteSpans: z.array(quoteSpanSchema).readonly(),
    synthesisModel: z.string().min(1),
    promptVersion: z.string().min(1),
    synthesisedAt: z.string().min(1),
  })
  .superRefine((c, ctx) => {
    // No self-loops — a metric can't relate to itself.
    if (c.subject === c.object) {
      ctx.addIssue({ code: 'custom', message: `${c.edgeId}: subject and object must differ` });
    }
    // edgeId must be the deterministic relationKey of (subject, relation, object).
    const expected = `${c.subject}|${c.relation}|${c.object}`;
    if (c.edgeId !== expected) {
      ctx.addIssue({ code: 'custom', message: `edgeId must equal '${expected}', got '${c.edgeId}'` });
    }
    // A synthesised claim must cite at least one source and ground it with at least one quote.
    if (c.citations.length === 0) {
      ctx.addIssue({ code: 'custom', message: `${c.edgeId}: a claim must cite ≥1 source` });
    }
    if (c.quoteSpans.length === 0) {
      ctx.addIssue({ code: 'custom', message: `${c.edgeId}: a claim must ground ≥1 quote span` });
    }
    // Every quote span must point at a cited source.
    const citedIds = new Set(c.citations.map((s) => s.paperId));
    for (const span of c.quoteSpans) {
      if (!citedIds.has(span.paperId)) {
        ctx.addIssue({ code: 'custom', message: `${c.edgeId}: quote span cites unlisted paperId '${span.paperId}'` });
      }
    }
  });

export const edgeVerificationSchema = z
  .object({
    edgeId: z.string().min(1),
    verdict: verdictSchema,
    quoteCheck: z.object({
      spansFound: z.number().int().nonnegative(),
      spansTotal: z.number().int().nonnegative(),
      allPresent: z.boolean(),
    }),
    independentRetrieval: z.object({
      performed: z.boolean(),
      sources: z.array(citationSchema).readonly(),
    }),
    corroboration: z.object({
      supporting: z.number().int().nonnegative(),
      contradicting: z.number().int().nonnegative(),
    }),
    directionCheck: z.object({ matchesClaim: z.boolean() }),
    claimKindCheck: z.object({ matchesClaim: z.boolean(), supportedKind: claimKindSchema }),
    scopeCheck: z.object({ mismatch: z.boolean(), supportedPopulation: z.string().nullable() }),
    effectSizeCheck: z.object({ matchesClaim: z.boolean(), extractedSize: z.number().nullable() }),
    evidenceTier: evidenceTierSchema,
    confidence: z.number().min(0).max(1),
    dqs: z.object({ weight: z.number().min(0).max(1) }),
    verifierModel: z.string().min(1),
    promptVersion: z.string().min(1),
    verifiedAt: z.string().min(1),
    status: verificationStatusSchema,
  })
  .superRefine((v, ctx) => {
    // THE safeguard invariant: an affirmative/contradicting verdict requires INDEPENDENT grounding.
    // Re-opining over the synthesis context (no retrieval) can only ever be `uncertain` — this is
    // what makes the second pass non-redundant rather than a rubber stamp.
    const affirms = v.verdict === 'supported' || v.verdict === 'contradicted';
    if (affirms && !v.independentRetrieval.performed) {
      ctx.addIssue({
        code: 'custom',
        message: `${v.edgeId}: verdict '${v.verdict}' requires independentRetrieval.performed === true`,
      });
    }
    // supported / partial must have at least one corroborating source.
    if ((v.verdict === 'supported' || v.verdict === 'partial') && v.corroboration.supporting < 1) {
      ctx.addIssue({ code: 'custom', message: `${v.edgeId}: '${v.verdict}' requires ≥1 supporting source` });
    }
    // contradicted must have at least one contradicting source.
    if (v.verdict === 'contradicted' && v.corroboration.contradicting < 1) {
      ctx.addIssue({ code: 'custom', message: `${v.edgeId}: 'contradicted' requires ≥1 contradicting source` });
    }
    // quoteCheck arithmetic must be consistent.
    if (v.quoteCheck.spansFound > v.quoteCheck.spansTotal) {
      ctx.addIssue({ code: 'custom', message: `${v.edgeId}: spansFound > spansTotal` });
    }
    if (v.quoteCheck.allPresent !== (v.quoteCheck.spansFound === v.quoteCheck.spansTotal)) {
      ctx.addIssue({ code: 'custom', message: `${v.edgeId}: allPresent must equal (spansFound === spansTotal)` });
    }
  });

// ─── Compile-time AssertExact: zod-inferred types === hand-written interfaces ────────────────────
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

type ZodCitation = z.infer<typeof citationSchema>;
type ZodQuoteSpan = z.infer<typeof quoteSpanSchema>;
type ZodClaim = z.infer<typeof relationshipClaimSchema>;
type ZodVerification = z.infer<typeof edgeVerificationSchema>;

// If any line errors, relationships.ts and relationships.schema.ts have drifted apart.
const _assertCitation: Exact<ZodCitation, Citation> = true;
const _assertQuoteSpan: Exact<ZodQuoteSpan, QuoteSpan> = true;
const _assertClaim: Exact<ZodClaim, RelationshipClaim> = true;
const _assertVerification: Exact<ZodVerification, EdgeVerification> = true;
void _assertCitation;
void _assertQuoteSpan;
void _assertClaim;
void _assertVerification;

/** Throws if the claim violates the schema. Used by the synthesis job + any tooling. */
export function validateClaim(claim: unknown): RelationshipClaim {
  return relationshipClaimSchema.parse(claim) as RelationshipClaim;
}

/** Throws if the verification violates the schema. Used by the verifier job + any tooling. */
export function validateVerification(verification: unknown): EdgeVerification {
  return edgeVerificationSchema.parse(verification) as EdgeVerification;
}
