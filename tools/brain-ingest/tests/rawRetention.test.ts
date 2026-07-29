/**
 * R4-U3 · RAW PROVIDER-BODY RETENTION, END TO END TO DISK.
 *
 * The failure this closes: the router parsed a provider response, kept text +
 * usage + model, and dropped the body; nothing downstream had a field for it, so
 * the evidence behind a verdict was gone the moment the call returned. A previous
 * run lost its provider evidence exactly that way and could not reconstruct it.
 *
 * What is pinned here:
 *  - a verifier call's raw body ROUND-TRIPS to `<edges-dir>/verification-raw.jsonl`
 *    and re-parses to the exact bytes the provider sent;
 *  - it is joined to its verification by the SAME (edgeId, verifiedAt) identity
 *    the edge-loader uses, and deduped on it;
 *  - a TRUNCATED body still records its cap, its original size, and a hash of the
 *    FULL body — truncation is never silent;
 *  - the raw body is NOT a field of the verification record the loader ingests
 *    (it must not reach a table that feeds user-facing output);
 *  - no raw body ⇒ no raw line, rather than an empty one.
 *
 * node:test via tsx. The router is a local stub — NO network, NO provider call.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  appendVerificationsToDir,
  buildRawRecord,
  loadVerificationValidator,
  rawVerificationsPath,
  verificationsPath,
  verify,
  verifyClaim,
} from '../src/verify/verifier.js';
import type { SynthClaim, VerifyRawRecord } from '../src/verify/types.js';
import type { LlmResponse, ModelIdentity } from '../../llm-router/src/index.js';

const VERIFIED_AT = '2026-07-29T00:00:00.000Z';
const NOW = (): number => Date.parse(VERIFIED_AT);

const PAPER_ID = 'fix:paper-1';
const QUOTE =
  'Higher gut comfort was associated with better mood in the studied cohort of healthy adults.';
const FIXTURE_TEXT = `Introduction paragraph. ${QUOTE} A closing sentence about methods.`;

function tmp(): string {
  return mkdtempSync(join(tmpdir(), 'brain-raw-'));
}

function makeClaim(): SynthClaim {
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
    synthesisedAt: VERIFIED_AT,
  };
}

function texts(): Map<string, string> {
  return new Map([[PAPER_ID, FIXTURE_TEXT]]);
}

/** An ATTESTED provider identity (what apiWorker produces from a real body). */
function attestedIdentity(model: string): ModelIdentity {
  return {
    model,
    source: 'provider-response',
    providerAttested: true,
    family: 'anthropic',
    returnedVersion: null,
    decorrelatedFromSynthesis: true,
  };
}

/** The verifier reply the enforcement layer accepts (quote present, source supports). */
function verdictJson(): string {
  return JSON.stringify({
    verdict: 'supported',
    confidence: 0.7,
    evidenceTier: 4,
    directionMatchesClaim: true,
    claimKindMatchesClaim: true,
    supportedKind: 'correlational',
    scopeMismatch: false,
    supportedPopulation: 'healthy adults',
    effectSizeMatchesClaim: false,
    extractedEffectSize: null,
    sourceStances: [{ paperId: PAPER_ID, stance: 'supports' }],
  });
}

/**
 * The FULL provider body a real Anthropic Messages call returns — including the
 * fields the adapter drops (id, stop_reason, usage detail). Those dropped fields
 * are the whole point: they exist only in the retained raw body.
 */
function providerBody(text: string): string {
  return JSON.stringify({
    id: 'msg_01RawRetention',
    type: 'message',
    role: 'assistant',
    model: 'claude-sonnet-5',
    content: [{ type: 'text', text }],
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: { input_tokens: 1200, output_tokens: 240, cache_read_input_tokens: 0 },
  });
}

