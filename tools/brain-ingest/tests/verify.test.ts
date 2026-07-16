/**
 * A10 · Verifier tests (session U11) — node:test via tsx, NO network, NO real LLM.
 *
 * Covers the substance the session brief names:
 *  - retrieval determinism + BM25-lite ranking sanity; query-term construction;
 *  - budget-triage predicate boundaries (high-impact / low-corroboration);
 *  - refute-first prompt assembly (claim + retrieved sources + adversarial posture);
 *  - POST-ENFORCEMENT (never trust the LLM): no-retrieval ⇒ uncertain;
 *    supported-with-zero-supporting ⇒ rejected; contradicted-without-contradicting
 *    ⇒ rejected; the LLM cannot invent sources; quoteCheck embedded verbatim;
 *  - quoteCheck-only triage rung (uncertain, no retrieval, no LLM);
 *  - a full mocked-router end-to-end producing a schema-valid EdgeVerification
 *    (the REAL shared zod validateVerification is used via the runtime loader).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  buildVerifierPrompt,
  claimQueryTerms,
  decideTriage,
  DEFAULT_TRIAGE_CONFIG,
  enforceVerification,
  parseVerifierResponse,
  rankCorpus,
  retrieveForClaim,
  supportingCitationCount,
  topImpactTier,
  verifyClaim,
  loadVerificationValidator,
  appendVerificationsToDir,
} from '../src/verify/verifier.js';
import type {
  CorpusDoc,
  RetrievalResult,
  SynthClaim,
  VerifyImpactTier,
} from '../src/verify/types.js';
import type { LlmRequest, LlmResponse } from '../../llm-router/src/index.js';

// ── fixtures ─────────────────────────────────────────────────────────────────

const PAPER_ID = 'fix:paper-1';
const QUOTE = 'Higher gut comfort was associated with better mood in the studied cohort of healthy adults.';
const FIXTURE_TEXT =
  'Introduction paragraph with unrelated content. ' + QUOTE + ' A closing sentence about methods.';

/** A well-formed SynthClaim (the gut/mood edge, mirroring U10's real claim shape). */
function makeClaim(overrides: Partial<SynthClaim> = {}): SynthClaim {
  return {
    edgeId: 'gut_comfort_score|correlates|mood_score',
    subject: 'gut_comfort_score',
    object: 'mood_score',
    relation: 'correlates',
    claimKind: 'correlational',
    effect: { size: null, unit: null, ci: null },
    population: 'IBS patients comorbid with anxiety and depression',
    citations: [
      {
        paperId: PAPER_ID,
        title: 'Fixture paper on gut comfort and mood',
        year: 2026,
        population: 'healthy adults',
        evidenceTier: 4,
        impactTier: 'high',
        stance: 'supports',
      },
    ],
    quoteSpans: [{ paperId: PAPER_ID, quote: QUOTE, locator: null, charStart: null, charEnd: null }],
    derivation: 'The sentence associates gut comfort with mood, so the two correlate.',
    synthesisModel: 'test-model',
    promptVersion: 'synthesis-test.1',
    synthesisedAt: '2026-07-16T00:00:00.000Z',
    ...overrides,
  };
}

function corpusDoc(over: Partial<CorpusDoc> = {}): CorpusDoc {
  return {
    paperId: 'corpus:gut-mood-2024',
    title: 'Gut comfort and mood in a cohort',
    year: 2024,
    text: 'We found that gut comfort tracked mood across the cohort. Mood improved with comfort.',
    evidenceTier: 3,
    impactTier: 'moderate',
    ...over,
  };
}

function texts(): Map<string, string> {
  return new Map([[PAPER_ID, FIXTURE_TEXT]]);
}

function tmp(): string {
  return mkdtempSync(join(tmpdir(), 'verify-'));
}

// ── query construction + retrieval ranking (deterministic) ─────────────────────

test('claimQueryTerms: metric tokens lead, population keywords follow, deterministic', () => {
  const terms = claimQueryTerms(makeClaim());
  assert.deepEqual(terms.slice(0, 3), ['gut', 'comfort', 'mood']); // 'score' is stoplisted
  assert.ok(terms.includes('anxiety')); // population keyword
  assert.deepEqual(claimQueryTerms(makeClaim()), terms); // deterministic
});

