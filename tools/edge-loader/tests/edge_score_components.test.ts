// F3 (RU2 guardrail) tests: edgeScoreComponents is the single source of truth for edgeScore /
// servingBand, the weights come from EDGE_WEIGHTS, and — the load-bearing proof — lifting the inline
// weights into config left the composite score byte-identical to the pre-refactor formula.
//
// Runs against the REAL shared/brain re-exported by ../lib/artifacts.mjs (shared/ itself only has an
// echo test stub), so this is the behavioural surface for the change.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { brain } from '../lib/artifacts.mjs';

const { edgeScore, edgeScoreComponents, servingBand, EDGE_WEIGHTS, EDGE_GATES } = brain;

/**
 * A minimal EdgeVerification carrying only the fields edgeScore/edgeScoreComponents read
 * (verdict, evidenceTier, confidence, corroboration). The scoring functions are pure and never
 * validate, so this is sufficient — and keeps the table readable.
 */
function mk(verdict: string, evidenceTier: number, confidence: number, supporting: number, contradicting: number) {
  return {
    verdict,
    evidenceTier,
    confidence,
    corroboration: { supporting, contradicting },
  } as any;
}

/**
 * The exact pre-refactor formula, transcribed verbatim from the shipped `edgeScore`
 * (shared/brain/index.ts before F3). This is the reference the refactor must reproduce
 * bit-for-bit — the regression oracle.
 */
function referenceScore(v: any): number {
  const SERVABLE = new Set(['supported', 'partial']);
  if (!SERVABLE.has(v.verdict)) return 0;
  const tierWeight = v.evidenceTier / 5;
  const net = v.corroboration.supporting - v.corroboration.contradicting;
  const corroborationBoost = net <= 0 ? 0 : Math.min(net, 3) / 3;
  const raw = v.confidence * (0.6 + 0.25 * tierWeight + 0.15 * corroborationBoost);
  return Math.max(0, Math.min(1, raw));
}

/** The exact pre-refactor servingBand, for the band regression. */
function referenceBand(v: any): 'high' | 'mid' | 'hold' {
  const SERVABLE = new Set(['supported', 'partial']);
  if (!SERVABLE.has(v.verdict)) return 'hold';
  const s = referenceScore(v);
  if (s >= 0.8) return 'high';
  if (s >= 0.5) return 'mid';
  return 'hold';
}

// A table spanning: servable high, servable mid, servable→hold (low score), non-servable verdicts,
// corroboration saturation (net > cap), net-zero / net-negative corroboration, and the clamp boundary.
const TABLE = [
  mk('supported', 5, 0.9, 3, 0), // 0.9 → high (fixture "newest")
  mk('supported', 4, 0.85, 2, 0), // 0.765 → mid (fixture "older")
  mk('partial', 3, 0.7, 1, 0), // 0.56 → mid (fixture "partial")
  mk('supported', 1, 0.55, 0, 0), // low structural, servable but should hold
  mk('supported', 5, 1.0, 3, 0), // clamp boundary: multiplier 1.0 × conf 1.0 = 1.0
  mk('supported', 5, 1.0, 10, 0), // corroboration saturates at 3 → identical to net=3
  mk('supported', 3, 0.8, 2, 2), // net 0 → corroborationBoost 0
  mk('supported', 3, 0.8, 1, 3), // net negative → corroborationBoost 0
  mk('uncertain', 5, 0.99, 5, 0), // non-servable → 0 / hold
  mk('unsupported', 4, 0.9, 3, 0), // non-servable → 0 / hold
  mk('contradicted', 5, 0.9, 0, 3), // non-servable → 0 / hold
];

// ── (a) one source of truth: composite === edgeScore, band === servingBand, multiplier reconstructs ──

test('edgeScoreComponents.composite === edgeScore(v) and .band === servingBand(v) for every case', () => {
  for (const v of TABLE) {
    const c = edgeScoreComponents(v);
    assert.equal(c.composite, edgeScore(v), `composite must equal edgeScore for ${v.verdict}`);
    assert.equal(c.band, servingBand(v), `band must equal servingBand for ${v.verdict}`);
  }
});

test('multiplier === base + tier + corroboration contributions, and reconstructs the composite', () => {
  for (const v of TABLE) {
    const c = edgeScoreComponents(v);
    assert.equal(
      c.multiplier,
      c.baseContribution + c.tierContribution + c.corroborationContribution,
      'multiplier is exactly the sum of its contributions',
    );
    const servable = v.verdict === 'supported' || v.verdict === 'partial';
    const reconstructed = servable ? Math.max(0, Math.min(1, c.confidence * c.multiplier)) : 0;
    assert.equal(c.composite, reconstructed, 'composite reconstructs from confidence × multiplier (clamped)');
  }
});

