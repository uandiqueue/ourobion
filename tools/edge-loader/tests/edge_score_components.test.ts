// F3 (RU2 guardrail) + C15 tests: edgeScoreComponents is the single source of truth for edgeScore /
// servingBand, the weights come from EDGE_WEIGHTS, the composite is still byte-identical to the
// pre-refactor formula — and, since C15, the serving BAND is decided by singlePaperGate alone, so
// corroboration / study-design tier / venue impact tier / other-paper scopeCheck can no longer
// withhold a card.
//
// Runs against the REAL shared/brain re-exported by ../lib/artifacts.mjs (shared/ itself only has an
// echo test stub), so this is the behavioural surface for the change.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { brain } from '../lib/artifacts.mjs';

const { edgeScore, edgeScoreComponents, servingBand, singlePaperGate, EDGE_WEIGHTS, EDGE_GATES, SINGLE_PAPER_GATE } =
  brain;

/**
 * A minimal EdgeVerification carrying the fields edgeScore/edgeScoreComponents/singlePaperGate read.
 * The single-paper checks default to FAITHFUL so a case can turn exactly one of them off, and
 * `scopeCheck.mismatch` defaults to TRUE — the other-paper scope signal must never move the band.
 * The scoring functions are pure and never validate, so this is sufficient.
 */
function mk(
  verdict: string,
  evidenceTier: number,
  confidence: number,
  supporting: number,
  contradicting: number,
  overrides: Record<string, unknown> = {},
) {
  return {
    verdict,
    evidenceTier,
    confidence,
    corroboration: { supporting, contradicting },
    quoteCheck: { spansFound: 2, spansTotal: 2, allPresent: true },
    directionCheck: { matchesClaim: true },
    claimKindCheck: { matchesClaim: true, supportedKind: 'correlational' },
    effectSizeCheck: { matchesClaim: true, extractedSize: 1.2 },
    scopeCheck: { mismatch: true, supportedPopulation: 'a narrower population than claimed' },
    ...overrides,
  } as any;
}

