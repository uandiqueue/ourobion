/**
 * R4-U4 follow-on (issue #240) · PRODUCER SIDE of the trust chain — node:test via tsx.
 * NO network, NO provider call. Every router here is a local stub.
 *
 * The defect this defends against is a one-line one: `verifierModel` used to be assigned
 * `response.model || verifierModel`, collapsing "the identity the provider returned" and "the
 * id we configured" into a single string. Downstream, `attestation_attested` is supposed to be
 * true ONLY for the former — but with one field there was nothing to tell them apart, so the
 * only options were to trust every model string or none.
 *
 * The fix keeps them in two places that can never be confused:
 *   - `verifierModel`  — the CONFIGURED id (config echo / MOCK / INTERIM stamp), and
 *   - `attestation`    — what the PROVIDER returned, carrying its own `attested` flag which is
 *                        true only when the route reports `source: 'provider-response'`.
 *
 * These tests assert that no input to `buildAttestation` other than a genuine provider response
 * can produce `attested: true`, and that a full `verifyClaim` run stamps both fields
 * independently.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildArtifactRef,
  buildAttestation,
  canonicalJson,
  isNonProviderModelString,
  loadVerificationValidator,
  posturefor,
  recordContentHash,
  verifyClaim,
} from '../src/verify/verifier.js';
import type { SynthClaim, VerifyRecord } from '../src/verify/verifier.js';
import type { CorpusDoc } from '../src/verify/verifier.js';
import { TEST_MODE_LABEL } from '../../llm-router/src/index.js';
import type { LlmResponse, ModelIdentity } from '../../llm-router/src/index.js';

// ── fixtures ────────────────────────────────────────────────────────────────────────────────

const PAPER_ID = 'fix:paper-1';
const QUOTE =
  'Higher gut comfort was associated with better mood in the studied cohort of healthy adults.';
const FIXTURE_TEXT =
  'Introduction paragraph with unrelated content. ' + QUOTE + ' A closing sentence about methods.';

function makeClaim(overrides: Partial<SynthClaim> = {}): SynthClaim {
  return {
    edgeId: 'gut_comfort_score|correlates|mood_score',
    subject: 'gut_comfort_score',
    object: 'mood_score',
    relation: 'correlates',
    claimKind: 'correlational',
    effect: { size: null, unit: null, ci: null },
    population: 'healthy adults',
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

function corpusDoc(): CorpusDoc {
  return {
    paperId: 'corpus:gut-mood-2024',
    title: 'Gut comfort and mood in a cohort',
    year: 2024,
    text: 'We found that gut comfort tracked mood across the cohort. Mood improved with comfort.',
    evidenceTier: 3,
    impactTier: 'moderate',
  };
}

function texts(): Map<string, string> {
  return new Map([[PAPER_ID, FIXTURE_TEXT]]);
}

function reply(): string {
  return JSON.stringify({
    verdict: 'supported',
    sourceStances: [{ paperId: 'corpus:gut-mood-2024', stance: 'supports' }],
    directionCheck: { matchesClaim: true },
    claimKindCheck: { matchesClaim: true, supportedKind: 'correlational' },
    scopeCheck: { mismatch: false, supportedPopulation: 'adults' },
    effectSizeCheck: { matchesClaim: true, extractedSize: null },
    evidenceTier: 4,
    confidence: 0.8,
  });
}

function identity(over: Partial<ModelIdentity> = {}): ModelIdentity {
  return {
    model: 'gpt-5-2026-01-14',
    source: 'provider-response',
    providerAttested: true,
    family: 'openai',
    returnedVersion: null,
    decorrelatedFromSynthesis: true,
    ...over,
  };
}

function response(over: Partial<LlmResponse> = {}): LlmResponse {
  const modelIdentity = over.modelIdentity ?? identity();
  return {
    text: reply(),
    usage: { inputTokens: 10, outputTokens: 20 },
    model: modelIdentity.model,
    modelIdentity,
    route: 'api_worker',
    ...over,
  };
}

/** A router stub that answers with a given identity — no network, no provider. */
function routerReturning(modelIdentity: ModelIdentity) {
  return { async route(): Promise<LlmResponse> { return response({ modelIdentity }); } };
}

// ── buildAttestation: only a provider response is attestation ────────────────────────────────

