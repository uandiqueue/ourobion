/**
 * R4-U4 / O27 + O38 · Scientific provenance + trust-posture tests — node:test via tsx, NO
 * network, NO live LLM/provider calls, NO DB. Frozen fixtures inline.
 *
 * Imports go STRAIGHT to shared/brain/provenance.ts and shared/brain/trust_labels.ts (with
 * explicit .ts extensions, the same spelling those files use to import each other and the same
 * spelling render.ts/composer.ts use) rather than through shared/brain/index.ts: index.ts's
 * `export * from './provenance'` / `export * from './trust_labels'` are extensionless specifiers
 * that tsx's module resolver does not propagate through a star re-export at runtime (confirmed by
 * probing `Object.keys()` on the three modules — index.ts's own top-level exports, e.g.
 * `reviewReasons`/`needsReview`, resolve fine; the re-exported provenance/trust_labels names do
 * not). Going straight to the defining module sidesteps that resolver quirk entirely and matches
 * the render.ts/composer.ts import style already established in this repo.
 *
 * Covers (spec sections mirrored 1:1 below):
 *  1. SOURCE-KIND vs VERIFIER-KIND SEMANTIC AGREEMENT (claimKindPosture / effectiveClaimKind)
 *  2. STUDY-DESIGN-TO-TIER AGREEMENT (studyDesignTierLabel + B-SCI2 vocabulary)
 *  3. EXACT-QUOTE (verifyExactQuote, offset-exact semantics)
 *  4. FOREIGN-PAPER (verifyExactQuote + provenanceGaps 'quote-cites-foreign-paper')
 *  5. PROVENANCE-CHAIN COMPLETENESS (provenanceGaps / isProvenanceComplete)
 *  6. FAIL-CLOSED TRUST (trustFailures / isTrustedForServing / assertTrustedForServing)
 *  7. REVISION-BOUND DISPOSITION — B-BR7 (resolveDisposition)
 *  8. B-BR10 (needsReview / reviewReasons)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  claimKindPosture,
  trustFailures,
  isTrustedForServing,
  assertTrustedForServing,
  provenanceGaps,
  isProvenanceComplete,
  verifyExactQuote,
  resolveDisposition,
  type ProvenanceChain,
  type TrustInputs,
  type ExpertVerdictRecord,
} from '../../../shared/brain/provenance.ts';
import {
  CLAIM_KIND_LADDER,
  effectiveClaimKind,
  STUDY_DESIGN_TIER_NAME,
  STUDY_DESIGN_TIER_LABELS,
  SUPPORT_RANK_NAME,
  SUPPORT_RANK_DISCLOSURE,
  CERTAINTY_NOT_ASSESSED,
  studyDesignTierLabel,
  type TrustLabelClaimKind,
  type TrustLabelStudyDesignTier,
} from '../../../shared/brain/trust_labels.ts';
import { reviewReasons, needsReview } from '../../../shared/brain/index.ts';
import type {
  ArtifactRef,
  ModelAttestation,
  EdgeVerification,
  RelationshipClaim,
  VerifiedEdge,
} from '../../../shared/brain/relationships.ts';

// ─── shared fixtures ─────────────────────────────────────────────────────────

const SHA = (byte: string): string => `sha256:${byte.repeat(64)}`;

function artifactRef(over: Partial<ArtifactRef> = {}): ArtifactRef {
  return { revision: 'r1', contentHash: SHA('a'), posture: 'live', ...over };
}

function attestation(over: Partial<ModelAttestation> = {}): ModelAttestation {
  return {
    returnedModel: 'test-model',
    returnedVersion: 'v1',
    family: 'family-a',
    decorrelated: true,
    attested: true,
    ...over,
  };
}

function claim(over: Partial<RelationshipClaim> = {}): RelationshipClaim {
  return {
    edgeId: 'a|increases|b',
    subject: 'a',
    object: 'b',
    relation: 'increases',
    claimKind: 'causal',
    effect: { size: null, unit: null, ci: null },
    population: null,
    citations: [],
    quoteSpans: [],
    derivation: 'fixture derivation',
    synthesisModel: 'test-model',
    promptVersion: 'v1',
    synthesisedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

function verification(over: Partial<EdgeVerification> = {}): EdgeVerification {
  return {
    edgeId: 'a|increases|b',
    verdict: 'supported',
    quoteCheck: { spansFound: 0, spansTotal: 0, allPresent: true },
    independentRetrieval: { performed: true, sources: [] },
    corroboration: { supporting: 1, contradicting: 0 },
    directionCheck: { matchesClaim: true },
    claimKindCheck: { matchesClaim: true, supportedKind: 'causal' },
    scopeCheck: { mismatch: false, supportedPopulation: null },
    effectSizeCheck: { matchesClaim: true, extractedSize: null },
    evidenceTier: 4,
    confidence: 0.9,
    dqs: { weight: 0.9 },
    verifierModel: 'test-verifier',
    promptVersion: 'v1',
    verifiedAt: '2026-01-01T00:00:00.000Z',
    status: 'active',
    ...over,
  };
}

function verifiedEdge(over: Partial<VerifiedEdge> = {}): VerifiedEdge {
  return { claim: claim(), verification: verification(), ...over };
}

// ─── 1 · SOURCE-KIND vs VERIFIER-KIND SEMANTIC AGREEMENT ────────────────────

test('claimKindPosture/effectiveClaimKind: the verifier supportedKind CAPS every pair on the ladder', () => {
  // The ladder is total order correlational(0) < mechanistic(1) < causal(2). Walk every pair and
  // assert the effective kind is the WEAKER of the two, per the ladder rank, not just the pairs
  // named in the spec.
  const rank = new Map(CLAIM_KIND_LADDER.map((k, i) => [k, i]));
  for (const claimed of CLAIM_KIND_LADDER) {
    for (const supported of CLAIM_KIND_LADDER) {
      const posture = claimKindPosture(
        { claimKind: claimed },
        { claimKindCheck: { matchesClaim: claimed === supported, supportedKind: supported } },
      );
      const expected = rank.get(supported)! < rank.get(claimed)! ? supported : claimed;
      assert.equal(posture.effective, expected, `${claimed}+${supported}`);
      assert.equal(posture.claimed, claimed);
      assert.equal(posture.supported, supported);
      assert.equal(posture.downgraded, posture.effective !== claimed, `${claimed}+${supported} downgraded flag`);
    }
  }
});

test('claimKindPosture: causal claim + correlational verifier => correlational, downgraded === true', () => {
  const posture = claimKindPosture(
    { claimKind: 'causal' },
    { claimKindCheck: { matchesClaim: false, supportedKind: 'correlational' } },
  );
  assert.equal(posture.effective, 'correlational');
  assert.equal(posture.downgraded, true);
});

test('claimKindPosture: equal claimed/supported kinds are never downgraded (every ladder rung)', () => {
  for (const kind of CLAIM_KIND_LADDER) {
    const posture = claimKindPosture(
      { claimKind: kind },
      { claimKindCheck: { matchesClaim: true, supportedKind: kind } },
    );
    assert.equal(posture.effective, kind);
    assert.equal(posture.downgraded, false, `${kind} vs itself must not downgrade`);
  }
});

// ─── 2 · STUDY-DESIGN-TO-TIER AGREEMENT ─────────────────────────────────────

test('studyDesignTierLabel: every EvidenceTier 1..5 has a distinct label', () => {
  const tiers: TrustLabelStudyDesignTier[] = [1, 2, 3, 4, 5];
  const labels = tiers.map((t) => studyDesignTierLabel(t));
  assert.equal(labels.length, 5);
  assert.equal(new Set(labels).size, 5, 'labels must be pairwise distinct');
  for (const label of labels) assert.ok(label.length > 0);
});

test('studyDesignTierLabel: throws on an out-of-ladder tier', () => {
  // @ts-expect-error deliberately out of the 1..5 ladder to prove the fail-loud path.
  assert.throws(() => studyDesignTierLabel(6), /unknown tier/);
  // @ts-expect-error same, at the other boundary.
  assert.throws(() => studyDesignTierLabel(0), /unknown tier/);
});

test('B-SCI2 vocabulary: the ladder is never called "evidence tier" anywhere it is named', () => {
  assert.equal(STUDY_DESIGN_TIER_NAME, 'Study-design tier');
  const haystacks = [STUDY_DESIGN_TIER_NAME, ...Object.values(STUDY_DESIGN_TIER_LABELS)];
  for (const text of haystacks) {
    assert.doesNotMatch(text.toLowerCase(), /evidence tier/, `"${text}" must not say "evidence tier"`);
  }
});

test('B-SCI2 vocabulary: SUPPORT_RANK_NAME/SUPPORT_RANK_DISCLOSURE avoid "confidence"/"certain" — ' +
  'REAL DEFECT: SUPPORT_RANK_DISCLOSURE currently fails this (see report)', () => {
  assert.doesNotMatch(SUPPORT_RANK_NAME.toLowerCase(), /confidence/);
  assert.doesNotMatch(SUPPORT_RANK_NAME.toLowerCase(), /certain/);
  assert.doesNotMatch(SUPPORT_RANK_DISCLOSURE.toLowerCase(), /confidence/);
  // KNOWN, REPORTED DEFECT (do not weaken to pass): SUPPORT_RANK_DISCLOSURE's own text says
  // "...not a score of how certain a finding is", which is exactly the word this assertion the
  // spec requires be absent outside CERTAINTY_NOT_ASSESSED. Left failing on purpose — see the
  // session report for the exact string and file/line.
  assert.doesNotMatch(SUPPORT_RANK_DISCLOSURE.toLowerCase(), /certain/);
  // The one place "certain" belongs (B-SCI2 rule 4's dedicated disclosure) legitimately has it.
  assert.match(CERTAINTY_NOT_ASSESSED.toLowerCase(), /certain/);
});

// ─── 3 · EXACT-QUOTE ─────────────────────────────────────────────────────────

const QUOTE = 'The quick brown fox jumps';
// The quote appears TWICE in this text — once at its "true" location, once again later. The
// offset-exact check must key off the RECORDED offsets, not "does this string occur somewhere".
const CANONICAL_TEXT = `Intro. ${QUOTE}. Closer text has ${QUOTE} again elsewhere.`;
const TRUE_START = CANONICAL_TEXT.indexOf(QUOTE);
const TRUE_END = TRUE_START + QUOTE.length;

const PAPER_A = { paperId: 'paper:a', canonicalText: CANONICAL_TEXT };

test('verifyExactQuote: passes when the quote sits at its recorded offsets verbatim', () => {
  const span = { paperId: 'paper:a', quote: QUOTE, charStart: TRUE_START, charEnd: TRUE_END };
  assert.deepEqual(verifyExactQuote(span, PAPER_A, ['paper:a']), { ok: true });
});

test("verifyExactQuote: fails 'text-mismatch' when offsets point elsewhere, even though the quote " +
  'occurs ELSEWHERE in the paper verbatim (the whole point of offset-exact checking)', () => {
  // charStart/charEnd point at "Intro. The quick brown fo" (wrong text), NOT at TRUE_START/END —
  // even though QUOTE genuinely occurs later in CANONICAL_TEXT, a coincidental elsewhere-match
  // must not paper over wrong recorded offsets.
  const wrongStart = 0;
  const wrongEnd = QUOTE.length;
  assert.notEqual(CANONICAL_TEXT.slice(wrongStart, wrongEnd), QUOTE);
  assert.ok(CANONICAL_TEXT.includes(QUOTE), 'sanity: the quote does occur in the paper');
  const span = { paperId: 'paper:a', quote: QUOTE, charStart: wrongStart, charEnd: wrongEnd };
  const result = verifyExactQuote(span, PAPER_A, ['paper:a']);
  assert.equal(result.ok, false);
  assert.equal(result.failure, 'text-mismatch');
});

test("verifyExactQuote: fails 'offsets-missing' on null offsets", () => {
  const span = { paperId: 'paper:a', quote: QUOTE, charStart: null, charEnd: null };
  const result = verifyExactQuote(span, PAPER_A, ['paper:a']);
  assert.equal(result.ok, false);
  assert.equal(result.failure, 'offsets-missing');
});

test("verifyExactQuote: fails 'offsets-out-of-range' on out-of-bounds offsets", () => {
  const beyondEnd = { paperId: 'paper:a', quote: 'x', charStart: 0, charEnd: CANONICAL_TEXT.length + 500 };
  const negativeStart = { paperId: 'paper:a', quote: 'x', charStart: -5, charEnd: 5 };
  const invertedRange = { paperId: 'paper:a', quote: 'x', charStart: 10, charEnd: 10 };
  for (const span of [beyondEnd, negativeStart, invertedRange]) {
    const result = verifyExactQuote(span, PAPER_A, ['paper:a']);
    assert.equal(result.ok, false, JSON.stringify(span));
    assert.equal(result.failure, 'offsets-out-of-range', JSON.stringify(span));
  }
});

// ─── 4 · FOREIGN-PAPER ───────────────────────────────────────────────────────

test("verifyExactQuote: rejects a span verified against a paper the claim does not cite " +
  "('paper-not-cited'), even when the quote genuinely occurs verbatim in that foreign paper", () => {
  const foreignText = `Foreign paper text contains ${QUOTE} too, verbatim.`;
  const foreignStart = foreignText.indexOf(QUOTE);
  const foreignPaper = { paperId: 'paper:foreign', canonicalText: foreignText };
  const span = {
    paperId: 'paper:foreign',
    quote: QUOTE,
    charStart: foreignStart,
    charEnd: foreignStart + QUOTE.length,
  };
  // Sanity: at these offsets the text really is a verbatim, correctly-located match.
  assert.equal(foreignText.slice(foreignStart, foreignStart + QUOTE.length), QUOTE);
  // The claim's cited papers do NOT include 'paper:foreign' — this must fail 'paper-not-cited'
  // rather than pass on the coincidental exact match.
  const result = verifyExactQuote(span, foreignPaper, ['paper:a']);
  assert.equal(result.ok, false);
  assert.equal(result.failure, 'paper-not-cited');
});

test("verifyExactQuote: 'paper-not-cited' also fires when the span's own paperId disagrees with " +
  'the paper being checked (a substitution at the call site)', () => {
  const span = { paperId: 'paper:other', quote: QUOTE, charStart: TRUE_START, charEnd: TRUE_END };
  const result = verifyExactQuote(span, PAPER_A, ['paper:a', 'paper:other']);
  assert.equal(result.ok, false);
  assert.equal(result.failure, 'paper-not-cited');
});

test("provenanceGaps: 'quote-cites-foreign-paper' when a quoted paper id is not in citedPaperIds", () => {
  const chain: ProvenanceChain = {
    claimArtifact: artifactRef(),
    verificationArtifact: artifactRef(),
    attestation: attestation(),
    claimKind: { claimed: 'causal', supported: 'causal', effective: 'causal', downgraded: false },
    citedPaperIds: ['paper:a'],
    quotedPaperIds: ['paper:foreign'],
  };
  const gaps = provenanceGaps(chain);
  assert.ok(gaps.some((g) => g.code === 'quote-cites-foreign-paper'));
  assert.equal(isProvenanceComplete(chain), false);
});

// ─── 5 · PROVENANCE-CHAIN COMPLETENESS ──────────────────────────────────────

function completeChain(over: Partial<ProvenanceChain> = {}): ProvenanceChain {
  return {
    claimArtifact: artifactRef(),
    verificationArtifact: artifactRef(),
    attestation: attestation(),
    claimKind: { claimed: 'causal', supported: 'causal', effective: 'causal', downgraded: false },
    citedPaperIds: ['paper:a'],
    quotedPaperIds: ['paper:a'],
    ...over,
  };
}

test('provenanceGaps: a complete chain returns []; isProvenanceComplete is true', () => {
  const chain = completeChain();
  assert.deepEqual(provenanceGaps(chain), []);
  assert.equal(isProvenanceComplete(chain), true);
});

test('provenanceGaps: each missing link yields exactly its own code, isolated', () => {
  const cases: Array<[string, Partial<ProvenanceChain>, string]> = [
    ['no-claim-artifact', { claimArtifact: undefined }, 'no-claim-artifact'],
    ['no-verification-artifact', { verificationArtifact: undefined }, 'no-verification-artifact'],
    ['no-attestation', { attestation: undefined }, 'no-attestation'],
    ['no-claim-kind', { claimKind: undefined }, 'no-claim-kind'],
    ['no-quotes', { quotedPaperIds: [] }, 'no-quotes'],
  ];
  for (const [label, override, expectedCode] of cases) {
    const gaps = provenanceGaps(completeChain(override));
    assert.deepEqual(
      gaps.map((g) => g.code),
      [expectedCode],
      label,
    );
  }
});

test('provenanceGaps: no-citations (with no quotes either, since a quote cannot cite a paper the ' +
  'claim never cites) yields no-citations alongside no-quotes — not an isolated single code, ' +
  'because an empty citation list makes every non-empty quotedPaperIds entry foreign by construction', () => {
  const gaps = provenanceGaps(completeChain({ citedPaperIds: [], quotedPaperIds: [] }));
  assert.deepEqual(
    gaps.map((g) => g.code).sort(),
    ['no-citations', 'no-quotes'],
  );
});

test("provenanceGaps: a claim/verification posture disagreement yields 'posture-mismatch'", () => {
  const chain = completeChain({
    claimArtifact: artifactRef({ posture: 'live' }),
    verificationArtifact: artifactRef({ posture: 'fixture' }),
  });
  const gaps = provenanceGaps(chain);
  assert.deepEqual(
    gaps.map((g) => g.code),
    ['posture-mismatch'],
  );
});

// ─── 6 · FAIL-CLOSED TRUST ───────────────────────────────────────────────────

const GOOD_LIVE_ARTIFACT = artifactRef({ posture: 'live' });
const GOOD_FIXTURE_ARTIFACT = artifactRef({ posture: 'fixture' });
const GOOD_ATTESTATION = attestation();

test('trustFailures: missing artifact ref BLOCKS', () => {
  const failures = trustFailures({ attestation: GOOD_ATTESTATION }, 'development');
  assert.ok(failures.some((f) => f.code === 'missing-artifact-ref'));
});

test("trustFailures: posture missing or not 'fixture'|'live' BLOCKS", () => {
  const missing = trustFailures(
    { artifact: { ...GOOD_LIVE_ARTIFACT, posture: undefined as unknown as 'live' }, attestation: GOOD_ATTESTATION },
    'development',
  );
  assert.ok(missing.some((f) => f.code === 'missing-posture'));
  const malformed = trustFailures(
    { artifact: { ...GOOD_LIVE_ARTIFACT, posture: 'archived' as unknown as 'live' }, attestation: GOOD_ATTESTATION },
    'development',
  );
  assert.ok(malformed.some((f) => f.code === 'missing-posture'));
});

test('trustFailures: malformed contentHash BLOCKS', () => {
  const cases = ['not-a-hash', 'sha256:tooShort', `sha256:${'g'.repeat(64)}`, `SHA256:${'a'.repeat(64)}`];
  for (const bad of cases) {
    const failures = trustFailures(
      { artifact: { ...GOOD_LIVE_ARTIFACT, contentHash: bad }, attestation: GOOD_ATTESTATION },
      'development',
    );
    assert.ok(failures.some((f) => f.code === 'malformed-content-hash'), bad);
  }
});

test('trustFailures: a FIXTURE artifact on a production path BLOCKS', () => {
  const failures = trustFailures(
    { artifact: GOOD_FIXTURE_ARTIFACT, attestation: GOOD_ATTESTATION },
    'production',
  );
  assert.ok(failures.some((f) => f.code === 'fixture-in-production'));
});

test('trustFailures: missing attestation BLOCKS', () => {
  const failures = trustFailures({ artifact: GOOD_LIVE_ARTIFACT }, 'development');
  assert.ok(failures.some((f) => f.code === 'missing-attestation'));
});

test('trustFailures: attested:false BLOCKS', () => {
  const failures = trustFailures(
    { artifact: GOOD_LIVE_ARTIFACT, attestation: { ...GOOD_ATTESTATION, attested: false } },
    'development',
  );
  assert.ok(failures.some((f) => f.code === 'unattested-model'));
});

test('trustFailures: non-decorrelated verifier on production BLOCKS (inert elsewhere)', () => {
  const inputs: TrustInputs = {
    artifact: GOOD_LIVE_ARTIFACT,
    attestation: { ...GOOD_ATTESTATION, decorrelated: false },
  };
  const prod = trustFailures(inputs, 'production');
  assert.ok(prod.some((f) => f.code === 'correlated-verifier-in-production'));
  // The rule is inert outside production, per provenance.ts's own doc comment.
  const dev = trustFailures(inputs, 'development');
  assert.ok(!dev.some((f) => f.code === 'correlated-verifier-in-production'));
});

test('trustFailures: demo/development paths ALLOW a fixture artifact (with disclosure elsewhere), ' +
  'but still BLOCK a missing attestation', () => {
  for (const env of ['demo', 'development'] as const) {
    const withAttestation = trustFailures({ artifact: GOOD_FIXTURE_ARTIFACT, attestation: GOOD_ATTESTATION }, env);
    assert.deepEqual(withAttestation, [], env);
    assert.equal(isTrustedForServing({ artifact: GOOD_FIXTURE_ARTIFACT, attestation: GOOD_ATTESTATION }, env), true);

    const withoutAttestation = trustFailures({ artifact: GOOD_FIXTURE_ARTIFACT }, env);
    assert.ok(withoutAttestation.some((f) => f.code === 'missing-attestation'), env);
    assert.equal(isTrustedForServing({ artifact: GOOD_FIXTURE_ARTIFACT }, env), false, env);
  }
});

test('assertTrustedForServing: throws and names every failing code at once', () => {
  assert.throws(
    () => assertTrustedForServing({}, 'production'),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /missing-artifact-ref/);
      assert.match(err.message, /missing-attestation/);
      return true;
    },
  );
});

test('assertTrustedForServing: does not throw for a fully trusted record', () => {
  assert.doesNotThrow(() =>
    assertTrustedForServing({ artifact: GOOD_LIVE_ARTIFACT, attestation: GOOD_ATTESTATION }, 'production'),
  );
});

// ─── 7 · REVISION-BOUND DISPOSITION (B-BR7) ─────────────────────────────────

const VERDICT_RECORD: ExpertVerdictRecord = {
  edgeId: 'a|increases|b',
  disposition: 'accepted',
  artifactRevision: 'rev-1',
  artifactContentHash: SHA('a'),
  decidedAt: '2026-01-01T00:00:00.000Z',
  decidedBy: 'reviewer-1',
};

test('resolveDisposition: same revision+hash => current status and the recorded disposition applies', () => {
  const current = artifactRef({ revision: 'rev-1', contentHash: SHA('a') });
  const resolved = resolveDisposition(current, VERDICT_RECORD);
  assert.equal(resolved.status, 'current');
  assert.equal(resolved.disposition, 'accepted');
  assert.equal(resolved.record, VERDICT_RECORD);
});

test('resolveDisposition: DIFFERENT contentHash (same revision) => stale-revision AND pending — ' +
  'approval must never be inherited across a revision change', () => {
  const current = artifactRef({ revision: 'rev-1', contentHash: SHA('b') });
  const resolved = resolveDisposition(current, VERDICT_RECORD);
  assert.equal(resolved.status, 'stale-revision');
  assert.equal(resolved.disposition, 'pending');
  assert.notEqual(resolved.disposition, VERDICT_RECORD.disposition, 'must NOT inherit "accepted"');
});

test('resolveDisposition: a different revision (even with the same hash coincidentally) => stale-revision', () => {
  const current = artifactRef({ revision: 'rev-2', contentHash: SHA('a') });
  const resolved = resolveDisposition(current, VERDICT_RECORD);
  assert.equal(resolved.status, 'stale-revision');
  assert.equal(resolved.disposition, 'pending');
});

test('resolveDisposition: null record => status none, disposition pending', () => {
  const current = artifactRef({ revision: 'rev-1', contentHash: SHA('a') });
  const resolved = resolveDisposition(current, null);
  assert.deepEqual(resolved, { disposition: 'pending', status: 'none', record: null });
});

test('resolveDisposition: undefined current artifact => stale-revision (cannot prove it applies)', () => {
  const resolved = resolveDisposition(undefined, VERDICT_RECORD);
  assert.equal(resolved.status, 'stale-revision');
  assert.equal(resolved.disposition, 'pending');
  assert.equal(resolved.record, VERDICT_RECORD);
});

// ─── 8 · B-BR10 (needsReview / reviewReasons) ───────────────────────────────

test('reviewReasons: an edge with a clean verdict and no signals is NOT flagged', () => {
  const edge = verifiedEdge();
  assert.deepEqual(reviewReasons(edge), []);
  assert.deepEqual(needsReview([edge]), []);
});

test("reviewReasons: passing the edgeId in signals.personalContradictions flags 'personal-data-contradiction'", () => {
  const edge = verifiedEdge();
  const reasons = reviewReasons(edge, { personalContradictions: [edge.claim.edgeId] });
  assert.deepEqual(reasons, ['personal-data-contradiction']);
  assert.equal(needsReview([edge], { personalContradictions: [edge.claim.edgeId] }).length, 1);
});

test("reviewReasons: a 'contradicted' verdict flags 'verifier-contradicted'", () => {
  const edge = verifiedEdge({ verification: verification({ verdict: 'contradicted' }) });
  assert.deepEqual(reviewReasons(edge), ['verifier-contradicted']);
});

test("reviewReasons: signals.untrustedEdgeIds flags 'untrusted-provenance'", () => {
  const edge = verifiedEdge();
  const reasons = reviewReasons(edge, { untrustedEdgeIds: [edge.claim.edgeId] });
  assert.deepEqual(reasons, ['untrusted-provenance']);
});

test('reviewReasons: the no-signals call keeps the exact legacy behaviour ' +
  '(verifier-contradicted / grounded-but-held only, never the new B-BR10/R4-U4 reasons)', () => {
  const clean = verifiedEdge();
  assert.deepEqual(reviewReasons(clean), []);
  assert.deepEqual(reviewReasons(clean, {}), []);

  const contradicted = verifiedEdge({ verification: verification({ verdict: 'contradicted' }) });
  assert.deepEqual(reviewReasons(contradicted), ['verifier-contradicted']);

  // grounded-but-held: servable verdict, but scored into the 'hold' band (low confidence, no
  // evidence-tier/corroboration lift) — the pre-R4-U4 reason, unaffected by the new signals param.
  const groundedButHeld = verifiedEdge({
    verification: verification({ verdict: 'partial', confidence: 0.1, evidenceTier: 1, corroboration: { supporting: 0, contradicting: 0 } }),
  });
  assert.deepEqual(reviewReasons(groundedButHeld), ['grounded-but-held']);
  // Passing signals={} must not change this legacy-reason outcome.
  assert.deepEqual(reviewReasons(groundedButHeld, {}), ['grounded-but-held']);
});

void CLAIM_KIND_LADDER; // re-exercised via effectiveClaimKind above; keep the import intentional.
void effectiveClaimKind; // sanity-imported alongside claimKindPosture's use of the same function.
void (undefined as unknown as TrustLabelClaimKind);