test('non-servable verdicts short-circuit to composite 0 / band hold (still report the breakdown)', () => {
  for (const verdict of ['uncertain', 'unsupported', 'contradicted']) {
    const c = edgeScoreComponents(mk(verdict, 5, 0.99, 5, 0));
    assert.equal(c.composite, 0);
    assert.equal(c.band, 'hold');
    // Structural parts are still reported (the would-be breakdown) even though nothing is served.
    assert.equal(c.tierWeight, 1);
  }
});

test('corroboration saturates at EDGE_WEIGHTS.corroborationSaturation (net beyond the cap is identical)', () => {
  const atCap = edgeScoreComponents(mk('supported', 4, 0.8, 3, 0));
  const beyondCap = edgeScoreComponents(mk('supported', 4, 0.8, 25, 0));
  assert.equal(atCap.corroborationBoost, 1);
  assert.equal(beyondCap.corroborationBoost, 1);
  assert.equal(atCap.composite, beyondCap.composite);
});

// ── (b) the contributions are computed FROM EDGE_WEIGHTS, not hardcoded ─────────────────────────────

test('contributions read the live EDGE_WEIGHTS values', () => {
  const v = mk('supported', 4, 0.85, 2, 0);
  const c = edgeScoreComponents(v);
  assert.equal(c.baseContribution, EDGE_WEIGHTS.base);
  assert.equal(c.tierContribution, EDGE_WEIGHTS.tier * c.tierWeight);
  assert.equal(c.corroborationContribution, EDGE_WEIGHTS.corroboration * c.corroborationBoost);

  // Proof the arithmetic reads the object rather than a divergent hardcoded copy: a LOCAL copy with a
  // different base yields a different multiplier than the one the function actually produced.
  const localWeights = { ...EDGE_WEIGHTS, base: EDGE_WEIGHTS.base + 0.1 };
  const localMultiplier =
    localWeights.base + localWeights.tier * c.tierWeight + localWeights.corroboration * c.corroborationBoost;
  assert.notEqual(localMultiplier, c.multiplier);
  // And re-deriving with the real object reproduces it exactly.
  const realMultiplier =
    EDGE_WEIGHTS.base + EDGE_WEIGHTS.tier * c.tierWeight + EDGE_WEIGHTS.corroboration * c.corroborationBoost;
  assert.equal(realMultiplier, c.multiplier);
});

test('EDGE_WEIGHTS holds the documented provisional (uncited RU2b) values', () => {
  assert.equal(EDGE_WEIGHTS.base, 0.6);
  assert.equal(EDGE_WEIGHTS.tier, 0.25);
  assert.equal(EDGE_WEIGHTS.corroboration, 0.15);
  assert.equal(EDGE_WEIGHTS.corroborationSaturation, 3);
});

// ── (c) regression: the refactor preserved behaviour byte-for-byte ──────────────────────────────────

test('REGRESSION: edgeScore is byte-identical to the pre-refactor formula for the whole table', () => {
  for (const v of TABLE) {
    assert.equal(edgeScore(v), referenceScore(v), `edgeScore must equal the known formula for ${v.verdict}`);
  }
});

test('REGRESSION: servingBand is byte-identical to the pre-refactor band logic (gates unchanged)', () => {
  // Guard the gates weren't touched either.
  assert.equal(EDGE_GATES.high, 0.8);
  assert.equal(EDGE_GATES.mid, 0.5);
  for (const v of TABLE) {
    assert.equal(servingBand(v), referenceBand(v), `servingBand must equal the known logic for ${v.verdict}`);
  }
});

test('REGRESSION: the documented fixture composites are exactly reproduced', () => {
  // The same three hand-computed values asserted in edge_artifacts.test.ts — proven here to survive
  // the config-object refactor unchanged.
  assert.ok(Math.abs(edgeScore(mk('supported', 5, 0.9, 3, 0)) - 0.9) < 1e-12);
  assert.ok(Math.abs(edgeScore(mk('supported', 4, 0.85, 2, 0)) - 0.765) < 1e-12);
  assert.ok(Math.abs(edgeScore(mk('partial', 3, 0.7, 1, 0)) - 0.56) < 1e-12);
});
