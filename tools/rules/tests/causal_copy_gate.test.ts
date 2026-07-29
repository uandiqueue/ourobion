// R4-U4 / O27 · B-SCI1 causal-verb copy gate tests — node:test via tsx, NO network, NO live LLM,
// NO DB. Deno-free / dependency-free imports straight from the shared contract + render.ts +
// composer.ts (style-matched to tools/rules/tests/engine_composer_render.test.ts).
//
// Covers:
//  1. the causal-verb copy gate (causalCopyViolations) with a NEGATIVE fixture table that MUST
//     fail for correlational/mechanistic claim kinds, and a POSITIVE table that MUST pass;
//  2. the SAME causal strings must PASS when effectiveKind === 'causal' (causal copy is licensed
//     for a causal claim — the gate is claim-kind-relative, not an absolute ban);
//  3. renderCard end-to-end: the exact B-SCI1 inflation ("tends to raise" on a correlational
//     claim) is blocked with failure.reason === 'causal-copy-gate' and names the offending term;
//  4. renderCard with an unknown claim kind ({effectiveKind: null}) fails 'claim-kind-missing';
//  5. postureDisclosure: fixture/live/null (fail-closed);
//  6. rendered fixture copy still passes the non-diagnostic copy gate (validateCopyString) —
//     both gates hold simultaneously;
//  7. composeClaimKind / composeTrustPosture over representative ServableEdge rows.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { causalCopyViolations } from '../../../shared/brain/trust_labels.ts';
import { validateCopyString } from '../../../shared/constants/copy_guidelines.ts';
import {
  EDGE_CARD_TEMPLATE,
  postureDisclosure,
  relationPhrase,
  renderCard,
} from '../../../supabase/functions/generate-insights/render.ts';
import {
  composeClaimKind,
  composeTrustPosture,
  type ServableEdge,
} from '../../../supabase/functions/generate-insights/composer.ts';

// ─── 1 · CAUSAL-VERB COPY GATE with NEGATIVE + POSITIVE FIXTURES ────────────

// Every one of these copy strings asserts one thing changing another. For a claim whose effective
// kind is weaker than 'causal' (correlational or mechanistic), NONE of these may ship — the gate
// must genuinely reject each one (a test that cannot fail is not a test).
const CAUSAL_COPY_MUST_FAIL: readonly string[] = [
  'Sleep raises your HRV.',
  'More steps lowers resting heart rate.',
  'Better sleep improves recovery.',
  'Hydration reduces fatigue.',
  'This leads to higher energy.',
];

// Association / hedged / non-directional copy — none of these assert causation, so the gate must
// let every one of them through regardless of claim kind.
const NON_CAUSAL_COPY_MUST_PASS: readonly string[] = [
  'Sleep is associated with higher HRV.',
  'These moved together in your data.',
  'Worth watching, not a verdict.',
];

const WEAKER_THAN_CAUSAL = ['correlational', 'mechanistic'] as const;

test('causalCopyViolations: the causal-copy table genuinely FAILS for correlational/mechanistic claims', () => {
  for (const kind of WEAKER_THAN_CAUSAL) {
    for (const text of CAUSAL_COPY_MUST_FAIL) {
      const violations = causalCopyViolations(text, kind);
      assert.ok(violations.length > 0, `expected "${text}" to trip the gate at kind "${kind}"`);
    }
  }
});

test('causalCopyViolations: the non-causal table genuinely PASSES for correlational/mechanistic claims', () => {
  for (const kind of WEAKER_THAN_CAUSAL) {
    for (const text of NON_CAUSAL_COPY_MUST_PASS) {
      const violations = causalCopyViolations(text, kind);
      assert.deepEqual(violations, [], `expected "${text}" to pass the gate at kind "${kind}"`);
    }
  }
});

// ─── 2 · the SAME causal strings PASS once effectiveKind === 'causal' ───────

test("causalCopyViolations: the SAME causal-verb strings PASS when effectiveKind === 'causal' " +
  '(causal copy is licensed for a causal claim)', () => {
  for (const text of CAUSAL_COPY_MUST_FAIL) {
    assert.deepEqual(causalCopyViolations(text, 'causal'), [], `expected "${text}" to pass at kind "causal"`);
  }
});

