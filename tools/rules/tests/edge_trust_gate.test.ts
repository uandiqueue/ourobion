/**
 * R4-U4 follow-on (issue #240) · THE EDGE TRUST GATE, BOTH DIRECTIONS — node:test via tsx.
 * NO network, NO provider call, NO database. Frozen fixtures inline.
 *
 * What this file is defending. `generate-insights` may emit a cited card (producer 'edge')
 * only for an edge that can PROVE where it came from: an artifact ref (revision + content hash
 * + fixture/live posture) and a model attestation whose identity the PROVIDER returned. Two
 * separate defects made that unprovable end to end, and both are fixed by the change under
 * test:
 *
 *   1. the A11 edge-loader never wrote the U4 artifact/attestation columns, and
 *   2. `generate-insights` never SELECTED them (nor the `verification` jsonb),
 *
 * so the gate saw a uniformly null trust posture for every database-loaded edge. The tempting
 * "fix" for a demo — hand-setting attested = true, or relaxing the gate until something passes
 * — is exactly what these tests exist to make impossible: the POSITIVE case must be carried by
 * a genuinely complete, genuinely provider-attested record, and every degraded variant of that
 * same record must be REJECTED.
 *
 * The negative matrix is the point of the unit. It covers, exhaustively:
 *   - missing attestation (no attestation at all)
 *   - null / partial trust posture (no artifact ref, or an incomplete one)
 *   - a TEST-MODE sentinel model string
 *   - a config-fallback model string (`config:…`, and the legacy `router:verifier-node`)
 *   - MOCK / INTERIM / fixture provenance stamps
 *   - attested false, and attested null
 *   - a malformed content hash
 *   - production-only rules: fixture artifacts, and a non-decorrelated verifier
 * plus the case that motivated the whole unit: a self-contradictory row that CLAIMS attestation
 * for a sentinel identity is still rejected.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyPattern,
  composeTrustPosture,
  edgeTrustFailures,
  isNonProviderModelString,
  rendersCard,
  trustInputsFor,
  type CandidatePattern,
  type ServableEdge,
} from '../../../supabase/functions/generate-insights/composer.ts';
import type { TrustFailureCode } from '../../../shared/brain/trust_labels.ts';
import { TEST_MODE_LABEL } from '../../llm-router/src/types.js';

// ─── Fixtures ───────────────────────────────────────────────────────────────────────────────

/** A syntactically valid content hash (sha256: + 64 lowercase hex). */
const HASH_A = `sha256:${'a1b2c3d4'.repeat(8)}`;
assert.match(HASH_A, /^sha256:[0-9a-f]{64}$/, 'fixture hash must satisfy the contract format');

/**
 * THE POSITIVE CONTROL: a verified_edges row whose U4 columns are fully populated the way the
 * A11 loader now populates them from a live, provider-attested verification artifact.
 *
 * Note what makes it pass — nothing here is a special case in the gate:
 *   - artifact revision + content hash + posture 'live' (a provider run produced it),
 *   - a returned model that is a real provider id, not one of our provenance stamps,
 *   - attested true, set by the producer only because the provider's own response carried
 *     the identity (tools/brain-ingest attest.ts), and
 *   - decorrelated true (the verifier family differs from the synthesising family).
 */
function attestedEdge(partial: Partial<ServableEdge> = {}): ServableEdge {
  return {
    edge_id: 'subject_metric|increases|object_metric',
    subject: 'subject_metric',
    object: 'object_metric',
    relation: 'increases',
    verified_at: '2026-07-29T00:00:00.000Z',
    edge_score: 0.91,
    serving_band: 'high',
    claim: { citations: [{ paperId: 'paper:1' }], claimKind: 'correlational' },
    verification: { claimKindCheck: { matchesClaim: true, supportedKind: 'correlational' } },
    claim_artifact_revision: 'edges-2026-07-29',
    claim_artifact_content_hash: HASH_A,
    claim_artifact_posture: 'live',
    verification_artifact_revision: 'edges-2026-07-29',
    verification_artifact_content_hash: HASH_A,
    verification_artifact_posture: 'live',
    attestation_returned_model: 'gpt-5-2026-01-14',
    attestation_returned_version: null,
    attestation_family: 'openai',
    attestation_decorrelated: true,
    attestation_attested: true,
    ...partial,
  };
}