/**
 * The exact pre-refactor formula, transcribed verbatim from the shipped `edgeScore`
 * (shared/brain/index.ts before F3). This is the reference the refactor must reproduce
 * bit-for-bit — the regression oracle. C15 did NOT touch it: the composite still ranks.
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

// A table spanning: servable high, servable mid, servable→hold (low confidence), non-servable
// verdicts, corroboration saturation (net > cap), net-zero / net-negative corroboration, clamp.
const TABLE = [
  mk('supported', 5, 0.9, 3, 0), // conf .9 → high (fixture "newest")
  mk('supported', 4, 0.85, 2, 0), // conf .85 → high; composite .765
  mk('partial', 3, 0.7, 1, 0), // conf .7 → mid
  mk('supported', 1, 0.55, 0, 0), // weakest structural signals, faithful → still mid (C15)
  mk('supported', 5, 1.0, 3, 0), // clamp boundary: multiplier 1.0 × conf 1.0 = 1.0
  mk('supported', 5, 1.0, 10, 0), // corroboration saturates at 3 → identical to net=3
  mk('supported', 3, 0.8, 2, 2), // net 0 → corroborationBoost 0
  mk('supported', 3, 0.8, 1, 3), // net negative → corroborationBoost 0
  mk('supported', 5, 0.4, 3, 0), // faithful but under the mid confidence floor → hold
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
    assert.equal(c.band, c.gate.band, 'the reported band is exactly the gate band');
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
    assert.deepEqual(c.gate.failures, ['irrelevant-verdict']);
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

// ── (c) regression: the RANK is untouched by C15 ────────────────────────────────────────────────────

test('REGRESSION: edgeScore is byte-identical to the pre-refactor formula for the whole table', () => {
  for (const v of TABLE) {
    assert.equal(edgeScore(v), referenceScore(v), `edgeScore must equal the known formula for ${v.verdict}`);
  }
});

test('REGRESSION: the documented fixture composites are exactly reproduced', () => {
  // The same three hand-computed values asserted in edge_artifacts.test.ts — proven here to survive
  // both the F3 config-object refactor and the C15 gate change unchanged.
  assert.ok(Math.abs(edgeScore(mk('supported', 5, 0.9, 3, 0)) - 0.9) < 1e-12);
  assert.ok(Math.abs(edgeScore(mk('supported', 4, 0.85, 2, 0)) - 0.765) < 1e-12);
  assert.ok(Math.abs(edgeScore(mk('partial', 3, 0.7, 1, 0)) - 0.56) < 1e-12);
});

// ── (d) C15: the SERVING band is single-paper faithfulness + a confidence floor ─────────────────────

test('C15: SINGLE_PAPER_GATE holds the documented shipped values', () => {
  assert.deepEqual([...SINGLE_PAPER_GATE.relevantVerdicts], ['supported', 'partial']);
  assert.equal(SINGLE_PAPER_GATE.requireQuoteSpansPresent, true);
  assert.equal(SINGLE_PAPER_GATE.requireDirectionMatch, true);
  assert.equal(SINGLE_PAPER_GATE.requireClaimKindMatch, true);
  assert.equal(SINGLE_PAPER_GATE.requireEffectSizeMatch, true);
  assert.equal(SINGLE_PAPER_GATE.confidenceFloors, EDGE_GATES);
  assert.equal(EDGE_GATES.high, 0.8);
  assert.equal(EDGE_GATES.mid, 0.5);
  assert.deepEqual(
    [...SINGLE_PAPER_GATE.nonGatingSignals].sort(),
    ['corroboration', 'evidenceTier', 'impactTier', 'scopeCheck'],
  );
});

test('C15: the band floors read CONFIDENCE, not the composite', () => {
  // conf .55, tier 1, no corroboration ⇒ composite .55 * (.6 + .25*.2) = .3575, which the pre-C15
  // gate banded `hold`.
  const thin = mk('supported', 1, 0.55, 0, 0);
  assert.ok(Math.abs(edgeScore(thin) - 0.3575) < 1e-12, 'composite is still the low rank value');
  assert.equal(servingBand(thin), 'mid', 'but a faithful single-paper claim serves');

  // conf .85 with the same thin structure ⇒ composite .595 (< EDGE_GATES.high) but band `high`.
  const confident = mk('supported', 1, 0.85, 0, 0);
  assert.ok(edgeScore(confident) < EDGE_GATES.high);
  assert.equal(servingBand(confident), 'high');
});

test('C15: each single-paper faithfulness check individually withholds the card', () => {
  const cases: Array<[string, Record<string, unknown>, string]> = [
    ['quote gate', { quoteCheck: { spansFound: 1, spansTotal: 2, allPresent: false } }, 'quote-gate-failed'],
    ['direction', { directionCheck: { matchesClaim: false } }, 'direction-mismatch'],
    ['claim kind', { claimKindCheck: { matchesClaim: false, supportedKind: 'correlational' } }, 'claim-kind-mismatch'],
    ['effect size', { effectSizeCheck: { matchesClaim: false, extractedSize: null } }, 'effect-size-mismatch'],
  ];
  for (const [label, override, expected] of cases) {
    // Maximally well-corroborated otherwise — nothing else can rescue an unfaithful claim.
    const v = mk('supported', 5, 0.99, 9, 0, override);
    const g = singlePaperGate(v);
    assert.equal(g.passed, false, `${label} must withhold`);
    assert.equal(g.faithful, false);
    assert.deepEqual(g.failures, [expected]);
    assert.equal(servingBand(v), 'hold');
  }
});

test('C15: a faithful claim below the mid confidence floor holds, and says so', () => {
  const g = singlePaperGate(mk('supported', 5, 0.4, 3, 0));
  assert.equal(g.faithful, true, 'the paper is faithfully represented');
  assert.equal(g.passed, false);
  assert.deepEqual(g.failures, ['below-confidence-floor']);
});

test('C15: corroboration, tiers and other-paper scope are DEMOTED — they cannot withhold a card', () => {
  // The worst possible other-paper picture: zero supporting, three contradicting, the weakest
  // study design, and a population mismatch against the retrieved papers. Pre-C15 this banded
  // `hold` at composite 0.585; the caveat producer (#300 §E) is now the only thing carrying it.
  const bleak = mk('partial', 1, 0.9, 0, 3);
  assert.equal(bleak.scopeCheck.mismatch, true);
  assert.equal(servingBand(bleak), 'high');
  assert.deepEqual(singlePaperGate(bleak).failures, []);
});

test('C15: every nonGatingSignal is provably inert — mutating it never moves the band', () => {
  const mutations: Record<string, Array<Record<string, unknown>>> = {
    corroboration: [{ corroboration: { supporting: 9, contradicting: 0 } }, { corroboration: { supporting: 0, contradicting: 9 } }],
    evidenceTier: [{ evidenceTier: 1 }, { evidenceTier: 5 }],
    // impactTier lives on the citations, never on the verification — carrying it here proves the
    // gate cannot read it even when a record volunteers one.
    impactTier: [{ impactTier: 'preprint' }, { impactTier: 'high' }],
    scopeCheck: [
      { scopeCheck: { mismatch: true, supportedPopulation: 'someone else entirely' } },
      { scopeCheck: { mismatch: false, supportedPopulation: null } },
    ],
  };
  for (const signal of SINGLE_PAPER_GATE.nonGatingSignals) {
    const variants = mutations[signal];
    assert.ok(variants, `nonGatingSignals lists '${signal}' but this test has no mutation for it`);
    const bands = new Set(variants!.map((o) => servingBand(mk('partial', 3, 0.7, 1, 0, o))));
    assert.equal(bands.size, 1, `'${signal}' moved the serving band — it is gating again`);
    assert.deepEqual([...bands], ['mid']);
  }
});