test('buildAttestation: no response at all ⇒ NO attestation (fail closed)', () => {
  assert.equal(buildAttestation(undefined), undefined);
});

test('buildAttestation: a provider-returned identity IS attested', () => {
  const a = buildAttestation(response())!;
  assert.equal(a.attested, true);
  assert.equal(a.returnedModel, 'gpt-5-2026-01-14');
  assert.equal(a.family, 'openai');
  assert.equal(a.decorrelated, true);
  assert.equal(a.returnedVersion, null);
});

test('buildAttestation: a ROUTER-CONFIG echo is NOT attested', () => {
  const a = buildAttestation(
    response({ modelIdentity: identity({ source: 'router-config', providerAttested: false }) }),
  )!;
  assert.equal(a.attested, false);
  // The identity is still recorded — honest history of what we asked for.
  assert.equal(a.returnedModel, 'gpt-5-2026-01-14');
});

test('buildAttestation: a LOCAL-AGENT mailbox fulfilment is NOT attested', () => {
  const a = buildAttestation(
    response({
      modelIdentity: identity({
        source: 'local-agent-mailbox',
        providerAttested: false,
        family: null,
      }),
    }),
  )!;
  assert.equal(a.attested, false);
  assert.equal(a.family, 'unknown', 'an unresolved family is named, never guessed');
});

test('buildAttestation: a SENTINEL string cannot be attested even if a route claims it was', () => {
  for (const model of [
    TEST_MODE_LABEL,
    'config:gpt-5',
    'router:verifier-node',
    'unset-verifier-model',
    'MOCK:mock-verifier (NOT a real verdict)',
    'INTERIM:local-quote-check-only:run-42',
    'fixture:hand-authored (NOT a verifier model)',
  ]) {
    const a = buildAttestation(
      response({ modelIdentity: identity({ model, providerAttested: true }) }),
    )!;
    assert.equal(a.attested, false, `sentinel '${model}' must never be attested`);
  }
});

test('buildAttestation: UNDETERMINED decorrelation records as false, never true', () => {
  const a = buildAttestation(
    response({ modelIdentity: identity({ decorrelatedFromSynthesis: null }) }),
  )!;
  assert.equal(a.decorrelated, false);
});

test('posturefor: only an attested record is LIVE; everything else is fixture', () => {
  assert.equal(posturefor(buildAttestation(response())), 'live');
  assert.equal(posturefor(undefined), 'fixture');
  assert.equal(
    posturefor(
      buildAttestation(
        response({ modelIdentity: identity({ providerAttested: false, source: 'router-config' }) }),
      ),
    ),
    'fixture',
  );
});

test('isNonProviderModelString: the router TEST_MODE_LABEL is recognised (drift guard)', () => {
  assert.equal(isNonProviderModelString(TEST_MODE_LABEL), true);
  assert.equal(isNonProviderModelString('gpt-5-2026-01-14'), false);
});

// ── content hashing ─────────────────────────────────────────────────────────────────────────

test('canonicalJson: key order does not change the encoding', () => {
  assert.equal(canonicalJson({ b: 1, a: [2, { d: 4, c: 3 }] }), canonicalJson({ a: [2, { c: 3, d: 4 }] , b: 1 }));
});

test('recordContentHash: contract format, deterministic, and content-sensitive', () => {
  const base = { edgeId: 'e', verdict: 'supported', confidence: 0.8 } as unknown as VerifyRecord;
  const h1 = recordContentHash(base);
  assert.match(h1, /^sha256:[0-9a-f]{64}$/);
  assert.equal(h1, recordContentHash({ ...base }));
  assert.notEqual(h1, recordContentHash({ ...base, confidence: 0.81 } as unknown as VerifyRecord));
});

test('recordContentHash: EXCLUDES the artifact ref (a hash cannot contain itself)', () => {
  const base = { edgeId: 'e', verdict: 'supported' } as unknown as VerifyRecord;
  const withArtifact = {
    ...base,
    artifact: { revision: 'r', contentHash: 'sha256:' + '0'.repeat(64), posture: 'live' as const },
  };
  assert.equal(recordContentHash(base), recordContentHash(withArtifact));
});

