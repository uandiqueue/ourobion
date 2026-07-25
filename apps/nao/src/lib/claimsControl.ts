// ourobion nao — claims-curation helpers (O13 / demo feature (b), run-2 U9).
//
// Pure, IO-free logic for the /claims page, the per-paper "Claims & verdicts"
// section and the /api/claims* routes (nao's ingestControl/modelsControl
// convention: route handlers are IO glue over unit-tested pure functions).
//
// Reads: relationship_claims + the verified_edges view (both DERIVED projections
// of the R2 edge artifacts, rebuilt by tools/edge-loader — nao never edits them).
// The ONE write surface is /api/claims/reject → edge_human_verdicts, the O13
// additive human layer: a REJECT is RECORDED (append-only, created_by =
// auth.uid()) and supersedes the verifier FOR SERVING; absence of a human action
// = the verifier default stands (interim until B5). No approve/restore this cycle.

/**
 * The exact TEST-MODE stamp for verifier verdicts — mirrors
 * tools/llm-router/src/types.ts TEST_MODE_LABEL verbatim (wording is
 * load-bearing, Run 2.0 posture decision; tests/claimsControl.test.ts pins the
 * two strings together). nao cannot import tools/ code directly (app/tool
 * boundary), so the literal is duplicated under a coupling test, the same way
 * ModelsPanel renders it.
 */
export const TEST_MODE_LABEL =
  'scaffolded + unit-tested (TEST-MODE: single-provider, decorrelation OFF)' as const;

/** A claim citation, as stored inside relationship_claims.claim->'citations'. */
export interface ClaimCitation {
  paperId: string;
  title: string;
  year: number | null;
  population?: string | null;
  evidenceTier?: number;
  impactTier?: string;
  stance?: string;
}

/** A quote span, as stored inside relationship_claims.claim->'quoteSpans'. */
export interface ClaimQuoteSpan {
  paperId: string;
  quote: string;
  locator?: string | null;
}

/** The parts of the claim jsonb the curation surface renders. */
export interface ClaimJson {
  claimKind?: string;
  derivation?: string;
  population?: string | null;
  citations?: ClaimCitation[];
  quoteSpans?: ClaimQuoteSpan[];
}

/** Row of relationship_claims (the columns the panel reads). */
export interface ClaimRow {
  edge_id: string;
  subject: string;
  object: string;
  relation: string;
  claim: ClaimJson;
  synthesised_at: string;
}

/** Row of the verified_edges view (verdict + O13 human-verdict columns). */
export interface VerifiedEdgeRow {
  edge_id: string;
  verdict: string;
  serving_band: string;
  edge_score: number | string; // numeric arrives as string over PostgREST
  verified_at: string;
  human_verdict: string | null;
  human_verdict_at: string | null;
}

/** One shaped entry for the panel: a claim + its latest verification + human status. */
export interface ClaimView {
  edgeId: string;
  subject: string;
  relation: string;
  object: string;
  claimKind: string | null;
  derivation: string | null;
  population: string | null;
  quoteSpans: ClaimQuoteSpan[];
  citations: ClaimCitation[];
  synthesisedAt: string;
  /** Newest ACTIVE verification (null = claim not yet verified — nothing servable). */
  verification: {
    verdict: string;
    servingBand: string;
    edgeScore: number;
    verifiedAt: string;
  } | null;
  /** O13 human layer: 'reject' | null (null = no human action, verifier default stands). */
  humanVerdict: string | null;
  humanVerdictAt: string | null;
}

/**
 * The jsonb containment value for "claims whose citations include this paper":
 * `claim->'citations' @> [{"paperId": <uid>}]` (supabase-js
 * `.contains('claim->citations', citationsContainsValue(uid))`). MUST be a JSON
 * *string*: postgrest-js serialises a JS array as a Postgres array literal
 * (`cs.{...}`), which is invalid json for a jsonb column — only a string is
 * passed through raw as `cs.<json>` (live-proof finding, U9). At demo scale
 * (single-digit claims) the planner seq-scans this — no GIN index (measured in
 * the U9 live proof; add one only when the table warrants it).
 */
export function citationsContainsValue(paperUid: string): string {
  return JSON.stringify([{ paperId: paperUid }]);
}

/** Join claims to their verified_edges row (claims without one stay visible, unverified). */
export function mergeClaimsWithVerdicts(
  claims: readonly ClaimRow[],
  edges: readonly VerifiedEdgeRow[],
): ClaimView[] {
  const byEdge = new Map(edges.map((e) => [e.edge_id, e]));
  return claims.map((c) => {
    const e = byEdge.get(c.edge_id);
    return {
      edgeId: c.edge_id,
      subject: c.subject,
      relation: c.relation,
      object: c.object,
      claimKind: c.claim.claimKind ?? null,
      derivation: c.claim.derivation ?? null,
      population: c.claim.population ?? null,
      quoteSpans: c.claim.quoteSpans ?? [],
      citations: c.claim.citations ?? [],
      synthesisedAt: c.synthesised_at,
      verification: e
        ? {
            verdict: e.verdict,
            servingBand: e.serving_band,
            edgeScore: typeof e.edge_score === 'string' ? Number.parseFloat(e.edge_score) : e.edge_score,
            verifiedAt: e.verified_at,
          }
        : null,
      humanVerdict: e?.human_verdict ?? null,
      humanVerdictAt: e?.human_verdict_at ?? null,
    };
  });
}

/** Validated POST /api/claims/reject body. */
export interface RejectRequest {
  edgeId: string;
  reason: string | null;
}

export type ParseRejectResult = { ok: true; value: RejectRequest } | { ok: false; error: string };

const MAX_EDGE_ID_LENGTH = 512;
const MAX_REASON_LENGTH = 2000;

/** Validate a reject request body. Reject is the ONLY action this cycle (O13 locked). */
export function parseRejectBody(body: unknown): ParseRejectResult {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'body must be a JSON object' };
  }
  const b = body as Record<string, unknown>;
  const edgeId = b.edgeId;
  if (typeof edgeId !== 'string' || edgeId.trim() === '') {
    return { ok: false, error: 'edgeId must be a non-empty string' };
  }
  if (edgeId.length > MAX_EDGE_ID_LENGTH) {
    return { ok: false, error: `edgeId must be <= ${MAX_EDGE_ID_LENGTH} characters` };
  }
  // relationKey shape: subject|relation|object — cheap sanity guard, not a registry check
  // (the route verifies the edge actually exists in relationship_claims).
  if (edgeId.split('|').length !== 3) {
    return { ok: false, error: 'edgeId must be a relation key: subject|relation|object' };
  }
  const rawReason = b.reason;
  if (rawReason !== undefined && rawReason !== null && typeof rawReason !== 'string') {
    return { ok: false, error: 'reason must be a string (or omitted)' };
  }
  const reason = typeof rawReason === 'string' ? rawReason.trim() : '';
  if (reason.length > MAX_REASON_LENGTH) {
    return { ok: false, error: `reason must be <= ${MAX_REASON_LENGTH} characters` };
  }
  return { ok: true, value: { edgeId: edgeId.trim(), reason: reason === '' ? null : reason } };
}
