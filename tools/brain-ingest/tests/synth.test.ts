/**
 * A8 · Synthesis tests (session U10) — node:test via tsx, NO network.
 *
 * Covers the gate the session brief names: input-assembly determinism; response
 * post-processing (valid claim passes; fabricated quote → A9 quoteCheck reject;
 * unrequested-pair reject; foreign-paperId reject; offset backfill; edgeId
 * normalization; schema-invalid reject); artifact dedupe; and an end-to-end run
 * with a mocked router + fixture text (the real shared zod validateClaim is used
 * via the module's runtime loader, so the gate is exercised for real).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  assembleSynthesisInput,
  dedupeAgainst,
  appendClaimsToDir,
  claimDedupeKey,
  loadClaimValidator,
  loadCopyValidator,
  pairFromKeys,
  processSynthesisResponse,
  segmentSentences,
  selectPassages,
  synthesize,
  type ClaimValidator,
} from '../src/synth/index.js';
import type { SynthClaim, SynthPair, SynthRawRecord } from '../src/synth/index.js';
import type { LlmRequest, LlmResponse } from '../../llm-router/src/index.js';
import { logicalCallIdSha256 } from '../../llm-router/src/index.js';
import { testAcceptanceAuthorization } from './acceptanceHelpers.js';

// ── fixtures ─────────────────────────────────────────────────────────────────

const PAPER_ID = 'fix:paper-1';
// A claim-bearing sentence sits in the middle; offsets must round-trip.
const FIXTURE_TEXT =
  'Introduction paragraph with unrelated content. ' +
  'Higher gut comfort was associated with better mood in the studied cohort of healthy adults. ' +
  'A closing sentence about methods and limitations.';
const QUOTE = 'Higher gut comfort was associated with better mood in the studied cohort of healthy adults.';
const PAPER_METADATA = new Map([[PAPER_ID, { title: 'Fixture paper', year: 2026, evidenceTier: 3 as const }]]);
const AUTHORIZATION = testAcceptanceAuthorization();

const PAIR: SynthPair = pairFromKeys('gut_comfort_score', 'mood_score', [
  'gut',
  'comfort',
  'mood',
  'associated',
]);

/** A well-formed raw claim as the synthesis LLM would emit it (edgeId deliberately wrong). */
function validRawClaim(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    edgeId: 'MODEL-SHOULD-NOT-BE-TRUSTED',
    subject: 'gut_comfort_score',
    object: 'mood_score',
    relation: 'correlates',
    claimKind: 'correlational',
    effect: { size: null, unit: null, ci: null },
    population: 'healthy adults',
    citations: [
      {
        paperId: PAPER_ID,
        title: 'Fixture paper',
        year: 2026,
        population: 'healthy adults',
        evidenceTier: 2,
        impactTier: 'moderate',
        stance: 'supports',
      },
    ],
    quoteSpans: [{ paperId: PAPER_ID, quote: QUOTE, locator: null, charStart: null, charEnd: null }],
    derivation: 'The sentence directly associates gut comfort with mood, so the two correlate.',
    ...overrides,
  };
}

function texts(): Map<string, string> {
  return new Map([[PAPER_ID, FIXTURE_TEXT]]);
}

// The REAL shared copy gate (O20) — loaded once; every ctx uses it unless a test overrides.
const validateCopy = await loadCopyValidator();

function ctxWith(validateClaim: ClaimValidator, over: Record<string, unknown> = {}) {
  return {
    pair: PAIR,
    allowedPaperIds: [PAPER_ID],
    texts: texts(),
    paperMetadata: PAPER_METADATA,
    validateClaim,
    validateCopy,
    synthesisModel: 'test-model',
    promptVersion: 'synthesis-test.1',
    now: () => Date.parse('2026-07-16T00:00:00.000Z'),
    ...over,
  };
}

function tmp(): string {
  return mkdtempSync(join(tmpdir(), 'synth-'));
}

// ── input assembly (determinism) ───────────────────────────────────────────────

test('passages: sentence offsets round-trip as verbatim slices', () => {
  const sents = segmentSentences(FIXTURE_TEXT);
  for (const s of sents) {
    assert.equal(FIXTURE_TEXT.slice(s.charStart, s.charEnd), s.text);
  }
});

test('passages: keyword prefilter selects the claim-bearing sentence, deterministically', () => {
  const a = selectPassages(FIXTURE_TEXT, PAIR.terms);
  const b = selectPassages(FIXTURE_TEXT, PAIR.terms);
  assert.deepEqual(a, b); // deterministic
  assert.ok(a.length >= 1);
  assert.ok(a.some((p) => p.text.includes('gut comfort was associated with better mood')));
  // the matched passage's own offsets slice back to its text
  for (const p of a) assert.equal(FIXTURE_TEXT.slice(p.charStart, p.charEnd), p.text);
});