test('buildArtifactRef: NO revision ⇒ no artifact ref at all (never invented)', () => {
  const base = { edgeId: 'e' } as unknown as VerifyRecord;
  assert.equal(buildArtifactRef(base, undefined, 'live'), undefined);
  assert.equal(buildArtifactRef(base, '   ', 'live'), undefined);
  const ref = buildArtifactRef(base, ' edges-2026-07-29 ', 'live')!;
  assert.equal(ref.revision, 'edges-2026-07-29');
  assert.equal(ref.posture, 'live');
  assert.match(ref.contentHash, /^sha256:[0-9a-f]{64}$/);
});

// ── verifyClaim end to end (mocked router, no provider) ─────────────────────────────────────

test('verifyClaim: a provider-attested response stamps attestation AND a live artifact ref', async () => {
  const validate = await loadVerificationValidator();
  const res = await verifyClaim(makeClaim(), {
    texts: texts(),
    retrieve: { corpus: [corpusDoc()] },
    router: routerReturning(identity()),
    validateVerification: validate,
    verifierModel: 'config:gpt-5',
    artifactRevision: 'edges-2026-07-29',
    now: () => Date.parse('2026-07-16T00:00:00.000Z'),
  });
  const record = res.record!;
  assert.equal(record.verdict, 'supported');
  // The two identities are SEPARATE and neither has overwritten the other.
  assert.equal(record.verifierModel, 'config:gpt-5', 'verifierModel stays the CONFIGURED id');
  assert.equal(record.attestation?.returnedModel, 'gpt-5-2026-01-14');
  assert.equal(record.attestation?.attested, true);
  assert.notEqual(record.verifierModel, record.attestation?.returnedModel);
  // …and the artifact ref describes a live run of these exact bytes.
  assert.equal(record.artifact?.posture, 'live');
  assert.equal(record.artifact?.revision, 'edges-2026-07-29');
  assert.match(record.artifact!.contentHash, /^sha256:[0-9a-f]{64}$/);
  // The record round-trips the REAL shared zod contract with both new blocks present.
  assert.doesNotThrow(() => validate(record));
});

test('verifyClaim: a NON-attested response yields attested:false and a fixture posture', async () => {
  const validate = await loadVerificationValidator();
  const res = await verifyClaim(makeClaim(), {
    texts: texts(),
    retrieve: { corpus: [corpusDoc()] },
    router: routerReturning(identity({ source: 'router-config', providerAttested: false })),
    validateVerification: validate,
    verifierModel: 'config:gpt-5',
    artifactRevision: 'edges-2026-07-29',
    now: () => Date.parse('2026-07-16T00:00:00.000Z'),
  });
  assert.equal(res.record?.attestation?.attested, false);
  assert.equal(res.record?.artifact?.posture, 'fixture');
});

test('verifyClaim: WITHOUT --artifact-revision no artifact ref is stamped (unservable, honestly)', async () => {
  const validate = await loadVerificationValidator();
  const res = await verifyClaim(makeClaim(), {
    texts: texts(),
    retrieve: { corpus: [corpusDoc()] },
    router: routerReturning(identity()),
    validateVerification: validate,
    verifierModel: 'config:gpt-5',
    now: () => Date.parse('2026-07-16T00:00:00.000Z'),
  });
  assert.equal(res.record?.artifact, undefined);
  assert.equal(res.record?.attestation?.attested, true, 'attestation is independent of the ref');
});

test('verifyClaim: the quoteCheck-only rung has NO attestation and a fixture posture', async () => {
  const validate = await loadVerificationValidator();
  // Two well-corroborated, non-high-impact citations ⇒ triage picks the cheap rung (no LLM).
  const claim = makeClaim({
    citations: [
      { paperId: 'p1', title: 'a', year: 2020, population: null, evidenceTier: 3, impactTier: 'moderate', stance: 'supports' },
      { paperId: 'p2', title: 'b', year: 2021, population: null, evidenceTier: 3, impactTier: 'low', stance: 'supports' },
    ],
  });
  const res = await verifyClaim(claim, {
    texts: texts(),
    validateVerification: validate,
    verifierModel: 'config:gpt-5',
    artifactRevision: 'edges-2026-07-29',
    router: { async route(): Promise<LlmResponse> { throw new Error('no LLM on this rung'); } },
  });
  assert.equal(res.triage.mode, 'quoteCheck-only');
  assert.equal(res.record?.attestation, undefined, 'no provider was called ⇒ no attestation');
  assert.equal(res.record?.artifact?.posture, 'fixture');
});