/** A LOCAL STUB router — never a provider. Serves one canned response with a raw body. */
function stubRouter(rawText: string, opts: { truncateTo?: number } = {}) {
  const bodyText = JSON.parse(rawText).content[0].text as string;
  const cap = opts.truncateTo ?? 0;
  const buf = Buffer.from(rawText, 'utf8');
  const truncated = cap > 0 && buf.byteLength > cap;
  return {
    async route(): Promise<LlmResponse> {
      return {
        text: bodyText,
        usage: { inputTokens: 1200, outputTokens: 240 },
        model: 'claude-sonnet-5',
        modelIdentity: attestedIdentity('claude-sonnet-5'),
        route: 'api_worker',
        rawBody: {
          body: truncated ? buf.subarray(0, cap).toString('utf8') : rawText,
          bytes: buf.byteLength,
          truncated,
          capBytes: cap,
          // Always over the FULL body — that is what makes a cut copy identifiable.
          sha256: `sha256:${'a'.repeat(64)}`,
        },
      };
    },
  };
}

// ── the pairing primitive ────────────────────────────────────────────────────────────────────

test('buildRawRecord: no response, or a response with no raw body, yields NO record', () => {
  const stub = { edgeId: 'e', verifiedAt: VERIFIED_AT, verifierModel: 'claude-sonnet-5' };
  assert.equal(buildRawRecord(stub, undefined), undefined);
  const noRaw: LlmResponse = {
    text: 'x',
    usage: { inputTokens: 1, outputTokens: 1 },
    model: 'claude-sonnet-5',
    modelIdentity: attestedIdentity('claude-sonnet-5'),
    route: 'local_agent',
  };
  assert.equal(buildRawRecord(stub, noRaw), undefined, 'absence is honest, not an empty record');
});

// ── round trip to disk ───────────────────────────────────────────────────────────────────────

