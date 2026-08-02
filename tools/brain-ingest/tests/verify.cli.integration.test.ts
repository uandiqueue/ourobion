/**
 * ACCEPTANCE TEST (i) — O15/B1 · the mandatory integration test on the REAL CLI seam.
 *
 * This drives the SAME entry the `brain-ingest verify` command executes — `main([...])`
 * with argv-level wiring (parseArgs → runVerify → await LlmRouter.create() → the real
 * api_worker route) — NOT a direct `verifyClaim` call with an injected `retrieve`. The
 * router's
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
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { main } from '../src/cli.js';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');
const CORPUS = join(FIXTURES, 'verify-corpus.jsonl');
const CLAIMS = join(FIXTURES, 'verify-claims.jsonl');
const EDGE = 'gut_comfort_score|correlates|mood_score';

/**
 * #307 (d) · A TEST acceptance authorization written to disk, so this test drives the real CLI seam
 * through the same `--acceptance-authorization` path an operator uses.
 *
 * This exists because the verifier node moved to Agnes, which the router restricts to the acceptance
 * path ("Agnes is acceptance-only"). The SUBJECT of this test is unchanged — that the verifier
 * prompt carries retrieved evidence TEXT plus paperId/locator provenance, the crux O15 closes. Only
 * the calling convention moved: an authorization is now required to reach dispatch at all.
 *
 * Agnes is bound to 0 reserved USD, mirroring the shipped free-plan entry, so nothing here implies a
 * price. Anthropic and OpenAI are hard-zero: a test must not sanction a channel the run forbids.
 */
let authorizationSeq = 0;

function writeTestAuthorization(dir: string): { path: string; authorizationId: string; journalDir: string } {
  const path = join(dir, 'authorization.json');
  const day = 24 * 60 * 60 * 1000;
  // A UNIQUE id per run, because the attempt journal is keyed by authorizationId and PERSISTS at
  // `data/brain-ingest/live-acceptance/<id>/attempts.jsonl`. A fixed id would carry events from the
  // previous run, and since the hash covers issuedAt/basis, the second run would fail with
  // "journal contains an event from a different authorization" — a test green once and flaky after.
  // Fresh id, fresh journal, cleaned up below: the same discipline the owner set for real runs.
  authorizationSeq += 1;
  const authorizationId = `test-verify-cli-seam-${process.pid}-${authorizationSeq}`;
  writeFileSync(
    path,
    JSON.stringify({
      version: 1,
      authorizationId,
      authorizationBasis:
        'Offline CLI-seam integration test. No provider is contacted: global fetch is stubbed. ' +
        'Agnes maxReservedUsd is 0, mirroring the shipped owner-confirmed free-plan entry, so no ' +
        'price is asserted here. Anthropic and OpenAI are bound to zero starts so this test cannot ' +
        'sanction a channel the run forbids.',
      issuedAt: new Date(Date.now() - day).toISOString(),
      expiresAt: new Date(Date.now() + day).toISOString(),
      providers: {
        anthropic: { maxPostStarts: 0, maxReservedUsd: 0, priorPostStarts: 0, priorReservedUsd: 0 },
        openai: { maxPostStarts: 0, maxReservedUsd: 0, priorPostStarts: 0, priorReservedUsd: 0 },
        agnes: { maxPostStarts: 8, maxReservedUsd: 0, priorPostStarts: 0, priorReservedUsd: 0 },
      },
    }),
    'utf8',
  );
  const journalDir = join(
    dirname(fileURLToPath(import.meta.url)), '..', '..', '..',
    'data', 'brain-ingest', 'live-acceptance', authorizationId,
  );
  return { path, authorizationId, journalDir };
}

/** The evidence text the verifier is shown for the cited paper's echo-controlled neighbours. */
const EVIDENCE_SNIPPETS = [
  'Greater gut discomfort correlated with lower mood scores',
  'improvement in mood tracked the improvement in gut comfort',
];

/** The schema-passable verifier reply both canned bodies carry. */
function verifierReply(): string {
  return JSON.stringify({
    verdict: 'uncertain',
    sourceStances: [],
    directionCheck: { matchesClaim: false },
    claimKindCheck: { matchesClaim: true, supportedKind: 'correlational' },
    scopeCheck: { mismatch: false, supportedPopulation: null },
    effectSizeCheck: { matchesClaim: false, extractedSize: null },
    evidenceTier: 3,
    confidence: 0.4,
  });
}

