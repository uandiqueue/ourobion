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
import { testAcceptanceAuthorization } from './acceptanceHelpers.js';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { logicalCallIdSha256 } from '../../llm-router/src/index.js';

import {
  buildVerifierPrompt,
  claimQueryTerms,
  decideTriage,
  DEFAULT_TRIAGE_CONFIG,
  DEFAULT_MAX_EVIDENCE_CHARS_PER_SOURCE,
  enforceVerification,
  extractEvidencePassages,
  corpusHitToCitation,
  candidateToCitation,
  loadCorpusFromText,
  parseVerifierResponse,
  rankCorpus,
  retrieveForClaim,
  supportingCitationCount,
  topImpactTier,
  verifyClaim,
  verify,
  loadVerificationValidator,
  appendVerificationsToDir,
  verifierLogicalCallId,
} from '../src/verify/verifier.js';
import type {
  CorpusDoc,
  RankedDoc,
  RetrievalResult,
  SynthClaim,
  VerifyImpactTier,
} from '../src/verify/types.js';
import type { Candidate } from '../src/types.js';
import type { LlmRequest, LlmResponse, ModelIdentity } from '../../llm-router/src/index.js';
import { verificationDedupeKey } from '../src/verify/artifact.js';

/**
 * R4-U4/O27 (B-BR1): a MOCK router is NOT a provider. Its identity is a config
 * echo, so `providerAttested` is false and any record built from it must fail the
 * serving trust gate with 'unattested-model' — asserted in attestation.test.ts.
 */
function mockIdentity(model: string): ModelIdentity {
  return {
    model,
    source: 'router-config',
    providerAttested: false,
    family: 'openai',
    returnedVersion: null,
    decorrelatedFromSynthesis: true,
  };
}

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

// ── evidence passages (O15/B1 — the verifier judges ONLY shown evidence) ────────

test('extractEvidencePassages: carries matched-term sentences with chars:<start>-<end> locators into the doc text', () => {
  const doc = corpusDoc({
    text: 'Intro about unrelated things. Higher gut comfort tracked better mood in the cohort. A closing methods note.',
  });
  const passages = extractEvidencePassages(doc, ['gut', 'comfort', 'mood']);
  assert.ok(passages.length >= 1);
  const p = passages[0]!;
  assert.match(p.text, /gut comfort tracked better mood/);
  const m = /^chars:(\d+)-(\d+)$/.exec(p.locator);
  assert.ok(m, `locator '${p.locator}' must be chars:<start>-<end>`);
  const [start, end] = [Number(m![1]), Number(m![2])];
  // The locator addresses the passage's real span in the canonical text.
  assert.equal(doc.text.slice(start, end), p.text);
});

test('extractEvidencePassages: bounds total passage chars to the budget (no prompt blow-up)', () => {
  const long = Array.from({ length: 40 }, (_, i) => `Sentence ${i} about gut comfort and mood in the cohort.`).join(' ');
  const passages = extractEvidencePassages(corpusDoc({ text: long }), ['gut', 'comfort', 'mood'], 120);
  const total = passages.reduce((n, p) => n + p.text.length, 0);
  assert.ok(total <= 120, `total evidence chars ${total} must be ≤ 120`);
  assert.ok(passages.length >= 1);
});

test('extractEvidencePassages: no matching sentence → [] (evidence carried honestly, never padded)', () => {
  const doc = corpusDoc({ title: 'gut comfort mood', text: 'This body text is entirely about sleep and steps.' });
  assert.deepEqual(extractEvidencePassages(doc, ['gut', 'comfort', 'mood']), []);
});

test('corpusHitToCitation: carries bounded evidence text + provenance from the doc', () => {
  const hit: RankedDoc = {
    doc: corpusDoc({ text: 'Higher gut comfort tracked better mood across the cohort. Unrelated closing.' }),
    score: 1,
    matchedTerms: ['gut', 'comfort', 'mood'],
  };
  const cite = corpusHitToCitation(hit);
  assert.ok(cite.evidence && cite.evidence.length >= 1);
  assert.match(cite.evidence![0]!.text, /gut comfort tracked better mood/);
  assert.match(cite.evidence![0]!.locator, /^chars:\d+-\d+$/);
});

test('corpusHitToCitation: maxEvidenceChars override bounds the carried text', () => {
  const hit: RankedDoc = {
    doc: corpusDoc({ text: 'Higher gut comfort tracked better mood across the whole studied cohort of adults.' }),
    score: 1,
    matchedTerms: ['gut', 'comfort', 'mood'],
  };
  const cite = corpusHitToCitation(hit, { maxEvidenceChars: 20 });
  const total = (cite.evidence ?? []).reduce((n, p) => n + p.text.length, 0);
  assert.ok(total <= 20);
});

