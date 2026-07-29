// shared/brain/index.ts
//
// Typed accessors + gating over the brain's relationship contract. Consumers (the synthesis /
// verifier jobs, and later the insight engine that reads the graph) compute an edge's identity and
// its servability through here instead of re-deriving the rules — the single place gating lives.

import {
  type EdgeVerification,
  type RelationKind,
  type VerifiedEdge,
  type Verdict,
} from './relationships';

export * from './relationships';

// R4-U4 / O27 · `provenance.ts` (artifact trust posture, claim-strength semantics,
// provenance-chain and exact-quote checks, revision-bound expert disposition) and
// `trust_labels.ts` (the O38 parity-guarded vocabulary) are deliberately NOT re-exported here.
//
// `relationships.ts` is type-only, so re-exporting it costs nothing at runtime. Those two modules
// export VALUES, and this barrel is on `tools/edge-loader/load_edges.mjs`'s import path — pulling
// a value re-export chain in breaks that CLI under Node's CommonJS-loading-ESM interop
// ("does not provide an export named ..."). Consumers import them directly instead:
//
//   import { trustFailures } from 'shared/brain/trust_labels';   // also the Deno-safe entrypoint
//   import { resolveDisposition } from 'shared/brain/provenance';
//
// which is what the edge functions and the tests already do.

/**
 * Deterministic edge identity. Synthesis and verification both address an edge by this key, so a
 * re-run updates the same edge instead of duplicating it. Mirrors a metric's canonical `key`.
 */
export function relationKey(subject: string, relation: RelationKind, object: string): string {
  return `${subject}|${relation}|${object}`;
}

/**
 * Gating thresholds — the confidence floor an edge must clear to be served at each band.
 *
 * **Provisional & uncalibrated (RU2f).** The gates 0.8 / 0.5 have no published basis and — because
 * `edgeScore` is not calibrated to any external probability — they carry **no operational meaning
 * beyond rank order**. Until they are calibrated against a GRADE-rated exemplar set (ADR-0003
 * Open-Q 1–2), treat `high` / `mid` as **rank-order UX bands, not truth claims**: a `high` edge is
 * ranked above a `mid` edge, but "0.8" does not mean "≈80% true" (contrast Knowledge Vault's
 * Platt-calibrated 0.9/0.7 gates, which do — Jüni 1999 further shows threshold membership on a
 * composite quality score is scale-dependent). Calibration is backlogged — **phase2-research-fixes B7**.
 * Do NOT read these as tuned; changing a value here re-bands every edge.
 */
export const EDGE_GATES = {
  /** ≥ this and well-evidenced → served plainly. Provisional (uncalibrated) — a rank-order band, not a ~80%-true claim (RU2f). */
  high: 0.8,
  /** ≥ this → served with a "limited evidence" qualifier. Provisional (uncalibrated) — a rank-order band, not a truth claim (RU2f). */
  mid: 0.5,
} as const;

/** Verdicts a servable edge may carry. `uncertain` / `unsupported` / `contradicted` are never served. */
const SERVABLE_VERDICTS: ReadonlySet<Verdict> = new Set<Verdict>(['supported', 'partial']);

/**
 * `edgeScore` weights + saturation cap, lifted out of the arithmetic per ADR-0002's "values in config
 * objects, never inline literals" mandate. **Provisional — uncited (RU2b):** no literature supports
 * these specific numbers, so the composite is a rank-order aid, not a calibrated truth value; the
 * honest guardrail is to report the components alongside the composite wherever an edge is surfaced
 * for review (see `edgeScoreComponents`, and RU2's Cochrane-style domain-wise practice). Changing a
 * value here changes the score for every edge — do not treat these as tuned.
 *
 * **The composite FORM itself is literature-contested, not just these weights (RU2a).** The evidence
 * review is actively *hostile* to additive quality scores: Jüni 1999 applied 25 quality scales to the
 * same trials and the "high-quality" subset flipped with the scale chosen, which led Cochrane to
 * abandon numeric quality scores for **domain-by-domain judgment**; GRADE is explicitly not an
 * additive formula. So `edgeScoreComponents()` reporting the parts alongside the composite (shipped in
 * F3) is the **domain-wise-transparency guardrail** this literature implies — the first step of the
 * mitigation, not a full remedy. The remedy is ADR-0003 Open-Q 1–2: **fit the weights against
 * GRADE-rated Cochrane exemplars**, and reconsider whether the additive form should be replaced by
 * domain-wise reporting. Calibration is backlogged — **phase2-research-fixes B7**.
 */