test('assembleSynthesisInput: allowed ids + prompt name the pair and passages', () => {
  const asm = assembleSynthesisInput(PAIR, texts());
  assert.deepEqual(asm.allowedPaperIds, [PAPER_ID]);
  assert.ok(asm.prompt.includes('gut_comfort_score'));
  assert.ok(asm.prompt.includes('mood_score'));
  assert.ok(asm.prompt.includes(PAPER_ID));
  assert.ok(asm.papers[0]!.passages.length >= 1);
});

// ── post-processing (the gate) ─────────────────────────────────────────────────

test('postprocess: a valid claim passes; edgeId normalized; offsets backfilled', async () => {
  const validateClaim = await loadClaimValidator();
  const res = processSynthesisResponse(
    JSON.stringify({ claims: [validRawClaim()] }),
    ctxWith(validateClaim),
  );
  assert.equal(res.rejected.length, 0);
  assert.equal(res.accepted.length, 1);
  const claim = res.accepted[0] as SynthClaim;
  // edgeId FORCED (the model's value was ignored)
  assert.equal(claim.edgeId, 'gut_comfort_score|correlates|mood_score');
  // offsets backfilled from quoteCheck's computed positions
  const span = claim.quoteSpans[0]!;
  const expectedStart = FIXTURE_TEXT.indexOf(QUOTE);
  assert.equal(span.charStart, expectedStart);
  assert.equal(span.charEnd, expectedStart + QUOTE.length);
  assert.equal(FIXTURE_TEXT.slice(span.charStart!, span.charEnd!), QUOTE);
  // provenance stamped by the pipeline
  assert.equal(claim.synthesisModel, 'test-model');
  assert.equal(claim.promptVersion, 'synthesis-test.1');
});

test('postprocess: citation title/year/evidenceTier are overwritten from corpus metadata', async () => {
  const validateClaim = await loadClaimValidator();
  const raw = validRawClaim({
    citations: [{
      paperId: PAPER_ID,
      title: 'MODEL HALLUCINATION',
      year: 1900,
      population: 'healthy adults',
      evidenceTier: 2,
      impactTier: 'moderate',
      stance: 'supports',
    }],
  });
  const result = processSynthesisResponse(JSON.stringify({ claims: [raw] }), ctxWith(validateClaim));
  assert.equal(result.accepted[0]?.citations[0]?.title, 'Fixture paper');
  assert.equal(result.accepted[0]?.citations[0]?.year, 2026);
  assert.equal(result.accepted[0]?.citations[0]?.evidenceTier, 3);
});

test('postprocess: a fabricated quote is rejected by A9 quoteCheck', async () => {
  const validateClaim = await loadClaimValidator();
  const fabricated = validRawClaim({
    quoteSpans: [
      {
        paperId: PAPER_ID,
        quote: 'This sentence never appears anywhere in the fixture paper text.',
        locator: null,
        charStart: null,
        charEnd: null,
      },
    ],
  });
  const res = processSynthesisResponse(JSON.stringify({ claims: [fabricated] }), ctxWith(validateClaim));
  assert.equal(res.accepted.length, 0);
  assert.equal(res.rejected.length, 1);
  assert.equal(res.rejected[0]!.reason, 'quote-not-found');
});

test('postprocess: a claim for an unrequested pair is rejected (C9)', async () => {
  const validateClaim = await loadClaimValidator();
  const offPair = validRawClaim({ subject: 'energy_score', object: 'mood_score' });
  const res = processSynthesisResponse(JSON.stringify({ claims: [offPair] }), ctxWith(validateClaim));
  assert.equal(res.accepted.length, 0);
  assert.equal(res.rejected[0]!.reason, 'unrequested-pair');
});

test('postprocess: a claim citing a foreign paperId is rejected', async () => {
  const validateClaim = await loadClaimValidator();
  const foreign = validRawClaim({
    quoteSpans: [{ paperId: 'fix:not-provided', quote: QUOTE, locator: null, charStart: null, charEnd: null }],
  });
  const res = processSynthesisResponse(JSON.stringify({ claims: [foreign] }), ctxWith(validateClaim));
  assert.equal(res.accepted.length, 0);
  assert.equal(res.rejected[0]!.reason, 'foreign-paper');
});

