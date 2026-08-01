/**
 * Pure-logic tests for the claims-curation helpers (`src/lib/claimsControl.ts`,
 * O13 run-2 U9). No live Supabase — the /api/claims* route handlers are IO glue
 * over these functions (nao's ingestControl/modelsControl convention).
 *
 * Asserts:
 *  - TEST_MODE_LABEL is pinned verbatim to tools/llm-router/src/types.ts (the
 *    wording is load-bearing — Run 2.0 posture decision; nao cannot import
 *    tools/ code, so the literal is duplicated under this coupling test);
 *  - reject-body validation: edgeId shape (relation key), length bounds,
 *    optional reason trimming/nulling, no other action smuggled in;
 *  - citation containment value shape (the `claim->'citations' @>` filter);
 *  - claim/verdict merging: verification presence, numeric edge_score coercion,
 *    human-verdict passthrough, claims without verification stay visible.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  TEST_MODE_LABEL,
  citationsContainsValue,
  mergeClaimsWithVerdicts,
  parseRejectBody,
  type ClaimRow,
  type VerifiedEdgeRow,
} from '../src/lib/claimsControl.ts';

// ── TEST_MODE_LABEL coupling ─────────────────────────────────────────────────

test('TEST_MODE_LABEL matches tools/llm-router/src/types.ts verbatim', () => {
  const routerTypes = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '..', '..', '..', 'tools', 'llm-router', 'src', 'types.ts',
  );
  const source = readFileSync(routerTypes, 'utf8');
  assert.ok(
    source.includes(`'${TEST_MODE_LABEL}'`),
    'nao TEST_MODE_LABEL drifted from tools/llm-router TEST_MODE_LABEL — the stamp wording is load-bearing',
  );
});

// ── parseRejectBody ──────────────────────────────────────────────────────────

test('parseRejectBody accepts a relation-key edgeId with an optional reason', () => {
  const r = parseRejectBody({ edgeId: 'a|increases|b', reason: '  bad quote  ' });
  assert.deepEqual(r, { ok: true, value: { edgeId: 'a|increases|b', reason: 'bad quote' } });
});

test('parseRejectBody nulls an absent/empty reason', () => {
  for (const body of [{ edgeId: 'a|increases|b' }, { edgeId: 'a|increases|b', reason: '' }, { edgeId: 'a|increases|b', reason: null }]) {
    const r = parseRejectBody(body);
    assert.ok(r.ok);
    assert.equal(r.value.reason, null);
  }
});

test('parseRejectBody rejects non-object bodies', () => {
  for (const body of [null, [], 'x', 42]) {
    assert.equal(parseRejectBody(body).ok, false);
  }
});

test('parseRejectBody rejects malformed edgeIds', () => {
  for (const edgeId of ['', '   ', 'no-pipes', 'one|pipe', 'a|b|c|d', 42, undefined]) {
    assert.equal(parseRejectBody({ edgeId }).ok, false, `edgeId ${String(edgeId)} should fail`);
  }
});

test('parseRejectBody enforces length bounds', () => {
  assert.equal(parseRejectBody({ edgeId: `${'a'.repeat(600)}|x|b` }).ok, false);
  assert.equal(parseRejectBody({ edgeId: 'a|x|b', reason: 'r'.repeat(2001) }).ok, false);
  assert.equal(parseRejectBody({ edgeId: 'a|x|b', reason: 'r'.repeat(2000) }).ok, true);
});

test('parseRejectBody rejects a non-string reason', () => {
  assert.equal(parseRejectBody({ edgeId: 'a|x|b', reason: 42 }).ok, false);
});

// ── citationsContainsValue ───────────────────────────────────────────────────

test('citationsContainsValue builds the jsonb containment value as a JSON string', () => {
  // A string, NOT an array: postgrest-js serialises arrays as Postgres array
  // literals (`cs.{[object Object]}` → "invalid input syntax for type json");
  // only a string reaches PostgREST raw as `cs.<json>` (U9 live-proof finding).
  const v = citationsContainsValue('fixture:sleep-hrv-meta-2023');
  assert.equal(typeof v, 'string');
  assert.deepEqual(JSON.parse(v), [{ paperId: 'fixture:sleep-hrv-meta-2023' }]);
});

// ── mergeClaimsWithVerdicts ──────────────────────────────────────────────────

const claim = (edgeId: string): ClaimRow => ({
  edge_id: edgeId,
  subject: edgeId.split('|')[0]!,
  object: edgeId.split('|')[2]!,
  relation: edgeId.split('|')[1]!,
  claim: {
    claimKind: 'causal',
    derivation: 'why',
    population: 'adults',
    citations: [{ paperId: 'p1', title: 't', year: 2023 }],
    quoteSpans: [{ paperId: 'p1', quote: 'q' }],
  },
  synthesised_at: '2026-07-10T00:00:00Z',
});

test('mergeClaimsWithVerdicts joins the verified_edges row and coerces edge_score', () => {
  const edges: VerifiedEdgeRow[] = [
    {
      edge_id: 'a|increases|b',
      verification: {
        confidence: 0.82,
        quoteCheck: { spansFound: 1, spansTotal: 1, allPresent: true },
        corroboration: { supporting: 1, contradicting: 1 },
        verifierModel: 'config:agnes-2.5-flash',
        attestation: {
          returnedModel: 'agnes-2.5-flash',
          family: 'agnes',
          decorrelated: true,
          attested: true,
        },
      },
      verdict: 'supported',
      serving_band: 'high',
      edge_score: '0.855', // numeric arrives as a string over PostgREST
      verified_at: '2026-07-12T00:00:00Z',
      human_verdict: null,
      human_verdict_at: null,
    },
  ];
  const [v] = mergeClaimsWithVerdicts([claim('a|increases|b')], edges);
  assert.equal(v!.verification?.verdict, 'supported');
  assert.equal(v!.verification?.edgeScore, 0.855);
  assert.equal(v!.verification?.confidence, 0.82);
  assert.deepEqual(v!.verification?.corroboration, { supporting: 1, contradicting: 1 });
  assert.equal(v!.verification?.verifierIdentity, 'agnes-2.5-flash');
  assert.equal(v!.verification?.providerFamily, 'agnes');
  assert.equal(v!.verification?.decorrelated, true);
  assert.equal(v!.humanVerdict, null);
  assert.equal(v!.subject, 'a');
  assert.equal(v!.citations.length, 1);
});

test('mergeClaimsWithVerdicts keeps unverified claims visible with a null verification', () => {
  const [v] = mergeClaimsWithVerdicts([claim('a|correlates|b')], []);
  assert.equal(v!.verification, null);
  assert.equal(v!.humanVerdict, null);
  assert.equal(v!.derivation, 'why');
});

test('mergeClaimsWithVerdicts passes the human verdict through', () => {
  const edges: VerifiedEdgeRow[] = [
    {
      edge_id: 'a|increases|b',
      verification: {},
      verdict: 'supported',
      serving_band: 'high',
      edge_score: 0.9,
      verified_at: '2026-07-12T00:00:00Z',
      human_verdict: 'reject',
      human_verdict_at: '2026-07-24T10:00:00Z',
    },
  ];
  const [v] = mergeClaimsWithVerdicts([claim('a|increases|b')], edges);
  assert.equal(v!.humanVerdict, 'reject');
  assert.equal(v!.humanVerdictAt, '2026-07-24T10:00:00Z');
  // The verifier verdict is NOT hidden — the override is recorded on top, never an edit.
  assert.equal(v!.verification?.verdict, 'supported');
});