export const EDGE_WEIGHTS = {
  /** Floor multiplier: confidence alone, before structural signals shade it. */
  base: 0.6,
  /** Weight on the study-design tier term (`evidenceTier / 5`). */
  tier: 0.25,
  /** Weight on the net-corroboration boost. */
  corroboration: 0.15,
  /** Net supporting-minus-contradicting sources at which the corroboration boost saturates. */
  corroborationSaturation: 3,
} as const;

/**
 * The decomposed `edgeScore` — the breakdown that reconstructs the composite, so a reviewer can see
 * *why* an edge scored as it did (RU2 guardrail: report confidence/tier/corroboration alongside the
 * composite). `edgeScore` and `servingBand` are thin readers of this ONE source of truth, so the
 * composite, its parts, and the band can never drift.
 */
export interface EdgeScoreComponents {
  /** Verifier's calibrated confidence (dominates the score). */
  confidence: number;
  /** Study-design tier term, `evidenceTier / 5` (0.2 mechanistic … 1.0 meta-analysis). */
  tierWeight: number;
  /** Net-corroboration boost, saturating at `EDGE_WEIGHTS.corroborationSaturation` net sources. */
  corroborationBoost: number;
  /** `EDGE_WEIGHTS.base`. */
  baseContribution: number;
  /** `EDGE_WEIGHTS.tier * tierWeight`. */
  tierContribution: number;
  /** `EDGE_WEIGHTS.corroboration * corroborationBoost`. */
  corroborationContribution: number;
  /** `baseContribution + tierContribution + corroborationContribution` (multiplies confidence). */
  multiplier: number;
  /** The clamped composite — identical to `edgeScore(v)`; 0 for a non-servable verdict. */
  composite: number;
  /** Serving band — identical to `servingBand(v)`. */
  band: 'high' | 'mid' | 'hold';
}

/**
 * Decompose an edge's rolled-up trust into the parts that reconstruct the composite. Pure — the single
 * source of truth `edgeScore` / `servingBand` both read, so they can never disagree. Non-servable
 * verdicts short-circuit to composite 0 / band 'hold' (the structural parts are still reported so a
 * reviewer sees the would-be breakdown, but they never contribute a served score).
 */
export function edgeScoreComponents(v: EdgeVerification): EdgeScoreComponents {
  const servable = SERVABLE_VERDICTS.has(v.verdict);
  const confidence = v.confidence;
  const tierWeight = v.evidenceTier / 5; // 0.2 (mechanistic) … 1.0 (meta-analysis)
  const net = v.corroboration.supporting - v.corroboration.contradicting;
  const corroborationBoost =
    net <= 0 ? 0 : Math.min(net, EDGE_WEIGHTS.corroborationSaturation) / EDGE_WEIGHTS.corroborationSaturation;

  const baseContribution = EDGE_WEIGHTS.base;
  const tierContribution = EDGE_WEIGHTS.tier * tierWeight;
  const corroborationContribution = EDGE_WEIGHTS.corroboration * corroborationBoost;
  const multiplier = baseContribution + tierContribution + corroborationContribution;

  // Confidence dominates; design strength and corroboration shade it. Clamped to [0, 1]. A non-servable
  // verdict scores 0 (never served) — same short-circuit as the pre-refactor edgeScore/servingBand.
  const composite = servable ? Math.max(0, Math.min(1, confidence * multiplier)) : 0;
  const band: 'high' | 'mid' | 'hold' = !servable
    ? 'hold'
    : composite >= EDGE_GATES.high
      ? 'high'
      : composite >= EDGE_GATES.mid
        ? 'mid'
        : 'hold';

  return {
    confidence,
    tierWeight,
    corroborationBoost,
    baseContribution,
    tierContribution,
    corroborationContribution,
    multiplier,
    composite,
    band,
  };
}