/**
 * R4-U3: the verifier node now routes to ANTHROPIC (config decision C13 — OpenAI
 * synthesis, Anthropic verifier, decorrelated). The canned body must therefore be
 * the Anthropic Messages shape; an OpenAI body would parse to empty text and the
 * assertion would pass against a fallback record instead of a real seam.
 */
/**
 * The verifier's response body, in the AGNES wire shape.
 *
 * #307: this used to be the Anthropic Messages shape, because the shipped verifier was
 * `claude-sonnet-5`. The verifier is now `agnes-2.5-flash`, and Agnes speaks the OpenAI
 * chat-completions wire — so an Anthropic-shaped stub no longer parses and the CLI exits non-zero
 * before reaching any of this test's real assertions.
 */
function agnesBody(): unknown {
  return {
    id: 'chatcmpl_cli_test',
    object: 'chat.completion',
    model: 'agnes-2.5-flash',
    choices: [{ index: 0, message: { role: 'assistant', content: verifierReply() }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 50, completion_tokens: 30, total_tokens: 80 },
  };
}

test('ACCEPTANCE (i): real CLI verify seam carries evidence and publishes with --push-r2', async () => {
  const edgesDir = mkdtempSync(join(tmpdir(), 'verify-cli-'));

  // The AWS SDK uses Node's HTTP transport rather than global fetch. A loopback
  // S3-compatible stub therefore proves the real CLI seam reaches R2 without
  // allowing external network access. GET reports a missing first-run object;
  // PUT retains the exact verification bytes for assertions below.
  const r2Requests: Array<{ method: string; url: string; body: string }> = [];
  const r2Server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      const method = request.method ?? '';
      const url = request.url ?? '';
      const body = Buffer.concat(chunks).toString('utf8');
      r2Requests.push({ method, url, body });
      if (method === 'GET') {
        response.statusCode = 404;
        response.setHeader('content-type', 'application/xml');
        response.end('<Error><Code>NoSuchKey</Code><Message>missing test object</Message></Error>');
        return;
      }
      if (method === 'PUT') {
        response.statusCode = 200;
        response.end();
        return;
      }
      response.statusCode = 405;
      response.end();
    });
  });
  await new Promise<void>((resolve, reject) => {
    r2Server.once('error', reject);
    r2Server.listen(0, '127.0.0.1', resolve);
  });
  const r2Address = r2Server.address() as AddressInfo;

  // Env the CLI seam needs: dummy R2/config keys plus every provider key so the api_worker route
  // reaches fetch. The shipped posture (#307) sends the verifier to AGNES and everything else to
  // OpenAI, so the Agnes key is the one that matters here. All are dummies; the stubbed fetch
  // answers and nothing is spent.
  const savedEnv: Record<string, string | undefined> = {};
  const setEnv = (k: string, v: string): void => {
    savedEnv[k] = process.env[k];
    process.env[k] = v;
  };
  setEnv('OPENAI_API_KEY', 'sk-test-dummy');
  setEnv('ANTHROPIC_API_KEY', 'sk-ant-test-dummy');
  setEnv('AGNES_API_KEY', 'agnes-test-dummy');
  setEnv('INGEST_CONTACT_EMAIL', 'test@example.com');
  setEnv('OPENALEX_API_KEY', 'dummy');
  setEnv('R2_ENDPOINT', `http://127.0.0.1:${r2Address.port}`);
  setEnv('R2_ACCESS_KEY_ID', 'dummy');
  setEnv('R2_SECRET_ACCESS_KEY', 'dummy');
  setEnv('R2_BUCKET', 'dummy');

  const authorization = writeTestAuthorization(edgesDir);
  const capturedBodies: string[] = [];
  const savedFetch = globalThis.fetch;
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    capturedBodies.push(String(init.body));
    return {
      ok: true,
      status: 200,
      json: async () => agnesBody(),
      text: async () => JSON.stringify(agnesBody()),
    } as unknown as Response;
  }) as typeof fetch;

  try {
    const code = await main([
      'verify',
      '--from-claims', CLAIMS,
      '--corpus', CORPUS,
      '--edge', EDGE,
      '--edges-dir', edgesDir,
      // #307 (d): the verifier is Agnes, which the router restricts to the acceptance path.
      '--acceptance-authorization', authorization.path,
      '--acceptance-run-id', `${authorization.authorizationId}-run`,
      '--push-r2',
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

    // (c) argv-level --push-r2 reaches verify(), which reads then writes the
    // canonical object. This is the exact wiring omitted in live run 30743133643.
    const r2Get = r2Requests.find((request) => request.method === 'GET');
    const r2Put = r2Requests.find((request) => request.method === 'PUT');
    assert.match(r2Get?.url ?? '', /\/edges\/verifications\.jsonl(?:\?|$)/);
    assert.match(r2Put?.url ?? '', /\/edges\/verifications\.jsonl(?:\?|$)/);
    assert.ok(r2Put?.body.includes(EDGE), 'R2 PUT must contain the emitted verification');
  } finally {
    globalThis.fetch = savedFetch;
    await new Promise<void>((resolve, reject) => {
      r2Server.close((error) => error === undefined ? resolve() : reject(error));
    });
    rmSync(authorization.journalDir, { recursive: true, force: true });
    for (const [k, v] of Object.entries(savedEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    rmSync(edgesDir, { recursive: true, force: true });
  }
});

/**
 * #307 (d) · THE GUARD, pinned. Previously this behaviour was only accidentally covered by
 * ACCEPTANCE (i) failing for an unrelated reason.
 *
 * With the verifier on Agnes and NO acceptance context, `callApiWorker` must refuse before any HTTP
 * call. That refusal is what bounds the node: Agnes is priced free, so it reserves US$0 and the
 * per-day USD ledger cannot constrain it — the attempt journal, the validated authorization and the
 * per-logical-call POST cap are the only remaining bound. If this test ever goes green by dispatching
 * instead of refusing, the verifier has become unconstrained.
 */
test('#307 (d): the plain verify route REFUSES an Agnes verifier with no acceptance authorization', async () => {
  const edgesDir = mkdtempSync(join(tmpdir(), 'verify-cli-refuse-'));

  const savedEnv: Record<string, string | undefined> = {};
  const setEnv = (k: string, v: string): void => {
    savedEnv[k] = process.env[k];
    process.env[k] = v;
  };
  setEnv('OPENAI_API_KEY', 'sk-test-dummy');
  setEnv('ANTHROPIC_API_KEY', 'sk-ant-test-dummy');
  setEnv('AGNES_API_KEY', 'agnes-test-dummy');
  setEnv('INGEST_CONTACT_EMAIL', 'test@example.com');
  setEnv('OPENALEX_API_KEY', 'dummy');
  setEnv('R2_ENDPOINT', 'https://example.com');
  setEnv('R2_ACCESS_KEY_ID', 'dummy');
  setEnv('R2_SECRET_ACCESS_KEY', 'dummy');
  setEnv('R2_BUCKET', 'dummy');

  let fetchCalls = 0;
  const savedFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    throw new Error('no provider call may be made without an acceptance authorization');
  }) as typeof fetch;

  try {
    const code = await main([
      'verify',
      '--from-claims', CLAIMS,
      '--corpus', CORPUS,
      '--edge', EDGE,
      '--edges-dir', edgesDir,
      // deliberately NO --acceptance-authorization / --acceptance-run-id
    ]);
    assert.notEqual(code, 0, 'verify must NOT succeed against an acceptance-only verifier');
    assert.equal(fetchCalls, 0, 'the refusal must happen before any HTTP call');
  } finally {
    globalThis.fetch = savedFetch;
    for (const [k, v] of Object.entries(savedEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    rmSync(edgesDir, { recursive: true, force: true });
  }
});

/**
 * #307 (d) · the two acceptance flags are a PAIR. Half of an authorization is not an authorization,
 * and silently ignoring a lone flag would let an operator believe a run was journal-bounded when it
 * was not.
 */
test('#307 (d): supplying only one acceptance flag is refused, not silently ignored', async () => {
  const edgesDir = mkdtempSync(join(tmpdir(), 'verify-cli-halfflag-'));
  try {
    // `main()` catches and reports rather than rejecting, so assert on the EXIT CODE and the
    // message reaching stderr — a lone flag must never be silently ignored.
    const errors: string[] = [];
    const write = process.stderr.write.bind(process.stderr);
    (process.stderr as unknown as { write: (s: string) => boolean }).write = (chunk: string) => {
      errors.push(chunk);
      return true;
    };
    let code: number;
    try {
      code = await main([
        'verify',
        '--from-claims', CLAIMS,
        '--corpus', CORPUS,
        '--edge', EDGE,
        '--edges-dir', edgesDir,
        '--acceptance-run-id', 'lonely',
      ]);
    } finally {
      (process.stderr as unknown as { write: typeof write }).write = write;
    }
    assert.notEqual(code, 0, 'half an authorization must not be accepted');
    assert.match(errors.join(''), /must be given together/);
  } finally {
    rmSync(edgesDir, { recursive: true, force: true });
  }
});