test('postprocess: a schema-invalid claim is rejected by validateClaim', async () => {
  const validateClaim = await loadClaimValidator();
  const noCite = validRawClaim({ citations: [] }); // contract requires ≥1 citation
  const res = processSynthesisResponse(JSON.stringify({ claims: [noCite] }), ctxWith(validateClaim));
  assert.equal(res.accepted.length, 0);
  assert.equal(res.rejected[0]!.reason, 'schema-invalid');
});

test('postprocess: unparseable JSON throws; an empty claims array is valid', async () => {
  const validateClaim = await loadClaimValidator();
  assert.throws(() => processSynthesisResponse('not json', ctxWith(validateClaim)));
  const empty = processSynthesisResponse(JSON.stringify({ claims: [] }), ctxWith(validateClaim));
  assert.deepEqual(empty, { accepted: [], rejected: [] });
});

// ── O20 copy gate over derivation (production seam) ────────────────────────────

test('O20: a derivation with diagnostic language is rejected by the copy gate', async () => {
  const validateClaim = await loadClaimValidator();
  const diagnostic = validRawClaim({
    // Otherwise fully valid + grounded — only the derivation copy is diagnostic.
    derivation: 'Consider treatment options: the sentence associates gut comfort with mood.',
  });
  const res = processSynthesisResponse(JSON.stringify({ claims: [diagnostic] }), ctxWith(validateClaim));
  assert.equal(res.accepted.length, 0);
  assert.equal(res.rejected.length, 1);
  assert.equal(res.rejected[0]!.reason, 'copy-gate');
  assert.match(res.rejected[0]!.detail, /validateCopyString/);
});

test('O20: benign words that merely CONTAIN a forbidden term pass the copy gate (word boundaries)', async () => {
  // Mirrors tools/rules/tests/copy_guidelines.test.ts TRUE_NEGATIVES: "stillness" contains
  // "illness", "preconditioning" contains "condition", "mistreatment" contains "treatment" —
  // the word-boundary matcher must allow all of them (guard against over-blocking).
  const validateClaim = await loadClaimValidator();
  const benign = validRawClaim({
    derivation:
      'Preconditioning, stillness and the mistreatment of outliers do not change the reading: gut comfort correlates with mood.',
  });
  const res = processSynthesisResponse(JSON.stringify({ claims: [benign] }), ctxWith(validateClaim));
  assert.deepEqual(res.rejected, []);
  assert.equal(res.accepted.length, 1);
});

// ── artifact dedupe ────────────────────────────────────────────────────────────

test('artifact: dedupeAgainst skips a repeated edgeId+promptVersion+paperSet', async () => {
  const validateClaim = await loadClaimValidator();
  const res = processSynthesisResponse(JSON.stringify({ claims: [validRawClaim()] }), ctxWith(validateClaim));
  const claim = res.accepted[0] as SynthClaim;
  const key = claimDedupeKey(claim);
  const first = dedupeAgainst(new Set(), [claim]);
  assert.equal(first.toWrite.length, 1);
  const second = dedupeAgainst(new Set([key]), [claim]);
  assert.equal(second.toWrite.length, 0);
  assert.equal(second.skipped.length, 1);
});