/**
 * Rolled-up trust for an edge, 0..1 — the value the graph ranks and gates on. Combines the verifier's
 * calibrated `confidence` with structural signals (study-design tier, net corroboration). Thin reader
 * of `edgeScoreComponents` so the composite and its reported breakdown share one source of truth.
 */
export function edgeScore(v: EdgeVerification): number {
  return edgeScoreComponents(v).composite;
}

/** Serving band for an edge — drives whether/how the brain surfaces it. */
export function servingBand(v: EdgeVerification): 'high' | 'mid' | 'hold' {
  return edgeScoreComponents(v).band;
}

/** True if the edge may be surfaced to users at all (high or mid band). */
export function isServable(v: EdgeVerification): boolean {
  return v.status === 'active' && servingBand(v) !== 'hold';
}

/** Active, servable edges, ranked by trust (highest first). */
export function servableEdges(edges: readonly VerifiedEdge[]): VerifiedEdge[] {
  return edges
    .filter((e) => isServable(e.verification))
    .sort((a, b) => edgeScore(b.verification) - edgeScore(a.verification));
}

/**
 * Why an edge is flagged for human review. Codes rather than prose so callers (nao's review queue,
 * the gap ledger) can route on the reason instead of re-deriving it.
 */
export type ReviewReason =
  /** The verifier found independent evidence pointing the other way. */
  | 'verifier-contradicted'
  /** Grounded and servable-in-principle, but scoring below the serving floor. */
  | 'grounded-but-held'
  /** B-BR10: the USER'S OWN data moved opposite to what this edge claims. */
  | 'personal-data-contradiction'
  /** R4-U4: the edge's provenance/trust chain is incomplete, so it cannot be trusted as-is. */
  | 'untrusted-provenance';

/**
 * Review signals the CALLER observes that the verification record cannot know by itself.
 *
 * B-BR10 exists because the serving layer's `contradiction` branch — a gate-passing personal
 * signal moving OPPOSITE to a servable edge — was computed in the insight composer and then
 * dropped on the floor: it wrote a gap event but never reached `needsReview()`, so an edge the
 * user's own data disagreed with was never queued for a human. Passing those edge ids here wires
 * that branch into the shared review path.
 */
export interface ReviewSignals {
  /** Edge ids whose claim is opposed by a gate-passing personal signal (composer `contradiction`). */
  personalContradictions?: readonly string[];
  /** Edge ids whose artifact-trust or provenance chain failed (see provenance.trustFailures). */
  untrustedEdgeIds?: readonly string[];
}

/**
 * Every reason this edge needs human review — empty when it needs none.
 *
 * `uncertain` is deliberately NOT a reason: it typically means re-run the verifier with retrieval,
 * which is a job to schedule, not a judgment to ask a human for.
 */
export function reviewReasons(edge: VerifiedEdge, signals: ReviewSignals = {}): ReviewReason[] {
  const reasons: ReviewReason[] = [];
  const v = edge.verification;
  if (v.verdict === 'contradicted') reasons.push('verifier-contradicted');
  if (SERVABLE_VERDICTS.has(v.verdict) && servingBand(v) === 'hold') reasons.push('grounded-but-held');
  if (signals.personalContradictions?.includes(edge.claim.edgeId)) {
    reasons.push('personal-data-contradiction');
  }
  if (signals.untrustedEdgeIds?.includes(edge.claim.edgeId)) reasons.push('untrusted-provenance');
  return reasons;
}

/**
 * Edges needing human review or a re-run: contradicted (suppress + flag the source), grounded but
 * low-scoring, contradicted by the user's own data (B-BR10), or carrying a broken provenance
 * chain. `uncertain` typically means re-run the verifier with retrieval, not human review.
 *
 * `signals` is optional so every existing caller keeps its exact behaviour; supplying it is what
 * wires the serving layer's contradiction branch in.
 */
export function needsReview(
  edges: readonly VerifiedEdge[],
  signals: ReviewSignals = {},
): VerifiedEdge[] {
  return edges.filter((e) => reviewReasons(e, signals).length > 0);
}
