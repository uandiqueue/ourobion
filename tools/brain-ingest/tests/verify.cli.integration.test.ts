/**
 * ACCEPTANCE TEST (i) — O15/B1 · the mandatory integration test on the REAL CLI seam.
 *
 * This drives the SAME entry the `brain-ingest verify` command executes — `main([...])`
 * with argv-level wiring (parseArgs → runVerify → new LlmRouter() → the real api_worker
 * route) — NOT a direct `verifyClaim` call with an injected `retrieve`. The router's
 * transport is captured at the FETCH level (global `fetch` stubbed, offline — no live LLM
 * call), so what we assert is the ACTUAL request the router would put on the wire.
 *
 * The gap this closes: pre-O15 the CLI never set `runOpts.retrieve`, so retrieval ran over
 * an empty corpus (zero sources) and evidence text was stripped at the citation type
 * boundary — the verifier prompt showed only paperId/year/tier/title. This test fails if
 * either regresses: it asserts the captured request contains (a) the evidence passage TEXT
 * and (b) its provenance (paperId + locator).
 *
 * NO network: `fetch` is stubbed; the fixture corpus covers the claim's cited paper so the
 * A9 quoteCheck never falls through to the R2 loader. Env vars are dummies (config load +
 * R2Store construction are keyless/offline; the text loader is never invoked here).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { main } from '../src/cli.js';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');
const CORPUS = join(FIXTURES, 'verify-corpus.jsonl');
const CLAIMS = join(FIXTURES, 'verify-claims.jsonl');
const EDGE = 'gut_comfort_score|correlates|mood_score';

/** The evidence text the verifier is shown for the cited paper's echo-controlled neighbours. */
const EVIDENCE_SNIPPETS = [
  'Greater gut discomfort correlated with lower mood scores',
  'improvement in mood tracked the improvement in gut comfort',
];

/** A canned OpenAI chat/completions body carrying a schema-passable verifier reply. */
function openAiBody(): unknown {
  const reply = JSON.stringify({
    verdict: 'uncertain',
    sourceStances: [],
    directionCheck: { matchesClaim: false },
    claimKindCheck: { matchesClaim: true, supportedKind: 'correlational' },
    scopeCheck: { mismatch: false, supportedPopulation: null },
    effectSizeCheck: { matchesClaim: false, extractedSize: null },
    evidenceTier: 3,
    confidence: 0.4,
  });
  return {
    model: 'gpt-5-test',
    choices: [{ message: { content: reply } }],
    usage: { prompt_tokens: 50, completion_tokens: 30 },
  };
}

test('ACCEPTANCE (i): real CLI verify seam puts evidence TEXT + provenance in the router request', async () => {
  const edgesDir = mkdtempSync(join(tmpdir(), 'verify-cli-'));

  // Env the CLI seam needs: dummy R2/config keys + an OpenAI key so the api_worker route
  // reaches fetch (the config's OpenAI-only TEST-MODE posture routes the verifier there).
  const savedEnv: Record<string, string | undefined> = {};
  const setEnv = (k: string, v: string): void => {
    savedEnv[k] = process.env[k];
    process.env[k] = v;
  };
  setEnv('OPENAI_API_KEY', 'sk-test-dummy');
  setEnv('INGEST_CONTACT_EMAIL', 'test@example.com');
  setEnv('OPENALEX_API_KEY', 'dummy');
  setEnv('R2_ENDPOINT', 'https://example.com');
  setEnv('R2_ACCESS_KEY_ID', 'dummy');
  setEnv('R2_SECRET_ACCESS_KEY', 'dummy');
  setEnv('R2_BUCKET', 'dummy');

  const capturedBodies: string[] = [];
  const savedFetch = globalThis.fetch;
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    capturedBodies.push(String(init.body));
    return {
      ok: true,
      status: 200,
      json: async () => openAiBody(),
      text: async () => JSON.stringify(openAiBody()),
    } as unknown as Response;
  }) as typeof fetch;

  try {
    const code = await main([
      'verify',
      '--from-claims', CLAIMS,
      '--corpus', CORPUS,
      '--edge', EDGE,
      '--edges-dir', edgesDir,
    ]);
    assert.equal(code, 0, 'verify command should exit 0');

    // The router actually dispatched (fetch was hit) — no live call, our stub answered.
    assert.equal(capturedBodies.length >= 1, true, 'the router must have issued a request');
    const body = capturedBodies[0]!;
    const parsed = JSON.parse(body) as { messages: Array<{ role: string; content: string }> };
    const userMsg = parsed.messages.find((m) => m.role === 'user');
    assert.ok(userMsg, 'the request must carry a user message (the verifier prompt)');
    const prompt = userMsg!.content;

    // (a) evidence passage TEXT reached the request — the crux O15 closes.
    const foundSnippet = EVIDENCE_SNIPPETS.find((s) => prompt.includes(s));
    assert.ok(
      foundSnippet,
      `the request must contain retrieved evidence TEXT; none of ${JSON.stringify(EVIDENCE_SNIPPETS)} found in prompt`,
    );

    // (b) provenance: paperId + locator for the evidence.
    assert.match(prompt, /corpus:[a-z0-9-]+ @ chars:\d+-\d+/, 'the request must carry paperId + locator provenance');
  } finally {
    globalThis.fetch = savedFetch;
    for (const [k, v] of Object.entries(savedEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    rmSync(edgesDir, { recursive: true, force: true });
  }
});