test('rankCorpus: ranks by term coverage/tf, deterministic, ties broken by paperId', () => {
  const query = ['gut', 'comfort', 'mood'];
  const docs: CorpusDoc[] = [
    corpusDoc({ paperId: 'corpus:b', title: 'coverage', text: 'gut comfort and mood and gut comfort mood everywhere' }),
    corpusDoc({ paperId: 'corpus:a', title: 'coverage', text: 'only gut is mentioned here once' }),
    corpusDoc({ paperId: 'corpus:c', title: 'sleep study', text: 'unrelated content about sleep and steps' }),
  ];
  const a = rankCorpus(query, docs);
  const b = rankCorpus(query, docs);
  assert.deepEqual(a, b); // deterministic
  assert.equal(a[0]!.doc.paperId, 'corpus:b'); // most term coverage + tf wins
  assert.ok(!a.some((h) => h.doc.paperId === 'corpus:c')); // zero-score docs excluded
});

test('rankCorpus: empty query or empty corpus → no hits', () => {
  assert.deepEqual(rankCorpus([], [corpusDoc()]), []);
  assert.deepEqual(rankCorpus(['gut'], []), []);
});

test('retrieveForClaim: echo-controls the claim\'s own citations, performed=true', async () => {
  const claim = makeClaim();
  // A corpus doc whose paperId is the claim's own citation must be excluded (echo control).
  const res = await retrieveForClaim(claim, {
    corpus: [corpusDoc(), corpusDoc({ paperId: PAPER_ID, text: 'gut comfort mood echo' })],
  });
  assert.equal(res.performed, true);
  assert.ok(res.sources.some((s) => s.paperId === 'corpus:gut-mood-2024'));
  assert.ok(!res.sources.some((s) => s.paperId === PAPER_ID)); // echo excluded
  assert.equal(res.sources.every((s) => s.stance === 'mentions'), true); // retrieval is stance-neutral
});

// ── triage predicate boundaries ────────────────────────────────────────────────

test('triage: a high-impact citation forces full retrieval', () => {
  const d = decideTriage(makeClaim()); // has a 'high' impact citation
  assert.equal(d.mode, 'full');
  assert.equal(d.topImpactTier, 'high');
});

test('triage: well-corroborated, non-high-impact edge is quoteCheck-only', () => {
  const claim = makeClaim({
    citations: [
      { paperId: 'p1', title: 'a', year: 2020, population: null, evidenceTier: 3, impactTier: 'moderate', stance: 'supports' },
      { paperId: 'p2', title: 'b', year: 2021, population: null, evidenceTier: 3, impactTier: 'low', stance: 'supports' },
    ],
  });
  const d = decideTriage(claim);
  assert.equal(d.supportingCitations, 2); // == threshold
  assert.equal(d.mode, 'quoteCheck-only');
});

test('triage: low-corroboration (1 supporting) forces full retrieval even at moderate impact', () => {
  const claim = makeClaim({
    citations: [{ paperId: 'p1', title: 'a', year: 2020, population: null, evidenceTier: 3, impactTier: 'moderate', stance: 'supports' }],
  });
  const d = decideTriage(claim);
  assert.equal(d.supportingCitations, 1);
  assert.equal(d.mode, 'full');
  assert.match(d.reasons.join(' '), /low corroboration/);
});

test('triage: config threshold is respected (threshold 0 → never low-corroboration)', () => {
  const claim = makeClaim({
    citations: [{ paperId: 'p1', title: 'a', year: 2020, population: null, evidenceTier: 3, impactTier: 'moderate', stance: 'supports' }],
  });
  const d = decideTriage(claim, { fullRetrievalImpactTiers: ['high'], lowCorroborationThreshold: 0 });
  assert.equal(d.mode, 'quoteCheck-only');
});

test('triage: helpers agree with the decision', () => {
  const claim = makeClaim();
  assert.equal(topImpactTier(claim), 'high');
  assert.equal(supportingCitationCount(claim), 1);
  assert.equal(DEFAULT_TRIAGE_CONFIG.lowCorroborationThreshold, 2);
});

// ── prompt assembly ─────────────────────────────────────────────────────────────

test('buildVerifierPrompt: refute-first posture, claim + retrieved sources embedded', () => {
  const { system, prompt } = buildVerifierPrompt(makeClaim(), [
    { paperId: 'corpus:x', title: 'A retrieved source', year: 2023, population: null, evidenceTier: 3, impactTier: 'moderate', stance: 'mentions' },
  ]);
  assert.match(system, /REFUTE/);
  assert.match(system, /uncertain/);
  assert.match(prompt, /gut_comfort_score correlates mood_score/);
  assert.match(prompt, /corpus:x/);
  assert.match(prompt, /supported\|partial\|unsupported\|contradicted\|uncertain/);
});