test('artifact: appendClaimsToDir is idempotent across runs', async () => {
  const validateClaim = await loadClaimValidator();
  const res = processSynthesisResponse(JSON.stringify({ claims: [validRawClaim()] }), ctxWith(validateClaim));
  const dir = tmp();
  try {
    const w1 = appendClaimsToDir(dir, res.accepted);
    assert.equal(w1.written, 1);
    const w2 = appendClaimsToDir(dir, res.accepted);
    assert.equal(w2.written, 0);
    assert.equal(w2.skipped, 1);
    const lines = readFileSync(w1.path, 'utf8').trim().split(/\r?\n/);
    assert.equal(lines.length, 1); // no duplicate line appended
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('artifact: claim dedupe separators are runtime NULs without binary source bytes', async () => {
  const validateClaim = await loadClaimValidator();
  const claim = processSynthesisResponse(
    JSON.stringify({ claims: [validRawClaim()] }),
    ctxWith(validateClaim),
  ).accepted[0]!;
  const key = claimDedupeKey(claim);
  assert.equal(key.charCodeAt(claim.edgeId.length), 0);
  assert.equal(readFileSync(new URL('../src/synth/artifact.ts', import.meta.url)).includes(0), false);
});

// ── end-to-end (mocked router + fixture text, real validateClaim) ──────────────

test('synthesize: end-to-end accepts the grounded claim, rejects the fabricated one, writes the artifact', async () => {
  const validateClaim = await loadClaimValidator();
  const router = {
    async route(_req: LlmRequest): Promise<LlmResponse> {
      const fabricated = validRawClaim({
        relation: 'increases',
        quoteSpans: [
          { paperId: PAPER_ID, quote: 'A quote that is not present in the text.', locator: null, charStart: null, charEnd: null },
        ],
      });
      return {
        text: JSON.stringify({ claims: [validRawClaim(), fabricated] }),
        model: 'mock-fable',
        // R4-U4/O27 (B-BR1): a mailbox fulfilment is never provider-attested.
        modelIdentity: {
          model: 'mock-fable',
          source: 'local-agent-mailbox',
          providerAttested: false,
          family: null,
          returnedVersion: null,
          decorrelatedFromSynthesis: null,
        },
        route: 'local_agent',
        usage: { inputTokens: 10, outputTokens: 20 },
      };
    },
  };
  const dir = tmp();
  try {
    const result = await synthesize({
      pairs: [PAIR],
      paperUids: [PAPER_ID],
      paperMetadata: PAPER_METADATA,
      edgesDir: dir,
      router,
      textLoader: async (id) => (id === PAPER_ID ? FIXTURE_TEXT : null),
      validateClaim,
      activeMetricKeys: new Set(['gut_comfort_score', 'mood_score']),
      now: () => Date.parse('2026-07-16T00:00:00.000Z'),
    });
    assert.equal(result.accepted.length, 1);
    assert.equal(result.rejectedCount, 1);
    assert.equal(result.write?.written, 1);
    const written = readFileSync(result.write!.path, 'utf8').trim();
    const rec = JSON.parse(written) as SynthClaim;
    assert.equal(rec.edgeId, 'gut_comfort_score|correlates|mood_score');
    assert.equal(rec.synthesisModel, 'mock-fable');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('synthesize acceptance: schema retry reuses one logical id and retains provider identity/raw evidence', async () => {
  const validateClaim = await loadClaimValidator();
  const requests: LlmRequest[] = [];
  const rawText = JSON.stringify({ provider: 'agnes-free-evidence', claims: [validRawClaim()] });
  const router = {
    async route(req: LlmRequest): Promise<LlmResponse> {
      requests.push(req);
      const text = requests.length === 1
        ? JSON.stringify({ claims: [validRawClaim({ subject: 'not_requested' })] })
        : JSON.stringify({ claims: [validRawClaim()] });
      return {
        text,
        model: 'claude-sonnet-5-20260701',
        modelIdentity: {
          model: 'claude-sonnet-5-20260701',
          source: 'provider-response',
          providerAttested: true,
          family: 'anthropic',
          returnedVersion: null,
          decorrelatedFromSynthesis: false,
        },
        route: 'api_worker',
        usage: { inputTokens: 10, outputTokens: 20 },
        rawBody: {
          body: rawText,
          bytes: Buffer.byteLength(rawText),
          truncated: false,
          capBytes: 262144,
          sha256: `sha256:${'d'.repeat(64)}`,
        },
      };
    },
  };
  const dir = tmp();
  try {
    const result = await synthesize({
      pairs: [PAIR],
      paperUids: [PAPER_ID],
      paperMetadata: PAPER_METADATA,
      edgesDir: dir,
      router,
      textLoader: async () => FIXTURE_TEXT,
      validateClaim,
      activeMetricKeys: new Set(['gut_comfort_score', 'mood_score']),
      acceptance: { acceptanceRunId: 'acceptance-1', authorization: AUTHORIZATION },
      maxAttempts: 3,
      now: () => Date.parse('2026-07-16T00:00:00.000Z'),
    });
    assert.equal(requests.length, 2);
    assert.deepEqual(
      new Set(requests.map((req) => req.acceptance?.logicalCallId)),
      new Set([logicalCallIdSha256('synthesis', PAIR.id)]),
    );
    assert.equal(result.evidence?.written, 2);
    const rawLines = readFileSync(join(dir, 'synthesis-raw.jsonl'), 'utf8').trim().split(/\r?\n/);
    const raw = JSON.parse(rawLines[1]!) as SynthRawRecord;
    assert.equal(raw.pairId, PAIR.id);
    assert.equal(raw.synthesisRunId, 'acceptance-1');
    assert.equal(raw.logicalCallId, logicalCallIdSha256('synthesis', PAIR.id));
    assert.equal(raw.attempt, 2);
    assert.equal(raw.result, 'accepted');
    assert.equal(raw.returnedModel, 'claude-sonnet-5-20260701');
    assert.equal(raw.family, 'anthropic');
    assert.equal(raw.attested, true);
    assert.equal(raw.raw.body, rawText);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('synthesize acceptance: a valid adverse empty claim set does not retry or fall back', async () => {
  const validateClaim = await loadClaimValidator();
  const requests: LlmRequest[] = [];
  const dir = tmp();
  try {
    const rawText = '{"claims":[]}';
    const result = await synthesize({
      pairs: [PAIR],
      paperUids: [PAPER_ID],
      paperMetadata: PAPER_METADATA,
      edgesDir: dir,
      router: {
        async route(req: LlmRequest): Promise<LlmResponse> {
          requests.push(req);
          return {
            text: rawText,
            model: 'claude-sonnet-5',
            modelIdentity: {
              model: 'claude-sonnet-5', source: 'provider-response', providerAttested: true,
              family: 'anthropic', returnedVersion: null, decorrelatedFromSynthesis: false,
            },
            route: 'api_worker',
            usage: { inputTokens: 1, outputTokens: 1 },
            rawBody: {
              body: rawText,
              bytes: Buffer.byteLength(rawText),
              truncated: false,
              capBytes: 262144,
              sha256: `sha256:${'e'.repeat(64)}`,
            },
          };
        },
      },
      textLoader: async () => FIXTURE_TEXT,
      validateClaim,
      activeMetricKeys: new Set(['gut_comfort_score', 'mood_score']),
      acceptance: { acceptanceRunId: 'acceptance-2', authorization: AUTHORIZATION },
      maxAttempts: 3,
    });
    assert.equal(requests.length, 1);
    assert.equal(result.accepted.length, 0);
    assert.equal(result.rejectedCount, 0);
    assert.equal(result.evidence?.written, 1);
    const raw = JSON.parse(readFileSync(join(dir, 'synthesis-raw.jsonl'), 'utf8').trim()) as SynthRawRecord;
    assert.equal(raw.result, 'adverse-empty');
    assert.equal(raw.pairId, PAIR.id);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('synthesize acceptance: terminal enforcement rejection still persists pair-scoped provider evidence', async () => {
  const validateClaim = await loadClaimValidator();
  const dir = tmp();
  let requests = 0;
  try {
    const rawText = JSON.stringify({ claims: [validRawClaim({ subject: 'not_requested' })] });
    const result = await synthesize({
      pairs: [PAIR],
      paperUids: [PAPER_ID],
      paperMetadata: PAPER_METADATA,
      edgesDir: dir,
      router: {
        async route(): Promise<LlmResponse> {
          requests++;
          return {
            text: rawText,
            model: 'claude-sonnet-5',
            modelIdentity: {
              model: 'claude-sonnet-5',
              source: 'provider-response',
              providerAttested: true,
              family: 'anthropic',
              returnedVersion: null,
              decorrelatedFromSynthesis: false,
            },
            route: 'api_worker',
            usage: { inputTokens: 1, outputTokens: 1 },
            rawBody: {
              body: rawText,
              bytes: Buffer.byteLength(rawText),
              truncated: false,
              capBytes: 262144,
              sha256: `sha256:${'f'.repeat(64)}`,
            },
          };
        },
      },
      textLoader: async () => FIXTURE_TEXT,
      validateClaim,
      activeMetricKeys: new Set(['gut_comfort_score', 'mood_score']),
      acceptance: { acceptanceRunId: 'acceptance-terminal-reject', authorization: AUTHORIZATION },
      maxAttempts: 1,
    });
    assert.equal(requests, 1);
    assert.equal(result.accepted.length, 0);
    assert.equal(result.rejectedCount, 1);
    assert.equal(result.evidence?.written, 1);
    const raw = JSON.parse(readFileSync(join(dir, 'synthesis-raw.jsonl'), 'utf8').trim()) as SynthRawRecord;
    assert.equal(raw.result, 'enforcement-rejected');
    assert.equal(raw.acceptedCount, 0);
    assert.equal(raw.rejectedCount, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('synthesize: rejects an explicit pair whose endpoint is not an active metric', async () => {
  const validateClaim = await loadClaimValidator();
  await assert.rejects(
    synthesize({
      pairs: [pairFromKeys('gut_comfort_score', 'not_a_metric')],
      paperUids: [PAPER_ID],
      paperMetadata: PAPER_METADATA,
      router: { async route() { throw new Error('should not be called'); } },
      textLoader: async () => FIXTURE_TEXT,
      validateClaim,
      activeMetricKeys: new Set(['gut_comfort_score', 'mood_score']),
    }),
    /not an active shared\/metrics registry key/,
  );
});