// ─── 3 · renderCard end-to-end — the exact B-SCI1 inflation, blocked ────────

function edgeCardValues(overrides: Partial<Record<string, string>> = {}): Record<string, string> {
  return {
    metric_a_label: 'sleep duration min',
    metric_b_label: 'hrv sdnn ms',
    direction_phrase: 'upward',
    relation_phrase: relationPhrase('increases', 'correlational'), // 'is associated with higher'
    posture_disclosure: '',
    ...overrides,
  };
}

test('renderCard: relationPhrase(increases, correlational) fills EDGE_CARD_TEMPLATE and PASSES the gate', () => {
  const result = renderCard(EDGE_CARD_TEMPLATE, edgeCardValues(), { effectiveKind: 'correlational' });
  assert.ok(result.ok, JSON.stringify(result));
});

test("renderCard: the causal phrase 'tends to raise' declared under effectiveKind 'correlational' " +
  "FAILS with reason 'causal-copy-gate' and names the offending term — THE B-SCI1 inflation, blocked", () => {
  const values = edgeCardValues({ relation_phrase: 'tends to raise' });
  const result = renderCard(EDGE_CARD_TEMPLATE, values, { effectiveKind: 'correlational' });
  assert.equal(result.ok, false);
  assert.ok(!result.ok);
  if (!result.ok) {
    assert.equal(result.failure.reason, 'causal-copy-gate');
    assert.ok('terms' in result.failure);
    if ('terms' in result.failure) {
      assert.ok(result.failure.terms.includes('raise'), JSON.stringify(result.failure.terms));
    }
  }
});

test('renderCard: causal claim kind licenses the causal template phrase end to end', () => {
  const values = edgeCardValues({ relation_phrase: relationPhrase('increases', 'causal') });
  const result = renderCard(EDGE_CARD_TEMPLATE, values, { effectiveKind: 'causal' });
  assert.ok(result.ok, JSON.stringify(result));
});

// ─── 4 · renderCard with an unestablished claim kind ────────────────────────

test("renderCard: claimKind {effectiveKind: null} fails with reason 'claim-kind-missing' (fail-closed)", () => {
  const result = renderCard(EDGE_CARD_TEMPLATE, edgeCardValues(), { effectiveKind: null });
  assert.equal(result.ok, false);
  assert.ok(!result.ok && result.failure.reason === 'claim-kind-missing');
});

// ─── 5 · postureDisclosure ───────────────────────────────────────────────────

test('postureDisclosure: fixture yields a non-empty disclosure ending in a space, ' +
  'preceding the claim text in the rendered body', () => {
  const disclosure = postureDisclosure('fixture');
  assert.ok(disclosure.length > 0);
  assert.ok(disclosure.endsWith(' '));

  const values = edgeCardValues({ posture_disclosure: disclosure });
  const result = renderCard(EDGE_CARD_TEMPLATE, values, { effectiveKind: 'correlational' });
  assert.ok(result.ok, JSON.stringify(result));
  if (result.ok) {
    assert.ok(result.copy.body.startsWith(disclosure), result.copy.body);
    const claimIndex = result.copy.body.indexOf('Your sleep duration min data shifted');
    assert.ok(claimIndex > 0, 'the claim text must follow the disclosure, not precede it');
    assert.equal(result.copy.body.indexOf(disclosure), 0);
    assert.ok(result.copy.body.indexOf(disclosure) < claimIndex);
  }
});

test("postureDisclosure: 'live' yields the empty string", () => {
  assert.equal(postureDisclosure('live'), '');
});

test('postureDisclosure: null THROWS (fail-closed — the trust gate must have blocked this earlier)', () => {
  assert.throws(() => postureDisclosure(null), /not disclosable/);
});

// ─── 6 · rendered fixture copy passes BOTH gates ─────────────────────────────