test('buildVerifierPrompt: zero sources tells the model to answer uncertain', () => {
  const { prompt } = buildVerifierPrompt(makeClaim(), []);
  assert.match(prompt, /no sources retrieved/);
});

// ── post-enforcement (the LLM output is UNTRUSTED) ──────────────────────────────

const RETRIEVED: RetrievalResult = {
  performed: true,
  sources: [
    { paperId: 'corpus:s1', title: 's1', year: 2022, population: null, evidenceTier: 4, impactTier: 'high', stance: 'mentions' },
    { paperId: 'corpus:s2', title: 's2', year: 2020, population: null, evidenceTier: 3, impactTier: 'moderate', stance: 'mentions' },
  ],
  corpusHits: [],
  externalCount: 0,
};

const QC = { spansFound: 1, spansTotal: 1, allPresent: true };

function reply(over: Record<string, unknown> = {}): string {
  return JSON.stringify({
    verdict: 'supported',
    sourceStances: [{ paperId: 'corpus:s1', stance: 'supports' }],
    directionCheck: { matchesClaim: true },
    claimKindCheck: { matchesClaim: true, supportedKind: 'correlational' },
    scopeCheck: { mismatch: false, supportedPopulation: 'adults' },
    effectSizeCheck: { matchesClaim: true, extractedSize: null },
    evidenceTier: 4,
    confidence: 0.8,
    ...over,
  });
}

test('enforce: no independent retrieval ⇒ verdict FORCED to uncertain', async () => {
  const validate = await loadVerificationValidator();
  const res = enforceVerification(parseVerifierResponse(reply({ verdict: 'supported' })), {
    claim: makeClaim(),
    quoteCheck: QC,
    retrieval: { performed: false, sources: [], corpusHits: [], externalCount: 0 },
    verifierModel: 'MOCK', promptVersion: 'v', verifiedAt: '2026-07-16T00:00:00Z',
    validateVerification: validate,
  });
  assert.ok(res.ok);
  assert.equal(res.record.verdict, 'uncertain');
  assert.equal(res.record.independentRetrieval.performed, false);
});

test('enforce: supported with zero supporting sources is REJECTED', async () => {
  const validate = await loadVerificationValidator();
  const res = enforceVerification(
    parseVerifierResponse(reply({ verdict: 'supported', sourceStances: [{ paperId: 'corpus:s1', stance: 'mentions' }] })),
    { claim: makeClaim(), quoteCheck: QC, retrieval: RETRIEVED, verifierModel: 'MOCK', promptVersion: 'v', verifiedAt: '2026-07-16T00:00:00Z', validateVerification: validate },
  );
  assert.equal(res.ok, false);
  if (!res.ok) assert.equal(res.reason, 'enforcement-violation');
});

test('enforce: contradicted without a contradicting source is REJECTED', async () => {
  const validate = await loadVerificationValidator();
  const res = enforceVerification(
    parseVerifierResponse(reply({ verdict: 'contradicted', sourceStances: [{ paperId: 'corpus:s1', stance: 'supports' }] })),
    { claim: makeClaim(), quoteCheck: QC, retrieval: RETRIEVED, verifierModel: 'MOCK', promptVersion: 'v', verifiedAt: '2026-07-16T00:00:00Z', validateVerification: validate },
  );
  assert.equal(res.ok, false);
  if (!res.ok) assert.equal(res.reason, 'enforcement-violation');
});

test('enforce: the LLM cannot invent sources; corroboration re-derived from retrieved set only', async () => {
  const validate = await loadVerificationValidator();
  const res = enforceVerification(
    // The reply "supports" a paperId that was NEVER retrieved → ignored → 0 supporting → reject.
    parseVerifierResponse(reply({ verdict: 'supported', sourceStances: [{ paperId: 'ghost:invented', stance: 'supports' }] })),
    { claim: makeClaim(), quoteCheck: QC, retrieval: RETRIEVED, verifierModel: 'MOCK', promptVersion: 'v', verifiedAt: '2026-07-16T00:00:00Z', validateVerification: validate },
  );
  assert.equal(res.ok, false);
});

test('enforce: a valid supported verdict passes; quoteCheck embedded verbatim', async () => {
  const validate = await loadVerificationValidator();
  const distinctiveQc = { spansFound: 2, spansTotal: 2, allPresent: true };
  const res = enforceVerification(parseVerifierResponse(reply()), {
    claim: makeClaim(), quoteCheck: distinctiveQc, retrieval: RETRIEVED,
    verifierModel: 'MOCK:test', promptVersion: 'v', verifiedAt: '2026-07-16T00:00:00Z', validateVerification: validate,
  });
  assert.ok(res.ok);
  assert.equal(res.record.verdict, 'supported');
  assert.deepEqual(res.record.quoteCheck, distinctiveQc); // embedded verbatim from A9
  assert.equal(res.record.corroboration.supporting, 1);
  assert.equal(res.record.evidenceTier, 4); // strongest SUPPORTING source's tier
});