/** Codes reported for an edge in `environment` (sorted; duplicates are impossible). */
function codes(edge: ServableEdge, environment: 'development' | 'demo' | 'production'): string[] {
  return edgeTrustFailures(edge, environment).map((f) => f.code).sort();
}

// ─── POSITIVE · a properly attested edge passes and yields a card ───────────────────────────

test('POSITIVE: a fully attested live edge passes the trust gate in demo AND production', () => {
  assert.deepEqual(edgeTrustFailures(attestedEdge(), 'demo'), []);
  assert.deepEqual(edgeTrustFailures(attestedEdge(), 'development'), []);
  // production additionally forbids fixture artifacts and correlated verifiers — this record
  // satisfies both, so it is clean there too. (No production serving is authorized in Run 4;
  // the assertion pins that the rule exists and that a clean record can satisfy it.)
  assert.deepEqual(edgeTrustFailures(attestedEdge(), 'production'), []);
});

test('POSITIVE: the U4 view columns are what carry the posture (not the jsonb)', () => {
  // Same row with NO verification/claim jsonb artifact at all — the flat columns alone must be
  // sufficient, because that is what the loader writes and what the fetch now selects.
  const edge = attestedEdge({ claim: { citations: [] }, verification: {} });
  const trust = composeTrustPosture(edge);
  assert.equal(trust.posture, 'live');
  assert.equal(trust.artifactRevision, 'edges-2026-07-29');
  assert.equal(trust.artifactContentHash, HASH_A);
  assert.equal(trust.returnedModel, 'gpt-5-2026-01-14');
  assert.equal(trust.attested, true);
  assert.deepEqual(edgeTrustFailures(edge, 'demo'), []);
});

test('POSITIVE: the attested edge reaches the card path — gate open AND rendersCard true', () => {
  const pattern: CandidatePattern = {
    patternKey: 'signal:subject_metric:up',
    kind: 'signal',
    metricKeys: ['subject_metric'],
    states: { subject_metric: 'up' },
    stats: {},
  };
  const classified = classifyPattern(pattern, [attestedEdge()], () => null, {
    qMax: 0.05,
    nEffMin: 10,
  });
  assert.ok(classified, 'the pattern must classify');
  assert.equal(classified.branch, 'agree');
  assert.ok(classified.cardEdge, 'a subject-endpoint edge must drive the card (O16)');
  assert.equal(rendersCard(classified), true);
  // …and the trust gate — the last thing between this and a rendered card — lets it through.
  assert.deepEqual(edgeTrustFailures(classified.cardEdge, 'demo'), []);
});

test('POSITIVE: a fixture-posture edge is servable in DEMO (disclosed), never silently', () => {
  const fixture = attestedEdge({
    claim_artifact_posture: 'fixture',
    verification_artifact_posture: 'fixture',
  });
  assert.deepEqual(edgeTrustFailures(fixture, 'demo'), []);
  assert.equal(composeTrustPosture(fixture).posture, 'fixture'); // B-UI9: the card discloses it
});

// ─── NEGATIVE · the failure matrix. Each vector must BLOCK the card. ────────────────────────

interface NegativeVector {
  name: string;
  edge: ServableEdge;
  environment?: 'development' | 'demo' | 'production';
  expect: TrustFailureCode;
}