test('renderCard: rendered fixture-posture copy passes the non-diagnostic copy gate too ' +
  '(validateCopyString) — both gates must hold simultaneously', () => {
  const values = edgeCardValues({ posture_disclosure: postureDisclosure('fixture') });
  const result = renderCard(EDGE_CARD_TEMPLATE, values, { effectiveKind: 'correlational' });
  assert.ok(result.ok, JSON.stringify(result));
  if (result.ok) {
    assert.equal(validateCopyString(result.copy.title), true);
    assert.equal(validateCopyString(result.copy.body), true);
  }
});

// ─── 7 · composeClaimKind / composeTrustPosture over representative rows ────

function servableEdge(over: Partial<ServableEdge> = {}): ServableEdge {
  return {
    edge_id: 'a_metric|increases|b_metric',
    subject: 'a_metric',
    object: 'b_metric',
    relation: 'increases',
    verified_at: '2026-01-01T00:00:00Z',
    edge_score: 0.9,
    serving_band: 'high',
    claim: { claimKind: 'causal', citations: [{ paperId: 'fixture:paper' }] },
    verification: { claimKindCheck: { matchesClaim: false, supportedKind: 'correlational' } },
    ...over,
  };
}

test('composeClaimKind: claim.claimKind + verification.claimKindCheck.supportedKind yields the capped effective kind', () => {
  const composed = composeClaimKind(servableEdge());
  assert.deepEqual(composed, {
    claimed: 'causal',
    supported: 'correlational',
    effective: 'correlational',
    downgraded: true,
  });
});

test('composeClaimKind: missing claim.claimKind yields effective === null (fail-closed)', () => {
  const composed = composeClaimKind(servableEdge({ claim: { citations: [] } }));
  assert.equal(composed.claimed, null);
  assert.equal(composed.effective, null);
  assert.equal(composed.downgraded, false);
});

test('composeClaimKind: missing verification.claimKindCheck.supportedKind yields effective === null (fail-closed)', () => {
  const composed = composeClaimKind(servableEdge({ verification: {} }));
  assert.equal(composed.supported, null);
  assert.equal(composed.effective, null);
  assert.equal(composed.downgraded, false);
});

test('composeClaimKind: a claim/verification row with neither field set is also fail-closed to null', () => {
  const composed = composeClaimKind(servableEdge({ claim: null, verification: null }));
  assert.deepEqual(composed, { claimed: null, supported: null, effective: null, downgraded: false });
});

test('composeTrustPosture: every unknown field stays null; decorrelated/attested are NEVER defaulted to true', () => {
  const composed = composeTrustPosture(servableEdge({ claim: {}, verification: {} }));
  assert.deepEqual(composed, {
    posture: null,
    artifactRevision: null,
    artifactContentHash: null,
    returnedModel: null,
    returnedVersion: null,
    modelFamily: null,
    decorrelated: null,
    attested: null,
  });
});

test('composeTrustPosture: verification artifact/attestation win over the claim artifact when both present', () => {
  const composed = composeTrustPosture(
    servableEdge({
      claim: { artifact: { revision: 'r-claim', contentHash: `sha256:${'a'.repeat(64)}`, posture: 'live' } },
      verification: {
        artifact: { revision: 'r-verify', contentHash: `sha256:${'b'.repeat(64)}`, posture: 'fixture' },
        attestation: {
          returnedModel: 'model-x',
          returnedVersion: 'v2',
          family: 'family-x',
          decorrelated: false,
          attested: false,
        },
      },
    }),
  );
  assert.equal(composed.posture, 'fixture');
  assert.equal(composed.artifactRevision, 'r-verify');
  assert.equal(composed.decorrelated, false); // real false, not defaulted away
  assert.equal(composed.attested, false); // real false, not defaulted to true
});

test('composeTrustPosture: falls back to the claim artifact when the verification carries none', () => {
  const composed = composeTrustPosture(
    servableEdge({
      claim: { artifact: { revision: 'r-claim', contentHash: `sha256:${'c'.repeat(64)}`, posture: 'live' } },
      verification: {},
    }),
  );
  assert.equal(composed.posture, 'live');
  assert.equal(composed.artifactRevision, 'r-claim');
  assert.equal(composed.attested, null); // no attestation anywhere — stays null, never true
});