// ── verifyClaim orchestration ───────────────────────────────────────────────────

test('verifyClaim --triage-only: returns the decision, no record, no LLM', async () => {
  const validate = await loadVerificationValidator();
  const res = await verifyClaim(makeClaim(), { triageOnly: true, validateVerification: validate });
  assert.equal(res.record, undefined);
  assert.equal(res.triage.mode, 'full');
});

test('verifyClaim quoteCheck-only rung: uncertain record, no retrieval, no LLM', async () => {
  const validate = await loadVerificationValidator();
  const claim = makeClaim({
    citations: [
      { paperId: 'p1', title: 'a', year: 2020, population: null, evidenceTier: 3, impactTier: 'moderate', stance: 'supports' },
      { paperId: 'p2', title: 'b', year: 2021, population: null, evidenceTier: 3, impactTier: 'low', stance: 'supports' },
    ],
  });
  const res = await verifyClaim(claim, {
    texts: texts(),
    validateVerification: validate,
    verifierModel: 'MOCK',
    router: { async route() { throw new Error('LLM must not be called in quoteCheck-only mode'); } },
  });
  assert.equal(res.triage.mode, 'quoteCheck-only');
  assert.equal(res.record?.verdict, 'uncertain');
  assert.equal(res.record?.independentRetrieval.performed, false);
});

test('verifyClaim: a failing quoteCheck rejects without any LLM spend', async () => {
  const validate = await loadVerificationValidator();
  const res = await verifyClaim(makeClaim(), {
    texts: new Map([[PAPER_ID, 'text that does not contain the quote']]),
    validateVerification: validate,
    router: { async route() { throw new Error('LLM must not be called when quoteCheck fails'); } },
  });
  assert.equal(res.record, undefined);
  assert.equal(res.rejected?.reason, 'quote-check-failed');
});

test('verifyClaim full end-to-end: mocked router → schema-valid supported verification', async () => {
  const validate = await loadVerificationValidator();
  const router = {
    async route(_req: LlmRequest): Promise<LlmResponse> {
      return {
        text: reply({ sourceStances: [{ paperId: 'corpus:gut-mood-2024', stance: 'supports' }] }),
        model: 'MOCK:mock-verifier (NOT a real verdict)',
        route: 'api_worker',
        usage: { inputTokens: 10, outputTokens: 20 },
      };
    },
  };
  const res = await verifyClaim(makeClaim(), {
    texts: texts(),
    retrieve: { corpus: [corpusDoc()] },
    router,
    validateVerification: validate,
    now: () => Date.parse('2026-07-16T00:00:00.000Z'),
  });
  assert.equal(res.record?.verdict, 'supported');
  assert.equal(res.record?.independentRetrieval.performed, true);
  assert.equal(res.record?.corroboration.supporting, 1);
  // The record round-trips through the REAL shared zod validator (already applied by enforce).
  assert.doesNotThrow(() => validate(res.record));
});

// ── artifact dedupe ─────────────────────────────────────────────────────────────

test('artifact: appendVerificationsToDir dedupes on (edgeId, verifiedAt)', async () => {
  const validate = await loadVerificationValidator();
  const router = {
    async route(): Promise<LlmResponse> {
      return { text: reply({ sourceStances: [{ paperId: 'corpus:gut-mood-2024', stance: 'supports' }] }), model: 'MOCK', route: 'api_worker', usage: { inputTokens: 1, outputTokens: 1 } };
    },
  };
  const res = await verifyClaim(makeClaim(), {
    texts: texts(), retrieve: { corpus: [corpusDoc()] }, router, validateVerification: validate,
    now: () => Date.parse('2026-07-16T00:00:00.000Z'),
  });
  const dir = tmp();
  try {
    const w1 = appendVerificationsToDir(dir, [res.record!]);
    assert.equal(w1.written, 1);
    const w2 = appendVerificationsToDir(dir, [res.record!]);
    assert.equal(w2.written, 0);
    assert.equal(w2.skipped, 1);
    const lines = readFileSync(w1.path, 'utf8').trim().split(/\r?\n/);
    assert.equal(lines.length, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

void topImpactTier;
void ([] as VerifyImpactTier[]);
