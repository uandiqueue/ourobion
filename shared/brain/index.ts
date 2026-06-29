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
 * Rolled-up trust for an edge, 0..1 — the value the graph ranks and gates on. Combines the verifier's
 * calibrated `confidence` with structural signals (study-design tier, net corroboration). Kept as a
 * pure function so it is reproducible and unit-testable.
 */
export function edgeScore(v: EdgeVerification): number {
  if (!SERVABLE_VERDICTS.has(v.verdict)) return 0;
  const tierWeight = v.evidenceTier / 5; // 0.2 (mechanistic) … 1.0 (meta-analysis)
  const net = v.corroboration.supporting - v.corroboration.contradicting;
  const corroborationBoost = net <= 0 ? 0 : Math.min(net, 3) / 3; // saturates at 3 net sources
  // Confidence dominates; design strength and corroboration shade it. Clamped to [0, 1].
  const raw = v.confidence * (0.6 + 0.25 * tierWeight + 0.15 * corroborationBoost);
  return Math.max(0, Math.min(1, raw));
}

/** Serving band for an edge — drives whether/how the brain surfaces it. */
export function servingBand(v: EdgeVerification): 'high' | 'mid' | 'hold' {
  if (!SERVABLE_VERDICTS.has(v.verdict)) return 'hold';
  const s = edgeScore(v);
  if (s >= EDGE_GATES.high) return 'high';
  if (s >= EDGE_GATES.mid) return 'mid';
  return 'hold';
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