function candidate(over: Partial<Candidate> = {}): Candidate {
  return {
    identifiers: { doi: '10.1/abc' },
    title: 'External candidate on gut and mood',
    authors: [],
    year: 2024,
    venue: null,
    abstract: 'This external abstract discusses gut comfort and mood associations.',
    discoveredVia: 'crossref',
    ...over,
  } as Candidate;
}

test('candidateToCitation: carries the abstract as bounded evidence with an abstract:<start>-<end> locator', () => {
  const cite = candidateToCitation(candidate());
  assert.ok(cite.evidence && cite.evidence.length === 1);
  assert.match(cite.evidence![0]!.locator, /^abstract:0-\d+$/);
  assert.match(cite.evidence![0]!.text, /gut comfort and mood/);
});

test('candidateToCitation: no abstract → no evidence (never fabricated)', () => {
  const cite = candidateToCitation(candidate({ abstract: null }));
  assert.equal(cite.evidence, undefined);
});

test('retrieveForClaim: retrieved corpus sources carry evidence passages', async () => {
  const res = await retrieveForClaim(makeClaim(), {
    corpus: [corpusDoc({ text: 'Higher gut comfort was linked to better mood across the cohort of adults.' })],
  });
  const src = res.sources.find((s) => s.paperId === 'corpus:gut-mood-2024');
  assert.ok(src && src.evidence && src.evidence.length >= 1);
});

// ── corpus loader (fixture corpus) ──────────────────────────────────────────────

test('loadCorpusFromText: parses JSONL CorpusDoc lines, skips blanks, tolerates BOM', () => {
  const jsonl =
    '﻿{"paperId":"c:1","title":"T1","year":2024,"text":"gut comfort mood","evidenceTier":3,"impactTier":"moderate"}\n' +
    '\n' +
    '{"paperId":"c:2","title":"T2","year":null,"text":"more text","evidenceTier":1,"impactTier":"low"}\n';
  const docs = loadCorpusFromText(jsonl);
  assert.equal(docs.length, 2);
  assert.equal(docs[0]!.paperId, 'c:1');
  assert.equal(docs[1]!.year, null);
});

test('loadCorpusFromText: a malformed doc fails loudly with the line number', () => {
  const jsonl = '{"paperId":"c:1","title":"T","year":2024,"text":"ok","evidenceTier":3,"impactTier":"moderate"}\n{"paperId":"c:2","title":"","text":"x","evidenceTier":3,"impactTier":"low"}\n';
  assert.throws(() => loadCorpusFromText(jsonl, 'fix'), /fix:2/);
});

test('loadCorpusFromText: duplicate paperId is rejected', () => {
  const line = '{"paperId":"c:1","title":"T","year":2024,"text":"ok","evidenceTier":3,"impactTier":"moderate"}';
  assert.throws(() => loadCorpusFromText(`${line}\n${line}\n`), /duplicate paperId/);
});