test('ROUND TRIP: the raw provider body reaches disk and re-parses byte-identically', async () => {
  const validate = await loadVerificationValidator();
  const rawText = providerBody(verdictJson());
  const dir = tmp();
  try {
    const out = await verify({
      claims: [makeClaim()],
      texts: texts(),
      retrieve: { corpus: [] },
      router: stubRouter(rawText),
      validateVerification: validate,
      verifierModel: 'claude-sonnet-5',
      edgesDir: dir,
      now: NOW,
    });

    assert.equal(out.records.length, 1);
    assert.ok(out.write !== undefined);
    assert.equal(out.write.written, 1);
    assert.ok(out.write.raw !== undefined, 'raw retention happens without being asked for');
    assert.equal(out.write.raw.written, 1);
    assert.equal(out.write.raw.path, rawVerificationsPath(dir));

    // The bytes are ON DISK and identical to what the provider sent.
    const lines = readFileSync(rawVerificationsPath(dir), 'utf8').trim().split(/\r?\n/);
    assert.equal(lines.length, 1);
    const persisted = JSON.parse(lines[0]!) as VerifyRawRecord;
    assert.equal(persisted.raw.body, rawText);
    assert.equal(persisted.raw.truncated, false);
    assert.equal(persisted.attested, true);
    assert.equal(persisted.attestedModel, 'claude-sonnet-5');

    // And the fields the adapter drops survive ONLY here.
    const reparsed = JSON.parse(persisted.raw.body) as Record<string, unknown>;
    assert.equal(reparsed.id, 'msg_01RawRetention');
    assert.equal(reparsed.stop_reason, 'end_turn');

    // The join key is the loader's own (edge_id, verified_at) identity.
    const verification = JSON.parse(
      readFileSync(verificationsPath(dir), 'utf8').trim(),
    ) as Record<string, unknown>;
    assert.equal(persisted.edgeId, verification.edgeId);
    assert.equal(persisted.verifiedAt, verification.verifiedAt);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the raw body is NOT a field of the verification the loader ingests', async () => {
  const validate = await loadVerificationValidator();
  const dir = tmp();
  try {
    await verify({
      claims: [makeClaim()],
      texts: texts(),
      retrieve: { corpus: [] },
      router: stubRouter(providerBody(verdictJson())),
      validateVerification: validate,
      verifierModel: 'claude-sonnet-5',
      edgesDir: dir,
      now: NOW,
    });
    const line = readFileSync(verificationsPath(dir), 'utf8').trim();
    const verification = JSON.parse(line) as Record<string, unknown>;
    assert.equal(verification.rawBody, undefined);
    assert.equal(verification.raw, undefined);
    assert.ok(!line.includes('msg_01RawRetention'), 'no provider body text in the serving artifact');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('TRUNCATION IS RECORDED: cap, original size and full-body hash all survive', async () => {
  const validate = await loadVerificationValidator();
  const rawText = providerBody(verdictJson());
  const dir = tmp();
  try {
    await verify({
      claims: [makeClaim()],
      texts: texts(),
      retrieve: { corpus: [] },
      router: stubRouter(rawText, { truncateTo: 64 }),
      validateVerification: validate,
      verifierModel: 'claude-sonnet-5',
      edgesDir: dir,
      now: NOW,
    });
    const persisted = JSON.parse(
      readFileSync(rawVerificationsPath(dir), 'utf8').trim(),
    ) as VerifyRawRecord;
    assert.equal(persisted.raw.truncated, true, 'a cut body says so');
    assert.equal(persisted.raw.capBytes, 64, 'the cap that cut it is recorded');
    assert.equal(persisted.raw.bytes, Buffer.byteLength(rawText, 'utf8'), 'original size recorded');
    assert.ok(persisted.raw.body.length < rawText.length);
    assert.match(persisted.raw.sha256, /^sha256:[0-9a-f]{64}$/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('DEDUPE: re-appending the same (edgeId, verifiedAt) writes no second raw line', async () => {
  const validate = await loadVerificationValidator();
  const dir = tmp();
  try {
    const res = await verifyClaim(makeClaim(), {
      texts: texts(),
      retrieve: { corpus: [] },
      router: stubRouter(providerBody(verdictJson())),
      validateVerification: validate,
      verifierModel: 'claude-sonnet-5',
      now: NOW,
    });
    const raw = buildRawRecord(res.record!, res.response)!;
    assert.ok(raw !== undefined);

    const w1 = appendVerificationsToDir(dir, [res.record!], [raw]);
    assert.equal(w1.raw?.written, 1);
    const w2 = appendVerificationsToDir(dir, [res.record!], [raw]);
    assert.equal(w2.written, 0);
    assert.equal(w2.raw?.written, 0);
    assert.equal(w2.raw?.skipped, 1);
    assert.equal(readFileSync(rawVerificationsPath(dir), 'utf8').trim().split(/\r?\n/).length, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('no raw bodies in the batch ⇒ no side artifact is created at all', async () => {
  const validate = await loadVerificationValidator();
  const dir = tmp();
  try {
    // A router that returns no rawBody (the mailbox shape) — nothing to retain.
    const router = {
      async route(): Promise<LlmResponse> {
        return {
          text: verdictJson(),
          usage: { inputTokens: 1, outputTokens: 1 },
          model: 'MOCK',
          modelIdentity: {
            model: 'MOCK',
            source: 'local-agent-mailbox',
            providerAttested: false,
            family: null,
            returnedVersion: null,
            decorrelatedFromSynthesis: null,
          },
          route: 'local_agent',
        };
      },
    };
    const out = await verify({
      claims: [makeClaim()],
      texts: texts(),
      retrieve: { corpus: [] },
      router,
      validateVerification: validate,
      verifierModel: 'MOCK-no-provider',
      edgesDir: dir,
      now: NOW,
    });
    assert.equal(out.write?.written, 1);
    assert.equal(out.write?.raw, undefined);
    assert.equal(existsSync(rawVerificationsPath(dir)), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