const NEGATIVE_VECTORS: NegativeVector[] = [
  // ── missing attestation ──
  {
    name: 'no attestation at all (every attestation column null, no jsonb)',
    edge: attestedEdge({
      attestation_returned_model: null,
      attestation_returned_version: null,
      attestation_family: null,
      attestation_decorrelated: null,
      attestation_attested: null,
      verification: {},
    }),
    expect: 'missing-attestation',
  },
  {
    name: 'attestation columns are undefined (a pre-U4 row that predates them)',
    edge: attestedEdge({
      attestation_returned_model: undefined,
      attestation_family: undefined,
      attestation_attested: undefined,
      verification: {},
    }),
    expect: 'missing-attestation',
  },
  {
    name: 'an identity with NO family — a half-populated attestation is not an attestation',
    edge: attestedEdge({ attestation_family: null, verification: {} }),
    expect: 'missing-attestation',
  },

  // ── null / partial trust posture ──
  {
    name: 'null trust posture (artifact_posture null on both claim and verification)',
    edge: attestedEdge({
      claim_artifact_posture: null,
      verification_artifact_posture: null,
      claim: { citations: [] },
      verification: {},
    }),
    expect: 'missing-artifact-ref',
  },
  {
    name: 'no artifact ref at all (every artifact column null)',
    edge: attestedEdge({
      claim_artifact_revision: null,
      claim_artifact_content_hash: null,
      claim_artifact_posture: null,
      verification_artifact_revision: null,
      verification_artifact_content_hash: null,
      verification_artifact_posture: null,
      claim: { citations: [] },
      verification: {},
    }),
    expect: 'missing-artifact-ref',
  },
  {
    name: 'partial artifact group (revision present, content hash missing) — never a hybrid',
    edge: attestedEdge({
      claim_artifact_content_hash: null,
      verification_artifact_content_hash: null,
      claim: { citations: [] },
      verification: {},
    }),
    expect: 'missing-artifact-ref',
  },
  {
    name: 'a malformed content hash is not a content hash',
    edge: attestedEdge({
      claim_artifact_content_hash: 'not-a-hash',
      verification_artifact_content_hash: 'not-a-hash',
    }),
    expect: 'malformed-content-hash',
  },
  {
    name: 'an unrecognised posture string is not a posture',
    edge: attestedEdge({
      claim_artifact_posture: 'probably-fine',
      verification_artifact_posture: 'probably-fine',
    }),
    expect: 'missing-posture',
  },

  // ── test-mode / sentinel model strings ──
  {
    name: 'the TEST-MODE sentinel model string, even with attested = true',
    edge: attestedEdge({ attestation_returned_model: TEST_MODE_LABEL }),
    expect: 'unattested-model',
  },
  {
    name: 'a MOCK provenance stamp, even with attested = true',
    edge: attestedEdge({ attestation_returned_model: 'MOCK:mock-verifier (NOT a real verdict)' }),
    expect: 'unattested-model',
  },
  {
    name: 'an INTERIM single-paper stamp, even with attested = true',
    edge: attestedEdge({
      attestation_returned_model: 'INTERIM:local-quote-check-only:run-42',
    }),
    expect: 'unattested-model',
  },
  {
    name: 'a hand-authored fixture stamp, even with attested = true',
    edge: attestedEdge({
      attestation_returned_model: 'fixture:hand-authored (NOT a verifier model)',
    }),
    expect: 'unattested-model',
  },

  // ── config-fallback model strings ──
  {
    name: 'the config-echo id the verify CLI stamps (config:<model>), even with attested = true',
    edge: attestedEdge({ attestation_returned_model: 'config:gpt-5' }),
    expect: 'unattested-model',
  },
  {
    name: 'the legacy static CLI sentinel router:verifier-node',
    edge: attestedEdge({ attestation_returned_model: 'router:verifier-node' }),
    expect: 'unattested-model',
  },
  {
    name: "the verifier's unset default (unset-verifier-model)",
    edge: attestedEdge({ attestation_returned_model: 'unset-verifier-model' }),
    expect: 'unattested-model',
  },

  // ── the attested flag itself ──
  {
    name: 'a real provider id recorded as NOT attested',
    edge: attestedEdge({ attestation_attested: false }),
    expect: 'unattested-model',
  },
  {
    name: 'a real provider id with attested null — null is never trusted',
    edge: attestedEdge({ attestation_attested: null }),
    expect: 'unattested-model',
  },

  // ── production-only rules (inert in Run 4; written ahead of the path) ──
  {
    name: 'a fixture artifact may never be served on a PRODUCTION path',
    edge: attestedEdge({
      claim_artifact_posture: 'fixture',
      verification_artifact_posture: 'fixture',
    }),
    environment: 'production',
    expect: 'fixture-in-production',
  },
  {
    name: 'a non-decorrelated verifier may never be served on a PRODUCTION path',
    edge: attestedEdge({ attestation_decorrelated: false }),
    environment: 'production',
    expect: 'correlated-verifier-in-production',
  },
  {
    name: 'decorrelated null is treated as NOT decorrelated in production, never assumed',
    edge: attestedEdge({ attestation_decorrelated: null }),
    environment: 'production',
    expect: 'correlated-verifier-in-production',
  },
];

