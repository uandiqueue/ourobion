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
  EvidencePassage,
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

// O15/B1: bounded, provenance-addressable evidence passage carried on a citation. ADDITIVE +
// OPTIONAL (accepted-contract discipline: fields are added optional, never removed/renamed) so
// every pre-existing record without `evidence` still validates. Producers bound the text size
// (brain-ingest `maxEvidenceCharsPerSource`); the schema only requires non-emptiness.
export const evidencePassageSchema = z.object({
  text: z.string().min(1),
  locator: z.string().min(1),
});

export const citationSchema = z.object({
  paperId: z.string().min(1),
  title: z.string().min(1),
  year: z.number().int().nullable(),
  population: z.string().nullable(),
  evidenceTier: evidenceTierSchema,
  impactTier: impactTierSchema,
  stance: z.enum(['supports', 'refutes', 'mixed', 'mentions']),
  evidence: z.array(evidencePassageSchema).readonly().optional(),
});

export const quoteSpanSchema = z
  .object({
    paperId: z.string().min(1),
    quote: z.string().min(1),
    locator: z.string().nullable(),
    charStart: z.number().int().nonnegative().nullable(),
    charEnd: z.number().int().nonnegative().nullable(),
  })
  .superRefine((s, ctx) => {
    // Offsets must form a well-ordered span when both are known.
    if (s.charStart !== null && s.charEnd !== null && s.charStart > s.charEnd) {
      ctx.addIssue({
        code: 'custom',
        message: `quote span for '${s.paperId}': charStart (${s.charStart}) > charEnd (${s.charEnd})`,
      });
    }
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
    derivation: z.string().min(1),
    synthesisModel: z.string().min(1),
    promptVersion: z.string().min(1),
    synthesisedAt: z.string().datetime({ offset: true }),
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
    verifiedAt: z.string().datetime({ offset: true }),
    status: verificationStatusSchema,
  })
  .superRefine((v, ctx) => {
    // THE safeguard invariant: every SERVABLE verdict requires INDEPENDENT grounding. Re-opining over
    // the synthesis context (no retrieval) can only ever be `uncertain` — this is what makes the second
    // pass non-redundant rather than a rubber stamp. `partial` is servable (shared/brain/index.ts
    // SERVABLE_VERDICTS), so it must be grounded too, not just `supported`/`contradicted` (A1/D16).
    const requiresGrounding =
      v.verdict === 'supported' || v.verdict === 'contradicted' || v.verdict === 'partial';
    if (requiresGrounding && !v.independentRetrieval.performed) {
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
    // Corroboration counts can't exceed what the retrieved source stances can support — the LLM cannot
    // invent corroboration the retrieval didn't yield (A2). Mirrors brain-ingest enforce()'s stance
    // re-derivation as an upper bound: `supports`/`mixed` sources can corroborate, `refutes` can
    // contradict. Stance vocabulary is citationSchema's own enum.
    const canSupport = v.independentRetrieval.sources.filter(
      (s) => s.stance === 'supports' || s.stance === 'mixed',
    ).length;
    const canContradict = v.independentRetrieval.sources.filter((s) => s.stance === 'refutes').length;
    if (v.corroboration.supporting > canSupport) {
      ctx.addIssue({
        code: 'custom',
        message: `${v.edgeId}: corroboration.supporting (${v.corroboration.supporting}) exceeds retrieved supporting/mixed sources (${canSupport})`,
      });
    }
    if (v.corroboration.contradicting > canContradict) {
      ctx.addIssue({
        code: 'custom',
        message: `${v.edgeId}: corroboration.contradicting (${v.corroboration.contradicting}) exceeds retrieved refuting sources (${canContradict})`,
      });
    }
    // quoteCheck arithmetic must be consistent.
    if (v.quoteCheck.spansFound > v.quoteCheck.spansTotal) {
      ctx.addIssue({ code: 'custom', message: `${v.edgeId}: spansFound > spansTotal` });
    }
    // `allPresent` matches brain-ingest quoteCheck.ts's computation: a zero-span block never passes
    // vacuously (0/0 ⇒ false), so the shared schema and the in-repo producer agree (A3).
    const allPresentExpected =
      v.quoteCheck.spansTotal > 0 && v.quoteCheck.spansFound === v.quoteCheck.spansTotal;
    if (v.quoteCheck.allPresent !== allPresentExpected) {
      ctx.addIssue({
        code: 'custom',
        message: `${v.edgeId}: allPresent must equal (spansTotal > 0 && spansFound === spansTotal)`,
      });
    }
    // O17 (verdict B3): a SERVABLE verdict requires a PASSING quote check. Mirrors
    // shared/brain/index.ts SERVABLE_VERDICTS ({supported, partial}) — the only verdicts the band
    // computation can serve — so the CONTRACT refuses a servable verdict whose grounding quotes
    // were not all found (zero-span {0,0,false} or partially-found {n,m,false}); such a record
    // could otherwise band `mid` through the loader. The pipeline's pre-LLM quote gate
    // (brain-ingest verifier.ts) masks this for in-repo runs but is no guarantee for
    // hand-authored / legacy / imported artifacts. Conditional on the verdict: zero-span
    // `uncertain` / `unsupported` / `contradicted` records are intentionally retained (A3).
    const servable = v.verdict === 'supported' || v.verdict === 'partial';
    if (servable && !(v.quoteCheck.spansFound >= 1 && v.quoteCheck.allPresent === true)) {
      ctx.addIssue({
        code: 'custom',
        message: `${v.edgeId}: servable verdict '${v.verdict}' requires a passing quote check (spansFound >= 1 && allPresent === true), got ${v.quoteCheck.spansFound}/${v.quoteCheck.spansTotal} allPresent=${v.quoteCheck.allPresent}`,
      });
    }
  });

// ─── Compile-time AssertExact: zod-inferred types === hand-written interfaces ────────────────────
// Conditional-generic identity (not mutual assignability): `Exact<any, T>` is `false` and
// optional-vs-`| undefined` drift is visible, so an `any`-degraded zod inference fails the guard
// instead of silently passing (A5). Same form as shared/rules/_assert.ts `Equals`.
type Exact<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2)
  ? true
  : false;

type ZodEvidencePassage = z.infer<typeof evidencePassageSchema>;
type ZodCitation = z.infer<typeof citationSchema>;
type ZodQuoteSpan = z.infer<typeof quoteSpanSchema>;
type ZodClaim = z.infer<typeof relationshipClaimSchema>;
type ZodVerification = z.infer<typeof edgeVerificationSchema>;

// If any line errors, relationships.ts and relationships.schema.ts have drifted apart.
const _assertEvidencePassage: Exact<ZodEvidencePassage, EvidencePassage> = true;
const _assertCitation: Exact<ZodCitation, Citation> = true;
const _assertQuoteSpan: Exact<ZodQuoteSpan, QuoteSpan> = true;
const _assertClaim: Exact<ZodClaim, RelationshipClaim> = true;
const _assertVerification: Exact<ZodVerification, EdgeVerification> = true;
void _assertEvidencePassage;
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
