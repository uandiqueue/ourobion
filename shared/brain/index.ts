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

/**
 * Deterministic edge identity. Synthesis and verification both address an edge by this key, so a
 * re-run updates the same edge instead of duplicating it. Mirrors a metric's canonical `key`.
 */
export function relationKey(subject: string, relation: RelationKind, object: string): string {
  return `${subject}|${relation}|${object}`;
}

/** Gating thresholds — the confidence floor an edge must clear to be served at each band. */
export const EDGE_GATES = {
  /** ≥ this and well-evidenced → served plainly. */
  high: 0.8,
  /** ≥ this → served with a "limited evidence" qualifier. */
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
 * Edges needing human review or a re-run: contradicted (suppress + flag the source), or grounded but
 * low-scoring. `uncertain` typically means re-run the verifier with retrieval, not human review.
 */
export function needsReview(edges: readonly VerifiedEdge[]): VerifiedEdge[] {
  return edges.filter(
    (e) =>
      e.verification.verdict === 'contradicted' ||
      (SERVABLE_VERDICTS.has(e.verification.verdict) && servingBand(e.verification) === 'hold'),
  );
}