test('DEFAULT_MAX_EVIDENCE_CHARS_PER_SOURCE is a positive config bound', () => {
  assert.ok(DEFAULT_MAX_EVIDENCE_CHARS_PER_SOURCE > 0);
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

test('buildVerifierPrompt: renders evidence passage TEXT with paperId + locator provenance', () => {
  const { prompt } = buildVerifierPrompt(makeClaim(), [
    {
      paperId: 'corpus:x',
      title: 'A retrieved source',
      year: 2023,
      population: null,
      evidenceTier: 3,
      impactTier: 'moderate',
      stance: 'mentions',
      evidence: [{ text: 'gut comfort tracked mood in the cohort', locator: 'chars:12-51' }],
    },
  ]);
  assert.match(prompt, /gut comfort tracked mood in the cohort/); // the passage TEXT reaches the prompt
  assert.match(prompt, /corpus:x @ chars:12-51/); // provenance: paperId + locator
});

test('buildVerifierPrompt: a source with no evidence is marked ungroundable', () => {
  const { prompt } = buildVerifierPrompt(makeClaim(), [
    { paperId: 'corpus:x', title: 'no-evidence source', year: 2023, population: null, evidenceTier: 3, impactTier: 'moderate', stance: 'mentions' },
  ]);
  assert.match(prompt, /no passages available/);
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

// ── #300 §E · approve-with-caveat ───────────────────────────────────────────────
//
// The defect these units close: a live Agnes run wrote 7 records with NO `caveat` key at all, so
// the only way the pipeline could express "thin evidence" was the `uncertain` verdict — i.e. by
// saying nothing on the card. The mechanical floor is unchanged (see the four `enforce:` rejection
// units above, which still pass); what changed is that a limitation is now NAMED.

/** A copy gate that accepts everything — the shared gate has its own unit in caveat.test.ts. */
const ACCEPT_COPY = (): boolean => true;

test('#300 §E: an APPROVED verdict on thin evidence carries a caveat naming the thin part', async () => {
  const validate = await loadVerificationValidator();
  const res = enforceVerification(parseVerifierResponse(reply({ verdict: 'partial' })), {
    claim: makeClaim(), quoteCheck: QC, retrieval: RETRIEVED,
    verifierModel: 'MOCK', promptVersion: 'v', verifiedAt: '2026-07-16T00:00:00Z',
    validateVerification: validate, validateCopy: ACCEPT_COPY,
  });
  assert.ok(res.ok);
  assert.equal(res.record.verdict, 'partial'); // approving, not a retreat to uncertain
  assert.equal(res.record.corroboration.supporting, 1);
  assert.equal(res.record.caveat, 'Only one other study backed this up.');
});

test('#300 §E: the verifier\'s OWN words are kept when they name the limitation that fired', async () => {
  const validate = await loadVerificationValidator();
  const own = 'Only one cross-sectional study backed this up.';
  const res = enforceVerification(parseVerifierResponse(reply({ caveat: own })), {
    claim: makeClaim(), quoteCheck: QC, retrieval: RETRIEVED,
    verifierModel: 'MOCK', promptVersion: 'v', verifiedAt: '2026-07-16T00:00:00Z',
    validateVerification: validate, validateCopy: ACCEPT_COPY,
  });
  assert.ok(res.ok);
  assert.equal(res.record.caveat, own);
});

test('#300 §E: a caveat naming a limitation that did NOT fire is replaced, never emitted', async () => {
  const validate = await loadVerificationValidator();
  const res = enforceVerification(
    parseVerifierResponse(reply({ caveat: 'The follow-up window was too short to be sure.' })),
    {
      claim: makeClaim(), quoteCheck: QC, retrieval: RETRIEVED,
      verifierModel: 'MOCK', promptVersion: 'v', verifiedAt: '2026-07-16T00:00:00Z',
      validateVerification: validate, validateCopy: ACCEPT_COPY,
    },
  );
  assert.ok(res.ok);
  // Follow-up length is not a check this pipeline runs, so that sentence is not evidence-backed.
  assert.equal(res.record.caveat, 'Only one other study backed this up.');
});

test('#300 §E: a well-corroborated verdict emits caveat NULL — present as a key, empty of content', async () => {
  const validate = await loadVerificationValidator();
  const res = enforceVerification(
    parseVerifierResponse(
      reply({
        sourceStances: [
          { paperId: 'corpus:s1', stance: 'supports' },
          { paperId: 'corpus:s2', stance: 'supports' },
        ],
        caveat: 'This looks solid to me.',
      }),
    ),
    {
      claim: makeClaim(), quoteCheck: QC, retrieval: RETRIEVED,
      verifierModel: 'MOCK', promptVersion: 'v', verifiedAt: '2026-07-16T00:00:00Z',
      validateVerification: validate, validateCopy: ACCEPT_COPY,
    },
  );
  assert.ok(res.ok);
  assert.equal(res.record.corroboration.supporting, 2);
  // The key exists (so "predates caveats" stays distinguishable) but the model's reassurance is
  // NOT carried through — nothing fired, so there is nothing to qualify.
  assert.ok('caveat' in res.record);
  assert.equal(res.record.caveat, null);
});

test('#300 §E: the caveat is inside the artifact content hash, not bolted on after it', async () => {
  const validate = await loadVerificationValidator();
  const ctx = {
    claim: makeClaim(), quoteCheck: QC, retrieval: RETRIEVED,
    verifierModel: 'MOCK', promptVersion: 'v', verifiedAt: '2026-07-16T00:00:00Z',
    validateVerification: validate, validateCopy: ACCEPT_COPY, artifactRevision: 'rev-1',
  };
  const withOwnWords = enforceVerification(
    parseVerifierResponse(reply({ caveat: 'Only one study of older adults backed this up.' })),
    ctx,
  );
  const withDerived = enforceVerification(parseVerifierResponse(reply()), ctx);
  assert.ok(withOwnWords.ok && withDerived.ok);
  assert.notEqual(withOwnWords.record.caveat, withDerived.record.caveat);
  assert.notEqual(
    withOwnWords.record.artifact?.contentHash,
    withDerived.record.artifact?.contentHash,
    'a different caveat must produce a different content hash',
  );
});

test('#300 §E: the prompt asks for approve-with-caveat and declares the caveat field', () => {
  const { system, prompt } = buildVerifierPrompt(makeClaim(), []);
  assert.match(system, /APPROVE WITH A CAVEAT/);
  assert.match(system, /Never use "uncertain" merely because the support is thin/);
  assert.match(system, /unsupported → the shown evidence does not address this claim/);
  assert.match(system, /Do NOT\n\s*invent one/);
  assert.match(prompt, /"caveat"/);
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
  // #300 §E · the cheap rung is still an honest rung: the record says WHY it is uncertain
  // instead of leaving a bare verdict for the reader to interpret.
  assert.equal(res.record?.caveat, 'This has not been checked against other studies yet. This check was not conclusive.');
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
        modelIdentity: mockIdentity('MOCK:mock-verifier (NOT a real verdict)'),
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
  // #300 §E · end-to-end, through the REAL copy gate (no validateCopy injected here): one
  // supporting source is thin, and the record says so.
  assert.equal(res.record?.caveat, 'Only one other study backed this up.');
});

test('#300 §E: the unenforceable-reply FALLBACK still states its own limitation', async () => {
  const validate = await loadVerificationValidator();
  const res = await verifyClaim(makeClaim(), {
    texts: texts(),
    retrieve: { corpus: [corpusDoc()] },
    // Unparseable every time → retries exhaust → the safe uncertain fallback (§A10 failure 7).
    router: {
      async route(): Promise<LlmResponse> {
        return {
          text: 'not json at all',
          model: 'MOCK:mock-verifier (NOT a real verdict)',
          modelIdentity: mockIdentity('MOCK:mock-verifier (NOT a real verdict)'),
          route: 'api_worker',
          usage: { inputTokens: 1, outputTokens: 1 },
        };
      },
    },
    validateVerification: validate,
    now: () => Date.parse('2026-07-16T00:00:00.000Z'),
  });
  assert.equal(res.fallback, true);
  assert.equal(res.record?.verdict, 'uncertain');
  // Retrieval DID run and DID return a source — but nothing in the refused reply could mark it
  // supporting, so the honest statement is "none of it backed this up", not "nothing was found".
  assert.equal(res.record?.independentRetrieval.performed, true);
  assert.equal(
    res.record?.caveat,
    'The other studies found did not back this up. This check was not conclusive.',
  );
});

test('verifyClaim acceptance: valid adverse verdict returns once, without retry or uncertain fallback', async () => {
  const validate = await loadVerificationValidator();
  const requests: LlmRequest[] = [];
  const res = await verifyClaim(makeClaim(), {
    texts: texts(),
    retrieve: { corpus: [corpusDoc()] },
    router: {
      async route(req: LlmRequest): Promise<LlmResponse> {
        requests.push(req);
        return {
          text: reply({
            verdict: 'unsupported',
            sourceStances: [{ paperId: 'corpus:gut-mood-2024', stance: 'refutes' }],
            directionMatches: false,
            claimKindMatches: false,
          }),
          model: 'agnes-llama-3.3-70b',
          modelIdentity: {
            model: 'agnes-llama-3.3-70b', source: 'provider-response', providerAttested: true,
            family: 'agnes', returnedVersion: null, decorrelatedFromSynthesis: true,
          },
          route: 'api_worker',
          usage: { inputTokens: 10, outputTokens: 20 },
        };
      },
    },
    validateVerification: validate,
    acceptance: { acceptanceRunId: 'acceptance-verify', authorization: testAcceptanceAuthorization() },
    maxAttempts: 3,
  });
  assert.equal(requests.length, 1);
  // #307: assert via the EXPORTED derivation, not a local copy of the formula. The previous
  // edgeId-only version was duplicated here, so fixing the real derivation would have left this
  // assertion silently pinning the old, colliding behaviour.
  assert.equal(requests[0]!.acceptance?.logicalCallId, verifierLogicalCallId(makeClaim()));
  assert.equal(res.record?.verdict, 'unsupported');
  assert.equal(res.fallback, undefined);
});

// ── artifact dedupe ─────────────────────────────────────────────────────────────

test('artifact: dedupe key keeps a runtime NUL separator without a binary source byte', () => {
  const key = verificationDedupeKey({ edgeId: 'edge-a', verifiedAt: '2026-07-29T00:00:00.000Z' });
  assert.equal(key.charCodeAt('edge-a'.length), 0);

  const source = readFileSync(new URL('../src/verify/artifact.ts', import.meta.url));
  assert.equal(source.includes(0), false, 'TypeScript source must contain no raw NUL byte');
});

test('artifact: appendVerificationsToDir dedupes on (edgeId, verifiedAt)', async () => {
  const validate = await loadVerificationValidator();
  const router = {
    async route(): Promise<LlmResponse> {
      return { text: reply({ sourceStances: [{ paperId: 'corpus:gut-mood-2024', stance: 'supports' }] }), model: 'MOCK', modelIdentity: mockIdentity('MOCK'), route: 'api_worker', usage: { inputTokens: 1, outputTokens: 1 } };
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

// ── --push-r2: publish the verdicts to the shared truth-tier object ──────────
//
// The cloud pipeline (#233 §D) is the reason this exists: synthesis could already
// publish claims.jsonl to R2, but verifications could not be published at all, so
// `edge-loader --from-r2` would project claims carrying no verdict.

/** Minimal in-memory stand-in for the R2 object the loader reads. */
function fakeR2() {
  const store = {
    objects: new Map<string, string>(),
    puts: [] as string[],
    failPut: false,
    async getObjectText(key: string): Promise<string> {
      const v = store.objects.get(key);
      if (v === undefined) throw new Error(`no such key: ${key}`);
      return v;
    },
    async putObject(key: string, body: Uint8Array): Promise<void> {
      if (store.failPut) throw new Error('simulated R2 outage');
      store.puts.push(key);
      store.objects.set(key, new TextDecoder().decode(body));
    },
  };
  return store;
}

async function runVerifyWith(dir: string, extra: Record<string, unknown>) {
  const validate = await loadVerificationValidator();
  const router = {
    async route(): Promise<LlmResponse> {
      return { text: reply({ sourceStances: [{ paperId: 'corpus:gut-mood-2024', stance: 'supports' }] }), model: 'MOCK', modelIdentity: mockIdentity('MOCK'), route: 'api_worker', usage: { inputTokens: 1, outputTokens: 1 } };
    },
  };
  return verify({
    claims: [makeClaim()], edgesDir: dir,
    texts: texts(), retrieve: { corpus: [corpusDoc()] }, router, validateVerification: validate,
    now: () => Date.parse('2026-07-16T00:00:00.000Z'),
    ...extra,
  } as Parameters<typeof verify>[0]);
}

test('verify --push-r2: publishes verdicts to edges/verifications.jsonl', async () => {
  const dir = tmp();
  const r2 = fakeR2();
  try {
    const res = await runVerifyWith(dir, { pushR2: true, r2Store: r2 });
    assert.equal(res.records.length, 1);
    assert.equal(res.r2?.key, 'edges/verifications.jsonl', 'must use the exact basename edge-loader reads');
    assert.equal(res.r2?.written, 1);
    // The published bytes are the verdict itself, not a placeholder.
    const published = r2.objects.get('edges/verifications.jsonl') ?? '';
    assert.match(published, /"edgeId":"gut_comfort_score\|correlates\|mood_score"/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('verify without --push-r2: nothing is published (publishing stays opt-in)', async () => {
  const dir = tmp();
  const r2 = fakeR2();
  try {
    const res = await runVerifyWith(dir, { r2Store: r2 });
    assert.equal(res.records.length, 1);
    assert.equal(res.r2, undefined);
    assert.equal(r2.puts.length, 0, 'a plain verify run must never write to the shared truth tier');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('verify --push-r2: a second push dedupes rather than duplicating the verdict', async () => {
  const dir = tmp();
  const r2 = fakeR2();
  try {
    await runVerifyWith(dir, { pushR2: true, r2Store: r2 });
    const second = await runVerifyWith(tmp(), { pushR2: true, r2Store: r2 });
    assert.equal(second.r2?.written, 0);
    assert.equal(second.r2?.skipped, 1);
    const lines = (r2.objects.get('edges/verifications.jsonl') ?? '').trim().split(/\r?\n/);
    assert.equal(lines.length, 1, 'the shared object must not accumulate duplicate verdicts');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('verify --push-r2: an R2 failure does NOT lose the local verdict', async () => {
  const dir = tmp();
  const r2 = fakeR2();
  r2.failPut = true;
  try {
    await assert.rejects(() => runVerifyWith(dir, { pushR2: true, r2Store: r2 }), /simulated R2 outage/);
    // The local mirror is written BEFORE the push, so the evidence survives.
    const local = readFileSync(join(dir, 'verifications.jsonl'), 'utf8').trim().split(/\r?\n/);
    assert.equal(local.length, 1, 'local verifications.jsonl must already hold the verdict');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

void topImpactTier;
void ([] as VerifyImpactTier[]);