for (const vector of NEGATIVE_VECTORS) {
  test(`NEGATIVE: ${vector.name} → card BLOCKED`, () => {
    const environment = vector.environment ?? 'demo';
    const failures = edgeTrustFailures(vector.edge, environment);
    assert.ok(
      failures.length > 0,
      `expected the gate to BLOCK, but it reported no failures for: ${vector.name}`,
    );
    assert.ok(
      failures.some((f) => f.code === vector.expect),
      `expected failure '${vector.expect}', got [${failures.map((f) => f.code).join(', ')}]`,
    );
  });
}

test('NEGATIVE: a rejected edge is stopped by the GATE, not by the branch classifier', () => {
  // The classifier is happy — it is the trust gate that must be the thing saying no. If this
  // ever inverts (classifier rejects, gate passes), the negative vectors above would be
  // passing for the wrong reason.
  const untrusted = attestedEdge({
    attestation_returned_model: null,
    attestation_family: null,
    attestation_attested: null,
    verification: {},
  });
  const classified = classifyPattern(
    {
      patternKey: 'signal:subject_metric:up',
      kind: 'signal',
      metricKeys: ['subject_metric'],
      states: { subject_metric: 'up' },
      stats: {},
    },
    [untrusted],
    () => null,
    { qMax: 0.05, nEffMin: 10 },
  );
  assert.ok(classified);
  assert.equal(rendersCard(classified), true, 'the branch alone would have rendered a card');
  assert.ok(
    edgeTrustFailures(untrusted, 'demo').length > 0,
    'the trust gate is what must block it',
  );
});

// ─── The mapping itself: absence never becomes a passing input ──────────────────────────────

test('trustInputsFor: an empty row maps to NO artifact and NO attestation (not to defaults)', () => {
  const inputs = trustInputsFor({
    posture: null,
    artifactRevision: null,
    artifactContentHash: null,
    returnedModel: null,
    returnedVersion: null,
    modelFamily: null,
    decorrelated: null,
    attested: null,
  });
  assert.equal(inputs.artifact, undefined);
  assert.equal(inputs.attestation, undefined);
});

test('trustInputsFor: a sentinel identity is mapped through as attested = FALSE', () => {
  const inputs = trustInputsFor({
    posture: 'live',
    artifactRevision: 'r1',
    artifactContentHash: HASH_A,
    returnedModel: TEST_MODE_LABEL,
    returnedVersion: null,
    modelFamily: 'openai',
    decorrelated: true,
    attested: true, // the row CLAIMS attestation…
  });
  assert.equal(inputs.attestation?.attested, false); // …the gate does not believe it
  // The identity itself is still carried through — honest history, not erased.
  assert.equal(inputs.attestation?.returnedModel, TEST_MODE_LABEL);
});

test('composeTrustPosture keeps the STORED attested value verbatim (provenance is not rewritten)', () => {
  // The correction belongs to the gate. What lands on the card must still say what the row said,
  // so a curator reading provenance sees the contradiction rather than a laundered value.
  const trust = composeTrustPosture(attestedEdge({ attestation_returned_model: TEST_MODE_LABEL }));
  assert.equal(trust.attested, true);
  assert.equal(trust.returnedModel, TEST_MODE_LABEL);
});

// ─── Drift guard: the serving-side sentinel list vs the router's real label ──────────────────

test('DRIFT GUARD: the router TEST_MODE_LABEL is recognised as a non-provider model string', () => {
  // composer.ts cannot import from tools/ (it is a Deno edge function), so its sentinel list is
  // a deliberate copy. This asserts the copy still covers the REAL label — if llm-router's
  // wording changes to something the pattern misses, this fails here instead of silently
  // letting a test-mode identity read as attestation at serving time.
  assert.equal(isNonProviderModelString(TEST_MODE_LABEL), true);
});

test('DRIFT GUARD: a genuine provider model id is NOT mistaken for a sentinel', () => {
  for (const id of ['gpt-5', 'gpt-5-2026-01-14', 'claude-sonnet-5', 'gemini-2.5-pro']) {
    assert.equal(isNonProviderModelString(id), false, `${id} must not match a sentinel pattern`);
  }
});

test('DRIFT GUARD: null is not a sentinel (it is an ABSENT identity, handled as missing)', () => {
  assert.equal(isNonProviderModelString(null), false);
});

// ─── The demand-key surface is unchanged by this unit (documented, not asserted elsewhere) ───

test('codes() helper sanity: the positive control really does report zero codes', () => {
  assert.deepEqual(codes(attestedEdge(), 'demo'), []);
});
